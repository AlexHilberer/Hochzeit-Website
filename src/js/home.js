import { api, errorText } from './api.js';

const form = document.getElementById('login-form');
const errorElement = document.getElementById('login-error');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = form.querySelector('button');
  button.disabled = true;
  errorElement.textContent = '';
  const result = await api('login', {
    method: 'POST',
    body: { username: form.username.value, password: form.password.value },
  });
  button.disabled = false;
  if (result.ok) {
    window.location.href = '/rsvp.html';
  } else {
    errorElement.textContent = errorText(result);
  }
});

const countdown = document.getElementById('countdown');
const weddingDate = new Date(countdown.dataset.date);

function renderCountdown() {
  const remaining = Math.max(0, weddingDate - Date.now());
  const parts = [
    [Math.floor(remaining / 86_400_000), 'Tage'],
    [Math.floor(remaining / 3_600_000) % 24, 'Stunden'],
    [Math.floor(remaining / 60_000) % 60, 'Minuten'],
  ];
  countdown.replaceChildren(...parts.map(([value, label]) => {
    const item = document.createElement('div');
    const number = document.createElement('strong');
    const text = document.createElement('span');
    number.textContent = value;
    text.textContent = label;
    item.append(number, text);
    return item;
  }));
}

renderCountdown();
setInterval(renderCountdown, 30_000);
