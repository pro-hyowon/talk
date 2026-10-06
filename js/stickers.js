// =====================================================================
//  미니톡 기본 이모티콘 — 앱 아이콘의 말풍선 캐릭터 "톡이"
//  모두 코드로 그린 그림(SVG)이라 따로 이미지 파일이 필요 없어요.
//  메시지에는 이모티콘 이름(id)만 저장됩니다. (예: m_hi)
//  움직임은 css/style.css 의 CSS 애니메이션 — 새로 온 이모티콘만 3번 움직이고 멈춰요 (누르면 다시).
// =====================================================================
const MINT = '#4FD1AE';
const MINT_D = '#2FB592';
const INK = '#0C3B30';
const BLUSH = '#FF9F8A';
const PINK = '#FF5C7A';
const SKY = '#6EC6FF';
const LEMON = '#FFD84D';

// 캐릭터 몸통 (앱 아이콘과 같은 말풍선 모양, 64×64 좌표)
const BODY = 'M32 9c14.4 0 25 9 25 20.5S46.4 50 32 50c-2.7 0-5.2-.3-7.6-.9L13 55l2.8-9.6C10.4 41.6 7 36 7 29.5 7 18 17.6 9 32 9z';

const st = (w = 2.4, c = INK) => `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const heart = (x, y, s, fill = PINK) =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M0 1.25C-1.9.05-1.75-1.45-.85-1.45-.35-1.45 0-1.05 0-.7 0-1.05.35-1.45.85-1.45 1.75-1.45 1.9.05 0 1.25z" fill="${fill}"/>`;
const drop = (x, y, s = 1, fill = SKY) =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M0-3.2C1.3-1.4 2.2-.2 2.2 1A2.2 2.2 0 0 1-2.2 1C-2.2-.2-1.3-1.4 0-3.2z" fill="${fill}"/>`;
const spark = (x, y, s = 1, fill = LEMON) =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M0-3.4C.4-1 1-.4 3.4 0 1-.4.4 1 0 3.4-.4 1-1 .4-3.4 0-1-.4-.4-1 0-3.4z" fill="${fill}"/>`;
const hand = (x, y, r = 4.6) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${MINT}" stroke="${MINT_D}" stroke-width="1.3"/>`;
const word = (x, y, t, size = 9, fill = INK, rot = 0) =>
  `<text x="${x}" y="${y}" font-size="${size}" font-weight="700" fill="${fill}" text-anchor="middle"${rot ? ` transform="rotate(${rot} ${x} ${y})"` : ''}>${t}</text>`;

// 눈
const E = {
  dot: `<circle cx="24.5" cy="28" r="3" fill="${INK}"/><circle cx="39.5" cy="28" r="3" fill="${INK}"/>`,
  happy: `<path d="M21.5 29.2q3-4.2 6 0M36.5 29.2q3-4.2 6 0" ${st(2.5)}/>`,
  closed: `<path d="M21.5 27.5q3 3.2 6 0M36.5 27.5q3 3.2 6 0" ${st(2.5)}/>`,
  laugh: `<path d="M22 24.8l4.6 3-4.6 3M42 24.8l-4.6 3 4.6 3" ${st(2.5)}/>`,
  wide: `<circle cx="24.5" cy="27.5" r="4.6" fill="#fff" stroke="${INK}" stroke-width="1.6"/><circle cx="39.5" cy="27.5" r="4.6" fill="#fff" stroke="${INK}" stroke-width="1.6"/><circle cx="24.5" cy="27.5" r="2" fill="${INK}"/><circle cx="39.5" cy="27.5" r="2" fill="${INK}"/>`,
  heart: heart(24.5, 28.3, 2.9) + heart(39.5, 28.3, 2.9),
  sparkle: `<circle cx="24.5" cy="27.5" r="4.4" fill="${INK}"/><circle cx="39.5" cy="27.5" r="4.4" fill="${INK}"/><circle cx="26" cy="25.8" r="1.6" fill="#fff"/><circle cx="41" cy="25.8" r="1.6" fill="#fff"/><circle cx="23.2" cy="29.3" r=".8" fill="#fff"/><circle cx="38.2" cy="29.3" r=".8" fill="#fff"/>`,
  wink: `<circle cx="24.5" cy="28" r="3" fill="${INK}"/><path d="M36.5 28.6q3-3.6 6 0" ${st(2.5)}/>`,
  up: `<circle cx="25.2" cy="26.4" r="3" fill="${INK}"/><circle cx="40.2" cy="26.4" r="3" fill="${INK}"/>`,
  cry: `<path d="M21.5 29q3-3.4 6 0M36.5 29q3-3.4 6 0" ${st(2.5)}/>`,
  shades: `<path d="M17.5 24.5h29" ${st(2.2)}/><rect x="18" y="23.5" width="12" height="8" rx="3.5" fill="${INK}"/><rect x="34" y="23.5" width="12" height="8" rx="3.5" fill="${INK}"/><path d="M20.5 25.8l3-.1M36.5 25.8l3-.1" ${st(1.3, '#fff')}/>`,
};
// 눈썹
const B = {
  sad: `<path d="M20.5 21.8l6.2-2.2M43.5 21.8l-6.2-2.2" ${st(2.2)}/>`,
  angry: `<path d="M20.5 19.8l7 3.4M43.5 19.8l-7 3.4" ${st(2.4)}/>`,
  firm: `<path d="M20.5 21l6.6 1.6M43.5 21l-6.6 1.6" ${st(2.3)}/>`,
  raise: `<path d="M21 21.6q3.5-1.4 7 0M36.2 19.2q3.6-2.4 7.2-.6" ${st(2.2)}/>`,
  flat: `<path d="M21 21.5h7M36 21.5h7" ${st(2.2)}/>`,
};
// 입
const M = {
  smile: `<path d="M28.5 34.5q3.5 3 7 0" ${st()}/>`,
  grin: `<path d="M27.2 33.4h9.6q0 6.4-4.8 6.4t-4.8-6.4z" fill="${INK}"/><path d="M29.6 38.6q2.4-1.8 4.8 0q-2.4 1.6-4.8 0z" fill="${PINK}"/>`,
  big: `<path d="M26 33h12q0 8.6-6 8.6T26 33z" fill="${INK}"/><path d="M28.6 39.6q3.4-2.6 6.8 0q-3.4 2.4-6.8 0z" fill="${PINK}"/>`,
  frown: `<path d="M28.5 37.4q3.5-3 7 0" ${st()}/>`,
  o: `<ellipse cx="32" cy="36.4" rx="2.8" ry="3.4" fill="${INK}"/>`,
  oBig: `<ellipse cx="32" cy="37" rx="4.4" ry="4.8" fill="${INK}"/><ellipse cx="32" cy="39" rx="2.6" ry="1.6" fill="${PINK}"/>`,
  flat: `<path d="M29 36h6" ${st()}/>`,
  wavy: `<path d="M27.4 36.4q1.5-1.8 3 0t3 0 3 0" ${st(2.2)}/>`,
  cat: `<path d="M27.6 34.4q2.2 2.8 4.4 0 2.2 2.8 4.4 0" ${st(2.2)}/>`,
  tongue: `<path d="M28 34.2q4 3.4 8 0" ${st()}/><path d="M32.6 35.7h3.4v2.4a1.7 1.7 0 0 1-3.4 0z" fill="${PINK}"/>`,
  smirk: `<path d="M28.6 35.6q3.6 1.8 7.2-1.4" ${st()}/>`,
  pout: `<path d="M29.4 37q2.6-2.2 5.2 0" ${st(2.4)}/>`,
};
const cheeks = (fill = BLUSH, rx = 3.6, ry = 2.2) => `<ellipse cx="19" cy="35" rx="${rx}" ry="${ry}" fill="${fill}"/><ellipse cx="45" cy="35" rx="${rx}" ry="${ry}" fill="${fill}"/>`;

// 움직임 붙이기: x(움직임, 그림, { on: 몸에 붙음, o: 회전 중심, d: 시작 지연(초) })
//   몸 움직임(body)·소품 움직임 이름은 css/style.css 의 '움직이는 이모티콘' 부분과 짝을 이룸
const x = (anim, svg, opt = {}) => ({ anim, svg, ...opt });
const lines = (d) => `<path d="${d}" ${st(1.8, MINT_D)}/>`;

// 이모티콘 목록: [이름, 글자, 그림]
const LIST = [
  ['m_hi', '안녕!', { body: 'sway', eyes: E.dot, blink: 1, mouth: M.grin, items: [x('wave', hand(59, 15) + lines('M64 6.5q3 3 2.4 7M67.5 4.5q4 4.5 3 10'), { on: 1, o: '0% 100%' })] }],
  ['m_thanks', '고마워', { body: 'bow', eyes: E.happy, mouth: M.smile, items: [x('float', heart(55, 12, 3.2)), x('float', heart(62.5, 22, 2.2), { d: .3 }), x('float', heart(8, 14, 2), { d: .6 })] }],
  ['m_love', '사랑해', { body: 'pulse', eyes: E.heart, eyesAnim: 'beat', mouth: M.grin, items: [x('float', heart(57, 10, 4.6))] }],
  ['m_ok', '좋아!', { body: 'jump', eyes: E.happy, mouth: M.big, items: [
    x('wave', hand(6.5, 17, 4.8) + lines('M1.5 9.5l-2-2.6M4.5 7.5l-.6-3.2'), { on: 1, o: '100% 100%' }),
    x('wave', hand(57.5, 17, 4.8) + lines('M62.5 9.5l2-2.6M59.5 7.5l.6-3.2'), { on: 1, o: '0% 100%', d: .15 }),
    x('twinkle', spark(32, 2.5, 1.2))] }],
  ['m_lol', 'ㅋㅋㅋ', { body: 'giggle', eyes: E.laugh, mouth: M.big, items: [x('drip', drop(14.5, 28, 1.1), { on: 1 }), x('drip', drop(49.5, 28, 1.1), { on: 1, d: .2 })] }],
  ['m_shy', '부끄', { body: 'shy', eyes: E.happy, mouth: M.wavy, cheeks: cheeks('#FF7F7F', 5, 3) + `<path d="M15 34.5l2.4-1.8M19 35l2.4-1.8M43 34.5l2.4-1.8M47 35l2.4-1.8" ${st(1.1, '#fff')}/>`, items: [x('float', heart(56, 12, 2.2, '#FFB3C1'))] }],
  ['m_yes', '응응', { body: 'nod', eyes: E.happy, mouth: M.smile, items: [x('pop', `<circle cx="56" cy="12" r="7.5" fill="${MINT_D}"/><path d="M52.4 12.2l2.6 2.6 4.8-5" ${st(2.2, '#fff')}/>`)] }],
  ['m_no', '아니야', { body: 'shake', brows: B.flat, eyes: E.dot, mouth: M.frown, items: [x('pop', `<circle cx="56" cy="12" r="7.5" fill="${PINK}"/><path d="M53 9l6 6M59 9l-6 6" ${st(2.2, '#fff')}/>`)] }],
  ['m_wow', '헉!', { body: 'jolt', eyes: E.wide, mouth: M.oBig, items: [x('pop', word(57, 15, '!', 15, PINK, 12)), x('pop', word(63, 18, '!', 10, PINK, 18), { d: .15 })] }],
  ['m_what', '응?', { body: 'tilt', brows: B.raise, eyes: E.dot, blink: 1, mouth: M.o, items: [x('bob', word(57, 16, '?', 15, MINT_D, 10))] }],
  ['m_think', '음…', { body: 'sway', eyes: E.up, blink: 1, mouth: M.flat, items: [x('bob', word(56, 13, '?', 11, MINT_D, -8)), x('bob', word(62, 7, '?', 7, MINT_D, 10), { d: .4 })] }],
  ['m_sad', '슬퍼', { body: 'droop', brows: B.sad, eyes: E.dot, blink: 1, mouth: M.frown, items: [x('drip', drop(22.5, 35, .95), { on: 1 })] }],
  ['m_cry', '엉엉', { body: 'sob', brows: B.sad, eyes: E.cry, mouth: M.oBig, cheeks: '', items: [x('stream', `<path d="M21.6 31v13.5M27.4 31v12.5M36.6 31v12.5M42.4 31v13.5" ${st(3.4, SKY)} opacity=".9"/>`, { on: 1, o: '50% 0%' })] }],
  ['m_angry', '흥!', { body: 'shake', brows: B.angry, eyes: E.dot, mouth: M.pout, cheeks: cheeks('#FF7A6B', 4.2, 2.6), items: [x('throb', `<g transform="translate(55 12)" ${st(2.1, '#FF4D4D')}><path d="M-5-1.5q2.5.2 3.5-1M-1.5-5q.2 2.5-1 3.5M5 1.5q-2.5-.2-3.5 1M1.5 5q-.2-2.5 1-3.5"/></g>`)] }],
  ['m_sorry', '미안해', { body: 'bow', brows: B.sad, eyes: E.closed, mouth: M.wavy, items: [x('drip', drop(52, 15, 1.3), { on: 1 })] }],
  ['m_please', '부탁해', { body: 'pulse', eyes: E.sparkle, mouth: M.cat, items: [x('twinkle', spark(8, 12, 1.1)), x('twinkle', spark(58, 8, 1.3), { d: .3 }), x('twinkle', spark(63, 18, .8), { d: .6 })] }],
  ['m_cheer', '화이팅!', { body: 'jump', brows: B.firm, eyes: E.dot, mouth: M.grin, items: [
    x('', `<path d="M9.6 20.6Q32 11.2 54.4 20.6" ${st(4.6, '#FF6B6B')}/>`, { on: 1 }),
    x('flutter', `<path d="M9.8 21l-6.2 3.6M10 21.4l-4.4 6" ${st(2.8, '#FF6B6B')}/>`, { on: 1, o: '100% 0%' }),
    x('punch', hand(59.5, 30, 5), { on: 1 }), x('twinkle', spark(62, 12, 1.2))] }],
  ['m_party', '축하해', { body: 'jump', eyes: E.happy, mouth: M.big, items: [
    x('hat', `<path d="M27 11.5l8.5-10.5 6.5 12.5z" fill="${LEMON}"/><path d="M30.3 7.4l7.6 3.4M33 4.2l3.2 1.6" ${st(1.8, PINK)}/><circle cx="35.5" cy="1" r="2.3" fill="${PINK}"/>`, { on: 1, o: '30% 100%' }),
    x('fall', `<rect x="6" y="11" width="3" height="3" rx=".6" fill="${PINK}" transform="rotate(20 7.5 12.5)"/>`),
    x('fall', `<rect x="56" y="6" width="3" height="3" rx=".6" fill="${SKY}" transform="rotate(-25 57.5 7.5)"/>`, { d: .25 }),
    x('fall', `<rect x="61" y="18" width="3" height="3" rx=".6" fill="${LEMON}"/>`, { d: .5 }),
    x('fall', `<circle cx="12" cy="4.5" r="1.6" fill="${SKY}"/>`, { d: .4 }),
    x('fall', `<circle cx="52" cy="2" r="1.4" fill="${MINT_D}"/>`, { d: .1 })] }],
  ['m_hungry', '배고파', { body: 'wiggle', eyes: E.up, blink: 1, mouth: M.tongue, items: [
    x('drip', drop(29, 41.5, .9), { on: 1 }),
    x('wiggle', `<g transform="translate(56 10) rotate(18)" ${st(1.8, '#8A96A3')}><path d="M-2.4-7v4.5a2.4 2.4 0 0 0 4.8 0V-7M0-7v12"/></g>`, { o: '50% 100%' })] }],
  ['m_sleep', '잘자', { body: 'breathe', eyes: E.closed, mouth: M.o, items: [
    x('zz', word(52, 16, 'Z', 11, MINT_D, -10)), x('zz', word(59.5, 9, 'z', 8, MINT_D, -10), { d: .6 }),
    x('bob', `<path d="M8 6.5a4.6 4.6 0 1 0 5.6 5.6 3.6 3.6 0 0 1-5.6-5.6z" fill="${LEMON}"/>`)] }],
  ['m_cool', '굿굿', { body: 'groove', eyes: E.shades, mouth: M.smirk, items: [x('twinkle', spark(57, 9, 1.3)), x('twinkle', spark(62, 19, .8), { d: .4 })] }],
  ['m_wait', '잠깐만!', { body: 'jolt', brows: B.sad, eyes: E.dot, mouth: M.o, items: [
    x('stop', `<g transform="translate(59 22)"><rect x="-4.6" y="-5" width="9.2" height="10" rx="4" fill="${MINT}" stroke="${MINT_D}" stroke-width="1.3"/><path d="M-2-5v-3M.4-5.4v-3.4M2.8-5v-2.8" ${st(2.2, MINT_D)}/></g>`, { on: 1, o: '0% 50%' }),
    x('drip', drop(14, 18, 1), { on: 1 })] }],
  ['m_bye', '이따 봐', { body: 'sway', eyes: E.wink, mouth: M.smile, items: [x('wave', hand(5, 17) + lines('M0 8.5q-3 3-2.4 7'), { on: 1, o: '100% 100%' }), x('float', heart(58, 12, 2.4))] }],
  ['m_heart', '뿅', { body: 'bounce', eyes: E.happy, mouth: M.cat, items: [
    x('beat', heart(32, 46, 9.5) + `<ellipse cx="27" cy="42" rx="2" ry="1.3" fill="#fff" opacity=".6" transform="rotate(-30 27 42)"/>`, { on: 1 }),
    x('', hand(19.5, 46, 4) + hand(44.5, 46, 4), { on: 1 })] }],
];

// 글자 폭 대략 계산 (한글 13, 그 외 7)
const textW = (t) => [...t].reduce((w, c) => w + (/[가-힣ㄱ-ㅎ…]/.test(c) ? 13 : c === ' ' ? 4 : 7), 0);

function layer(it) {
  if (!it.anim) return it.svg;
  const style = `${it.o ? `transform-origin:${it.o};` : ''}${it.d ? `animation-delay:${it.d}s;` : ''}`;
  return `<g class="ax ax-${it.anim}"${style ? ` style="${style}"` : ''}>${it.svg}</g>`;
}

function draw(id, label, o) {
  const w = textW(label) + 22;
  const items = o.items || [];
  const eyes = `<g class="ae${o.eyesAnim ? ` ax-${o.eyesAnim}` : o.blink ? ' ae-blink' : ''}">${o.eyes}</g>`;
  const face = `${o.cheeks ?? cheeks()}${o.brows || ''}${eyes}${o.mouth}`;
  const onBody = items.filter((it) => it.on).map(layer).join('');
  const free = items.filter((it) => !it.on).map(layer).join('');
  return `<g transform="translate(15 3) scale(1.4)"><g class="ab ab-${o.body || 'bounce'}"><path d="${BODY}" fill="${MINT}"/>${face}${onBody}</g>${free}</g>`
    + `<g class="st-cap"><rect x="${60 - w / 2}" y="89" width="${w}" height="24" rx="12" fill="#fff" stroke="${MINT}" stroke-width="2"/>`
    + `<text x="60" y="105.6" font-size="13" font-weight="700" fill="${INK}" text-anchor="middle">${label}</text></g>`;
}

export const STICKERS = LIST.map(([id, label, o]) => ({ id, label, inner: draw(id, label, o) }));
const BY_ID = new Map(STICKERS.map((s) => [s.id, s]));

export const stickerLabel = (id) => (BY_ID.get(id) || { label: '이모티콘' }).label;

// 이모티콘 그림 (모르는 이름이면 물음표 말풍선)
export function stickerSvg(id, size = 120) {
  const s = BY_ID.get(id);
  const inner = s ? s.inner
    : `<g transform="translate(15 3) scale(1.4)"><path d="${BODY}" fill="#E3E8EC"/>${word(32, 35, '?', 18, '#A3ABB6')}</g>`;
  return `<svg class="sticker-svg" width="${size}" height="${size}" viewBox="0 0 120 120" role="img" aria-label="${s ? s.label : '이모티콘'}" font-family="GmarketSans, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif">${inner}</svg>`;
}
