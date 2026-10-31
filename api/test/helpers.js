import { hashPassword } from '../src/lib/passwords.js';

export const SECRET = 'test-secret';
export const ADMIN_PASSWORD = 'admin-pass';

export function createFakeStore(invitations = []) {
  const items = new Map(invitations.map((invitation) => [invitation.id, structuredClone(invitation)]));
  return {
    items,
    async getById(id) { return structuredClone(items.get(id) ?? null); },
    async getByUsername(username) {
      return structuredClone([...items.values()].find((item) => item.username === username) ?? null);
    },
    async list() { return [...items.values()].map((item) => structuredClone(item)); },
    async create(invitation) { items.set(invitation.id, structuredClone(invitation)); return invitation; },
    async replace(invitation) { items.set(invitation.id, structuredClone(invitation)); return invitation; },
    async remove(id) { items.delete(id); },
  };
}

export async function createConfig(overrides = {}) {
  return { sessionSecret: SECRET, adminPasswordHash: await hashPassword(ADMIN_PASSWORD), rsvpDeadline: null, ...overrides };
}

export async function sampleInvitation(password = 'guest-pass') {
  return {
    id: 'inv-1',
    username: 'familie-mueller',
    passwordHash: await hashPassword(password),
    displayName: 'Familie Müller',
    guests: [],
    respondedAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
  };
}

export function cookiesFrom(response) {
  return Object.fromEntries(response.cookies.map((cookie) => [cookie.name, cookie.value]));
}
