import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAdminHandlers } from '../src/handlers/admin.js';
import { createGuestHandlers } from '../src/handlers/guest.js';
import { ADMIN_PASSWORD, createConfig, createFakeStore, cookiesFrom, sampleInvitation } from './helpers.js';

async function setup() {
  const store = createFakeStore([await sampleInvitation()]);
  const config = await createConfig();
  const admin = createAdminHandlers({ store, config, failedLoginDelayMs: 0 });
  const guest = createGuestHandlers({ store, config, failedLoginDelayMs: 0 });
  const cookies = cookiesFrom(await admin.login({ body: { password: ADMIN_PASSWORD } }));
  return { store, admin, guest, cookies };
}

test('admin login rejects a wrong password', async () => {
  const { admin } = await setup();
  assert.equal((await admin.login({ body: { password: 'wrong' } })).status, 401);
});

test('admin routes reject missing and guest sessions', async () => {
  const { admin, guest } = await setup();
  const guestCookies = cookiesFrom(await guest.login({ body: { username: 'familie-mueller', password: 'guest-pass' } }));
  assert.equal((await admin.list({ cookies: {} })).status, 401);
  assert.equal((await admin.list({ cookies: guestCookies })).status, 401);
  assert.equal((await admin.exportCsv({ cookies: guestCookies })).status, 401);
});

test('list returns invitations without hashes plus a summary', async () => {
  const { admin, cookies } = await setup();
  const response = await admin.list({ cookies });
  assert.equal(response.status, 200);
  assert.equal(response.jsonBody.invitations[0].passwordHash, undefined);
  assert.equal(response.jsonBody.summary.open, 1);
});

test('create generates unique usernames and a working password', async () => {
  const { admin, guest, cookies } = await setup();
  const response = await admin.create({ cookies, body: { displayName: 'Familie Müller' } });
  assert.equal(response.status, 201);
  assert.equal(response.jsonBody.invitation.username, 'familie-mueller-2');
  assert.deepEqual(response.jsonBody.invitation.guests, []);
  assert.ok(response.jsonBody.invitation.createdAt);
  assert.equal(response.jsonBody.invitation.updatedAt, response.jsonBody.invitation.createdAt);
  const login = await guest.login({ body: { username: 'familie-mueller-2', password: response.jsonBody.password } });
  assert.equal(login.status, 200);
});

test('create validates input', async () => {
  const { admin, cookies } = await setup();
  assert.equal((await admin.create({ cookies, body: { displayName: '' } })).status, 400);
  assert.equal((await admin.create({ cookies, body: { displayName: 'X'.repeat(101) } })).status, 400);
  assert.equal((await admin.create({ cookies, body: { displayName: 'X', username: '!!!' } })).status, 400);
});

test('update renames and keeps the answers', async () => {
  const { admin, store, cookies } = await setup();
  store.items.get('inv-1').guests = [{ firstName: 'Anna', lastName: 'M', attending: true, diet: 'alles', allergies: '' }];
  const response = await admin.update({ cookies, params: { id: 'inv-1' }, body: { displayName: 'Müllers' } });
  assert.equal(response.status, 200);
  assert.equal(store.items.get('inv-1').displayName, 'Müllers');
  assert.ok(store.items.get('inv-1').updatedAt);
  assert.equal(store.items.get('inv-1').guests.length, 1);
  assert.equal((await admin.update({ cookies, params: { id: 'missing' }, body: { displayName: 'X' } })).status, 404);
});

test('resetPassword replaces the old password', async () => {
  const { admin, guest, cookies } = await setup();
  const { jsonBody } = await admin.resetPassword({ cookies, params: { id: 'inv-1' } });
  assert.equal((await guest.login({ body: { username: 'familie-mueller', password: 'guest-pass' } })).status, 401);
  assert.equal((await guest.login({ body: { username: 'familie-mueller', password: jsonBody.password } })).status, 200);
});

test('remove deletes the invitation', async () => {
  const { admin, store, cookies } = await setup();
  assert.equal((await admin.remove({ cookies, params: { id: 'inv-1' } })).status, 204);
  assert.equal(store.items.size, 0);
  assert.equal((await admin.remove({ cookies, params: { id: 'inv-1' } })).status, 404);
});

test('exportCsv returns one row per guest', async () => {
  const { admin, cookies } = await setup();
  const response = await admin.exportCsv({ cookies });
  assert.equal(response.status, 200);
  assert.match(response.headers['Content-Type'], /text\/csv/);
  assert.equal(response.body.trim().split('\r\n').length, 2);
});
