import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'dist');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const files = [
  'index.html', 'style.css', 'workspace.css', 'legal.css', 'css', 'privacy', 'terms',
  'app.mjs', 'workspace.mjs', 'model.mjs', 'agenda.mjs', 'calendar-model.mjs',
  'care-model.mjs', 'group-colors.mjs', 'pet.mjs', 'pet-profile.mjs', 'pet-world.mjs',
];
for (const file of files) {
  await cp(resolve(root, file), resolve(output, file), { recursive: true });
}
console.log('Built Taskpup public frontend in dist/');
