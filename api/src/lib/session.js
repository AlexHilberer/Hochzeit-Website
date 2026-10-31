import { createHmac, timingSafeEqual } from 'node:crypto';

export const GUEST_COOKIE = 'guest_session';
export const ADMIN_COOKIE = 'admin_session';
export const GUEST_SESSION_SECONDS = 30 * 24 * 3600;
export const ADMIN_SESSION_SECONDS = 12 * 3600;

function sign(data, secret) {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

export function createToken(payload, secret, maxAgeSeconds, now = Date.now()) {
  const data = Buffer.from(JSON.stringify({ ...payload, exp: now + maxAgeSeconds * 1000 })).toString('base64url');
  return `${data}.${sign(data, secret)}`;
}

export function verifyToken(token, secret, now = Date.now()) {
  const [data, signature] = String(token ?? '').split('.');
  if (!data || !signature) return null;
  const expected = Buffer.from(sign(data, secret));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
  return payload.exp > now ? payload : null;
}

export function sessionCookie(name, token, maxAgeSeconds) {
  return { name, value: token, maxAge: maxAgeSeconds, path: '/', httpOnly: true, secure: true, sameSite: 'Strict' };
}

export function clearedCookie(name) {
  return sessionCookie(name, '', 0);
}

export function parseCookies(header) {
  const cookies = {};
  for (const part of String(header ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index > 0) cookies[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return cookies;
}
