/* eslint-disable no-console */
import { downloadFiltersForMv3 } from './resources/download-filters.js';
import { updateLocalResourcesForChromiumMv3 } from './resources/update-local-script-rules.js';
import { convertFiltersToRulesets } from './resources/build-rule-sets.js';
import { AssetsFiltersBrowser, DECLARATIVE_FILTERS_DEST } from './constants.js';

const resourcesMv3 = async (skipLocalResources = false) => {
  console.log('Downloading filters for MV3...');
  await downloadFiltersForMv3();
  console.log('Filters downloaded');

  console.log('Converting filters to declarative rulesets...');
  await convertFiltersToRulesets();
  console.log('Filters converted to declarative rulesets');

  if (!skipLocalResources) {
    console.log('Updating local resources for MV3...');
    await updateLocalResourcesForChromiumMv3();
    console.log('Local resources for MV3 updated');
  } else {
    console.log('Skipping update of local resources for MV3 (--skip-local-resources flag set)');
  }

  /**
   * Extract unsafe rules from the filters and save them to the metadata
   * for each rulesets to use "skip review" feature in the Chrome Web Store
   * with limitation of the number of unsafe rules to 4900, since quota
   * for session rules is 5000 and we need to leave some space for other rules.
   */
  const { excludeUnsafeRules } = await import('@adguard/dnr-rulesets');
  excludeUnsafeRules({
    dir: DECLARATIVE_FILTERS_DEST.replace('%browser', AssetsFiltersBrowser.ChromiumMv3),
    limit: 4900,
  });
};

(async () => {
  const skipLocalResources = process.argv.includes('--skip-local-resources');
  await resourcesMv3(skipLocalResources);
})();
