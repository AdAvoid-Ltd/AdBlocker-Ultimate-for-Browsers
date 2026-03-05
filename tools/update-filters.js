/* eslint-disable no-console */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const run = (command, options = {}) => {
  console.log(`\n> ${command}\n`);
  execSync(command, {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    ...options,
  });
};

const main = async () => {
  console.log('=== Updating filters ===\n');

  console.log('Step 1: Download/update filter resources...');
  run('pnpm resources');

  console.log('\nStep 2: Increment patch version...');
  run('pnpm increment:patch');

  console.log('\nStep 3: Stage and commit changes...');
  run('git add src/resources/filters package.json');
  run('git commit -m "Update filters"');

  console.log('\n=== Filters updated successfully ===');
};

main().catch((error) => {
  console.error('\nError:', error.message);
  process.exit(1);
});
