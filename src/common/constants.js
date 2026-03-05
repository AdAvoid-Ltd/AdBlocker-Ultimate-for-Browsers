// Filter IDs used in the code on the background page
// Maps to filter IDs from tools/constants.js
export const AntiBannerFiltersId = {
  UserFilterId: 0,
  UltimateAdFilterId: 1,
  UltimatePrivacyFilterId: 3,
  UltimateSecurityFilterId: 5,
  NoCoinFilterId: 6,
  AntiCircumventionFilterId: 999,
  AllowlistFilterId: 100,
};

// Group ids used in the code on the multiple entry points
// Uses simplified 0-4 scheme matching our own filter metadata
export const AntibannerGroupsId = {
  CustomFiltersGroupId: 0,
  AdBlockingFiltersGroupId: 1,
  PrivacyFiltersGroupId: 2,
  SecurityFiltersGroupId: 3,
  LanguageFiltersGroupId: 4,
};

export const RECOMMENDED_TAG_ID = 10;

export const EventType = {
  RequestFilterUpdated: 'request.filter.updated',
  UserFilterUpdated: 'user.filter.updated',
  CustomFilterAdded: 'custom.filter.added',
  UpdateAllowlistFilterRules: 'update.allowlist.filter.rules',
  SettingUpdated: 'update.setting.value',
  FiltersUpdateCheckReady: 'update.filters.check',
};

export const KEEP_ALIVE_PORT_NAME = 'keep-alive';

export const CUSTOM_FILTERS_GROUP_DISPLAY_NUMBER = 99;

export const CUSTOM_FILTERS_START_ID = 1000;

export const FiltersUpdateTime = {
  Disabled: 0,
  OneHour: 1000 * 60 * 60 * 1,
  SixHours: 1000 * 60 * 60 * 6,
  TwelveHours: 1000 * 60 * 60 * 12,
  TwentyFourHours: 1000 * 60 * 60 * 24,
  FortyEightHours: 1000 * 60 * 60 * 48,
  Default: -1,
};

export const NEWLINE_CHAR_UNIX = '\n';

export const NEWLINE_CHAR_REGEX = /\r?\n/;

export const NEW_LINE_SEPARATOR = '\n';

/**
 * Regex to match allowlist-style exception rules.
 * Matches: @@||domain.com^$document
 * Captures: domain.com
 */
export const ALLOWLIST_RULE_REGEX = /^@@\|\|(.+?)\^\$document$/;

export const OPTIONS_PAGE = 'pages/options.html';

export const FILTER_LIST_EXTENSION = '.txt';

/**
 * This is just a syntax sugar for setting default value if we not have
 * preprocessed list for user rules or for custom filters.
 */
export const emptyPreprocessedFilterList = {
  filterList: [],
  sourceMap: {},
  rawFilterList: '',
  conversionMap: {},
};

export const CHROME_EXTENSIONS_SETTINGS_URL = 'chrome://extensions';

/**
 * Minimum Chrome versions required for different toggles which enables usage of User Scripts API.
 *
 * User scripts API with needed 'execute' method is supported from Chrome 135 and higher.
 * But prior to 138 it can be enabled only via Developer mode toggle.
 * And for 138 and higher it can be enabled via User Scripts API toggle in the extensions details.
 */
export const USER_SCRIPTS_API_MIN_CHROME_VERSION_REQUIRED = {
  DEV_MODE_TOGGLE: 135,
  ALLOW_USER_SCRIPTS_TOGGLE: 138,
};
