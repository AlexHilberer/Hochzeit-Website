import { createInterface } from 'node:readline/promises';
import { hashPassword } from '../src/lib/passwords.js';

const readline = createInterface({ input: process.stdin, output: process.stderr });
const password = await readline.question('Passwort: ');
readline.close();
if (!password) {
  console.error('Leeres Passwort, abgebrochen.');
  process.exit(1);
}
console.log(await hashPassword(password));
