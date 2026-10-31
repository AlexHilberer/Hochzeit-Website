import { api, errorText } from './api.js';

const loginSection = document.getElementById('login-section');
const dashboard = document.getElementById('dashboard');
const dashboardError = document.getElementById('dashboard-error');
const invitationDialog = document.getElementById('invitation-dialog');
const invitationForm = document.getElementById('invitation-form');
const credentialsDialog = document.getElementById('credentials-dialog');
let editingId = null;
let invitations = [];
let activeFilter = 'all';

const STATUS = { true: ['zugesagt', 'yes'], false: ['abgesagt', 'no'] };
const FILTERS = {
  all: ['Alle', () => true],
  answered: ['Beantwortet', (invitation) => Boolean(invitation.respondedAt)],
  open: ['Offen', (invitation) => !invitation.respondedAt],
};
const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
const formatDate = (iso) => (iso ? dateFormat.format(new Date(iso)) : '–');
const lastChangedAt = (invitation) => invitation.updatedAt ?? invitation.respondedAt ?? invitation.createdAt;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function button(text, className, onClick) {
  const node = element('button', text, `small ${className}`);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

function renderTiles(containerId, tiles) {
  document.getElementById(containerId).replaceChildren(...tiles.map(([value, label]) => {
    const tile = element('div', undefined, 'tile');
    tile.append(element('strong', value), element('span', label));
    return tile;
  }));
}

function renderSummary(summary) {
  renderTiles('response-tiles', [[summary.invitations, 'Einladungen'], [summary.answered, 'Beantwortet'], [summary.open, 'Offen']]);
  renderTiles('people-tiles', [[summary.attending, 'Zusagen'], [summary.declined, 'Absagen']]);
  renderTiles('diet-tiles', [[summary.diets.alles, 'Alles'], [summary.diets.vegetarisch, 'Vegetarisch']]);
  const percent = summary.invitations ? Math.round((summary.answered / summary.invitations) * 100) : 0;
  document.getElementById('progress-bar').style.width = `${percent}%`;
  document.getElementById('progress-text').textContent = `${percent} % der Einladungen haben geantwortet`;
  document.getElementById('allergies-section').hidden = summary.allergies.length === 0;
  document.getElementById('allergies').replaceChildren(...summary.allergies.map(({ name, invitation, allergies }) => {
    const row = document.createElement('tr');
    row.append(element('td', name), element('td', invitation), element('td', allergies));
    return row;
  }));
}

function renderFilters() {
  document.getElementById('filters').replaceChildren(...Object.entries(FILTERS).map(([key, [label, matches]]) => {
    const count = invitations.filter(matches).length;
    const node = button(`${label} (${count})`, key === activeFilter ? 'active' : 'secondary', () => {
      activeFilter = key;
      renderInvitations();
    });
    node.setAttribute('aria-pressed', String(key === activeFilter));
    return node;
  }));
}

function matchesSearch(invitation, query) {
  const people = invitation.guests.map((guest) => `${guest.firstName} ${guest.lastName}`);
  return [invitation.displayName, invitation.username, ...people].some((text) => text.toLowerCase().includes(query));
}

function renderInvitations() {
  const query = document.getElementById('search').value.trim().toLowerCase();
  const visible = invitations.filter(FILTERS[activeFilter][1]).filter((invitation) => matchesSearch(invitation, query));
  renderFilters();
  document.getElementById('invitations').replaceChildren(...visible.map(renderRow));
  document.getElementById('no-results').hidden = visible.length > 0;
}

function renderRow(invitation) {
  const row = document.createElement('tr');
  const name = element('td', undefined, 'invitation-cell');
  name.append(element('strong', invitation.displayName), element('span', invitation.username, 'username'));
  const status = element('td');
  status.append(invitation.respondedAt ? element('span', 'Beantwortet', 'status yes') : element('span', 'Offen', 'status open'));
  const guests = element('ul');
  for (const guest of invitation.guests) {
    const [label, className] = STATUS[guest.attending];
    const item = element('li', `${guest.firstName} ${guest.lastName}`);
    item.append(element('span', label, `status ${className}`));
    if (guest.diet) item.append(` · ${guest.diet}`);
    guests.append(item);
  }
  if (invitation.guests.length === 0) guests.append(element('li', '–', 'muted'));
  const people = element('td');
  people.append(guests);
  const actions = element('div', undefined, 'row-actions');
  actions.append(
    button('Bearbeiten', 'secondary', () => openInvitationDialog(invitation)),
    button('Neues Passwort', 'secondary', () => resetPassword(invitation)),
    button('Löschen', 'danger', () => removeInvitation(invitation)),
  );
  const actionsCell = element('td');
  actionsCell.append(actions);
  row.append(name, status, people, element('td', formatDate(invitation.createdAt), 'date-cell'),
    element('td', formatDate(lastChangedAt(invitation)), 'date-cell'), actionsCell);
  return row;
}

async function load() {
  const result = await api('manage/invitations');
  loginSection.hidden = result.status !== 401;
  dashboard.hidden = result.status === 401;
  if (result.status === 401) return;
  if (!result.ok) {
    dashboardError.textContent = errorText(result);
    return;
  }
  dashboardError.textContent = '';
  invitations = result.data.invitations;
  renderSummary(result.data.summary);
  renderInvitations();
}

function showCredentials(username, password) {
  document.getElementById('credentials-url').textContent = window.location.origin;
  document.getElementById('credentials-username').textContent = username;
  document.getElementById('credentials-password').textContent = password;
  document.getElementById('credentials-copied').textContent = '';
  credentialsDialog.showModal();
}

function openInvitationDialog(invitation = null) {
  editingId = invitation?.id ?? null;
  document.getElementById('invitation-dialog-title').textContent = invitation ? 'Einladung bearbeiten' : 'Neue Einladung';
  document.getElementById('username-field').hidden = Boolean(invitation);
  document.getElementById('invitation-error').textContent = '';
  invitationForm.displayName.value = invitation?.displayName ?? '';
  invitationForm.username.value = '';
  invitationDialog.showModal();
}

async function resetPassword(invitation) {
  if (!confirm(`Neues Passwort für „${invitation.displayName}“ erzeugen? Das alte funktioniert dann nicht mehr.`)) return;
  const result = await api(`manage/invitations/${invitation.id}/reset-password`, { method: 'POST' });
  if (result.ok) showCredentials(result.data.username, result.data.password);
  else dashboardError.textContent = errorText(result);
}

async function removeInvitation(invitation) {
  if (!confirm(`Einladung „${invitation.displayName}“ samt Antworten wirklich löschen?`)) return;
  const result = await api(`manage/invitations/${invitation.id}`, { method: 'DELETE' });
  if (!result.ok) dashboardError.textContent = errorText(result);
  await load();
}

invitationForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const body = { displayName: invitationForm.displayName.value };
  const result = editingId
    ? await api(`manage/invitations/${editingId}`, { method: 'PUT', body })
    : await api('manage/invitations', { method: 'POST', body: { ...body, username: invitationForm.username.value } });
  if (!result.ok) {
    document.getElementById('invitation-error').textContent = errorText(result);
    return;
  }
  invitationDialog.close();
  if (result.data.password) showCredentials(result.data.invitation.username, result.data.password);
  await load();
});

document.getElementById('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  const result = await api('manage/login', { method: 'POST', body: { password: form.password.value } });
  document.getElementById('login-error').textContent = result.ok ? '' : errorText(result);
  if (result.ok) {
    form.reset();
    await load();
  }
});

document.getElementById('copy-credentials').addEventListener('click', async () => {
  const text = ['url', 'username', 'password']
    .map((field) => document.getElementById(`credentials-${field}`).textContent)
    .join('\n');
  await navigator.clipboard.writeText(text);
  document.getElementById('credentials-copied').textContent = 'Kopiert!';
});

for (const closeButton of document.querySelectorAll('[data-close]')) {
  closeButton.addEventListener('click', () => closeButton.closest('dialog').close());
}
document.getElementById('new-invitation').addEventListener('click', () => openInvitationDialog());
document.getElementById('search').addEventListener('input', renderInvitations);
document.getElementById('logout').addEventListener('click', async () => {
  await api('logout', { method: 'POST' });
  await load();
});

load();
