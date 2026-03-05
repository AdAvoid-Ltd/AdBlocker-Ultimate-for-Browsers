import browser from 'webextension-polyfill';

import { BrowserUtils } from '../../../utils';
import { logger } from '../../../../common/logger';
import { SettingOption } from '../../../storage-keys';
import { AntiBannerFiltersId } from '../../../../common/constants';
import {
  metadataModel,
  filterStateModel,
  settingsModel,
  FiltersModel,
  RawFiltersModel,
  filterVersionModel,
} from '../../../models';
import { network } from '../../network';
import { FiltersService } from '../main';
import { FilterParser } from '../parser';

/**
 * API for managing filters data.
 *
 * This class provides methods for reading common filter metadata from metadataModel.data.filters,
 * installation and updating common filters data, stored in next storages:
 * - filterStateModel filters states;
 * - filterVersionModel filters versions;
 * - FiltersModel filter rules.
 * - RawFiltersModel raw filter rules, before applying directives.
 */
export class CommonFilterService {
  static getFilterMetadata(filterId) {
    return metadataModel.getFilter(filterId);
  }

  static getFiltersMetadata() {
    return metadataModel.getFilters();
  }

  static async updateFilter(filterUpdateOptions) {
    logger.info(`[ext.CommonFilterService.updateFilter]: update filter ${filterUpdateOptions.filterId}`);

    /**
     * We do not have to check metadata for the filters which do not update with force, because
     * they even do not trigger metadata update.
     */
    if (filterUpdateOptions.ignorePatches) {
      const filterMetadata = CommonFilterService.getFilterMetadata(filterUpdateOptions.filterId);

      if (!filterMetadata) {
        logger.error(`[ext.CommonFilterService.updateFilter]: cannot find filter ${filterUpdateOptions.filterId} metadata`);
        return null;
      }

      if (!CommonFilterService.isFilterNeedUpdate(filterMetadata)) {
        logger.info(`[ext.CommonFilterService.updateFilter]: filter ${filterUpdateOptions.filterId} is already updated`);
        return null;
      }
    }

    logger.info(`[ext.CommonFilterService.updateFilter]: filter ${filterUpdateOptions.filterId} needs to be updated`);

    try {
      const filterMetadata = await CommonFilterService.loadFilterRulesFromBackend(filterUpdateOptions, true);
      logger.info(`[ext.CommonFilterService.updateFilter]: filter ${filterUpdateOptions.filterId} updated successfully`);
      return filterMetadata;
    } catch (e) {
      logger.error(`[ext.CommonFilterService.updateFilter]: failed to update filter ${filterUpdateOptions.filterId}:`, e);
      return null;
    }
  }

  /**
   * Download filter rules from backend and update filter state and metadata.
   *
   * In MV3, filters and rulesets are updated with the extension; forceRemote
   * is unused and filters are loaded from local/bundled resources.
   */
  static async loadFilterRulesFromBackend(
    filterUpdateOptions,
    _forceRemote,
  ) {
    const isOptimized = settingsModel.get(SettingOption.UseOptimizedFilters);
    const oldRawFilter = await RawFiltersModel.get(filterUpdateOptions.filterId);

    const { filter, rawFilter, isPatchUpdateFailed } = await network.downloadFilterRules(
      filterUpdateOptions,
      false,
      isOptimized,
      oldRawFilter,
    );

    const currentFilterState = filterStateModel.get(filterUpdateOptions.filterId);
    filterStateModel.set(filterUpdateOptions.filterId, {
      installed: true,
      loaded: true,
      enabled: !!currentFilterState?.enabled,
    });

    const parsedMetadata = FilterParser.parseFilterDataFromHeader(filter);
    let filterMetadata = CommonFilterService.getFilterMetadata(filterUpdateOptions.filterId);
    if (!(parsedMetadata && filterMetadata)) {
      throw new Error(`Not found metadata for filter id ${filterUpdateOptions.filterId}`);
    }

    // update filter metadata with new values
    filterMetadata = {
      ...filterMetadata,
      ...parsedMetadata,
    };

    const { version, expires, timeUpdated, diffPath, deprecated, filterId } = filterMetadata;

    if (deprecated) {
      throw new Error(`Filter with id ${filterId} is deprecated and shall not be used`);
    }

    const filterVersion = filterVersionModel.get(filterUpdateOptions.filterId);

    /**
     * We only update the expiration date if it is a forced update to
     * avoid updating the expiration date during patch updates.
     */
    const nextExpires = filterVersion?.expires && !filterUpdateOptions.ignorePatches
      ? filterVersion.expires
      : Number(expires);

    /**
     * We only update the last check time if it is a forced update to
     * avoid updating the last check time during patch updates.
     */
    const nextLastCheckTime = filterVersion?.lastCheckTime && !filterUpdateOptions.ignorePatches
      ? filterVersion.lastCheckTime
      : Date.now();

    filterVersionModel.set(filterUpdateOptions.filterId, {
      version,
      diffPath,
      expires: nextExpires,
      lastUpdateTime: new Date(timeUpdated).getTime(),
      lastCheckTime: nextLastCheckTime,
      lastScheduledCheckTime: filterVersion?.lastScheduledCheckTime || Date.now(),
      /**
       * Unaccessible status may be returned during patch update
       * which is considered as a fatal error.
       * And if it happens, isPatchUpdateFailed is returned as true,
       * and we should set shouldWaitFullUpdate flag to true for the filter so it will be checked later
       */
      shouldWaitFullUpdate: isPatchUpdateFailed,
    });

    /**
     * Note: we should join array of rules here, because they contain
     * preprocessed directives, e.g. including another filter via `!#include`
     * directive.
     */
    await FiltersModel.set(filterUpdateOptions.filterId, filter.join('\n'));
    await RawFiltersModel.set(filterUpdateOptions.filterId, rawFilter);

    return filterMetadata;
  }

  /**
   * Updates metadata for filters and after that loads and enables default
   * common filters.
   *
   * Called on extension installation and reset settings.
   */
  static async initDefaultFilters(enableUntouchedGroups) {
    const filterIds = [
      AntiBannerFiltersId.UltimateAdFilterId,
      AntiBannerFiltersId.UltimatePrivacyFilterId,
      AntiBannerFiltersId.UltimateSecurityFilterId,
      AntiBannerFiltersId.NoCoinFilterId,
    ];

    filterIds.push(...CommonFilterService.getLangSuitableFilters());

    await FiltersService.loadAndEnableFilters(filterIds, true, enableUntouchedGroups);
  }

  // Returns language-specific filters by user locale.
  static getLangSuitableFilters() {
    let filterIds = [];

    let localeFilterIds = metadataModel.getFilterIdsForLanguage(browser.i18n.getUILanguage());
    filterIds = filterIds.concat(localeFilterIds);

    /**
     * Get language-specific filters by navigator languages
     * Get all used languages
     */
    const languages = BrowserUtils.getNavigatorLanguages();

    languages.forEach((language) => {
      localeFilterIds = metadataModel.getFilterIdsForLanguage(language);
      filterIds = filterIds.concat(localeFilterIds);
    });

    return Array.from(new Set(filterIds));
  }

  static isFilterNeedUpdate(filterMetadata) {
    logger.info(`[ext.CommonFilterService.isFilterNeedUpdate]: check if filter ${filterMetadata.filterId} need to update`);

    const filterVersion = filterVersionModel.get(filterMetadata.filterId);

    if (!filterVersion) {
      return true;
    }

    return !BrowserUtils.isGreaterOrEqualsVersion(filterVersion.version, filterMetadata.version);
  }
}
