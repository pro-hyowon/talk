// =====================================================================
//  끼리톡 — 알림 발송 함수 (Supabase Edge Function: send-push)
//  새 메시지가 저장되면 데이터베이스가 이 함수를 호출하고,
//  이 함수가 받는 사람들의 휴대폰·PC로 암호화된 알림(Web Push)을 보냅니다.
//  외부 라이브러리 없이 표준 암호 기능(WebCrypto)만 사용합니다.
//
//  필요한 비밀값(Edge Functions > Secrets):
//    VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, PUSH_WEBHOOK_SECRET
//  ※ 함수 설정에서 "Verify JWT"(JWT 검증)는 꺼 주세요. 대신 PUSH_WEBHOOK_SECRET 으로 보호합니다.
// =====================================================================

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(str: string): Uint8Array {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
// WebCrypto에 넘길 때 사용하는 변환 (TypeScript 버전 차이 대응)
function buf(u: Uint8Array): ArrayBuffer { return u.slice().buffer as ArrayBuffer; }

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', buf(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, buf(data)));
}

// ---------- VAPID (보내는 서버 인증, RFC 8292) ----------
export async function importVapidPrivateKey(publicKeyB64: string, privateKeyB64: string): Promise<CryptoKey> {
  const pub = unb64url(publicKeyB64);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error('VAPID_PUBLIC_KEY 형식이 올바르지 않습니다');
  const jwk = {
    kty: 'EC', crv: 'P-256', ext: true,
    x: b64url(pub.slice(1, 33)), y: b64url(pub.slice(33, 65)), d: privateKeyB64,
  };
  return await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

export async function vapidAuthHeader(endpoint: string, publicKeyB64: string, signKey: CryptoKey, subject: string): Promise<string> {
  const aud = new URL(endpoint).origin;
  const header = b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64url(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const unsigned = `${header}.${claims}`;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signKey, buf(enc.encode(unsigned))));
  return `vapid t=${unsigned}.${b64url(sig)}, k=${publicKeyB64}`;
}

// ---------- 내용 암호화 (RFC 8291, aes128gcm) ----------
export async function encryptPayload(p256dhB64: string, authB64: string, plaintext: Uint8Array): Promise<Uint8Array> {
  const uaPublic = unb64url(p256dhB64);
  const authSecret = unb64url(authB64);
  if (uaPublic.length !== 65 || authSecret.length !== 16) throw new Error('구독 키 형식 오류');

  const asKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', buf(uaPublic), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeys.privateKey, 256));

  const prkKey = await hmac(authSecret, ecdhSecret);
  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic, new Uint8Array([1]));
  const ikm = await hmac(prkKey, keyInfo);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);

  const padded = concat(plaintext, new Uint8Array([2])); // 마지막 레코드 구분자
  const aesKey = await crypto.subtle.importKey('raw', buf(cek), { name: 'AES-GCM' }, false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: buf(nonce) }, aesKey, buf(padded)));

  const rs = new Uint8Array(4); new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

export type Sub = { endpoint: string; p256dh: string; auth: string };

export async function sendWebPush(sub: Sub, payload: string, vapid: { publicKey: string; signKey: CryptoKey; subject: string }, ttl = 86400): Promise<number> {
  const body = await encryptPayload(sub.p256dh, sub.auth, enc.encode(payload));
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuthHeader(sub.endpoint, vapid.publicKey, vapid.signKey, vapid.subject),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttl),
      Urgency: 'high',
    },
    body: buf(body),
  });
  await res.body?.cancel();
  return res.status;
}

// ---------- 요청 처리 ----------
async function removeDead(endpoints: string[]) {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key || !endpoints.length) return;
  const list = endpoints.map((e) => `"${e.replace(/"/g, '')}"`).join(',');
  await fetch(`${url}/rest/v1/push_subscriptions?endpoint=in.(${encodeURIComponent(list)})`, {
    method: 'DELETE',
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  }).then((r) => r.body?.cancel()).catch(() => {});
}

let cachedKey: CryptoKey | null = null;

export async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('send-push ok');
  const secret = Deno.env.get('PUSH_WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-push-secret') !== secret) return new Response('unauthorized', { status: 401 });

  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
  const subject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com';
  if (!publicKey || !privateKey) return new Response('VAPID keys missing', { status: 500 });
  cachedKey ??= await importVapidPrivateKey(publicKey, privateKey);

  let data: { subs?: Sub[]; title?: string; body?: string; room_id?: string };
  try { data = await req.json(); } catch { return new Response('bad json', { status: 400 }); }
  const subs = Array.isArray(data.subs) ? data.subs.slice(0, 500) : [];
  const payload = JSON.stringify({
    title: data.title ?? '끼리톡',
    body: data.body ?? '새 메시지가 도착했습니다.',
    tag: data.room_id ?? 'minitalk',
    url: data.room_id ? `./#/room/${data.room_id}` : './',
  });

  const results = await Promise.allSettled(
    subs.map((s) => sendWebPush(s, payload, { publicKey, signKey: cachedKey!, subject })),
  );
  const dead: string[] = [];
  let sent = 0;
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value >= 200 && r.value < 300) sent++;
    else if (r.status === 'fulfilled' && (r.value === 404 || r.value === 410)) dead.push(subs[i].endpoint);
  });
  await removeDead(dead);
  return Response.json({ sent, failed: subs.length - sent - dead.length, removed: dead.length });
}

Deno.serve(handler);
