// Gráficos dos manuais: ícones, logo e miniaturas das linguagens.
// Tudo em código (SVG em texto), sem arquivos de imagem e sem data: URIs —
// o verificar-publico trata .svg/.png como mídia, e os manuais precisam funcionar offline.

const icone = (corpo, tamanho = 18) =>
  `<svg class="ico" width="${tamanho}" height="${tamanho}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${corpo}</svg>`;

/** Use nas fontes como {{I:nome}}. */
export const ICONES = {
  search: icone('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', 16),
  menu: icone('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  clock: icone('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', 15),
  check: icone('<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>'),
  x: icone('<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>'),
  warn: icone('<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17.5v.01"/>', 22),
  info: icone('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>', 22),
  code: icone('<path d="m8 8-5 4 5 4M16 8l5 4-5 4M13.5 5l-3 14"/>', 22),
  copy: icone('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h9"/>', 14),
  pause: icone('<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>', 15),
  chat: icone('<path d="M4 5h16v11H9l-5 4z"/>', 20),
  term: icone('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M12 15h5"/>', 20),
  film: icone('<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M10 9.5v5l4-2.5z"/>', 20),
  lock: icone('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', 18),
  out: icone('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>', 13),
  up: icone('<path d="M12 19V5M6 11l6-6 6 6"/>', 14),
  folder: icone('<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v8.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/>', 16),
  file: icone('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>', 16),
  bulb: icone('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/>', 22),
};

export const LOGO = `<svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><rect width="34" height="34" rx="9" class="f-ink"/><rect x="11" y="6" width="12" height="22" rx="2.5" fill="none" stroke="var(--bg)" stroke-width="1.8"/><path d="M15 13.5v7l5.5-3.5z" class="f-accent"/></svg>`;


const grain = (id, op, freq = 0.9) =>
  `<filter id="gr-${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${op} 0"/></filter>`;

export const MINIATURAS = {
  'editorial-minimalista': {classe: 't-ed', svg: `<rect width="90" height="160" fill="#F3F0E9"/>
<g class="a ph"><rect x="38" y="14" width="44" height="66" fill="#D2CABB"/><path d="M38 80 L56 56 L66 66 L74 58 L82 68 L82 80Z" fill="#B9AF9C"/><circle cx="72" cy="30" r="5" fill="#E9E2D4"/></g>
<text x="8" y="20" font-size="5.5" fill="#7B7468" font-weight="600" letter-spacing=".5">N.º 03</text>
<line x1="8" y1="92" x2="30" y2="92" stroke="#1E1C19" stroke-width=".6"/>
<clipPath id="ed-c1"><rect x="6" y="96" width="70" height="12"/></clipPath>
<clipPath id="ed-c2"><rect x="6" y="108" width="70" height="12"/></clipPath>
<g clip-path="url(#ed-c1)"><text class="a m" x="8" y="106" font-size="10" fill="#1E1C19" font-weight="500">Coleção</text></g>
<g clip-path="url(#ed-c2)"><text class="a m2" x="8" y="118" font-size="10" fill="#1E1C19" font-weight="500">de verão</text></g>
<rect x="8" y="128" width="34" height="2" fill="#A39C8F"/><rect x="8" y="133" width="26" height="2" fill="#A39C8F"/>
<rect x="76" y="140" width="6" height="6" fill="#C2522D"/>`},
  'elegante-premium': {classe: 't-el', svg: `<defs><radialGradient id="el-g" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#2A2420"/><stop offset="1" stop-color="#0B0A09"/></radialGradient>${grain('el', 0.1)}</defs>
<rect width="90" height="160" fill="url(#el-g)"/>
<rect width="90" height="160" filter="url(#gr-el)"/>
<g class="a bl"><text x="45" y="76" font-size="7.4" fill="#EEE7DB" font-weight="300" text-anchor="middle" letter-spacing="2.6">ATELIÊ</text>
<text x="45" y="88" font-size="4.2" fill="#B9AE9C" text-anchor="middle" letter-spacing="1.6">EDIÇÃO LIMITADA</text></g>
<rect class="a ln" x="35" y="94" width="20" height=".7" fill="#C2A26E"/>`},
  'tipografia-cinetica': {classe: 't-tc', svg: `<rect width="90" height="160" fill="#111"/>
<g class="a f"><rect width="90" height="160" fill="#FFD400"/><text class="a w" x="45" y="92" font-size="40" font-weight="900" text-anchor="middle" fill="#111">SÓ</text></g>
<g class="a f f2"><rect width="90" height="160" fill="#111"/><text class="a w w2" x="45" y="89" font-size="27" font-weight="900" text-anchor="middle" fill="#FFD400" textLength="74" lengthAdjust="spacingAndGlyphs">HOJE</text></g>
<g class="a f f3"><rect width="90" height="160" fill="#FFD400"/><text class="a w w3" x="45" y="88" font-size="21" font-weight="900" text-anchor="middle" fill="#111" textLength="76" lengthAdjust="spacingAndGlyphs">AGORA</text></g>`},
  'cinematografico-documental': {classe: 't-ci', svg: `<defs><linearGradient id="ci-s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6F7FA6"/><stop offset=".55" stop-color="#E7A97A"/><stop offset="1" stop-color="#F2C79A"/></linearGradient>
<linearGradient id="ci-sc" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".65"/></linearGradient>${grain('ci', 0.14)}</defs>
<g class="a kb"><rect width="90" height="160" fill="url(#ci-s)"/><circle cx="58" cy="76" r="9" fill="#FBE2BE"/>
<path d="M0 98 L22 74 L38 90 L55 68 L90 100 L90 160 L0 160Z" fill="#4A4F66"/><path d="M0 116 L30 96 L52 112 L72 98 L90 110 L90 160 L0 160Z" fill="#2B2E3D"/></g>
<rect width="90" height="160" fill="url(#ci-sc)"/>
<rect width="90" height="160" filter="url(#gr-ci)"/>
<text class="a cap" x="45" y="142" font-size="5.6" fill="#F4EFE8" text-anchor="middle">o caminho até lá</text>`},
  'colagem-recorte': {classe: 't-co', svg: `<defs>${grain('co', 0.22, .75)}</defs>
<rect width="90" height="160" fill="#EFE5CF"/>
<rect width="90" height="160" filter="url(#gr-co)"/>
<g class="a pc"><g transform="rotate(-6 45 52)"><rect x="17" y="40" width="58" height="26" fill="#1C1A17" transform="translate(2.5 2.5)"/><rect x="17" y="40" width="58" height="26" fill="#D9482B"/><text x="46" y="59" font-size="14" font-weight="900" text-anchor="middle" fill="#FFF6E6" textLength="44" lengthAdjust="spacingAndGlyphs">NOVO</text></g></g>
<g class="a pc pc2"><g transform="rotate(4 40 88)"><rect x="10" y="78" width="60" height="20" fill="#1C1A17" transform="translate(2.5 2.5)"/><rect x="10" y="78" width="60" height="20" fill="#2F7F79"/><text x="40" y="92" font-size="9" font-weight="800" text-anchor="middle" fill="#FFF6E6" textLength="48" lengthAdjust="spacingAndGlyphs">no sábado</text></g></g>
<g class="a pc pc3"><g transform="rotate(-3 52 120)"><rect x="26" y="110" width="52" height="20" fill="#1C1A17" transform="translate(2.5 2.5)"/><rect x="26" y="110" width="52" height="20" fill="#E8B526"/><text x="52" y="124" font-size="8.5" font-weight="800" text-anchor="middle" fill="#1C1A17" textLength="42" lengthAdjust="spacingAndGlyphs">VENHA VER</text></g></g>`},
  'interface-tech': {classe: 't-it', svg: `<rect width="90" height="160" fill="#0C1016"/>
<g stroke="#1B2430" stroke-width=".5"><line x1="15" y1="0" x2="15" y2="160"/><line x1="45" y1="0" x2="45" y2="160"/><line x1="75" y1="0" x2="75" y2="160"/><line x1="0" y1="30" x2="90" y2="30"/><line x1="0" y1="70" x2="90" y2="70"/><line x1="0" y1="110" x2="90" y2="110"/><line x1="0" y1="140" x2="90" y2="140"/></g>
<text x="10" y="24" font-size="4.6" fill="#7F8EA3" letter-spacing=".9" font-weight="700" textLength="68" lengthAdjust="spacingAndGlyphs">TEMPO DE RESPOSTA</text>
<g class="a num"><text x="9" y="58" font-size="25" font-weight="800" fill="#4DE1A4" textLength="64" lengthAdjust="spacingAndGlyphs">-42%</text></g>
<rect class="a bar" x="14" y="98" width="10" height="38" fill="#2A3A4E"/>
<rect class="a bar bar2" x="30" y="108" width="10" height="28" fill="#2A3A4E"/>
<rect class="a bar bar3" x="46" y="116" width="10" height="20" fill="#2A3A4E"/>
<rect class="a bar bar4" x="62" y="122" width="10" height="14" fill="#4DE1A4"/>
<rect x="10" y="146" width="22" height="6" rx="1" fill="none" stroke="#4DE1A4" stroke-width=".6"/><text x="21" y="150.6" font-size="3.6" fill="#4DE1A4" text-anchor="middle" font-weight="700">V2.0</text>`},
  'retro-filme': {classe: 't-re', svg: `<defs><linearGradient id="re-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C79A6C"/><stop offset="1" stop-color="#5E3F2B"/></linearGradient>
<radialGradient id="re-v" cx="50%" cy="50%" r="75%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#1A0E06" stop-opacity=".75"/></radialGradient>${grain('re', 0.3, .8)}</defs>
<g class="a wv"><rect x="-2" y="-2" width="94" height="164" fill="url(#re-g)"/>
<circle cx="45" cy="62" r="22" fill="#E5C595" opacity=".55"/><path d="M-2 108 Q25 92 45 104 T92 98 L92 162 L-2 162Z" fill="#3F2A1D" opacity=".85"/>
<g class="a ti"><text x="45" y="134" font-size="11" font-weight="900" text-anchor="middle" fill="#F3E3C3" letter-spacing="1">DESDE</text><text x="45" y="146" font-size="8" font-weight="800" text-anchor="middle" fill="#F3E3C3" letter-spacing="2.5">SEMPRE</text></g></g>
<rect width="90" height="160" fill="url(#re-v)"/>
<rect width="90" height="160" filter="url(#gr-re)"/>
<rect class="a fl" width="90" height="160" fill="#FFF3DA"/>`},
  'organico-feito-a-mao': {classe: 't-or', svg: `<defs>${grain('or', 0.2, .7)}</defs>
<rect width="90" height="160" fill="#EBE1CE"/>
<rect width="90" height="160" filter="url(#gr-or)"/>
<g class="a up"><path d="M58 30 C74 26 84 44 78 58 C72 72 52 74 46 60 C40 46 44 34 58 30Z" fill="#C9774E"/></g>
<g class="a up up2"><path d="M18 74 C30 56 46 62 44 76 C42 88 30 98 20 94 C12 90 12 82 18 74Z" fill="#7C8C5B"/><path d="M22 92 Q30 80 40 70" stroke="#56633D" stroke-width=".8" fill="none"/></g>
<g class="a up up3"><text x="12" y="124" font-size="9.5" fill="#3E3428" font-weight="600">feito</text><text x="24" y="136" font-size="9.5" fill="#3E3428" font-weight="600">à mão</text>
<path d="M22 140 Q38 144 56 139" stroke="#C9774E" stroke-width="1.2" fill="none" stroke-linecap="round"/></g>`},
  'pop-colorido': {classe: 't-po', svg: `<rect width="90" height="160" fill="#FFF7EC"/>
<rect class="a bk" x="6" y="18" width="37" height="52" rx="4" fill="#FF4F8B"/>
<rect class="a bk bk2" x="47" y="18" width="37" height="52" rx="4" fill="#2D5BFF"/>
<rect class="a bk bk3" x="6" y="74" width="37" height="52" rx="4" fill="#FFCF3A"/>
<rect class="a bk bk4" x="47" y="74" width="37" height="52" rx="4" fill="#20C77A"/>
<circle cx="65" cy="44" r="9" fill="#FFF7EC" opacity=".9"/><circle cx="24" cy="100" r="8" fill="#FF4F8B"/>
<g class="a bk bk5"><rect x="14" y="132" width="62" height="16" rx="8" fill="#16161A"/><text x="45" y="143" font-size="8" font-weight="900" text-anchor="middle" fill="#FFF7EC" textLength="50" lengthAdjust="spacingAndGlyphs">NOVO SABOR</text></g>`},
  'nativo-de-rede': {classe: 't-na', svg: `<defs><linearGradient id="na-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5B6B78"/><stop offset="1" stop-color="#20272E"/></linearGradient></defs>
<rect width="90" height="160" fill="url(#na-g)"/>
<circle cx="45" cy="58" r="15" fill="#8C98A3"/><path d="M14 132 C14 98 30 84 45 84 C60 84 76 98 76 132 L76 160 L14 160Z" fill="#7A8692"/>
<rect x="6" y="6" width="25" height="1.6" rx=".8" fill="#FFFFFF" opacity=".9"/><rect x="33" y="6" width="25" height="1.6" rx=".8" fill="#FFFFFF" opacity=".35"/><rect class="a pr" x="33" y="6" width="25" height="1.6" rx=".8" fill="#FFFFFF"/><rect x="60" y="6" width="24" height="1.6" rx=".8" fill="#FFFFFF" opacity=".35"/>
<g fill="#FFFFFF" opacity=".85"><circle cx="81" cy="96" r="3.2"/><circle cx="81" cy="106" r="3.2"/><circle cx="81" cy="116" r="3.2"/></g>
<g class="a wd"><rect x="16" y="108" width="24" height="12" rx="2.5" fill="#FFFFFF"/><text x="28" y="117" font-size="7.5" font-weight="900" text-anchor="middle" fill="#111" textLength="17" lengthAdjust="spacingAndGlyphs">isso</text></g>
<g class="a wd wd2"><rect x="42" y="108" width="30" height="12" rx="2.5" fill="#FFE14D"/><text x="57" y="117" font-size="7.5" font-weight="900" text-anchor="middle" fill="#111" textLength="24" lengthAdjust="spacingAndGlyphs">mudou</text></g>
<g class="a wd wd3"><rect x="27" y="122" width="34" height="12" rx="2.5" fill="#FFFFFF"/><text x="44" y="131" font-size="7.5" font-weight="900" text-anchor="middle" fill="#111" textLength="18" lengthAdjust="spacingAndGlyphs">tudo</text></g>`},
};
