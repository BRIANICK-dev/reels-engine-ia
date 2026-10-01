// Identificação técnica de mídia — base do Asset Intelligence, do preflight e
// da validação pós-render. Node puro, sem dependências novas:
//  - imagens: dimensões lidas direto do cabeçalho (PNG, JPEG + EXIF, WebP, GIF, BMP, SVG);
//  - vídeo/áudio: ffprobe que já vem com o Remotion (`remotion ffprobe`),
//    o mesmo binário em Windows, macOS e Linux.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const TYPES = {
  image: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'avif'],
  video: ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi'],
  audio: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'oga', 'flac', 'opus'],
  font: ['woff2', 'woff', 'ttf', 'otf'],
};
const EXT_TYPE = Object.fromEntries(Object.entries(TYPES).flatMap(([t, exts]) => exts.map((e) => [e, t])));
export const MEDIA_EXT_RE = new RegExp(`\\.(${Object.values(TYPES).flat().join('|')})$`, 'i');

export const extOf = (file) => path.extname(file).slice(1).toLowerCase();
export const typeOf = (file) => EXT_TYPE[extOf(file)] ?? 'outro';

/** Arquivos de sistema/controle que não são assets. */
export const IGNORED = new Set(['.gitkeep', 'desktop.ini', 'Desktop.ini', 'Thumbs.db', '.DS_Store']);

/** Lista recursiva (caminhos relativos com "/"), ignorando arquivos de sistema e ocultos. */
export const walkFiles = (dir) => {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const rec = (d, prefix) => {
    for (const e of fs.readdirSync(d, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name))) {
      if (IGNORED.has(e.name) || e.name.startsWith('.')) continue;
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) rec(path.join(d, e.name), rel);
      else if (e.isFile()) out.push(rel);
    }
  };
  rec(dir, '');
  return out;
};

// ─────────────────────────────────────────────────────────────
// Geometria
// ─────────────────────────────────────────────────────────────

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const COMMON = [
  ['9:16', 9 / 16], ['16:9', 16 / 9], ['1:1', 1], ['4:5', 4 / 5], ['5:4', 5 / 4],
  ['3:4', 3 / 4], ['4:3', 4 / 3], ['2:3', 2 / 3], ['3:2', 3 / 2], ['21:9', 21 / 9],
];

export const orientationOf = (w, h) => (!w || !h ? null : w === h ? 'quadrado' : h > w ? 'vertical' : 'horizontal');

/** "1080×1920" → {ratio: "9:16", label: "9:16"}; proporções quebradas recebem a mais próxima (±1%). */
export const aspectOf = (w, h) => {
  if (!w || !h) return null;
  const g = gcd(w, h);
  const exact = `${w / g}:${h / g}`;
  const r = w / h;
  const near = COMMON.find(([, v]) => Math.abs(v - r) / v <= 0.01);
  return {ratio: exact, decimal: Math.round(r * 10000) / 10000, label: near ? near[0] : null};
};

// ─────────────────────────────────────────────────────────────
// Imagens — cabeçalhos
// ─────────────────────────────────────────────────────────────

/** Orientação EXIF (1–8) de um JPEG, ou null. 5–8 = imagem girada 90°. */
const jpegExifOrientation = (buf, app1Start, app1Len) => {
  const s = app1Start;
  if (buf.toString('ascii', s, s + 4) !== 'Exif') return null;
  const t = s + 6; // início do TIFF
  const le = buf.toString('ascii', t, t + 2) === 'II';
  const u16 = (o) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
  const u32 = (o) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
  const ifd = t + u32(t + 4);
  if (ifd + 2 > s + app1Len) return null;
  const n = u16(ifd);
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12;
    if (e + 12 > buf.length) break;
    if (u16(e) === 0x0112) return u16(e + 8);
  }
  return null;
};

export const imageInfo = (file) => {
  const ext = extOf(file);
  const buf = fs.readFileSync(file);
  const r = {width: null, height: null, format: ext, exifOrientation: null};
  try {
    if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47) {
      r.format = 'png';
      r.width = buf.readUInt32BE(16);
      r.height = buf.readUInt32BE(20);
    } else if (buf.length >= 10 && buf.toString('ascii', 0, 3) === 'GIF') {
      r.format = 'gif';
      r.width = buf.readUInt16LE(6);
      r.height = buf.readUInt16LE(8);
    } else if (buf.length >= 26 && buf.toString('ascii', 0, 2) === 'BM') {
      r.format = 'bmp';
      r.width = buf.readInt32LE(18);
      r.height = Math.abs(buf.readInt32LE(22));
    } else if (buf.length >= 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
      r.format = 'webp';
      const chunk = buf.toString('ascii', 12, 16);
      if (chunk === 'VP8X') {
        r.width = 1 + buf.readUIntLE(24, 3);
        r.height = 1 + buf.readUIntLE(27, 3);
      } else if (chunk === 'VP8L') {
        const b = buf.readUInt32LE(21);
        r.width = 1 + (b & 0x3fff);
        r.height = 1 + ((b >> 14) & 0x3fff);
      } else if (chunk === 'VP8 ') {
        r.width = buf.readUInt16LE(26) & 0x3fff;
        r.height = buf.readUInt16LE(28) & 0x3fff;
      }
    } else if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
      r.format = 'jpeg';
      let o = 2;
      while (o + 9 < buf.length) {
        if (buf[o] !== 0xff) {
          o++;
          continue;
        }
        const marker = buf[o + 1];
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
          o += 2;
          continue;
        }
        const len = buf.readUInt16BE(o + 2);
        if (marker === 0xe1 && r.exifOrientation === null) r.exifOrientation = jpegExifOrientation(buf, o + 4, len - 2);
        const isSOF = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
        if (isSOF) {
          r.height = buf.readUInt16BE(o + 5);
          r.width = buf.readUInt16BE(o + 7);
          break;
        }
        o += 2 + len;
      }
    } else if (ext === 'svg') {
      r.format = 'svg';
      const txt = buf.toString('utf8', 0, Math.min(buf.length, 4096));
      const tag = txt.match(/<svg\b[^>]*>/i)?.[0] ?? '';
      const num = (attr) => {
        const m = tag.match(new RegExp(`\\b${attr}\\s*=\\s*["']\\s*([\\d.]+)(px)?\\s*["']`, 'i'));
        return m ? Math.round(Number(m[1])) : null;
      };
      r.width = num('width');
      r.height = num('height');
      const vb = tag.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
      if ((!r.width || !r.height) && vb) {
        r.width = Math.round(Number(vb[1]));
        r.height = Math.round(Number(vb[2]));
      }
    }
  } catch {
    // cabeçalho truncado/inválido: dimensões ficam null
  }
  return r;
};

// ─────────────────────────────────────────────────────────────
// Vídeo / áudio — ffprobe do Remotion
// ─────────────────────────────────────────────────────────────

let cachedBin;
/** Caminho do CLI do Remotion instalado na raiz. Lança erro (não encerra o processo). */
export const remotionCli = (root = ROOT) => {
  if (cachedBin && root === ROOT) return cachedBin;
  const req = createRequire(path.join(root, 'package.json'));
  let pkgPath;
  try {
    pkgPath = req.resolve('@remotion/cli/package.json');
  } catch {
    throw new Error('Remotion não instalado (rode "npm ci" na raiz) — ffprobe indisponível.');
  }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const bin = path.join(path.dirname(pkgPath), typeof pkg.bin === 'string' ? pkg.bin : pkg.bin.remotion);
  if (root === ROOT) cachedBin = bin;
  return bin;
};

/** Executa `remotion <tool> ...args` e devolve {status, stdout, stderr}. tool = ffprobe | ffmpeg. */
export const runRemotionTool = (tool, args, {input, timeout = 120000} = {}) => {
  const r = spawnSync(process.execPath, [remotionCli(), tool, ...args], {
    cwd: ROOT,
    input,
    encoding: input ? undefined : 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout,
  });
  if (r.error) throw r.error;
  return {status: r.status, stdout: String(r.stdout ?? ''), stderr: String(r.stderr ?? '')};
};

const parseRate = (s) => {
  if (!s || s === '0/0') return null;
  const [a, b] = String(s).split('/').map(Number);
  return b ? a / b : a;
};

/** ffprobe normalizado. Nunca lança: em falha devolve {error}. */
export const probe = (file) => {
  let r;
  try {
    r = runRemotionTool('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]);
  } catch (e) {
    return {error: e.message};
  }
  if (r.status !== 0) return {error: (r.stderr || `ffprobe saiu com código ${r.status}`).trim().split('\n')[0]};
  let j;
  try {
    j = JSON.parse(r.stdout);
  } catch {
    return {error: 'saída do ffprobe ilegível'};
  }
  const streams = j.streams ?? [];
  const v = streams.find((s) => s.codec_type === 'video' && !s.disposition?.attached_pic);
  const a = streams.find((s) => s.codec_type === 'audio');
  const rotation = Number(
    v?.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? v?.tags?.rotate ?? 0,
  );
  const num = (x) => (x === undefined || x === null || x === 'N/A' ? null : Number(x));
  return {
    formatName: j.format?.format_name ?? null,
    durationSec: num(j.format?.duration),
    sizeBytes: num(j.format?.size),
    bitRate: num(j.format?.bit_rate),
    video: v
      ? {
          codec: v.codec_name ?? null,
          profile: v.profile ?? null,
          width: v.width ?? null,
          height: v.height ?? null,
          fps: parseRate(v.r_frame_rate),
          avgFps: parseRate(v.avg_frame_rate),
          rFrameRate: v.r_frame_rate ?? null,
          pixFmt: v.pix_fmt ?? null,
          colorRange: v.color_range ?? null,
          colorSpace: v.color_space ?? null,
          colorTransfer: v.color_transfer ?? null,
          colorPrimaries: v.color_primaries ?? null,
          durationSec: num(v.duration),
          nbFrames: num(v.nb_frames),
          rotation: Number.isFinite(rotation) ? rotation : 0,
        }
      : null,
    audio: a
      ? {codec: a.codec_name ?? null, channels: a.channels ?? null, sampleRate: num(a.sample_rate), durationSec: num(a.duration)}
      : null,
  };
};

// ─────────────────────────────────────────────────────────────
// Descrição de um asset
// ─────────────────────────────────────────────────────────────

const round = (n, d = 2) => (n === null || n === undefined ? null : Math.round(n * 10 ** d) / 10 ** d);

/**
 * Ficha técnica de um arquivo: nome, extensão, tipo, tamanho, dimensões,
 * orientação, proporção, duração (quando aplicável) e observações objetivas.
 * `name` é o caminho relativo usado em staticFile().
 */
export const describeFile = (absPath, name = path.basename(absPath)) => {
  const ext = extOf(absPath);
  const type = typeOf(absPath);
  const stat = fs.statSync(absPath);
  const d = {
    name,
    ext,
    type,
    sizeBytes: stat.size,
    width: null,
    height: null,
    orientation: null,
    aspect: null,
    durationSec: null,
    fps: null,
    codec: null,
    audio: null,
    notes: [],
  };

  if (/\s/.test(name) || /[^\x00-\x7f]/.test(name)) d.notes.push('nome com espaço ou acento (prefira minúsculas-com-hifens)');
  if (stat.size === 0) d.notes.push('arquivo vazio (0 bytes)');

  if (type === 'image' && stat.size > 0) {
    const im = imageInfo(absPath);
    let {width, height} = im;
    if (im.exifOrientation && im.exifOrientation >= 5) {
      [width, height] = [height, width];
      d.notes.push(`JPEG com rotação EXIF (${im.exifOrientation}): dimensões exibidas já consideram o giro`);
    }
    d.width = width;
    d.height = height;
    if (!width) d.notes.push('dimensões não identificadas');
  } else if ((type === 'video' || type === 'audio') && stat.size > 0) {
    const p = probe(absPath);
    if (p.error) {
      d.notes.push(`não foi possível ler com ffprobe: ${p.error}`);
    } else {
      d.durationSec = round(p.durationSec ?? p.video?.durationSec ?? p.audio?.durationSec, 3);
      if (p.video) {
        let {width, height} = p.video;
        if (Math.abs(p.video.rotation) % 180 === 90) {
          [width, height] = [height, width];
          d.notes.push(`vídeo com rotação de ${p.video.rotation}° nos metadados: dimensões exibidas já consideram o giro`);
        }
        d.width = width;
        d.height = height;
        d.fps = round(p.video.fps, 3);
        d.codec = p.video.codec;
        if (type === 'audio') d.notes.push('contém trilha de imagem (capa embutida ou vídeo)');
      } else if (type === 'video') {
        d.notes.push('nenhuma trilha de vídeo encontrada');
      }
      if (p.audio) d.audio = {codec: p.audio.codec, channels: p.audio.channels, sampleRate: p.audio.sampleRate};
      if (type === 'audio' && !p.audio) d.notes.push('nenhuma trilha de áudio encontrada');
      if (type === 'audio') d.codec = p.audio?.codec ?? null;
    }
  }

  d.orientation = orientationOf(d.width, d.height);
  d.aspect = aspectOf(d.width, d.height);

  // Observações objetivas para Reels 1080×1920 · 30 fps (sem juízo criativo).
  if (type === 'image' || type === 'video') {
    if (d.orientation === 'horizontal') d.notes.push('horizontal — se usado em tela cheia (9:16), exigirá recorte/reenquadramento');
    if (d.width && d.height && Math.min(d.width, d.height) < 1080) d.notes.push(`menor lado ${Math.min(d.width, d.height)} px (< 1080) — se usado em tela cheia, pode perder nitidez`);
  }
  if (type === 'video' && d.fps && Math.abs(d.fps - 30) > 0.01) {
    d.notes.push(Math.abs(d.fps - 29.97) < 0.01 ? 'fps 29,97 (drop-frame) — convertido para 30 no render' : `fps ${d.fps} ≠ 30 — será reamostrado no render`);
  }
  return d;
};

export const fmtBytes = (n) => {
  if (n === null || n === undefined) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(2)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
};

export const fmtDuration = (s) => {
  if (s === null || s === undefined) return '—';
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return m ? `${m}min ${sec.toFixed(1)}s` : `${sec.toFixed(2)}s`;
};
