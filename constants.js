export const WEB_ACCESSIBLE_RESOURCES_OUTPUT = 'web-accessible-resources';
export const WEB_ACCESSIBLE_RESOURCES_OUTPUT_REDIRECTS = `${WEB_ACCESSIBLE_RESOURCES_OUTPUT}/redirects`;

export const BACKGROUND_OUTPUT = 'pages/background';
export const OPTIONS_OUTPUT = 'pages/options';
export const POPUP_OUTPUT = 'pages/popup';
export const PAGE_BLOCKED_OUTPUT = 'pages/page-blocked';
export const DOCUMENT_START_OUTPUT = 'pages/document-start';
export const ASSISTANT_INJECT_OUTPUT = 'pages/assistant-inject';

export const TSURLFILTER_VENDOR_OUTPUT = 'vendors/tsurlfilter';
export const TSURLFILTER_DECLARATIVE_CONVERTER_VENDOR_OUTPUT = 'vendors/tsurlfilter-declarative-converter';
export const AGTREE_VENDOR_OUTPUT = 'vendors/agtree';
export const CSS_TOKENIZER_VENDOR_OUTPUT = 'vendors/css-tokenizer';
export const TSWEBEXTENSION_VENDOR_OUTPUT = 'vendors/tswebextension';
export const TEXT_ENCODING_POLYFILL_VENDOR_OUTPUT = 'vendors/text-encoding-polyfill';
export const SCRIPTLETS_VENDOR_OUTPUT = 'vendors/scriptlets';

export const LOCAL_METADATA_FILE_NAME = 'filters.json';

export const INDEX_HTML_FILE_NAME = 'index.html';

/**
 * Core 14 filter IDs for MV3 (Chrome).
 */
export const FILTER_IDS_MV3 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

/**
 * All 29 filter IDs for MV2 (Firefox/Edge).
 * Includes core 14 + 15 additional language filters.
 */
export const FILTER_IDS_MV2 = [
  ...FILTER_IDS_MV3,
  999, 15, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 28, 29,
];

/**
 * Environment types for build target.
 */
export const BuildTargetEnv = {
  Dev: 'dev',
  Release: 'release',
};

/**
 * Minimum supported browser versions.
 *
 */
export const MIN_SUPPORTED_VERSION = {
  CHROMIUM_MV3: 121,
  FIREFOX: 78,
  FIREFOX_MOBILE: 113,
  EDGE_CHROMIUM: 80,
};
