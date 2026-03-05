/* eslint-disable no-console */
import { downloadFilters } from './resources/download-filters.js';
import { updateLocalScriptRulesForFirefox } from './resources/update-local-script-rules.js';

const resources = async () => {
  console.log('Downloading resources...');
  await downloadFilters();
  console.log('Resources downloaded');

  console.log('Updating local script rules...');
  await updateLocalScriptRulesForFirefox();
  console.log('Local script rules updated');
};

(async () => {
  await resources();
})();
