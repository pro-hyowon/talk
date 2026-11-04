// =====================================================================
//  끼리톡 기본 이모티콘 — 앱 아이콘의 말풍선 캐릭터 "톡이"
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

// =====================================================================
//  v1.38: 톡이 이모티콘 꾸러미 — 친구·연인·가족·직장 (각 30개)
// =====================================================================
const BROWN = '#A9744F'; const CREAM = '#FFF1D2'; const GRAY = '#8A96A3'; const BLUE = '#4C7BF4'; const ORANGE = '#FF9F43';
const RED = '#FF5A5A'; const GREEN = '#43B86B'; const PURPLE = '#9B7BF7';
const PINK_BODY = '#FF9FB8'; const SKY_BODY = '#8FD3FF'; const LEMON_BODY = '#FFD36E';
const at = (x0, y0, s, svg, rot = 0) => `<g transform="translate(${x0} ${y0})${rot ? ` rotate(${rot})` : ''} scale(${s})">${svg}</g>`;
// 소품 — 모두 (0,0) 가운데, 약 12칸 크기
const P = {
  coffee: `<ellipse cx="0" cy="-3" rx="4.5" ry="1.1" fill="${BROWN}"/><path d="M-4.5-3h9l-1.2 7.6q-.3 1.4-1.8 1.4h-3q-1.5 0-1.8-1.4z" fill="#fff" stroke="${BROWN}" stroke-width="1.3"/><path d="M4.3-1.4h1.1a1.9 1.9 0 0 1 0 3.8H3.8" ${st(1.3, BROWN)}/><path d="M-1.6-5.6q1.1-1.3 0-2.6M1.6-5.6q1.1-1.3 0-2.6" ${st(1.1, GRAY)}/>`,
  phone: `<rect x="-3.8" y="-6.2" width="7.6" height="12.4" rx="1.9" fill="${INK}"/><rect x="-2.8" y="-4.8" width="5.6" height="8.2" rx=".8" fill="${SKY}"/><circle cx="0" cy="4.7" r=".6" fill="#fff"/>`,
  laptop: `<rect x="-6" y="-5.5" width="12" height="8" rx="1" fill="${INK}"/><rect x="-5" y="-4.5" width="10" height="6" rx=".4" fill="${SKY}"/><path d="M-7.6 2.6h15.2l-1.1 1.8H-6.5z" fill="${GRAY}"/>`,
  doc: `<rect x="-4.6" y="-6" width="9.2" height="12" rx="1.2" fill="#fff" stroke="${GRAY}" stroke-width="1.2"/><path d="M-2.4-3h4.8M-2.4-.4h4.8M-2.4 2.2h3" ${st(1.1, GRAY)}/>`,
  clock: `<circle r="5.8" fill="#fff" stroke="${INK}" stroke-width="1.5"/><path d="M0-3.4V0l2.4 1.7" ${st(1.4)}/>`,
  case: `<path d="M-2.2-3.4v-1.6h4.4v1.6" ${st(1.4, '#7A5236')}/><rect x="-6.2" y="-3.6" width="12.4" height="8.8" rx="1.7" fill="${BROWN}"/><path d="M-6.2 .2h12.4" ${st(1, '#7A5236')}/><rect x="-1.2" y="-.6" width="2.4" height="1.8" rx=".4" fill="${LEMON}"/>`,
  chicken: `<path d="M-2.2 2.6l-3.2 3.4" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="-6" cy="5" r="1.5" fill="#fff"/><circle cx="-4.4" cy="6.8" r="1.5" fill="#fff"/><ellipse cx="1.4" cy="-1.8" rx="4.4" ry="5.6" transform="rotate(42 1.4 -1.8)" fill="${ORANGE}"/><path d="M1.4-5.4q2.6.6 3.2 3" ${st(1.1, '#FFC98A')}/>`,
  rice: `<ellipse cx="0" cy="-1.4" rx="5.4" ry="3" fill="#fff"/><path d="M-6.2-1h12.4a6.2 6 0 0 1-12.4 0z" fill="${SKY}"/><path d="M-3.6 2.4h7.2" ${st(1, '#fff')} opacity=".7"/><path d="M1.6-7.6l5.6-3.2M3-6.6l5.6-3.2" ${st(1.1, BROWN)}/>`,
  cake: `<rect x="-6" y="-1.6" width="12" height="7.2" rx="1.6" fill="${CREAM}"/><path d="M-6 .6q1.5 1.8 3 0t3 0 3 0 3 0" ${st(1.5, PINK)}/><rect x="-.6" y="-6.4" width="1.2" height="4.8" rx=".5" fill="${SKY}"/><path d="M0-9.6q1.4 1.5 0 2.8-1.4-1.3 0-2.8z" fill="${ORANGE}"/>`,
  gift: `<rect x="-5.6" y="-1.8" width="11.2" height="8" rx="1" fill="${PINK}"/><rect x="-6.4" y="-4.4" width="12.8" height="3" rx=".8" fill="#FF7F98"/><path d="M0-4.4v10.4" ${st(1.8, LEMON)}/><path d="M0-4.4q-4.4-4.2-5-1.2T0-4.4q4.4-4.2 5-1.2T0-4.4z" ${st(1.4, LEMON)}/>`,
  flower: `${[0, 72, 144, 216, 288].map((a) => `<circle cx="${(3 * Math.cos((a - 90) * Math.PI / 180)).toFixed(2)}" cy="${(3 * Math.sin((a - 90) * Math.PI / 180) - 2.4).toFixed(2)}" r="2.5" fill="#FF8FAB"/>`).join('')}<circle cy="-2.4" r="1.8" fill="${LEMON}"/><path d="M0 .8v6.4" ${st(1.4, GREEN)}/><path d="M0 4.6q2.4-2.2 4.2-1.2" ${st(1.3, GREEN)}/>`,
  letter: `<rect x="-6.2" y="-4.2" width="12.4" height="8.8" rx="1.2" fill="#fff" stroke="${PINK}" stroke-width="1.2"/><path d="M-6-3.6l6 4.4 6-4.4" ${st(1.2, PINK)}/>${heart(0, 2.2, 1.5)}`,
  coin: `<circle r="3.6" fill="${LEMON}" stroke="#E6B800" stroke-width="1"/><path d="M-1.9-1.4l.9 3 1-2.2 1 2.2.9-3M-2.2-.2h4.4" ${st(.8, '#B88A00')}/>`,
  pin: `<path d="M0 6.4c-3.6-4.1-5.2-6.5-5.2-8.8a5.2 5.2 0 0 1 10.4 0c0 2.3-1.6 4.7-5.2 8.8z" fill="${PINK}"/><circle cy="-2.6" r="2" fill="#fff"/>`,
  house: `<path d="M-4.8-1.2v7h9.6v-7" fill="${CREAM}"/><path d="M-6.8-.4L0-6.8l6.8 6.4z" fill="#FF8A7A"/><rect x="-1.4" y="2" width="2.8" height="3.8" rx=".5" fill="${BROWN}"/><rect x="2" y="-.2" width="1.8" height="1.8" fill="${SKY}"/>`,
  pill: `<g transform="rotate(-35)"><rect x="-6" y="-2.4" width="12" height="4.8" rx="2.4" fill="#fff" stroke="${GRAY}" stroke-width=".9"/><path d="M0-2.4h3.6a2.4 2.4 0 0 1 0 4.8H0z" fill="${PINK}"/></g>`,
  bulb: `<path d="M0-7.2a5.2 5.2 0 0 1 3.1 9.4v1.8H-3.1V2.2A5.2 5.2 0 0 1 0-7.2z" fill="${LEMON}"/><rect x="-2.7" y="4.4" width="5.4" height="2.3" rx=".8" fill="${GRAY}"/><path d="M-1 1.8V-.6h2v2.4" ${st(.9, '#C99A00')}/><path d="M-8-5l-1.6-1.2M8-5l1.6-1.2M0-9.4v-1.8" ${st(1.2, LEMON)}/>`,
  mug: `<path d="M3.6-1.6h1.6a1.9 1.9 0 0 1 1.9 1.9v1.4a1.9 1.9 0 0 1-1.9 1.9H3.6" ${st(1.4, '#E6B800')}/><rect x="-4.6" y="-4" width="8.2" height="10.2" rx="1.4" fill="${LEMON}"/><path d="M-5.2-4.2a1.9 1.9 0 0 1 2-1.9 2.5 2.5 0 0 1 4.4 0 1.9 1.9 0 0 1 2.5 1.9z" fill="#fff"/>`,
  popcorn: `<circle cx="-2.8" cy="-2.2" r="2.1" fill="${CREAM}"/><circle cx="0" cy="-3.4" r="2.2" fill="${CREAM}"/><circle cx="2.8" cy="-2.2" r="2.1" fill="${CREAM}"/><path d="M-4.8-1l1.1 7.6h7.4l1.1-7.6z" fill="#fff"/><path d="M-3.1-1l.6 7.6M0-1v7.6M3.1-1l-.6 7.6" ${st(1.3, RED)}/>`,
  pad: `<rect x="-6.6" y="-3.6" width="13.2" height="7.6" rx="3.8" fill="${PURPLE}"/><path d="M-4.2-.2h3M-2.7-1.7v3" ${st(1.2, '#fff')}/><circle cx="2.6" cy="-1" r=".95" fill="#fff"/><circle cx="4.5" cy=".8" r=".95" fill="#fff"/>`,
  sun: `<circle r="3.4" fill="${LEMON}"/>${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => { const c = Math.cos(a * Math.PI / 180); const sn = Math.sin(a * Math.PI / 180); return `<path d="M${(c * 5).toFixed(2)} ${(sn * 5).toFixed(2)}L${(c * 6.8).toFixed(2)} ${(sn * 6.8).toFixed(2)}" ${st(1.4, LEMON)}/>`; }).join('')}`,
  moon: `<path d="M-2-4.6a4.6 4.6 0 1 0 5.6 5.6 3.6 3.6 0 0 1-5.6-5.6z" fill="${LEMON}"/>`,
  cal: `<rect x="-5.6" y="-4.6" width="11.2" height="10.2" rx="1.4" fill="#fff" stroke="${GRAY}" stroke-width="1.1"/><path d="M-5.6-3.2a1.4 1.4 0 0 1 1.4-1.4h8.4a1.4 1.4 0 0 1 1.4 1.4v1.6H-5.6z" fill="${PINK}"/><path d="M-2.6-6.2v2.8M2.6-6.2v2.8" ${st(1.2)}/>`,
  bag: `<path d="M-2.4-2v-1.4a2.4 2.4 0 0 1 4.8 0V-2" ${st(1.3, '#C46A12')}/><path d="M-1.6-2.4q-.6-3.4 1.2-4.4M1.6-2.4q.4-2.8 2.4-3.4" ${st(1.4, GREEN)}/><path d="M-5.2-2h10.4l-.9 8.2H-4.3z" fill="${ORANGE}"/>`,
  thumbs: `<path d="M-3.6-.2h-2.2v6.2h2.2z" fill="${MINT_D}"/><path d="M-3.6-.2l2.4-4.6q.9-1.6 2.1-.6t-.2 2.7l-.6 1.6h3.5a1.5 1.5 0 0 1 1.4 1.9L3.6 5.5A1.6 1.6 0 0 1 2.1 6.8h-5.7z" fill="${MINT}" stroke="${MINT_D}" stroke-width="1.1" stroke-linejoin="round"/>`,
  ok: `<circle r="7.5" fill="${MINT_D}"/>${word(0, 2.6, 'OK', 7.4, '#fff')}`,
  check: `<circle r="7.5" fill="${MINT_D}"/><path d="M-3.6.2l2.6 2.6 4.8-5" ${st(2.2, '#fff')}/>`,
  nope: `<circle r="7.5" fill="${PINK}"/><path d="M-3-3l6 6M3-3l-6 6" ${st(2.2, '#fff')}/>`,
  star: `<path d="M0-6l1.8 3.8 4.1.5-3 2.9.8 4.1L0 3.3l-3.7 2 .8-4.1-3-2.9 4.1-.5z" fill="${LEMON}" stroke="#E6B800" stroke-width=".8" stroke-linejoin="round"/>`,
  note: `<path d="M-1.5 3.6V-5.4l6-1.6v8.4" ${st(1.4, PURPLE)}/><ellipse cx="-3" cy="3.8" rx="2.2" ry="1.6" fill="${PURPLE}"/><ellipse cx="3" cy="2" rx="2.2" ry="1.6" fill="${PURPLE}"/>`,
  medal: `<path d="M-3.4-7.4l2.2 5h2.4l2.2-5" fill="${BLUE}"/><circle cy="1.6" r="4.4" fill="${LEMON}" stroke="#E6B800" stroke-width="1"/>${word(0, 3.9, '1', 6, '#B88A00')}`,
  plane: `<path d="M-6.6.6l13-5.2-3.4 8.4-3-2.4-1.6 2.6-.4-3.4z" fill="#fff" stroke="${SKY}" stroke-width="1.2" stroke-linejoin="round"/>`,
};
// 소품 붙이기 (위치·크기·기울기)
const prop = (name, x0, y0, s = 1, rot = 0) => at(x0, y0, s, P[name], rot);
// 머리에 붙는 것 (말풍선 머리 64칸 좌표): 머리띠·고깔모자·수면 모자·땀·눈물
const BAND = `<path d="M9.6 20.6Q32 11.2 54.4 20.6" ${st(4.6, '#FF6B6B')}/><path d="M9.8 21l-6.2 3.6M10 21.4l-4.4 6" ${st(2.8, '#FF6B6B')}/>`;
const PARTY_HAT = `<path d="M27 11.5l8.5-10.5 6.5 12.5z" fill="${LEMON}"/><path d="M30.3 7.4l7.6 3.4M33 4.2l3.2 1.6" ${st(1.8, PINK)}/><circle cx="35.5" cy="1" r="2.3" fill="${PINK}"/>`;
const NIGHT_CAP = `<path d="M13 17.5Q28-1 49 13.5q-12-3.4-21 1.6T13 17.5z" fill="#9B7BF7"/><path d="M12.4 17.6q18-8.6 37.2-4.2" ${st(3.2, '#fff')}/><circle cx="50.5" cy="13" r="2.6" fill="#fff"/>`;
const ANGRY = (c = '#FF4D4D') => `<g transform="translate(51 13)" ${st(2.1, c)}><path d="M-5-1.5q2.5.2 3.5-1M-1.5-5q.2 2.5-1 3.5M5 1.5q-2.5-.2-3.5 1M1.5 5q-.2-2.5 1-3.5"/></g>`;
const KISS = `<path d="M29.4 35.4q2.6-2.4 5.2 0q-2.6 2.6-5.2 0z" fill="${PINK}"/>`;
const sweat = () => x('drip', drop(52, 15, 1.3));
const sweatL = () => x('drip', drop(13, 19, 1.1));
const tear = () => x('drip', drop(22.5, 35, .95));
const joy = () => [x('drip', drop(14.5, 28, 1.1)), x('drip', drop(49.5, 28, 1.1), { d: .2 })];
const drool = () => x('drip', drop(29, 41.5, .9));
const stream = () => x('stream', `<path d="M21.6 31v13.5M42.4 31v13.5" ${st(3.4, SKY)} opacity=".9"/>`, { o: '50% 0%' });
// 작은 톡이 머리 (아기 안기 등): mini(x, y, 크기, 몸 색, 눈, 입)
const mini = (x0, y0, s, fill, eyes = E.happy, mouth = M.smile) =>
  `<g transform="translate(${x0} ${y0}) scale(${s}) translate(-32 -31)"><path d="${BODY}" fill="${fill}"/>${cheeks()}${eyes}${mouth}</g>`;
const dots = (x0, y0, c = MINT_D) => `<circle cx="${x0 - 4}" cy="${y0}" r="1.8" fill="${c}"/><circle cx="${x0}" cy="${y0}" r="1.8" fill="${c}"/><circle cx="${x0 + 4}" cy="${y0}" r="1.8" fill="${c}"/>`;
// 그림 둘레 장식 (120칸 좌표)
const sparks = () => [x('twinkle', spark(100, 14, 1.6)), x('twinkle', spark(106, 34, 1), { d: .35 }), x('twinkle', spark(18, 20, 1.2), { d: .6 })];
const hearts = (c = PINK) => [x('float', heart(100, 16, 4, c)), x('float', heart(106, 36, 2.6, c), { d: .3 }), x('float', heart(18, 20, 3, c), { d: .6 })];
const confetti = () => [
  x('fall', `<rect x="14" y="14" width="4" height="4" rx=".8" fill="${PINK}" transform="rotate(20 16 16)"/>`),
  x('fall', `<rect x="100" y="8" width="4" height="4" rx=".8" fill="${SKY}" transform="rotate(-25 102 10)"/>`, { d: .25 }),
  x('fall', `<rect x="106" y="30" width="4" height="4" rx=".8" fill="${LEMON}"/>`, { d: .5 }),
  x('fall', `<circle cx="22" cy="6" r="2" fill="${SKY}"/>`, { d: .4 }),
  x('fall', `<circle cx="92" cy="4" r="1.8" fill="${MINT_D}"/>`, { d: .1 })];
const speed = () => x('flutter', lines('M30 46h-9M28 54h-12M30 62h-8'), { o: '100% 50%' });
const ask = (c = MINT_D) => x('bob', word(101, 22, '?', 20, c, 10));
const bang = (t = '!', c = PINK) => x('pop', word(101, 24, t, 19, c, 12));
const float = (name, s = 1.3, x0 = 100, y0 = 18, rot = 0) => x('bob', prop(name, x0, y0, s, rot));
const popR = (name, s = 1.2, x0 = 100, y0 = 18) => x('pop', prop(name, x0, y0, s));

// =====================================================================
//  v1.38: 사람처럼 움직이는 톡이 — 말풍선 머리 + 목 + 몸통·팔(어깨·팔꿈치)·다리, 관절마다 따로 움직임
//  관절 각도: 0 = 아래로 내린 상태, + = 바깥쪽으로 들어 올림 (오른쪽 팔·다리는 좌우를 뒤집어 같은 뜻)
//  [처음, 끝] 두 각도를 주면 그 사이를 오가며 움직임 (css/style.css 의 .jt — 같은 시간·속도로 움직여 손에 든 소품은 늘 똑바로)
// =====================================================================
const SKIN = MINT; const SKIN_D = MINT_D; const SHOE = INK; const PANTS = '#3D5A80'; const SUIT = '#2C3E66'; const SHIRT_W = '#EAF2FF';
const pair = (v) => (Array.isArray(v) ? v : [v || 0, v || 0]);
const jt = (v, svg, o) => {
  const [a, b] = pair(v);
  return `<g class="jt" style="--a:${a}deg;--b:${b}deg;--d:${o.d || .5}s${o.dl ? `;--dl:${o.dl}s` : ''}">${svg}</g>`;
};
const negSum = (p, q) => { const A = pair(p); const Bq = pair(q); return [-(A[0] + Bq[0]), -(A[1] + Bq[1])]; };
// 팔: 어깨(x0,y0)에서 윗팔 9 → 팔꿈치 → 아랫팔 8.4 → 손. hold = 손에 든 소품(늘 똑바로 서 있게 반대로 돌림)
const UPPER = 9; const FORE = 8.4;
function arm(x0, y0, mirror, sh, el, hold, sleeve, o) {
  const keep = hold ? jt(negSum(sh, el), mirror ? `<g transform="scale(-1 1)">${hold}</g>` : hold, o) : '';
  const fore = `<path d="M0 0v7.6" stroke="${SKIN}" stroke-width="4.4" stroke-linecap="round"/><g transform="translate(0 ${FORE})">${keep}</g><circle cx="0" cy="${FORE}" r="3.4" fill="${SKIN}" stroke="${SKIN_D}" stroke-width="1.1"/>`;
  const upper = `<path d="M0 0v${UPPER}" stroke="${sleeve}" stroke-width="5.8" stroke-linecap="round"/><g transform="translate(0 ${UPPER})">${jt(el, fore, o)}</g>`;
  return `<g transform="translate(${x0} ${y0})${mirror ? ' scale(-1 1)' : ''}">${jt(sh, upper, o)}</g>`;
}
function leg(x0, y0, mirror, a, pants, o) {
  return `<g transform="translate(${x0} ${y0})${mirror ? ' scale(-1 1)' : ''}">${jt(a, `<path d="M0 0v10.4" stroke="${pants}" stroke-width="5.8" stroke-linecap="round"/><ellipse cx="-1.9" cy="12.2" rx="4.3" ry="2.6" fill="${SHOE}"/>`, o)}</g>`;
}
// 손을 어디에 둘지 정하면 어깨·팔꿈치 각도를 계산 (팔꿈치는 바깥쪽으로)
const SHOULDER = { L: [49.8, 47], R: [70.2, 47] };
function solve(left, [tx, ty], inside) {
  const [sx, sy] = left ? SHOULDER.L : SHOULDER.R;
  const dx = left ? tx - sx : sx - tx; const dy = ty - sy;
  const D = Math.hypot(dx, dy) || 1; const Dc = Math.min(Math.max(D, 1), UPPER + FORE - .05);
  const k = Dc / D; const px = dx * k; const py = dy * k;
  const th = Math.atan2(-px, py);
  const al = Math.acos(Math.min(1, Math.max(-1, (UPPER * UPPER + Dc * Dc - FORE * FORE) / (2 * UPPER * Dc))));
  const opts = [th + al, th - al].map((sh) => {
    const ex = -UPPER * Math.sin(sh); const ey = UPPER * Math.cos(sh);
    return { sh, el: Math.atan2(-(px - ex), py - ey) - sh, ex };
  });
  const out = opts[0].ex <= opts[1].ex ? 0 : 1;
  const c = opts[inside ? 1 - out : out];
  let sh = c.sh * 180 / Math.PI; while (sh < -90) sh += 360; while (sh >= 270) sh -= 360;
  let el = c.el * 180 / Math.PI; while (el <= -180) el += 360; while (el > 180) el -= 360;
  return [Math.round(sh), Math.round(el)];
}
const mir = (p) => p && [120 - p[0], p[1]];
const Rh = (p, q, inside) => { const a = solve(false, p, inside); const b = q ? solve(false, q, inside) : a; return { ra: [a[0], b[0]], re: [a[1], b[1]] }; };
const Lh = (p, q, inside) => { const a = solve(true, p, inside); const b = q ? solve(true, q, inside) : a; return { la: [a[0], b[0]], le: [a[1], b[1]] }; };
const Bh = (p, q, inside) => ({ ...Rh(p, q, inside), ...Lh(mir(p), mir(q), inside) });   // p = 오른손 자리 (왼손은 좌우 대칭)
// 손 자리 (오른손 기준, 왼손은 mir)
const T = { hip: [73.5, 57], side: [84.5, 50], show: [84.5, 40], high: [77, 31.5], cheek: [74.5, 34.5], chin: [66, 43.5], ear: [81.5, 37],
  point: [87.5, 47], belly: [64, 57.5], chest: [61.5, 52.5], pray: [61, 47], low: [80, 60.5], face: [68, 31.5] };
// 자주 쓰는 자세 (각도)
const WAVE_R = { ra: [150, 118], re: [-10, 30] }; const WAVE_L = { la: [150, 118], le: [-10, 30] };
const CHEER = { la: [120, 168], le: [10, -20], ra: [120, 168], re: [10, -20] };
const HUG = { la: [70, 110], le: [40, 5], ra: [70, 110], re: [40, 5] };
const LOVE = { la: [145, 155], le: [65, 80], ra: [145, 155], re: [65, 80] };
const BOW = { la: [4, -4], le: [0, 30], ra: [4, -4], re: [0, 30] };
const RUN = { la: [-35, 55], le: [70, 70], ra: [55, -35], re: [70, 70], ll: [0, 38], rl: [38, 0] };
const DANCE = { la: [25, 150], le: [30, -30], ra: [150, 25], re: [-30, 30], ll: [0, 28], rl: [28, 0] };
const RAISE = { ra: [148, 160], re: [18, 4] };              // 손 번쩍
const FLEX_L = { la: [85, 92], le: [70, 88] };
const JUMP = { ll: [0, 22], rl: [0, 22] };
const WALK = { ll: [-12, 16], rl: [16, -12] };
const hipL = () => Lh(mir(T.hip)); const hipR = () => Rh(T.hip);
const CROSS = () => Bh([54.5, 54], [54.5, 53]);          // 팔짱
const CLAP = () => Bh([66, 50], [61.5, 49.5]);             // 박수
const THUMBS = () => ({ ...Bh(T.show, [84.5, 37.5]), holdR: held('thumbs', 1.35, 0, -5), holdL: held('thumbs', 1.35, 0, -5) });
// 옷 (몸통 위에 그림)
const OUTFIT = {
  tee: () => '',
  hoodie: () => `<path d="M53.5 56.5q6.5 3.4 13 0" ${st(1.3, 'rgba(0,0,0,.18)')}/><path d="M57.4 46v4.4M62.6 46v4.4" ${st(1.1, '#fff')}/><circle cx="57.4" cy="50.8" r=".9" fill="#fff"/><circle cx="62.6" cy="50.8" r=".9" fill="#fff"/>`,
  heart: () => heart(60, 53, 3.4, '#fff'),
  tie: () => `<path d="M55.2 44.4l4.8 1.4-3 2.6zM64.8 44.4l-4.8 1.4 3 2.6z" fill="#fff"/><path d="M58.4 45.6h3.2l-.6 1.9 1.6 7l-2.6 2.4-2.6-2.4 1.6-7z" fill="${BLUE}"/>`,
  apron: () => `<path d="M52.6 48h14.8v11.6a3.4 3.4 0 0 1-3.4 3.4h-8a3.4 3.4 0 0 1-3.4-3.4z" fill="#fff"/><path d="M53.6 48l-1.8-3.6M66.4 48l1.8-3.6" ${st(1.4, '#fff')}/><path d="M56.6 54h6.8" ${st(1.3, '#FF9FB8')}/>`,
  scarf: () => `<path d="M49.4 44.2q10.6 4.4 21.2 0v3.6q-10.6 4.2-21.2 0z" fill="${RED}"/><path d="M63.4 47.4l1 8.2 3.4-.8-1.2-8z" fill="${RED}"/><path d="M53 46.4l1.6-.8M58 47.4l1.6-.9M63 47.2l1.6-.9" ${st(.9, '#fff')} opacity=".7"/>`,
  stripe: () => `<path d="M49.6 50h20.8M49.6 55h20.8M50.4 60h19.2" ${st(1.6, 'rgba(255,255,255,.55)')}/>`,
};
// 몸 한 벌 그리기 (그림자 + 움직이는 몸) — 120×120 좌표, 발이 (60,80)
function core(o) {
  const g = { d: o.d || .5, dl: o.dl };
  const shirt = o.shirt || '#59C2FF'; const pants = o.pants || PANTS; const skin = o.skin || SKIN;
  const eyeCls = o.eyesAnim ? ` ax-${o.eyesAnim}` : o.blink ? ' ae-blink' : '';
  const face = `${o.cheeks ?? cheeks()}${o.brows || ''}<g class="ae${eyeCls}">${o.eyes || E.dot}</g>${o.mouth || M.smile}`;
  const headItems = (o.headItems || []).map(layer).join('');
  const headSvg = `<g transform="translate(-26.2 -38.6) scale(.82)"><path d="${BODY}" fill="${skin}"/>${face}${headItems}</g>`;
  return `<ellipse cx="60" cy="79" rx="15" ry="2.6" fill="${INK}" opacity=".08"/>`
    + `<g class="ab fig ab-${o.move || 'bounce'}">`
    + leg(55.4, 60.6, false, o.ll, pants, g) + leg(64.6, 60.6, true, o.rl, pants, g)
    + `<rect x="49" y="41.6" width="22" height="21.4" rx="9" fill="${shirt}"/>${(OUTFIT[o.outfit || 'tee'] || OUTFIT.tee)(shirt)}`
    + `<rect x="54" y="37" width="12" height="9" rx="4.5" fill="${skin}"/><ellipse cx="60" cy="45.2" rx="9" ry="2.4" fill="${INK}" opacity=".1"/>`
    + `<g transform="translate(60 42)">${jt(o.head, headSvg, g)}</g>`
    + arm(49.8, 47, false, o.la ?? 8, o.le, o.holdL, shirt, g) + arm(70.2, 47, true, o.ra ?? 8, o.re, o.holdR, shirt, g)
    + (o.onBody || '') + `</g>`;
}
// 함께 나오는 작은 친구 (연인·가족): 발 위치 cx, 크기 s
const buddy = (o, cx, s = .6) => `<g transform="translate(${cx} 81) scale(${s}) translate(-60 -80)">${core({ skin: PINK_BODY, shirt: '#FFE08A', ...o })}</g>`;
function figure(o) {
  const free = (o.items || []).map(layer).join('');
  return `<g transform="translate(${60 + (o.dx || 0)} 82) scale(1.07) translate(-60 -80)">${core(o)}</g>${o.after || ''}${free}`;
}
// 글자 폭 대략 계산 (한글 13, 그 외 7)
const textW = (t) => [...t].reduce((w, c) => w + (/[가-힣ㄱ-ㅎ…]/.test(c) ? 13 : c === ' ' ? 4 : 7), 0);
const caption = (label, capColor) => {
  const tw = textW(label);
  const fs = tw > 92 ? Math.round(13 * 92 / tw * 10) / 10 : 13;   // 긴 글자는 살짝 작게 (상자가 그림 밖으로 나가지 않게)
  const w = tw * fs / 13 + 22;
  return `<g class="st-cap"><rect x="${(60 - w / 2).toFixed(1)}" y="89" width="${w.toFixed(1)}" height="24" rx="12" fill="#fff" stroke="${capColor}" stroke-width="2"/>`
    + `<text x="60" y="${fs < 13 ? 105 : 105.6}" font-size="${fs}" font-weight="700" fill="${INK}" text-anchor="middle">${label}</text></g>`;
};
const drawFig = (label, o, capColor) => figure(o) + caption(label, capColor);
// 손에 드는 소품 (손 위치가 가운데, dy 만큼 위로)
const held = (name, s = 1, dx = 0, dy = -2, rot = 0) => at(dx, dy, Math.round(s * 112) / 100, P[name], rot);   // 손에 든 건 조금 크게
// 같이 쓰는 꾸밈
const STOP_HAND = `<g transform="translate(0 -3)"><rect x="-4.6" y="-5" width="9.2" height="10" rx="4" fill="${MINT}" stroke="${MINT_D}" stroke-width="1.3"/><path d="M-2-5v-3M.4-5.4v-3.4M2.8-5v-2.8" ${st(2.2, MINT_D)}/></g>`;
const RING = x('pop', lines('M96 14l3-3M98 21h4M95 8l1-4'));
const LAPTOP = `<g transform="translate(60 61.5) scale(1.35)">${P.laptop}</g>`;

// ---------------------------------------------------------------------
//  꾸러미: [이름, 글자, 그림]  (탭별 옷 — 친구: 후드티·줄무늬 / 연인: 하트 티 / 가족: 앞치마·목도리 / 직장: 셔츠·넥타이)
// ---------------------------------------------------------------------
const SKYC = '#59C2FF'; const ORG = '#FF8A5B'; const YEL = '#FFC94D'; const PUR = '#9B7BF7'; const GRN = '#6C8CFF'; const RED_S = '#FF6B6B';
const fr = (shirt, outfit) => ({ shirt, outfit });
const PACK_FRIENDS = [
  ['f_ok', 'ㅇㅋ', { move: 'nod', d: .5, ...Rh(T.show, [84.5, 37.5]), holdR: held('ok', 1.05, 1, -8), ...hipL(), eyes: E.happy, mouth: M.smile, ...fr(SKYC, 'hoodie') }],
  ['f_daebak', '대박!', { move: 'jolt', d: .28, ...CHEER, ...JUMP, eyes: E.sparkle, mouth: M.big, ...fr(ORG, 'stripe'), items: sparks() }],
  ['f_real', '실화냐', { move: 'tilt', d: .5, head: [-4, 4], ...Bh(T.cheek, [75.5, 33]), brows: B.raise, eyes: E.wide, mouth: M.oBig, ...fr(YEL, 'tee'), items: [x('bob', word(101, 22, '?!', 17, PINK, 8))] }],
  ['f_go', '고고!', { move: 'run', d: .2, head: [-4, 4], ...RUN, brows: B.firm, eyes: E.dot, mouth: M.grin, ...fr(ORG, 'stripe'), items: [speed()] }],
  ['f_call', '콜!', { move: 'bounce', d: .35, ...Rh(T.show, [84.5, 37.5]), holdR: held('thumbs', 1.4, 0, -5), ...hipL(), eyes: E.wink, mouth: M.grin, ...fr(PUR, 'hoodie'), items: [x('twinkle', spark(18, 20, 1.3))] }],
  ['f_lmao', '빵 터짐', { move: 'giggle', d: .22, head: [-7, 7], ...Bh(T.belly, [63.5, 55.5]), eyes: E.laugh, mouth: M.big, headItems: joy(), ...fr(GRN, 'tee'), items: [x('pop', word(101, 22, 'ㅋ', 16, PINK, 12)), x('pop', word(19, 30, 'ㅋ', 13, PINK, -12), { d: .25 })] }],
  ['f_bored', '심심해', { move: 'droop', d: .9, head: [5, 9], ...Rh(T.chin, [66, 42.5]), brows: B.flat, eyes: E.up, blink: 1, mouth: M.flat, ...fr(SKYC, 'tee'), items: [x('bob', dots(101, 20))] }],
  ['f_play', '놀자!', { move: 'jump', d: .3, ...CHEER, ...JUMP, eyes: E.happy, mouth: M.big, ...fr(YEL, 'hoodie'), items: sparks() }],
  ['f_chicken', '치킨?', { move: 'wiggle', d: .4, ...Rh(T.show, [85, 37]), holdR: held('chicken', 1.5, 0, -6), ...Lh(mir(T.cheek)), eyes: E.sparkle, mouth: M.tongue, headItems: [drool()], ...fr(ORG, 'tee'), items: [ask(ORG)] }],
  ['f_coffee', '커피 콜?', { move: 'sway', d: .6, head: [-4, 4], ...Rh(T.side, [84.5, 47]), holdR: held('coffee', 1.35, 0, -5), ...WAVE_L, eyes: E.dot, blink: 1, mouth: M.smile, ...fr(PUR, 'stripe') }],
  ['f_bday', '생일 축하해', { move: 'hop', d: .45, ...Rh(T.side, [84.5, 47]), holdR: held('cake', 1.4, 0, -8.5), ...WAVE_L, eyes: E.happy, mouth: M.big, ...fr(GRN, 'hoodie'), items: confetti() }],
  ['f_best', '최고!', { move: 'pulse', d: .5, ...THUMBS(), eyes: E.happy, mouth: M.grin, ...fr(RED_S, 'stripe'), items: [x('twinkle', spark(60, 6, 1.4))] }],
  ['f_agree', '인정', { move: 'nod', d: .5, ...CROSS(), eyes: E.closed, mouth: M.smirk, ...fr(SKYC, 'hoodie'), items: [popR('check', 1.25)] }],
  ['f_nono', '노노', { move: 'shake', d: .2, ...Rh([83, 39], [86, 41]), ...hipL(), brows: B.flat, eyes: E.dot, mouth: M.frown, ...fr(ORG, 'tee'), items: [x('pop', prop('nope', 19, 22, 1.2))] }],
  ['f_heol', '헐', { move: 'jolt', d: .4, ...Bh(T.cheek, [75.5, 33]), eyes: E.wide, mouth: M.o, headItems: [sweat()], ...fr(YEL, 'stripe'), items: [bang('!!')] }],
  ['f_sleepy', '졸려', { move: 'breathe', d: 1, head: [3, 10], ...Lh(mir([73.5, 33.5]), mir([74.5, 35])), eyes: E.closed, mouth: M.wavy, ...fr(PUR, 'tee'), items: [x('zz', word(97, 24, 'Z', 16, MINT_D, -10)), x('zz', word(106, 13, 'z', 12, MINT_D, -10), { d: .6 })] }],
  ['f_leave', '출발!', { move: 'run', d: .2, ...RUN, ...Rh(T.point, [88, 44]), brows: B.firm, eyes: E.dot, mouth: M.grin, ...fr(GRN, 'stripe'), items: [speed(), x('twinkle', spark(104, 22, 1.3))] }],
  ['f_arrive', '도착!', { move: 'bounce', d: .4, ...Rh(T.show, [84.5, 37]), holdR: held('pin', 1.35, 0, -7), ...WAVE_L, eyes: E.happy, mouth: M.big, ...fr(SKYC, 'tee'), items: [x('twinkle', spark(104, 12, 1.2))] }],
  ['f_late', '늦어서 미안', { move: 'bowdeep', d: .7, head: [0, 5], ...Bh(T.pray, [61, 48.5]), brows: B.sad, eyes: E.closed, mouth: M.wavy, headItems: [sweatL()], ...fr(ORG, 'hoodie'), items: [float('clock', 1.35, 101, 20)] }],
  ['f_omw', '금방 갈게', { move: 'run', d: .2, head: [-4, 4], ...RUN, eyes: E.happy, mouth: M.grin, ...fr(YEL, 'tee'), items: [speed(), float('clock', 1.25, 102, 18)] }],
  ['f_yummy', '맛있겠다', { move: 'wiggle', d: .4, ...Bh(T.cheek, [75.5, 33]), eyes: E.sparkle, mouth: M.tongue, headItems: [drool()], ...fr(RED_S, 'tee'), items: sparks() }],
  ['f_gn', '굿밤', { move: 'breathe', d: .8, ...WAVE_R, eyes: E.closed, mouth: M.smile, headItems: [x('', NIGHT_CAP)], ...fr(PUR, 'hoodie'), items: [float('moon', 1.6, 18, 22), x('twinkle', spark(102, 22, 1.2)), x('twinkle', spark(26, 8, .9), { d: .5 })] }],
  ['f_movie', '영화 볼래?', { move: 'tilt', d: .6, ...Rh(T.side, [84.5, 47.5]), holdR: held('popcorn', 1.4, 0, -6), ...hipL(), eyes: E.dot, blink: 1, mouth: M.smile, ...fr(SKYC, 'stripe'), items: [ask()] }],
  ['f_game', '한 판 할래?', { move: 'groove', d: .25, ...Bh([64.5, 57], [64, 55.5]), holdR: held('pad', 1.45, -4.5, 0), eyes: E.shades, mouth: M.smirk, ...fr(GRN, 'hoodie'), items: [x('twinkle', spark(102, 18, 1.3))] }],
  ['f_jjang', '짱!', { move: 'pulse', d: .45, ...Rh(T.show, [84.5, 37]), holdR: held('star', 1.6, 0, -6), ...hipL(), eyes: E.sparkle, mouth: M.grin, ...fr(YEL, 'tee'), items: [x('twinkle', spark(18, 20, 1.3))] }],
  ['f_wow', '우와', { move: 'jolt', d: .35, ...Bh([86, 40], [86, 36.5]), ll: [0, 14], rl: [0, 14], eyes: E.sparkle, mouth: M.oBig, ...fr(ORG, 'stripe'), items: sparks() }],
  ['f_eat', '밥 먹자', { move: 'bounce', d: .4, ...Rh(T.side, [84.5, 47.5]), holdR: held('rice', 1.4, 0, -6), ...WAVE_L, eyes: E.happy, mouth: M.big, ...fr(RED_S, 'hoodie') }],
  ['f_full', '배불러', { move: 'breathe', d: .7, ...Bh(T.belly, [64.5, 58.5]), eyes: E.closed, mouth: M.cat, cheeks: cheeks(BLUSH, 4.4, 2.8), ...fr(GRN, 'tee'), items: [x('bob', word(101, 22, '휴~', 13, MINT_D, -6))] }],
  ['f_where', '어디야?', { move: 'tilt', d: .5, ...Rh(T.ear, [81.5, 36]), holdR: held('phone', 1.25, 0, -4, 10), ...hipL(), brows: B.raise, eyes: E.dot, blink: 1, mouth: M.o, ...fr(SKYC, 'tee'), items: [ask()] }],
  ['f_cheers', '건배!', { move: 'hop', d: .45, head: [-6, 6], la: [12, 22], le: [0, 20], ra: [35, 160], re: [45, 0], holdR: held('mug', 1.15, 0, -3), eyes: E.happy, mouth: M.big, ...fr(YEL, 'tee'), items: [x('twinkle', spark(100, 12, 1.4)), x('twinkle', spark(20, 18, 1), { d: .3 })] }],
];

const LV = '#FF9FB8'; const LV2 = '#FF7F98'; const LV3 = '#FFB3C7';
const lv = (shirt = LV, outfit = 'heart') => ({ shirt, outfit });
// 연인: 오른쪽에 분홍 톡이가 함께 (주인공은 왼쪽으로 비켜 섬)
const PAIR = { dx: -14 };
const partner = (o = {}, cx = 86, s = .62) => buddy({ move: 'sway', d: .6, shirt: '#FFE08A', outfit: 'heart', eyes: E.happy, mouth: M.smile, ...o }, cx, s);
// 머리 쓰다듬기: 작은 친구를 가까이 두고 손을 머리 위로 (손 자리는 주인공 그림 좌표)
const PAT = { ...PAIR, ...Rh([85.4, 44.6], [86.2, 48]) };
const PACK_LOVE = [
  ['l_miss', '보고싶어', { move: 'droop', d: .8, ...CROSS(), brows: B.sad, eyes: E.dot, blink: 1, mouth: M.pout, ...lv(LV), items: [x('float', heart(100, 18, 4)), x('float', heart(106, 38, 2.6), { d: .4 })] }],
  ['l_love', '사랑해요', { move: 'pulse', d: .5, head: [-4, 4], ...LOVE, eyes: E.heart, eyesAnim: 'beat', mouth: M.grin, ...lv(LV2), items: [x('beat', heart(60, 6, 6.5)), x('float', heart(102, 32, 3)), x('float', heart(18, 34, 2.4), { d: .4 })] }],
  ['l_honey', '자기야~', { move: 'sway', d: .7, head: [-5, 5], ...WAVE_R, ...Lh(mir(T.cheek)), eyes: E.happy, mouth: M.cat, ...lv(LV3, 'tee'), items: [x('float', heart(102, 14, 3.4)), x('float', heart(18, 22, 2.6), { d: .5 })] }],
  ['l_kiss', '뽀뽀', { move: 'shy', d: .55, ...Rh([68, 40], [84, 38]), ...Lh(mir(T.hip)), eyes: E.closed, mouth: KISS, cheeks: cheeks('#FF7F96', 4.6, 2.8), ...lv(LV), items: [x('float', heart(98, 30, 3.4)), x('float', heart(106, 16, 2.4), { d: .4 })] }],
  ['l_hug', '안아줘', { move: 'wiggle', d: .5, head: [-6, 6], ...HUG, eyes: E.happy, mouth: M.wavy, cheeks: cheeks('#FF8FA3', 4.6, 2.8), ...lv(LV), items: [x('float', heart(100, 18, 4)), x('float', heart(20, 14, 3), { d: .5 })] }],
  ['l_heartbeam', '하트 뿅뿅', { move: 'bounce', d: .45, ...LOVE, eyes: E.heart, eyesAnim: 'beat', mouth: M.big, ...lv(LV2), items: hearts() }],
  ['l_pretty', '오늘도 예뻐', { move: 'pulse', d: .5, ...Rh(T.show, [84.5, 37.5]), holdR: held('flower', 1.5, 0, -6), ...Lh(mir(T.cheek)), eyes: E.sparkle, mouth: M.grin, ...lv(LV3, 'tee'), items: [x('twinkle', spark(18, 20, 1.3))] }],
  ['l_cool', '멋있어', { move: 'groove', d: .2, ...CLAP(), eyes: E.sparkle, mouth: M.smile, ...lv(LV), items: [x('float', heart(101, 16, 3.4)), x('twinkle', spark(106, 36, 1)), x('twinkle', spark(18, 20, 1.2), { d: .4 })] }],
  ['l_date', '데이트 가자', { move: 'hop', d: .45, ...Rh(T.show, [84.5, 37]), holdR: at(0, -7, 1.35, P.cal + heart(0, 1.6, 1.8)), ...WAVE_L, ...JUMP, eyes: E.happy, mouth: M.big, ...lv(LV2, 'tee'), items: [x('float', heart(18, 22, 2.6))] }],
  ['l_wait', '기다릴게', { move: 'sway', d: .7, head: [-5, 5], ...Bh(T.pray, [61, 48]), eyes: E.dot, blink: 1, mouth: M.smile, ...lv(LV), items: [float('clock', 1.3, 101, 18), x('float', heart(18, 24, 2.4))] }],
  ['l_sorry', '미안해 자기', { move: 'bow', d: .6, ...Rh(T.side, [85.5, 48]), holdR: held('flower', 1.45, 0, -6, -12), ...Lh(mir([74, 33]), mir([74.5, 31.5])), brows: B.sad, eyes: E.closed, mouth: M.wavy, headItems: [sweatL()], ...lv(LV3, 'tee') }],
  ['l_sad', '서운해', { move: 'droop', d: .3, head: [6, 9], ...Bh([62.5, 52], [61, 51]), brows: B.sad, eyes: E.dot, blink: 1, mouth: M.pout, headItems: [tear()], ...lv(LV), items: [x('bob', dots(101, 20, PINK))] }],
  ['l_hmph', '흥칫뿡', { move: 'shake', d: .3, head: [-12, -7], ...CROSS(), brows: B.angry, eyes: E.dot, mouth: M.pout, cheeks: cheeks('#FF7A6B', 4.2, 2.6), headItems: [x('throb', ANGRY())], ...lv(LV2, 'tee') }],
  ['l_jealous', '질투나', { move: 'shake', d: .25, ...Bh([79.5, 58], [78.5, 56]), brows: B.firm, eyes: E.dot, mouth: M.frown, headItems: [x('throb', ANGRY(PURPLE)), sweatL()], ...lv(LV) }],
  ['l_mine', '내 거야', { move: 'pulse', d: .5, ...PAIR, ...Rh([82, 50], [82.5, 48.5]), ...hipL(), eyes: E.happy, mouth: M.smirk, ...lv(LV2), after: partner({ eyes: E.heart, la: 40, le: 30 }), items: [x('beat', heart(72, 14, 4))] }],
  ['l_dream', '좋은 꿈 꿔', { move: 'breathe', d: .9, ...WAVE_R, eyes: E.closed, mouth: M.smile, headItems: [x('', NIGHT_CAP)], ...lv(LV3, 'tee'), items: [float('moon', 1.6, 18, 22), x('float', heart(102, 24, 2.6)), x('zz', word(104, 10, 'z', 12, MINT_D, -10), { d: .4 })] }],
  ['l_morning', '굿모닝', { move: 'bounce', d: .8, ...CHEER, eyes: E.happy, mouth: M.grin, ...lv(LV), items: [float('sun', 1.5, 100, 16), x('float', heart(18, 24, 2.6))] }],
  ['l_ate', '밥 먹었어?', { move: 'tilt', d: .55, ...Rh(T.side, [84.5, 47.5]), holdR: held('rice', 1.4, 0, -6), ...Lh(mir(T.chin)), brows: B.raise, eyes: E.dot, blink: 1, mouth: M.o, ...lv(LV2, 'tee'), items: [x('float', heart(101, 14, 2.6))] }],
  ['l_safe', '조심히 와', { move: 'sway', d: .6, ...WAVE_L, ...Rh(T.chest), holdR: heart(0, -1, 3.2), eyes: E.happy, mouth: M.smile, ...lv(LV), items: [x('float', heart(101, 16, 3))] }],
  ['l_text', '연락해 줘', { move: 'tilt', d: .5, ...Rh(T.ear, [81.5, 36]), holdR: at(0, -4, 1.25, P.phone + heart(0, -.6, 1.4, '#fff'), 10), ...Lh(mir(T.cheek)), eyes: E.dot, blink: 1, mouth: M.smile, ...lv(LV3, 'tee'), items: [RING] }],
  ['l_tired', '고생했어', { move: 'pulse', d: .35, ...PAT, ...hipL(), eyes: E.happy, mouth: M.smile, ...lv(LV), after: partner({ move: 'breathe', eyes: E.closed, mouth: M.cat }, 76, .5), items: [x('float', heart(100, 22, 3))] }],
  ['l_best', '최고야', { move: 'hop', d: .45, ...THUMBS(), ...JUMP, eyes: E.sparkle, mouth: M.grin, ...lv(LV2), items: [x('float', heart(18, 22, 2.8)), x('float', heart(102, 14, 2.4), { d: .3 })] }],
  ['l_forever', '평생 함께', { move: 'pulse', d: .6, ...PAIR, ...Rh([82, 59], [82, 58]), ...hipL(), eyes: E.heart, mouth: M.smile, ...lv(LV), after: partner({ eyes: E.heart, ...Lh([33.5, 45]), move: 'pulse' }), items: [x('beat', heart(73, 12, 4.2)), x('twinkle', spark(108, 22, 1.1))] }],
  ['l_hand', '손잡자', { move: 'sway', d: .6, ...PAIR, ...Rh([82, 58.5], [81.5, 60]), ...WAVE_L, eyes: E.happy, mouth: M.smile, ...lv(LV3, 'tee'), after: partner({ ...Lh([33.5, 44.5], [33, 46]) }), items: [x('float', heart(73, 14, 3.2))] }],
  ['l_flower', '꽃 줄게', { move: 'shy', d: .6, ...Rh(T.point, [87, 44]), holdR: held('flower', 1.5, 0, -6, 12), ...Lh(mir(T.cheek)), eyes: E.happy, mouth: M.wavy, cheeks: cheeks('#FF8FA3', 4.6, 2.8), ...lv(LV), items: [x('float', heart(18, 22, 2.6))] }],
  ['l_letter', '러브레터', { move: 'shy', d: .6, ...Bh(T.chest, [61.5, 51]), holdR: held('letter', 1.45, -1.5, -3), eyes: E.closed, mouth: M.cat, cheeks: cheeks('#FF8FA3', 4.6, 2.8), ...lv(LV2, 'tee'), items: [x('float', heart(101, 16, 3)), x('float', heart(18, 22, 2.4), { d: .4 })] }],
  ['l_gift', '선물이야', { move: 'jump', d: .4, ...Rh(T.show, [84.5, 37]), holdR: held('gift', 1.4, 0, -6), ...WAVE_L, eyes: E.happy, mouth: M.big, ...lv(LV), items: sparks() }],
  ['l_anniv', '기념일 축하해', { move: 'hop', d: .45, ...Rh(T.side, [84.5, 47]), holdR: held('cake', 1.4, 0, -8.5), ...WAVE_L, eyes: E.heart, mouth: M.big, ...lv(LV2), items: [x('fall', heart(18, 14, 2.6)), x('fall', heart(102, 6, 2.4), { d: .3 }), x('fall', heart(26, 4, 2), { d: .6 })] }],
  ['l_yes', '웅웅', { move: 'nod', d: .35, ...Bh(T.cheek, [75, 33.5]), eyes: E.happy, mouth: M.cat, cheeks: cheeks('#FF8FA3', 4.6, 2.8), ...lv(LV3, 'tee'), items: [x('float', heart(101, 16, 3.4))] }],
  ['l_hehe', '헤헤', { move: 'giggle', d: .3, head: [-5, 5], ...Rh([67, 40], [67.5, 39]), ...hipL(), eyes: E.happy, mouth: M.grin, cheeks: cheeks('#FF8FA3', 4.6, 2.8), ...lv(LV), items: [x('float', heart(101, 16, 3)), x('float', heart(18, 24, 2.2), { d: .5 })] }],
];

const FA = '#FFB86B'; const FA2 = '#8FB8FF'; const FA3 = '#FFD36E'; const FA4 = '#B08CFF';
const fa = (shirt = FA, outfit = 'apron') => ({ shirt, outfit, pants: '#6A7B93' });
// 가족: 오른쪽에 작은 하늘색 아이 톡이
const kid = (o = {}, cx = 87, s = .52) => buddy({ skin: SKY_BODY, shirt: YEL, outfit: 'tee', move: 'bounce', d: .5, eyes: E.happy, mouth: M.grin, ...o }, cx, s);
const PACK_FAMILY = [
  ['fa_mom', '엄마 사랑해요', { move: 'pulse', d: .5, ...LOVE, eyes: E.happy, mouth: M.grin, ...fa(FA3, 'tee'), items: [x('beat', heart(60, 6, 6)), x('float', heart(102, 30, 3)), x('float', heart(18, 32, 2.4), { d: .4 })] }],
  ['fa_dad', '아빠 최고', { move: 'jump', d: .4, ...THUMBS(), ...JUMP, eyes: E.sparkle, mouth: M.grin, ...fa(FA4, 'tee'), items: [x('twinkle', spark(60, 6, 1.4))] }],
  ['fa_ate', '밥 먹었니?', { move: 'tilt', d: .55, ...Rh(T.side, [84.5, 47.5]), holdR: held('rice', 1.4, 0, -6), ...hipL(), brows: B.raise, eyes: E.dot, blink: 1, mouth: M.o, ...fa(), items: [ask(ORANGE)] }],
  ['fa_bye', '잘 다녀와', { move: 'sway', d: .35, ...WAVE_R, ...hipL(), eyes: E.happy, mouth: M.smile, ...fa(), items: [x('float', heart(18, 22, 2.8))] }],
  ['fa_home', '다녀왔습니다', { move: 'bounce', d: .32, ...WAVE_R, ...Lh(mir(T.side)), holdL: held('case', 1.3, 0, 4), eyes: E.happy, mouth: M.big, ...fa(SKYC, 'tee'), items: [x('pop', prop('house', 18, 24, 1.3))] }],
  ['fa_drive', '조심히 가', { move: 'sway', d: .35, ...WAVE_L, ...hipR(), eyes: E.dot, blink: 1, mouth: M.smile, ...fa(FA2, 'scarf'), items: [x('float', heart(101, 16, 3))] }],
  ['fa_health', '건강 챙겨', { move: 'pulse', d: .5, ...Rh(T.show, [84.5, 37.5]), holdR: held('pill', 1.5, 0, -6), ...FLEX_L, brows: B.firm, eyes: E.dot, mouth: M.smile, ...fa(FA4, 'tee'), items: [x('float', heart(18, 14, 2.4))] }],
  ['fa_money', '용돈 고마워요', { move: 'bowdeep', d: .7, ...Bh(T.pray, [61, 48.5]), eyes: E.happy, mouth: M.grin, ...fa(FA3, 'tee'), items: [x('fall', prop('coin', 18, 12, 1.5)), x('fall', prop('coin', 100, 8, 1.6), { d: .3 }), x('fall', prop('coin', 106, 30, 1.3), { d: .6 })] }],
  ['fa_filial', '효도할게요', { move: 'bow', d: .7, ...Bh(T.pray, [61, 48.5]), eyes: E.sparkle, mouth: M.smile, ...fa(FA2, 'tee'), items: hearts() }],
  ['fa_bday', '생신 축하드려요', { move: 'hop', d: .45, ...Rh(T.side, [84.5, 47]), holdR: held('cake', 1.4, 0, -8.5), ...WAVE_L, eyes: E.happy, mouth: M.big, ...fa(FA, 'tee'), items: confetti() }],
  ['fa_holiday', '명절 잘 보내', { move: 'bounce', d: .4, ...Rh(T.show, [84.5, 37.5]), holdR: held('gift', 1.4, 0, -6), ...WAVE_L, eyes: E.happy, mouth: M.grin, ...fa(RED_S, 'tee'), items: [x('twinkle', spark(18, 20, 1.3)), x('twinkle', spark(104, 12, 1), { d: .4 })] }],
  ['fa_miss', '보고 싶다', { move: 'droop', d: .8, ...CROSS(), brows: B.sad, eyes: E.dot, blink: 1, mouth: M.smile, ...fa(FA2, 'scarf'), items: [x('float', heart(100, 18, 4)), x('float', heart(106, 38, 2.6), { d: .4 })] }],
  ['fa_call', '전화해', { move: 'tilt', d: .5, ...Rh(T.ear, [81.5, 36]), holdR: held('phone', 1.25, 0, -4, 10), ...hipL(), eyes: E.dot, blink: 1, mouth: M.smile, ...fa(FA4, 'tee'), items: [RING] }],
  ['fa_early', '일찍 와', { move: 'sway', d: .45, ...Lh(mir(T.show), mir([84.5, 37.5])), holdL: held('clock', 1.4, 0, -6), ...Rh(T.point, [87, 44]), brows: B.firm, eyes: E.dot, mouth: M.smile, ...fa(), items: [x('pop', prop('house', 102, 22, 1.2))] }],
  ['fa_dinner', '저녁 뭐 먹어?', { move: 'tilt', d: .55, ...Rh(T.side, [84.5, 47.5]), holdR: held('rice', 1.4, 0, -6), ...Lh(mir(T.chin)), eyes: E.up, blink: 1, mouth: M.tongue, ...fa(), items: [x('bob', word(101, 14, '?', 18, ORANGE, 10))] }],
  ['fa_homemeal', '집밥 최고', { move: 'wiggle', d: .4, ...Rh(T.side, [84.5, 47.5]), holdR: held('rice', 1.4, 0, -6), ...Lh(mir(T.show), mir([84.5, 37.5])), holdL: held('thumbs', 1.35, 0, -5), eyes: E.sparkle, mouth: M.tongue, headItems: [drool()], ...fa(), items: [x('twinkle', spark(60, 6, 1.3))] }],
  ['fa_cold', '감기 조심', { move: 'breathe', d: .25, ...Bh([63.5, 51], [61.5, 51.5]), brows: B.sad, eyes: E.dot, blink: 1, mouth: M.wavy, headItems: [sweat()], ...fa(FA2, 'scarf'), items: [x('twinkle', spark(18, 20, 1)), x('twinkle', spark(102, 14, 1.2), { d: .4 })] }],
  ['fa_warm', '따뜻하게 입어', { move: 'sway', d: .7, ...CROSS(), eyes: E.happy, mouth: M.smile, ...fa(FA, 'scarf'), items: [x('twinkle', spark(102, 16, 1.4)), x('float', heart(18, 22, 2.8))] }],
  ['fa_goodjob', '수고했어', { move: 'nod', d: .35, ...PAT, ...hipL(), eyes: E.happy, mouth: M.smile, ...fa(), after: kid({ move: 'breathe', eyes: E.closed, mouth: M.cat }, 76, .5), items: [x('float', heart(100, 22, 3))] }],
  ['fa_team', '우리 가족 화이팅', { move: 'jump', d: .35, ...PAIR, ...Rh([80, 42], [77, 31.5]), ...hipL(), brows: B.firm, eyes: E.dot, mouth: M.grin, headItems: [x('', BAND)], ...fa(FA4, 'tee'), after: kid({ move: 'jump', d: .35, brows: B.firm, ...Rh([80, 42], [77, 31.5]), headItems: [x('', BAND)] }), items: [x('twinkle', spark(106, 18, 1.2))] }],
  ['fa_proud', '자랑스러워', { move: 'pulse', d: .5, ...Rh(T.show, [84.5, 37.5]), holdR: held('medal', 1.5, 0, -6), ...hipL(), eyes: E.sparkle, mouth: M.grin, ...fa(FA3, 'tee'), items: [x('twinkle', spark(18, 20, 1.3))] }],
  ['fa_homework', '숙제했니?', { move: 'tilt', d: .55, ...Rh(T.side, [84.5, 47.5]), holdR: held('doc', 1.4, 0, -6, 8), ...hipL(), brows: B.raise, eyes: E.dot, blink: 1, mouth: M.o, ...fa(), items: [ask(ORANGE)] }],
  ['fa_baby', '잘 자 우리 아가', { move: 'sway', d: .9, ...Bh([62.5, 55], [62, 54]), holdR: mini(-2.5, -4, .36, SKY_BODY, E.closed, M.o), eyes: E.closed, mouth: M.smile, ...fa(FA2, 'tee'), items: [float('moon', 1.5, 18, 22), x('zz', word(99, 22, 'Z', 15, MINT_D, -10)), x('zz', word(107, 12, 'z', 11, MINT_D, -10), { d: .6 })] }],
  ['fa_cheer', '응원해', { move: 'jump', d: .35, ...Rh([80, 42], [77, 31.5]), ...hipL(), ...JUMP, brows: B.firm, eyes: E.dot, mouth: M.grin, headItems: [x('', BAND)], ...fa(FA3, 'tee'), items: [x('twinkle', spark(104, 12, 1.4))] }],
  ['fa_love', '사랑한다', { move: 'wiggle', d: .5, ...HUG, eyes: E.happy, mouth: M.smile, ...fa(), items: [x('beat', heart(60, 6, 6)), x('float', heart(18, 30, 2.6))] }],
  ['fa_thanks', '고맙다', { move: 'bow', d: .6, ...Rh(T.chest, [62, 51.5]), ...hipL(), eyes: E.closed, mouth: M.smile, ...fa(FA2, 'scarf'), items: [x('float', heart(100, 18, 3.4)), x('twinkle', spark(18, 20, 1.1))] }],
  ['fa_when', '언제 와?', { move: 'tilt', d: .55, ...Rh(T.show, [84.5, 37.5]), holdR: held('clock', 1.4, 0, -6), ...Lh(mir(T.chin)), brows: B.raise, eyes: E.dot, blink: 1, mouth: M.o, ...fa(FA4, 'tee'), items: [x('bob', word(19, 24, '?', 18, ORANGE, -10))] }],
  ['fa_arrived', '도착했어', { move: 'bounce', d: .4, ...Rh(T.show, [84.5, 37]), holdR: held('pin', 1.35, 0, -7), ...WAVE_L, eyes: E.happy, mouth: M.big, ...fa(SKYC, 'tee'), items: [x('pop', prop('house', 104, 30, 1.1), { d: .2 })] }],
  ['fa_market', '장 봐 올게', { move: 'bounce', d: .4, ...WALK, ...Rh(T.low, [80.5, 61.5]), holdR: held('bag', 1.45, 0, 4), ...WAVE_L, eyes: E.happy, mouth: M.smile, ...fa() }],
  ['fa_hug', '꼭 안아줄게', { move: 'wiggle', d: .5, head: [-6, 6], ...HUG, eyes: E.happy, mouth: M.wavy, ...fa(FA, 'scarf'), items: [x('float', heart(100, 18, 4)), x('float', heart(20, 14, 3), { d: .5 })] }],
];

const wk = (shirt = SHIRT_W, outfit = 'tie') => ({ shirt, outfit, pants: SUIT });
const PACK_WORK = [
  ['w_checked', '확인했습니다', { move: 'nod', d: .5, ...Rh(T.show, [84.5, 37.5]), holdR: held('check', 1.05, 1, -8), ...hipL(), eyes: E.dot, blink: 1, mouth: M.smile, ...wk() }],
  ['w_thanks', '감사합니다', { move: 'bowdeep', d: .7, head: [0, 4], ...BOW, eyes: E.closed, mouth: M.smile, ...wk(), items: [x('twinkle', spark(100, 16, 1.6)), x('twinkle', spark(20, 22, 1.2), { d: .4 })] }],
  ['w_goodwork', '수고하셨습니다', { move: 'bowdeep', d: .7, head: [0, 4], ...BOW, eyes: E.happy, mouth: M.smile, ...wk(), items: [x('float', prop('star', 100, 18, 1.5)), x('twinkle', spark(20, 22, 1.2))] }],
  ['w_yep', '넵!', { move: 'nod', d: .4, ...RAISE, ...hipL(), eyes: E.happy, mouth: M.grin, ...wk(), items: [x('pop', word(101, 26, '!', 20, BLUE, 12))] }],
  ['w_yepyep', '넵넵', { move: 'nod', d: .22, ...RAISE, ...hipL(), eyes: E.happy, mouth: M.big, ...wk(), items: [x('pop', prop('check', 100, 16, 1)), x('pop', prop('check', 106, 34, .75), { d: .2 })] }],
  ['w_ok', '알겠습니다', { move: 'nod', d: .5, ...Rh(T.show, [84.5, 37.5]), holdR: held('ok', 1.05, 1, -8), ...hipL(), eyes: E.dot, mouth: M.smile, ...wk() }],
  ['w_meeting', '회의 중', { move: 'sway', d: .8, ...Rh(T.side, [84.5, 48]), holdR: held('doc', 1.4, 0, -6, 8), ...Lh(mir(T.chin)), brows: B.flat, eyes: E.dot, blink: 1, mouth: M.flat, ...wk(), items: [x('bob', dots(19, 22))] }],
  ['w_moment', '잠시만요', { move: 'jolt', d: .4, ...Rh(T.point, [88, 45]), holdR: STOP_HAND, ...hipL(), brows: B.raise, eyes: E.dot, mouth: M.o, headItems: [sweatL()], ...wk() }],
  ['w_commute', '출근!', { move: 'run', d: .2, ...RUN, holdR: held('case', 1.25, 0, 4), brows: B.firm, eyes: E.dot, mouth: M.grin, ...wk(), items: [speed()] }],
  ['w_offwork', '퇴근!', { move: 'hop', d: .4, head: [-8, 8], la: [120, 168], le: [10, -20], ra: [120, 168], re: [10, -20], ll: [0, 32], rl: [0, 32], eyes: E.happy, mouth: M.big, ...wk(), items: [x('twinkle', spark(100, 12, 1.6)), x('twinkle', spark(20, 14, 1.3), { d: .3 }), x('fall', prop('case', 102, 44, 1.2, 20), { d: .2 })] }],
  ['w_overtime', '야근ㅠ', { move: 'sob', d: .14, ...Bh([64.5, 58], [64, 56.5]), brows: B.sad, eyes: E.cry, mouth: M.oBig, cheeks: '', headItems: [stream()], onBody: LAPTOP, ...wk(), items: [float('moon', 1.5, 101, 16)] }],
  ['w_lunch', '점심 뭐 드세요?', { move: 'tilt', d: .55, ...Rh(T.side, [84.5, 47.5]), holdR: held('rice', 1.4, 0, -6), ...Lh(mir(T.chin)), eyes: E.up, blink: 1, mouth: M.tongue, ...wk(), items: [x('bob', word(19, 24, '?', 18, BLUE, -10))] }],
  ['w_coffee', '커피 한잔?', { move: 'sway', d: .6, head: [-4, 4], ...Rh(T.side, [84.5, 47]), holdR: held('coffee', 1.35, 0, -5), ...WAVE_L, eyes: E.dot, blink: 1, mouth: M.smile, ...wk() }],
  ['w_report', '보고드립니다', { move: 'bow', d: .6, ...Bh(T.chest, [62, 51]), holdR: held('doc', 1.45, -1.5, -4), brows: B.firm, eyes: E.dot, mouth: M.smile, ...wk() }],
  ['w_review', '검토 부탁해요', { move: 'pulse', d: .5, ...Rh(T.show, [84.5, 37.5]), holdR: held('doc', 1.4, 0, -6, 8), ...Lh(mir(T.pray)), eyes: E.sparkle, mouth: M.cat, ...wk(), items: [x('twinkle', spark(18, 20, 1.3))] }],
  ['w_idea', '좋은 아이디어!', { move: 'jolt', d: .4, ...RAISE, ...hipL(), eyes: E.sparkle, mouth: M.big, ...wk(), items: [x('pop', prop('bulb', 100, 18, 1.5))] }],
  ['w_done', '완료!', { move: 'jump', d: .3, ...CHEER, ...JUMP, eyes: E.happy, mouth: M.grin, ...wk(), items: [popR('check', 1.2, 100, 30), x('twinkle', spark(20, 16, 1.3)), x('twinkle', spark(60, 6, 1.1), { d: .4 })] }],
  ['w_deadline', '마감 임박', { move: 'shake', d: .15, ...Bh(T.cheek, [75.5, 33]), brows: B.sad, eyes: E.wide, mouth: M.wavy, headItems: [sweatL()], ...wk(), items: [x('throb', prop('clock', 101, 20, 1.4))] }],
  ['w_fighting', '화이팅입니다', { move: 'jump', d: .35, ...Rh([80, 42], [77, 31.5]), ...Lh(mir([64, 53])), ...JUMP, brows: B.firm, eyes: E.dot, mouth: M.grin, headItems: [x('', BAND)], ...wk(), items: [x('twinkle', spark(104, 12, 1.4))] }],
  ['w_sorry', '죄송합니다', { move: 'bowdeep', d: .7, head: [0, 4], ...BOW, brows: B.sad, eyes: E.closed, mouth: M.wavy, headItems: [sweat()], ...wk() }],
  ['w_tired', '오늘도 고생', { move: 'droop', d: .9, head: [4, 8], ...Rh(T.low, [80.5, 59]), holdR: held('coffee', 1.3, 0, -5), brows: B.flat, eyes: E.closed, mouth: M.smile, ...wk(), items: [x('twinkle', spark(20, 20, 1.2))] }],
  ['w_weekend', '주말 잘 보내세요', { move: 'bounce', d: .32, ...WAVE_R, ...hipL(), eyes: E.happy, mouth: M.big, ...wk(), items: [float('sun', 1.4, 19, 20)] }],
  ['w_monday', '월요병', { move: 'droop', d: .9, head: [6, 10], ...Rh(T.face, [68.5, 33]), brows: B.sad, eyes: E.dot, blink: 1, mouth: M.wavy, headItems: [sweatL()], ...wk(), items: [x('bob', at(101, 20, 1.4, P.cal + word(0, 3.6, '월', 5, INK)))] }],
  ['w_dayoff', '연차!', { move: 'dance', d: .5, head: [-10, 10], ...DANCE, eyes: E.shades, mouth: M.big, shirt: '#FFB86B', outfit: 'tee', pants: '#3D5A80', items: [x('float', prop('plane', 101, 18, 1.6, -8)), float('sun', 1.3, 19, 18)] }],
  ['w_dinner', '회식', { move: 'wiggle', d: .45, ...Rh([85, 39], [83, 35]), holdR: held('mug', 1.3, 0, -4), ...Lh(mir(T.side), mir([84.5, 47])), holdL: held('chicken', 1.35, 0, -5), eyes: E.happy, mouth: M.big, ...wk(), items: [x('twinkle', spark(104, 12, 1.2))] }],
  ['w_congrats', '축하드립니다', { move: 'hop', d: .2, ...CLAP(), eyes: E.happy, mouth: M.big, headItems: [x('hat', PARTY_HAT, { o: '30% 100%' })], ...wk(), items: confetti() }],
  ['w_great', '대단하세요', { move: 'pulse', d: .5, ...THUMBS(), eyes: E.sparkle, mouth: M.grin, ...wk(), items: [x('twinkle', spark(60, 6, 1.4))] }],
  ['w_onit', '바로 할게요', { move: 'jolt', d: .12, ...Bh([64.5, 58], [64, 56.5]), brows: B.firm, eyes: E.dot, mouth: M.grin, onBody: LAPTOP, ...wk(), items: [x('flutter', lines('M104 46h9M102 54h12M104 62h8'), { o: '0% 50%' })] }],
  ['w_callok', '통화 가능?', { move: 'tilt', d: .5, ...Rh(T.ear, [81.5, 36]), holdR: held('phone', 1.25, 0, -4, 10), ...hipL(), brows: B.raise, eyes: E.dot, blink: 1, mouth: M.o, ...wk(), items: [x('bob', word(19, 24, '?', 18, BLUE, -10))] }],
  ['w_outside', '외근 중', { move: 'bounce', d: .4, ...WALK, ...Rh(T.low, [80.5, 61.5]), holdR: held('case', 1.3, 0, 4), ...WAVE_L, eyes: E.dot, blink: 1, mouth: M.smile, ...wk(), items: [float('sun', 1.4, 101, 16)] }],
];

function layer(it) {
  if (!it.anim) return it.svg;
  const style = `${it.o ? `transform-origin:${it.o};` : ''}${it.d ? `animation-delay:${it.d}s;` : ''}`;
  return `<g class="ax ax-${it.anim}"${style ? ` style="${style}"` : ''}>${it.svg}</g>`;
}

// 원래 톡이 24개 (말풍선 캐릭터 그대로)
function draw(id, label, o, capColor = MINT) {
  const eyes = `<g class="ae${o.eyesAnim ? ` ax-${o.eyesAnim}` : o.blink ? ' ae-blink' : ''}">${o.eyes}</g>`;
  const face = `${o.cheeks ?? cheeks()}${o.brows || ''}${eyes}${o.mouth}`;
  const items = o.items || [];
  const onBody = items.filter((it) => it.on).map(layer).join('');
  const free = items.filter((it) => !it.on).map(layer).join('');
  return `<g transform="translate(15 3) scale(1.4)"><g class="ab ab-${o.body || 'bounce'}"><path d="${BODY}" fill="${MINT}"/>${face}${onBody}</g>${free}</g>` + caption(label, capColor);
}

// v1.38: 꾸러미(고르기 창의 탭) — 첫 꾸러미가 원래 톡이 24개, 나머지 넷은 사람처럼 움직이는 톡이
//   그림은 처음 쓸 때 한 번만 만들어 둠 (앱을 켤 때 144개를 한꺼번에 그리지 않게)
const lazy = (id, label, make) => { let svg = null; return { id, label, get inner() { return svg ?? (svg = make()); } }; };
const mk = (list, cap) => list.map(([id, label, o]) => lazy(id, label, () => draw(id, label, o, cap)));
const mkFig = (list, cap) => list.map(([id, label, o]) => lazy(id, label, () => drawFig(label, o, cap)));
export const STICKER_PACKS = [
  { id: 'toki', name: '톡이', list: mk(LIST, MINT) },
  { id: 'friends', name: '친구', list: mkFig(PACK_FRIENDS, '#59C2FF') },
  { id: 'love', name: '연인', list: mkFig(PACK_LOVE, '#FF7F98') },
  { id: 'family', name: '가족', list: mkFig(PACK_FAMILY, ORANGE) },
  { id: 'work', name: '직장', list: mkFig(PACK_WORK, BLUE) },
];
export const STICKERS = STICKER_PACKS.flatMap((p) => p.list);
const BY_ID = new Map(STICKERS.map((s) => [s.id, s]));

export const stickerLabel = (id) => (BY_ID.get(id) || { label: '이모티콘' }).label;

// 이모티콘 그림 (모르는 이름이면 물음표 말풍선)
export function stickerSvg(id, size = 120) {
  const s = BY_ID.get(id);
  const inner = s ? s.inner
    : `<g transform="translate(15 3) scale(1.4)"><path d="${BODY}" fill="#E3E8EC"/>${word(32, 35, '?', 18, '#A3ABB6')}</g>`;
  return `<svg class="sticker-svg" width="${size}" height="${size}" viewBox="0 0 120 120" role="img" aria-label="${s ? s.label : '이모티콘'}" font-family="GmarketSans, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif">${inner}</svg>`;
}
