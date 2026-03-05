// Firefox MV2 Legacy Keys
export const MV2_SETTINGS_KEY = 'abu-settings';

export const MV2LegacyKey = {
  AppVersion: 'app-version',
  FiltersState: 'filters-state',
  GroupsState: 'groups-state',
  LastUpdate: 'last-update',
  DesktopInstalled: 'abu-desktop-installed',
  PageStatistic: 'page-statistic',
  WhiteListDomains: 'white-list-domains',
  CustomFilters: 'custom_filters',
  DisableShowPageStatistic: 'disable-show-page-statistic',
  ContextMenuDisabled: 'context-menu-disabled',
  DetectFiltersDisabled: 'detect-filters-disabled',
};

export const MV2_FILTER_RULES_PREFIX = 'filterrules_';
export const MV2_USER_RULES_KEY = 'filterrules_0.txt';

// Chrome/Edge MV3 Legacy Keys
export const MV3LegacyKey = {
  CustomFiltersRules: 'custom-filters-rules',
  CustomRules: 'custom-rules',
  EnabledFilters: 'enabled-filters',
  FiltersInfo: 'filters-info',
  InstalledOn: 'installed-on',
  LastUpdate: 'last-update',
  Settings: 'settings',
  UserRulesStatus: 'user-rules-status',
};

export const MV3SettingsKey = {
  ContextMenuEnabled: 'context-menu-enabled',
  DesktopAppActive: 'desktop-app-active',
  DesktopAppInstalled: 'desktop-app-installed',
  DetectLanguageEnabled: 'detect-language-enabled',
  ExtensionVersion: 'extension-version',
  IconNumberEnabled: 'icon-number-enabled',
};

// Storage Format Identifiers
export const StorageFormat = {
  MV2_LEGACY: 'mv2-legacy',
  MV3_LEGACY: 'mv3-legacy',
  CURRENT: 'current',
  NONE: 'none',
};

// MV3 Legacy category string to current groupId mapping
// Used to derive groups-state from filters-info during MV3 migration
export const MV3CategoryToGroupId = {
  'ad-blocking': 1, // AdBlockingFiltersGroupId
  'privacy': 2, // PrivacyFiltersGroupId
  'security': 3, // SecurityFiltersGroupId
  'language': 4, // LanguageFiltersGroupId
  'custom': 0, // CustomFiltersGroupId
};

/**
 * Migration map for converting abu-extension (legacy MV2) filter IDs to new IDs.
 *
 * Old abu-extension used different filter IDs. This map converts them to the new
 * canonical ID scheme used by abu-cross-browser-extension.
 *
 * Key: Old abu-extension filter ID
 * Value: New canonical filter ID
 *
 * Notable changes:
 * - ID 2 (Anti-circumvention) -> 999 (special ID)
 * - IDs 3-6 shifted down to 2-5 (FanboysAnnoyance, Privacy, Social, Security)
 * - ID 8 (NoCoin) -> 6
 * - IDs 9-14 (language filters) -> 7-12
 * - ID 16 (EasyListChina) -> 13
 * - ID 27 (FrenchList) -> 14
 * - IDs 15, 17-26, 28-29 kept as-is (language filters)
 */
export const ABU_EXTENSION_MIGRATION_MAP = {
  1: 1, // Ultimate Ad Filter
  2: 999, // Anti-circumvention -> special ID
  3: 2, // FanboysAnnoyanceList
  4: 3, // ultimate-privacy-filter
  5: 4, // FanboysSocialBlockingList
  6: 5, // ultimate-security-filter
  8: 6, // NoCoin
  9: 7, // Russianfilter
  10: 8, // Germanfilter
  11: 9, // Japanesefilter
  12: 10, // Dutchfilter
  13: 11, // EasyListSpanish
  14: 12, // Turkishfilter
  15: 15, // Bulgarianlist (kept)
  16: 13, // EasyListChina
  17: 17, // EasyListCzechandSlovak (kept)
  18: 18, // EasyListItaly (kept)
  19: 19, // LatvianList (kept)
  20: 20, // EasylistPolish (kept)
  21: 21, // EstonianList (kept)
  22: 22, // AdblockPersianlist (kept)
  23: 23, // FrellwitsSwedishFilter (kept)
  24: 24, // FanboysKorean (kept)
  25: 25, // ABPVNList (kept)
  26: 26, // HungarianList (kept)
  27: 14, // FrenchList
  28: 28, // FinnishList (kept)
  29: 29, // AdBlockID (kept)
};
