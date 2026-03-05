import browser from 'webextension-polyfill';

import { logger } from '../../../common/logger';
import { AntiBannerFiltersId } from '../../../common/constants';
import {
  SettingOption,
  SETTINGS_KEY,
  APP_VERSION_KEY,
  LAST_UPDATE_KEY,
  PAGE_STATISTIC_KEY,
  DESKTOP_APP_INSTALLED_KEY,
} from '../../storage-keys';
import { browserModel, FiltersModel } from '../../models';
import { defaultSettings } from '../settings/defaults';

import {
  MV2_SETTINGS_KEY,
  MV2LegacyKey,
  MV2_USER_RULES_KEY,
  MV2_FILTER_RULES_PREFIX,
  ABU_EXTENSION_MIGRATION_MAP,
} from './constants';

/**
 * Transforms MV2 filters-state to current format.
 * - Remaps old abu-extension filter IDs to new canonical IDs
 * - Sets loaded=false to trigger re-download
 *
 * @param {string} legacyStateString - JSON string of legacy filters-state
 * @returns {string|null} - JSON string of transformed filters-state or null
 */
function transformFiltersState(legacyStateString) {
  if (!legacyStateString) {
    return null;
  }

  try {
    const legacy = JSON.parse(legacyStateString);
    const newState = {};

    for (const [oldId, state] of Object.entries(legacy)) {
      // Remap old filter ID to new canonical ID
      const oldIdNum = parseInt(oldId, 10);
      const newId = ABU_EXTENSION_MIGRATION_MAP[oldIdNum];

      if (newId === undefined) {
        // Skip unknown filter IDs (custom filters have IDs >= 1000)
        if (oldIdNum < 1000) {
          logger.debug(`[ext.MV2Migrator.transformFiltersState]: Unknown filter ID ${oldId}, skipping`);
        }
        continue;
      }

      newState[newId] = {
        enabled: state.enabled ?? false,
        installed: state.installed ?? state.loaded ?? false,
        loaded: false, // Force re-download
      };
    }

    return JSON.stringify(newState);
  } catch (e) {
    logger.warn('[ext.MV2Migrator.transformFiltersState]: Failed to parse filters-state:', e);
    return null;
  }
}

/**
 * Transforms MV2 groups-state to current format.
 * MV2 format: { "1": { enabled: true }, ... }
 * Current format: { "1": { enabled: true, touched: true }, ... }
 *
 * The 'touched' flag indicates user has interacted with the group.
 * Set to true for migrated groups to preserve their enabled state.
 */
function transformGroupsState(legacyStateString) {
  if (!legacyStateString) {
    return null;
  }

  try {
    const legacy = JSON.parse(legacyStateString);

    // Check if there are any entries
    if (Object.keys(legacy).length === 0) {
      return null;
    }

    const newState = {};

    for (const [id, state] of Object.entries(legacy)) {
      newState[id] = {
        enabled: state.enabled ?? false,
        touched: true, // Mark as touched to preserve user's choice
      };
    }

    return JSON.stringify(newState);
  } catch (e) {
    logger.warn('[ext.MV2Migrator.transformGroupsState]: Failed to parse groups-state:', e);
    return null;
  }
}

/**
 * Derives groups-state from filters-state when groups-state doesn't exist.
 *
 * In MV2 legacy, groups-state is only written when user explicitly toggles a category.
 * If groups-state doesn't exist, we need to derive it from enabled filters.
 *
 * Since filter IDs differ between legacy and current extension, we can't reliably
 * map filters to groups. Instead, we enable the common filter groups when there
 * are ANY enabled filters, ensuring filtering works after migration.
 *
 * @param {string} filtersStateString - JSON string of filters-state
 * @returns {string|null} - JSON string of derived groups-state or null
 */
function deriveGroupsStateFromFilters(filtersStateString) {
  if (!filtersStateString) {
    return null;
  }

  try {
    const filtersState = JSON.parse(filtersStateString);

    // Check if there are any enabled filters
    const hasEnabledFilters = Object.values(filtersState).some(
      (state) => state.enabled === true,
    );

    if (!hasEnabledFilters) {
      return null;
    }

    // Enable common groups: custom(0), ad-blocking(1), privacy(2), security(3), language(4)
    // This ensures that migrated users with enabled filters have working filtering.
    // Groups being enabled doesn't enable filters - only filters marked as enabled
    // in filters-state will be active.
    const groupsState = {
      0: { enabled: true, touched: true }, // CustomFiltersGroupId
      1: { enabled: true, touched: true }, // AdBlockingFiltersGroupId
      2: { enabled: true, touched: true }, // PrivacyFiltersGroupId
      3: { enabled: true, touched: true }, // SecurityFiltersGroupId
      4: { enabled: true, touched: true }, // LanguageFiltersGroupId
    };

    logger.info('[ext.MV2Migrator]: Derived groups-state from enabled filters');
    return JSON.stringify(groupsState);
  } catch (e) {
    logger.warn('[ext.MV2Migrator.deriveGroupsStateFromFilters]: Failed to derive groups-state:', e);
    return null;
  }
}

/**
 * Transforms MV2 custom_filters to current format.
 * MV2 format: [{filterId, name, subscriptionUrl, groupId, description, homepage, version, expires, timeUpdated, ...}]
 * Current format: [{filterId, customUrl, name, groupId, tags, displayNumber, description, homepage, ...}]
 *
 * Custom filters MUST have tags: [0] to prevent crash in Categories.getTagsDetails()
 */
function transformCustomFilters(legacyCustomFiltersString) {
  if (!legacyCustomFiltersString) {
    return null;
  }

  try {
    const legacy = JSON.parse(legacyCustomFiltersString);
    if (!Array.isArray(legacy) || legacy.length === 0) {
      return null;
    }

    const customFilters = legacy.map((filter) => ({
      filterId: filter.filterId,
      customUrl: filter.subscriptionUrl || filter.url,
      name: filter.name || filter.title || `Custom Filter ${filter.filterId}`,
      groupId: 0, // AntibannerGroupsId.CustomFiltersGroupId
      displayNumber: filter.displayNumber || 0,
      tags: [0], // Required for custom filters, prevents crash in getTagsDetails
      description: filter.description || '',
      homepage: filter.homepage || '',
      version: filter.version || '',
      expires: filter.expires || 432000, // 5 days default
      timeUpdated: filter.timeUpdated ? new Date(filter.timeUpdated).getTime() : Date.now(),
      trusted: filter.trusted ?? false,
      checksum: filter.checksum || '',
    }));

    return JSON.stringify(customFilters);
  } catch (e) {
    logger.warn('[ext.MV2Migrator.transformCustomFilters]: Failed to parse custom_filters:', e);
    return null;
  }
}

function getLegacyKeysToRemove(storage) {
  const keysToRemove = [MV2_SETTINGS_KEY];

  // Find all filterrules_*.txt keys
  for (const key of Object.keys(storage)) {
    if (key.startsWith(MV2_FILTER_RULES_PREFIX)) {
      keysToRemove.push(key);
    }
  }

  return keysToRemove;
}

export class MV2Migrator {
  static async migrate(storage) {
    logger.info('[ext.MV2Migrator.migrate]: Starting MV2 migration...');

    // abu-settings is stored as a JavaScript object in browser.storage.local
    // The object contains keys with values that may be JSON strings
    let legacy = storage[MV2_SETTINGS_KEY];

    if (typeof legacy === 'string') {
      try {
        legacy = JSON.parse(legacy);
      } catch (e) {
        logger.warn('[ext.MV2Migrator.migrate]: Failed to parse abu-settings JSON:', e);
        legacy = {};
      }
    }
    legacy = legacy || {};

    const newSettings = {};

    // Migrate allowlist domains (key rename: white-list-domains -> allowlist-domains)
    try {
      const allowlist = legacy[MV2LegacyKey.WhiteListDomains];

      if (allowlist) {
        // Validate it's valid JSON
        JSON.parse(allowlist);
        newSettings[SettingOption.AllowlistDomains] = allowlist;
      } else {
        newSettings[SettingOption.AllowlistDomains] = defaultSettings[SettingOption.AllowlistDomains];
      }
    } catch (e) {
      logger.warn('[ext.MV2Migrator.migrate]: Failed to migrate allowlist:', e);
      newSettings[SettingOption.AllowlistDomains] = defaultSettings[SettingOption.AllowlistDomains];
    }

    // Migrate filters state (transform and set loaded=false)
    try {
      const filtersState = transformFiltersState(legacy[MV2LegacyKey.FiltersState]);

      if (filtersState) {
        newSettings[SettingOption.FiltersState] = filtersState;
      }
    } catch (e) {
      logger.warn('[ext.MV2Migrator.migrate]: Failed to migrate filters state:', e);
    }

    // Migrate groups state (add touched=true to preserve user's choice)
    // If groups-state doesn't exist in legacy (user never toggled categories),
    // derive it from enabled filters to ensure filtering works after migration.
    try {
      let groupsState = transformGroupsState(legacy[MV2LegacyKey.GroupsState]);

      // Fallback: derive from filters-state if groups-state is missing/empty
      if (!groupsState) {
        groupsState = deriveGroupsStateFromFilters(legacy[MV2LegacyKey.FiltersState]);
      }

      if (groupsState) {
        newSettings[SettingOption.GroupsState] = groupsState;
      }
    } catch (e) {
      logger.warn('[ext.MV2Migrator.migrate]: Failed to migrate groups state:', e);
    }

    // Migrate custom filters (subscriptionUrl -> url, name -> title)
    try {
      const customFilters = transformCustomFilters(legacy[MV2LegacyKey.CustomFilters]);
      if (customFilters) {
        newSettings[SettingOption.CustomFilters] = customFilters;
      }
    } catch (e) {
      logger.warn('[ext.MV2Migrator.migrate]: Failed to migrate custom filters:', e);
    }

    // Migrate boolean settings (legacy keys use inverted logic: *-disabled = true means feature is OFF)
    // disable-show-page-statistic: true means hide stats, so we negate it
    const disablePageStats = legacy[MV2LegacyKey.DisableShowPageStatistic];
    newSettings[SettingOption.ShowPageStats] = disablePageStats !== undefined
      ? !disablePageStats
      : defaultSettings[SettingOption.ShowPageStats];

    // context-menu-disabled: true means context menu is OFF, so we negate it
    const contextMenuDisabled = legacy[MV2LegacyKey.ContextMenuDisabled];
    newSettings[SettingOption.ShowContextMenu] = contextMenuDisabled !== undefined
      ? !contextMenuDisabled
      : defaultSettings[SettingOption.ShowContextMenu];

    // detect-filters-disabled: true means auto-detect is OFF, so we negate it
    const detectFiltersDisabled = legacy[MV2LegacyKey.DetectFiltersDisabled];
    newSettings[SettingOption.AutoDetectFilters] = detectFiltersDisabled !== undefined
      ? !detectFiltersDisabled
      : defaultSettings[SettingOption.AutoDetectFilters];

    newSettings[SettingOption.FiltersUpdatePeriod] = defaultSettings[SettingOption.FiltersUpdatePeriod];

    // Write new settings object
    await browserModel.set(SETTINGS_KEY, newSettings);

    // Migrate top-level keys
    try {
      if (legacy[MV2LegacyKey.AppVersion]) {
        await browserModel.set(APP_VERSION_KEY, legacy[MV2LegacyKey.AppVersion]);
      }
      if (legacy[MV2LegacyKey.LastUpdate]) {
        await browserModel.set(LAST_UPDATE_KEY, legacy[MV2LegacyKey.LastUpdate]);
      }
      if (legacy[MV2LegacyKey.PageStatistic]) {
        await browserModel.set(PAGE_STATISTIC_KEY, legacy[MV2LegacyKey.PageStatistic]);
      }
      // abu-desktop-installed -> desktop-app-installed
      if (legacy[MV2LegacyKey.DesktopInstalled]) {
        await browserModel.set(DESKTOP_APP_INSTALLED_KEY, true);
      }
    } catch (e) {
      logger.warn('[ext.MV2Migrator.migrate]: Failed to migrate top-level keys:', e);
    }

    // Migrate user rules (filterrules_0.txt)
    // In abu-extension, user rules are stored as an ARRAY of strings, not a single string
    try {
      const userRulesData = storage[MV2_USER_RULES_KEY];
      let userRulesText = '';

      if (Array.isArray(userRulesData)) {
        // Join array of rule strings with newlines
        userRulesText = userRulesData.join('\n');
      } else if (typeof userRulesData === 'string') {
        // Fallback in case format differs
        userRulesText = userRulesData;
      }

      if (userRulesText.trim()) {
        await FiltersModel.set(AntiBannerFiltersId.UserFilterId, userRulesText);
      }
    } catch (e) {
      logger.warn('[ext.MV2Migrator.migrate]: Failed to migrate user rules:', e);
    }

    // Remove legacy keys (cleanup inside migrator)
    try {
      await browser.storage.local.remove(getLegacyKeysToRemove(storage));
    } catch (e) {
      logger.warn('[ext.MV2Migrator.migrate]: Failed to remove legacy keys:', e);
    }

    logger.info('[ext.MV2Migrator.migrate]: MV2 migration completed');
  }
}
