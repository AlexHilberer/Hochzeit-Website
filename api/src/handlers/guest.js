import { verifyPassword } from '../lib/passwords.js';
import {
  ADMIN_COOKIE, GUEST_COOKIE, GUEST_SESSION_SECONDS, clearedCookie, createToken, sessionCookie, verifyToken,
} from '../lib/session.js';
import { ValidationError, applyRsvp, publicView } from '../lib/invitations.js';

const FAILED_LOGIN_DELAY_MS = 800;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createGuestHandlers({ store, config, now = () => new Date(), failedLoginDelayMs = FAILED_LOGIN_DELAY_MS }) {
  const isLocked = () => Boolean(config.rsvpDeadline) && now() > config.rsvpDeadline;

  async function currentInvitation(cookies) {
    const session = verifyToken(cookies[GUEST_COOKIE], config.sessionSecret, now().getTime());
    return session?.role === 'guest' ? store.getById(session.sub) : null;
  }

  return {
    async login({ body }) {
      const username = String(body?.username ?? '').trim().toLowerCase();
      const password = String(body?.password ?? '');
      const invitation = username && password ? await store.getByUsername(username) : null;
      if (!invitation || !(await verifyPassword(password, invitation.passwordHash))) {
        await sleep(failedLoginDelayMs);
        return { status: 401, jsonBody: { error: 'Benutzername oder Passwort ist falsch.' } };
      }
      const token = createToken({ role: 'guest', sub: invitation.id }, config.sessionSecret, GUEST_SESSION_SECONDS, now().getTime());
      return { status: 200, jsonBody: { ok: true }, cookies: [sessionCookie(GUEST_COOKIE, token, GUEST_SESSION_SECONDS)] };
    },

    async logout() {
      return { status: 200, jsonBody: { ok: true }, cookies: [clearedCookie(GUEST_COOKIE), clearedCookie(ADMIN_COOKIE)] };
    },

    async getRsvp({ cookies }) {
      const invitation = await currentInvitation(cookies);
      if (!invitation) return { status: 401, jsonBody: { error: 'Bitte zuerst anmelden.' } };
      return { status: 200, jsonBody: { invitation: publicView(invitation), isLocked: isLocked() } };
    },

    async putRsvp({ cookies, body }) {
      const invitation = await currentInvitation(cookies);
      if (!invitation) return { status: 401, jsonBody: { error: 'Bitte zuerst anmelden.' } };
      if (isLocked()) return { status: 403, jsonBody: { error: 'Die Anmeldefrist ist leider abgelaufen.' } };
      try {
        const updated = await store.replace(applyRsvp(invitation, body, now()));
        return { status: 200, jsonBody: { invitation: publicView(updated), isLocked: false } };
      } catch (error) {
        if (error instanceof ValidationError) return { status: 400, jsonBody: { error: error.message } };
        throw error;
      }
    },
  };
}
