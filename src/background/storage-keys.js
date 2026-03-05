// Settings keys (user preferences)
export const SettingOption = {
  // General settings.
  ShowPageStats: 'show-page-stats',
  AutoDetectFilters: 'auto-detect-filters',
  FiltersUpdatePeriod: 'filters-update-period',

  // Extension specific settings.
  ShowContextMenu: 'show-context-menu',

  // Allowlist section.
  AllowlistDomains: 'allowlist-domains',

  // Filters' statuses and states.
  FiltersState: 'filters-state',
  FiltersVersion: 'filters-version',
  GroupsState: 'groups-state',

  // Filters metadata.
  Metadata: 'filters-metadata',
  CustomFilters: 'custom-filters',
};

// System/operational storage keys
export const APP_VERSION_KEY = 'app-version';
export const SETTINGS_KEY = 'settings';
export const INSTALLED_ON_KEY = 'installed-on';
export const LAST_UPDATE_KEY = 'last-update';
export const SHOW_RATE_US_POPUP_KEY = 'show-rate-us-popup';
export const PAGE_STATISTIC_KEY = 'page-statistic';
export const TRUSTED_DOCUMENTS_CACHE_KEY = 'trusted-documents';
export const RULES_LIMITS_KEY = 'rules-limits';
export const CONTENT_SCRIPT_INJECTION_FLAG = 'content-script-injection-flag';

// Desktop app integration keys
export const DESKTOP_APP_ACTIVE_KEY = 'desktop-app-active';
export const DESKTOP_APP_INSTALLED_KEY = 'desktop-app-installed';

// Filter update controller key
export const UPDATE_CHECK_TIME_KEY = 'update-check-time-ms';

// Promotional banner key prefix
export const PROMO_BANNER_DISMISSED_PREFIX = 'promotionalBannerDismissed_';
