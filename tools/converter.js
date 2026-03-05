import { convertFiltersToRulesets } from './resources/build-rule-sets.js';

/**
 * Converts adblocking rules from the .txt files to their declarative presentation.
 *
 * This command is needed only for debug declarative rulesets: edit filters
 * right in the source dir and rebuild the rulesets.
 * But it's not needed for the production build, because the production build
 * already contains builded rulesets from `@adguard/dnr-rulesets`.
 */
const converter = async () => {
  await convertFiltersToRulesets();
};

(async () => {
  await converter();
})();
