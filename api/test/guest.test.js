import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGuestHandlers } from '../src/handlers/guest.js';
import { createConfig, createFakeStore, cookiesFrom, sampleInvitation } from './helpers.js';

async function setup(configOverrides = {}) {
  const store = createFakeStore([await sampleInvitation()]);
  const handlers = createGuestHandlers({ store, config: await createConfig(configOverrides), failedLoginDelayMs: 0 });
  return { store, handlers };
}

async function loggedIn(handlers) {
  const response = await handlers.login({ body: { username: ' Familie-Mueller ', password: 'guest-pass' } });
  assert.equal(response.status, 200);
  return cookiesFrom(response);
}

const anna = { firstName: ' Anna ', lastName: 'Müller', attending: true, diet: 'vegetarisch', allergies: ' Nüsse ' };
const tom = { firstName: 'Tom', lastName: 'Müller', attending: false, diet: 'vegetarisch', allergies: 'ignored' };
const validAnswers = { guests: [anna, tom] };

test('login rejects a wrong password', async () => {
  const { handlers } = await setup();
  const response = await handlers.login({ body: { username: 'familie-mueller', password: 'nope' } });
  assert.equal(response.status, 401);
  assert.equal(response.cookies, undefined);
});

test('login rejects unknown users and empty input', async () => {
  const { handlers } = await setup();
  assert.equal((await handlers.login({ body: { username: 'x', password: 'y' } })).status, 401);
  assert.equal((await handlers.login({ body: null })).status, 401);
});

test('getRsvp requires a session and hides the password hash', async () => {
  const { handlers } = await setup();
  assert.equal((await handlers.getRsvp({ cookies: {} })).status, 401);
  const response = await handlers.getRsvp({ cookies: await loggedIn(handlers) });
  assert.equal(response.status, 200);
  assert.equal(response.jsonBody.invitation.displayName, 'Familie Müller');
  assert.equal(response.jsonBody.invitation.passwordHash, undefined);
});

test('putRsvp saves normalized answers', async () => {
  const { handlers, store } = await setup();
  const response = await handlers.putRsvp({ cookies: await loggedIn(handlers), body: validAnswers });
  assert.equal(response.status, 200);
  const saved = store.items.get('inv-1');
  assert.deepEqual(saved.guests[0], { firstName: 'Anna', lastName: 'Müller', attending: true, diet: 'vegetarisch', allergies: 'Nüsse' });
  assert.deepEqual(saved.guests[1], { firstName: 'Tom', lastName: 'Müller', attending: false, diet: null, allergies: '' });
  assert.ok(saved.respondedAt);
  assert.equal(saved.updatedAt, saved.respondedAt);
});

test('putRsvp rejects invalid answers', async () => {
  const { handlers } = await setup();
  const cookies = await loggedIn(handlers);
  const invalidBodies = [
    {},
    { guests: [] },
    { guests: Array(11).fill(tom) },
    { guests: [{ ...anna, firstName: ' ' }] },
    { guests: [{ ...anna, lastName: undefined }] },
    { guests: [{ ...anna, attending: 'yes' }] },
    { guests: [{ ...anna, diet: 'fleisch' }] },
    { guests: [{ ...anna, diet: 'vegan' }] },
    { guests: [{ ...anna, allergies: 'x'.repeat(301) }] },
  ];
  for (const body of invalidBodies) {
    assert.equal((await handlers.putRsvp({ cookies, body })).status, 400, JSON.stringify(body).slice(0, 80));
  }
});

test('putRsvp is locked after the deadline', async () => {
  const { handlers } = await setup({ rsvpDeadline: new Date('2000-01-01') });
  const cookies = await loggedIn(handlers);
  assert.equal((await handlers.getRsvp({ cookies })).jsonBody.isLocked, true);
  assert.equal((await handlers.putRsvp({ cookies, body: validAnswers })).status, 403);
});

test('logout clears the session cookies', async () => {
  const { handlers } = await setup();
  const response = await handlers.logout();
  assert.ok(response.cookies.every((cookie) => cookie.value === '' && cookie.maxAge === 0));
});
