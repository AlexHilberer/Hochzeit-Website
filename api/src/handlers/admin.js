import { randomUUID } from 'node:crypto';
import { generatePassword, hashPassword, verifyPassword } from '../lib/passwords.js';
import { ADMIN_COOKIE, ADMIN_SESSION_SECONDS, createToken, sessionCookie, verifyToken } from '../lib/session.js';
import {
  ValidationError, parseInvitationInput, publicView, slugify, summarize, toCsv,
} from '../lib/invitations.js';

const FAILED_LOGIN_DELAY_MS = 800;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const UNAUTHORIZED = { status: 401, jsonBody: { error: 'Bitte als Admin anmelden.' } };
const NOT_FOUND = { status: 404, jsonBody: { error: 'Einladung nicht gefunden.' } };

export function createAdminHandlers({ store, config, now = () => new Date(), failedLoginDelayMs = FAILED_LOGIN_DELAY_MS }) {
  const isAdmin = (cookies) =>
    verifyToken(cookies[ADMIN_COOKIE], config.sessionSecret, now().getTime())?.role === 'admin';

  // Wraps a handler with the admin check and maps validation errors to 400.
  const adminOnly = (handler) => async (request) => {
    if (!isAdmin(request.cookies)) return UNAUTHORIZED;
    try {
      return await handler(request);
    } catch (error) {
      if (error instanceof ValidationError) return { status: 400, jsonBody: { error: error.message } };
      throw error;
    }
  };

  async function uniqueUsername(requested, displayName) {
    const base = slugify(requested || displayName);
    if (!base) throw new ValidationError('Der Benutzername darf nur Buchstaben, Zahlen und Bindestriche enthalten.');
    let username = base;
    for (let suffix = 2; await store.getByUsername(username); suffix++) username = `${base}-${suffix}`;
    return username;
  }

  return {
    async login({ body }) {
      const password = String(body?.password ?? '');
      if (!password || !(await verifyPassword(password, config.adminPasswordHash))) {
        await sleep(failedLoginDelayMs);
        return { status: 401, jsonBody: { error: 'Passwort ist falsch.' } };
      }
      const token = createToken({ role: 'admin' }, config.sessionSecret, ADMIN_SESSION_SECONDS, now().getTime());
      return { status: 200, jsonBody: { ok: true }, cookies: [sessionCookie(ADMIN_COOKIE, token, ADMIN_SESSION_SECONDS)] };
    },

    list: adminOnly(async () => {
      const invitations = (await store.list()).map(publicView);
      return { status: 200, jsonBody: { invitations, summary: summarize(invitations) } };
    }),

    create: adminOnly(async ({ body }) => {
      const { displayName } = parseInvitationInput(body);
      const password = generatePassword();
      const createdAt = now().toISOString();
      const invitation = await store.create({
        id: randomUUID(),
        username: await uniqueUsername(String(body.username ?? '').trim(), displayName),
        passwordHash: await hashPassword(password),
        displayName,
        guests: [],
        respondedAt: null,
        createdAt,
        updatedAt: createdAt,
      });
      return { status: 201, jsonBody: { invitation: publicView(invitation), password } };
    }),

    update: adminOnly(async ({ params, body }) => {
      const invitation = await store.getById(params.id);
      if (!invitation) return NOT_FOUND;
      const { displayName } = parseInvitationInput(body);
      const updated = await store.replace({ ...invitation, displayName, updatedAt: now().toISOString() });
      return { status: 200, jsonBody: { invitation: publicView(updated) } };
    }),

    remove: adminOnly(async ({ params }) => {
      if (!(await store.getById(params.id))) return NOT_FOUND;
      await store.remove(params.id);
      return { status: 204 };
    }),

    resetPassword: adminOnly(async ({ params }) => {
      const invitation = await store.getById(params.id);
      if (!invitation) return NOT_FOUND;
      const password = generatePassword();
      await store.replace({ ...invitation, passwordHash: await hashPassword(password), updatedAt: now().toISOString() });
      return { status: 200, jsonBody: { username: invitation.username, password } };
    }),

    exportCsv: adminOnly(async () => ({
      status: 200,
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="antworten.csv"' },
      body: toCsv(await store.list()),
    })),
  };
}
