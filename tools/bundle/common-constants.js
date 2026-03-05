import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Browser } from '../constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PAGES_PATH = path.resolve(__dirname, '../../src/pages');
export const BACKGROUND_PATH = path.resolve(__dirname, '../../src/pages/background');
export const OPTIONS_PATH = path.resolve(__dirname, '../../src/pages/options');
export const POPUP_PATH = path.resolve(__dirname, '../../src/pages/popup');
export const DOCUMENT_START_PATH = path.resolve(__dirname, '../../src/content-script');
export const ASSISTANT_INJECT_PATH = path.resolve(__dirname, '../../src/pages/assistant-inject');
export const PAGE_BLOCKED_PATH = path.resolve(__dirname, '../../src/pages/page-blocked');

export const htmlTemplatePluginCommonOptions = {
  cache: false,
  scriptLoading: 'blocking',
};

export const BROWSERS_CONF = {
  [Browser.ChromeMv3]: {
    browser: Browser.ChromeMv3,
    buildDir: Browser.ChromeMv3,
    zipName: Browser.ChromeMv3,
  },
  [Browser.FirefoxAmo]: {
    browser: Browser.FirefoxAmo,
    buildDir: Browser.FirefoxAmo,
    zipName: Browser.FirefoxAmo,
  },
  [Browser.Edge]: {
    browser: Browser.Edge,
    buildDir: Browser.Edge,
    zipName: Browser.Edge,
  },
};

/**
 * RegExp for matching components that need to be replaced while webpack building.
 *
 * Needed for components which are different for MV2 and MV3.
 */
export const COMPONENT_REPLACEMENT_MATCH_REGEXP = new RegExp(
  `\\.\\/Abstract(${['UpdateButton', 'FiltersUpdate'].join('|')})`,
);
