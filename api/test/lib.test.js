import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePassword, hashPassword, verifyPassword } from '../src/lib/passwords.js';
import { createToken, parseCookies, verifyToken } from '../src/lib/session.js';
import { slugify, summarize, toCsv } from '../src/lib/invitations.js';

test('verifyPassword accepts the right password and rejects wrong ones', async () => {
  const hash = await hashPassword('geheim');
  assert.equal(await verifyPassword('geheim', hash), true);
  assert.equal(await verifyPassword('falsch', hash), false);
  assert.equal(await verifyPassword('geheim', 'garbage'), false);
});

test('generatePassword avoids ambiguous characters', () => {
  const password = generatePassword(200);
  assert.equal(password.length, 200);
  assert.doesNotMatch(password, /[0O1lI]/);
});

test('verifyToken rejects tampered, foreign and expired tokens', () => {
  const token = createToken({ role: 'guest', sub: 'a' }, 'secret', 60, 1000);
  assert.equal(verifyToken(token, 'secret', 2000).sub, 'a');
  assert.equal(verifyToken(token, 'other-secret', 2000), null);
  assert.equal(verifyToken(token, 'secret', 1000 + 61_000), null);
  const [, signature] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ role: 'admin', exp: 9e15 })).toString('base64url');
  assert.equal(verifyToken(`${forged}.${signature}`, 'secret', 2000), null);
  assert.equal(verifyToken(undefined, 'secret'), null);
});

test('parseCookies reads multiple cookies', () => {
  assert.deepEqual(parseCookies('a=1; b=x%20y'), { a: '1', b: 'x y' });
  assert.deepEqual(parseCookies(null), {});
});

test('slugify transliterates German umlauts', () => {
  assert.equal(slugify('Familie Müller & Söhne'), 'familie-mueller-soehne');
});

test('summarize counts people and unanswered invitations', () => {
  const summary = summarize([
    {
      displayName: 'Familie X',
      respondedAt: '2026-11-01T00:00:00Z',
      guests: [
        { firstName: 'A', lastName: 'X', attending: true, diet: 'vegetarisch', allergies: 'Nüsse' },
        { firstName: 'B', lastName: 'X', attending: false, diet: null, allergies: '' },
      ],
    },
    { respondedAt: null, guests: [] },
  ]);
  assert.equal(summary.attending, 1);
  assert.equal(summary.declined, 1);
  assert.equal(summary.open, 1);
  assert.equal(summary.answered, 1);
  assert.equal(summary.diets.vegetarisch, 1);
  assert.deepEqual(summary.allergies, [{ name: 'A X', invitation: 'Familie X', allergies: 'Nüsse' }]);
});

test('toCsv quotes separators, formats German times and lists unanswered invitations', () => {
  const csv = toCsv([
    {
      displayName: 'Familie; Test', username: 'u',
      createdAt: '2026-11-01T10:00:00Z', respondedAt: '2026-11-02T10:00:00Z', updatedAt: '2026-11-03T16:30:00Z',
      guests: [{ firstName: 'Anna "Ann"', lastName: 'B', attending: true, diet: 'alles', allergies: '' }],
    },
    { displayName: 'Offen', username: 'o', createdAt: '2026-07-01T10:00:00Z', respondedAt: null, guests: [] },
  ]);
  const lines = csv.slice(1).trim().split('\r\n');
  assert.equal(lines.length, 3);
  assert.equal(lines[1], '"Familie; Test";u;"Anna ""Ann""";B;ja;alles;;01.11.2026, 11:00;03.11.2026, 17:30');
  assert.equal(lines[2], 'Offen;o;;;offen;;;01.07.2026, 12:00;01.07.2026, 12:00');
});
