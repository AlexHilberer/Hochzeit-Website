import { api, errorText } from './api.js';

const MAX_PEOPLE = 10;
const card = document.getElementById('rsvp-card');
const form = document.getElementById('rsvp-form');
const peopleContainer = document.getElementById('guests');
const addButton = document.getElementById('add-person');
const errorElement = document.getElementById('rsvp-error');
const successElement = document.getElementById('rsvp-success');
const template = document.getElementById('guest-template');
let nextCardId = 0;

function updateCards() {
  const cards = [...peopleContainer.children];
  cards.forEach((element, index) => {
    element.querySelector('.person-number').textContent = `Person ${index + 1}`;
    element.querySelector('[data-remove]').hidden = cards.length === 1;
  });
  addButton.hidden = cards.length >= MAX_PEOPLE;
}

function addPerson(person = { firstName: '', lastName: '', attending: null, diet: null, allergies: '' }) {
  const element = template.content.firstElementChild.cloneNode(true);
  const cardId = nextCardId++;
  element.querySelector('[name="firstName"]').value = person.firstName;
  element.querySelector('[name="lastName"]').value = person.lastName;
  element.querySelector('[name="allergies"]').value = person.allergies;
  for (const field of ['attending', 'diet']) {
    for (const input of element.querySelectorAll(`[data-field="${field}"] input`)) {
      input.name = `${field}-${cardId}`;
      input.checked = input.value === String(person[field]);
    }
  }
  const updateVisibility = () => {
    const isAttending = element.querySelector('[data-field="attending"] input:checked')?.value === 'true';
    element.querySelector('[data-field="diet"]').hidden = !isAttending;
    element.querySelector('[data-field="allergies"]').hidden = !isAttending;
  };
  element.addEventListener('change', updateVisibility);
  element.querySelector('[data-remove]').addEventListener('click', () => {
    element.remove();
    updateCards();
  });
  updateVisibility();
  peopleContainer.append(element);
  updateCards();
}

function readAnswers() {
  return {
    guests: [...peopleContainer.children].map((element) => {
      const attending = element.querySelector('[data-field="attending"] input:checked')?.value;
      return {
        firstName: element.querySelector('[name="firstName"]').value,
        lastName: element.querySelector('[name="lastName"]').value,
        attending: attending === undefined ? null : attending === 'true',
        diet: element.querySelector('[data-field="diet"] input:checked')?.value ?? null,
        allergies: element.querySelector('[name="allergies"]').value,
      };
    }),
  };
}

function render({ invitation, isLocked }) {
  peopleContainer.replaceChildren();
  if (invitation.guests.length === 0) addPerson();
  for (const person of invitation.guests) addPerson(person);
  document.getElementById('locked-notice').hidden = !isLocked;
  for (const element of form.elements) element.disabled = isLocked;
  if (invitation.respondedAt && !isLocked) {
    successElement.textContent = 'Danke für eure Antwort! Ihr könnt sie hier jederzeit ändern.';
  }
  card.hidden = false;
}

async function load() {
  const result = await api('rsvp');
  if (result.status === 401) {
    window.location.href = '/';
    return;
  }
  if (!result.ok) {
    errorElement.textContent = errorText(result);
    card.hidden = false;
    return;
  }
  render(result.data);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorElement.textContent = '';
  successElement.textContent = '';
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  const result = await api('rsvp', { method: 'PUT', body: readAnswers() });
  button.disabled = false;
  if (result.ok) {
    render(result.data);
    successElement.textContent = 'Vielen Dank! Eure Antwort ist gespeichert.';
  } else {
    errorElement.textContent = errorText(result);
  }
});

addButton.addEventListener('click', () => addPerson());
document.getElementById('logout').addEventListener('click', async () => {
  await api('logout', { method: 'POST' });
  window.location.href = '/';
});

load();
