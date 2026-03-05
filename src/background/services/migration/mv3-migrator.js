import browser from 'webextension-polyfill';

import { logger } from '../../../common/logger';
import {
  AntiBannerFiltersId,
  ALLOWLIST_RULE_REGEX,
  NEWLINE_CHAR_REGEX,
} from '../../../common/constants';
import {
  SettingOption,
  SETTINGS_KEY,
  APP_VERSION_KEY,
  INSTALLED_ON_KEY,
  LAST_UPDATE_KEY,
  RULES_LIMITS_KEY,
  DESKTOP_APP_ACTIVE_KEY,
  DESKTOP_APP_INSTALLED_KEY,
} from '../../storage-keys';
import { browserModel, FiltersModel } from '../../models';
import { defaultSettings } from '../settings/defaults';

import {
  MV3LegacyKey,
  MV3SettingsKey,
  MV3CategoryToGroupId,
} from './constants';

function transformFiltersState(enabledFilters, filtersInfo) {
  const newState = {};

  // Build state from filters-info array
  if (Array.isArray(filtersInfo)) {
    for (const info of filtersInfo) {
      const id = info.id;
      if (id === undefined) {
        continue;
      }

      newState[id] = {
        enabled: enabledFilters?.includes(id) ?? info.enabled ?? false,
        installed: info.enabled ?? false,
        loaded: false, // Force re-download
      };
    }
  }

  // Also include any filters in enabled-filters not in filters-info
  if (Array.isArray(enabledFilters)) {
    for (const id of enabledFilters) {
      if (!newState[id]) {
        newState[id] = {
          enabled: true,
          installed: true,
          loaded: false,
        };
      }
    }
  }

  return JSON.stringify(newState);
}

/**
 * Extracts custom filters from filters-info.
 * In MV3 legacy, custom filters are identified by category === "custom" and have a url property.
 * We only need metadata (URL, title) - the engine will re-download rules fresh.
 *
 * Custom filters MUST have tags: [0] to prevent crash in Categories.getTagsDetails()
 */
function extractCustomFilters(filtersInfo) {
  if (!Array.isArray(filtersInfo) || filtersInfo.length === 0) {
    return '[]';
  }

  // Find custom filters by category or by having a url property (custom subscriptions)
  const customFilterInfos = filtersInfo.filter(
    (info) => info.category === 'custom' || (info.url && info.id >= 1000),
  );

  if (customFilterInfos.length === 0) {
    return '[]';
  }

  const customFilters = customFilterInfos.map((info) => ({
    filterId: info.id,
    customUrl: info.url,
    name: info.title || info.url || `Custom Filter ${info.id}`,
    groupId: 0, // AntibannerGroupsId.CustomFiltersGroupId
    displayNumber: 0,
    tags: [0], // Required for custom filters, prevents crash in getTagsDetails
    description: info.description || '',
    homepage: '',
    version: '',
    expires: 432000, // 5 days default
    timeUpdated: Date.now(),
    trusted: false,
    checksum: '',
  }));

  return JSON.stringify(customFilters);
}

/**
 * Derives groups-state from enabled filters in filters-info.
 * MV3 legacy doesn't have groups/categories state - only individual filter enable/disable.
 * We derive which groups should be enabled based on which filters are enabled.
 *
 * @param {Array} filtersInfo - Array of filter info objects with id, category, enabled
 * @param {Array} enabledFilters - Array of enabled filter IDs
 * @returns {string} JSON string of groups state
 */
function deriveGroupsState(filtersInfo, enabledFilters) {
  const enabledGroupIds = new Set();

  if (Array.isArray(filtersInfo)) {
    for (const info of filtersInfo) {
      // Check if filter is enabled (either in enabled-filters array or has enabled: true)
      const isEnabled = enabledFilters?.includes(info.id) ?? info.enabled;

      if (isEnabled && info.category) {
        const groupId = MV3CategoryToGroupId[info.category];

        if (groupId !== undefined) {
          enabledGroupIds.add(groupId);
        }
      }
    }
  }

  // Build groups state with enabled groups marked as touched
  const groupsState = {};

  for (const groupId of enabledGroupIds) {
    groupsState[groupId] = {
      enabled: true,
      touched: true, // Mark as touched to preserve the derived state
    };
  }

  return JSON.stringify(groupsState);
}

function parseCustomRules(customRulesText) {
  const allowlistDomains = [];
  const userRulesLines = [];

  if (!customRulesText || typeof customRulesText !== 'string') {
    return { allowlistDomains, userRules: '' };
  }

  // Use NEWLINE_CHAR_REGEX to handle both Unix (\n) and Windows (\r\n) line endings
  const lines = customRulesText.split(NEWLINE_CHAR_REGEX);

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      continue;
    }

    // Use shared ALLOWLIST_RULE_REGEX to match allowlist rules (@@||domain^$document)
    const match = trimmedLine.match(ALLOWLIST_RULE_REGEX);
    if (match) {
      // This is an allowlist rule, extract the domain
      allowlistDomains.push(match[1]);
    } else {
      // This is a regular user rule
      userRulesLines.push(trimmedLine);
    }
  }

  return {
    allowlistDomains,
    userRules: userRulesLines.join('\n'),
  };
}

function getLegacyKeysToRemove() {
  return [
    MV3LegacyKey.CustomFiltersRules,
    MV3LegacyKey.CustomRules,
    MV3LegacyKey.EnabledFilters,
    MV3LegacyKey.FiltersInfo,
    MV3LegacyKey.InstalledOn,
    MV3LegacyKey.UserRulesStatus,
    // Note: MV3LegacyKey.Settings ('settings') is NOT removed because the new format
    // also uses 'settings' key. browserModel.set() already overwrites the entire object,
    // replacing old nested properties with the new structure.
    // Note: last-update is kept as it has the same key name
  ];
}

export class MV3Migrator {
  static async migrate(storage) {
    logger.info('[ext.MV3Migrator.migrate]: Starting MV3 migration...');

    const legacySettings = storage[MV3LegacyKey.Settings] || {};
    const newSettings = {};

    // Migrate settings with key renames (simple property access, no try/catch needed)
    // context-menu-enabled -> show-context-menu
    newSettings[SettingOption.ShowContextMenu] = legacySettings[MV3SettingsKey.ContextMenuEnabled]
      ?? defaultSettings[SettingOption.ShowContextMenu];

    // detect-language-enabled -> auto-detect-filters
    newSettings[SettingOption.AutoDetectFilters] = legacySettings[MV3SettingsKey.DetectLanguageEnabled]
      ?? defaultSettings[SettingOption.AutoDetectFilters];

    // icon-number-enabled -> show-page-stats
    newSettings[SettingOption.ShowPageStats] = legacySettings[MV3SettingsKey.IconNumberEnabled]
      ?? defaultSettings[SettingOption.ShowPageStats];

    // Set default for filters update period
    newSettings[SettingOption.FiltersUpdatePeriod] = defaultSettings[SettingOption.FiltersUpdatePeriod];

    // Migrate filters state (combine enabled-filters + filters-info)
    const enabledFilters = storage[MV3LegacyKey.EnabledFilters];
    const filtersInfo = storage[MV3LegacyKey.FiltersInfo];

    try {
      const filtersState = transformFiltersState(enabledFilters, filtersInfo);
      newSettings[SettingOption.FiltersState] = filtersState;
    } catch (e) {
      logger.warn('[ext.MV3Migrator.migrate]: Failed to migrate filters state:', e);
    }

    // Derive groups-state from enabled filters
    // MV3 legacy doesn't have groups state, so we derive it from which filters are enabled
    try {
      const groupsState = deriveGroupsState(filtersInfo, enabledFilters);

      if (groupsState !== '{}') {
        newSettings[SettingOption.GroupsState] = groupsState;
      }
    } catch (e) {
      logger.warn('[ext.MV3Migrator.migrate]: Failed to derive groups state:', e);
    }

    // Migrate custom filters (extract metadata from filters-info, engine will re-download rules)
    try {
      const filtersInfo = storage[MV3LegacyKey.FiltersInfo];
      const customFilters = extractCustomFilters(filtersInfo);
      if (customFilters !== '[]') {
        newSettings[SettingOption.CustomFilters] = customFilters;
      }
    } catch (e) {
      logger.warn('[ext.MV3Migrator.migrate]: Failed to migrate custom filters:', e);
    }

    // Parse custom-rules to extract allowlist domains and user rules
    // In abu-mv3, allowlist is stored as exception rules (@@||domain^$document) in custom-rules
    const parsedRules = parseCustomRules(storage[MV3LegacyKey.CustomRules]);

    // Migrate allowlist domains (extracted from custom-rules)
    newSettings[SettingOption.AllowlistDomains] = parsedRules.allowlistDomains.length > 0
      ? JSON.stringify(parsedRules.allowlistDomains)
      : defaultSettings[SettingOption.AllowlistDomains];

    // Write new settings object
    await browserModel.set(SETTINGS_KEY, newSettings);

    // Migrate top-level keys
    try {
      // extension-version -> app-version
      const version = legacySettings[MV3SettingsKey.ExtensionVersion];
      if (version) {
        await browserModel.set(APP_VERSION_KEY, version);
      }

      // last-update (same key, just copy if exists)
      const lastUpdate = storage[MV3LegacyKey.LastUpdate];
      if (lastUpdate) {
        await browserModel.set(LAST_UPDATE_KEY, lastUpdate);
      }

      // installed-on (same key, just copy if exists)
      const installedOn = storage[MV3LegacyKey.InstalledOn];
      if (installedOn) {
        await browserModel.set(INSTALLED_ON_KEY, installedOn);
      }

      // user-rules-status -> rules-limits
      const userRulesStatus = storage[MV3LegacyKey.UserRulesStatus];
      if (userRulesStatus) {
        await browserModel.set(RULES_LIMITS_KEY, JSON.stringify(userRulesStatus));
      }

      // desktop-app-active (move from settings to top-level)
      const desktopActive = legacySettings[MV3SettingsKey.DesktopAppActive];
      if (desktopActive !== undefined) {
        await browserModel.set(DESKTOP_APP_ACTIVE_KEY, desktopActive);
      }

      // desktop-app-installed (move from settings to top-level)
      const desktopInstalled = legacySettings[MV3SettingsKey.DesktopAppInstalled];
      if (desktopInstalled !== undefined) {
        await browserModel.set(DESKTOP_APP_INSTALLED_KEY, desktopInstalled);
      }
    } catch (e) {
      logger.warn('[ext.MV3Migrator.migrate]: Failed to migrate top-level keys:', e);
    }

    // Migrate user rules (non-allowlist rules extracted from custom-rules)
    try {
      if (parsedRules.userRules) {
        await FiltersModel.set(AntiBannerFiltersId.UserFilterId, parsedRules.userRules);
      }
    } catch (e) {
      logger.warn('[ext.MV3Migrator.migrate]: Failed to migrate user rules:', e);
    }

    // Remove legacy keys (cleanup inside migrator)
    try {
      await browser.storage.local.remove(getLegacyKeysToRemove());
    } catch (e) {
      logger.warn('[ext.MV3Migrator.migrate]: Failed to remove legacy keys:', e);
    }

    logger.info('[ext.MV3Migrator.migrate]: MV3 migration completed');
  }
}
