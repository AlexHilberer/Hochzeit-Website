import { app } from '@azure/functions';
import { createCosmosStore } from '../lib/cosmosStore.js';
import { parseCookies } from '../lib/session.js';
import { createGuestHandlers } from '../handlers/guest.js';
import { createAdminHandlers } from '../handlers/admin.js';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing app setting ${name}`);
  return value;
}

const config = {
  sessionSecret: requireEnv('SESSION_SECRET'),
  adminPasswordHash: requireEnv('ADMIN_PASSWORD_HASH'),
  rsvpDeadline: process.env.RSVP_DEADLINE ? new Date(process.env.RSVP_DEADLINE) : null,
};
const store = createCosmosStore({
  connectionString: requireEnv('COSMOS_CONNECTION_STRING'),
  databaseId: requireEnv('COSMOS_DATABASE'),
  containerId: requireEnv('COSMOS_CONTAINER'),
});
const guest = createGuestHandlers({ store, config });
const admin = createAdminHandlers({ store, config });

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function route(name, methods, path, handler) {
  app.http(name, {
    methods,
    authLevel: 'anonymous',
    route: path,
    handler: async (request) =>
      handler({
        params: request.params,
        cookies: parseCookies(request.headers.get('cookie')),
        body: ['POST', 'PUT'].includes(request.method) ? await readJson(request) : null,
      }),
  });
}

route('login', ['POST'], 'login', guest.login);
route('logout', ['POST'], 'logout', guest.logout);
route('rsvpGet', ['GET'], 'rsvp', guest.getRsvp);
route('rsvpPut', ['PUT'], 'rsvp', guest.putRsvp);
route('adminLogin', ['POST'], 'manage/login', admin.login);
route('adminList', ['GET'], 'manage/invitations', admin.list);
route('adminCreate', ['POST'], 'manage/invitations', admin.create);
route('adminUpdate', ['PUT'], 'manage/invitations/{id}', admin.update);
route('adminRemove', ['DELETE'], 'manage/invitations/{id}', admin.remove);
route('adminResetPassword', ['POST'], 'manage/invitations/{id}/reset-password', admin.resetPassword);
route('adminExport', ['GET'], 'manage/export.csv', admin.exportCsv);
