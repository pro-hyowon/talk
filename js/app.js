// =====================================================================
//  미니톡 — 화면과 동작 (디자인: 클로드디자인 "미니톡 UI 디자인 v1")
// =====================================================================
import { CONFIG } from './config.js';
import { SPRITE } from './icons.js';
import { STICKERS, stickerSvg } from './stickers.js';

const VERSION = '1.6.0';
const READ_LIVE_MAX = 20;   // 이 인원 이하 방은 읽음 표시를 실시간으로, 넘으면 5초마다 확인 (schema.sql 과 같은 값)
const APP = CONFIG.APP_NAME;
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
  listSeen: new Set(),   // 채팅 목록에 이미 반영한 메시지 번호   // undefined = 아직 모름, null = 등록 안 함, { phone, findable }
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
const previewText = (t) => (t === '사진' ? '사진을 보냈어요' : t === '이모티콘' ? '이모티콘을 보냈어요' : (t || '대화를 시작해 보세요').split('\n')[0]);
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
    <div class="auth-top">${ic('logo', 76)}<h1>${esc(APP)}</h1><p>가볍게, 상큼하게 대화해요</p></div>
    <div class="auth-card">${inner}</div></div></div>`;
}

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
        ${signup ? fieldHtml('phone', '휴대폰 번호 (선택)', { type: 'tel', ph: '010-1234-5678', help: '연락처로 친구를 찾을 때 쓰여요. 다른 사람에게는 보이지 않아요', auto: 'tel', max: 16 }) : ''}
      </div>
      <button class="btn" type="submit" id="authBtn">${signup ? '가입 신청하기' : '로그인'}</button>
    </form>
    ${signup ? `<div class="note-mint">${ic('shield', 18)}아이디는 가입 후 바꿀 수 없어요. 관리자 설정에 따라 승인 후 이용할 수 있어요.</div>`
    : '<div class="foot-note">비밀번호를 잊었다면 관리자에게 초기화를 요청하세요.</div>'}`);

  setOffline(!navigator.onLine);
  $$('.seg button').forEach((b) => (b.onclick = () => renderAuth(b.dataset.mode)));
  const form = $('#authForm');
  form.addEventListener('input', (e) => { if (e.target.name) setFieldErr(form, e.target.name, ''); });
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
    ['displayName', 'username', 'password', 'password2', 'phone'].forEach((k) => setFieldErr(form, k, errs[k] || ''));
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
  if (S.me.status && S.me.status !== 'active') { renderBlocked(S.me.status); return; }
  cacheProfile(S.me);
  buildShell();
  S.unsub = api.subscribe({ onMessage, onMemberUpdate, onStatus });
  await Promise.all([loadFriends(), loadRooms()]).catch(showErr);
  loadSuggestions();
  route();
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
      <p>${pending ? `관리자가 확인한 뒤 ${esc(APP)}을 쓸 수 있어요. 승인 소식을 들으면 아래 버튼을 눌러 주세요.` : '정지 기간에는 친구 추가와 대화를 할 수 없어요. 자세한 내용은 관리자에게 문의해 주세요.'}</p>
      <div class="info-card"><div class="kv"><span>아이디</span><span>@${esc(S.me.username)}</span></div>
        <div class="kv"><span>${pending ? '신청일' : '이름'}</span><span>${pending ? fmtDay(S.me.created_at) : esc(S.me.display_name)}</span></div></div>
    </div>
    <div class="btn-col">${pending ? '<button class="btn" id="recheckBtn">승인 상태 새로고침</button><button class="btn text" id="blockedLogout">로그아웃</button>'
    : '<button class="btn line" id="blockedLogout" style="font-weight:700">로그아웃</button>'}</div></div>`;
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
}

function leaveApp() {
  if (!S.entered) return;
  if (S.unsub) { try { S.unsub(); } catch { /* 무시 */ } }
  Object.assign(S, {
    uid: null, entered: false, me: null, friends: [], rooms: [], roomsLoaded: false, room: null,
    fromList: false, unsub: null, wasSubscribed: false, tab: 'friends', pushOn: false,
    admin: null, adminFromMore: false, lastTouch: 0, pending: 0, suggestions: [], phone: undefined,
  });
  S.profiles.clear(); S.imgUrls.clear();
  setBadge(0);
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  renderAuth();
  setOffline(!navigator.onLine);
}

function buildShell() {
  const tabs = [['friends', '친구', 'user'], ['chats', '채팅', 'chat'], ['more', '더보기', 'more']];
  app.innerHTML = `
  <div id="main" class="screen main">
    <div class="top" id="mainHeader"></div>
    <div class="scroll" id="mainBody"></div>
    <nav class="tabbar">${tabs.map(([k, l, i]) => `<button data-act="tab" data-tab="${k}" aria-label="${l}"><span class="pill">${ic(i, 24)}${k === 'chats' ? '<span class="tab-badge" id="chatBadge"></span>' : ''}</span><span class="lbl">${l}</span></button>`).join('')}</nav>
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
  if (!S.entered || !$('#main')) return;
  const h = location.hash;
  const m = h.match(/^#\/room\/([0-9a-f-]{36})$/i);
  if (m) {
    if (!S.room || S.room.id !== m[1]) openRoom(m[1]);
    return;
  }
  if (S.room) closeRoom();
  if (h === '#/admin') {
    if ($('#admin').hidden) openAdmin();
    return;
  }
  closeAdmin();
  const t = (h.match(/^#\/(friends|chats|more)$/) || [])[1];
  if (t) S.tab = t;
  renderMain();
  if (S.tab === 'friends') { loadFriends().catch(() => {}); loadSuggestions(); }
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
async function loadPhone() {
  if (!api.getMyPhone) { S.phone = null; return; }
  try { S.phone = (await api.getMyPhone()) || null; } catch (e) { console.warn('phone', e); S.phone = null; }
}
async function loadRooms() {
  S.rooms = await api.listRooms();
  S.roomsLoaded = true;
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
function updateBadges() {
  const total = S.rooms.reduce((s, r) => s + (r.unread || 0), 0);
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
      <button class="find-card" data-act="contacts"><span class="tile mint">${ic('book', 20)}</span>
        <span class="meta"><span class="name">연락처로 친구 찾기</span><span class="desc">내 연락처에 있는 ${esc(APP)} 친구를 추천해 드려요</span></span>${ic('chev', 18, 'color:#A3ABB6;flex:none')}</button>
      ${S.suggestions.length ? `<div class="sec">추천 친구 ${S.suggestions.length}</div>${S.suggestions.map((g) => `
        <div class="row sug"><button class="sug-main" data-act="profile" data-id="${esc(g.id)}">${av(g, 48)}
          <span class="meta"><span class="name">${esc(g.display_name)}</span><span class="desc">${esc([g.contact_name ? `내 연락처: ${g.contact_name}` : '내 연락처에 있는 친구', g.added_me ? '나를 친구로 추가했어요' : ''].filter(Boolean).join(' · '))}</span></span></button>
          <button class="mini-btn" data-act="sug-add" data-id="${esc(g.id)}">추가</button>
          <button class="ibtn sm" data-act="sug-hide" data-id="${esc(g.id)}" aria-label="추천에서 숨기기">${ic('x', 18)}</button></div>`).join('')}` : ''}
      ${S.friends.length ? `<div class="sec">친구 ${S.friends.length}</div>${S.friends.map((f) => `
        <button class="row" data-act="profile" data-id="${esc(f.id)}">${av(f, 48)}
          <div class="meta"><div class="name">${esc(f.display_name)}</div>${f.mutual === false ? '<div class="desc">아직 상대방이 나를 추가하지 않았어요</div>' : f.status_message ? `<div class="desc">${esc(f.status_message)}</div>` : ''}</div></button>`).join('')}`
    : S.suggestions.length ? '<div class="empty-line" style="padding-top:20px">아직 친구가 없어요. 추천 친구를 추가하거나 아이디·휴대폰 번호로 찾아보세요.</div>'
    : `<div class="empty-state" style="padding-top:28px"><div class="es-icon lav">${ic('logo', 64)}</div><b>아직 친구가 없어요</b><p>친구의 아이디나 휴대폰 번호로 찾아서 추가해 보세요.</p>
        <button class="btn sm" data-act="add-friend">${ic('userplus', 20)}친구 추가하기</button></div>`}`;
  } else if (S.tab === 'chats') {
    head.innerHTML = `<h1>채팅</h1><button class="ibtn" data-act="new-chat" aria-label="새 채팅">${ic('chatplus', 24)}</button>`;
    if (!S.roomsLoaded) { body.innerHTML = '<div class="spinner"></div>'; return; }
    if (S.rooms.length) { patchList(body, S.rooms.map((r) => [r.room_id, chatRowHtml(r)]), 'cw'); return; }
    body.innerHTML = `<div class="empty-state" style="padding-top:72px"><div class="es-icon sky">${ic('chat', 52)}</div><b>대화 중인 채팅방이 없어요</b><p>친구를 골라 첫 대화를 시작해 보세요.</p>
        <button class="btn sm" data-act="new-chat">${ic('chatplus', 20)}새 채팅</button></div>`;
  } else {
    renderMore(head, body);
  }
}

function chatRowHtml(r) {
  return `<button class="row chat" data-act="open-room" data-id="${esc(r.room_id)}">${roomAv(r)}
    <div class="meta"><div class="title-line"><span class="name">${esc(roomName(r, r.members || []))}</span>${r.is_group && !r.is_notice ? `<span class="cnt">${r.member_count}</span>` : ''}</div>
    <div class="desc">${esc(previewText(r.last_message))}</div></div>
    <div class="side"><span class="time">${esc(fmtListTime(r.last_message_at))}</span>${r.unread ? `<span class="badge">${badgeTxt(r.unread)}</span>` : ''}</div></button>`;
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
      <div class="item" style="padding-right:8px"><span class="tile sky">${ic('user', 19)}</span><span class="label">내 아이디</span><span class="val">@${esc(me.username)}</span>
        <button class="ibtn" data-act="copy-id" aria-label="아이디 복사" style="border-radius:12px;color:var(--ink3)">${ic('copy', 18)}</button></div>
      <button class="item" data-act="phone"><span class="tile sky">${ic('phone', 19)}</span><span class="label">휴대폰 번호</span><span class="val" id="phoneVal">${S.phone === undefined ? '' : S.phone ? esc(maskPhone(S.phone.phone)) : '등록하기'}</span>${ic('chev', 18, 'color:#A3ABB6;flex:none')}</button>
      <button class="item" data-act="contacts"><span class="tile mint">${ic('book', 19)}</span><span class="label">연락처로 친구 찾기</span>${ic('chev', 18, 'color:#A3ABB6;flex:none')}</button>
      <button class="item" data-act="change-password"><span class="tile lav">${ic('lock', 19)}</span><span class="label">비밀번호 변경</span>${ic('chev', 18, 'color:#A3ABB6;flex:none')}</button>
      <div class="item"><span class="tile peach">${ic('bell', 19)}</span><span class="label">알림</span>
        <button class="switch ${on ? 'on' : ''}" data-act="notif" role="switch" aria-checked="${on}" aria-label="새 메시지 알림"></button></div>
      <button class="item" data-act="install"><span class="tile mint">${ic('install', 19)}</span><span class="label">홈 화면에 설치</span>${ic('chev', 18, 'color:#A3ABB6;flex:none')}</button>
    </div>
    ${me.is_admin ? `<button class="card item" data-act="open-admin"><span class="tile lemon">${ic('shield', 19)}</span><span class="label">회원 관리</span><span id="pendingBadge">${S.pending ? `<span class="chip-lemon">승인 대기 ${S.pending}</span>` : ''}</span>${ic('chev', 18, 'color:#A3ABB6;flex:none')}</button>` : ''}
    <button class="card item danger" data-act="logout"><span class="tile pink">${ic('logout', 19)}</span><span class="label">로그아웃</span></button>
    <div class="version">${esc(APP)} 버전 ${VERSION}</div>
  </div>`;

  if (S.phone === undefined) {
    loadPhone().then(() => {
      const v = $('#phoneVal');
      if (v) v.textContent = S.phone ? maskPhone(S.phone.phone) : '등록하기';
    });
  }
  if (me.is_admin && api.adminSettings) {
    api.adminSettings().then((st) => {
      S.pending = (st && st.pending) || 0;
      const b = $('#pendingBadge');
      if (b) b.innerHTML = S.pending ? `<span class="chip-lemon">승인 대기 ${S.pending}</span>` : '';
    }).catch(() => {});
  }
}

function showEditProfile() {
  const me = S.me;
  openSheet({
    title: '프로필 편집',
    body: `<div style="display:flex;justify-content:center;padding:4px 0 20px"><div class="edit-av" id="editAv">${av(me, 96)}
        <button class="cam-btn" data-x="photo" aria-label="프로필 사진 변경">${ic('camera', 18)}</button></div></div>
      <input type="file" id="avatarInput" accept="image/*" hidden>
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
          renderMain(); toast('프로필 사진을 바꿨어요');
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

function showInstall() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
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
  S.room = { id, info: null, members: [], msgs: [], hasMore: true, loadingOlder: false, atBottom: true };
  const el = $('#room');
  el.hidden = false;
  el.innerHTML = `
    <div class="bar"><button class="ibtn" data-act="room-back" aria-label="뒤로">${ic('back', 24)}</button>
      <div class="ttl" id="roomTitle"></div>
      <button class="ibtn" data-act="room-menu" id="roomMenuBtn" aria-label="채팅방 메뉴" hidden>${ic('menu', 24)}</button></div>
    <div class="msgs-wrap"><div class="msgs" id="msgs"><div class="spinner"></div></div>
      <button class="new-pill" id="newPill" data-act="to-bottom" hidden>새 메시지${ic('down', 16)}</button>
      <div class="stk-preview" id="stkPreview" hidden></div></div>
    <div class="composer" id="composer">
      <div class="crow">
        <button class="photo-btn" data-act="pick-photo" aria-label="사진 보내기">${ic('image', 22)}</button>
        <div class="ta-wrap"><textarea id="msgInput" rows="1" maxlength="2000" placeholder="메시지를 입력하세요" aria-label="메시지 입력"></textarea>
          <button class="emo-btn" data-act="stickers" id="emoBtn" aria-label="이모티콘" aria-expanded="false">${ic('smile', 24)}</button></div>
        <button class="send-btn" id="sendBtn" data-act="send" disabled aria-label="보내기">${ic('send', 22)}</button>
      </div>
      <div class="sticker-panel" id="stickerPanel" hidden></div>
      <input type="file" id="photoInput" accept="image/*" multiple hidden>
    </div>`;
  wireComposer();

  try {
    const [info, members, msgs] = await Promise.all([api.getRoom(id), api.getMembers(id), api.getMessages(id)]);
    if (token !== S.roomToken) return;
    if (!info) { toast('대화방을 찾을 수 없어요', { error: true }); closeRoom(); location.replace('#/chats'); return; }
    S.room.info = info;
    if (info.is_notice) setupNoticeComposer(); else $('#roomMenuBtn').hidden = false;
    setMembers(members);
    S.room.msgs = msgs;
    S.room.hasMore = msgs.length >= 50;
    msgs.slice(-5).forEach((m) => { if (m.kind === 'sticker') markAnim(m); });
    renderRoomHeader();
    renderMsgs();
    scrollBottom();
    markReadSoon();
    watchReads();
  } catch (e) {
    if (token !== S.roomToken) return;
    $('#msgs').innerHTML = `<div class="empty-state"><b>불러오지 못했어요</b><p>${esc(e.message || '')}</p></div>`;
  }
}

function setupNoticeComposer() {
  const comp = $('#composer');
  if (!comp) return;
  if (S.me.is_admin) {
    $('[data-act=pick-photo]', comp).hidden = true;
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
  $('#roomTitle').innerHTML = `${info.is_notice ? `<span class="mega-dot">${ic('mega', 16)}</span>` : ''}<span class="t">${esc(name)}</span>${info.is_group && !info.is_notice ? `<span class="c">${S.room.members.length}</span>` : ''}`;
}

const isNoticeRoom = () => !!(S.room && S.room.info && S.room.info.is_notice);
function unreadCount(m) {
  if (!isNum(m.id) || isNoticeRoom()) return 0;
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
  const content = m.kind === 'image'
    ? `<button class="bubble photo" data-act="view-img" data-id="${esc(m.id)}" aria-label="사진 크게 보기"><img alt="사진" ${m.localUrl ? `src="${esc(m.localUrl)}"` : ''} data-path="${esc(m.content)}"></button>`
    : m.kind === 'sticker' ? `<button class="bubble sticker" data-act="replay-sticker" aria-label="이모티콘 다시 움직이기">${stickerSvg(m.content, 120)}</button>`
      : `<div class="bubble">${notice ? noticeText(m.content) : linkify(m.content)}</div>`;
  const showMeta = !m.pending && !m.failed;
  const metaCol = showMeta ? `<div class="meta-col"><span class="unread" data-unread="${esc(m.id)}"></span><span class="tm">${fmtTime(m.created_at)}</span></div>` : '';
  const cls = `msg ${mine ? 'mine' : ''} ${first ? 'first' : ''} ${m.pending ? 'pending' : ''} ${m.failed ? 'failed' : ''}`;

  if (mine) {
    const state = m.pending ? '<span class="spin-sm" aria-label="전송 중"></span>'
      : m.failed ? `<button class="retry-btn" data-act="retry" data-id="${esc(m.id)}" aria-label="다시 보내기">${ic('retry', 14)}다시 보내기</button>` : '';
    return out + `<div class="${cls}"><div class="line">${state}${metaCol}${content}</div></div>`;
  }
  const head = first
    ? (notice ? `<div class="mega-av">${ic('mega', 20)}</div>` : `<button data-act="profile" data-id="${esc(m.sender_id || '')}" aria-label="프로필">${av(p || { id: m.sender_id, display_name: '?' }, 40)}</button>`)
    : '';
  const senderName = notice ? `${APP} 운영팀` : (p ? p.display_name : '(알 수 없음)');
  return out + `<div class="${cls}"><div class="avs">${head}</div>
    <div class="col">${first ? `<div class="sender">${esc(senderName)}</div>` : ''}<div class="line">${content}${metaCol}</div></div></div>`;
}

function renderMsgs() {
  const box = $('#msgs'); if (!box || !S.room) return;
  const ms = S.room.msgs;
  if (!ms.length) {
    box.innerHTML = `<div class="empty-state" style="padding-top:22%"><div class="es-icon lav">${ic('logo', 64)}</div><b>대화를 시작해 보세요</b><p>첫 메시지를 보내면 상대방 채팅 목록에 나타나요.</p></div>`;
    return;
  }
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
    const rows = await api.getMembers(id);
    if (!S.room || S.room.id !== id) return;
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
}
function stopWatchReads(R) {
  if (R.unwatch) { try { R.unwatch(); } catch { /* 무시 */ } R.unwatch = null; }
  clearInterval(R.pollTimer); clearTimeout(R.readsSoon);
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
  r.last_message = m.kind === 'image' ? '사진' : m.kind === 'sticker' ? '이모티콘' : String(m.content).slice(0, 100);
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
  });
  box.addEventListener('scroll', () => {
    if (!S.room) return;
    S.room.atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    if (S.room.atBottom) { const p = $('#newPill'); if (p) p.hidden = true; }
    if (box.scrollTop < 80) loadOlder();
  }, { passive: true });
  box.addEventListener('load', (e) => { if (e.target.tagName === 'IMG' && S.room && S.room.atBottom) box.scrollTop = box.scrollHeight; }, true);
  $('#photoInput').onchange = async (e) => {
    const files = [...e.target.files]; e.target.value = '';
    for (const f of files.slice(0, 10)) await sendPhoto(f);
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
  const tmp = retryMsg || { id: 'tmp-' + (++S.tmpSeq), room_id: R.id, sender_id: S.uid, kind: 'text', content: text, created_at: new Date().toISOString() };
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
    const real = await api.sendText(R.id, text);
    R.msgs = R.msgs.filter((m) => m !== tmp);
    applyToList(real);
    if (S.room === R) { addMessages([real], { forceBottom: true }); renderMsgs(); scrollBottom(); }
  } catch (e) {
    tmp.pending = false; tmp.failed = true;
    if (S.room === R) renderMsgs();
    showErr(e);
  }
}

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
  if (S.room) {
    const R = S.room;
    const lastReal = [...R.msgs].reverse().find((m) => isNum(m.id));
    try {
      const fresh = await api.getMessagesAfter(R.id, lastReal ? lastReal.id : 0);
      if (S.room === R) { addMessages(fresh); refreshMembers(); markReadSoon(); }
    } catch (e) { console.warn(e); }
  }
}

function maybeNotify(m) {
  if (!S.entered || m.sender_id === S.uid || m.kind === 'system') return;
  const inRoom = S.room && S.room.id === m.room_id;
  if (inRoom && !document.hidden) return;
  const sender = profileOf(m.sender_id);
  const r = S.rooms.find((x) => x.room_id === m.room_id);
  const name = r && r.is_notice ? `${APP} 운영팀` : (sender ? sender.display_name : '새 메시지');
  const title = r && r.is_group ? `${name} · ${roomName(r, r.members || [])}` : name;
  const text = m.kind === 'image' ? '사진을 보냈어요' : m.kind === 'sticker' ? '이모티콘을 보냈어요' : m.content;

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
    : '서로 친구로 추가해야 1:1 채팅을 할 수 있어요.'}</span></div>`}`}`,
    onMount(sheet, close) {
      sheet.addEventListener('click', async (e) => {
        const x = e.target.closest('[data-x]'); if (!x) return;
        const act = x.dataset.x;
        try {
          if (act === 'edit') { close(); showEditProfile(); }
          if (act === 'chat') { x.disabled = true; const rid = await api.openDM(id); close(); goRoom(rid); }
          if (act === 'befriend') { await api.addFriend(id); await loadFriends(); loadSuggestions(); close(); friendAddedToast(id, p.display_name); }
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
        <button class="btn soft" data-x="contacts" style="font-size:15px">${ic('book', 20)}연락처로 친구 찾기</button></div>`,
    onMount(sheet, close) {
      const form = $('#findForm', sheet); const out = $('#findResult', sheet); const box = $('#findBox', sheet);
      setTimeout(() => form.q.focus(), 50);
      form.q.oninput = () => box.classList.remove('err');
      sheet.addEventListener('click', (e) => { if (e.target.closest('[data-x=contacts]')) { close(); showContacts(); } });
      form.onsubmit = async (e) => {
        e.preventDefault();
        const raw = form.q.value.trim();
        const ph = normPhone(raw);
        const q = ph || raw.replace(/^@/, '').toLowerCase();
        if (!q) { box.classList.add('err'); out.innerHTML = `<div class="field-err" style="padding:10px 4px 30px">${ic('alert', 16)}아이디 또는 휴대폰 번호를 입력해 주세요</div>`; return; }
        out.innerHTML = '<div class="spinner"></div>';
        try {
          const u = await api.findUser(q);
          if (!u) {
            box.classList.add('err');
            out.innerHTML = ph
              ? `<div class="field-err" style="padding:10px 4px 0">${ic('alert', 16)}${esc(fmtPhone(ph))} 번호로 찾을 수 있는 회원이 없어요</div><div class="help" style="padding:6px 4px 30px">번호를 등록하지 않았거나 ‘번호로 나를 찾을 수 있게’를 꺼 둔 회원은 찾을 수 없어요. 아이디로 검색해 보세요.</div>`
              : `<div class="field-err" style="padding:10px 4px 30px">${ic('alert', 16)}‘${esc(q)}’ 아이디를 찾을 수 없어요</div>`;
            return;
          }
          cacheProfile(u);
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

// ---------- 연락처로 친구 찾기 ----------
// vCard(.vcf) 파일에서 이름·번호 읽기 (아이폰·PC용)
function decodeQP(str, charset) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === '=' && /^[0-9A-Fa-f]{2}$/.test(str.substr(i + 1, 2))) { bytes.push(parseInt(str.substr(i + 1, 2), 16)); i += 2; }
    else bytes.push(c.charCodeAt(0) & 0xff);
  }
  try { return new TextDecoder(charset || 'utf-8').decode(new Uint8Array(bytes)); }
  catch { return new TextDecoder('utf-8').decode(new Uint8Array(bytes)); }
}
function parseVcf(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const out = []; let cur = null;
  const unesc = (v) => v.replace(/\\([,;\\])/g, '$1').replace(/\\n/gi, ' ').trim();
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;
    const up = line.toUpperCase();
    if (up === 'BEGIN:VCARD') { cur = { name: '', tels: [] }; continue; }
    if (up === 'END:VCARD') { if (cur) out.push(cur); cur = null; continue; }
    if (!cur) continue;
    const at = line.indexOf(':'); if (at < 0) continue;
    const key = line.slice(0, at);
    let val = line.slice(at + 1);
    const qp = /ENCODING=QUOTED-PRINTABLE/i.test(key);
    if (qp) { while (val.endsWith('=') && i + 1 < lines.length) { val = val.slice(0, -1) + lines[++i].trim(); } }
    const cs = (key.match(/CHARSET=([^;:]+)/i) || [])[1];
    if (qp) val = decodeQP(val, cs);
    const prop = key.split(';')[0].split('.').pop().toUpperCase();
    if (prop === 'TEL') cur.tels.push(val);
    else if (prop === 'FN' && val.trim()) cur.name = unesc(val);
    else if (prop === 'N' && !cur.name) {
      const parts = val.split(';').map(unesc);
      cur.name = /[가-힣]/.test(parts.join('')) ? (parts[0] || '') + (parts[1] || '') : [parts[1], parts[0]].filter(Boolean).join(' ');
    }
  }
  return out;
}
const pickerSupported = () => 'contacts' in navigator && 'ContactsManager' in window && typeof navigator.contacts.select === 'function';

// 연락처 목록 [{ name, tels: [] }] → 서버에서 가입한 친구 확인
async function matchContactList(list) {
  const mine = S.phone && S.phone.phone;
  const seen = new Map();
  for (const c of list || []) {
    const name = String((Array.isArray(c.name) ? c.name[0] : c.name) || '').trim().slice(0, 40);
    for (const t of (Array.isArray(c.tels) ? c.tels : c.tel) || []) {
      const d = normPhone(t);
      if (d && d !== mine && !seen.has(d)) seen.set(d, name);
    }
  }
  if (!seen.size) { toast('휴대폰 번호가 있는 연락처가 없어요', { error: true }); return null; }
  let entries = [...seen.entries()];
  const over = entries.length > 3000;
  if (over) entries = entries.slice(0, 3000);
  let found = 0;
  for (let i = 0; i < entries.length; i += 1000) {
    const part = entries.slice(i, i + 1000);
    found += (await api.matchContacts(part.map((x) => x[0]), part.map((x) => x[1] || null))) || 0;
  }
  await loadSuggestions();
  return { found, checked: entries.length, over };
}

function showContacts() {
  const picker = pickerSupported();
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const myPhone = () => (S.phone === undefined ? '<div class="spinner" style="margin:6px auto"></div>'
    : S.phone ? `<div class="kv-line">${ic('phone', 18, 'flex:none')}<span>내 번호 <b>${esc(maskPhone(S.phone.phone))}</b> · ${S.phone.findable ? '친구가 번호로 나를 찾을 수 있어요' : '번호로 나를 찾을 수 없게 해 뒀어요'}</span><button class="link-btn" data-x="phone">변경</button></div>`
      : `<div class="kv-line warn">${ic('phone', 18, 'flex:none')}<span>내 번호를 등록하면 친구의 연락처에서도 내가 추천돼요</span><button class="link-btn" data-x="phone">등록</button></div>`);
  openSheet({
    title: '연락처로 친구 찾기',
    body: `<div class="sub-text">내 연락처의 휴대폰 번호와 일치하는 ${esc(APP)} 회원을 찾아 <b>추천 친구</b>에 보여 드려요.</div>
      <div id="myPhoneBox">${myPhone()}</div>
      <div class="btn-col" style="margin-top:14px">
        ${picker ? `<button class="btn" data-x="pick">${ic('book', 20)}연락처에서 고르기</button>` : ''}
        <button class="btn ${picker ? 'line' : ''}" data-x="file">${ic('download', 20)}연락처 파일(.vcf) 불러오기</button>
      </div>
      ${picker ? '' : `<details class="howto" ${ios ? 'open' : ''}><summary>아이폰에서 연락처 파일 만드는 법</summary><ol>
        <li>‘연락처’ 앱을 열고 왼쪽 위 <b>목록</b>을 눌러요</li>
        <li><b>모든 연락처</b>를 길게 누르고 <b>내보내기</b>를 골라요</li>
        <li><b>완료</b>를 누른 뒤 <b>파일에 저장</b>을 골라요</li>
        <li>여기서 ‘연락처 파일 불러오기’를 눌러 저장한 파일을 골라요</li></ol>
        <p>안드로이드는 ‘연락처’ 앱 설정의 <b>연락처 내보내기</b>로 만들 수 있어요.</p></details>`}
      <div class="note-mint" style="margin-top:14px">${ic('lock', 18)}<span>연락처의 번호는 가입한 친구를 확인하는 데에만 쓰이고 서버에 저장되지 않아요. 번호를 등록하지 않았거나 검색을 꺼 둔 회원은 찾지 않아요.</span></div>
      <input type="file" id="vcfInput" accept=".vcf,.vcard,text/vcard,text/x-vcard" hidden>`,
    onMount(sheet, close) {
      if (S.phone === undefined) loadPhone().then(() => { const b = $('#myPhoneBox', sheet); if (b) b.innerHTML = myPhone(); });
      const run = async (btn, getList) => {
        btn.disabled = true;
        const label = btn.innerHTML;
        btn.innerHTML = '<span class="spin-sm"></span>';
        try {
          const list = await getList();
          if (!list) return;
          const r = await matchContactList(list);
          if (!r) return;
          close();
          if (S.tab !== 'friends' || S.room) go('#/friends'); else renderMain();
          toast(r.found ? `연락처에서 친구 ${r.found}명을 찾았어요. 추천 친구를 확인해 보세요` : '연락처와 일치하는 새 친구가 없어요', { ms: 3600 });
          if (r.over) setTimeout(() => toast('연락처가 많아 앞쪽 3000개만 확인했어요'), 3800);
        } catch (e) {
          if (e && (e.name === 'AbortError' || e.name === 'InvalidStateError')) return;
          showErr(e);
        } finally { if (btn.isConnected) { btn.disabled = false; btn.innerHTML = label; } }
      };
      sheet.addEventListener('click', (e) => {
        const x = e.target.closest('[data-x]'); if (!x) return;
        if (x.dataset.x === 'phone') { close(); showPhone(); }
        if (x.dataset.x === 'pick') {
          run(x, async () => {
            const sel = await navigator.contacts.select(['name', 'tel'], { multiple: true });
            return sel && sel.length ? sel : null;
          });
        }
        if (x.dataset.x === 'file') $('#vcfInput', sheet).click();
      });
      $('#vcfInput', sheet).onchange = (e) => {
        const file = e.target.files[0]; e.target.value = '';
        if (!file) return;
        if (file.size > 30 * 1024 * 1024) { toast('파일이 너무 커요 (최대 30MB)', { error: true }); return; }
        run($('[data-x=file]', sheet), async () => {
          const list = parseVcf(await file.text());
          if (!list.length) throw new Error('연락처 파일(.vcf)이 아니거나 비어 있어요');
          return list;
        });
      };
    },
  });
}

// ---------- 내 휴대폰 번호 ----------
function showPhone() {
  const cur = S.phone || null;
  let findable = cur ? cur.findable !== false : true;
  openSheet({
    title: '휴대폰 번호',
    body: `<div class="sub-text">번호를 등록하면 내 번호를 저장해 둔 친구에게 추천 친구로 보여요.</div>
      <div class="auth-fields">${fieldHtml('phone', '휴대폰 번호', { type: 'tel', ph: '010-1234-5678', auto: 'tel', max: 16 })}</div>
      <div class="card-line"><span class="label">번호로 나를 찾을 수 있게<span class="sub">끄면 번호 검색과 연락처 추천에 내가 나오지 않아요</span></span>
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

function friendAddedToast(id, name) {
  const f = S.friends.find((x) => x.id === id);
  if (f && f.mutual) toast(`${name}님과 이제 서로 친구예요. 대화를 시작할 수 있어요`, { ms: 3200 });
  else toast(`${name}님을 친구로 추가했어요. 상대방도 나를 추가하면 대화할 수 있어요`, { ms: 4000 });
}

// 친구 고르기 (새 채팅·초대 공용) — 서로 친구인 사람만

async function pickFriends({ invite = false, exclude = [] } = {}) {
  await loadFriends().catch(() => {});
  return new Promise((resolve) => {
    const list = S.friends.filter((f) => f.mutual !== false && !exclude.includes(f.id));
    const waiting = S.friends.filter((f) => f.mutual === false).length;
    const sel = [];
    let finished = false;
    openSheet({
      title: invite ? '대화상대 초대' : '새 채팅',
      body: `<div class="sub-text">${invite ? '채팅방에 초대할 친구를 선택하세요' : '대화할 친구를 선택하세요. 여러 명을 고르면 단체방이 돼요.'}</div>
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
          ok.textContent = invite ? (sel.length ? `${sel.length}명 초대하기` : '초대할 친구를 선택하세요')
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
    .sort((a, b) => (a.id === S.uid ? -1 : b.id === S.uid ? 1 : 0));
  openSheet({
    title: roomName(R.info, roomOthers()),
    body: `${R.info.is_group ? `<button class="menu-row invite bleed" data-x="invite" style="width:calc(100% + 40px)"><span class="circ">${ic('userplus', 22)}</span><span>대화상대 초대</span></button>` : ''}
      <div class="sec" style="padding:12px 0 4px">참여자 ${members.length}</div>
      <div class="bleed">${members.map((p) => `<button class="menu-row" data-x="profile" data-id="${esc(p.id)}">${av(p, 42)}<span style="font-size:15px">${esc(p.display_name)}</span>${p.id === S.uid ? '<span class="chip me">나</span>' : ''}</button>`).join('')}</div>
      <div class="divider"></div>
      <button class="menu-row leave bleed" data-x="leave" style="width:calc(100% + 40px)">${ic('logout', 22)}채팅방 나가기</button>`,
    onMount(sheet, close) {
      sheet.addEventListener('click', async (e) => {
        const x = e.target.closest('[data-x]'); if (!x) return;
        if (x.dataset.x === 'profile') { close(); showProfile(x.dataset.id); }
        if (x.dataset.x === 'invite') {
          close();
          const r = await pickFriends({ invite: true, exclude: R.members.map((m) => m.id) });
          if (r && r.ids.length) { try { await api.inviteToRoom(R.id, r.ids); } catch (ex) { showErr(ex); } }
        }
        if (x.dataset.x === 'leave') {
          close();
          const ok = await ask('채팅방을 나갈까요?', R.info.is_group ? '나가면 대화 내용이 목록에서 사라지고, 다시 초대받기 전까지 들어올 수 없어요.' : '나가면 이 대화방이 목록에서 사라져요. 상대가 새 메시지를 보내면 다시 나타나요.', '나가기', true);
          if (!ok) return;
          try {
            await api.leaveRoom(R.id);
            S.rooms = S.rooms.filter((x2) => x2.room_id !== R.id);
            updateBadges();
            S.fromList = false;
            S.tab = 'chats';
            location.replace('#/chats');
            toast('채팅방에서 나왔어요');
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

async function openAdmin() {
  if (!S.me || !S.me.is_admin) { location.replace('#/more'); return; }
  closeAllSheets();
  S.admin = S.admin || { filter: 'all', q: '', users: [], settings: null };
  const el = $('#admin');
  el.hidden = false;
  el.innerHTML = `<div class="bar" style="padding:0 8px"><button class="ibtn" data-act="admin-back" aria-label="뒤로">${ic('back', 24)}</button><h1>회원 관리</h1></div>
    <div class="scroll" id="adminBody"><div class="spinner"></div></div>`;
  await loadAdmin();
}
function closeAdmin() {
  const el = $('#admin');
  if (el && !el.hidden) { el.hidden = true; el.innerHTML = ''; }
}
async function loadAdmin() {
  try {
    const [settings, users] = await Promise.all([api.adminSettings(), api.adminListUsers('')]);
    if (!S.admin) return;
    S.admin.settings = settings; S.admin.users = users;
    S.pending = settings.pending || 0;
    renderAdmin();
  } catch (e) {
    const b = $('#adminBody');
    if (b) b.innerHTML = `<div class="empty-state"><b>불러오지 못했어요</b><p>${esc(e.message || '')}</p></div>`;
  }
}
function adminFiltered() {
  const A = S.admin; const q = A.q.trim().toLowerCase().replace(/^@/, '');
  return A.users.filter((u) => (A.filter === 'all' || stOf(u) === A.filter || (A.filter === 'admin' && u.is_admin))
    && (!q || u.username.includes(q) || u.display_name.toLowerCase().includes(q)
      || (q.replace(/\D/g, '') && (u.phone || '').includes(q.replace(/\D/g, '')))));
}
const stChip = (u) => { const s = stOf(u); return `<span class="chip ${s}">${ST_LABEL[s]}</span>`; };
function renderAdminList() {
  const box = $('#adminList'); if (!box) return;
  const list = adminFiltered();
  box.innerHTML = list.length ? list.map((u) => `
    <button class="mrow row" data-act="admin-user" data-id="${esc(u.id)}">${av(u, 44)}
      <div class="meta"><span class="name">${esc(u.display_name)}</span><span class="desc">@${esc(u.username)} · ${fmtDay(u.created_at)} 가입</span></div>
      <span class="chips">${stChip(u)}</span></button>`).join('')
    : '<div class="empty-line">조건에 맞는 회원이 없어요</div>';
}
function renderAdmin() {
  const body = $('#adminBody'); if (!body || !S.admin || !S.admin.settings) return;
  const A = S.admin; const st = A.settings;
  const cnt = (k) => A.users.filter((u) => (k === 'admin' ? u.is_admin : u.status === k)).length;
  body.innerHTML = `<div class="admin-body">
    <div class="stats">
      <button class="stat all ${A.filter === 'all' ? 'on' : ''}" data-act="admin-filter" data-f="all"><span class="k">전체</span><span class="n">${st.total}</span></button>
      <button class="stat pending ${A.filter === 'pending' ? 'on' : ''}" data-act="admin-filter" data-f="pending"><span class="k">승인 대기</span><span class="n">${st.pending}</span></button>
      <button class="stat suspended ${A.filter === 'suspended' ? 'on' : ''}" data-act="admin-filter" data-f="suspended"><span class="k">정지</span><span class="n">${st.suspended}</span></button>
    </div>
    <div class="card" style="margin-top:12px">
      <div class="item" style="padding-top:14px;padding-bottom:14px"><span class="label">가입 승인제<span class="sub">${st.require_approval ? '켜져 있어요 · 새 회원은 관리자 승인 후 이용할 수 있어요' : '꺼져 있어요 · 가입하면 바로 이용할 수 있어요'}</span></span>
        <button class="switch ${st.require_approval ? 'on' : ''}" data-act="admin-approval" role="switch" aria-checked="${st.require_approval}" aria-label="가입 승인제"></button></div>
      <button class="item" data-act="admin-notice"><span class="tile mint">${ic('mega', 19)}</span><span class="label">전체 공지 보내기</span>${ic('chev', 18, 'color:#A3ABB6;flex:none')}</button>
    </div>
    <label class="search">${ic('search', 20, 'flex:none')}<input id="adminSearch" placeholder="이름·아이디·휴대폰 번호 검색" value="${esc(A.q)}" autocapitalize="off" spellcheck="false"></label>
    <div class="filters">${[['all', '전체'], ['pending', `승인 대기 ${cnt('pending')}`], ['suspended', `정지 ${cnt('suspended')}`], ['admin', `관리자 ${cnt('admin')}`]]
    .map(([k, l]) => `<button data-act="admin-filter" data-f="${k}" class="${A.filter === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="card" style="margin-top:12px" id="adminList"></div></div>`;
  const input = $('#adminSearch');
  input.oninput = () => { A.q = input.value; renderAdminList(); };
  renderAdminList();
}

function showAdminUser(id) {
  const u = S.admin && S.admin.users.find((x) => x.id === id);
  if (!u) return;
  const self = u.id === S.uid;
  const s = stOf(u);
  const B = (label, x, kind) => `<button class="btn md ${kind}" data-x="${x}" ${self ? 'disabled' : ''}>${label}</button>`;
  const btns = {
    pending: [B('가입 승인', 'approve', ''), B('가입 거절 (강제 탈퇴)', 'delete', 'danger-line')],
    active: [B('이용 정지', 'suspend', 'line'), B('비밀번호 초기화', 'reset', 'line'), B('관리자로 지정', 'admin', 'line'), B('강제 탈퇴', 'delete', 'danger-line')],
    suspended: [B('정지 해제', 'unsuspend', ''), B('비밀번호 초기화', 'reset', 'line'), B('강제 탈퇴', 'delete', 'danger-line')],
    admin: [B('관리자 해제', 'admin', 'line'), B('비밀번호 초기화', 'reset', 'line')],
  }[s];
  if (u.phone) btns.splice(btns.length - (s === 'admin' ? 0 : 1), 0, `<button class="btn md line" data-x="clearphone">휴대폰 번호 삭제</button>`);
  openSheet({
    title: '회원 정보',
    body: `<div class="m-head">${av(u, 64)}<div class="meta" style="gap:6px"><div class="nm"><b>${esc(u.display_name)}</b>${stChip(u)}</div><span class="desc">@${esc(u.username)}</span></div></div>
      <div class="grid2">
        <div class="cell"><span>가입일</span><b>${fmtDay(u.created_at)}</b></div>
        <div class="cell"><span>최근 접속</span><b>${esc(fmtAgo(u.last_seen_at))}</b></div>
        <div class="cell"><span>친구</span><b>${u.friend_count}명</b></div>
        <div class="cell"><span>대화방</span><b>${u.room_count}개</b></div>
        <div class="cell wide"><span>휴대폰 번호</span><b>${u.phone ? esc(fmtPhone(u.phone)) : '등록 안 함'}</b></div>
      </div>
      ${self ? '<div class="help" style="margin-top:12px;text-align:center">내 계정의 권한은 다른 관리자만 바꿀 수 있어요.</div>' : ''}
      <div class="stack">${btns.join('')}</div>`,
    onMount(sheet, close) {
      sheet.addEventListener('click', async (e) => {
        const x = e.target.closest('[data-x]'); if (!x || x.disabled) return;
        const act = x.dataset.x;
        const n = u.display_name;
        try {
          if (act === 'approve') {
            await api.adminSetStatus(u.id, 'active'); close(); toast(`${n}님의 가입을 승인했어요`);
          } else if (act === 'unsuspend') {
            await api.adminSetStatus(u.id, 'active'); close(); toast(`${n}님의 정지를 해제했어요`);
          } else if (act === 'suspend') {
            close();
            if (!(await ask(`${n}님의 이용을 정지할까요?`, '정지된 회원은 바로 대화를 볼 수 없고 다시 로그인할 수 없어요. 나중에 해제할 수 있어요.', '이용 정지', true))) return;
            await api.adminSetStatus(u.id, 'suspended'); toast(`${n}님의 이용을 정지했어요`);
          } else if (act === 'admin') {
            const on = !u.is_admin;
            await api.adminSetAdmin(u.id, on); close(); toast(on ? `${n}님을 관리자로 지정했어요` : `${n}님의 관리자 권한을 해제했어요`);
          } else if (act === 'reset') {
            close();
            if (!(await ask(`${n}님의 비밀번호를 초기화할까요?`, '임시 비밀번호가 발급되고 기존 비밀번호는 더 이상 쓸 수 없어요.', '초기화'))) return;
            const pw = await api.adminResetPassword(u.id);
            showTempPassword(n, pw);
          } else if (act === 'clearphone') {
            close();
            if (!(await ask(`${n}님의 휴대폰 번호를 삭제할까요?`, '다른 사람 번호를 잘못 등록한 경우 등에 사용해요. 회원이 나중에 다시 등록할 수 있어요.', '삭제', true))) return;
            await api.adminClearPhone(u.id); toast(`${n}님의 휴대폰 번호를 삭제했어요`);
          } else if (act === 'delete') {
            close();
            if (!(await ask(`${n}님을 강제 탈퇴시킬까요?`, '계정과 친구·대화방 정보가 삭제되고 되돌릴 수 없어요. 보낸 메시지는 "(알 수 없음)"으로 남아요.', '강제 탈퇴', true))) return;
            await api.adminDeleteUser(u.id); toast(`${n}님을 탈퇴 처리했어요`);
          }
          await loadAdmin();
        } catch (ex) { showErr(ex); }
      });
    },
  });
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
    case 'contacts': showContacts(); break;
    case 'phone': showPhone(); break;
    case 'sug-add': {
      const g = S.suggestions.find((x) => x.id === el.dataset.id);
      el.disabled = true;
      try { await api.addFriend(el.dataset.id); await loadFriends(); await loadSuggestions(); friendAddedToast(el.dataset.id, g ? g.display_name : '친구'); }
      catch (ex) { el.disabled = false; showErr(ex); }
      break;
    }
    case 'sug-hide': {
      const id = el.dataset.id;
      try { await api.dismissSuggestion(id); S.suggestions = S.suggestions.filter((x) => x.id !== id); renderMain(); toast('추천 친구에서 숨겼어요'); }
      catch (ex) { showErr(ex); }
      break;
    }
    case 'pick-photo': $('#photoInput').click(); break;
    case 'view-img': showImage(el); break;
    case 'retry': {
      const m = S.room && S.room.msgs.find((x) => String(x.id) === el.dataset.id);
      if (!m) break;
      if (m.kind === 'image') sendPhoto(null, m); else if (m.kind === 'sticker') sendSticker(null, m); else sendText(m);
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
    case 'admin-back':
      if (S.adminFromMore) { S.adminFromMore = false; history.back(); } else location.replace('#/more');
      break;
    case 'admin-filter':
      if (S.admin) { S.admin.filter = el.dataset.f; renderAdmin(); }
      break;
    case 'admin-user': showAdminUser(el.dataset.id); break;
    case 'admin-notice': showBroadcast(); break;
    case 'admin-approval': {
      if (!S.admin || !S.admin.settings) break;
      const on = !S.admin.settings.require_approval;
      if (!(await ask(on ? '가입 승인제를 켤까요?' : '가입 승인제를 끌까요?',
        on ? '이제부터 새로 가입한 사람은 관리자가 승인해야 이용할 수 있어요. 이미 가입한 회원은 그대로예요.' : '이제부터 누구나 가입하면 바로 이용할 수 있어요. 승인 대기 중인 회원은 직접 승인해 주세요.',
        on ? '켜기' : '끄기'))) break;
      try { await api.adminSetApproval(on); toast(on ? '가입 승인제를 켰어요' : '가입 승인제를 껐어요'); await loadAdmin(); }
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
