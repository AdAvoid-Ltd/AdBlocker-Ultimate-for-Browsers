import { getErrorMessage } from '@adguard/logger';

import { filterVersionModel, settingsModel } from '../../../models';
import { SettingOption } from '../../../storage-keys';
import { DEFAULT_FILTERS_UPDATE_PERIOD } from '../../../services/settings/defaults';
import { logger } from '../../../../common/logger';
import { FiltersUpdateTime } from '../../../../common/constants';
import { engine } from '../../../engine';
import { CommonFilterUtils, isCustomFilter } from '../../../utils';
import { CommonFilterService } from '../common';
import { FiltersService } from '../main';
import { CustomFilterService } from '../custom';
import { DesktopAppService } from '../../desktop-app';

export class FilterUpdateService {
  static RECENTLY_CHECKED_FILTER_TIMEOUT_MS = 1000 * 60 * 5;

  /**
   * Filters the provided filter list with FilterUpdateService.selectFiltersIdsToUpdate,
   * then gets fresh metadata from the remote server for all filters (it
   * cannot be updated selectively), and, after updating, refreshes
   * lastCheckTime for each of those selected for checking filters.
   */
  static async checkForFiltersUpdates(filterIds) {
    const filtersToCheck = FilterUpdateService.selectFiltersIdsToUpdate(filterIds);

    // We update filters without patches when we enable groups.
    const filterDetails = filtersToCheck.map((id) => ({ filterId: id, ignorePatches: true }));

    const updatedFilters = await FilterUpdateService.updateFilters(filterDetails);
    filterVersionModel.refreshLastCheckTime(filterDetails);

    return updatedFilters;
  }

  /**
   * If filtering is disabled or there is no selected filter update period in
   * the settings and if it is not a forced update, it returns an empty array.
   * Otherwise it checks all installed and enabled filters and only those that
   * have their group enabled for available updates: if it is a forced
   * update - it checks for updates for those (described above) filters,
   * otherwise it additional checks those filters for possible expose by
   * comparing 'lastTimeCheck' of each filter with updatePeriod from settings
   * or by checking 'expires' field.
   *
   * After that gets fresh metadata from the remote server for all filters (it
   * cannot be updated selectively).
   *
   * 'Installed filters' are filters whose rules are loaded in
   * browser.storage.local.
   *
   * Called when user manually run update:
   * - on request from context menu;
   * - on request from popup menu;
   *
   * Or from the update scheduler see FilterUpdateController.
   */
  static async autoUpdateFilters(forceUpdate = false) {
    const startUpdateLogMessage = forceUpdate ? 'Update filters forced by user.' : 'Update filters by scheduler.';
    logger.info(`[ext.FilterUpdateService.autoUpdateFilters]: ${startUpdateLogMessage}`);

    // Skip filter updates when desktop app is active (unless forced)
    const isDesktopAppActive = DesktopAppService.isActive();
    if (isDesktopAppActive && !forceUpdate) {
      logger.info('[ext.FilterUpdateService.autoUpdateFilters]: skipped - desktop app is active');
      return [];
    }

    const updatePeriod = settingsModel.get(SettingOption.FiltersUpdatePeriod);
    // Auto update disabled.
    if (updatePeriod === FiltersUpdateTime.Disabled && !forceUpdate) {
      return [];
    }

    /**
     * Selects to check only installed and enabled filters and only those
     * that have their group enabled.
     */
    const installedAndEnabledFilters = FiltersService.getInstalledAndEnabledFiltersIds();

    // If it is a force check - updates all installed and enabled filters.
    let filterUpdateDetailsToUpdate = installedAndEnabledFilters.map((id) => ({
      filterId: id,
      ignorePatches: forceUpdate,
    }));

    // If not a force check - updates only outdated filters.
    if (!forceUpdate) {
      // Select filters with diff paths and mark them for no force update
      const filtersToPatchUpdate = FilterUpdateService.selectFiltersToPatchUpdate(filterUpdateDetailsToUpdate).map(
        (filterData) => ({ ...filterData, ignorePatches: false }),
      );

      /**
       * Select filters for a forced update and mark them accordingly.
       *
       * Filters with diff path must be also full updated from time to time.
       * Full update period for such full (forced) update is determined by FiltersUpdateTime,
       * which is set in extension settings.
       */
      const filtersToFullUpdate = FilterUpdateService.selectFiltersToFullUpdate(
        filterUpdateDetailsToUpdate,
        updatePeriod,
      ).map((filter) => ({ ...filter, ignorePatches: true }));

      // Combine both arrays
      const combinedFilters = [...filtersToPatchUpdate, ...filtersToFullUpdate];

      const uniqueFiltersMap = new Map();

      combinedFilters.forEach((filter) => {
        if (!uniqueFiltersMap.has(filter.filterId) || filter.ignorePatches) {
          uniqueFiltersMap.set(filter.filterId, filter);
        }
      });

      filterUpdateDetailsToUpdate = Array.from(uniqueFiltersMap.values());
    }

    const updatedFilters = await FilterUpdateService.updateFilters(filterUpdateDetailsToUpdate);

    /**
     * Updates last check time of all installed and enabled filters,
     * which where updated with force
     */
    filterVersionModel.refreshLastCheckTime(filterUpdateDetailsToUpdate);

    // If some filters were updated, then it is time to update the engine.
    if (updatedFilters.length > 0) {
      engine.debounceUpdate();
    }

    return updatedFilters;
  }

  /**
   * Updates the metadata of all filters and updates the filter contents from
   * the provided list of identifiers.
   */
  static async updateFilters(filterUpdateOptionsList) {
    /**
     * Reload common filters metadata from backend for correct
     * version matching on update check.
     * We do not update metadata on each check if there are no filters or only custom filters.
     */
    const shouldLoadMetadata = filterUpdateOptionsList.some((filterUpdateOptions) => {
      return filterUpdateOptions.ignorePatches && CommonFilterUtils.isCommonFilter(filterUpdateOptions.filterId);
    });

    if (shouldLoadMetadata) {
      try {
        await FiltersService.updateMetadata();
      } catch (e) {
        /**
         * No need to throw an error here, because we still can load
         * filters using the old metadata: checking metadata needed to
         * check for updates - without fresh metadata we still can load
         * newest filter, checking it's version will be against the old,
         * local metadata, which is possible outdated.
         */
        logger.error(
          '[ext.FilterUpdateService.updateFilters]: failed to update metadata due to an error:',
          getErrorMessage(e),
        );
      }
    }

    const updatedFiltersMetadata = [];

    const updateTasks = filterUpdateOptionsList.map(async (filterData) => {
      let filterMetadata = null;

      try {
        if (isCustomFilter(filterData.filterId)) {
          filterMetadata = await CustomFilterService.updateFilter(filterData);
        } else {
          filterMetadata = await CommonFilterService.updateFilter(filterData);
        }
      } catch (e) {
        logger.error(
          `[ext.FilterUpdateService.updateFilters]: failed to update filter id#${filterData.filterId} due to an error:`,
          getErrorMessage(e),
        );

        return;
      }

      if (filterMetadata) {
        updatedFiltersMetadata.push(filterMetadata);
      }
    });

    await Promise.allSettled(updateTasks);

    return updatedFiltersMetadata;
  }

  /**
   * Selects from the provided list of filters only those that have not been
   * recently updated (added,
   * enabled or updated by the scheduler) and those that are custom filters.
   */
  static selectFiltersIdsToUpdate(filterIds) {
    const filterVersions = filterVersionModel.getData();

    return filterIds.filter((id) => {
      // Always check for updates for custom filters
      const isCustom = isCustomFilter(Number(id));

      // Select only not recently checked filters
      const filterVersion = filterVersions[Number(id)];
      const outdated = filterVersion !== undefined
        ? Date.now() - filterVersion.lastCheckTime > FilterUpdateService.RECENTLY_CHECKED_FILTER_TIMEOUT_MS
        : true;

      return isCustom || outdated;
    });
  }

  /**
   * Selects filters to update with patches. Such filters should
   * 1. Have `diffPath`
   * 2. Not have `shouldWaitFullUpdate` flag which means that patch update failed previously.
   */
  static selectFiltersToPatchUpdate(filterUpdateOptionsList) {
    // eslint-disable-next-line no-unused-vars
    const filterVersions = filterVersionModel.getData();

    return [];

    // Original logic (restore when patch support is added):
    // return filterUpdateOptionsList.filter((filterData) => {
    //   const filterVersion = filterVersions[filterData.filterId];
    //   return filterVersion?.diffPath && !filterVersion?.shouldWaitFullUpdate;
    // });
  }

  /**
   * Selects outdated filters from the provided filter list for a full update.
   * The selecting is based on the provided filter update period from the settings.
   */
  static selectFiltersToFullUpdate(filterUpdateOptionsList, updatePeriod) {
    const filterVersions = filterVersionModel.getData();

    return filterUpdateOptionsList.filter((data) => {
      const filterVersion = filterVersions[data.filterId];

      if (!filterVersion) {
        return true;
      }

      const { lastCheckTime, expires } = filterVersion;

      // By default, checks the "expires" field for each filter.
      if (updatePeriod === DEFAULT_FILTERS_UPDATE_PERIOD) {
        /**
         * If it is time to check the update, adds it to the array.
         * IMPORTANT: "expires" in filter is specified in SECONDS.
         */
        return lastCheckTime + expires * 1000 <= Date.now();
      }

      /**
       * Check, if the renewal period of each filter has passed.
       * If it is time to check the renewal, add to the array.
       */
      return lastCheckTime + updatePeriod <= Date.now();
    });
  }
}
