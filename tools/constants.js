import path from 'node:path';
import { fileURLToPath } from 'node:url';

import packageJson from '../package.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const BuildTargetEnv = {
  Dev: 'dev',
  Release: 'release',
};

export const isValidBuildEnv = (buildEnv) => {
  return Object.values(BuildTargetEnv).includes(buildEnv);
};

export const BUILD_ENV = process.env.BUILD_ENV || BuildTargetEnv.Dev;

if (!isValidBuildEnv(BUILD_ENV)) {
  throw new Error(`Invalid BUILD_ENV: ${BUILD_ENV}`);
}

export const ENV_CONF = {
  [BuildTargetEnv.Dev]: {
    outputPath: `${packageJson.version}/dev`,
    mode: 'development',
  },
  [BuildTargetEnv.Release]: {
    outputPath: `${packageJson.version}/release`,
    mode: 'production',
  },
};

export const Browser = {
  ChromeMv3: 'chrome-mv3',
  FirefoxAmo: 'firefox-amo',
  Edge: 'edge',
};

export const isValidBrowserTarget = (target) => {
  return Object.values(Browser).includes(target);
};

/**
 * List of browsers which has its own filters assets directory.
 */
export const AssetsFiltersBrowser = {
  ChromiumMv3: 'chromium-mv3',
  Edge: 'edge',
  Firefox: 'firefox',
};

export const FIREFOX_APP_ID = 'adblockultimate@adblockultimate.net';

export const BUILD_PATH = path.resolve(__dirname, '../build');

// filters constants
export const FILTERS_DEST = 'src/resources/filters/%browser';
export const DECLARATIVE_FILTERS_DEST = 'src/resources/filters/%browser/declarative';
export const LOCAL_SCRIPT_RULES_COMMENT = `By the rules of AMO, we cannot use remote scripts (and our JS rules can be counted as such).
Because of that, we use the following approach (that was accepted by AMO reviewers):

1. We pre-build JS rules from filters into the add-on (see the file called "local_script_rules.json").
2. At runtime we check every JS rule if it is included into "local_script_rules.json".
   If it is included we allow this rule to work since it is pre-built. Other rules are discarded.
3. We also allow "User rules" and "Custom filters" to work since those rules are added manually by the user.
   This way filters maintainers can test new rules before including them in the filters.`;

export const LOCAL_SCRIPT_RULES_COMMENT_CHROME_MV3 = `Search for 'JS_RULES_EXECUTION' to find all parts of script execution
process in the extension.

1. We collect and bundle all scripts that can be executed on web pages into
    the extension package into so-called \`localScriptRules\`.
2. Rules that control when and where these scripts can be executed are also
    bundled within the extension package inside ruleset files.
3. The rules look like: \`example.org#%#scripttext\`. Whenever the rule is
    matched, we check if there's a function for scripttext in
    \`localScriptRules\`, retrieve it from there and execute it.

Below is the file with all the registered scripts that can be executed.`;

// Filter configuration
export const FILTERS_BASE_URL = 'https://filters.adavoid.org/';

/**
 * Core 14 filters for MV3 (Chrome) - also included in MV2.
 * These use IDs 1-14.
 */
export const FILTERS_MV3 = [
  { id: 1, filename: 'ultimate-ad-filter.txt', enabled: true },
  { id: 2, filename: 'FanboysAnnoyanceList.txt', enabled: false },
  { id: 3, filename: 'ultimate-privacy-filter.txt', enabled: true },
  { id: 4, filename: 'FanboysSocialBlockingList.txt', enabled: false },
  { id: 5, filename: 'ultimate-security-filter.txt', enabled: true },
  { id: 6, filename: 'NoCoin.txt', enabled: true },
  { id: 7, filename: 'Russianfilter.txt', enabled: false },
  { id: 8, filename: 'Germanfilter.txt', enabled: false },
  { id: 9, filename: 'Japanesefilter.txt', enabled: false },
  { id: 10, filename: 'Dutchfilter.txt', enabled: false },
  { id: 11, filename: 'EasyListSpanish.txt', enabled: false },
  { id: 12, filename: 'Turkishfilter.txt', enabled: false },
  { id: 13, filename: 'EasyListChina.txt', enabled: false },
  { id: 14, filename: 'FrenchList.txt', enabled: false },
];

/**
 * Additional 15 filters for MV2 only (Firefox/Edge).
 * IDs kept from abu-extension where they don't conflict with MV3 IDs.
 * - ID 999: Anti-circumvention (special ID, was abu-extension ID 2)
 * - IDs 15, 17-26, 28-29: Language filters (kept from abu-extension)
 */
export const FILTERS_MV2_ADDITIONAL = [
  { id: 999, filename: 'Anticircumvention.txt', enabled: true },
  { id: 15, filename: 'Bulgarianlist.txt', enabled: false },
  { id: 17, filename: 'EasyListCzechandSlovak.txt', enabled: false },
  { id: 18, filename: 'EasyListItaly.txt', enabled: false },
  { id: 19, filename: 'LatvianList.txt', enabled: false },
  { id: 20, filename: 'EasylistPolish.txt', enabled: false },
  { id: 21, filename: 'EstonianList.txt', enabled: false },
  { id: 22, filename: 'AdblockPersianlist.txt', enabled: false },
  { id: 23, filename: 'FrellwitsSwedishFilter.txt', enabled: false },
  { id: 24, filename: 'FanboysKorean.txt', enabled: false },
  { id: 25, filename: 'ABPVNList.txt', enabled: false },
  { id: 26, filename: 'HungarianList.txt', enabled: false },
  { id: 28, filename: 'FinnishList.txt', enabled: false },
  { id: 29, filename: 'AdBlockID.txt', enabled: false },
];

/**
 * All 29 filters for MV2 (Firefox/Edge).
 */
export const FILTERS_MV2 = [...FILTERS_MV3, ...FILTERS_MV2_ADDITIONAL];

/**
 * Filter IDs for MV3 (Chrome).
 */
export const FILTER_IDS_MV3 = FILTERS_MV3.map((f) => f.id);

/**
 * Filter IDs for MV2 (Firefox/Edge).
 */
export const FILTER_IDS_MV2 = FILTERS_MV2.map((f) => f.id);

const BROWSER = process.env.BROWSER || 'chrome';

/**
 * Check if the current build is for MV3 (Chrome).
 */
export const isMv3Build = () => BROWSER === 'chrome' || BROWSER === 'chrome-mv3';

/**
 * Filter IDs based on current build target.
 */
export const FILTER_IDS = isMv3Build() ? FILTER_IDS_MV3 : FILTER_IDS_MV2;

/**
 * Get download URL for a filter.
 * Ultimate-* files are at root, others are under filters/ subdirectory.
 */
export const getFilterDownloadUrl = (filter) => {
  let url = FILTERS_BASE_URL;
  if (!filter.filename.includes('ultimate-')) {
    url += 'filters/';
  }
  url += filter.filename;
  return url;
};
