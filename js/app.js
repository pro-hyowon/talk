// =====================================================================
//  끼리톡 — 화면과 동작 (디자인: 클로드디자인 "끼리톡 UI 디자인 v1")
// =====================================================================
import { CONFIG } from './config.js';
import { SPRITE } from './icons.js';
import { STICKERS, stickerSvg } from './stickers.js';
import { qrSvg } from './qr.js';

const VERSION = '1.18.0';
const READ_LIVE_MAX = 20;   // 이 인원 이하 방은 읽음 표시를 실시간으로, 넘으면 5초마다 확인 (schema.sql 과 같은 값)
// v1.17: 앱 이름이 끼리톡으로 바뀜 — 설정 파일에 예전 이름(미니톡)이 그대로 있으면 새 이름으로 표시
const APP = !CONFIG.APP_NAME || CONFIG.APP_NAME === '\uBBF8\uB2C8\uD1A1' ? '끼리톡' : CONFIG.APP_NAME;
const CONTACT = String(CONFIG.CONTACT_EMAIL || '').trim();
const app = document.getElementById('app');
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isNum = (v) => typeof v === 'number';

// 아이콘 모음을 한 번만 문서에 넣고 <use>로 불러 씀
document.body.insertAdjacentHTML('afterbegin', `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${SPRITE}</defs></svg>`);
const ic = (name, size = 24, style = '') => `<svg width="${size}" height="${size}" aria-hidden="true"${style ? ` style="${style}"` : ''}><use href="#mt-${name}"></use></svg>`;

let api = null;
try {
  api = window.__MINITALK_API__ || (await import('./api.js')).createApi();
} catch (e) {
  console.error(e);
}

// ---------------------------------------------------------------------
// 상태
// ---------------------------------------------------------------------
const S = {
  uid: null,
  entered: false,
  me: null,
  tab: 'friends',
  friends: [],
  rooms: [],
  roomsLoaded: false,
  room: null,
  roomToken: 0,
  fromList: false,
  profiles: new Map(),
  imgUrls: new Map(),
  muted: new Map(),   // v1.15: 방 ID → 알림 꺼 둠
  fileUrls: new Map(),
  unsub: null,
  wasSubscribed: false,
  installEvt: null,
  tmpSeq: 0,
  pushOn: false,
  admin: null,
  adminFromMore: false,
  lastTouch: 0,
  pending: 0,
  suggestions: [],
  phone: undefined,
  listSeen: new Set(),   // 채팅 목록에 이미 반영한 메시지 번호
  requests: [],          // 받은 친구 요청
  blocks: new Set(),     // v1.17: 내가 차단한 회원 ID
  chatFilter: 'all',     // 채팅 목록: all / dm / group   // undefined = 아직 모름, null = 등록 안 함, { phone, findable }
};

function cacheProfile(p) {
  if (p && p.id) S.profiles.set(p.id, { ...(S.profiles.get(p.id) || {}), ...p });
}
const profileOf = (id) => S.profiles.get(id) || null;

// ---------------------------------------------------------------------
// 날짜·시간 표시
// ---------------------------------------------------------------------
const pad = (n) => String(n).padStart(2, '0');
function fmtTime(iso) {
  const d = new Date(iso);
  const h = d.getHours();
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${pad(d.getMinutes())}`;
}
const dayKey = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
const minuteKey = (iso) => { const d = new Date(iso); return `${dayKey(iso)}-${d.getHours()}-${d.getMinutes()}`; };
function fmtDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${'일월화수목금토'[d.getDay()]}요일`;
}
function fmtListTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (dayKey(iso) === dayKey(now.toISOString())) return fmtTime(iso);
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (dayKey(iso) === dayKey(y.toISOString())) return '어제';
  if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}
const fmtDay = (iso) => { if (!iso) return '-'; const d = new Date(iso); return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`; };
function fmtAgo(iso) {
  if (!iso) return '기록 없음';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = new Date(iso);
  if (h < 48) return '어제';
  return d.getFullYear() === new Date().getFullYear() ? `${d.getMonth() + 1}월 ${d.getDate()}일` : fmtDay(iso);
}

// ---------------------------------------------------------------------
// 공통 UI 조각
// ---------------------------------------------------------------------
const AV = ['#FFD9CC', '#E6DEFF', '#D3ECFF', '#FFF0B8', '#CDF3E5', '#FFD9E6'];
function avColor(id) {
  let h = 0;
  for (const c of String(id || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AV[h % AV.length];
}
function initials(name) {
  const n = String(name || '?').trim() || '?';
  if (/^[가-힣]+$/.test(n)) return n.length <= 2 ? n : n.slice(-2);
  return n.slice(0, 2).toUpperCase();
}
function av(p, size = 48) {
  const st = `width:${size}px;height:${size}px`;
  if (p && p.avatar_url) return `<span class="av" style="${st}"><img src="${esc(p.avatar_url)}" alt="" loading="lazy"></span>`;
  const fs = Math.max(10, Math.round(size * 0.3));
  return `<span class="av" style="${st};background:${avColor(p && p.id)};font-size:${fs}px">${esc(initials(p ? p.display_name : '?'))}</span>`;
}
function roomAv(r) {
  if (r.is_notice) return `<span class="av notice" style="width:52px;height:52px">${ic('mega', 26)}</span>`;
  const ms = r.members || [];
  if (!r.is_group || ms.length <= 1) return av(ms[0] || { id: r.room_id, display_name: '?' }, 52);
  const pos = ms.length >= 3 ? [[9, 0, 32], [0, 20, 32], [20, 20, 32]] : [[0, 0, 34], [18, 18, 34]];
  return `<span class="av-group">${ms.slice(0, pos.length).map((m, i) => `<span class="av-pos" style="left:${pos[i][0]}px;top:${pos[i][1]}px">${av(m, pos[i][2])}</span>`).join('')}</span>`;
}
function roomName(r, others) {
  if (r.is_notice) return `${APP} 공지사항`;
  if (r.title) return r.title;
  if (!others.length) return '대화 상대 없음';
  const names = others.map((p) => p.display_name || '(알 수 없음)').join(', ');
  const rest = (r.member_count || 0) - 1 - others.length;
  return rest > 0 ? `${names} 외 ${rest}명` : names;
}
// 휴대폰 번호 (숫자만, +82 → 0)
function normPhone(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.startsWith('8201')) d = d.slice(2); else if (d.startsWith('821')) d = '0' + d.slice(2);
  return /^01[016789]\d{7,8}$/.test(d) ? d : null;
}
const fmtPhone = (d) => (!d ? '' : d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`);
const maskPhone = (d) => (d ? `${d.slice(0, 3)}-****-${d.slice(-4)}` : '');
const PREVIEW = { 사진: '사진을 보냈어요', 이모티콘: '이모티콘을 보냈어요', 파일: '파일을 보냈어요', 연락처: '연락처를 보냈어요' };
const previewText = (t) => PREVIEW[t] || (t || '대화를 시작해 보세요').split('\n')[0];
const KIND_LABEL = { image: '사진', sticker: '이모티콘', file: '파일', contact: '연락처' };
function linkify(text) {
  return esc(text).replace(/(https?:\/\/[^\s<]+[^\s<.,!?)\]'"])/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}

// 위에서 내려오는 알림 (정보·오류·메시지)
let toastTimer = null;
function showToast(html, { onClick = null, ms = 2600, cls = '' } = {}) {
  const old = $('.toast'); if (old) old.remove();
  clearTimeout(toastTimer);
  const el = document.createElement('div');
  el.className = 'toast ' + cls;
  el.setAttribute('role', 'status');
  el.innerHTML = onClick ? `<button type="button">${html}</button>` : `<div>${html}</div>`;
  if (onClick) el.firstElementChild.addEventListener('click', () => { el.remove(); onClick(); });
  app.appendChild(el);
  toastTimer = setTimeout(() => el.remove(), ms);
}
function toast(text, { onClick = null, ms = 2600, error = false } = {}) {
  showToast(`<span class="t-ico ${error ? 'err' : ''}">${ic(error ? 'alert' : 'check', 18)}</span><span class="t-body"><span class="t-title">${esc(text)}</span></span>`,
    { onClick, ms: error ? Math.max(ms, 3600) : ms, cls: 'info' });
}
function toastMsg({ person, title, body, onClick }) {
  showToast(`${person ? av(person, 40) : `<span class="av notice" style="width:40px;height:40px">${ic('mega', 20)}</span>`}
    <span class="t-body"><span class="t-from">${ic('logo', 12)}${esc(APP)} · 지금</span><span class="t-title">${esc(title)}</span>${body ? `<span class="t-text">${esc(body)}</span>` : ''}</span>`,
  { onClick, ms: 3200, cls: 'msg' });
}
const showErr = (e) => toast(e && e.message ? e.message : '오류가 발생했어요.', { error: true });

// 아래에서 올라오는 시트
function openSheet({ title = '', body = '', bare = false, closeOnly = false, onMount }) {
  const layer = $('#layer') || app;
  const back = document.createElement('div');
  back.className = 'sheet-back';
  const head = bare ? '' : closeOnly
    ? `<div class="sheet-close-only"><button class="ibtn" data-close aria-label="닫기">${ic('x', 22)}</button></div>`
    : `<div class="sheet-head"><h3>${esc(title)}</h3><button class="ibtn" data-close aria-label="닫기">${ic('x', 22)}</button></div>`;
  back.innerHTML = `<div class="sheet-dim" data-close></div><div class="sheet" role="dialog" aria-label="${esc(title)}"><div class="handle"></div>${head}${body}</div>`;
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  back.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', onKey);
  layer.appendChild(back);
  const sheet = $('.sheet', back);
  if (onMount) onMount(sheet, close);
  return { el: sheet, close };
}
const closeAllSheets = () => $$('.sheet-back').forEach((x) => x.remove());
function onSheetGone(sheet, fn) {
  new MutationObserver((_, obs) => { if (!sheet.isConnected) { obs.disconnect(); fn(); } })
    .observe($('#layer') || app, { childList: true });
}

// 확인 팝업 (취소 / 확인)
function ask(title, message, okLabel = '확인', danger = false) {
  return new Promise((resolve) => {
    let done = false;
    openSheet({
      title, bare: true,
      body: `<div class="confirm"><h3>${esc(title)}</h3>${message ? `<p>${esc(message)}</p>` : ''}</div>
        <div class="two"><button class="btn gray" data-no>취소</button><button class="btn ${danger ? 'danger' : ''}" data-yes>${esc(okLabel)}</button></div>`,
      onMount(sheet, close) {
        $('[data-yes]', sheet).onclick = () => { done = true; close(); resolve(true); };
        $('[data-no]', sheet).onclick = () => { done = true; close(); resolve(false); };
        onSheetGone(sheet, () => { if (!done) resolve(false); });
      },
    });
  });
}

// 이미지 줄이기 (용량 절약)
async function loadBitmap(file) {
  try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch {
    return await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('사진을 읽을 수 없어요.'));
      img.src = URL.createObjectURL(file);
    });
  }
}
async function resizeImage(file, max, square = false) {
  const src = await loadBitmap(file);
  const w0 = src.width; const h0 = src.height;
  let sx = 0; let sy = 0; let sw = w0; let sh = h0;
  if (square) { const s = Math.min(w0, h0); sx = (w0 - s) / 2; sy = (h0 - s) / 2; sw = sh = s; }
  const scale = Math.min(1, max / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * scale); canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('사진 변환에 실패했어요.'))), 'image/jpeg', 0.85));
}
async function prepareChatImage(file) {
  if (!file.type.startsWith('image/')) throw new Error('사진 파일만 보낼 수 있어요.');
  if (file.type === 'image/gif') {
    if (file.size > 5 * 1024 * 1024) throw new Error('GIF는 5MB 이하만 보낼 수 있어요.');
    return { blob: file, ext: 'gif' };
  }
  return { blob: await resizeImage(file, 1600), ext: 'jpg' };
}

// ---------------------------------------------------------------------
// 앱을 닫아도 오는 알림 (Web Push)
// ---------------------------------------------------------------------
const PUSH_KEY = (CONFIG.VAPID_PUBLIC_KEY || '').trim();
function b64urlToBytes(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('알림 기능을 준비하지 못했어요. 새로고침 후 다시 시도해 주세요.')), ms))]);
const swReady = () => withTimeout(navigator.serviceWorker.ready, 10000);
const push = window.__MINITALK_PUSH__ || {
  supported: () => !!PUSH_KEY && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
  async current() { return (await swReady()).pushManager.getSubscription(); },
  async subscribe() {
    return (await swReady()).pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlToBytes(PUSH_KEY) });
  },
};
function sameServerKey(sub) {
  try {
    const k = sub.options && sub.options.applicationServerKey;
    if (!k) return true;
    const a = new Uint8Array(k); const b = b64urlToBytes(PUSH_KEY);
    return a.length === b.length && a.every((v, i) => v === b[i]);
  } catch { return true; }
}
async function enablePush({ silent = false } = {}) {
  if (!push.supported()) return false;
  if (Notification.permission !== 'granted') {
    if (silent) return false;
    if ((await Notification.requestPermission()) !== 'granted') return false;
  }
  let sub = await push.current();
  if (sub && !sameServerKey(sub)) { try { await sub.unsubscribe(); } catch { /* 무시 */ } sub = null; }
  if (!sub) sub = await push.subscribe();
  await api.savePush(sub);
  S.pushOn = true;
  return true;
}
async function disablePush() {
  const sub = await push.current();
  if (sub) {
    try { await api.deletePush(sub.endpoint); } catch (e) { console.warn(e); }
    try { await sub.unsubscribe(); } catch { /* 무시 */ }
  }
  S.pushOn = false;
}
async function detachPush() {
  if (!push.supported()) return;
  try { const sub = await push.current(); if (sub) await api.deletePush(sub.endpoint); } catch (e) { console.warn(e); }
  S.pushOn = false;
}
function notifOn() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  return push.supported() ? S.pushOn : true;
}

// ---------------------------------------------------------------------
// 시작
// ---------------------------------------------------------------------
const splashHtml = () => `<div class="splash">${ic('appicon', 96)}<div class="splash-title">${esc(APP)}</div>
  <div class="dots"><span></span><span></span><span></span></div><div class="splash-sub">대화를 불러오고 있어요</div></div>`;

async function boot() {
  document.title = APP;
  captureInviteFromUrl();
  app.innerHTML = splashHtml();
  setOffline(!navigator.onLine);
  if (!api) return renderFatal('서버 연결 모듈을 불러오지 못했어요. 인터넷 연결을 확인한 뒤 새로고침해 주세요.');
  if (!api.configured) return renderSetup();
  api.onAuthChange((id) => { if (id) enterApp(id); else leaveApp(); });
  let id = null;
  try { id = await api.getSession(); } catch (e) { console.warn(e); }
  if (id) await enterApp(id); else renderAuth();
}

function setOffline(off) {
  app.classList.toggle('offline', off);
  let bar = $('#offlineBar');
  if (off && !bar) {
    app.insertAdjacentHTML('beforeend', `<div class="offline-bar" id="offlineBar">${ic('wifioff', 18, 'flex:none')}<span style="flex:1">인터넷 연결이 끊겼어요. 다시 연결하는 중…</span><span class="spin-sm"></span></div>`);
  } else if (!off && bar) bar.remove();
}

function authShell(inner) {
  return `<div class="screen auth"><div class="scroll">
    <div class="auth-top">${ic('logo', 76)}<h1>${esc(APP)}</h1><p>친구끼리, 가볍게 대화해요</p></div>
    <div class="auth-card">${inner}</div></div></div>`;
}

// v1.17: 이용약관 · 개인정보처리방침 링크 (로그인 화면 아래)
const legalLinksHtml = () => `<div class="legal-links"><a href="./terms.html" target="_blank" rel="noopener">이용약관</a><span aria-hidden="true">·</span><a href="./privacy.html" target="_blank" rel="noopener"><b>개인정보처리방침</b></a>${CONTACT ? `<span aria-hidden="true">·</span><a href="mailto:${esc(CONTACT)}">문의</a>` : ''}</div>`;

function renderFatal(msg) {
  app.innerHTML = authShell(`<div class="setup-box">${esc(msg)}</div><button class="btn" onclick="location.reload()">새로고침</button>`);
  setOffline(!navigator.onLine);
}

function renderSetup() {
  app.innerHTML = authShell(`<div class="setup-box"><b>서버 연결 정보가 아직 입력되지 않았어요.</b>
      <ol>
        <li>Supabase 프로젝트를 만들고 <code>supabase/schema.sql</code>을 SQL Editor에서 실행합니다.</li>
        <li><code>js/config.js</code> 파일을 열어 <code>SUPABASE_URL</code>과 <code>SUPABASE_ANON_KEY</code>를 입력합니다.</li>
        <li>파일을 다시 올린 뒤 이 페이지를 새로고침합니다.</li>
      </ol>
      <p style="margin:12px 0 0;font-size:13px">자세한 순서는 설치 가이드(README.md)를 참고하세요.</p></div>`);
  setOffline(!navigator.onLine);
}

function fieldHtml(name, label, { type = 'text', ph = '', help = '', auto = '', max = '' } = {}) {
  return `<div class="field" data-field="${name}"><label for="f-${name}">${label}</label>
    <input class="input" id="f-${name}" name="${name}" type="${type}" placeholder="${esc(ph)}" ${auto ? `autocomplete="${auto}"` : ''} ${max ? `maxlength="${max}"` : ''} autocapitalize="off" spellcheck="false">
    <div class="field-err" id="err-${name}"></div>${help ? `<div class="help">${esc(help)}</div>` : ''}</div>`;
}
function setFieldErr(root, name, msg) {
  const f = $(`[data-field="${name}"]`, root); if (!f) return;
  f.classList.toggle('err', !!msg);
  const e = $(`#err-${name}`, f);
  e.innerHTML = msg ? `${ic('alert', 16, 'flex:none')}${esc(msg)}` : '';
}

function renderAuth(mode = 'login') {
  const signup = mode === 'signup';
  app.innerHTML = authShell(`
    <div class="seg"><button type="button" data-mode="login" class="${signup ? '' : 'on'}">로그인</button><button type="button" data-mode="signup" class="${signup ? 'on' : ''}">회원가입</button></div>
    <form id="authForm" novalidate style="display:flex;flex-direction:column;gap:20px">
      <div class="auth-fields">
        ${signup ? fieldHtml('displayName', '이름', { ph: '친구에게 보일 이름', max: 20 }) : ''}
        ${fieldHtml('username', '아이디', { ph: signup ? '영문 소문자·숫자' : '아이디', help: signup ? '영문 소문자·숫자·밑줄(_) 3~20자' : '', auto: 'username', max: 20 })}
        ${fieldHtml('password', '비밀번호', { type: 'password', ph: signup ? '6자 이상' : '비밀번호', auto: signup ? 'new-password' : 'current-password' })}
        ${signup ? fieldHtml('password2', '비밀번호 확인', { type: 'password', ph: '한 번 더 입력', auto: 'new-password' }) : ''}
        ${signup ? fieldHtml('phone', '휴대폰 번호 (선택)', { type: 'tel', ph: '010-1234-5678', help: '친구가 휴대폰 번호로 나를 찾을 때 쓰여요. 다른 사람에게는 보이지 않아요', auto: 'tel', max: 16 }) : ''}
      </div>
      ${signup ? `<div class="field agree-field" data-field="agree"><label class="agree"><input type="checkbox" name="agree" value="yes" id="f-agree">
        <span><a href="./terms.html" target="_blank" rel="noopener">이용약관</a>과 <a href="./privacy.html" target="_blank" rel="noopener">개인정보처리방침</a>에 동의하며, 만 14세 이상이에요 <b>(필수)</b></span></label>
        <div class="field-err" id="err-agree"></div></div>` : ''}
      <button class="btn" type="submit" id="authBtn">${signup ? '가입 신청하기' : '로그인'}</button>
    </form>
    ${signup ? `<div class="note-mint">${ic('shield', 18)}아이디는 가입 후 바꿀 수 없어요. 관리자 설정에 따라 승인 후 이용할 수 있어요.</div>`
    : '<div class="foot-note">비밀번호를 잊었다면 관리자에게 초기화를 요청하세요.</div>'}
    ${legalLinksHtml()}`);

  setOffline(!navigator.onLine);
  showInviteBanner();
  $$('.seg button').forEach((b) => (b.onclick = () => renderAuth(b.dataset.mode)));
  const form = $('#authForm');
  form.addEventListener('input', (e) => { if (e.target.name) setFieldErr(form, e.target.name, ''); });
  form.addEventListener('change', (e) => { if (e.target.name === 'agree') setFieldErr(form, 'agree', ''); });
  form.onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    const username = (f.username || '').trim().toLowerCase();
    const errs = {};
    if (signup && !(f.displayName || '').trim()) errs.displayName = '이름을 입력해 주세요';
    if (!username) errs.username = '아이디를 입력해 주세요';
    else if (!/^[a-z0-9_]{3,20}$/.test(username)) errs.username = '영문 소문자·숫자·밑줄(_) 3~20자로 입력해 주세요';
    if (!f.password) errs.password = '비밀번호를 입력해 주세요';
    else if (signup && f.password.length < 6) errs.password = '6자 이상 입력해 주세요';
    if (signup && (!f.password2 || f.password2 !== f.password)) errs.password2 = '비밀번호가 일치하지 않아요';
    const phone = signup ? (f.phone || '').trim() : '';
    if (phone && !normPhone(phone)) errs.phone = '휴대폰 번호를 정확히 입력해 주세요 (예: 010-1234-5678)';
    if (signup && f.agree !== 'yes') errs.agree = '약관에 동의해야 가입할 수 있어요';
    ['displayName', 'username', 'password', 'password2', 'phone', 'agree'].forEach((k) => setFieldErr(form, k, errs[k] || ''));
    if (Object.keys(errs).length) return;
    const btn = $('#authBtn');
    btn.disabled = true; btn.innerHTML = '<span class="spin-sm" style="width:18px;height:18px;border-width:2.5px;border-color:rgba(12,59,48,.25);border-top-color:#0C3B30"></span>';
    try {
      const id = signup
        ? await api.signUp({ username, password: f.password, displayName: f.displayName })
        : await api.signIn({ username, password: f.password });
      let phoneErr = null;
      if (phone && api.setMyPhone) {
        try { const v = await api.setMyPhone(phone, true); S.phone = { phone: v, findable: true }; } catch (pe) { phoneErr = pe; }
      }
      await enterApp(id);
      if (phoneErr) toast(`가입은 됐지만 휴대폰 번호는 저장하지 못했어요. ${phoneErr.message} (더보기에서 다시 등록할 수 있어요)`, { error: true, ms: 6000 });
    } catch (ex) {
      const msg = ex.message || '오류가 발생했어요.';
      setFieldErr(form, /아이디/.test(msg) && signup ? 'username' : 'password', msg);
      btn.disabled = false; btn.textContent = signup ? '가입 신청하기' : '로그인';
    }
  };
}

async function enterApp(id) {
  if (S.entered && S.uid === id) return;
  S.uid = id; S.entered = true;
  app.innerHTML = splashHtml();
  setOffline(!navigator.onLine);
  try {
    S.me = await api.getMyProfile();
  } catch (e) {
    S.entered = false; S.uid = null;
    renderAuth();
    showErr(e);
    return;
  }
  // v1.18: 정지 기간이 끝났으면 풀고 들어감
  if (S.me.status === 'suspended' && api.refreshMyStatus) {
    try { if ((await api.refreshMyStatus()) === 'active') S.me = await api.getMyProfile(); } catch { /* 예전 데이터베이스 */ }
  }
  if (S.me.status && S.me.status !== 'active') { renderBlocked(S.me.status); return; }
  // v1.17: 약관 동의 전에 가입한 회원은 한 번 동의를 받음 (데이터베이스가 예전 버전이면 건너뜀)
  if ('terms_agreed_at' in S.me && !S.me.terms_agreed_at && api.agreeTerms) {
    if (!(await askTerms())) return;
  }
  cacheProfile(S.me);
  buildShell();
  S.unsub = api.subscribe({ onMessage, onMemberUpdate, onStatus, onFriend, onKicked, onDeleted, onReaction, onConnected, onReport, onInquiry, onInquiryAdmin });
  await Promise.all([loadFriends(), loadRooms(), loadBlocks()]).catch(showErr);
  loadSuggestions();
  loadRequests();
  loadMyInquiries().then(() => { const b = $('#inqBadge'); if (b) b.innerHTML = inqBadgeHtml(); });   // v1.18
  route();
  handlePendingInvite();
  touchLastSeen();
  enablePush({ silent: true }).then(() => { if (S.tab === 'more' && !S.room) renderMain(); }).catch((e) => console.warn('push', e));
}

function touchLastSeen() {
  if (!api.touchLastSeen || Date.now() - S.lastTouch < 5 * 60 * 1000) return;
  S.lastTouch = Date.now();
  api.touchLastSeen().catch(() => {});
}

// 승인 대기·정지 계정 안내 화면
function renderBlocked(status) {
  const pending = status === 'pending';
  app.innerHTML = `<div class="screen blocked"><div class="center">
      <div class="big-icon ${pending ? 'lemon' : 'pink'}">${ic(pending ? 'clock' : 'ban', 44)}</div>
      <h2>${pending ? '가입 승인을 기다리고 있어요' : '이용이 정지된 계정이에요'}</h2>
      ${!pending && S.me.suspended_until ? `<p class="until">${esc(fmtDT(S.me.suspended_until))}까지 정지돼요</p>` : ''}
      <p>${pending ? `관리자가 확인한 뒤 ${esc(APP)}을 쓸 수 있어요. 승인 소식을 들으면 아래 버튼을 눌러 주세요.` : '정지 기간에는 친구 추가와 대화를 할 수 없어요. 자세한 내용은 관리자에게 문의해 주세요.'}</p>
      <div class="info-card"><div class="kv"><span>아이디</span><span>@${esc(S.me.username)}</span></div>
        <div class="kv"><span>${pending ? '신청일' : '이름'}</span><span>${pending ? fmtDay(S.me.created_at) : esc(S.me.display_name)}</span></div></div>
    </div>
    <div class="btn-col">${pending ? '<button class="btn" id="recheckBtn">승인 상태 새로고침</button><button class="btn text" id="blockedLogout">로그아웃</button><button class="btn text danger-text" id="blockedWithdraw" style="font-size:14px">가입 취소 (회원 탈퇴)</button>'
    : '<button class="btn line" id="blockedLogout" style="font-weight:700">로그아웃</button>'}</div>${legalLinksHtml()}</div>`;
  setOffline(!navigator.onLine);
  const re = $('#recheckBtn');
  if (re) re.onclick = async () => {
    re.disabled = true;
    try {
      const me = await api.getMyProfile();
      if (me.status === 'active') { S.entered = false; await enterApp(S.uid); return; }
      toast('아직 승인 대기 중이에요');
    } catch (e) { showErr(e); }
    re.disabled = false;
  };
  $('#blockedLogout').onclick = async () => { await api.signOut(); leaveApp(); };
  const wd = $('#blockedWithdraw');
  if (wd) wd.onclick = () => showWithdraw();
}

// v1.17: 약관 동의 (동의하면 true, 로그아웃하면 false)
function askTerms() {
  return new Promise((resolve) => {
    app.innerHTML = `<div class="screen blocked"><div class="center">
        <div class="big-icon mint">${ic('doc', 44)}</div>
        <h2>약관 동의가 필요해요</h2>
        <p>${esc(APP)}을 계속 이용하려면 아래 내용을 확인하고 동의해 주세요.</p>
        <div class="info-card terms-card">
          <a href="./terms.html" target="_blank" rel="noopener">이용약관 보기</a>
          <a href="./privacy.html" target="_blank" rel="noopener">개인정보처리방침 보기</a>
          <label class="agree"><input type="checkbox" id="termsChk"><span>이용약관과 개인정보처리방침에 동의하며, 만 14세 이상이에요 (필수)</span></label>
        </div>
      </div>
      <div class="btn-col"><button class="btn" id="termsOk" disabled>동의하고 계속하기</button><button class="btn text" id="termsLogout">로그아웃</button></div></div>`;
    setOffline(!navigator.onLine);
    const chk = $('#termsChk'); const okBtn = $('#termsOk');
    chk.onchange = () => { okBtn.disabled = !chk.checked; };
    okBtn.onclick = async () => {
      okBtn.disabled = true;
      try { await api.agreeTerms(); S.me.terms_agreed_at = new Date().toISOString(); app.innerHTML = splashHtml(); resolve(true); }
      catch (e) { okBtn.disabled = false; showErr(e); }
    };
    $('#termsLogout').onclick = async () => { await api.signOut(); leaveApp(); resolve(false); };
  });
}

function leaveApp() {
  if (!S.entered) return;
  if (S.unsub) { try { S.unsub(); } catch { /* 무시 */ } }
  Object.assign(S, {
    uid: null, entered: false, me: null, friends: [], rooms: [], roomsLoaded: false, room: null,
    fromList: false, unsub: null, wasSubscribed: false, tab: 'friends', pushOn: false,
    admin: null, adminFromMore: false, lastTouch: 0, pending: 0, suggestions: [], phone: undefined,
    requests: [], chatFilter: 'all', blocks: new Set(), myInq: [], inqUnread: 0, openReports: 0, openInquiries: 0,
  });
  S.profiles.clear(); S.imgUrls.clear();
  setBadge(0);
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  renderAuth();
  setOffline(!navigator.onLine);
}

function buildShell() {
  const tabs = [['friends', '친구', 'user'], ['chats', '채팅', 'chat'], ['ads', '광고', 'gift'], ['more', '더보기', 'more']];
  app.innerHTML = `
  <div id="main" class="screen main">
    <div class="top" id="mainHeader"></div>
    <div class="scroll" id="mainBody"></div>
    <nav class="tabbar">${tabs.map(([k, l, i]) => `<button data-act="tab" data-tab="${k}" aria-label="${l}"><span class="pill">${ic(i, 24)}${k === 'chats' ? '<span class="tab-badge" id="chatBadge"></span>' : k === 'friends' ? '<span class="tab-badge" id="friendBadge"></span>' : ''}</span><span class="lbl">${l}</span></button>`).join('')}</nav>
  </div>
  <div id="admin" class="screen admin" hidden></div>
  <div id="room" class="screen room" hidden></div>
  <div id="layer"></div>`;
  setOffline(!navigator.onLine);
}

// ---------------------------------------------------------------------
// 화면 이동 (주소 #/friends, #/chats, #/more, #/admin, #/room/<id>)
// ---------------------------------------------------------------------
function route() {
  if (captureInviteFromUrl() && S.entered && $('#main')) setTimeout(handlePendingInvite, 0);
  if (!S.entered || !$('#main')) return;
  const h = location.hash;
  const m = h.match(/^#\/room\/([0-9a-f-]{36})$/i);
  if (m) {
    if (!S.room || S.room.id !== m[1]) openRoom(m[1]);
    return;
  }
  if (S.room) closeRoom();
  const am = h.match(/^#\/admin(?:\/(home|members|reports|inquiries|ops))?$/);   // v1.18: 관리자 메뉴
  if (am) {
    const sec = am[1] || 'home';
    if ($('#admin').hidden || !S.admin || S.admin.sec !== sec) openAdmin(sec);
    return;
  }
  closeAdmin();
  const t = (h.match(/^#\/(friends|chats|ads|more)$/) || [])[1];
  if (t) S.tab = t;
  renderMain();
  if (S.tab === 'friends') { loadFriends().catch(() => {}); loadSuggestions(); loadRequests(); }
  if (S.tab === 'ads') loadAds();   // v1.16: 광고 탭을 열 때마다 새로 불러옴
}
window.addEventListener('hashchange', route);
function go(hash) { if (location.hash !== hash) location.hash = hash; else route(); }
function goRoom(id) { closeAllSheets(); S.fromList = !(S.room); go('#/room/' + id); }
function backFromRoom() {
  if (S.fromList) { S.fromList = false; history.back(); }
  else location.replace('#/' + (S.tab || 'chats'));
}

// ---------------------------------------------------------------------
// 데이터 불러오기
// ---------------------------------------------------------------------
async function loadFriends() {
  S.friends = await api.listFriends();
  S.friends.forEach(cacheProfile);
  if (S.tab === 'friends' && !S.room) renderMain();
}
async function loadSuggestions() {
  if (!api.listSuggestions) return;
  try {
    S.suggestions = await api.listSuggestions();
    S.suggestions.forEach((p) => cacheProfile({ id: p.id, username: p.username, display_name: p.display_name, status_message: p.status_message, avatar_url: p.avatar_url }));
  } catch (e) { console.warn('suggestions', e); S.suggestions = []; }
  if (S.tab === 'friends' && !S.room && $('#main')) renderMain();
}
async function loadRequests() {
  if (!api.listRequests) return;
  try {
    S.requests = await api.listRequests();
    S.requests.forEach((p) => cacheProfile({ id: p.id, username: p.username, display_name: p.display_name, status_message: p.status_message, avatar_url: p.avatar_url }));
  } catch (e) { console.warn('requests', e); S.requests = []; }
  updateFriendBadge();
  if (S.tab === 'friends' && !S.room && $('#main')) renderMain();
}
function updateFriendBadge() {
  const b = $('#friendBadge');
  if (b) b.innerHTML = S.requests.length ? `<span class="badge">${badgeTxt(S.requests.length)}</span>` : '';
}
async function loadPhone() {
  if (!api.getMyPhone) { S.phone = null; return; }
  try { S.phone = (await api.getMyPhone()) || null; } catch (e) { console.warn('phone', e); S.phone = null; }
}
async function loadRooms() {
  S.rooms = await api.listRooms();
  S.roomsLoaded = true;
  S.muted = new Map(S.rooms.map((r) => [r.room_id, !!r.muted]));
  // 보고 있던 단체방에서 내보내졌으면 닫기 (실시간 알림을 못 받은 경우 대비)
  if (S.room && S.room.info && S.room.info.is_group && !S.room.info.is_notice && !S.rooms.some((r) => r.room_id === S.room.id)) {
    kickedOut(S.room.id, S.room.info.title);
  }
  S.rooms.forEach((r) => (r.members || []).forEach(cacheProfile));
  updateBadges();
  if (S.tab === 'chats' && $('#main')) renderMain();
}
let roomsPromise = null;
function refreshRoomsSoon() {
  if (!roomsPromise) {
    roomsPromise = new Promise((res) => setTimeout(async () => {
      roomsPromise = null;
      try { await loadRooms(); } catch (e) { console.warn(e); }
      res();
    }, 250));
  }
  return roomsPromise;
}
const badgeTxt = (n) => (n > 99 ? '99+' : String(n));
const isMuted = (roomId) => S.muted.get(roomId) === true;
function updateBadges() {
  // 알림을 꺼 둔 방은 전체 숫자(탭·앱 아이콘)에 넣지 않음
  const total = S.rooms.reduce((s, r) => s + (isMuted(r.room_id) ? 0 : r.unread || 0), 0);
  const b = $('#chatBadge');
  if (b) b.innerHTML = total ? `<span class="badge">${badgeTxt(total)}</span>` : '';
  setBadge(total);
}
function setBadge(n) {
  document.title = n ? `(${n}) ${APP}` : APP;
  try { if (n) navigator.setAppBadge?.(n); else navigator.clearAppBadge?.(); } catch { /* 지원 안 함 */ }
}

// ---------------------------------------------------------------------
// 메인 탭 화면
// ---------------------------------------------------------------------
function renderMain() {
  const head = $('#mainHeader'); const body = $('#mainBody');
  if (!head) return;
  $$('.tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.tab === S.tab));
  $('#main').classList.toggle('gray', S.tab === 'more');
  if (S.tab === 'friends') {
    head.innerHTML = `<h1>친구</h1><button class="ibtn" data-act="add-friend" aria-label="친구 추가">${ic('userplus', 24)}</button>`;
    const me = S.me;
    body.innerHTML = `
      <button class="me-card me" data-act="profile" data-id="${esc(me.id)}">${av(me, 60)}
        <div class="meta"><div class="name">${esc(me.display_name)}</div><div class="desc">${esc(me.status_message || '상태메시지를 입력해 보세요')}</div></div>
        <span class="chip-mine">내 프로필</span></button>
      ${S.requests.length ? `<div class="sec">받은 친구 요청 ${S.requests.length}</div>${S.requests.map((g) => `
        <div class="row sug req"><button class="sug-main" data-act="profile" data-id="${esc(g.id)}">${av(g, 48)}
          <span class="meta"><span class="name">${esc(g.display_name)}</span><span class="desc">@${esc(g.username)} · 나를 친구로 추가했어요</span></span></button>
          <button class="mini-btn" data-act="req-accept" data-id="${esc(g.id)}">수락</button>
          <button class="ibtn sm" data-act="req-hide" data-id="${esc(g.id)}" aria-label="요청 숨기기">${ic('x', 18)}</button></div>`).join('')}` : ''}
      ${sugList().length ? `<div class="sec">추천 친구 ${sugList().length}</div>${sugList().map((g) => `
        <div class="row sug"><button class="sug-main" data-act="profile" data-id="${esc(g.id)}">${av(g, 48)}
          <span class="meta"><span class="name">${esc(g.display_name)}</span><span class="desc">${esc([g.contact_name ? `내 연락처: ${g.contact_name}` : '내 연락처에 있는 친구', g.added_me ? '나를 친구로 추가했어요' : ''].filter(Boolean).join(' · '))}</span></span></button>
          <button class="mini-btn" data-act="sug-add" data-id="${esc(g.id)}">추가</button>
          <button class="ibtn sm" data-act="sug-hide" data-id="${esc(g.id)}" aria-label="추천에서 숨기기">${ic('x', 18)}</button></div>`).join('')}` : ''}
      ${S.friends.length ? `<div class="sec">친구 ${S.friends.length}</div>${S.friends.map((f) => `
        <button class="row" data-act="profile" data-id="${esc(f.id)}">${av(f, 48)}
          <div class="meta"><div class="name">${esc(f.display_name)}</div>${f.mutual === false ? '<div class="desc">아직 상대방이 나를 추가하지 않았어요</div>' : f.status_message ? `<div class="desc">${esc(f.status_message)}</div>` : ''}</div></button>`).join('')}`
    : (sugList().length || S.requests.length) ? '<div class="empty-line" style="padding-top:20px">아직 친구가 없어요. 받은 요청이나 추천 친구를 추가하거나 아이디·휴대폰 번호로 찾아보세요.</div>'
    : `<div class="empty-state" style="padding-top:28px"><div class="es-icon lav">${ic('logo', 64)}</div><b>아직 친구가 없어요</b><p>친구의 아이디나 휴대폰 번호로 찾아서 추가해 보세요.</p>
        <button class="btn sm" data-act="invite">${ic('share', 20)}친구 초대하기</button></div>`}`;
  } else if (S.tab === 'chats') {
    head.innerHTML = `<h1>채팅</h1><button class="ibtn" data-act="new-chat" aria-label="새 채팅">${ic('chatplus', 24)}</button>`;
    if (!S.roomsLoaded) { body.innerHTML = '<div class="spinner"></div>'; return; }
    if (S.rooms.length) {
      let list = $('#chatList', body);
      if (!list) { body.innerHTML = '<div class="chat-filter" id="chatFilter"></div><div id="chatList"></div>'; list = $('#chatList', body); }
      const dms = S.rooms.filter((r) => !r.is_group); const groups = S.rooms.filter((r) => r.is_group && !r.is_notice);
      const unread = (arr) => arr.some((r) => r.unread && !isMuted(r.room_id));   // 알림 꺼 둔 방은 빨간 점 없음
      $('#chatFilter', body).innerHTML = [['all', '전체', S.rooms], ['dm', '1:1', dms], ['group', '단체', groups]]
        .map(([k, l, arr]) => `<button data-act="chat-filter" data-f="${k}" class="${S.chatFilter === k ? 'on' : ''}">${l}<span class="n">${arr.length}</span>${unread(arr) ? '<i class="dot"></i>' : ''}</button>`).join('');
      const shown = S.chatFilter === 'dm' ? dms : S.chatFilter === 'group' ? groups : S.rooms;
      if (shown.length) patchList(list, shown.map((r) => [r.room_id, chatRowHtml(r)]), 'cw');
      else list.innerHTML = `<div class="empty-line">${S.chatFilter === 'dm' ? '1:1 대화방이 없어요' : '단체방이 없어요'}</div>`;
      return;
    }
    body.innerHTML = `<div class="empty-state" style="padding-top:72px"><div class="es-icon sky">${ic('chat', 52)}</div><b>대화 중인 채팅방이 없어요</b><p>친구를 골라 첫 대화를 시작해 보세요.</p>
        <button class="btn sm" data-act="new-chat">${ic('chatplus', 20)}새 채팅</button></div>`;
  } else if (S.tab === 'ads') {
    renderAds(head, body);
  } else {
    renderMore(head, body);
  }
}

function chatRowHtml(r) {
  return `<button class="row chat" data-act="open-room" data-id="${esc(r.room_id)}">${roomAv(r)}
    <div class="meta"><div class="title-line">${r.is_group && !r.is_notice ? '<span class="tag-group">단체</span>' : ''}<span class="name">${esc(roomName(r, r.members || []))}</span>${r.is_group && !r.is_notice ? `<span class="cnt">${r.member_count}</span>` : ''}${isMuted(r.room_id) ? `<span class="mute-ic" aria-label="알림 꺼짐">${ic('belloff', 15)}</span>` : ''}</div>
    <div class="desc">${esc(previewText(r.last_message))}</div></div>
    <div class="side"><span class="time">${esc(fmtListTime(r.last_message_at))}</span>${r.unread ? `<span class="badge ${isMuted(r.room_id) ? 'muted' : ''}">${badgeTxt(r.unread)}</span>` : ''}</div></button>`;
}

function renderMore(head, body) {
  head.innerHTML = '<h1>더보기</h1>';
  const me = S.me;
  const on = notifOn();
  body.innerHTML = `<div class="more-body">
    <div class="card prof-card">${av(me, 64)}
      <div class="meta"><div class="name">${esc(me.display_name)}</div><div class="desc">${esc(me.status_message || '상태메시지가 없어요')}</div></div>
      <button class="edit-btn" data-act="edit-profile">${ic('pencil', 16)}편집</button></div>
    <div class="card">
      <div class="card-head">친구 추가</div>
      <button class="item" data-act="invite"><span class="tile lav">${ic('share', 19)}</span><span class="label">친구 초대 링크·QR<span class="sub">링크·QR만 보내면 바로 서로 친구가 돼요</span></span>${ic('chev', 18, 'color:#A3ABB6;flex:none')}</button>
      <button class="item" data-act="add-friend"><span class="tile sky">${ic('search', 19)}</span><span class="label">아이디·휴대폰 번호로 찾기</span>${ic('chev', 18, 'color:#A3ABB6;flex:none')}</button>
    </div>
    <div class="card">
      <div class="item" style="padding-right:8px"><span class="tile sky">${ic('user', 19)}</span><span class="label">내 아이디</span><span class="val">@${esc(me.username)}</span>
        <button class="ibtn" data-act="copy-id" aria-label="아이디 복사" style="border-radius:12px;color:var(--ink3)">${ic('copy', 18)}</button></div>
      <button class="item" data-act="phone"><span class="tile sky">${ic('phone', 19)}</span><span class="label">휴대폰 번호</span><span class="val" id="phoneVal">${S.phone === undefined ? '' : S.phone ? esc(maskPhone(S.phone.phone)) : '등록하기'}</span>${ic('chev', 18, 'color:#A3ABB6;flex:none')}</button>
      <button class="item" data-act="change-password"><span class="tile lav">${ic('lock', 19)}</span><span class="label">비밀번호 변경</span>${ic('chev', 18, 'color:#A3ABB6;flex:none')}</button>
      <div class="item"><span class="tile peach">${ic('bell', 19)}</span><span class="label">알림</span>
        <button class="switch ${on ? 'on' : ''}" data-act="notif" role="switch" aria-checked="${on}" aria-label="새 메시지 알림"></button></div>
      ${isStandalone() ? '' : `<button class="item" data-act="install"><span class="tile mint">${ic('install', 19)}</span><span class="label">홈 화면에 설치</span>${ic('chev', 18, 'color:#A3ABB6;flex:none')}</button>`}
    </div>
    <div class="card">
      <div class="card-head">고객 지원</div>
      <button class="item" data-act="blocks"><span class="tile pink">${ic('userx', 19)}</span><span class="label">차단한 사용자</span><span class="val">${S.blocks.size ? `${S.blocks.size}명` : ''}</span>${ic('chev', 18, 'color:#A3ABB6;flex:none')}</button>
      <button class="item" data-act="my-inquiries"><span class="tile sky">${ic('mail', 19)}</span><span class="label">1:1 문의<span class="sub">궁금한 점·불편한 점을 운영팀에 물어봐요</span></span><span id="inqBadge">${inqBadgeHtml()}</span>${ic('chev', 18, 'color:#A3ABB6;flex:none')}</button>
      <a class="item" href="./terms.html" target="_blank" rel="noopener"><span class="tile lav">${ic('doc', 19)}</span><span class="label">이용약관</span>${ic('chev', 18, 'color:#A3ABB6;flex:none')}</a>
      <a class="item" href="./privacy.html" target="_blank" rel="noopener"><span class="tile lav">${ic('lock', 19)}</span><span class="label"><b>개인정보처리방침</b></span>${ic('chev', 18, 'color:#A3ABB6;flex:none')}</a>
      <a class="item" href="./licenses.html" target="_blank" rel="noopener"><span class="tile lav">${ic('book', 19)}</span><span class="label">오픈소스 라이선스</span>${ic('chev', 18, 'color:#A3ABB6;flex:none')}</a>
    </div>
    ${me.is_admin ? `<button class="card item" data-act="open-admin"><span class="tile lemon">${ic('shield', 19)}</span><span class="label">관리자</span><span id="adminTodo" class="todo-chips">${adminTodoChips()}</span>${ic('chev', 18, 'color:#A3ABB6;flex:none')}</button>` : ''}
    <button class="card item danger" data-act="logout"><span class="tile pink">${ic('logout', 19)}</span><span class="label">로그아웃</span></button>
    <button class="withdraw-link" data-act="withdraw">회원 탈퇴</button>
    <div class="version">${esc(APP)} 버전 ${VERSION}</div>
  </div>`;

  if (S.phone === undefined) {
    loadPhone().then(() => {
      const v = $('#phoneVal');
      if (v) v.textContent = S.phone ? maskPhone(S.phone.phone) : '등록하기';
    });
  }
  if (me.is_admin && api.adminSettings) {
    refreshAdminBadges();
  }
}

function showEditProfile() {
  const me = S.me;
  openSheet({
    title: '프로필 편집',
    body: `<div style="display:flex;justify-content:center;padding:4px 0 20px"><div class="edit-av" id="editAv">${av(me, 96)}
        <button class="cam-btn" data-x="photo" aria-label="프로필 사진 변경">${ic('camera', 18)}</button></div></div>
      <input type="file" id="avatarInput" accept="image/*" hidden>
      <div style="text-align:center;margin:-10px 0 14px"><button class="link-btn" data-x="avdel" hidden>사진 삭제</button></div>
      <div class="auth-fields">
        <div class="field" data-field="pfName"><label for="pfName">이름</label><input class="input" id="pfName" maxlength="20" value="${esc(me.display_name)}"><div class="field-err" id="err-pfName"></div></div>
        <div class="field"><label for="pfStatus">상태메시지</label><input class="input" id="pfStatus" maxlength="60" value="${esc(me.status_message || '')}" placeholder="상태메시지를 입력하세요"><div class="counter" id="stCount">${(me.status_message || '').length}/60</div></div>
      </div>
      <button class="btn" data-x="save" style="margin-top:12px">저장</button>`,
    onMount(sheet, close) {
      const st = $('#pfStatus', sheet);
      st.oninput = () => { $('#stCount', sheet).textContent = `${st.value.length}/60`; };
      $('#pfName', sheet).oninput = () => setFieldErr(sheet, 'pfName', '');
      $('[data-x=photo]', sheet).onclick = () => $('#avatarInput', sheet).click();
      $('#avatarInput', sheet).onchange = async (e) => {
        const file = e.target.files[0]; e.target.value = '';
        if (!file) return;
        try {
          toast('프로필 사진을 올리는 중이에요');
          const blob = await resizeImage(file, 400, true);
          const url = await api.uploadAvatar(blob);
          S.me = await api.updateProfile({ avatar_url: url });
          cacheProfile(S.me);
          $('#editAv', sheet).firstElementChild.outerHTML = av(S.me, 96);
          syncAvDel();
          renderMain(); toast('프로필 사진을 바꿨어요');
          if (api.cleanupAvatars) api.cleanupAvatars(url);   // v1.17: 예전 사진 파일 지우기
        } catch (ex) { showErr(ex); }
      };
      // v1.17: 프로필 사진 삭제
      const syncAvDel = () => { const d = $('[data-x=avdel]', sheet); if (d) d.hidden = !S.me.avatar_url; };
      syncAvDel();
      $('[data-x=avdel]', sheet).onclick = async (e) => {
        e.stopPropagation();
        if (!(await ask('프로필 사진을 삭제할까요?', '기본 프로필로 바뀌고 사진 파일도 지워져요.', '삭제', true))) return;
        try {
          S.me = await api.updateProfile({ avatar_url: null });
          cacheProfile(S.me);
          $('#editAv', sheet).firstElementChild.outerHTML = av(S.me, 96);
          syncAvDel(); renderMain(); toast('프로필 사진을 삭제했어요');
          if (api.cleanupAvatars) api.cleanupAvatars(null);
        } catch (ex) { showErr(ex); }
      };
      $('[data-x=save]', sheet).onclick = async (e) => {
        e.stopPropagation();
        const name = $('#pfName', sheet).value.trim();
        if (!name) { setFieldErr(sheet, 'pfName', '이름을 입력해 주세요'); return; }
        const btn = e.currentTarget; btn.disabled = true;
        try {
          S.me = await api.updateProfile({ display_name: name, status_message: st.value.trim() });
          cacheProfile(S.me); close(); renderMain(); toast('프로필을 저장했어요');
        } catch (ex) { btn.disabled = false; showErr(ex); }
      };
    },
  });
}

const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true || document.referrer.startsWith('android-app://');
function showInstall() {
  const standalone = isStandalone();
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const steps = ios
    ? [['Safari 아래쪽 공유 버튼 누르기', 'share', '#2C6FD6'], ['‘홈 화면에 추가’ 고르기', 'addsq', '#4A5463'], ['오른쪽 위 ‘추가’ 누르기', '', '']]
    : [['크롬 오른쪽 위 메뉴(⋮) 누르기', '', ''], ['‘앱 설치’ 또는 ‘홈 화면에 추가’ 고르기', 'addsq', '#4A5463'], ['‘설치’ 누르기', '', '']];
  openSheet({
    title: '홈 화면에 설치',
    body: `<div style="display:flex;align-items:center;gap:14px;padding:4px 0 16px">${ic('appicon', 64, 'flex:none')}
        <div style="font-size:14px;color:var(--ink2);line-height:1.6">${standalone ? '이미 홈 화면에 설치되어 있어요.' : '홈 화면에 설치하면 앱처럼 바로 열고, 새 메시지 알림도 받을 수 있어요.'}</div></div>
      ${standalone ? '' : S.installEvt ? '' : `<div class="btn-col">${steps.map(([t, i, c], n) => `<div class="step"><span class="num">${n + 1}</span><span class="tx">${t}</span>${i ? ic(i, 22, `color:${c}`) : ''}</div>`).join('')}</div>`}
      <button class="btn" data-x="ok" style="margin-top:16px">${!standalone && S.installEvt ? '설치하기' : '확인했어요'}</button>`,
    onMount(sheet, close) {
      $('[data-x=ok]', sheet).onclick = async () => {
        close();
        if (!standalone && S.installEvt) {
          S.installEvt.prompt();
          try { await S.installEvt.userChoice; } catch { /* 무시 */ }
          S.installEvt = null;
        }
      };
    },
  });
}

// ---------------------------------------------------------------------
// 채팅방
// ---------------------------------------------------------------------
async function openRoom(id) {
  closeAllSheets();
  const token = ++S.roomToken;
  S.room = { id, info: null, members: [], msgs: [], hasMore: true, loadingOlder: false, atBottom: true, reacts: new Map(), refs: new Map(), replyTo: null };
  const el = $('#room');
  el.hidden = false;
  el.innerHTML = `
    <div class="bar"><button class="ibtn" data-act="room-back" aria-label="뒤로">${ic('back', 24)}</button>
      <div class="ttl" id="roomTitle"></div>
      <button class="ibtn" data-act="room-mute" id="roomMuteBtn" aria-label="이 방 알림 끄기" hidden>${ic('bell', 22)}</button>
      <button class="ibtn" data-act="room-menu" id="roomMenuBtn" aria-label="채팅방 메뉴" hidden>${ic('menu', 24)}</button></div>
    <div class="msgs-wrap"><div class="msgs" id="msgs"><div class="spinner"></div></div>
      <button class="new-pill" id="newPill" data-act="to-bottom" hidden>새 메시지${ic('down', 16)}</button>
      <div class="stk-preview" id="stkPreview" hidden></div></div>
    <div class="composer" id="composer">
      <div class="crow">
        <button class="photo-btn" data-act="attach" aria-label="사진·파일·연락처 보내기">${ic('plus', 24)}</button>
        <div class="ta-wrap"><textarea id="msgInput" rows="1" maxlength="2000" placeholder="메시지를 입력하세요" aria-label="메시지 입력"></textarea>
          <button class="emo-btn" data-act="stickers" id="emoBtn" aria-label="이모티콘" aria-expanded="false">${ic('smile', 24)}</button></div>
        <button class="send-btn" id="sendBtn" data-act="send" disabled aria-label="보내기">${ic('send', 22)}</button>
      </div>
      <div class="sticker-panel" id="stickerPanel" hidden></div>
      <input type="file" id="photoInput" accept="image/*" multiple hidden>
      <input type="file" id="cameraInput" accept="image/*" capture="environment" hidden>
      <input type="file" id="fileInput" multiple hidden>
    </div>`;
  wireComposer();

  try {
    const [info, members, msgs] = await Promise.all([api.getRoom(id), api.getMembers(id), api.getMessages(id)]);
    if (token !== S.roomToken) return;
    if (!info) { toast('대화방을 찾을 수 없어요', { error: true }); closeRoom(); location.replace('#/chats'); return; }
    S.room.info = info;
    if (info.is_notice) { setupNoticeComposer(); $('#roomMuteBtn').hidden = false; } else $('#roomMenuBtn').hidden = false;
    setMembers(members);
    S.room.msgs = msgs;
    S.room.hasMore = msgs.length >= 50;
    msgs.slice(-5).forEach((m) => { if (m.kind === 'sticker') markAnim(m); });
    renderRoomHeader();
    renderMsgs();
    scrollBottom();
    markReadSoon();
    watchReads();
    if (msgs.length) loadReactions(S.room, msgs[0].id);
  } catch (e) {
    if (token !== S.roomToken) return;
    $('#msgs').innerHTML = `<div class="empty-state"><b>불러오지 못했어요</b><p>${esc(e.message || '')}</p></div>`;
  }
}

function setupNoticeComposer() {
  const comp = $('#composer');
  if (!comp) return;
  if (S.me.is_admin) {
    $('[data-act=attach]', comp).hidden = true;
    $('[data-act=stickers]', comp).hidden = true;
    $('#msgInput').placeholder = '모든 회원에게 보낼 공지를 입력하세요';
    comp.insertAdjacentHTML('afterbegin', `<div class="hint-line">${ic('mega', 14)}관리자 공지 작성 · 모든 회원에게 전달돼요</div>`);
  } else {
    comp.outerHTML = `<div class="notice-bar">${ic('lock', 18)}공지사항은 관리자만 작성할 수 있어요</div>`;
  }
}

function closeRoom() {
  S.roomToken++;
  if (S.room) stopWatchReads(S.room);
  S.room = null;
  const el = $('#room');
  if (el) { el.hidden = true; el.innerHTML = ''; }
  closeAllSheets();
}

function setMembers(rows) {
  S.room.members = rows.map((r) => {
    if (r.profiles) cacheProfile(r.profiles);
    return { id: r.user_id, last_read_id: r.last_read_id };
  });
}
const roomOthers = () => S.room.members.filter((m) => m.id !== S.uid).map((m) => profileOf(m.id) || { id: m.id, display_name: '(알 수 없음)' });

function renderRoomHeader() {
  const info = S.room.info;
  const name = roomName(info, roomOthers());
  $('#roomTitle').innerHTML = `${info.is_notice ? `<span class="mega-dot">${ic('mega', 16)}</span>` : ''}<span class="t">${esc(name)}</span>${info.is_group && !info.is_notice ? `<span class="c">${S.room.members.length}</span>` : ''}${isMuted(S.room.id) ? `<span class="mute-ic" aria-label="알림 꺼짐">${ic('belloff', 16)}</span>` : ''}`;
  const mb = $('#roomMuteBtn');
  if (mb) { const m = isMuted(S.room.id); mb.innerHTML = ic(m ? 'belloff' : 'bell', 22); mb.setAttribute('aria-label', m ? '이 방 알림 켜기' : '이 방 알림 끄기'); mb.classList.toggle('off', m); }
}

const isNoticeRoom = () => !!(S.room && S.room.info && S.room.info.is_notice);
function unreadCount(m) {
  if (!isNum(m.id) || isNoticeRoom() || m.kind === 'deleted') return 0;
  return S.room.members.filter((mb) => mb.last_read_id < m.id).length;
}

function sameGroup(a, b) {
  return a && b && a.kind !== 'system' && b.kind !== 'system' && a.sender_id === b.sender_id && minuteKey(a.created_at) === minuteKey(b.created_at);
}

function noticeText(text) {
  const lines = String(text).split('\n');
  if (lines.length > 1 && lines[0].trim() && lines[0].length <= 40) {
    return `<div class="ntitle">${esc(lines[0])}</div>${linkify(lines.slice(1).join('\n').replace(/^\n+/, ''))}`;
  }
  return linkify(text);
}

function msgHtml(m, prev, next) {
  let out = '';
  if (!prev || dayKey(prev.created_at) !== dayKey(m.created_at)) out += `<div class="date-sep"><span>${fmtDate(m.created_at)}</span></div>`;
  if (m.kind === 'system') return out + `<div class="sys"><span>${esc(m.content)}</span></div>`;

  const notice = isNoticeRoom();
  const mine = m.sender_id === S.uid && !notice;
  const first = notice || !sameGroup(prev, m) || (prev && dayKey(prev.created_at) !== dayKey(m.created_at));
  const p = profileOf(m.sender_id);
  const hidden = !notice && !mine && m.kind !== 'deleted' && isBlocked(m.sender_id);   // v1.17: 차단한 사람의 메시지는 가림
  const content = hidden ? `<div class="bubble deleted blocked">${ic('userx', 15, 'flex:none')}차단한 사용자의 메시지예요</div>`
    : m.kind === 'image'
    ? `<button class="bubble photo" data-act="view-img" data-id="${esc(m.id)}" aria-label="사진 크게 보기"><img alt="사진" ${m.localUrl ? `src="${esc(m.localUrl)}"` : ''} data-path="${esc(m.content)}"></button>`
    : m.kind === 'deleted' ? `<div class="bubble deleted">${ic('ban', 15, 'flex:none')}삭제된 메시지예요</div>`
    : m.kind === 'sticker' ? `<button class="bubble sticker" data-act="replay-sticker" aria-label="이모티콘 다시 움직이기">${stickerSvg(m.content, 120)}</button>`
    : m.kind === 'file' ? fileBubble(m)
    : m.kind === 'contact' ? contactBubble(m)
      : `<div class="bubble">${m.reply_to && !notice ? quoteHtml(m) : ''}${notice ? noticeText(m.content) : linkify(m.content)}</div>`;
  const showMeta = !m.pending && !m.failed;
  const metaCol = showMeta ? `<div class="meta-col"><span class="unread" data-unread="${esc(m.id)}"></span><span class="tm">${fmtTime(m.created_at)}</span></div>` : '';
  const cls = `msg ${mine ? 'mine' : ''} ${first ? 'first' : ''} ${m.pending ? 'pending' : ''} ${m.failed ? 'failed' : ''}`;

  if (mine) {
    const state = m.pending ? '<span class="spin-sm" aria-label="전송 중"></span>'
      : m.failed ? `<button class="retry-btn" data-act="retry" data-id="${esc(m.id)}" aria-label="다시 보내기">${ic('retry', 14)}다시 보내기</button>` : '';
    return out + `<div class="${cls}"><div class="line">${state}${metaCol}${content}</div></div>${isNum(m.id) ? reactsHtml(m, true) : ''}`;
  }
  const head = first
    ? (notice ? `<div class="mega-av">${ic('mega', 20)}</div>` : `<button data-act="profile" data-id="${esc(m.sender_id || '')}" aria-label="프로필">${av(p || { id: m.sender_id, display_name: '?' }, 40)}</button>`)
    : '';
  const senderName = notice ? `${APP} 운영팀` : (p ? p.display_name : '(알 수 없음)');
  return out + `<div class="${cls}"><div class="avs">${head}</div>
    <div class="col">${first ? `<div class="sender">${esc(senderName)}</div>` : ''}<div class="line">${content}${metaCol}</div></div></div>${isNum(m.id) ? reactsHtml(m, false) : ''}`;
}

function renderMsgs() {
  const box = $('#msgs'); if (!box || !S.room) return;
  const ms = S.room.msgs;
  if (!ms.length) {
    box.innerHTML = `<div class="empty-state" style="padding-top:22%"><div class="es-icon lav">${ic('logo', 64)}</div><b>대화를 시작해 보세요</b><p>첫 메시지를 보내면 상대방 채팅 목록에 나타나요.</p></div>`;
    return;
  }
  S.room.byId = new Map(ms.map((m) => [String(m.id), m]));
  const items = S.room.hasMore ? [['more', '<div class="load-more">위로 올리면 이전 대화를 불러와요</div>']] : [];
  const notLast = new Set();
  for (let i = 0; i < ms.length; i++) {
    items.push([String(ms[i].id), msgHtml(ms[i], ms[i - 1], ms[i + 1])]);
    if (!isNoticeRoom() && sameGroup(ms[i], ms[i + 1])) notLast.add(String(ms[i].id));
  }
  const created = patchList(box, items);
  // 새로 그린 이모티콘 중 방금 온 것만 움직이게
  if (created.length) {
    const byId = new Map(ms.map((m) => [String(m.id), m]));
    created.forEach((el) => { const m = byId.get(el.dataset.k); if (m && m.anim) { const b = el.querySelector('.bubble.sticker'); if (b) b.classList.add('play'); } });
  }
  // 같은 사람이 같은 분에 이어 보내면 시간은 마지막 메시지에만 (표시만 바꿔서 다시 그리지 않음)
  for (const el of box.children) el.classList.toggle('nolast', notLast.has(el.dataset.k));
  updateReadCounts();   // 읽음 숫자는 그린 뒤 따로 채움 → 누가 읽어도 메시지를 다시 그리지 않음
  hydrateImages();
  hydrateFiles();
}

// 바뀐 메시지만 다시 그리기 (전체를 새로 그리면 메시지가 많을 때 화면이 버벅여요)
function patchList(box, items, cls = 'mw') {
  if (box.firstElementChild && (!box.firstElementChild.dataset.k || !box.firstElementChild.classList.contains(cls))) box.textContent = '';
  const old = new Map(); const created = [];
  for (const el of box.children) old.set(el.dataset.k, el);
  let cursor = box.firstElementChild;
  for (const [k, html] of items) {
    let el = old.get(k);
    if (el) old.delete(k);
    if (!el || el._h !== html) {
      const nel = document.createElement('div');
      nel.className = cls; nel.dataset.k = k; nel.innerHTML = html; nel._h = html;
      if (el) { if (cursor === el) cursor = nel; el.replaceWith(nel); }
      el = nel; created.push(nel);
    }
    if (el === cursor) cursor = cursor.nextElementSibling;
    else box.insertBefore(el, cursor);
  }
  old.forEach((el) => el.remove());
  return created;
}

function updateReadCounts() {
  if (!S.room) return;
  const byId = new Map(S.room.msgs.map((m) => [String(m.id), m]));
  $$('#msgs [data-unread]').forEach((el) => {
    const m = byId.get(el.dataset.unread);
    if (m) { const n = unreadCount(m); el.textContent = n || ''; }
  });
}

async function hydrateImages() {
  const imgs = $$('#msgs img[data-path]').filter((i) => !i.getAttribute('src'));
  if (!imgs.length) return;
  const now = Date.now();
  const need = [...new Set(imgs.map((i) => i.dataset.path))].filter((p) => {
    const c = S.imgUrls.get(p); return !c || now - c.t > 5 * 3600 * 1000;
  });
  if (need.length) {
    try {
      const urls = await api.imageUrls(need);
      for (const [p, u] of Object.entries(urls)) S.imgUrls.set(p, { url: u, t: now });
    } catch (e) { console.warn(e); }
  }
  imgs.forEach((img) => { const c = S.imgUrls.get(img.dataset.path); if (c && img.isConnected) img.src = c.url; });
}

function scrollBottom() {
  const box = $('#msgs'); if (!box) return;
  box.scrollTop = box.scrollHeight;
  if (S.room) S.room.atBottom = true;
  const pill = $('#newPill'); if (pill) pill.hidden = true;
}

function addMessages(list, { forceBottom = false } = {}) {
  if (!S.room || !list.length) return;
  const wasBottom = S.room.atBottom;
  const have = new Set(S.room.msgs.filter((m) => isNum(m.id)).map((m) => m.id));
  const fresh = list.filter((m) => !have.has(m.id));
  if (!fresh.length) return;
  S.room.lastActivity = Date.now();
  fresh.forEach((m) => { if (m.kind === 'sticker') markAnim(m); });
  let real = S.room.msgs.filter((m) => isNum(m.id)).concat(fresh).sort((a, b) => a.id - b.id);
  // 오래 켜 둔 방은 화면에 남는 메시지를 300개로 줄임 (위로 올리면 다시 불러옴)
  if ((forceBottom || wasBottom) && real.length > 400) { real = real.slice(-300); S.room.hasMore = true; }
  const pending = S.room.msgs.filter((m) => !isNum(m.id));
  S.room.msgs = real.concat(pending);
  if (fresh.some((m) => m.kind === 'system')) refreshMembers();
  else if (S.room.pollReads) refreshReadsSoon();
  S.room.needBottom = S.room.needBottom || forceBottom || wasBottom;
  scheduleMsgs();
}

// 메시지가 몰려 오면 0.12초씩 모아서 한 번에 그림 (한 개씩 그리면 휴대폰이 버벅여요)
function scheduleMsgs() {
  const R = S.room;
  if (!R || R.msgTimer) return;
  R.msgTimer = setTimeout(() => requestAnimationFrame(() => {
    R.msgTimer = 0;
    if (S.room !== R) return;
    renderMsgs();
    if (R.needBottom) scrollBottom();
    else { const pill = $('#newPill'); if (pill) pill.hidden = false; }
    R.needBottom = false;
  }), 120);
}

async function refreshMembers() {  // 입장·퇴장 등으로 참여자가 바뀌었을 때
  if (!S.room) return;
  const id = S.room.id;
  try {
    const [rows, info] = await Promise.all([api.getMembers(id), api.getRoom(id).catch(() => null)]);
    if (!S.room || S.room.id !== id) return;
    if (info) S.room.info = { ...S.room.info, ...info };
    setMembers(rows);
    renderRoomHeader();
    renderMsgs();
  } catch (e) { console.warn(e); }
}

async function loadOlder() {
  const R = S.room;
  if (!R || !R.hasMore || R.loadingOlder) return;
  const firstReal = R.msgs.find((m) => isNum(m.id));
  if (!firstReal) return;
  R.loadingOlder = true;
  try {
    const older = await api.getMessages(R.id, firstReal.id);
    if (S.room !== R) return;
    R.hasMore = older.length >= 50;
    const box = $('#msgs');
    const prevH = box.scrollHeight; const prevTop = box.scrollTop;
    const have = new Set(R.msgs.map((m) => m.id));
    R.msgs = older.filter((m) => !have.has(m.id)).concat(R.msgs);
    renderMsgs();
    box.scrollTop = box.scrollHeight - prevH + prevTop;
    if (older.length) loadReactions(R, older[0].id);
  } catch (e) { showErr(e); }
  finally { R.loadingOlder = false; }
}

let readTimer = null;
function markReadSoon() {
  clearTimeout(readTimer);
  readTimer = setTimeout(async () => {
    if (!S.room || document.hidden) return;
    const id = S.room.id;
    try { await api.markRead(id); } catch (e) { console.warn(e); }
    const r = S.rooms.find((x) => x.room_id === id);
    if (r && r.unread) { r.unread = 0; updateBadges(); scheduleMain(); }
  }, 600);
}

// ---------- 읽음 표시 ----------
// 작은 방: 서버가 실시간으로 알려 줌 / 큰 방(21명 이상): 5초마다 확인 (실시간 전송량 절약)
function watchReads() {
  const R = S.room; if (!R) return;
  if (api.watchRoom) R.unwatch = api.watchRoom(R.id, onMemberUpdate);
  const live = !api.realtimeMode || api.realtimeMode() !== 'broadcast';
  R.pollReads = !live && R.members.length > READ_LIVE_MAX && !(R.info && R.info.is_notice);
  if (R.pollReads) R.pollTimer = setInterval(() => { if (!document.hidden) refreshReads(); }, 5000);
  // v1.16.1: 실시간 읽음 신호가 늦거나 빠져도 '1' 이 남지 않게 — 내 메시지를 아직 안 읽은 사람이 있을 때만 확인
  //          (대화 중엔 4초마다, 1분 넘게 조용하면 20초마다)
  R.lastActivity = Date.now();
  if (!R.pollReads && !(R.info && R.info.is_notice)) {
    let tick = 0;
    R.pendTimer = setInterval(() => {
      tick++;
      if (document.hidden || S.room !== R || !myReadPending(R)) return;
      if (Date.now() - R.lastActivity > 60000 && tick % 5) return;
      refreshReads();
    }, 4000);
  }
}
function myReadPending(R) {
  for (let i = R.msgs.length - 1, n = 0; i >= 0 && n < 30; i--, n++) {
    const m = R.msgs[i];
    if (m.sender_id === S.uid && isNum(m.id) && m.kind !== 'deleted' && m.kind !== 'system' && unreadCount(m) > 0) return true;
  }
  return false;
}
function stopWatchReads(R) {
  if (R.unwatch) { try { R.unwatch(); } catch { /* 무시 */ } R.unwatch = null; }
  clearInterval(R.pollTimer); clearInterval(R.pendTimer); clearTimeout(R.readsSoon);
}
async function refreshReads() {
  const R = S.room; if (!R) return;
  try {
    const rows = await api.getMembers(R.id);
    if (S.room !== R) return;
    if (rows.length !== R.members.length) { setMembers(rows); renderRoomHeader(); renderMsgs(); return; }
    rows.forEach((r) => { if (r.profiles) cacheProfile(r.profiles); const mb = R.members.find((x) => x.id === r.user_id); if (mb) mb.last_read_id = r.last_read_id; });
    updateReadCounts();
  } catch (e) { console.warn(e); }
}
function refreshReadsSoon() {
  const R = S.room; if (!R) return;
  clearTimeout(R.readsSoon);
  R.readsSoon = setTimeout(refreshReads, 2000);
}

// ---------- 채팅 목록 ----------
// 새 메시지가 오면 서버에 다시 묻지 않고 목록을 바로 고침 (모르는 방·입장/퇴장일 때만 다시 불러옴)
function applyToList(m) {
  if (!m || m.kind === 'system') return false;
  const r = S.rooms.find((x) => x.room_id === m.room_id);
  if (!r) return false;
  if (S.listSeen.has(m.id)) return true;
  S.listSeen.add(m.id);
  if (S.listSeen.size > 3000) S.listSeen = new Set([...S.listSeen].slice(-1000));
  r.last_message = KIND_LABEL[m.kind] || String(m.content).slice(0, 100);
  r.last_message_at = m.created_at;
  const viewing = S.room && S.room.id === m.room_id && !document.hidden;
  if (m.sender_id !== S.uid && !viewing) r.unread = (r.unread || 0) + 1;
  S.rooms.sort((a, b) => Date.parse(b.last_message_at) - Date.parse(a.last_message_at));
  updateBadges();
  scheduleMain();
  return true;
}
// 메시지가 몰려 와도 목록은 0.2초에 한 번만, 바뀐 줄만 다시 그림
let mainTimer = 0; let mainLast = 0;
function scheduleMain() {
  if (mainTimer) return;
  mainTimer = setTimeout(() => requestAnimationFrame(() => {
    mainTimer = 0; mainLast = Date.now();
    if (S.tab === 'chats' && !S.room && $('#main')) renderMain();
  }), Math.max(0, 200 - (Date.now() - mainLast)));
}

// ---------- 이모티콘 움직임 (새로 온 것만 3번 움직이고 멈춤, 누르면 다시) ----------
function markAnim(m) {
  m.anim = true;
  setTimeout(() => { m.anim = false; }, 6000);
}

function wireComposer() {
  const ta = $('#msgInput'); const btn = $('#sendBtn'); const box = $('#msgs');
  const fit = () => { ta.style.height = '22px'; ta.style.height = Math.min(ta.scrollHeight, 110) + 'px'; btn.disabled = !ta.value.trim() && !(S.room && S.room.pick); };
  ta.addEventListener('input', fit);
  ta.addEventListener('focus', () => { if (matchMedia('(pointer: coarse)').matches) toggleStickers(false); });
  ta.addEventListener('keydown', (e) => {
    const touch = matchMedia('(pointer: coarse)').matches;
    if (e.key === 'Enter' && !e.shiftKey && !touch && !e.isComposing) { e.preventDefault(); sendComposer(); }
    if (e.key === 'Escape' && S.room && S.room.replyTo) { e.preventDefault(); cancelReply(); }
  });
  box.addEventListener('scroll', () => {
    if (!S.room) return;
    S.room.atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    if (S.room.atBottom) { const p = $('#newPill'); if (p) p.hidden = true; }
    if (box.scrollTop < 80) loadOlder();
  }, { passive: true });
  box.addEventListener('load', (e) => { if (e.target.tagName === 'IMG' && S.room && S.room.atBottom) box.scrollTop = box.scrollHeight; }, true);
  // 메시지 길게 누르기(휴대폰) / 오른쪽 클릭(PC) → 복사·삭제 메뉴
  let lp = null;
  const msgOf = (el) => { const w = el.closest('.mw'); return w && S.room ? S.room.msgs.find((x) => String(x.id) === w.dataset.k) : null; };
  const cancelLp = () => { if (lp) { clearTimeout(lp.t); lp = null; } };
  // 새로 누르기 시작하면 '길게 누른 뒤 클릭 무시' 표시를 지움 (안 그러면 다음 누르기가 먹힘)
  box.addEventListener('pointerdown', () => { if (S.room) S.room.suppressClick = false; }, true);
  box.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.bubble'); if (!b || e.button > 0) return;
    const m = msgOf(b); if (!m) return;
    cancelLp();
    lp = { x: e.clientX, y: e.clientY, t: setTimeout(() => { lp = null; S.room.suppressClick = true; try { navigator.vibrate?.(15); } catch { /* 없음 */ } showMsgMenu(m); }, 520) };
  });
  box.addEventListener('pointermove', (e) => { if (lp && (Math.abs(e.clientX - lp.x) > 10 || Math.abs(e.clientY - lp.y) > 10)) cancelLp(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => box.addEventListener(ev, cancelLp));
  box.addEventListener('scroll', cancelLp, { passive: true });
  box.addEventListener('contextmenu', (e) => {
    const b = e.target.closest('.bubble'); if (!b) return;
    const m = msgOf(b); if (!m) return;
    e.preventDefault(); cancelLp(); showMsgMenu(m);
  });
  wireSwipeReply(box, cancelLp, msgOf);
  // 길게 누른 뒤 손을 뗄 때 생기는 클릭(사진 열기 등)은 무시
  box.addEventListener('click', (e) => { if (S.room && S.room.suppressClick) { S.room.suppressClick = false; e.stopPropagation(); e.preventDefault(); } }, true);
  $('#photoInput').onchange = async (e) => {
    const files = [...e.target.files]; e.target.value = '';
    for (const f of files.slice(0, 10)) await sendPhoto(f);
  };
  $('#cameraInput').onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (f) await sendPhoto(f);
  };
  $('#fileInput').onchange = async (e) => {
    const files = [...e.target.files]; e.target.value = '';
    if (files.length > 10) toast('파일은 한 번에 10개까지 보낼 수 있어요');
    for (const f of files.slice(0, 10)) await sendFileMsg(f);
  };
}

async function sendText(retryMsg) {
  if (!S.room) return;
  const ta = $('#msgInput');
  const text = retryMsg ? retryMsg.content : (ta ? ta.value.trim() : '');
  if (!text) return;
  if (!retryMsg) { ta.value = ''; ta.style.height = '22px'; $('#sendBtn').disabled = true; ta.focus(); }
  const R = S.room;
  const notice = R.info && R.info.is_notice;
  const replyTo = retryMsg ? retryMsg.reply_to || null : (!notice && R.replyTo) || null;
  if (!retryMsg && R.replyTo) cancelReply();
  const tmp = retryMsg || { id: 'tmp-' + (++S.tmpSeq), room_id: R.id, sender_id: S.uid, kind: 'text', content: text, reply_to: replyTo, created_at: new Date().toISOString() };
  tmp.pending = true; tmp.failed = false;
  if (!retryMsg) R.msgs.push(tmp);
  renderMsgs(); scrollBottom();
  try {
    if (notice) {
      await api.adminBroadcast(text);
      const lastReal = [...R.msgs].reverse().find((m) => isNum(m.id));
      const fresh = await api.getMessagesAfter(R.id, lastReal ? lastReal.id : 0);
      R.msgs = R.msgs.filter((m) => m !== tmp);
      if (S.room === R) { addMessages(fresh, { forceBottom: true }); renderMsgs(); scrollBottom(); }
      return;
    }
    const real = await api.sendText(R.id, text, replyTo);
    R.msgs = R.msgs.filter((m) => m !== tmp);
    applyToList(real);
    if (S.room === R) { addMessages([real], { forceBottom: true }); renderMsgs(); scrollBottom(); }
  } catch (e) {
    tmp.pending = false; tmp.failed = true;
    if (S.room === R) renderMsgs();
    showErr(e);
  }
}

// ---------- 메시지 메뉴 (복사·삭제) ----------
let msgMenuAt = 0;
function showMsgMenu(m) {
  if (!S.room || m.kind === 'deleted' || m.kind === 'system') return;
  // 안드로이드는 길게 누르면 contextmenu 도 함께 발생 → 메뉴가 두 번 뜨지 않게
  if (Date.now() - msgMenuAt < 400 || $(".msg-menu")) return;
  msgMenuAt = Date.now();
  const R = S.room;
  const mineMsg = m.sender_id === S.uid;
  const local = !isNum(m.id);   // 아직 안 보내졌거나 실패한 메시지
  const items = [];
  const canReact = !local && !(m.sender_id !== S.uid && !isNoticeRoom() && isBlocked(m.sender_id));
  const hiddenMsg = !mineMsg && !isNoticeRoom() && isBlocked(m.sender_id);   // v1.17: 차단한 사람 메시지는 신고·차단 해제만
  if (!local && !isNoticeRoom() && $('#msgInput') && !hiddenMsg) items.push(['reply', ic('reply', 22), '답장']);
  if (m.kind === 'text' && !hiddenMsg) items.push(['copy', ic('copy', 22), '복사']);
  if (m.kind === 'contact' && contactOf(m) && !hiddenMsg) items.push(['copy', ic('copy', 22), '이름·번호 복사']);
  if (m.kind === 'file' && isNum(m.id) && !hiddenMsg) items.push(['save', ic('download', 22), '저장']);
  if (mineMsg) items.push(['delete', ic('ban', 22), local ? '보내기 취소' : '삭제']);
  const canReport = !mineMsg && !local && !isNoticeRoom() && !!m.sender_id && !!api.report;
  if (canReport) items.push(['report', ic('flag', 22), '신고']);
  if (canReport) items.push(hiddenMsg ? ['unblock', ic('userx', 22), '차단 해제'] : ['block', ic('userx', 22), '이 사람 차단']);
  if (!items.length && !canReact) return;
  const my = canReact && R.reacts && R.reacts.get(m.id) ? R.reacts.get(m.id).get(S.uid) : null;
  openSheet({
    title: '메시지', bare: true,
    body: `${canReact ? `<div class="rx-bar" role="group" aria-label="공감">${REACTS.map(([k, c, l]) => `<button class="${my === k ? 'on' : ''}" data-rx="${k}" aria-label="${l}${my === k ? ' (누르면 취소)' : ''}">${c}</button>`).join('')}</div>${reactWhoHtml(m)}` : ''}
      <div class="msg-menu">${items.map(([k, i, l]) => `<button class="menu-row ${k === 'delete' || k === 'report' || k === 'block' ? 'leave' : ''}" data-x="${k}">${i}<span>${l}</span></button>`).join('')}</div>
      <button class="btn gray" data-close style="margin-top:8px">닫기</button>`,
    onMount(sheet, close) {
      sheet.addEventListener('click', async (e) => {
        const rx = e.target.closest('[data-rx]');
        if (rx) { close(); toggleReact(m, rx.dataset.rx); return; }
        const x = e.target.closest('[data-x]'); if (!x) return;
        close();
        if (x.dataset.x === 'reply') startReply(m);
        if (x.dataset.x === 'copy') {
          const c = m.kind === 'contact' ? contactOf(m) : null;
          const text = c ? `${c.name} ${c.phones.map(fmtTel).join(', ')}` : m.content;
          try { await navigator.clipboard.writeText(text); toast(c ? '이름과 번호를 복사했어요' : '메시지를 복사했어요'); } catch { toast('복사하지 못했어요', { error: true }); }
        }
        if (x.dataset.x === 'save') openFile(m);
        if (x.dataset.x === 'report' || x.dataset.x === 'block' || x.dataset.x === 'unblock') {
          const pp = profileOf(m.sender_id); const nm = pp ? pp.display_name : '(알 수 없음)';
          if (x.dataset.x === 'report') showReport({ userId: m.sender_id, name: nm, m });
          else if (x.dataset.x === 'block') blockUser(m.sender_id, nm);
          else unblockUser(m.sender_id, nm);
          return;
        }
        if (x.dataset.x === 'delete') {
          if (local) { R.msgs = R.msgs.filter((y) => y !== m); if (S.room === R) renderMsgs(); return; }
          if (!(await ask('메시지를 삭제할까요?', '모든 대화 상대의 화면에서 "삭제된 메시지예요"로 바뀌어요. 되돌릴 수 없어요.', '삭제', true))) return;
          try {
            await api.deleteMessage(m);
            markDeleted(m.room_id, m.id);
            toast('메시지를 삭제했어요');
          } catch (ex) { showErr(ex); }
        }
      });
    },
  });
}
function markDeleted(roomId, id) {
  const R = S.room;
  if (R && R.id === roomId) {
    const m = R.msgs.find((x) => x.id === id);
    const ref = R.refs && R.refs.get(Number(id));
    let changed = false;
    for (const x of [m, ref]) if (x && x.kind !== 'deleted') { x.kind = 'deleted'; x.content = '-'; changed = true; }
    if (R.reacts && R.reacts.delete(Number(id))) changed = true;
    if (R.replyTo === id) cancelReply();
    if (changed) renderMsgs();
  }
  refreshRoomsSoon();   // 목록 미리보기 갱신
}
function onDeleted(p) { markDeleted(p.room_id, p.id); }

// ---------- 이모티콘 ----------
const RECENT_KEY = 'minitalk-recent-stickers';
function recentStickers() {
  try { const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(v) ? v.filter((id) => STICKERS.some((x) => x.id === id)).slice(0, 8) : []; }
  catch { return []; }
}
function rememberSticker(id) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...recentStickers().filter((x) => x !== id)].slice(0, 8))); } catch { /* 저장 안 됨 */ }
}
function toggleStickers(open) {
  const panel = $('#stickerPanel'); const b = $('#emoBtn');
  if (!panel) return;
  const show = open === undefined ? panel.hidden : open;
  if (show) {
    const rec = recentStickers();
    const cell = (s) => `<button class="stk" data-act="pick-sticker" data-id="${esc(s.id)}" aria-label="${esc(s.label)} 이모티콘">${stickerSvg(s.id, 76)}</button>`;
    panel.innerHTML = `${rec.length ? `<div class="stk-sec">최근 사용</div><div class="stk-grid">${rec.map((id) => cell(STICKERS.find((x) => x.id === id))).join('')}</div><div class="stk-sec">전체</div>` : ''}
      <div class="stk-grid">${STICKERS.map(cell).join('')}</div>`;
    panel.scrollTop = 0;
    const ta = $('#msgInput'); if (ta) ta.blur();
  }
  panel.hidden = !show;
  if (b) { b.classList.toggle('on', show); b.setAttribute('aria-expanded', String(show)); }
  if (show && S.room && S.room.atBottom) requestAnimationFrame(() => scrollBottom());
}

// 이모티콘을 고르면 크게 미리 보여 주고, 미리보기나 보내기 버튼을 누르면 전송
function pickSticker(id) {
  if (!S.room) return;
  S.room.pick = id;
  const pv = $('#stkPreview'); if (!pv) return;
  pv.innerHTML = `<button class="stk-big" data-act="send" aria-label="이모티콘 보내기">${stickerSvg(id, 112)}</button>
    <button class="ibtn sm stk-x" data-act="unpick-sticker" aria-label="선택 취소">${ic('x', 18)}</button>`;
  pv.hidden = false;
  $$('#stickerPanel .stk').forEach((b) => b.classList.toggle('on', b.dataset.id === id));
  $('#sendBtn').disabled = false;
}
function unpickSticker() {
  if (S.room) S.room.pick = null;
  const pv = $('#stkPreview'); if (pv) { pv.hidden = true; pv.innerHTML = ''; }
  $$('#stickerPanel .stk.on').forEach((b) => b.classList.remove('on'));
  const ta = $('#msgInput'); const b = $('#sendBtn');
  if (ta && b) b.disabled = !ta.value.trim();
}
function sendComposer() {
  if (S.room && S.room.pick) { const id = S.room.pick; unpickSticker(); sendSticker(id); }
  sendText();
}

async function sendSticker(id, retryMsg) {
  if (!S.room) return;
  const R = S.room;
  if (!retryMsg) rememberSticker(id);
  const tmp = retryMsg || { id: 'tmp-' + (++S.tmpSeq), room_id: R.id, sender_id: S.uid, kind: 'sticker', content: id, created_at: new Date().toISOString() };
  tmp.pending = true; tmp.failed = false;
  if (!retryMsg) R.msgs.push(tmp);
  renderMsgs(); scrollBottom();
  try {
    const real = await api.sendSticker(R.id, tmp.content);
    R.msgs = R.msgs.filter((m) => m !== tmp);
    applyToList(real);
    if (S.room === R) { addMessages([real], { forceBottom: true }); renderMsgs(); scrollBottom(); }
  } catch (e) {
    tmp.pending = false; tmp.failed = true;
    if (S.room === R) renderMsgs();
    showErr(e);
  }
}

async function sendPhoto(file, retryMsg) {
  if (!S.room) return;
  const R = S.room;
  let prepared;
  try { prepared = retryMsg ? retryMsg.prepared : await prepareChatImage(file); }
  catch (e) { showErr(e); return; }
  const localUrl = retryMsg ? retryMsg.localUrl : URL.createObjectURL(prepared.blob);
  const tmp = retryMsg || { id: 'tmp-' + (++S.tmpSeq), room_id: R.id, sender_id: S.uid, kind: 'image', content: '', localUrl, prepared, created_at: new Date().toISOString() };
  tmp.pending = true; tmp.failed = false;
  if (!retryMsg) R.msgs.push(tmp);
  renderMsgs(); scrollBottom();
  try {
    const real = await api.sendImage(R.id, prepared.blob, prepared.ext);
    S.imgUrls.set(real.content, { url: localUrl, t: Date.now() + 1e12 });
    R.msgs = R.msgs.filter((m) => m !== tmp);
    applyToList(real);
    if (S.room === R) { addMessages([real], { forceBottom: true }); renderMsgs(); scrollBottom(); }
  } catch (e) {
    tmp.pending = false; tmp.failed = true;
    if (S.room === R) renderMsgs();
    showErr(e);
  }
}

// ---------------------------------------------------------------------
// v1.10: 앨범·카메라·파일·연락처 보내기
// ---------------------------------------------------------------------
const FILE_MAX = 20 * 1024 * 1024;   // 파일 한 개 20MB까지 (Supabase 무료 플랜 한도 안)
const BLOCKED_EXT = /\.(exe|msi|bat|cmd|com|scr|pif|vbs|vbe|ps1|jar|apk|lnk|reg|hta|cpl|wsf|dll)$/i;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function fileOf(m) {
  try { const f = JSON.parse(m.content); return f && typeof f === 'object' && f.name ? f : null; } catch { return null; }
}
function contactOf(m) {
  try { const c = JSON.parse(m.content); return c && c.name && Array.isArray(c.phones) && c.phones.length ? c : null; } catch { return null; }
}
function fmtSize(n) {
  n = Number(n) || 0;
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))}KB`;
  return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)}MB`;
}
// 전화번호 보기 좋게 (휴대폰·서울·지역번호·대표번호)
function fmtTel(v) {
  const d = String(v || '').replace(/[^\d+]/g, '');
  const m = normPhone(d); if (m) return fmtPhone(m);
  if (/^02\d{7,8}$/.test(d)) return d.length === 9 ? `02-${d.slice(2, 5)}-${d.slice(5)}` : `02-${d.slice(2, 6)}-${d.slice(6)}`;
  if (/^0\d{9,10}$/.test(d)) return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (/^1\d{7}$/.test(d)) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return d;
}
// 저장할 때는 숫자만 (휴대폰은 010… 으로 맞춤)
const telDigits = (v) => { const d = String(v || '').replace(/[^\d+]/g, '').replace(/(?!^)\+/g, ''); return normPhone(d) || d; };
function fileKind(name) {
  const e = ((String(name).match(/\.([A-Za-z0-9]{1,5})$/) || [])[1] || '').toLowerCase();
  if (e === 'pdf') return 'pdf';
  if (/^(xls|xlsx|xlsm|csv|cell|numbers)$/.test(e)) return 'xls';
  if (/^(ppt|pptx|show|key)$/.test(e)) return 'ppt';
  if (/^(doc|docx|hwp|hwpx|txt|rtf|odt|pages|md)$/.test(e)) return 'doc';
  if (/^(zip|7z|rar|alz|egg|tar|gz)$/.test(e)) return 'zip';
  if (/^(jpg|jpeg|png|gif|webp|heic|bmp|svg)$/.test(e)) return 'img';
  if (/^(mp4|mov|avi|mkv|webm|m4v)$/.test(e)) return 'vid';
  if (/^(mp3|m4a|wav|aac|flac|ogg)$/.test(e)) return 'aud';
  return 'etc';
}

function fileBubble(m) {
  const f = fileOf(m);
  if (!f) return `<div class="bubble">${linkify(m.content)}</div>`;
  const ext = ((String(f.name).match(/\.([A-Za-z0-9]{1,5})$/) || [])[1] || '').toUpperCase();
  const sub = m.pending ? `${fmtSize(f.size)} · 보내는 중` : m.failed ? `${fmtSize(f.size)} · 보내지 못했어요` : fmtSize(f.size);
  return `<button class="bubble file" data-act="open-file" data-id="${esc(m.id)}"${f.path ? ` data-fpath="${esc(f.path)}" data-fname="${esc(f.name)}"` : ''} aria-label="${esc(f.name)} 파일 저장">
    <span class="f-ic k-${fileKind(f.name)}">${ext ? esc(ext.slice(0, 4)) : ic('file', 22)}</span>
    <span class="f-meta"><span class="f-name">${esc(f.name)}</span><span class="f-sub">${esc(sub)}</span></span>
    <span class="f-dl">${ic('download', 20)}</span></button>`;
}

function contactBubble(m) {
  const c = contactOf(m);
  if (!c) return `<div class="bubble">${linkify(m.content)}</div>`;
  const tel = telDigits(c.phones[0]);
  return `<div class="bubble contact"><div class="ct-top"><span class="ct-av">${ic('user', 24)}</span>
      <span class="ct-meta"><span class="ct-label">연락처</span><b class="ct-name">${esc(c.name)}</b>${c.phones.map((p) => `<span class="ct-tel">${esc(fmtTel(p))}</span>`).join('')}</span></div>
    <div class="ct-acts"><a href="tel:${esc(tel)}">${ic('call', 16)}전화</a><a href="sms:${esc(tel)}">${ic('chat', 16)}문자</a><button data-act="save-contact" data-id="${esc(m.id)}">${ic('download', 16)}저장</button></div></div>`;
}

// 화면에 보이는 파일은 내려받기 주소를 미리 받아 둠 (누르자마자 열리게 — 아이폰은 기다리면 새 창이 막힘)
function hydrateFiles() {
  if (!S.room) return;
  const now = Date.now();
  const els = $$('#msgs [data-fpath]');
  const seen = new Set();
  for (const el of els.slice(-20)) {
    const p = el.dataset.fpath;
    if (seen.has(p)) continue; seen.add(p);
    const c = S.fileUrls.get(p);
    if (c && (c.loading || now - c.t < 5 * 3600 * 1000)) continue;
    S.fileUrls.set(p, { loading: true, t: 0 });
    api.fileUrl(p, el.dataset.fname).then((url) => S.fileUrls.set(p, { url, t: Date.now() })).catch(() => S.fileUrls.delete(p));
  }
}

async function openFile(m) {
  const f = fileOf(m);
  if (!f || !f.path || !isNum(m.id)) return;
  let c = S.fileUrls.get(f.path);
  if (!c || !c.url || Date.now() - c.t > 5 * 3600 * 1000) {
    try { c = { url: await api.fileUrl(f.path, f.name), t: Date.now() }; S.fileUrls.set(f.path, c); }
    catch (e) { showErr(e); return; }
  }
  const a = document.createElement('a');
  a.href = c.url; a.rel = 'noopener'; a.download = f.name;
  if (isIOS()) a.target = '_blank';
  document.body.appendChild(a); a.click(); a.remove();
  toast(`‘${f.name}’ 파일을 내려받고 있어요`);
}

// 연락처 카드 → 휴대폰 연락처에 저장 (.vcf 파일을 열면 연락처 앱이 저장해 줌)
function saveContact(m) {
  const c = contactOf(m); if (!c) return;
  const v = (s) => String(s).replace(/\\/g, '\\\\').replace(/[,;]/g, (x) => '\\' + x).replace(/\r?\n/g, ' ');
  const vcf = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${v(c.name)}`, `N:${v(c.name)};;;;`,
    ...c.phones.map((p) => `TEL;TYPE=${normPhone(telDigits(p)) ? 'CELL' : 'VOICE'}:${fmtTel(p)}`), 'END:VCARD'].join('\r\n');
  const url = URL.createObjectURL(new Blob([vcf + '\r\n'], { type: 'text/vcard;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = `${String(c.name).replace(/[\\/:*?"<>|]/g, '_').slice(0, 40) || 'contact'}.vcf`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  toast('연락처 파일을 저장했어요. 파일을 열면 휴대폰 연락처에 추가할 수 있어요', { ms: 4000 });
}

function showAttach() {
  if (!S.room) return;
  toggleStickers(false);
  const ta = $('#msgInput'); if (ta) ta.blur();
  openSheet({
    title: '보내기', bare: true,
    body: `<div class="attach-grid">
        <button data-x="album"><span class="tile lav">${ic('image', 26)}</span>앨범</button>
        <button data-x="camera"><span class="tile mint">${ic('camera', 26)}</span>카메라</button>
        <button data-x="file"><span class="tile sky">${ic('file', 26)}</span>파일</button>
        <button data-x="contact"><span class="tile lemon">${ic('card', 26)}</span>연락처</button></div>
      <div class="attach-note">사진은 자동으로 용량을 줄여 보내요 · 파일은 한 개 20MB까지</div>
      <button class="btn gray" data-close style="margin-top:12px">닫기</button>`,
    onMount(sheet, close) {
      sheet.addEventListener('click', (e) => {
        const x = e.target.closest('[data-x]'); if (!x) return;
        close();
        // 같은 누르기 안에서 바로 열어야 휴대폰이 사진첩·카메라를 열어 줌
        if (x.dataset.x === 'album') $('#photoInput').click();
        if (x.dataset.x === 'camera') $('#cameraInput').click();
        if (x.dataset.x === 'file') $('#fileInput').click();
        if (x.dataset.x === 'contact') showContactSend();
      });
    },
  });
}

function showContactSend() {
  if (!S.room) return;
  const R = S.room;
  const picker = pickerSupported();
  openSheet({
    title: '연락처 보내기',
    body: `<div class="sub-text">이름과 전화번호를 카드로 보내요. 받은 사람은 바로 전화하거나 연락처에 저장할 수 있어요.</div>
      ${picker ? `<button class="btn soft" type="button" data-x="pick" style="margin-bottom:6px">${ic('book', 20)}휴대폰 연락처에서 고르기</button>` : ''}
      <form id="ctForm" novalidate><div class="auth-fields">${fieldHtml('ctname', '이름', { ph: '홍길동', max: 60 })}${fieldHtml('cttel', '전화번호', { type: 'tel', ph: '010-1234-5678', auto: 'off', max: 24 })}</div>
        <div id="ctMore" class="ct-more"></div>
        <button class="btn" type="submit" style="margin-top:18px">${ic('send', 20)}보내기</button></form>`,
    onMount(sheet, close) {
      const form = $('#ctForm', sheet); const name = $('#f-ctname', sheet); const tel = $('#f-cttel', sheet); const more = $('#ctMore', sheet);
      name.autocapitalize = 'words';
      name.oninput = () => setFieldErr(sheet, 'ctname', '');
      tel.oninput = () => setFieldErr(sheet, 'cttel', '');
      if (!picker) setTimeout(() => name.focus(), 50);
      sheet.addEventListener('click', async (e) => {
        const chip = e.target.closest('[data-tel]');
        if (chip) { tel.value = chip.dataset.tel; setFieldErr(sheet, 'cttel', ''); $$('[data-tel]', more).forEach((b) => b.classList.toggle('on', b === chip)); return; }
        const x = e.target.closest('[data-x=pick]'); if (!x) return;
        try {
          const sel = await navigator.contacts.select(['name', 'tel'], { multiple: false });
          const c = sel && sel[0]; if (!c) return;
          const nm = String((Array.isArray(c.name) ? c.name.find((n) => String(n || '').trim()) : c.name) || '').trim();
          const tels = [...new Set((c.tel || []).map(telDigits).filter((d) => /^\+?\d{3,20}$/.test(d)))];
          if (!tels.length) { toast('그 연락처에는 전화번호가 없어요', { error: true }); return; }
          tels.sort((a, b) => (normPhone(b) ? 1 : 0) - (normPhone(a) ? 1 : 0));   // 휴대폰 번호 먼저
          name.value = nm.slice(0, 60); tel.value = fmtTel(tels[0]);
          setFieldErr(sheet, 'ctname', ''); setFieldErr(sheet, 'cttel', '');
          more.innerHTML = tels.length > 1 ? `<span class="lbl">다른 번호</span>${tels.slice(0, 5).map((t, i) => `<button type="button" class="chip-tel ${i ? '' : 'on'}" data-tel="${esc(fmtTel(t))}">${esc(fmtTel(t))}</button>`).join('')}` : '';
        } catch (ex) { if (!ex || ex.name !== 'AbortError') showErr(ex); }
      });
      form.onsubmit = (e) => {
        e.preventDefault();
        const nm = name.value.trim(); const d = telDigits(tel.value);
        let bad = false;
        if (!nm) { setFieldErr(sheet, 'ctname', '이름을 입력해 주세요'); bad = true; }
        if (!tel.value.trim()) { setFieldErr(sheet, 'cttel', '전화번호를 입력해 주세요'); bad = true; }
        else if (!/^\+?\d{3,20}$/.test(d)) { setFieldErr(sheet, 'cttel', '전화번호를 정확히 입력해 주세요 (예: 010-1234-5678)'); bad = true; }
        if (bad) return;
        close();
        if (S.room !== R) return;
        sendContactMsg({ name: nm.slice(0, 60), phones: [d] });
      };
    },
  });
}

async function sendFileMsg(file, retryMsg) {
  if (!S.room) return;
  const R = S.room;
  if (!retryMsg) {
    if (!file.size) { toast(`‘${file.name}’ 은(는) 빈 파일이라 보낼 수 없어요`, { error: true }); return; }
    if (file.size > FILE_MAX) { toast(`‘${file.name}’ 파일이 너무 커요. 20MB까지 보낼 수 있어요`, { error: true }); return; }
    if (BLOCKED_EXT.test(file.name || '')) { toast('보안을 위해 실행 파일(.exe·.apk 등)은 보낼 수 없어요', { error: true }); return; }
  }
  const tmp = retryMsg || { id: 'tmp-' + (++S.tmpSeq), room_id: R.id, sender_id: S.uid, kind: 'file', file,
    content: JSON.stringify({ name: String(file.name || '파일').slice(0, 200), size: file.size, type: file.type || '' }), created_at: new Date().toISOString() };
  tmp.pending = true; tmp.failed = false;
  if (!retryMsg) R.msgs.push(tmp);
  renderMsgs(); scrollBottom();
  try {
    const real = await api.sendFile(R.id, tmp.file);
    R.msgs = R.msgs.filter((m) => m !== tmp);
    applyToList(real);
    if (S.room === R) { addMessages([real], { forceBottom: true }); renderMsgs(); scrollBottom(); }
  } catch (e) {
    tmp.pending = false; tmp.failed = true;
    if (S.room === R) renderMsgs();
    showErr(e);
  }
}

async function sendContactMsg(c, retryMsg) {
  if (!S.room) return;
  const R = S.room;
  const tmp = retryMsg || { id: 'tmp-' + (++S.tmpSeq), room_id: R.id, sender_id: S.uid, kind: 'contact', content: JSON.stringify(c), created_at: new Date().toISOString() };
  tmp.pending = true; tmp.failed = false;
  if (!retryMsg) R.msgs.push(tmp);
  renderMsgs(); scrollBottom();
  try {
    const real = await api.sendContact(R.id, contactOf(tmp));
    R.msgs = R.msgs.filter((m) => m !== tmp);
    applyToList(real);
    if (S.room === R) { addMessages([real], { forceBottom: true }); renderMsgs(); scrollBottom(); }
  } catch (e) {
    tmp.pending = false; tmp.failed = true;
    if (S.room === R) renderMsgs();
    showErr(e);
  }
}

// ---------------------------------------------------------------------
// v1.16: 광고 탭 — 관리자가 등록한 이미지를 누르면 광고 링크로 이동
// ---------------------------------------------------------------------
const safeLink = (u) => (/^https?:\/\/\S+$/i.test(String(u || '')) ? String(u) : null);
const linkHost = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

async function loadAds() {
  try { S.ads = await api.listAds(); S.adsError = null; }
  catch (e) { S.adsError = e.message || '불러오지 못했어요'; S.ads = S.ads || []; }
  S.adsLoaded = true;
  if (S.tab === 'ads' && !S.room && $('#main')) renderMain();
}

function renderAds(head, body) {
  head.innerHTML = `<h1>광고</h1>`;
  if (!S.adsLoaded) { body.innerHTML = '<div class="spinner"></div>'; return; }
  const ads = S.ads || [];
  if (S.adsError && !ads.length) {
    body.innerHTML = `<div class="empty-state" style="padding-top:28px"><b>광고를 불러오지 못했어요</b><p>${esc(S.adsError)}</p><button class="btn sm" data-act="ads-reload">다시 불러오기</button></div>`;
    return;
  }
  if (!ads.length) {
    body.innerHTML = `<div class="empty-state" style="padding-top:28px"><div class="es-icon lav">${ic('gift', 56)}</div><b>아직 광고가 없어요</b><p>${S.me.is_admin ? '더보기 → 관리자 → 운영 → 광고 관리에서 광고를 등록해 보세요.' : '새 소식이 생기면 여기에 보여 드릴게요.'}</p></div>`;
    return;
  }
  body.innerHTML = `<div class="ads-body">${ads.map((a) => `<button class="ad-card" data-act="open-ad" data-id="${esc(a.id)}" aria-label="${esc(a.title || '광고')} 열기">
      <span class="ad-img"><img src="${esc(api.adImageUrl(a.image_path))}" alt="${esc(a.title || '광고')}" loading="lazy"><span class="ad-badge">AD</span></span>
      ${a.title ? `<span class="ad-meta"><b>${esc(a.title)}</b></span>` : ''}</button>`).join('')}</div>`;
}

function openAd(id) {
  const a = (S.ads || []).find((x) => String(x.id) === String(id));
  const url = a && safeLink(a.link_url);
  if (!url) { toast('열 수 없는 링크예요', { error: true }); return; }
  api.adClick(a.id);
  const w = window.open(url, '_blank', 'noopener');
  if (!w) location.href = url;   // 새 창이 막혔으면 이 화면에서 열기
}

// ---------- 관리자: 광고 관리 ----------
async function showAdsAdmin() {
  let list = [];
  try { list = await api.adminListAds(); } catch (e) { showErr(e); return; }
  const row = (a, i) => `<div class="ad-row ${a.active ? '' : 'off'}">
      <button class="ad-thumb" data-x="edit" data-id="${esc(a.id)}" aria-label="광고 고치기"><img src="${esc(api.adImageUrl(a.image_path))}" alt=""></button>
      <button class="ad-info" data-x="edit" data-id="${esc(a.id)}"><b>${esc(a.title || '(제목 없음)')}</b><span>${esc(linkHost(a.link_url))}</span>
        <span class="ad-stat"><span class="ad-clicks">클릭 ${Number(a.clicks || 0).toLocaleString()}회</span>${a.active ? '표시 중' : '숨김'}</span></button>
      <span class="ad-ord"><button class="ibtn sm" data-x="up" data-id="${esc(a.id)}" aria-label="위로" ${i === 0 ? 'disabled' : ''}>${ic('down', 18, 'transform:rotate(180deg)')}</button>
        <button class="ibtn sm" data-x="down" data-id="${esc(a.id)}" aria-label="아래로" ${i === list.length - 1 ? 'disabled' : ''}>${ic('down', 18)}</button></span></div>`;
  openSheet({
    title: '광고 관리',
    body: `<div class="sub-text">광고 탭에 위에서부터 이 순서대로 보여요. 이미지를 누르면 수정할 수 있어요.</div>
      ${list.length ? `<div class="ad-total">전체 광고 클릭 <b>${list.reduce((t, a) => t + Number(a.clicks || 0), 0).toLocaleString()}회</b> · 광고 ${list.length}개</div>` : ''}
      <div class="ad-list" id="adList">${list.length ? list.map(row).join('') : '<div class="empty-line">아직 등록된 광고가 없어요</div>'}</div>
      <button class="btn" data-x="add" style="margin-top:14px">${ic('plus', 20)}광고 추가</button>`,
    onMount(sheet, close) {
      sheet.addEventListener('click', async (e) => {
        const x = e.target.closest('[data-x]'); if (!x || x.disabled) return;
        const ad = list.find((a) => String(a.id) === x.dataset.id);
        if (x.dataset.x === 'add') { close(); showAdForm(null); }
        if (x.dataset.x === 'edit' && ad) { close(); showAdForm(ad); }
        if ((x.dataset.x === 'up' || x.dataset.x === 'down') && ad) {
          x.disabled = true;
          try { await api.adminMoveAd(ad.id, x.dataset.x === 'up' ? -1 : 1); list = await api.adminListAds(); $('#adList', sheet).innerHTML = list.map(row).join(''); loadAds(); }
          catch (ex) { x.disabled = false; showErr(ex); }
        }
      });
    },
  });
}

function showAdForm(ad) {
  let file = null; let previewUrl = null; let active = ad ? !!ad.active : true;
  openSheet({
    title: ad ? '광고 수정' : '광고 추가',
    body: `${ad ? `<div class="ad-total" style="margin-bottom:10px">이 광고 클릭 <b>${Number(ad.clicks || 0).toLocaleString()}회</b></div>` : ''}<button class="ad-pick ${ad ? 'has' : ''}" data-x="pick" id="adPick">${ad ? `<img src="${esc(api.adImageUrl(ad.image_path))}" alt="">` : ''}
        <span class="ad-pick-hint">${ic('image', 26)}<b>${ad ? '이미지 바꾸기' : '광고 이미지 고르기'}</b><span>가로로 긴 이미지 추천 (예: 1200×600) · 5MB 이하</span></span></button>
      <input type="file" id="adFile" accept="image/jpeg,image/png,image/webp,image/gif" hidden>
      <div class="field-err" id="err-adimg" style="margin-top:6px"></div>
      <div class="auth-fields" style="margin-top:12px">${fieldHtml('adlink', '링크 주소', { type: 'url', ph: 'https://', max: 2000 })}${fieldHtml('adtitle', '제목 (선택)', { ph: '예: 가을 맞이 할인 이벤트', max: 60, help: '이미지 아래에 작게 보여요' })}</div>
      <div class="card-line"><span class="label">광고 탭에 보이기<span class="sub">끄면 회원에게 보이지 않아요 (삭제되지는 않아요)</span></span>
        <button class="switch ${active ? 'on' : ''}" data-x="active" role="switch" aria-checked="${active}" aria-label="광고 탭에 보이기"></button></div>
      <button class="btn" data-x="save" style="margin-top:18px">${ad ? '저장' : '등록하기'}</button>
      ${ad ? '<button class="btn text danger-text" data-x="delete" style="margin-top:4px">광고 삭제</button>' : ''}`,
    onMount(sheet, close) {
      const link = $('#f-adlink', sheet); const title = $('#f-adtitle', sheet); const pick = $('#adPick', sheet);
      if (ad) { link.value = ad.link_url; title.value = ad.title || ''; }
      link.oninput = () => setFieldErr(sheet, 'adlink', '');
      onSheetGone(sheet, () => { if (previewUrl) URL.revokeObjectURL(previewUrl); });
      $('#adFile', sheet).onchange = (e) => {
        const f = e.target.files[0]; e.target.value = '';
        if (!f) return;
        if (!/^image\/(jpeg|png|webp|gif)$/.test(f.type)) { $('#err-adimg', sheet).innerHTML = `${ic('alert', 16, 'flex:none')}JPG·PNG·WEBP·GIF 이미지만 쓸 수 있어요`; return; }
        file = f; $('#err-adimg', sheet).innerHTML = '';
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = URL.createObjectURL(f);
        pick.classList.add('has');
        const img = $('img', pick);
        if (img) img.src = previewUrl; else pick.insertAdjacentHTML('afterbegin', `<img src="${previewUrl}" alt="">`);
      };
      sheet.addEventListener('click', async (e) => {
        const x = e.target.closest('[data-x]'); if (!x || x.disabled) return;
        if (x.dataset.x === 'pick') $('#adFile', sheet).click();
        if (x.dataset.x === 'active') { active = !active; x.classList.toggle('on', active); x.setAttribute('aria-checked', String(active)); }
        if (x.dataset.x === 'delete') {
          close();
          if (!(await ask('이 광고를 삭제할까요?', '광고 탭에서 사라지고 이미지도 지워져요. 되돌릴 수 없어요.', '삭제', true))) { showAdForm(ad); return; }
          try { await api.adminDeleteAd(ad.id); toast('광고를 삭제했어요'); loadAds(); showAdsAdmin(); } catch (ex) { showErr(ex); }
        }
        if (x.dataset.x === 'save') {
          let url = link.value.trim();
          if (url && !/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url;   // 주소만 적었으면 https:// 붙이기
          let bad = false;
          if (!ad && !file) { $('#err-adimg', sheet).innerHTML = `${ic('alert', 16, 'flex:none')}광고 이미지를 골라 주세요`; bad = true; }
          if (!url) { setFieldErr(sheet, 'adlink', '링크 주소를 입력해 주세요'); bad = true; }
          else if (!safeLink(url)) { setFieldErr(sheet, 'adlink', 'http:// 또는 https:// 로 시작하는 주소를 입력해 주세요'); bad = true; }
          if (bad) return;
          x.disabled = true; x.innerHTML = '<span class="spin-sm"></span>';
          let newPath = null;
          try {
            if (file) {
              const prepared = file.type === 'image/gif' || file.size <= 1.5 * 1024 * 1024 ? { blob: file, ext: file.type.split('/')[1].replace('jpeg', 'jpg') } : await prepareChatImage(file);
              newPath = await api.uploadAdImage(prepared.blob, prepared.ext);
            }
            await api.adminSaveAd({ id: ad ? ad.id : null, title: title.value.trim(), link: url, image: newPath, active });
            if (ad && newPath && ad.image_path !== newPath) api.removeAdImage(ad.image_path);
            close(); toast(ad ? '광고를 저장했어요' : '광고를 등록했어요');
            loadAds(); showAdsAdmin();
          } catch (ex) {
            if (newPath) api.removeAdImage(newPath);
            x.disabled = false; x.textContent = ad ? '저장' : '등록하기'; showErr(ex);
          }
        }
      });
    },
  });
}

// ---------------------------------------------------------------------
// v1.17: 차단 · 신고 · 회원 탈퇴 · 고객 지원 (스토어 등록 필수 기능)
// ---------------------------------------------------------------------
const isBlocked = (id) => !!id && S.blocks.has(id);
async function loadBlocks() {
  if (!api.myBlocks) return;
  try { S.blocks = new Set((await api.myBlocks()).map((b) => b.id)); }
  catch (e) { console.warn('blocks', e); }   // 데이터베이스가 예전 버전이면 차단 없이
}
function blockedChanged() {
  if (S.room) renderMsgs();
  refreshRoomsSoon();
  if (!S.room) renderMain();
}
async function blockUser(id, name) {
  if (!(await ask(`${name}님을 차단할까요?`, '친구에서 빠지고 1:1 대화·친구 요청·알림이 오지 않아요. 단체방에서는 이 사람의 메시지가 가려져요. 상대에게는 알리지 않아요.', '차단', true))) return false;
  try {
    await api.blockUser(id);
    S.blocks.add(id);
    await loadFriends().catch(() => {});
    S.requests = S.requests.filter((x) => x.id !== id); updateFriendBadge();
    blockedChanged();
    toast(`${name}님을 차단했어요`);
    return true;
  } catch (e) { showErr(e); return false; }
}
async function unblockUser(id, name) {
  try {
    await api.unblockUser(id);
    S.blocks.delete(id);
    blockedChanged();
    toast(`${name}님의 차단을 풀었어요. 대화하려면 친구로 다시 추가해 주세요`);
    return true;
  } catch (e) { showErr(e); return false; }
}

const REPORT_REASONS = [['spam', '스팸·광고'], ['abuse', '욕설·비방·괴롭힘'], ['sexual', '음란하거나 성적인 내용'], ['illegal', '불법 정보 (사기·도박·불법 거래 등)'], ['other', '기타']];
// 신고하기 (m: 메시지 신고, 없으면 사람 신고)
function showReport({ userId, name, m = null }) {
  openSheet({
    title: m ? '메시지 신고' : `${name}님 신고`,
    body: `<p class="sheet-desc">${m ? '이 메시지를' : '이 회원을'} 신고하는 이유를 골라 주세요. 운영자가 확인하고 조치해요. 신고한 사실은 상대에게 알리지 않아요.</p>
      <div class="reason-list" role="radiogroup" aria-label="신고 사유">${REPORT_REASONS.map(([k, l]) => `<label class="reason"><input type="radio" name="reason" value="${k}"><span>${l}</span></label>`).join('')}</div>
      <div class="field-err" id="err-reason"></div>
      <textarea class="input" id="repDetail" maxlength="300" rows="3" placeholder="자세한 내용 (선택)"></textarea>
      ${isBlocked(userId) ? '' : `<label class="agree" style="margin-top:12px"><input type="checkbox" id="repBlock"><span>${esc(name)}님 차단하기</span></label>`}
      <button class="btn danger" data-x="send" style="margin-top:16px">${ic('flag', 18)}신고하기</button>`,
    onMount(sheet, close) {
      sheet.addEventListener('change', () => { const e = $('#err-reason', sheet); if (e) e.innerHTML = ''; });
      sheet.addEventListener('click', async (e) => {
        const x = e.target.closest('[data-x="send"]'); if (!x) return;
        const r = $('input[name=reason]:checked', sheet);
        if (!r) { $('#err-reason', sheet).innerHTML = `${ic('alert', 16, 'flex:none')}신고 사유를 골라 주세요`; return; }
        const alsoBlock = $('#repBlock', sheet) && $('#repBlock', sheet).checked;
        x.disabled = true;
        try {
          await api.report({ target: m ? null : userId, message: m ? m.id : null, reason: r.value, detail: $('#repDetail', sheet).value.trim() });
          close();
          if (alsoBlock) {
            await api.blockUser(userId); S.blocks.add(userId);
            await loadFriends().catch(() => {});
            blockedChanged();
            toast(`신고하고 ${name}님을 차단했어요. 운영자가 확인 후 조치할게요`);
          } else toast('신고했어요. 운영자가 확인 후 조치할게요');
        } catch (ex) { x.disabled = false; showErr(ex); }
      });
    },
  });
}

// 차단한 사용자 목록
async function showBlocks() {
  let rows = [];
  try { rows = await api.myBlocks(); } catch (e) { showErr(e); return; }
  S.blocks = new Set(rows.map((b) => b.id));
  openSheet({
    title: '차단한 사용자',
    body: `<p class="sheet-desc">차단을 풀어도 친구로 다시 추가되지는 않아요.</p>
      <div class="block-list">${rows.length ? rows.map((b) => `<div class="mrow" data-id="${esc(b.id)}">${av(b, 40)}
        <div class="meta"><span class="name">${esc(b.display_name)}</span><span class="desc">@${esc(b.username)} · ${fmtDay(b.blocked_at)} 차단</span></div>
        <button class="btn line sm" data-x="unblock" data-id="${esc(b.id)}">차단 해제</button></div>`).join('')
    : '<div class="empty-line">차단한 사용자가 없어요</div>'}</div>`,
    onMount(sheet) {
      sheet.addEventListener('click', async (e) => {
        const x = e.target.closest('[data-x="unblock"]'); if (!x) return;
        const b = rows.find((r) => r.id === x.dataset.id);
        x.disabled = true;
        if (await unblockUser(b.id, b.display_name)) {
          x.closest('.mrow').remove();
          if (!$('.block-list .mrow', sheet)) $('.block-list', sheet).innerHTML = '<div class="empty-line">차단한 사용자가 없어요</div>';
        } else x.disabled = false;
      });
    },
  });
}

// 문의하기
function contactSupport() {
  if (!CONTACT) { toast('운영자가 문의 이메일을 아직 등록하지 않았어요', { error: true }); return; }
  const subject = encodeURIComponent(`[${APP}] 문의`);
  const body = encodeURIComponent(`\n\n----\n아이디: @${S.me ? S.me.username : ''}\n앱 버전: ${VERSION}`);
  location.href = `mailto:${CONTACT}?subject=${subject}&body=${body}`;
}

// 회원 탈퇴
function showWithdraw() {
  openSheet({
    title: '회원 탈퇴',
    body: `<div class="withdraw-info">
        <p><b>탈퇴하면 바로 지워져요</b></p>
        <ul><li>계정, 프로필(이름·사진·상태메시지), 휴대폰 번호</li><li>친구 목록, 차단 목록, 대화방 참여 정보</li><li>알림 설정, 초대 링크</li></ul>
        <p>이미 보낸 메시지는 상대방 대화방에 <b>"(알 수 없음)"</b>으로 남아요. 아래를 선택하면 내가 보낸 메시지·사진·파일도 모두 지워요.</p>
      </div>
      <label class="agree"><input type="checkbox" id="wdWipe"><span>내가 보낸 메시지·사진·파일도 모두 삭제</span></label>
      <div class="field" data-field="wd" style="margin-top:14px"><label for="wdConfirm">확인을 위해 <b>탈퇴</b> 라고 입력해 주세요</label>
        <input class="input" id="wdConfirm" placeholder="탈퇴" autocomplete="off"><div class="field-err" id="err-wd"></div></div>
      <button class="btn danger" data-x="go" style="margin-top:16px" disabled>탈퇴하기</button>
      <p class="foot-note" style="margin-top:12px">탈퇴는 되돌릴 수 없어요. 같은 아이디로 다시 가입할 수는 있어요.</p>`,
    onMount(sheet, close) {
      const inp = $('#wdConfirm', sheet); const go = $('[data-x="go"]', sheet);
      inp.oninput = () => { go.disabled = inp.value.trim() !== '탈퇴'; };
      go.onclick = async () => {
        if (inp.value.trim() !== '탈퇴') return;
        go.disabled = true; go.innerHTML = '<span class="spin-sm"></span>';
        try {
          await detachPush().catch(() => {});
          await api.deleteMyAccount($('#wdWipe', sheet).checked);
          close();
          closeAllSheets();
          leaveApp();
          toast(`탈퇴했어요. 그동안 ${APP}을 이용해 주셔서 고마워요`, { ms: 4000 });
        } catch (e) {
          go.disabled = false; go.textContent = '탈퇴하기';
          showErr(e);
        }
      };
    },
  });
}

// 관리자 강제 탈퇴 확인 (null = 취소, true/false = 보낸 메시지도 삭제할지)
function askAdminDelete(name) {
  return new Promise((resolve) => {
    let done = false;
    const sheet = openSheet({
      title: `${name}님을 강제 탈퇴시킬까요?`,
      body: `<p class="sheet-desc">계정·프로필 사진·친구·대화방 정보가 삭제되고 되돌릴 수 없어요. 보낸 메시지는 "(알 수 없음)"으로 남아요. 이메일로 탈퇴 요청을 받은 경우 요청 내용에 맞게 골라 주세요.</p>
        <label class="agree"><input type="checkbox" id="admWipe"><span>보낸 메시지·사진·파일도 모두 삭제</span></label>
        <div class="two" style="margin-top:18px"><button class="btn gray" data-no>취소</button><button class="btn danger" data-yes>강제 탈퇴</button></div>`,
      onMount(el, close) {
        $('[data-no]', el).onclick = () => close();
        $('[data-yes]', el).onclick = () => { done = true; const w = $('#admWipe', el).checked; close(); resolve(w); };
        onSheetGone(el, () => { if (!done) resolve(null); });
      },
    });
    return sheet;
  });
}

// ---------- 관리자: 금칙어 ----------
async function showWordsAdmin() {
  let words = [];
  try { words = await api.adminGetWords(); } catch (e) { showErr(e); return; }
  openSheet({
    title: '금칙어 관리',
    body: `<p class="sheet-desc">메시지·이름·상태메시지·단체방 이름에 들어간 금칙어는 <b>*</b> 로 가려져요. 쉼표나 줄바꿈으로 구분해 입력하세요. (한 개 30자까지, 영어는 대소문자 구분 없음)</p>
      <textarea class="input" id="wordsBox" rows="9" style="font-size:15px">${esc(words.join(', '))}</textarea>
      <div class="field-err" id="err-words"></div>
      <div class="foot-note" id="wordsCount" style="text-align:left;margin-top:6px"></div>
      <button class="btn" data-x="save" style="margin-top:14px">저장</button>`,
    onMount(sheet, close) {
      const box = $('#wordsBox', sheet);
      const parse = () => [...new Set(box.value.split(/[,\n]/).map((w) => w.trim()).filter(Boolean))];
      const count = () => { $('#wordsCount', sheet).textContent = `금칙어 ${parse().length}개`; };
      box.oninput = () => { $('#err-words', sheet).innerHTML = ''; count(); };
      count();
      $('[data-x="save"]', sheet).onclick = async (e) => {
        const list = parse();
        const bad = list.find((w) => w.length > 30 || w.includes('*'));
        if (bad) { $('#err-words', sheet).innerHTML = `${ic('alert', 16, 'flex:none')}"${esc(bad.slice(0, 20))}" — 30자까지, * 없이 입력해 주세요`; return; }
        e.currentTarget.disabled = true;
        try { const n = await api.adminSetWords(list); close(); toast(`금칙어 ${n}개를 저장했어요`); }
        catch (ex) { e.currentTarget.disabled = false; showErr(ex); }
      };
    },
  });
}

// v1.15: 채팅방 알림 켜기·끄기 (서버에 저장 → 앱을 닫아도 오는 알림·다른 기기에도 적용)
async function toggleRoomMute(roomId, mute) {
  const prev = isMuted(roomId);
  const apply = (v) => {
    S.muted.set(roomId, v);
    const r = S.rooms.find((x) => x.room_id === roomId); if (r) r.muted = v;
    updateBadges();
    if (S.room && S.room.id === roomId && S.room.info) renderRoomHeader();
    if (S.tab === 'chats' && !S.room && $('#main')) renderMain();
  };
  apply(mute);
  try {
    await api.setRoomMuted(roomId, mute);
    toast(mute ? '이 채팅방 알림을 껐어요' : '이 채팅방 알림을 켰어요');
  } catch (e) { apply(prev); showErr(e); }
}

// ---------------------------------------------------------------------
// v1.11: 공감 (길게 누르기) · 답장 (옆으로 밀기)
// ---------------------------------------------------------------------
const REACTS = [['heart', '❤️', '하트'], ['like', '👍', '좋아요'], ['laugh', '😂', '웃음'], ['wow', '😮', '놀람'], ['sad', '😢', '슬픔'], ['check', '✅', '확인']];

function reactsHtml(m, mine) {
  const R = S.room;
  const r = R && R.reacts && R.reacts.get(m.id);
  if (!r || !r.size || m.kind === 'deleted') return '';
  const counts = new Map();
  for (const e of r.values()) counts.set(e, (counts.get(e) || 0) + 1);
  const my = r.get(S.uid);
  const chips = REACTS.filter(([k]) => counts.has(k)).map(([k, c, l]) => `<button class="rx ${my === k ? 'on' : ''}" data-act="react" data-id="${esc(m.id)}" data-e="${k}" aria-label="${l} ${counts.get(k)}명${my === k ? ', 내가 누름' : ''}"><span class="e">${c}</span>${counts.get(k)}</button>`).join('');
  return `<div class="rx-row ${mine ? 'mine' : ''}">${chips}</div>`;
}

// 방을 열 때·이전 대화를 불러올 때·다시 연결될 때 공감 불러오기 (fromId 이후 것만 새로 맞춤)
async function loadReactions(R, fromId) {
  try {
    const rows = await api.getReactions(R.id, fromId);
    if (S.room !== R) return;
    if (!R.reacts) R.reacts = new Map();
    for (const id of [...R.reacts.keys()]) if (!fromId || id >= fromId) R.reacts.delete(id);
    for (const x of rows) {
      const id = Number(x.message_id);
      let mp = R.reacts.get(id); if (!mp) R.reacts.set(id, (mp = new Map()));
      mp.set(x.user_id, x.emoji);
    }
    renderMsgs();
  } catch (e) { console.warn('reactions', e); }
}

function onReaction(p) {
  const R = S.room;
  if (!R || R.id !== p.room_id) return;
  if (!R.reacts) R.reacts = new Map();
  const id = Number(p.message_id);
  let mp = R.reacts.get(id); if (!mp) R.reacts.set(id, (mp = new Map()));
  if (p.emoji) mp.set(p.user_id, p.emoji); else mp.delete(p.user_id);
  clearTimeout(R.rxTimer);
  R.rxTimer = setTimeout(() => { if (S.room === R) renderMsgs(); }, 60);
}

async function toggleReact(m, key) {
  const R = S.room;
  if (!R || !isNum(m.id) || m.kind === 'deleted' || m.kind === 'system') return;
  if (!R.reacts) R.reacts = new Map();
  let mp = R.reacts.get(m.id); if (!mp) R.reacts.set(m.id, (mp = new Map()));
  const prev = mp.get(S.uid) || null;
  const next = prev === key ? null : key;
  if (next) mp.set(S.uid, next); else mp.delete(S.uid);
  renderMsgs();
  try { await api.react(m.id, next); }
  catch (e) {
    if (prev) mp.set(S.uid, prev); else mp.delete(S.uid);
    if (S.room === R) renderMsgs();
    showErr(e);
  }
}

// 공감한 사람 (길게 눌렀을 때 메뉴에 보여 줌)
function reactWhoHtml(m) {
  const r = S.room && S.room.reacts && S.room.reacts.get(m.id);
  if (!r || !r.size) return '';
  const name = (u) => (u === S.uid ? '나' : (profileOf(u) || {}).display_name || '(알 수 없음)');
  const parts = REACTS.map(([k, c]) => { const who = [...r].filter(([, e]) => e === k).map(([u]) => name(u)); return who.length ? `<span class="w"><span class="e">${c}</span>${esc(who.join(', '))}</span>` : ''; }).filter(Boolean);
  return `<div class="rx-who">${parts.join('')}</div>`;
}

// ---------- 답장 ----------
function snippetOf(m) {
  if (!m) return '';
  if (m.missing) return '원본 메시지를 볼 수 없어요';
  if (m.kind === 'deleted') return '삭제된 메시지예요';
  if (m.sender_id !== S.uid && isBlocked(m.sender_id) && !isNoticeRoom()) return '차단한 사용자의 메시지예요';
  if (m.kind === 'image') return '사진';
  if (m.kind === 'sticker') return '이모티콘';
  if (m.kind === 'file') { const f = fileOf(m); return f ? `파일: ${f.name}` : '파일'; }
  if (m.kind === 'contact') { const c = contactOf(m); return c ? `연락처: ${c.name}` : '연락처'; }
  return String(m.content || '').replace(/\s+/g, ' ').trim().slice(0, 80);
}
function senderLabel(m) {
  if (!m || m.missing) return '답장';
  if (isNoticeRoom()) return `${APP} 운영팀`;
  if (m.sender_id === S.uid) return '나';
  const p = profileOf(m.sender_id);
  return p ? p.display_name : '(알 수 없음)';
}
function findMsg(id) {
  const R = S.room; if (!R || id == null) return null;
  return (R.byId && R.byId.get(String(id))) || R.msgs.find((x) => String(x.id) === String(id)) || (R.refs && R.refs.get(Number(id))) || null;
}
// 화면에 없는 원본은 모아서 한 번에 불러옴
function needRef(id) {
  const R = S.room; if (!R) return;
  id = Number(id);
  R.refs = R.refs || new Map(); R.refWant = R.refWant || new Set();
  if (R.refs.has(id) || R.refWant.has(id)) return;
  R.refWant.add(id);
  clearTimeout(R.refTimer);
  R.refTimer = setTimeout(async () => {
    const ids = [...R.refWant].filter((x) => !R.refs.has(x)).slice(0, 100);
    try {
      const rows = await api.getMessagesByIds(R.id, ids);
      rows.forEach((r) => R.refs.set(Number(r.id), r));
      ids.forEach((x) => { if (!R.refs.has(x)) R.refs.set(x, { id: x, missing: true }); });
    } catch (e) { console.warn('reply refs', e); }
    R.refWant.clear();
    if (S.room === R) renderMsgs();
  }, 30);
}
function quoteHtml(m) {
  const o = findMsg(m.reply_to);
  if (!o) { needRef(m.reply_to); return `<span class="quote" data-act="jump-reply" data-id="${esc(m.reply_to)}"><b>답장</b><span>원본 메시지를 불러오는 중이에요</span></span>`; }
  return `<span class="quote ${o.kind === 'deleted' || o.missing ? 'gone' : ''}" data-act="jump-reply" data-id="${esc(o.id)}"><b>${esc(senderLabel(o))}</b><span>${esc(snippetOf(o))}</span></span>`;
}
function jumpTo(id) {
  const el = $(`#msgs .mw[data-k="${CSS.escape(String(id))}"]`);
  if (!el) { toast('위로 올려 이전 대화를 더 불러오면 원본을 볼 수 있어요'); return; }
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 1600);
}

function startReply(m) {
  const R = S.room;
  if (!R || !m || !isNum(m.id) || m.kind === 'deleted' || m.kind === 'system' || isNoticeRoom() || !$('#msgInput')) return;
  const wasBottom = R.atBottom;
  R.replyTo = m.id;
  renderReplyBar();
  if (wasBottom) requestAnimationFrame(() => scrollBottom());   // 답장 줄이 생겨도 맨 아래 유지
  const ta = $('#msgInput'); if (ta) ta.focus();
}
function renderReplyBar() {
  const comp = $('#composer'); if (!comp) return;
  const R = S.room;
  const m = R && R.replyTo ? findMsg(R.replyTo) : null;
  let bar = $('#replyBar');
  if (!m || m.kind === 'deleted') { if (R) R.replyTo = null; if (bar) bar.remove(); return; }
  const who = senderLabel(m);
  if (!bar) { comp.insertAdjacentHTML('afterbegin', '<div class="reply-bar" id="replyBar"></div>'); bar = $('#replyBar'); }
  bar.innerHTML = `<span class="rb-ic">${ic('reply', 18)}</span><div class="rb-t"><b>${esc(who === '나' ? '나에게 답장' : `${who}님에게 답장`)}</b><span>${esc(snippetOf(m))}</span></div>
    <button class="ibtn sm" data-act="cancel-reply" aria-label="답장 취소">${ic('x', 18)}</button>`;
}
function cancelReply() { if (S.room) S.room.replyTo = null; renderReplyBar(); }

// 옆으로 밀어서 답장 (상대 글은 오른쪽으로, 내 글은 왼쪽으로)
function wireSwipeReply(box, cancelLp, msgOf) {
  let sw = null;
  const reset = (s) => {
    s.el.classList.remove('swiping'); s.el.style.transform = '';
    s.mw.style.removeProperty('--sw'); s.mw.classList.remove('sw-on', 'sw-mine');
    const icn = $('.sw-ic', s.mw); if (icn) icn.remove();
  };
  box.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || isNoticeRoom() || !$('#msgInput')) return;
    const el = e.target.closest('.msg'); if (!el) return;
    const m = msgOf(el);
    if (!m || !isNum(m.id) || m.kind === 'deleted' || m.kind === 'system') return;
    sw = { x: e.clientX, y: e.clientY, el, mw: el.closest('.mw'), m, dir: el.classList.contains('mine') ? -1 : 1, on: false, d: 0, pid: e.pointerId };
  });
  box.addEventListener('pointermove', (e) => {
    if (!sw || e.pointerId !== sw.pid) return;
    const dx = (e.clientX - sw.x) * sw.dir; const dy = e.clientY - sw.y;
    if (!sw.on) {
      if ($('.sheet-back')) { sw = null; return; }   // 길게 눌러 메뉴가 열렸으면 밀기 안 함
      if (Math.abs(dy) > 12 && Math.abs(dy) >= Math.abs(dx)) { sw = null; return; }
      if (!(dx > 12 && dx > Math.abs(dy) * 1.4)) return;
      sw.on = true; cancelLp();
      sw.el.classList.add('swiping');
      sw.mw.classList.add('sw-on'); if (sw.dir < 0) sw.mw.classList.add('sw-mine');
      sw.mw.insertAdjacentHTML('beforeend', `<span class="sw-ic">${ic('reply', 18)}</span>`);
      try { sw.el.setPointerCapture(e.pointerId); } catch { /* 없음 */ }
    }
    const d = Math.max(0, Math.min(dx - 12, 84));
    sw.d = d;
    sw.el.style.transform = `translateX(${d * sw.dir}px)`;
    sw.mw.style.setProperty('--sw', Math.min(1, d / 56).toFixed(2));
    if (!sw.buzz && d >= 56) { sw.buzz = true; try { navigator.vibrate?.(10); } catch { /* 없음 */ } }
  });
  const end = () => {
    if (!sw) return;
    const s = sw; sw = null;
    if (!s.on) return;
    reset(s);
    if (S.room) { S.room.suppressClick = true; setTimeout(() => { if (S.room) S.room.suppressClick = false; }, 400); }
    if (s.d >= 56) startReply(s.m);
  };
  box.addEventListener('pointerup', end);
  box.addEventListener('pointercancel', end);
}

// ---------------------------------------------------------------------
// 실시간 이벤트
// ---------------------------------------------------------------------
function onMessage(m) {
  if (S.room && m.room_id === S.room.id) {
    addMessages([m], { forceBottom: m.sender_id === S.uid });
    if (!document.hidden) markReadSoon();
  }
  if (applyToList(m)) maybeNotify(m);
  else refreshRoomsSoon().then(() => maybeNotify(m));
}

function onMemberUpdate(row) {
  if (S.room && row.room_id === S.room.id) {
    const mb = S.room.members.find((x) => x.id === row.user_id);
    if (mb) { mb.last_read_id = row.last_read_id; updateReadCounts(); }
    else refreshMembers();
  }
  if (row.user_id === S.uid) {   // 다른 기기에서 읽음
    const r = S.rooms.find((x) => x.room_id === row.room_id);
    if (r && r.unread) { r.unread = 0; updateBadges(); scheduleMain(); }
  }
}

function onStatus(status) {
  if (status === 'SUBSCRIBED') {
    if (S.wasSubscribed) catchUp();
    S.wasSubscribed = true;
  }
}

async function catchUp() {
  if (!S.entered || !$('#main')) return;
  refreshRoomsSoon();
  loadRequests();
  if (S.room) {
    const R = S.room;
    const lastReal = [...R.msgs].reverse().find((m) => isNum(m.id));
    try {
      const fresh = await api.getMessagesAfter(R.id, lastReal ? lastReal.id : 0);
      if (S.room === R) {
        addMessages(fresh); refreshMembers(); markReadSoon();
        const first = R.msgs.find((m) => isNum(m.id)); if (first) loadReactions(R, first.id);
      }
    } catch (e) { console.warn(e); }
  }
}

function maybeNotify(m) {
  if (!S.entered || m.sender_id === S.uid || m.kind === 'system') return;
  if (isMuted(m.room_id)) return;   // v1.15: 알림 꺼 둔 방
  if (isBlocked(m.sender_id)) return;   // v1.17: 차단한 사람
  const inRoom = S.room && S.room.id === m.room_id;
  if (inRoom && !document.hidden) return;
  const sender = profileOf(m.sender_id);
  const r = S.rooms.find((x) => x.room_id === m.room_id);
  const name = r && r.is_notice ? `${APP} 운영팀` : (sender ? sender.display_name : '새 메시지');
  const title = r && r.is_group ? `${name} · ${roomName(r, r.members || [])}` : name;
  const text = KIND_LABEL[m.kind] ? previewText(KIND_LABEL[m.kind]) : m.content;

  if (document.hidden) {
    if (S.pushOn) return; // 서버 알림(Web Push)이 대신 보여 줌
    if ('Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker) {
      navigator.serviceWorker.ready.then((reg) => reg.showNotification(title, {
        body: text.slice(0, 120), tag: m.room_id, renotify: true,
        icon: './icons/icon-192.png', badge: './icons/badge-72.png',
        data: { url: './#/room/' + m.room_id },
      })).catch(() => {});
    }
  } else {
    toastMsg({ person: r && r.is_notice ? null : (sender || { id: m.sender_id, display_name: '?' }), title, body: text.split('\n')[0], onClick: () => goRoom(m.room_id) });
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden || !S.entered) return;
  if (!$('#main')) return;
  touchLastSeen();
  catchUp();
  if (S.room) markReadSoon();
});
window.addEventListener('online', () => { setOffline(false); catchUp(); });
// 놓친 실시간 알림이 있어도 맞춰지도록 화면이 켜져 있을 때 90초마다 한 번 확인
setInterval(() => { if (S.entered && !document.hidden && $('#main')) catchUp(); }, 90000);
window.addEventListener('offline', () => setOffline(true));

// ---------------------------------------------------------------------
// 시트들: 프로필, 친구 추가, 새 채팅, 방 메뉴 등
// ---------------------------------------------------------------------
async function showProfile(id) {
  const isMe = id === S.uid;
  if (!isMe) await loadFriends().catch(() => {});
  const p = isMe ? S.me : profileOf(id);
  if (!p) { toast('알 수 없는 사용자예요', { error: true }); return; }
  const fr = S.friends.find((f) => f.id === id);
  const isFriend = !!fr;
  const canChat = isFriend && fr.mutual !== false;
  openSheet({
    title: '프로필', closeOnly: true,
    body: `<div class="profile-card">${av(p, 116)}<div class="pname">${esc(p.display_name)}</div>
      ${p.username ? `<div class="pid">@${esc(p.username)}</div>` : ''}
      ${p.status_message ? `<div class="pstatus">${esc(p.status_message)}</div>` : ''}</div>
      ${isMe ? `<button class="btn" data-x="edit" style="margin-top:24px">${ic('pencil', 18)}프로필 편집</button>`
    : `<div class="two" style="margin-top:24px"><button class="btn" data-x="chat" style="font-size:15px" ${canChat ? '' : 'disabled'}>${ic('chat', 20)}1:1 채팅</button>
        ${isFriend ? '<button class="btn line" data-x="unfriend" style="font-size:15px;color:var(--ink2)">친구 삭제</button>' : `<button class="btn soft" data-x="befriend" style="font-size:15px">${ic('userplus', 18)}친구 추가</button>`}</div>
      ${canChat ? '' : `<div class="note-mint" style="margin-top:12px">${ic('lock', 18)}<span>${isFriend
    ? `상대방도 나를 친구로 추가하면 1:1 채팅을 할 수 있어요. 내 아이디 <b>@${esc(S.me.username)}</b> 를 알려 주세요.`
    : '서로 친구로 추가해야 1:1 채팅을 할 수 있어요.'}</span></div>`}
      ${api.report ? `<div class="prof-safety">${isBlocked(id) ? `<button data-x="unblock">${ic('userx', 16)}차단 해제</button>` : `<button data-x="block">${ic('userx', 16)}차단</button>`}<button data-x="report">${ic('flag', 16)}신고</button></div>` : ''}`}`,
    onMount(sheet, close) {
      sheet.addEventListener('click', async (e) => {
        const x = e.target.closest('[data-x]'); if (!x) return;
        const act = x.dataset.x;
        try {
          if (act === 'edit') { close(); showEditProfile(); }
          if (act === 'chat') { x.disabled = true; const rid = await api.openDM(id); close(); goRoom(rid); }
          if (act === 'befriend') { await api.addFriend(id); await loadFriends(); loadSuggestions(); close(); friendAddedToast(id, p.display_name); }
          if (act === 'block') { close(); await blockUser(id, p.display_name); }
          if (act === 'unblock') { close(); await unblockUser(id, p.display_name); }
          if (act === 'report') { close(); showReport({ userId: id, name: p.display_name }); }
          if (act === 'unfriend') {
            close();
            if (!(await ask(`${p.display_name}님을 친구에서 삭제할까요?`, '삭제해도 대화방은 그대로 남아요.', '삭제', true))) return;
            await api.removeFriend(id); await loadFriends(); toast(`${p.display_name}님을 친구에서 삭제했어요`);
          }
        } catch (ex) { x.disabled = false; showErr(ex); }
      });
    },
  });
}

function showAddFriend() {
  openSheet({
    title: '친구 추가',
    body: `<form id="findForm" class="find-row"><div class="find-input" id="findBox">${ic('search', 20, 'flex:none;color:var(--ink3)')}<input name="q" placeholder="아이디 또는 휴대폰 번호" autocapitalize="off" spellcheck="false" autocomplete="off"></div>
        <button class="find-btn" type="submit">검색</button></form>
      <div id="findResult"><div class="idle-text">친구의 아이디나 휴대폰 번호로 찾아보세요.<br>내 아이디는 <b>@${esc(S.me.username)}</b> 이에요.</div>
        <button class="btn soft" data-x="invite" style="font-size:15px">${ic('share', 20)}초대 링크·QR로 친구 추가</button></div>`,
    onMount(sheet, close) {
      const form = $('#findForm', sheet); const out = $('#findResult', sheet); const box = $('#findBox', sheet);
      setTimeout(() => form.q.focus(), 50);
      form.q.oninput = () => box.classList.remove('err');
      sheet.addEventListener('click', (e) => {
        if (e.target.closest('[data-x=invite]')) { close(); showInvite(); }
      });
      form.onsubmit = async (e) => {
        e.preventDefault();
        const raw = form.q.value.trim();
        const ph = normPhone(raw);
        const q = ph || raw.replace(/^@/, '').toLowerCase();
        if (!q) { box.classList.add('err'); out.innerHTML = `<div class="field-err" style="padding:10px 4px 30px">${ic('alert', 16)}아이디 또는 휴대폰 번호를 입력해 주세요</div>`; return; }
        form.q.blur();   // 휴대폰 키보드를 내려서 결과가 가려지지 않게
        out.innerHTML = '<div class="spinner"></div>';
        try {
          const u = await api.findUser(q);
          if (!u) {
            box.classList.add('err');
            toast(ph ? '그 번호로 찾을 수 있는 회원이 없어요' : `‘${q}’ 아이디를 찾을 수 없어요`, { error: true });
            out.innerHTML = ph
              ? `<div class="field-err" style="padding:10px 4px 0">${ic('alert', 16)}${esc(fmtPhone(ph))} 번호로 찾을 수 있는 회원이 없어요</div><div class="help" style="padding:6px 4px 30px">번호를 등록하지 않았거나 ‘번호로 나를 찾을 수 있게’를 꺼 둔 회원은 찾을 수 없어요. 아이디로 검색해 보세요.</div>`
              : `<div class="field-err" style="padding:10px 4px 30px">${ic('alert', 16)}‘${esc(q)}’ 아이디를 찾을 수 없어요</div>`;
            return;
          }
          cacheProfile(u);
          setTimeout(() => out.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 50);
          const isMe = u.id === S.uid; const isFriend = S.friends.some((f) => f.id === u.id);
          out.innerHTML = `<div class="found">${av(u, 76)}<div class="fn">${esc(u.display_name)}</div><div class="fid">@${esc(u.username)}</div>
            ${u.status_message ? `<div class="fst">${esc(u.status_message)}</div>` : ''}
            <div class="act">${isMe ? '<div class="itsme"><span class="chip me">나</span>내 아이디예요</div>'
    : isFriend ? `<div class="already">${ic('check', 18)}이미 친구예요</div>`
      : `<button class="btn" data-add style="height:52px">${ic('userplus', 20)}친구 추가</button>`}</div></div>`;
          const add = $('[data-add]', out);
          if (add) add.onclick = async () => {
            add.disabled = true;
            try { await api.addFriend(u.id); await loadFriends(); loadSuggestions(); close(); friendAddedToast(u.id, u.display_name); }
            catch (ex) { add.disabled = false; showErr(ex); }
          };
        } catch (ex) { out.innerHTML = ''; showErr(ex); }
      };
    },
  });
}

// 휴대폰 연락처 고르기 지원 여부 (연락처 보내기에서 사용)
const pickerSupported = () => 'contacts' in navigator && 'ContactsManager' in window && typeof navigator.contacts.select === 'function';

// ---------- 내 휴대폰 번호 ----------
function showPhone() {
  const cur = S.phone || null;
  let findable = cur ? cur.findable !== false : true;
  openSheet({
    title: '휴대폰 번호',
    body: `<div class="sub-text">번호를 등록하면 친구가 휴대폰 번호로 나를 찾아 추가할 수 있어요.</div>
      <div class="auth-fields">${fieldHtml('phone', '휴대폰 번호', { type: 'tel', ph: '010-1234-5678', auto: 'tel', max: 16 })}</div>
      <div class="card-line"><span class="label">번호로 나를 찾을 수 있게<span class="sub">끄면 휴대폰 번호로 검색해도 내가 나오지 않아요</span></span>
        <button class="switch ${findable ? 'on' : ''}" data-x="find" role="switch" aria-checked="${findable}" aria-label="번호로 나를 찾을 수 있게"></button></div>
      <button class="btn" data-x="save" style="margin-top:18px">저장</button>
      ${cur ? '<button class="btn text" data-x="remove" style="margin-top:4px">번호 삭제</button>' : ''}
      <div class="foot-note" style="margin-top:10px">번호는 다른 회원에게 보이지 않아요. 관리자만 확인할 수 있어요.</div>`,
    onMount(sheet, close) {
      const input = $('#f-phone', sheet);
      if (cur) input.value = fmtPhone(cur.phone);
      input.oninput = () => setFieldErr(sheet, 'phone', '');
      sheet.addEventListener('click', async (e) => {
        const x = e.target.closest('[data-x]'); if (!x) return;
        if (x.dataset.x === 'find') {
          findable = !findable;
          x.classList.toggle('on', findable); x.setAttribute('aria-checked', String(findable));
          return;
        }
        if (x.dataset.x === 'remove') {
          close();
          if (!(await ask('휴대폰 번호를 삭제할까요?', '삭제하면 친구가 번호로 나를 찾을 수 없어요.', '삭제', true))) return;
          try { await api.setMyPhone('', true); S.phone = null; renderMain(); toast('휴대폰 번호를 삭제했어요'); } catch (ex) { showErr(ex); }
          return;
        }
        if (x.dataset.x === 'save') {
          const raw = input.value.trim();
          if (!raw) { setFieldErr(sheet, 'phone', '휴대폰 번호를 입력해 주세요'); return; }
          if (!normPhone(raw)) { setFieldErr(sheet, 'phone', '휴대폰 번호를 정확히 입력해 주세요 (예: 010-1234-5678)'); return; }
          x.disabled = true;
          try {
            const v = await api.setMyPhone(raw, findable);
            S.phone = { phone: v || normPhone(raw), findable };
            close(); renderMain(); toast('휴대폰 번호를 저장했어요');
          } catch (ex) { x.disabled = false; setFieldErr(sheet, 'phone', ex.message); }
        }
      });
    },
  });
}

// 추천 친구 (받은 요청에 이미 있는 사람은 빼고)
const sugList = () => S.suggestions.filter((g) => !S.requests.some((q) => q.id === g.id));

// 실시간: 누군가 나를 친구로 추가함
function onFriend(p) {
  loadRequests();
  const person = { id: p.from_id, display_name: p.display_name || '누군가' };
  cacheProfile({ id: p.from_id, display_name: p.display_name, username: p.username });
  const text = `${person.display_name}님이 나를 친구로 추가했어요. 나도 추가하면 대화할 수 있어요`;
  if (document.hidden) {
    if (S.pushOn) return; // 서버 알림이 대신 보여 줌
    if ('Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker) {
      navigator.serviceWorker.ready.then((reg) => reg.showNotification('친구 요청', { body: text, tag: 'friend-' + p.from_id, icon: './icons/icon-192.png', badge: './icons/badge-72.png', data: { url: './#/friends' } })).catch(() => {});
    }
    return;
  }
  toastMsg({ person, title: '친구 요청', body: text, onClick: () => go('#/friends') });
}
// 실시간: 단체방에서 내보내짐
function onKicked(p) { kickedOut(p.room_id, p.title); }
function kickedOut(roomId, title) {
  const r = S.rooms.find((x) => x.room_id === roomId);
  const name = title || (r ? roomName(r, r.members || []) : '단체방');
  S.rooms = S.rooms.filter((x) => x.room_id !== roomId);
  updateBadges();
  if (S.room && S.room.id === roomId) {
    closeRoom(); S.fromList = false; S.tab = 'chats'; location.replace('#/chats');
  } else if (S.tab === 'chats') scheduleMain();
  toast(`‘${name}’ 채팅방에서 내보내졌어요`, { error: true, ms: 4500 });
}

function friendAddedToast(id, name) {
  const f = S.friends.find((x) => x.id === id);
  if (f && f.mutual) toast(`${name}님과 이제 서로 친구예요. 대화를 시작할 수 있어요`, { ms: 3200 });
  else toast(`${name}님을 친구로 추가했어요. 상대방도 나를 추가하면 대화할 수 있어요`, { ms: 4000 });
}

// 친구 고르기 (새 채팅·초대 공용) — 서로 친구인 사람만

async function pickFriends({ invite = false, exclude = [], fromDm = false } = {}) {
  await loadFriends().catch(() => {});
  return new Promise((resolve) => {
    const list = S.friends.filter((f) => f.mutual !== false && !exclude.includes(f.id));
    const waiting = S.friends.filter((f) => f.mutual === false).length;
    const sel = [];
    let finished = false;
    openSheet({
      title: invite ? '대화상대 초대' : '새 채팅',
      body: `<div class="sub-text">${fromDm ? '고른 친구와 지금 대화 상대가 함께하는 새 단체방이 만들어져요. 지금 1:1 대화방은 그대로 남아요.' : invite ? '채팅방에 초대할 친구를 선택하세요' : '대화할 친구를 선택하세요. 여러 명을 고르면 단체방이 돼요.'}</div>
        <div class="sel-chips" id="selChips" hidden></div>
        ${list.length ? `<div class="pick-list bleed">${list.map((f) => `<button class="pick" data-pick="${esc(f.id)}" role="checkbox" aria-checked="false">${av(f, 44)}<span class="nm">${esc(f.display_name)}</span><span class="ck">${ic('check', 16)}</span></button>`).join('')}</div>`
    : `<div class="empty-line">${!S.friends.length ? '먼저 친구를 추가해 주세요.' : waiting && S.friends.length === waiting ? '서로 친구인 사람이 아직 없어요.<br>상대방도 나를 친구로 추가해야 대화할 수 있어요.' : '초대할 수 있는 친구가 없어요.'}</div>`}
        ${list.length && waiting ? `<div class="help" style="margin-top:8px">서로 친구인 사람만 보여요 · 대화 대기 ${waiting}명</div>` : ''}
        ${invite ? '' : `<div class="field" id="gWrap" hidden style="margin-top:12px"><label for="groupTitle">단체방 이름</label>
          <input class="input" id="groupTitle" maxlength="20" placeholder="예: 주말 피크닉 모임"><div class="help" id="gHelp">2명 이상과 대화하면 단체방이 만들어져요 · 0/20</div></div>`}
        <button class="btn" id="pickOk" disabled style="margin-top:16px">${invite ? '초대할 친구를 선택하세요' : '친구를 선택하세요'}</button>`,
      onMount(sheet, close) {
        const ok = $('#pickOk', sheet); const gt = $('#groupTitle', sheet); const chips = $('#selChips', sheet);
        const refresh = () => {
          $$('[data-pick]', sheet).forEach((b) => { const on = sel.includes(b.dataset.pick); b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
          chips.hidden = !sel.length;
          chips.innerHTML = sel.map((id) => { const f = profileOf(id); return `<button class="sel-chip" data-unpick="${esc(id)}" aria-label="${esc(f.display_name)} 선택 해제">${av(f, 32)}${esc(f.display_name)}${ic('x', 14)}</button>`; }).join('');
          const needName = !invite && sel.length >= 2;
          if (gt) { $('#gWrap', sheet).hidden = !needName; $('#gHelp', sheet).textContent = `2명 이상과 대화하면 단체방이 만들어져요 · ${gt.value.length}/20`; }
          const disabled = !sel.length || (needName && !gt.value.trim());
          ok.disabled = disabled;
          ok.textContent = invite ? (sel.length ? (fromDm ? `${sel.length}명 초대해서 단체방 만들기` : `${sel.length}명 초대하기`) : '초대할 친구를 선택하세요')
            : !sel.length ? '친구를 선택하세요' : sel.length === 1 ? '1:1 채팅 시작' : `${sel.length}명과 단체방 만들기`;
        };
        sheet.addEventListener('click', (e) => {
          const b = e.target.closest('[data-pick]');
          const u = e.target.closest('[data-unpick]');
          const id = b ? b.dataset.pick : u ? u.dataset.unpick : null;
          if (!id) return;
          const i = sel.indexOf(id);
          if (i >= 0) sel.splice(i, 1); else if (b) sel.push(id);
          refresh();
        });
        if (gt) gt.oninput = refresh;
        ok.onclick = () => { finished = true; close(); resolve({ ids: [...sel], title: gt ? gt.value.trim() : '' }); };
        onSheetGone(sheet, () => { if (!finished) resolve(null); });
      },
    });
  });
}

async function newChat() {
  const r = await pickFriends();
  if (!r) return;
  try {
    const rid = r.ids.length === 1 ? await api.openDM(r.ids[0]) : await api.createGroup(r.title, r.ids);
    goRoom(rid);
    refreshRoomsSoon();
  } catch (e) { showErr(e); }
}

function showRoomMenu() {
  if (!S.room || !S.room.info || S.room.info.is_notice) return;
  const R = S.room;
  const members = R.members.map((m) => (m.id === S.uid ? S.me : profileOf(m.id)) || { id: m.id, display_name: '(알 수 없음)' })
    .sort((a, b) => (a.id === S.uid ? -1 : b.id === S.uid ? 1 : a.id === R.info.created_by ? -1 : b.id === R.info.created_by ? 1 : 0));
  const canKick = R.info.is_group && (R.info.created_by === S.uid || S.me.is_admin);
  openSheet({
    title: roomName(R.info, roomOthers()),
    body: `<button class="menu-row invite bleed" data-x="invite" style="width:calc(100% + 40px)"><span class="circ">${ic('userplus', 22)}</span><span>대화상대 초대${R.info.is_group ? '' : '<span class="sub">새 단체방으로 만들어져요</span>'}</span></button>
      <div class="card-line mute-line"><span class="label">${ic(isMuted(R.id) ? 'belloff' : 'bell', 20, 'flex:none;vertical-align:-4px;margin-right:8px')}이 채팅방 알림<span class="sub">끄면 새 메시지가 와도 알림이 울리지 않아요. 안 읽은 숫자는 그대로 보여요</span></span>
        <button class="switch ${isMuted(R.id) ? '' : 'on'}" data-x="mute" role="switch" aria-checked="${!isMuted(R.id)}" aria-label="이 채팅방 알림"></button></div>
      <div class="sec" style="padding:12px 0 4px">참여자 ${members.length}</div>
      <div class="bleed">${members.map((p) => `<div class="menu-row mem"><button class="mem-main" data-x="profile" data-id="${esc(p.id)}">${av(p, 42)}<span style="font-size:15px">${esc(p.display_name)}</span>${p.id === S.uid ? '<span class="chip me">나</span>' : ''}${R.info.is_group && p.id === R.info.created_by ? '<span class="chip owner">방장</span>' : ''}</button>
        ${canKick && p.id !== S.uid ? `<button class="kick-btn" data-x="kick" data-id="${esc(p.id)}">내보내기</button>` : ''}</div>`).join('')}</div>
      <div class="divider"></div>
      <button class="menu-row leave bleed" data-x="leave" style="width:calc(100% + 40px)">${ic('logout', 22)}채팅방 나가기</button>`,
    onMount(sheet, close) {
      sheet.addEventListener('click', async (e) => {
        const x = e.target.closest('[data-x]'); if (!x) return;
        if (x.dataset.x === 'profile') { close(); showProfile(x.dataset.id); }
        if (x.dataset.x === 'mute') {
          const on = !isMuted(R.id);   // true → 끄기
          x.classList.toggle('on', !on); x.setAttribute('aria-checked', String(!on));
          toggleRoomMute(R.id, on);
          return;
        }
        if (x.dataset.x === 'invite') {
          close();
          if (R.info.is_group) {
            const r = await pickFriends({ invite: true, exclude: R.members.map((m) => m.id) });
            if (r && r.ids.length) { try { await api.inviteToRoom(R.id, r.ids); } catch (ex) { showErr(ex); } }
          } else {
            // 1:1 방에서 초대 → 지금 상대 + 고른 친구로 새 단체방
            const other = R.members.map((m) => m.id).filter((id) => id !== S.uid);
            const r = await pickFriends({ invite: true, fromDm: true, exclude: R.members.map((m) => m.id) });
            if (r && r.ids.length) {
              try { const gid = await api.createGroup('', [...other, ...r.ids]); goRoom(gid); refreshRoomsSoon(); toast('새 단체방을 만들었어요'); }
              catch (ex) { showErr(ex); }
            }
          }
        }
        if (x.dataset.x === 'kick') {
          const p = profileOf(x.dataset.id) || { display_name: '이 사람' };
          close();
          if (!(await ask(`${p.display_name}님을 내보낼까요?`, '내보내면 이 방의 대화를 볼 수 없고, 다시 초대해야 들어올 수 있어요.', '내보내기', true))) return;
          try { await api.kickFromRoom(R.id, x.dataset.id); toast(`${p.display_name}님을 내보냈어요`); refreshMembers(); }
          catch (ex) { showErr(ex); }
        }
        if (x.dataset.x === 'leave') {
          close();
          const last = R.members.length <= 1;
          const ok = await ask('채팅방을 나갈까요?', last ? '마지막 참여자라서 나가면 이 방의 대화와 사진·파일이 서버에서 모두 삭제돼요. 되돌릴 수 없어요.'
            : R.info.is_group ? '나가면 대화 내용이 목록에서 사라져요. 다시 초대받아도 나가기 전의 대화는 볼 수 없어요.'
              : '나가면 이 대화방이 목록에서 사라져요. 상대가 새 메시지를 보내면 다시 나타나지만, 나가기 전의 대화는 볼 수 없어요.', '나가기', true);
          if (!ok) return;
          try {
            const res = await api.leaveRoom(R.id);
            S.rooms = S.rooms.filter((x2) => x2.room_id !== R.id);
            updateBadges();
            S.fromList = false;
            S.tab = 'chats';
            location.replace('#/chats');
            toast(res && res.room_deleted ? '채팅방에서 나왔어요. 마지막 참여자라 대화와 사진·파일을 모두 삭제했어요' : '채팅방에서 나왔어요', { ms: res && res.room_deleted ? 3600 : undefined });
          } catch (ex) { showErr(ex); }
        }
      });
    },
  });
}

function showImage(btn) {
  const img = $('img', btn);
  if (!img || !img.src) return;
  const m = S.room && S.room.msgs.find((x) => String(x.id) === btn.dataset.id);
  const p = m ? (m.sender_id === S.uid ? S.me : profileOf(m.sender_id)) : null;
  const when = m ? `${new Date(m.created_at).getMonth() + 1}월 ${new Date(m.created_at).getDate()}일 ${fmtTime(m.created_at)}` : '';
  const v = document.createElement('div');
  v.className = 'viewer';
  v.innerHTML = `<div class="vbar"><button class="ibtn" data-v="close" aria-label="닫기">${ic('x', 24)}</button>
      <div class="vt"><b>${esc(p ? p.display_name : '사진')}</b><span>${esc(when)}</span></div><div style="width:44px"></div></div>
    <div class="vimg"><img src="${esc(img.src)}" alt="사진"></div>
    <div class="vfoot"><a class="save" href="${esc(img.src)}" download="minitalk-photo.jpg" target="_blank" rel="noopener">${ic('download', 20)}저장</a></div>`;
  v.addEventListener('click', (e) => { if (e.target.closest('[data-v=close]') || e.target.classList.contains('vimg')) v.remove(); });
  app.appendChild(v);
}

function showChangePassword() {
  openSheet({
    title: '비밀번호 변경',
    body: `<div class="auth-fields">
        ${fieldHtml('cur', '현재 비밀번호', { type: 'password', ph: '현재 비밀번호', auto: 'current-password' })}
        ${fieldHtml('n1', '새 비밀번호', { type: 'password', ph: '6자 이상', help: '6자 이상', auto: 'new-password' })}
        ${fieldHtml('n2', '새 비밀번호 확인', { type: 'password', ph: '한 번 더 입력', auto: 'new-password' })}
      </div><button class="btn" id="pwOk" style="margin-top:20px">변경하기</button>`,
    onMount(sheet, close) {
      sheet.addEventListener('input', (e) => { if (e.target.name) setFieldErr(sheet, e.target.name, ''); });
      $('#pwOk', sheet).onclick = async () => {
        const v = (k) => $(`#f-${k}`, sheet).value;
        const errs = {};
        if (!v('cur')) errs.cur = '현재 비밀번호를 입력해 주세요';
        if (v('n1').length < 6) errs.n1 = '6자 이상 입력해 주세요';
        if (!v('n2') || v('n2') !== v('n1')) errs.n2 = '비밀번호가 일치하지 않아요';
        ['cur', 'n1', 'n2'].forEach((k) => setFieldErr(sheet, k, errs[k] || ''));
        if (Object.keys(errs).length) return;
        const btn = $('#pwOk', sheet); btn.disabled = true;
        try { await api.changePassword(v('cur'), v('n1')); close(); toast('비밀번호를 바꿨어요'); }
        catch (e) { btn.disabled = false; setFieldErr(sheet, /현재/.test(e.message) ? 'cur' : 'n1', e.message); }
      };
    },
  });
}

// ---------------------------------------------------------------------
// 관리자 화면 (#/admin)
// ---------------------------------------------------------------------
const ST_LABEL = { active: '정상', pending: '승인 대기', suspended: '정지', admin: '관리자' };
const stOf = (u) => (u.status === 'active' && u.is_admin ? 'admin' : u.status);

// v1.12: 없어진 방에 남은 사진·파일 정리 (quiet = 회원 탈퇴 뒤 자동으로, 묻지 않고)
async function cleanOrphans(quiet, btn) {
  try {
    if (btn) btn.disabled = true;
    const list = await api.adminOrphanMedia();
    if (!list.length) { if (!quiet) toast('정리할 사진·파일이 없어요'); return; }
    const total = list.reduce((a, x) => a + (Number(x.size) || 0), 0);
    if (!quiet && !(await ask(`남은 사진·파일 ${list.length}개를 지울까요?`, `없어진 대화방에 남아 있던 파일이에요 (약 ${fmtSize(total)}). 아무도 볼 수 없는 파일이라 지워도 대화에는 영향이 없어요.`, '지우기', true))) return;
    const n = await api.removeMedia(list);
    if (!quiet || n) toast(n ? `사진·파일 ${n}개를 지웠어요 (약 ${fmtSize(total)})` : '지우지 못했어요. 잠시 후 다시 해 주세요', { error: !n });
  } catch (e) { if (!quiet) showErr(e); }
  finally { if (btn && btn.isConnected) btn.disabled = false; }
}
// ---------------------------------------------------------------------
// v1.18: 관리자 화면 — 현황 · 회원 · 신고 · 문의 · 운영 (휴대폰: 위쪽 탭 / PC: 왼쪽 메뉴)
// ---------------------------------------------------------------------
const ADM_SECS = [['home', '현황', 'shield'], ['members', '회원', 'user'], ['reports', '신고', 'flag'], ['inquiries', '문의', 'mail'], ['ops', '운영', 'more']];
const MEMBER_FILTERS = [['all', '전체'], ['pending', '승인 대기'], ['suspended', '정지'], ['reported', '신고 있음'], ['new', '신규 7일'], ['dormant', '휴면 30일'], ['admin', '관리자']];
const MEMBER_SORTS = [['recent', '최근 가입순'], ['seen', '최근 접속순'], ['name', '이름순'], ['reports', '신고 많은 순']];
const INQ_CATS = [['use', '이용 문의'], ['bug', '오류 신고'], ['account', '계정·탈퇴'], ['suggest', '제안'], ['other', '기타']];
const INQ_CAT = Object.fromEntries(INQ_CATS);
const INQ_ST = { open: '답변 대기', answered: '답변 완료', closed: '종료' };
const SANCTION_LABEL = { suspend: '이용 정지', unsuspend: '정지 해제', auto_unsuspend: '정지 기간 끝남', delete_message: '메시지 삭제', approve: '가입 승인' };
const PAGE_SIZE = 50;
const fmtDT = (iso) => { if (!iso) return '-'; const d = new Date(iso); return `${d.getMonth() + 1}월 ${d.getDate()}일 ${fmtTime(iso)}`; };
const untilTxt = (u) => (u.suspended_until ? `${fmtDT(u.suspended_until)}까지 정지` : '영구 정지');

async function openAdmin(sec) {
  if (!S.me || !S.me.is_admin) { location.replace('#/more'); return; }
  closeAllSheets();
  const A = S.admin = S.admin || {
    sec: 'home', badges: {}, dash: null, chart: 'active',
    members: { q: '', filter: 'all', sort: 'recent', rows: [], total: 0, loaded: false, busy: false, seq: 0 },
    reports: { status: 'open' }, inquiries: { status: 'open', rows: [], total: 0 },
  };
  if (sec) A.sec = sec;
  const el = $('#admin');
  if (el.hidden || !$('#admMain')) {
    el.hidden = false;
    app.classList.add('adm-wide');
    el.innerHTML = `<div class="adm">
      <aside class="adm-nav">
        <div class="adm-top"><button class="ibtn" data-act="admin-back" aria-label="뒤로">${ic('back', 24)}</button><h1>관리자</h1>
          <button class="ibtn adm-refresh" data-act="admin-refresh" aria-label="새로고침">${ic('retry', 20)}</button></div>
        <nav class="adm-tabs" aria-label="관리 메뉴">${ADM_SECS.map(([k, l, i]) => `<button data-act="admin-sec" data-s="${k}">${ic(i, 19)}<span>${l}</span><i class="adm-badge" id="admBadge-${k}"></i></button>`).join('')}</nav>
      </aside>
      <section class="adm-main scroll" id="admMain"></section>
    </div>`;
  }
  $$('.adm-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.s === A.sec));
  refreshAdminBadges();
  renderAdminSection();
}
function closeAdmin() {
  const el = $('#admin');
  app.classList.remove('adm-wide');
  if (el && !el.hidden) { el.hidden = true; el.innerHTML = ''; }
}
function adminGo(sec) { go(sec === 'home' ? '#/admin' : '#/admin/' + sec); }
const admMain = () => $('#admMain');
const admLoading = () => { const m = admMain(); if (m) m.innerHTML = '<div class="spinner"></div>'; };
const admError = (e) => { const m = admMain(); if (m) m.innerHTML = `<div class="empty-state"><b>불러오지 못했어요</b><p>${esc(e.message || '')}</p><button class="btn line sm" data-act="admin-refresh">다시 시도</button></div>`; };

// 메뉴 배지 (승인 대기 · 처리할 신고 · 답변할 문의)
async function refreshAdminBadges() {
  if (!S.me || !S.me.is_admin) return;
  let b = null;
  try { b = api.adminBadges ? await api.adminBadges() : null; } catch { b = null; }
  if (!b) {   // 데이터베이스가 예전 버전이면 있는 것만
    b = {};
    try { b.pending = ((await api.adminSettings()) || {}).pending || 0; } catch { /* 없음 */ }
    try { b.reports = api.adminOpenReports ? await api.adminOpenReports() : 0; } catch { /* 없음 */ }
  }
  S.pending = b.pending || 0; S.openReports = b.reports || 0; S.openInquiries = b.inquiries || 0;
  if (S.admin) S.admin.badges = b;
  const set = (id, n) => { const e = $('#' + id); if (e) e.textContent = n ? (n > 99 ? '99+' : String(n)) : ''; };
  set('admBadge-members', b.pending); set('admBadge-reports', b.reports); set('admBadge-inquiries', b.inquiries);
  const more = $('#adminTodo');
  if (more) more.innerHTML = adminTodoChips();
}
const adminTodoChips = () => [[S.pending, '승인 대기'], [S.openReports, '신고'], [S.openInquiries, '문의']]
  .filter(([n]) => n).map(([n, l]) => `<span class="chip-lemon">${l} ${n}</span>`).join('');
function refreshReportBadge() { refreshAdminBadges(); }

function renderAdminSection() {
  const A = S.admin; if (!A || !admMain()) return;
  admMain().scrollTop = 0;
  if (A.sec === 'members') return renderMembersSec();
  if (A.sec === 'reports') return renderReportsSec();
  if (A.sec === 'inquiries') return renderInquiriesSec();
  if (A.sec === 'ops') return renderOpsSec();
  return renderHomeSec();
}

// ---------- 현황 ----------
async function renderHomeSec() {
  const A = S.admin;
  if (!A.dash) admLoading();
  let d;
  try { d = await api.adminDashboard(); } catch (e) { if (S.admin && A.sec === 'home') admError(e); return; }
  if (!S.admin || A.sec !== 'home' || !admMain()) return;
  A.dash = d;
  const tile = (k, n, sub, act = '') => `<${act ? `button data-act="admin-sec" data-s="${act}"` : 'div'} class="kpi"><span class="k">${k}</span><b class="n">${Number(n || 0).toLocaleString()}</b><span class="s">${sub}</span></${act ? 'button' : 'div'}>`;
  const todo = [
    ['members', 'pending', d.pending, '가입 승인 대기', '승인하거나 거절해 주세요'],
    ['reports', null, d.open_reports, '처리할 신고', '가능한 한 24시간 안에 확인해요'],
    ['inquiries', null, d.open_inquiries, '답변할 문의', '회원이 답을 기다리고 있어요'],
  ].filter((t) => t[2] > 0);
  admMain().innerHTML = `<div class="adm-sec">
    <div class="adm-h"><h2>현황</h2><span class="adm-date">${fmtDate(new Date().toISOString())}</span></div>
    <div class="kpis">
      ${tile('전체 회원', d.total, `사용 중 ${d.active} · 정지 ${d.suspended}`, 'members')}
      ${tile('오늘 접속', d.today_active, `7일 ${d.active_7d} · 30일 ${d.active_30d}`)}
      ${tile('오늘 가입', d.today_signups, `최근 7일 ${d.new7}명`)}
      ${tile('오늘 메시지', d.messages_today, '시스템 안내 제외')}
    </div>
    <div class="card adm-card"><div class="card-head">처리할 일</div>
      ${todo.length ? todo.map(([s, f, n, l, sub]) => `<button class="item" data-act="admin-todo" data-s="${s}" data-f="${f || ''}"><span class="todo-n">${n}</span><span class="label">${l}<span class="sub">${sub}</span></span>${ic('chev', 18, 'color:#A3ABB6;flex:none')}</button>`).join('')
    : '<div class="empty-line">지금 처리할 일이 없어요</div>'}</div>
    <div class="card adm-card"><div class="card-head chart-head">최근 14일
      <div class="seg mini">${[['active', '접속'], ['signups', '가입'], ['messages', '메시지']].map(([k, l]) => `<button type="button" data-act="admin-chart" data-k="${k}" class="${A.chart === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div id="admChart">${chartSvg(d.series || [], A.chart)}</div>
      ${A.chart === 'active' ? '<p class="chart-note">접속자 수는 v1.18 을 설치한 날부터 쌓여요.</p>' : ''}</div>
    <div class="card adm-card"><div class="card-head">회원 구성</div>
      <div class="mix">${[['신규 7일', d.new7, 'new'], ['휴면 30일', d.dormant, 'dormant'], ['승인 대기', d.pending, 'pending'], ['정지', d.suspended, 'suspended'], ['관리자', d.admins, 'admin']]
    .map(([l, n, f]) => `<button data-act="admin-todo" data-s="members" data-f="${f}"><b>${n}</b><span>${l}</span></button>`).join('')}</div></div>
  </div>`;
}
// 막대그래프 (값에 맞게 눈금 · 날짜는 이틀마다)
function chartSvg(series, key) {
  const W = 640, H = 220, L = 46, R = 8, T = 18, B = 30;
  const vals = series.map((x) => Number(x[key]) || 0);
  const max = Math.max(1, ...vals);
  const step = max <= 4 ? 1 : Math.ceil(max / 4 / (10 ** Math.floor(Math.log10(max / 4)))) * (10 ** Math.floor(Math.log10(max / 4)));
  const top = Math.ceil(max / step) * step;
  const bw = (W - L - R) / Math.max(1, series.length);
  const y = (v) => T + (H - T - B) * (1 - v / top);
  let g = '';
  for (let v = 0; v <= top; v += step) g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="cg"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" class="ct">${v}</text>`;
  const bars = series.map((x, i) => {
    const v = vals[i]; const h = (H - T - B) - (y(v) - T);
    const d = String(x.d || '').slice(5).replace('-', '/').replace(/^0/, '');
    return `<rect x="${L + i * bw + bw * 0.18}" y="${y(v)}" width="${bw * 0.64}" height="${Math.max(0, h)}" rx="3" class="cb ${i === series.length - 1 ? 'today' : ''}"><title>${esc(x.d)}: ${v}</title></rect>`
      + (v && (i === series.length - 1 || v === max) ? `<text x="${L + i * bw + bw / 2}" y="${y(v) - 4}" text-anchor="middle" class="cv">${v}</text>` : '')
      + ((series.length - 1 - i) % 2 === 0 ? `<text x="${L + i * bw + bw / 2}" y="${H - 8}" text-anchor="middle" class="ct">${d}</text>` : '');
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="최근 14일 막대그래프">${g}${bars}</svg>`;
}

// ---------- 회원 ----------
function renderMembersSec() {
  const M = S.admin.members;
  admMain().innerHTML = `<div class="adm-sec">
    <div class="adm-h"><h2>회원</h2><span class="adm-date" id="memTotal">${M.loaded ? `총 ${M.total.toLocaleString()}명` : ''}</span></div>
    <div class="mem-tools">
      <label class="search">${ic('search', 20, 'flex:none')}<input id="adminSearch" placeholder="이름·아이디·휴대폰 번호 검색" value="${esc(M.q)}" autocapitalize="off" spellcheck="false"></label>
      <select id="memSort" class="adm-select" aria-label="정렬">${MEMBER_SORTS.map(([k, l]) => `<option value="${k}" ${M.sort === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
    </div>
    <div class="filters">${MEMBER_FILTERS.map(([k, l]) => `<button data-act="admin-filter" data-f="${k}" class="${M.filter === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="card mem-card" id="adminList"><div class="spinner"></div></div>
    <div id="memMore"></div>
  </div>`;
  const input = $('#adminSearch');
  let t = null;
  input.oninput = () => { clearTimeout(t); t = setTimeout(() => { M.q = input.value.trim(); loadMembers(true); }, 300); };
  $('#memSort').onchange = (e) => { M.sort = e.target.value; loadMembers(true); };
  if (M.loaded) drawMembers(); else loadMembers(true);
}
async function loadMembers(reset) {
  const M = S.admin && S.admin.members; if (!M) return;
  const seq = ++M.seq;
  if (reset) { M.rows = []; M.total = 0; const l = $('#adminList'); if (l) l.innerHTML = '<div class="spinner"></div>'; }
  M.busy = true; drawMore();
  try {
    const rows = await api.adminMemberPage({ q: M.q, filter: M.filter, sort: M.sort, limit: PAGE_SIZE, offset: reset ? 0 : M.rows.length });
    if (!S.admin || seq !== M.seq) return;
    M.rows = reset ? rows : M.rows.concat(rows);
    M.total = rows.length ? Number(rows[0].total) : (reset ? 0 : M.total);
    M.loaded = true;
  } catch (e) {
    if (seq === M.seq) { const l = $('#adminList'); if (l) l.innerHTML = `<div class="empty-line">${esc(e.message || '불러오지 못했어요')}</div>`; }
    M.busy = false; drawMore(); return;
  }
  M.busy = false;
  drawMembers();
}
const ST_CHIP = (u) => { const s = stOf(u); return `<span class="chip ${s}">${ST_LABEL[s]}</span>`; };
function drawMembers() {
  const M = S.admin.members; const box = $('#adminList'); if (!box) return;
  const tt = $('#memTotal'); if (tt) tt.textContent = `총 ${M.total.toLocaleString()}명`;
  if (!M.rows.length) { box.innerHTML = '<div class="empty-line">조건에 맞는 회원이 없어요</div>'; drawMore(); return; }
  box.innerHTML = `<div class="mem-head" aria-hidden="true"><span>회원</span><span>상태</span><span>가입일</span><span>최근 접속</span><span>신고</span></div>`
    + M.rows.map((u) => `<button class="mrow row mem-row" data-act="admin-user" data-id="${esc(u.id)}">${av(u, 40)}
      <div class="meta"><span class="name">${esc(u.display_name)}</span><span class="desc">@${esc(u.username)}<span class="m-only"> · ${esc(fmtAgo(u.last_seen_at))}</span></span></div>
      <span class="c-st">${ST_CHIP(u)}${u.status === 'suspended' ? `<span class="m-until">${esc(u.suspended_until ? fmtDT(u.suspended_until) + '까지' : '영구')}</span>` : ''}</span>
      <span class="c-d pc-only">${fmtDay(u.created_at)}</span>
      <span class="c-d pc-only">${esc(fmtAgo(u.last_seen_at))}</span>
      <span class="c-r">${u.open_reports ? `<span class="chip suspended">신고 ${u.open_reports}</span>` : u.reports ? `<span class="r-n">${u.reports}</span>` : '<span class="r-n">-</span>'}</span></button>`).join('');
  drawMore();
}
function drawMore() {
  const M = S.admin && S.admin.members; const el = $('#memMore'); if (!M || !el) return;
  const left = M.total - M.rows.length;
  el.innerHTML = M.busy && M.rows.length ? '<div class="spinner"></div>'
    : left > 0 ? `<button class="btn line sm more-btn" data-act="admin-more">더 보기 (${left.toLocaleString()}명 남음)</button>` : '';
}

// 회원 상세
async function showAdminUser(id) {
  let u;
  try { u = await api.adminMemberDetail(id); } catch (e) { showErr(e); return; }
  const self = u.id === S.uid;
  const s = stOf(u);
  const B = (label, x, kind) => `<button class="btn md ${kind}" data-x="${x}" ${self ? 'disabled' : ''}>${label}</button>`;
  const btns = {
    pending: [B('가입 승인', 'approve', ''), B('가입 거절 (강제 탈퇴)', 'delete', 'danger-line')],
    active: [B('이용 정지', 'suspend', 'line'), B('비밀번호 초기화', 'reset', 'line'), B('관리자로 지정', 'admin', 'line'), B('강제 탈퇴', 'delete', 'danger-line')],
    suspended: [B('정지 해제', 'unsuspend', ''), B('정지 기간 바꾸기', 'suspend', 'line'), B('비밀번호 초기화', 'reset', 'line'), B('강제 탈퇴', 'delete', 'danger-line')],
    admin: [B('관리자 해제', 'admin', 'line'), B('비밀번호 초기화', 'reset', 'line')],
  }[s];
  if (u.phone) btns.splice(btns.length - (s === 'admin' ? 0 : 1), 0, `<button class="btn md line" data-x="clearphone">휴대폰 번호 삭제</button>`);
  if (s === 'active' || s === 'admin') btns.unshift(`<button class="btn md soft" data-x="connect">${ic('userplus', 18)}친구 연결</button>`);
  const cell = (k, v, wide) => `<div class="cell ${wide ? 'wide' : ''}"><span>${k}</span><b>${v}</b></div>`;
  openSheet({
    title: '회원 정보',
    body: `<div class="m-head">${av(u, 64)}<div class="meta" style="gap:6px"><div class="nm"><b>${esc(u.display_name)}</b>${ST_CHIP(u)}</div><span class="desc">@${esc(u.username)}${u.status_message ? ` · ${esc(u.status_message)}` : ''}</span></div></div>
      ${u.status === 'suspended' ? `<div class="note-berry">${ic('ban', 16, 'flex:none')}${esc(untilTxt(u))}</div>` : ''}
      <div class="grid3">
        ${cell('가입일', fmtDay(u.created_at))}${cell('최근 접속', esc(fmtAgo(u.last_seen_at)))}${cell('30일 중 접속', `${u.active_days_30}일`)}
        ${cell('친구', `${u.friend_count}명`)}${cell('대화방', `${u.room_count}개`)}${cell('보낸 메시지', Number(u.message_count).toLocaleString())}
        ${cell('받은 신고', `${u.reports_received}건`)}${cell('한 신고', `${u.reports_made}건`)}${cell('문의', `${u.inquiries}건`)}
        ${cell('휴대폰 번호', u.phone ? esc(fmtPhone(u.phone)) : '등록 안 함', true)}
        ${cell('약관 동의', u.terms_agreed_at ? fmtDT(u.terms_agreed_at) : '아직 안 함', true)}
      </div>
      <div class="adm-block"><div class="blk-h">관리자 메모${u.note_updated_at ? `<span>${fmtDT(u.note_updated_at)} 저장</span>` : ''}</div>
        <textarea class="input memo" id="memo" maxlength="2000" rows="3" placeholder="이 회원에 대해 기억할 내용 (회원에게는 보이지 않아요)">${esc(u.note || '')}</textarea>
        <button class="btn line sm" data-x="memo" style="align-self:flex-end">메모 저장</button></div>
      <div class="adm-block"><div class="blk-h">제재 이력</div>
        ${u.sanctions.length ? `<ul class="hist">${u.sanctions.map((x) => `<li><b>${esc(SANCTION_LABEL[x.action] || x.action)}</b>${x.action === 'suspend' ? ` · ${x.days ? `${x.days}일` : '영구'}` : ''}${x.reason ? ` · ${esc(x.reason)}` : ''}<span>${fmtDT(x.created_at)}${x.admin ? ` · ${esc(x.admin)}` : ''}</span></li>`).join('')}</ul>` : '<div class="empty-mini">없어요</div>'}</div>
      <div class="adm-block"><div class="blk-h">받은 신고</div>
        ${u.reports.length ? `<ul class="hist">${u.reports.map((r) => `<li><b>${esc(REASON_LABEL[r.reason] || r.reason)}</b>${r.snapshot ? ` · ${esc(String(r.snapshot).slice(0, 40))}` : ''}<span>${fmtDT(r.created_at)} · ${r.status === 'open' ? '처리 대기' : esc(ACTION_LABEL[r.action] || '처리됨')}${r.reporter ? ` · 신고: ${esc(r.reporter)}` : ''}</span></li>`).join('')}</ul>` : '<div class="empty-mini">없어요</div>'}</div>
      ${self ? '<div class="help" style="margin-top:12px;text-align:center">내 계정의 권한은 다른 관리자만 바꿀 수 있어요.</div>' : ''}
      <div class="stack">${btns.join('')}</div>`,
    onMount(sheet, close) {
      sheet.addEventListener('click', async (e) => {
        const x = e.target.closest('[data-x]'); if (!x || x.disabled) return;
        const act = x.dataset.x;
        const n = u.display_name;
        try {
          if (act === 'memo') {
            x.disabled = true;
            await api.adminSetNote(u.id, $('#memo', sheet).value);
            x.disabled = false; toast('메모를 저장했어요'); return;
          }
          if (act === 'connect') { close(); showConnectFriends(u); return; }
          if (act === 'approve') {
            await api.adminSetStatus(u.id, 'active'); close(); toast(`${n}님의 가입을 승인했어요`);
          } else if (act === 'unsuspend') {
            await api.adminSetStatus(u.id, 'active'); close(); toast(`${n}님의 정지를 해제했어요`);
          } else if (act === 'suspend') {
            close();
            const pick = await askSuspend(n);
            if (!pick) return;
            await api.adminSuspend(u.id, pick.days, pick.reason);
            toast(pick.days ? `${n}님의 이용을 ${pick.days}일 동안 정지했어요` : `${n}님의 이용을 정지했어요 (영구)`);
          } else if (act === 'admin') {
            const on = !u.is_admin;
            await api.adminSetAdmin(u.id, on); close(); toast(on ? `${n}님을 관리자로 지정했어요` : `${n}님의 관리자 권한을 해제했어요`);
          } else if (act === 'reset') {
            close();
            if (!(await ask(`${n}님의 비밀번호를 초기화할까요?`, '임시 비밀번호가 발급되고 기존 비밀번호는 더 이상 쓸 수 없어요.', '초기화'))) return;
            showTempPassword(n, await api.adminResetPassword(u.id));
          } else if (act === 'clearphone') {
            close();
            if (!(await ask(`${n}님의 휴대폰 번호를 삭제할까요?`, '다른 사람 번호를 잘못 등록한 경우 등에 사용해요. 회원이 나중에 다시 등록할 수 있어요.', '삭제', true))) return;
            await api.adminClearPhone(u.id); toast(`${n}님의 휴대폰 번호를 삭제했어요`);
          } else if (act === 'delete') {
            close();
            const wipe = await askAdminDelete(n);
            if (wipe === null) return;
            await api.adminDeleteUser(u.id, wipe); toast(`${n}님을 탈퇴 처리했어요`);
            cleanOrphans(true);
          }
          adminAfterChange();
        } catch (ex) { x.disabled = false; showErr(ex); }
      });
    },
  });
}
// 회원 상태가 바뀐 뒤: 목록·배지·현황 새로
function adminAfterChange() {
  if (!S.admin) return;
  refreshAdminBadges();
  S.admin.dash = null;
  if (S.admin.sec === 'members') loadMembers(true);
  else if (S.admin.sec === 'home') renderHomeSec();
  else { S.admin.members.loaded = false; }
}
// 정지 기간 고르기 → { days(null=영구), reason } 또는 null(취소)
function askSuspend(name) {
  return new Promise((resolve) => {
    let done = false;
    openSheet({
      title: `${name}님 이용 정지`,
      body: `<p class="sheet-desc">정지 기간에는 로그인과 대화를 할 수 없어요. 기간이 끝나면 자동으로 풀려요.</p>
        <div class="reason-list" role="radiogroup" aria-label="정지 기간">${[[1, '1일'], [3, '3일'], [7, '7일'], [30, '30일'], ['', '영구 (직접 풀 때까지)']].map(([v, l], i) => `<label class="reason"><input type="radio" name="days" value="${v}" ${i === 2 ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
        <input class="input" id="susReason" maxlength="300" placeholder="사유 (관리자만 봐요, 선택)" style="margin-top:12px">
        <div class="two" style="margin-top:16px"><button class="btn gray" data-no>취소</button><button class="btn danger" data-yes>정지</button></div>`,
      onMount(el, close) {
        $('[data-no]', el).onclick = () => close();
        $('[data-yes]', el).onclick = () => {
          const v = $('input[name=days]:checked', el).value;
          done = true; close(); resolve({ days: v ? Number(v) : null, reason: $('#susReason', el).value.trim() });
        };
        onSheetGone(el, () => { if (!done) resolve(null); });
      },
    });
  });
}

// ---------- 신고 ----------
const REASON_LABEL = Object.fromEntries(REPORT_REASONS);
const ACTION_LABEL = { dismiss: '문제 없음', delete: '메시지 삭제', suspend: '이용 정지', both: '메시지 삭제 + 이용 정지' };
function showReportsAdmin(status = 'open') {
  if (S.admin) S.admin.reports.status = status;
  else S.pendingReportsStatus = status;
  adminGo('reports');
}
async function renderReportsSec() {
  const A = S.admin;
  if (S.pendingReportsStatus) { A.reports.status = S.pendingReportsStatus; S.pendingReportsStatus = null; }
  const status = A.reports.status;
  admLoading();
  let rows;
  try { rows = await api.adminListReports(status); } catch (e) { if (S.admin && A.sec === 'reports') admError(e); return; }
  if (!S.admin || A.sec !== 'reports' || !admMain()) return;
  const kindTxt = (r) => (r.message_id == null ? '회원 신고' : r.message_kind === 'image' ? '사진' : r.message_kind === 'file' ? '파일' : r.message_kind === 'sticker' ? '이모티콘' : r.message_kind === 'contact' ? '연락처' : '메시지');
  admMain().innerHTML = `<div class="adm-sec">
    <div class="adm-h"><h2>신고</h2></div>
    <div class="seg" style="margin-bottom:12px;max-width:420px"><button type="button" data-act="admin-rep-tab" data-s="open" class="${status === 'open' ? 'on' : ''}">처리 대기</button><button type="button" data-act="admin-rep-tab" data-s="done" class="${status === 'done' ? 'on' : ''}">처리 완료</button></div>
    <div class="rep-list">${rows.length ? rows.map((r) => `<div class="rep-card" data-id="${r.id}">
      <div class="rep-top"><span class="chip-lemon">${esc(REASON_LABEL[r.reason] || r.reason)}</span><span class="rep-kind">${kindTxt(r)}</span><span class="rep-time">${esc(fmtAgo(r.created_at))}</span></div>
      <div class="rep-who">${r.target_id ? `<button class="linkish" data-act="admin-user" data-id="${esc(r.target_id)}"><b>${esc(r.target_name || '(알 수 없음)')}</b></button>` : '<b>(탈퇴한 회원)</b>'}${r.target_username ? ` @${esc(r.target_username)}` : ''}${r.target_status === 'suspended' ? ' <span class="chip suspended">정지</span>' : ''} · 누적 신고 ${r.target_reports}건</div>
      ${r.message_id != null ? `<div class="rep-snap ${r.message_gone ? 'gone' : ''}">${r.message_kind === 'image' && r.media_path && !r.message_gone ? `<img alt="신고된 사진" data-path="${esc(r.media_path)}">` : esc(r.message_kind === 'file' ? `파일: ${r.snapshot}` : r.snapshot)}${r.message_gone ? '<span class="rep-gone">삭제됨</span>' : ''}</div>` : ''}
      ${r.detail ? `<div class="rep-detail">“${esc(r.detail)}”</div>` : ''}
      <div class="rep-by">신고: ${esc(r.reporter_name || '(탈퇴한 회원)')}</div>
      ${r.status === 'open' ? `<div class="rep-actions">
        <button class="btn line sm" data-act="admin-rep" data-a="dismiss">문제 없음</button>
        ${r.message_id != null && !r.message_gone ? '<button class="btn line sm" data-act="admin-rep" data-a="delete">메시지 삭제</button>' : ''}
        ${r.target_id && r.target_status !== 'suspended' ? '<button class="btn line sm danger-text" data-act="admin-rep" data-a="suspend">이용 정지</button>' : ''}
        ${r.message_id != null && !r.message_gone && r.target_id && r.target_status !== 'suspended' ? '<button class="btn danger sm" data-act="admin-rep" data-a="both">삭제 + 정지</button>' : ''}
      </div>` : `<div class="rep-done">${ic('check', 15)}${esc(ACTION_LABEL[r.action] || '처리됨')}</div>`}
    </div>`).join('') : `<div class="empty-line">${status === 'open' ? '처리할 신고가 없어요' : '처리한 신고가 없어요'}</div>`}</div></div>`;
  A.reports.rows = rows;
  const imgs = $$('#admMain img[data-path]');
  if (imgs.length) api.imageUrls(imgs.map((i) => i.dataset.path)).then((u) => imgs.forEach((i) => { if (u[i.dataset.path]) i.src = u[i.dataset.path]; })).catch(() => {});
}
async function resolveReport(btn) {
  const A = S.admin; if (!A) return;
  const r = (A.reports.rows || []).find((y) => String(y.id) === btn.closest('.rep-card').dataset.id);
  if (!r) return;
  const a = btn.dataset.a;
  let days = null;
  if (a === 'suspend' || a === 'both') {
    const pick = await askSuspend(r.target_name || '회원');
    if (!pick) return;
    days = pick.days;
    if (a === 'both' && !(await ask('메시지도 삭제할까요?', '모든 참여자 화면에서 "삭제된 메시지예요"로 바뀌어요.', '삭제 + 정지', true))) return;
  } else {
    const msg = {
      dismiss: ['문제 없음으로 처리할까요?', '신고를 닫고 아무 조치도 하지 않아요.', '처리', false],
      delete: ['이 메시지를 삭제할까요?', '모든 참여자 화면에서 "삭제된 메시지예요"로 바뀌어요.', '삭제', true],
    }[a];
    if (!(await ask(...msg))) return;
  }
  try {
    if ((a === 'delete' || a === 'both') && r.media_path) {
      await api.removeMedia([{ bucket: r.message_kind === 'image' ? 'chat-images' : 'chat-files', name: r.media_path }]).catch(() => {});
    }
    await api.adminResolveReport(r.id, a, days);
    toast(`${ACTION_LABEL[a]}(으)로 처리했어요`);
    refreshAdminBadges();
    if (S.admin && S.admin.sec === 'reports') renderReportsSec();
  } catch (ex) { showErr(ex); }
}
function onReport(p) {
  if (!S.me || !S.me.is_admin) return;
  S.openReports = Number(p.open) || 0;
  refreshAdminBadges();
  toast(`새 신고가 들어왔어요 (처리 대기 ${S.openReports}건)`, { onClick: () => { S.adminFromMore = !!S.entered; showReportsAdmin('open'); } });
}

// ---------- 문의 (관리자) ----------
async function renderInquiriesSec(append) {
  const A = S.admin; const Q = A.inquiries;
  if (!append) admLoading();
  let rows;
  try { rows = await api.adminListInquiries(Q.status, PAGE_SIZE, append ? Q.rows.length : 0); } catch (e) { if (S.admin && A.sec === 'inquiries') admError(e); return; }
  if (!S.admin || A.sec !== 'inquiries' || !admMain()) return;
  Q.rows = append ? Q.rows.concat(rows) : rows;
  Q.total = rows.length ? Number(rows[0].total) : (append ? Q.total : 0);
  const left = Q.total - Q.rows.length;
  admMain().innerHTML = `<div class="adm-sec">
    <div class="adm-h"><h2>문의</h2><span class="adm-date">${Q.total ? `${Q.total.toLocaleString()}건` : ''}</span></div>
    <div class="filters">${[['open', '답변 대기'], ['answered', '답변 완료'], ['closed', '종료'], ['all', '전체']].map(([k, l]) => `<button data-act="admin-inq-tab" data-s="${k}" class="${Q.status === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="card inq-list">${Q.rows.length ? Q.rows.map((q) => `<button class="inq-row" data-act="admin-inq" data-id="${q.id}">
        <div class="inq-l1"><span class="chip ${q.status === 'open' ? 'pending' : q.status === 'answered' ? 'active' : ''}">${INQ_ST[q.status]}</span><span class="inq-cat">${esc(INQ_CAT[q.category] || '')}</span>${q.admin_unread ? '<i class="dot" aria-label="새 글"></i>' : ''}<span class="inq-time">${esc(fmtAgo(q.updated_at))}</span></div>
        <b class="inq-title">${esc(q.title)}</b>
        <span class="inq-sub">${esc(q.display_name)} @${esc(q.username)} · ${q.last_from_admin ? '내 답변: ' : ''}${esc(String(q.last_body || '').replace(/\s+/g, ' ').slice(0, 60))}</span></button>`).join('')
    : `<div class="empty-line">${Q.status === 'open' ? '답변할 문의가 없어요' : '문의가 없어요'}</div>`}</div>
    ${left > 0 ? `<button class="btn line sm more-btn" data-act="admin-inq-more">더 보기 (${left}건 남음)</button>` : ''}</div>`;
}

// 문의 내용 보기 (회원·관리자 공용)
async function showInquiryThread(id, { admin = false } = {}) {
  let t;
  try { t = await api.inquiryThread(id); } catch (e) { showErr(e); return; }
  const closed = t.status === 'closed';
  openSheet({
    title: t.title,
    body: `<div class="inq-meta"><span class="chip ${t.status === 'open' ? 'pending' : t.status === 'answered' ? 'active' : ''}">${INQ_ST[t.status]}</span><span>${esc(INQ_CAT[t.category] || '')}</span><span>${fmtDT(t.created_at)}</span>
        ${admin && t.user ? `<button class="linkish" data-x="member">${esc(t.user.display_name)} @${esc(t.user.username)}</button>` : ''}</div>
      <div class="thread">${t.messages.map((m) => `<div class="tmsg ${m.from_admin ? 'adm' : 'usr'}"><span class="who">${m.from_admin ? `${esc(APP)} 운영팀` : admin ? esc(t.user ? t.user.display_name : '회원') : '나'}</span><div class="tb">${linkify(m.body)}</div><span class="tt">${fmtDT(m.created_at)}</span></div>`).join('')}</div>
      ${closed && !admin ? '<div class="empty-mini">종료된 문의예요. 더 궁금한 점은 새로 문의해 주세요.</div>' : `
      <textarea class="input memo" id="inqReply" maxlength="2000" rows="3" placeholder="${admin ? '답변을 입력하세요 (회원에게 알림이 가요)' : '추가로 문의할 내용을 입력하세요'}"></textarea>
      <div class="field-err" id="err-inq"></div>
      <div class="two" style="margin-top:10px">${closed ? '<span></span>' : `<button class="btn gray" data-x="close">${admin ? '문의 종료' : '해결됐어요 (종료)'}</button>`}<button class="btn" data-x="send">${admin ? '답변 보내기' : '보내기'}</button></div>`}`,
    onMount(sheet, close) {
      const th = $('.thread', sheet); if (th) th.scrollTop = th.scrollHeight;
      sheet.addEventListener('click', async (e) => {
        const x = e.target.closest('[data-x]'); if (!x) return;
        try {
          if (x.dataset.x === 'member') { close(); showAdminUser(t.user_id); return; }
          if (x.dataset.x === 'send') {
            const body = $('#inqReply', sheet).value.trim();
            if (!body) { $('#err-inq', sheet).innerHTML = `${ic('alert', 16, 'flex:none')}내용을 입력해 주세요`; return; }
            x.disabled = true;
            await api.replyInquiry(t.id, body);
            close(); toast(admin ? '답변을 보냈어요. 회원에게 알림이 가요' : '문의를 보냈어요');
          }
          if (x.dataset.x === 'close') {
            await api.closeInquiry(t.id); close(); toast('문의를 종료했어요');
          }
          if (admin) { refreshAdminBadges(); if (S.admin && S.admin.sec === 'inquiries') renderInquiriesSec(); }
          else loadMyInquiries().then(() => { if (S.tab === 'more' && !S.room) renderMain(); });
        } catch (ex) { x.disabled = false; showErr(ex); }
      });
    },
  });
  if (admin) refreshAdminBadges();
  else loadMyInquiries().then(() => { if (S.tab === 'more' && !S.room && !$('#admin:not([hidden])')) { const b = $('#inqBadge'); if (b) b.innerHTML = inqBadgeHtml(); } });
}
function onInquiryAdmin(p) {
  if (!S.me || !S.me.is_admin) return;
  S.openInquiries = Number(p.open) || 0;
  refreshAdminBadges();
  if (S.admin && S.admin.sec === 'inquiries' && !$('.sheet-back')) renderInquiriesSec();
  toast(`새 문의가 있어요 (답변 대기 ${S.openInquiries}건)`, { onClick: () => { S.adminFromMore = !!S.entered; if (S.admin) S.admin.inquiries.status = 'open'; adminGo('inquiries'); } });
}

// ---------- 운영 ----------
function renderOpsSec() {
  const d = S.admin.dash;
  const approval = d ? d.require_approval : (S.admin.settings ? S.admin.settings.require_approval : false);
  admMain().innerHTML = `<div class="adm-sec">
    <div class="adm-h"><h2>운영</h2></div>
    <div class="card adm-card">
      <div class="item" style="padding-top:14px;padding-bottom:14px"><span class="label">가입 승인제<span class="sub">${approval ? '켜져 있어요 · 새 회원은 관리자 승인 후 이용할 수 있어요' : '꺼져 있어요 · 가입하면 바로 이용할 수 있어요'}</span></span>
        <button class="switch ${approval ? 'on' : ''}" data-act="admin-approval" role="switch" aria-checked="${approval}" aria-label="가입 승인제"></button></div>
      <button class="item" data-act="admin-notice"><span class="tile mint">${ic('mega', 19)}</span><span class="label">전체 공지 보내기<span class="sub">모든 회원의 공지사항 방에 글을 올려요</span></span>${ic('chev', 18, 'color:#A3ABB6;flex:none')}</button>
      <button class="item" data-act="admin-ads"><span class="tile lav">${ic('gift', 19)}</span><span class="label">광고 관리<span class="sub">광고 탭에 보일 이미지와 링크를 등록해요</span></span>${ic('chev', 18, 'color:#A3ABB6;flex:none')}</button>
      <button class="item" data-act="admin-words"><span class="tile peach">${ic('ban', 19)}</span><span class="label">금칙어 관리<span class="sub">욕설 등 부적절한 말을 * 로 가려요</span></span>${ic('chev', 18, 'color:#A3ABB6;flex:none')}</button>
      <button class="item" data-act="admin-clean" style="padding-top:14px;padding-bottom:14px"><span class="tile sky">${ic('file', 19)}</span><span class="label">남은 사진·파일 정리<span class="sub">없어진 대화방에 남아 있는 사진·파일을 저장 공간에서 지워요</span></span>${ic('chev', 18, 'color:#A3ABB6;flex:none')}</button>
    </div></div>`;
  if (!d) api.adminDashboard().then((x) => { if (S.admin) { S.admin.dash = x; if (S.admin.sec === 'ops') renderOpsSec(); } }).catch(() => {});
}

// ---------- 회원: 1:1 문의 ----------
const inqBadgeHtml = () => (S.inqUnread ? `<span class="chip-lemon">답변 ${S.inqUnread}</span>` : '');
async function loadMyInquiries() {
  if (!api.myInquiries) return [];
  try { S.myInq = await api.myInquiries(); } catch { S.myInq = S.myInq || []; }
  S.inqUnread = (S.myInq || []).filter((q) => q.user_unread).length;
  return S.myInq;
}
async function showMyInquiries() {
  const list = await loadMyInquiries();
  openSheet({
    title: '1:1 문의',
    body: `<p class="sheet-desc">궁금한 점이나 불편한 점을 남겨 주세요. 답변이 오면 알려 드려요.${CONTACT ? ` 이메일 <b>${esc(CONTACT)}</b> 로도 문의할 수 있어요.` : ''}</p>
      <button class="btn" data-x="new">${ic('pencil', 18)}새 문의 쓰기</button>
      <div class="card inq-list" style="margin-top:14px">${list.length ? list.map((q) => `<button class="inq-row" data-x="open" data-id="${q.id}">
        <div class="inq-l1"><span class="chip ${q.status === 'open' ? 'pending' : q.status === 'answered' ? 'active' : ''}">${INQ_ST[q.status]}</span><span class="inq-cat">${esc(INQ_CAT[q.category] || '')}</span>${q.user_unread ? '<i class="dot" aria-label="새 답변"></i>' : ''}<span class="inq-time">${esc(fmtAgo(q.updated_at))}</span></div>
        <b class="inq-title">${esc(q.title)}</b><span class="inq-sub">${q.last_from_admin ? '운영팀: ' : ''}${esc(String(q.last_body || '').replace(/\s+/g, ' ').slice(0, 60))}</span></button>`).join('')
    : '<div class="empty-line">아직 문의한 내용이 없어요</div>'}</div>`,
    onMount(sheet, close) {
      sheet.addEventListener('click', (e) => {
        const x = e.target.closest('[data-x]'); if (!x) return;
        close();
        if (x.dataset.x === 'new') showNewInquiry();
        if (x.dataset.x === 'open') showInquiryThread(Number(x.dataset.id));
      });
    },
  });
}
function showNewInquiry() {
  openSheet({
    title: '새 문의',
    body: `<div class="auth-fields">
        <div class="field" data-field="inqCat"><label>문의 종류</label><div class="filters inq-cats">${INQ_CATS.map(([k, l]) => `<button type="button" data-cat="${k}">${l}</button>`).join('')}</div><div class="field-err" id="err-inqCat"></div></div>
        <div class="field" data-field="inqTitle"><label for="inqTitle">제목</label><input class="input" id="inqTitle" maxlength="60" placeholder="한 줄로 적어 주세요"><div class="field-err" id="err-inqTitle"></div></div>
        <div class="field" data-field="inqBody"><label for="inqBody">내용</label><textarea class="input memo" id="inqBody" maxlength="2000" rows="6" placeholder="언제, 어떤 화면에서, 어떤 일이 있었는지 적어 주시면 빨리 도와드릴 수 있어요. 비밀번호는 적지 마세요."></textarea><div class="field-err" id="err-inqBody"></div></div>
      </div>
      <button class="btn" data-x="send" style="margin-top:14px">보내기</button>`,
    onMount(sheet, close) {
      let cat = null;
      sheet.addEventListener('click', async (e) => {
        const c = e.target.closest('[data-cat]');
        if (c) { cat = c.dataset.cat; $$('[data-cat]', sheet).forEach((b) => b.classList.toggle('on', b === c)); setFieldErr(sheet, 'inqCat', ''); return; }
        const x = e.target.closest('[data-x="send"]'); if (!x) return;
        const title = $('#inqTitle', sheet).value.trim(); const body = $('#inqBody', sheet).value.trim();
        setFieldErr(sheet, 'inqCat', cat ? '' : '문의 종류를 골라 주세요');
        setFieldErr(sheet, 'inqTitle', title ? '' : '제목을 입력해 주세요');
        setFieldErr(sheet, 'inqBody', body ? '' : '내용을 입력해 주세요');
        if (!cat || !title || !body) return;
        x.disabled = true;
        try {
          await api.createInquiry({ category: cat, title, body });
          close(); toast('문의를 보냈어요. 답변이 오면 알려 드려요');
          await loadMyInquiries();
          if (S.tab === 'more' && !S.room) renderMain();
        } catch (ex) { x.disabled = false; showErr(ex); }
      });
      $('#inqTitle', sheet).oninput = () => setFieldErr(sheet, 'inqTitle', '');
      $('#inqBody', sheet).oninput = () => setFieldErr(sheet, 'inqBody', '');
    },
  });
}
function onInquiry(p) {
  S.inqUnread = (S.inqUnread || 0) + 1;
  const b = $('#inqBadge'); if (b) b.innerHTML = inqBadgeHtml();
  toast(`문의에 답변이 왔어요: ${String(p.title || '').slice(0, 20)}`, { onClick: () => showInquiryThread(Number(p.id)) });
}

// ---------------------------------------------------------------------
// v1.14: 친구 초대 링크·QR — 링크를 누르면(QR 을 찍으면) 바로 서로 친구
// ---------------------------------------------------------------------
const INVITE_KEY = 'minitalk-invite';
const INVITE_RE = /^#\/add\/([a-z0-9]{10,20})$/i;
const inviteUrl = (code) => new URL('./', location.href).href + '#/add/' + code;
function savePendingInvite(code) { try { localStorage.setItem(INVITE_KEY, String(code).toLowerCase()); } catch { S.pendingInvite = String(code).toLowerCase(); } }
function takePendingInvite() {
  let c = S.pendingInvite || null;
  try { c = localStorage.getItem(INVITE_KEY) || c; localStorage.removeItem(INVITE_KEY); } catch { /* 저장 안 됨 */ }
  S.pendingInvite = null;
  return c;
}
function peekPendingInvite() { try { return localStorage.getItem(INVITE_KEY) || S.pendingInvite; } catch { return S.pendingInvite; } }
// 주소창에 초대 링크가 있으면 기억해 두고 주소는 정리 (로그인 전이어도)
function captureInviteFromUrl() {
  const m = location.hash.match(INVITE_RE);
  if (!m) return false;
  savePendingInvite(m[1]);
  history.replaceState(null, '', location.pathname + location.search + '#/friends');
  return true;
}

// 로그인 화면 위쪽: "○○님이 초대했어요"
async function showInviteBanner() {
  const code = peekPendingInvite(); if (!code) return;
  let p = null;
  try { p = await api.invitePreview(code); } catch { /* 무시 */ }
  const card = $('.auth-card'); if (!card || $('#inviteBanner')) return;
  card.insertAdjacentHTML('beforebegin', `<div class="invite-banner" id="inviteBanner">${p ? av(p, 44) : `<span class="tile mint">${ic('userplus', 22)}</span>`}
    <div><b>${p ? `${esc(p.display_name)}님이 초대했어요` : '친구 초대 링크로 들어왔어요'}</b><span>가입하거나 로그인하면 바로 친구가 돼요</span></div></div>`);
}

// 로그인한 뒤 기억해 둔 초대 처리
async function handlePendingInvite() {
  const code = takePendingInvite(); if (!code || !S.entered) return;
  let p = null;
  try { p = await api.invitePreview(code); } catch (e) { showErr(e); return; }
  if (!p) { toast('초대 링크가 바뀌었거나 사용할 수 없어요. 새 링크를 받아 주세요', { error: true, ms: 4000 }); return; }
  if (p.id === S.uid) { toast('내 초대 링크예요. 친구에게 보내 주세요'); return; }
  cacheProfile(p);
  const already = S.friends.some((f) => f.id === p.id && f.mutual !== false);
  openSheet({
    title: '친구 초대', bare: true,
    body: `<div class="invite-accept">${av(p, 84)}<b class="nm">${esc(p.display_name)}</b><span class="id">@${esc(p.username)}</span>
        ${p.status_message ? `<span class="st">${esc(p.status_message)}</span>` : ''}
        <p id="invMsg">${already ? '이미 서로 친구예요.' : `${esc(p.display_name)}님이 ${esc(APP)}에 초대했어요.<br>친구로 추가하면 바로 대화할 수 있어요.`}</p></div>
      <div class="btn-col" id="invBtns">${already
    ? `<button class="btn" data-x="chat">${ic('chat', 20)}1:1 대화하기</button><button class="btn text" data-close>닫기</button>`
    : `<button class="btn" data-x="accept">${ic('userplus', 20)}친구 추가</button><button class="btn text" data-close>나중에</button>`}</div>`,
    onMount(sheet, close) {
      sheet.addEventListener('click', async (e) => {
        const x = e.target.closest('[data-x]'); if (!x) return;
        if (x.dataset.x === 'chat') {
          x.disabled = true;
          try { const rid = await api.openDM(p.id); close(); goRoom(rid); } catch (ex) { x.disabled = false; showErr(ex); }
          return;
        }
        x.disabled = true; x.innerHTML = '<span class="spin-sm"></span>';
        try {
          await api.acceptInvite(code);
          await loadFriends(); loadSuggestions(); loadRequests();
          if (S.tab === 'friends' && !S.room) renderMain();
          $('#invMsg', sheet).innerHTML = `${esc(p.display_name)}님과 이제 <b>서로 친구</b>예요.<br>바로 대화를 시작해 보세요.`;
          $('#invBtns', sheet).innerHTML = `<button class="btn" data-x="chat">${ic('chat', 20)}1:1 대화하기</button><button class="btn text" data-close>닫기</button>`;
        } catch (ex) { x.disabled = false; x.innerHTML = `${ic('userplus', 20)}친구 추가`; showErr(ex); }
      });
    },
  });
}

// 내 초대 링크·QR 보여 주기
async function showInvite() {
  let code = null;
  openSheet({
    title: '친구 초대',
    body: `<div class="sub-text">링크를 보내거나 QR 코드를 보여 주세요. 상대가 누르거나 찍으면 바로 서로 친구가 돼요.</div>
      <div class="qr-box" id="qrBox"><div class="spinner"></div></div>
      <div class="qr-link" id="qrLink"></div>
      <div class="two" style="margin-top:14px"><button class="btn" data-x="share" disabled>${ic('share', 20)}링크 보내기</button><button class="btn soft" data-x="copy" disabled>${ic('copy', 20)}링크 복사</button></div>
      <div class="invite-foot"><span>링크가 원치 않는 사람에게 퍼졌다면</span><button class="link-btn" data-x="reset">새 링크 만들기</button></div>`,
    async onMount(sheet, close) {
      const draw = () => {
        const url = inviteUrl(code);
        $('#qrBox', sheet).innerHTML = qrSvg(url, 208) + `<div class="qr-cap">${av(S.me, 28)}<b>${esc(S.me.display_name)}</b><span>@${esc(S.me.username)}</span></div>`;
        $('#qrLink', sheet).textContent = url;
        $$('[data-x=share], [data-x=copy]', sheet).forEach((b) => { b.disabled = false; });
      };
      sheet.addEventListener('click', async (e) => {
        const x = e.target.closest('[data-x]'); if (!x || !code) return;
        const url = inviteUrl(code);
        const text = `${S.me.display_name}님이 ${APP}에 초대했어요. 링크를 누르면 바로 친구가 돼요.`;
        if (x.dataset.x === 'share') {
          try { if (navigator.share) { await navigator.share({ title: `${APP} 친구 초대`, text, url }); return; } } catch (ex) { if (ex && ex.name === 'AbortError') return; }
          try { await navigator.clipboard.writeText(`${text}\n${url}`); toast('초대 링크를 복사했어요. 메신저나 문자에 붙여 넣어 보내세요'); } catch { toast('링크를 길게 눌러 복사해 주세요', { error: true }); }
        }
        if (x.dataset.x === 'copy') {
          try { await navigator.clipboard.writeText(url); toast('초대 링크를 복사했어요'); } catch { toast('링크를 길게 눌러 복사해 주세요', { error: true }); }
        }
        if (x.dataset.x === 'reset') {
          close();
          if (!(await ask('새 초대 링크를 만들까요?', '지금까지 보낸 링크와 QR 코드는 더 이상 쓸 수 없어요. 이미 친구가 된 사람은 그대로예요.', '새로 만들기'))) return;
          try { await api.resetInviteCode(); toast('새 초대 링크를 만들었어요'); showInvite(); } catch (ex) { showErr(ex); }
        }
      });
      try { code = await api.myInviteCode(); if (sheet.isConnected) draw(); }
      catch (ex) { const b = $('#qrBox', sheet); if (b) b.innerHTML = `<div class="empty-line">${esc(ex.message || '불러오지 못했어요')}</div>`; }
    },
  });
}

// v1.13: 관리자가 회원끼리 친구로 연결
async function showConnectFriends(u) {
  let rel;
  try { rel = await api.adminUserFriends(u.id); } catch (e) { showErr(e); return; }
  const relMap = new Map((rel || []).map((r) => [r.id, r]));
  // v1.18: 회원이 많아도 되게 서버에서 검색 (이름순 200명까지)
  let people = [];
  const known = new Map();
  const fetchPeople = async (t) => {
    const rows = await api.adminMemberPage({ q: t, filter: 'all', sort: 'name', limit: 200 });
    people = rows.filter((x) => x.id !== u.id && x.status === 'active')
      .sort((a, b) => {
        const ra = relMap.get(a.id); const rb = relMap.get(b.id);
        const k = (r) => (r && r.added && r.added_me ? 2 : 0);   // 이미 친구는 아래로
        return k(ra) - k(rb) || a.display_name.localeCompare(b.display_name, 'ko');
      });
    people.forEach((x) => known.set(x.id, x));
  };
  try { await fetchPeople(''); } catch (e) { showErr(e); return; }
  const sel = [];
  const state = (x) => { const r = relMap.get(x.id); return r && r.added && r.added_me ? 'mutual' : r && (r.added || r.added_me) ? 'oneway' : ''; };
  openSheet({
    title: `${u.display_name}님과 친구 연결`,
    body: `<div class="sub-text">고른 회원과 ${esc(u.display_name)}님을 <b>서로 친구</b>로 바로 연결해요. 양쪽 모두에게 알림이 가고, 바로 대화할 수 있어요.</div>
      <label class="search" style="margin:0 0 10px">${ic('search', 20, 'flex:none')}<input id="cnSearch" placeholder="이름·아이디 검색" autocapitalize="off" spellcheck="false"></label>
      <div class="sel-chips" id="cnChips" hidden></div>
      <div class="pick-list bleed" id="cnList" style="max-height:320px"></div>
      <button class="btn" id="cnOk" disabled style="margin-top:14px">연결할 회원을 고르세요</button>`,
    onMount(sheet, close) {
      const list = $('#cnList', sheet); const chips = $('#cnChips', sheet); const ok = $('#cnOk', sheet); const q = $('#cnSearch', sheet);
      const draw = () => {
        const shown = people;
        list.innerHTML = shown.length ? shown.map((x) => {
          const st = state(x); const on = sel.includes(x.id);
          return `<button class="pick ${on ? 'on' : ''} ${st === 'mutual' ? 'done' : ''}" data-cn="${esc(x.id)}" role="checkbox" aria-checked="${on}" ${st === 'mutual' ? 'disabled' : ''}>${av(x, 44)}
            <span class="nm"><span class="cn-n">${esc(x.display_name)}</span><span class="cn-d">@${esc(x.username)}${st === 'oneway' ? ' · 한쪽만 추가된 상태' : ''}</span></span>
            ${st === 'mutual' ? '<span class="cres-tag">이미 친구</span>' : `<span class="ck">${ic('check', 16)}</span>`}</button>`;
        }).join('') : '<div class="empty-line">연결할 수 있는 회원이 없어요</div>';
        chips.hidden = !sel.length;
        chips.innerHTML = sel.map((id) => { const x = known.get(id); return `<button class="sel-chip" data-uncn="${esc(id)}" aria-label="${esc(x.display_name)} 선택 해제">${av(x, 32)}${esc(x.display_name)}${ic('x', 14)}</button>`; }).join('');
        ok.disabled = !sel.length;
        ok.textContent = sel.length ? `${sel.length}명과 친구로 연결` : '연결할 회원을 고르세요';
      };
      let qt = null;
      q.oninput = () => { clearTimeout(qt); qt = setTimeout(() => { fetchPeople(q.value.trim()).then(draw).catch(showErr); }, 300); };
      sheet.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-cn]'); const c = e.target.closest('[data-uncn]');
        const id = b ? b.dataset.cn : c ? c.dataset.uncn : null;
        if (id && !(b && b.disabled)) { const i = sel.indexOf(id); if (i >= 0) sel.splice(i, 1); else if (b) sel.push(id); draw(); return; }
        if (e.target.closest('#cnOk') && sel.length) {
          ok.disabled = true; ok.innerHTML = '<span class="spin-sm"></span>';
          try {
            const n = await api.adminConnectFriends(u.id, sel);
            close();
            toast(n ? `${u.display_name}님과 ${n}명을 서로 친구로 연결했어요` : '이미 모두 친구예요', { ms: 3200 });
            if (u.id === S.uid || sel.includes(S.uid)) { loadFriends().then(() => { if (S.tab === 'friends' && !S.room) renderMain(); }).catch(() => {}); }
            adminAfterChange();
          } catch (ex) { draw(); showErr(ex); }
        }
      });
      draw();
    },
  });
}

// 관리자가 나를 누군가와 친구로 연결해 줬을 때
function onConnected(p) {
  cacheProfile({ id: p.friend_id, display_name: p.display_name, username: p.username });
  loadFriends().then(() => { if (S.tab === 'friends' && !S.room && $('#main')) renderMain(); }).catch(() => {});
  loadSuggestions(); loadRequests();
  const person = { id: p.friend_id, display_name: p.display_name || '회원' };
  const invite = p.via === 'invite';
  const text = invite ? `${person.display_name}님이 내 초대 링크로 친구가 됐어요. 이제 대화할 수 있어요`
    : `관리자가 ${person.display_name}님과 친구로 연결해 줬어요. 이제 대화할 수 있어요`;
  if (document.hidden) {
    if (S.pushOn) return;   // 서버 알림이 대신 보여 줌
    if ('Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker) {
      navigator.serviceWorker.ready.then((reg) => reg.showNotification(invite ? '새 친구' : '친구 연결', { body: text, tag: 'conn-' + p.friend_id, icon: './icons/icon-192.png', badge: './icons/badge-72.png', data: { url: './#/friends' } })).catch(() => {});
    }
    return;
  }
  toastMsg({ person, title: invite ? '새 친구' : '친구 연결', body: text, onClick: () => showProfile(p.friend_id) });
}

function showTempPassword(name, pw) {
  openSheet({
    title: '임시 비밀번호', bare: true,
    body: `<div style="display:flex;flex-direction:column;align-items:center;text-align:center;padding-top:16px">
        <div class="key-icon">${ic('key', 30)}</div>
        <h3 style="font-size:19px;font-weight:700;margin:14px 0 0;letter-spacing:-0.4px">임시 비밀번호가 발급됐어요</h3>
        <p style="font-size:14px;color:var(--ink2);margin:8px 0 0;line-height:1.6">${esc(name)}님에게 전달해 주세요. 로그인 후 바로 새 비밀번호로 바꾸도록 안내해 주세요.</p>
        <div class="temp-pw" id="tempPw">${esc(pw)}</div></div>
      <button class="btn" data-copy style="margin-top:16px">${ic('copy', 20)}복사하기</button>
      <button class="btn text" data-close style="margin-top:6px">닫기</button>`,
    onMount(sheet) {
      $('[data-copy]', sheet).onclick = async (e) => {
        const b = e.currentTarget;
        try { await navigator.clipboard.writeText(pw); } catch { toast('복사하지 못했어요. 직접 적어 주세요', { error: true }); return; }
        b.style.background = 'var(--mint-bubble)'; b.innerHTML = `${ic('check', 20)}복사했어요`;
        toast('임시 비밀번호를 복사했어요');
      };
    },
  });
}

function showBroadcast() {
  openSheet({
    title: '전체 공지 보내기',
    body: `<div class="sub-text" style="margin-bottom:14px">모든 회원의 공지사항 방에 바로 전달돼요. 첫 줄은 제목처럼 굵게 보여요.</div>
      <div class="compose-box"><textarea id="noticeText" maxlength="500" placeholder="공지 내용을 입력하세요"></textarea><div class="counter" id="ncCount">0/500</div></div>
      <button class="btn" id="noticeSend" disabled style="margin-top:16px">${ic('mega', 20)}공지 보내기</button>`,
    onMount(sheet, close) {
      const ta = $('#noticeText', sheet); const btn = $('#noticeSend', sheet);
      setTimeout(() => ta.focus(), 50);
      ta.oninput = () => { btn.disabled = !ta.value.trim(); $('#ncCount', sheet).textContent = `${ta.value.length}/500`; };
      btn.onclick = async () => {
        btn.disabled = true;
        try {
          const rid = await api.adminBroadcast(ta.value.trim());
          close(); refreshRoomsSoon();
          toast('모든 회원에게 공지를 보냈어요', { onClick: () => goRoom(rid) });
        } catch (e) { btn.disabled = false; showErr(e); }
      };
    },
  });
}

// ---------------------------------------------------------------------
// 클릭 처리 (한 곳에서)
// ---------------------------------------------------------------------
app.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || !app.contains(el)) return;
  const act = el.dataset.act;
  switch (act) {
    case 'tab': go('#/' + el.dataset.tab); break;
    case 'profile': if (el.dataset.id) showProfile(el.dataset.id); break;
    case 'add-friend': showAddFriend(); break;
    case 'new-chat': newChat(); break;
    case 'open-room': goRoom(el.dataset.id); break;
    case 'room-back': backFromRoom(); break;
    case 'room-menu': showRoomMenu(); break;
    case 'to-bottom': scrollBottom(); break;
    case 'send': sendComposer(); break;
    case 'stickers': toggleStickers(); break;
    case 'replay-sticker':
      el.classList.remove('play'); void el.offsetWidth; el.classList.add('play');
      break;
    case 'pick-sticker': pickSticker(el.dataset.id); break;
    case 'unpick-sticker': unpickSticker(); break;
    case 'invite': showInvite(); break;
    case 'phone': showPhone(); break;
    case 'sug-add': {
      const g = S.suggestions.find((x) => x.id === el.dataset.id);
      el.disabled = true;
      try { await api.addFriend(el.dataset.id); await loadFriends(); await loadSuggestions(); friendAddedToast(el.dataset.id, g ? g.display_name : '친구'); }
      catch (ex) { el.disabled = false; showErr(ex); }
      break;
    }
    case 'chat-filter': S.chatFilter = el.dataset.f; renderMain(); break;
    case 'req-accept': {
      const g = S.requests.find((x) => x.id === el.dataset.id);
      el.disabled = true;
      try { await api.addFriend(el.dataset.id); await loadFriends(); await loadRequests(); loadSuggestions(); friendAddedToast(el.dataset.id, g ? g.display_name : '친구'); }
      catch (ex) { el.disabled = false; showErr(ex); }
      break;
    }
    case 'req-hide': {
      const id = el.dataset.id;
      try { await api.dismissRequest(id); S.requests = S.requests.filter((x) => x.id !== id); updateFriendBadge(); renderMain(); toast('친구 요청을 숨겼어요. 상대에게는 알리지 않아요'); }
      catch (ex) { showErr(ex); }
      break;
    }
    case 'sug-hide': {
      const id = el.dataset.id;
      try { await api.dismissSuggestion(id); S.suggestions = S.suggestions.filter((x) => x.id !== id); renderMain(); toast('추천 친구에서 숨겼어요'); }
      catch (ex) { showErr(ex); }
      break;
    }
    case 'pick-photo': $('#photoInput').click(); break;
    case 'attach': showAttach(); break;
    case 'room-mute': if (S.room) toggleRoomMute(S.room.id, !isMuted(S.room.id)); break;
    case 'react': { const m = S.room && S.room.msgs.find((x) => String(x.id) === el.dataset.id); if (m) toggleReact(m, el.dataset.e); break; }
    case 'jump-reply': jumpTo(el.dataset.id); break;
    case 'cancel-reply': cancelReply(); break;
    case 'open-file': { const m = S.room && S.room.msgs.find((x) => String(x.id) === el.dataset.id); if (m) openFile(m); break; }
    case 'save-contact': { const m = S.room && S.room.msgs.find((x) => String(x.id) === el.dataset.id); if (m) saveContact(m); break; }
    case 'view-img': showImage(el); break;
    case 'retry': {
      const m = S.room && S.room.msgs.find((x) => String(x.id) === el.dataset.id);
      if (!m) break;
      if (m.kind === 'image') sendPhoto(null, m); else if (m.kind === 'sticker') sendSticker(null, m);
      else if (m.kind === 'file') sendFileMsg(null, m); else if (m.kind === 'contact') sendContactMsg(null, m); else sendText(m);
      break;
    }
    case 'edit-profile': showEditProfile(); break;
    case 'copy-id':
      try { await navigator.clipboard.writeText(S.me.username); toast('아이디를 복사했어요'); }
      catch { toast(`내 아이디: @${S.me.username}`); }
      break;
    case 'change-password': showChangePassword(); break;
    case 'install': showInstall(); break;
    case 'open-admin': S.adminFromMore = true; go('#/admin'); break;
    case 'admin-back':   // v1.18: 관리자 안에서 메뉴를 옮겨 다녀도 한 번에 더보기로
      S.adminFromMore = false; location.replace('#/more');
      break;
    case 'admin-filter':
      if (S.admin) { S.admin.members.filter = el.dataset.f; $$('.filters [data-act=admin-filter]').forEach((b) => b.classList.toggle('on', b === el)); loadMembers(true); }
      break;
    // v1.18: 관리자 화면 이동·동작
    case 'admin-sec': adminGo(el.dataset.s); break;
    case 'admin-todo':
      if (S.admin && el.dataset.s === 'members') { S.admin.members.filter = el.dataset.f || 'all'; S.admin.members.loaded = false; }
      if (S.admin && el.dataset.s === 'inquiries') S.admin.inquiries.status = 'open';
      if (S.admin && el.dataset.s === 'reports') S.admin.reports.status = 'open';
      if (S.admin && S.admin.sec === el.dataset.s) renderAdminSection(); else adminGo(el.dataset.s);
      break;
    case 'admin-refresh':
      if (S.admin) { S.admin.dash = null; S.admin.members.loaded = false; refreshAdminBadges(); renderAdminSection(); }
      break;
    case 'admin-chart':
      if (S.admin && S.admin.dash) { S.admin.chart = el.dataset.k; $$('[data-act=admin-chart]').forEach((b) => b.classList.toggle('on', b === el)); const c = $('#admChart'); if (c) c.innerHTML = chartSvg(S.admin.dash.series || [], S.admin.chart); const n = $('.chart-note'); if (n) n.hidden = S.admin.chart !== 'active'; }
      break;
    case 'admin-more': loadMembers(false); break;
    case 'admin-rep-tab': if (S.admin) { S.admin.reports.status = el.dataset.s; renderReportsSec(); } break;
    case 'admin-rep': resolveReport(el); break;
    case 'admin-inq-tab': if (S.admin) { S.admin.inquiries.status = el.dataset.s; renderInquiriesSec(); } break;
    case 'admin-inq-more': renderInquiriesSec(true); break;
    case 'admin-inq': showInquiryThread(Number(el.dataset.id), { admin: true }); break;
    case 'my-inquiries': showMyInquiries(); break;
    case 'admin-user': showAdminUser(el.dataset.id); break;
    case 'admin-notice': showBroadcast(); break;
    case 'admin-clean': cleanOrphans(false, el); break;
    case 'admin-ads': showAdsAdmin(); break;
    case 'admin-reports': showReportsAdmin('open'); break;
    case 'admin-words': showWordsAdmin(); break;
    case 'blocks': showBlocks(); break;
    case 'contact-support': contactSupport(); break;
    case 'withdraw': showWithdraw(); break;
    case 'open-ad': openAd(el.dataset.id); break;
    case 'ads-reload': S.adsLoaded = false; renderMain(); loadAds(); break;
    case 'admin-approval': {
      if (!S.admin || !S.admin.dash) break;
      const on = !S.admin.dash.require_approval;
      if (!(await ask(on ? '가입 승인제를 켤까요?' : '가입 승인제를 끌까요?',
        on ? '이제부터 새로 가입한 사람은 관리자가 승인해야 이용할 수 있어요. 이미 가입한 회원은 그대로예요.' : '이제부터 누구나 가입하면 바로 이용할 수 있어요. 승인 대기 중인 회원은 직접 승인해 주세요.',
        on ? '켜기' : '끄기'))) break;
      try { await api.adminSetApproval(on); toast(on ? '가입 승인제를 켰어요' : '가입 승인제를 껐어요'); S.admin.dash.require_approval = on; renderOpsSec(); }
      catch (ex) { showErr(ex); }
      break;
    }
    case 'notif': {
      if (!('Notification' in window)) { toast('이 브라우저는 알림을 지원하지 않아요. 아이폰은 홈 화면에 추가한 뒤 사용할 수 있어요', { error: true, ms: 4500 }); break; }
      if (Notification.permission === 'denied') { toast('알림이 차단되어 있어요. 브라우저 설정에서 이 사이트의 알림을 허용해 주세요', { error: true, ms: 5000 }); break; }
      el.disabled = true;
      try {
        if (push.supported()) {
          if (S.pushOn) { await disablePush(); toast('알림을 껐어요'); }
          else toast((await enablePush()) ? '알림을 켰어요' : '알림 권한이 허용되지 않았어요', { error: !S.pushOn });
        } else if (Notification.permission === 'granted') {
          toast('앱이 열려 있을 때 알림이 와요. 끄려면 브라우저 설정에서 바꿔 주세요');
        } else {
          const p = await Notification.requestPermission();
          toast(p === 'granted' ? '알림을 켰어요' : '알림 권한이 허용되지 않았어요', { error: p !== 'granted' });
        }
      } catch (ex) { showErr(ex); }
      renderMain();
      break;
    }
    case 'logout':
      if (await ask('로그아웃할까요?', '다시 로그인하면 대화를 이어서 볼 수 있어요. 이 기기로는 알림이 오지 않게 돼요.', '로그아웃')) { await detachPush(); await api.signOut(); leaveApp(); }
      break;
    default: break;
  }
});

// ---------------------------------------------------------------------
// 설치(PWA)·알림 클릭 연결
// ---------------------------------------------------------------------
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); S.installEvt = e; });
if ('serviceWorker' in navigator && !window.__MINITALK_API__) {
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW 등록 실패', e));
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'open' && e.data.hash) go(e.data.hash);
    if (e.data && e.data.type === 'resubscribed' && S.entered) enablePush({ silent: true }).catch(() => {});
  });
}

boot();
