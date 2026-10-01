// Validação pós-render — confere tecnicamente o MP4 final de um projeto.
// Somente leitura sobre o vídeo. Usa o ffprobe do Remotion (media-lib).
//
// Padrão esperado (docs/10-CONFERENCIA-FINAL.md): h264 · yuv420p · color_range=tv ·
// bt709 · 1080×1920 · 30/1 · duração = durationSeconds · destino e versão corretos.
import fs from 'node:fs';
import path from 'node:path';
import {fmtBytes, probe} from './media-lib.mjs';
import {referencedMediaTypes} from './preflight-lib.mjs';
import {existingRenderVersions, renderBase, versionLabel} from './status-lib.mjs';

const FPS = 30;

/**
 * Descobre qual MP4 validar: --version explícita, senão a versão mais recente
 * a partir da versão de trabalho do estado (ou a mais recente em disco).
 */
export const resolveRenderTarget = (project, {version, status} = {}) => {
  const base = renderBase(project.config);
  const versions = existingRenderVersions(project.renders, project.config);
  let n;
  if (version !== undefined && version !== true) {
    const m = String(version).match(/^v?(\d{1,3})$/i);
    if (!m) throw new Error(`--version inválida: "${version}". Use v01, v02...`);
    n = Number(m[1]);
  } else {
    const min = status ? Number(status.projectVersion.slice(1)) : 1;
    const eligible = versions.filter((v) => v >= min);
    n = eligible.length ? Math.max(...eligible) : versions.length ? Math.max(...versions) : null;
  }
  if (n === null) return {base, versions, version: null, file: null, path: null};
  const file = `${base}_${versionLabel(n)}.mp4`;
  return {base, versions, version: versionLabel(n), file, path: path.join(project.renders, file)};
};

/**
 * Executa a validação. Devolve {ok, errors, warnings, file, version, checks, media}.
 * opts: {version, status, expectAudio (auto = detectado no código)}
 */
export const runInspect = (project, {version, status = null, expectAudio} = {}) => {
  const checks = [];
  const add = (area, level, msg) => checks.push({area, level, msg});
  const cfg = project.config;
  const target = resolveRenderTarget(project, {version, status});
  const result = {slug: project.slug, at: new Date().toISOString(), file: target.file, version: target.version, checks, media: null};

  // ── Existência / destino / versão ────────────────────────
  if (!target.file) {
    add('arquivo', 'error', `Nenhum render final ${target.base}_vNN.mp4 em renders/.`);
    return finish(result);
  }
  const relPath = path.relative(project.dir, target.path).split(path.sep).join('/');
  if (!fs.existsSync(target.path)) {
    add('arquivo', 'error', `${relPath} não existe.`);
    return finish(result);
  }
  add('destino', 'ok', `Destino correto: projects/${project.slug}/${relPath} (nome gerado do project.json).`);
  if (status && status.stage !== '10_FINAL' && target.version !== status.projectVersion) {
    add('versão', 'warn', `Arquivo ${target.version} ≠ versão de trabalho ${status.projectVersion} no estado.`);
  } else add('versão', 'ok', `Versão ${target.version}${target.versions.length > 1 ? ` (em disco: ${target.versions.map(versionLabel).join(', ')})` : ''}.`);
  const log = path.join(project.dir, 'versoes.md');
  if (fs.existsSync(log) && !fs.readFileSync(log, 'utf8').includes(target.file)) add('versão', 'warn', `${target.file} não aparece em versoes.md.`);

  const size = fs.statSync(target.path).size;
  if (size < 1024) {
    add('tamanho', 'error', `Arquivo com ${size} bytes — render incompleto ou corrompido.`);
    return finish(result);
  }

  // ── ffprobe ──────────────────────────────────────────────
  const m = probe(target.path);
  if (m.error) {
    add('arquivo', 'error', `ffprobe não conseguiu ler o MP4: ${m.error}`);
    return finish(result);
  }
  result.media = m;
  const v = m.video;
  if (!/mp4/.test(m.formatName ?? '')) add('arquivo', 'error', `Contêiner "${m.formatName}" (esperado MP4).`);
  if (!v) {
    add('vídeo', 'error', 'Nenhuma trilha de vídeo no arquivo.');
    return finish(result);
  }

  const expect = (area, cond, okMsg, badMsg, level = 'error') => add(area, cond ? 'ok' : level, cond ? okMsg : badMsg);
  const profile = {66: 'Baseline', 77: 'Main', 100: 'High'}[v.profile] ?? v.profile;
  expect('codec', v.codec === 'h264', `h264${profile ? ` (${profile})` : ''}`, `Codec ${v.codec} (esperado h264).`);
  expect('codec', v.pixFmt === 'yuv420p', 'yuv420p', `pix_fmt ${v.pixFmt} (esperado yuv420p).`);
  expect('cor', v.colorRange === 'tv', 'color_range tv', `color_range ${v.colorRange ?? 'não informado'} (esperado tv).`);
  expect('cor', v.colorSpace === 'bt709', 'color_space bt709', `color_space ${v.colorSpace ?? 'não informado'} (esperado bt709).`);
  if (v.colorPrimaries !== 'bt709' || v.colorTransfer !== 'bt709') {
    add('cor', 'warn', `primaries ${v.colorPrimaries ?? '—'} / transfer ${v.colorTransfer ?? '—'} (esperado bt709/bt709).`);
  }
  expect('resolução', v.width === 1080 && v.height === 1920, '1080×1920', `${v.width}×${v.height} (esperado 1080×1920).`);
  if (v.rotation) add('resolução', 'warn', `Metadado de rotação ${v.rotation}° no MP4.`);
  expect('fps', v.rFrameRate === '30/1' || v.fps === FPS, '30 fps (30/1)', `fps ${v.rFrameRate} (esperado 30/1).`);

  const vDur = v.durationSec ?? m.durationSec;
  if (typeof cfg.durationSeconds === 'number') {
    const target = cfg.durationSeconds;
    const tol = 1 / FPS + 0.02;
    expect('duração', vDur !== null && Math.abs(vDur - target) <= tol, `${vDur?.toFixed(3)}s (briefing ${target}s)`, `Duração ${vDur?.toFixed(3)}s ≠ ${target}s do briefing (tolerância 1 frame).`);
    const frames = Math.round(target * FPS);
    if (v.nbFrames !== null && v.nbFrames !== frames) add('duração', 'warn', `${v.nbFrames} frames no arquivo (esperado ${frames}).`);
  } else add('duração', 'warn', `durationSeconds não definido no project.json — duração do arquivo: ${vDur?.toFixed(3)}s.`);

  // ── Áudio ────────────────────────────────────────────────
  let wantAudio = expectAudio;
  if (wantAudio === undefined) {
    try {
      const t = referencedMediaTypes(project);
      wantAudio = t.has('audio') || t.has('audio-component');
    } catch {
      wantAudio = null;
    }
  }
  if (m.audio) {
    add('áudio', m.audio.codec === 'aac' ? 'ok' : 'warn', `Trilha de áudio ${m.audio.codec} · ${m.audio.channels ?? '?'} canal(is) · ${m.audio.sampleRate ?? '?'} Hz`);
    if (m.audio.durationSec && vDur && Math.abs(m.audio.durationSec - vDur) > 0.1) {
      add('áudio', 'warn', `Áudio com ${m.audio.durationSec.toFixed(3)}s e vídeo com ${vDur.toFixed(3)}s.`);
    }
  } else if (wantAudio) add('áudio', 'error', 'O projeto usa áudio, mas o MP4 não tem trilha de áudio.');
  else add('áudio', 'info', 'Sem trilha de áudio (o projeto não referencia áudio).');

  // ── Tamanho ──────────────────────────────────────────────
  const kbps = m.bitRate ? Math.round(m.bitRate / 1000) : vDur ? Math.round((size * 8) / vDur / 1000) : null;
  add('tamanho', 'ok', `${fmtBytes(size)}${kbps ? ` · ${kbps} kbps` : ''}`);

  return finish(result);
};

const finish = (r) => {
  r.errors = r.checks.filter((c) => c.level === 'error').length;
  r.warnings = r.checks.filter((c) => c.level === 'warn').length;
  r.ok = r.errors === 0;
  return r;
};

const ICON = {error: '✖', warn: '⚠', ok: '✓', info: '·'};
export const formatInspect = (r) => {
  const lines = [`VALIDAÇÃO PÓS-RENDER — ${r.slug}${r.file ? ` · ${r.file}` : ''}`, ''];
  for (const c of r.checks) lines.push(`  ${ICON[c.level]} [${c.area}] ${c.msg}`);
  lines.push('', r.ok ? `✔ APROVADO — ${r.warnings} aviso(s).` : `✖ REPROVADO — ${r.errors} erro(s), ${r.warnings} aviso(s).`);
  return lines.join('\n');
};

/** Resumo compacto para o project-status.json. */
export const inspectSummary = (r) => ({
  at: r.at,
  ok: r.ok,
  errors: r.errors,
  warnings: r.warnings,
  file: r.file,
  version: r.version,
  video: r.media?.video
    ? {codec: r.media.video.codec, width: r.media.video.width, height: r.media.video.height, fps: r.media.video.rFrameRate, pixFmt: r.media.video.pixFmt, colorRange: r.media.video.colorRange, colorSpace: r.media.video.colorSpace, durationSec: r.media.video.durationSec}
    : null,
  audio: r.media?.audio ? {codec: r.media.audio.codec, channels: r.media.audio.channels} : null,
  sizeBytes: r.media?.sizeBytes ?? null,
  problems: r.checks.filter((c) => c.level === 'error' || c.level === 'warn').map((c) => `${c.level === 'error' ? 'ERRO' : 'aviso'} [${c.area}] ${c.msg}`),
});
