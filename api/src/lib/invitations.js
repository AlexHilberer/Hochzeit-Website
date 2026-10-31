export const DIETS = ['alles', 'vegetarisch'];
const MAX_ALLERGIES_LENGTH = 300;
const MAX_GUESTS = 10;
const MAX_NAME_LENGTH = 100;

export class ValidationError extends Error {}

export function publicView({ passwordHash, ...invitation }) {
  return invitation;
}

export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function parseInvitationInput(body) {
  const displayName = String(body?.displayName ?? '').trim();
  if (!displayName || displayName.length > MAX_NAME_LENGTH) {
    throw new ValidationError('Bitte einen Namen für die Einladung angeben (max. 100 Zeichen).');
  }
  return { displayName };
}

function requiredName(value, label, position) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name || name.length > MAX_NAME_LENGTH) {
    throw new ValidationError(`Bitte bei Person ${position} den ${label} angeben (max. ${MAX_NAME_LENGTH} Zeichen).`);
  }
  return name;
}

export function applyRsvp(invitation, body, now) {
  const people = body?.guests;
  if (!Array.isArray(people) || people.length === 0) {
    throw new ValidationError('Bitte mindestens eine Person eintragen.');
  }
  if (people.length > MAX_GUESTS) {
    throw new ValidationError(`Bitte höchstens ${MAX_GUESTS} Personen pro Einladung eintragen.`);
  }
  const guests = people.map((person, index) => {
    const position = index + 1;
    const { attending, diet, allergies = '' } = person ?? {};
    const firstName = requiredName(person?.firstName, 'Vornamen', position);
    const lastName = requiredName(person?.lastName, 'Nachnamen', position);
    const name = `${firstName} ${lastName}`;
    if (typeof attending !== 'boolean') {
      throw new ValidationError(`Bitte für ${name} Zusage oder Absage wählen.`);
    }
    if (attending && !DIETS.includes(diet)) {
      throw new ValidationError(`Bitte für ${name} eine Essensauswahl treffen.`);
    }
    if (typeof allergies !== 'string' || allergies.length > MAX_ALLERGIES_LENGTH) {
      throw new ValidationError(`Allergien von ${name} sind zu lang (max. ${MAX_ALLERGIES_LENGTH} Zeichen).`);
    }
    return { firstName, lastName, attending, diet: attending ? diet : null, allergies: attending ? allergies.trim() : '' };
  });
  return { ...invitation, guests, respondedAt: now.toISOString(), updatedAt: now.toISOString() };
}

// Older records predate updatedAt, so fall back to the latest known timestamp.
function lastChangedAt(invitation) {
  return invitation.updatedAt ?? invitation.respondedAt ?? invitation.createdAt;
}

export function summarize(invitations) {
  const open = invitations.filter((invitation) => !invitation.respondedAt).length;
  const summary = {
    invitations: invitations.length,
    answered: invitations.length - open,
    open,
    attending: 0,
    declined: 0,
    diets: Object.fromEntries(DIETS.map((diet) => [diet, 0])),
    allergies: [],
  };
  for (const invitation of invitations) {
    for (const guest of invitation.guests) {
      if (!guest.attending) {
        summary.declined++;
        continue;
      }
      summary.attending++;
      summary.diets[guest.diet]++;
      if (guest.allergies) {
        summary.allergies.push({ name: `${guest.firstName} ${guest.lastName}`, invitation: invitation.displayName, allergies: guest.allergies });
      }
    }
  }
  return summary;
}

const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' });

function formatDate(iso) {
  return iso ? dateFormat.format(new Date(iso)) : '';
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Semicolons and a BOM so German Excel opens it correctly.
export function toCsv(invitations) {
  const header = ['Einladung', 'Benutzername', 'Vorname', 'Nachname', 'Zusage', 'Essen', 'Allergien', 'Erstellt am', 'Zuletzt geändert'];
  const rows = invitations.flatMap((invitation) => {
    const timestamps = [formatDate(invitation.createdAt), formatDate(lastChangedAt(invitation))];
    if (invitation.guests.length === 0) {
      return [[invitation.displayName, invitation.username, '', '', 'offen', '', '', ...timestamps]];
    }
    return invitation.guests.map((guest) => [
      invitation.displayName,
      invitation.username,
      guest.firstName,
      guest.lastName,
      guest.attending ? 'ja' : 'nein',
      guest.diet,
      guest.allergies,
      ...timestamps,
    ]);
  });
  return '﻿' + [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n') + '\r\n';
}
