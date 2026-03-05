import { getErrorMessage } from '@adguard/logger';

import {
  AntiBannerFiltersId,
  AntibannerGroupsId,
  CUSTOM_FILTERS_GROUP_DISPLAY_NUMBER,
} from '../../../common/constants';
import { getMessage } from '../../../common/i18n';
import {
  CommonFilterUtils,
  isCustomFilter,
  isNumber,
} from '../../utils';
import { logger } from '../../../common/logger';
import {
  filterStateModel,
  groupStateModel,
  metadataModel,
  filterVersionModel,
  FilterStateModel,
  GroupStateModel,
  FilterVersionModel,
  FiltersModel,
  RawFiltersModel,
} from '../../models';
import { network } from '../network';

import { UserRulesService } from './userrules';
import { AllowlistService } from './allowlist';
import { CommonFilterService } from './common';
import { CustomFilterService } from './custom';
import { FilterUpdateService } from './update';
import { Categories } from './categories';

export class FiltersService {
  static async init(isInstall) {
    await FiltersService.#initMetadata();

    CustomFilterService.init(network);
    AllowlistService.init();
    await UserRulesService.init(isInstall);

    FiltersService.#loadFilteringStates();

    await FiltersService.#removeObsoleteFilters();
  }

  /**
   * Loads metadata from bundled local assets and reloads linked storages.
   * Called before filters rules are updated or loaded.
   *
   * The metadata cannot be loaded individually because all metadata needs
   * to be updated in order to, for example, update translations or track
   * the removal/addition of filters.
   */
  static async updateMetadata() {
    logger.debug('[ext.FiltersService.updateMetadata]: loading metadata from local assets...');
    await FiltersService.#loadMetadata();

    FiltersService.#loadFilteringStates();

    await FiltersService.#removeObsoleteFilters();
  }

  /**
   * Checks if filter rules exist in browser storage.
   * Called while filters loading.
   */
  static isFilterLoaded(filterId) {
    const filterState = filterStateModel.get(filterId);

    return !!filterState?.loaded;
  }

  static isFilterEnabled(filterId) {
    const filterState = filterStateModel.get(filterId);

    return !!filterState?.enabled;
  }

  static isFilterTrusted(filterId) {
    if (!isCustomFilter(filterId)) {
      return true;
    }

    const metadata = CustomFilterService.getFilterMetadata(filterId);

    return !!metadata?.trusted;
  }

  /**
   * Update metadata from local or remote source and download rules for filters.
   *
   * If loading filters from remote failed, try to load from local resources,
   * but only those filters, for which extension has local copies in resources.

   */
  static async #loadFilters(filterIds, remote) {
    if (filterIds.length === 0) {
      return [];
    }

    if (remote) {
      try {
        /**
         * the arg is 'true' for loading locally stored metadata if remote loading failed.
         * needed not to stop the initialization process after the extension install
         */
        await FiltersService.updateMetadata(true);
      } catch (e) {
        /**
         * No need to throw an error here, because we still can load
         * filters using the old metadata: checking metadata needed to
         * check for updates - without fresh metadata we still can load
         * newest filter, checking it's version will be against the old,
         * local metadata, which is possible outdated.
         */
        logger.error('[ext.FiltersService.loadFilters]: failed to update metadata due to an error:', getErrorMessage(e));
      }
    }

    const tasks = filterIds.map(async (filterId) => {
      try {
        // 'ignorePatches: true' here for loading filters without patches
        const f = await CommonFilterService.loadFilterRulesFromBackend({ filterId, ignorePatches: true }, remote);
        return f.filterId;
      } catch (e) {
        logger.debug(
          `[ext.FiltersService.loadFilters]: filter rules were not loaded from backend for filter: ${filterId}, error:`,
          getErrorMessage(e),
        );

        if (!network.isFilterHasLocalCopy(filterId)) {
          logger.debug(
            `[ext.FiltersService.loadFilters]: filter rules cannot be loaded because there is no local assets for filter ${filterId}.`,
          );

          return null;
        }

        logger.debug(
          `[ext.FiltersService.loadFilters]: trying to load locally stored filter rules for filter: ${filterId}...`,
        );

        /**
         * second arg is 'false' to load locally stored filter rules if remote loading failed
         * e.g. server is not available
         * 'ignorePatches: true' here for loading filters without patches
         */
        try {
          const f = await CommonFilterService.loadFilterRulesFromBackend(
            {
              filterId,
              ignorePatches: true,
            },
            false,
          );
          return f.filterId;
        } catch (e) {
          logger.debug(
            `[ext.FiltersService.loadFilters]: Filter rules were not loaded from local assets for filter: ${filterId}, error: ${e}`,
          );
          return null;
        }
      }
    });

    const promises = await Promise.allSettled(tasks);

    // Handles errors
    promises.forEach((promise) => {
      if (promise.status === 'rejected') {
        logger.error('[ext.FiltersService.loadFilters]: cannot load filter rules due to:', getErrorMessage(promise.reason));
      }
    });

    return promises.map((p) => (p.status === 'fulfilled' ? p.value : null)).filter((p) => isNumber(p));
  }

  /**
   * Loads and enables specified filters. Once the filters are enabled,
   * the untouched groups belonging to those filters will be enabled too.
   *
   * If the method is called in offline mode, some filters may not be loaded
   * because we have local copies only for our built-in filters.
   *
   * @param enableGroups Should enable groups that were not touched by users
   * or by code.
   */
  static async loadAndEnableFilters(filterIds, remote = false, enableGroups = false) {
    /**
     * Ignore already loaded filters
     * Custom filters always have a loaded state, so we don't need additional checks
     */
    const unloadedFiltersIds = filterIds.filter((id) => !FiltersService.isFilterLoaded(id));
    const alreadyLoadedFilterIds = filterIds.filter((id) => FiltersService.isFilterLoaded(id));

    const loadedFilters = await FiltersService.#loadFilters(unloadedFiltersIds, remote);

    // Concatenate filters loaded just now with already loaded filters
    loadedFilters.push(...alreadyLoadedFilterIds);

    filterStateModel.enableFilters(loadedFilters);
    const loadedFiltersToLog = loadedFilters.map((id) => {
      const filterName = FiltersService.getFilterName(id);
      return `id='${id}', name='${filterName}'`;
    });
    logger.info(`[ext.FiltersService.loadAndEnableFilters]: enabled filters: ${loadedFiltersToLog.join('; ')}`);

    if (!remote) {
      /**
       * Update the enabled filters only if loading happens from local resources
       * When loading from remote resources, the filters are already up-to-date,
       * except for the previously loaded filters, which we update below
       */
      await FilterUpdateService.checkForFiltersUpdates(loadedFilters);
    } else if (alreadyLoadedFilterIds.length > 0) {
      /**
       * Update previously loaded filters because they won't be loaded,
       * but still need to be updated to the latest versions
       */
      await FilterUpdateService.checkForFiltersUpdates(alreadyLoadedFilterIds);
    }

    if (enableGroups) {
      // Enable filter groups if they were never enabled or disabled earlier
      FiltersService.#enableGroupsWereNotTouched(loadedFilters);
    }
  }

  /**
   * Called on filter option switch.
   * Note: this method **does not update the engine**.
   */
  static disableFilters(filtersIds) {
    filterStateModel.disableFilters(filtersIds);
    const disabledFiltersToLog = filtersIds.map((id) => {
      const filterName = FiltersService.getFilterName(id);
      return `id='${id}', name='${filterName}'`;
    });
    logger.info(`[ext.FiltersService.disableFilters]: disabled filters: ${disabledFiltersToLog.join('; ')}`);
  }

  /**
   * Needed only in MV3 version because we don't update filters from remote,
   * we use bundled filters from local resources and their converted rulesets.
   */
  static async reloadFiltersFromLocal() {
    try {
      await FiltersService.#loadMetadata();
    } catch (e) {
      logger.error('[ext.FiltersService.reloadFiltersFromLocal]: cannot load local metadata due to:', getErrorMessage(e));
    }

    FiltersService.#loadFilteringStates();

    await FiltersService.#removeObsoleteFilters();

    /**
     * For MV3 we should reload all filters, because they are actually
     * loaded into IDB by TsWebExtension during it's initialization.
     */
    const filterIds = filterStateModel.getAllFilters();

    // Ignore custom filters, user-rules, and allowlist.
    const commonFiltersIds = filterIds.filter((id) => CommonFilterUtils.isCommonFilter(id));

    try {
      // Only re-load filters without changed their states: enabled or disabled.
      const loadedFiltersIds = await FiltersService.#loadFilters(commonFiltersIds, false);

      return loadedFiltersIds;
    } catch (e) {
      logger.error('[ext.FiltersService.reloadFiltersFromLocal]: cannot load local filters due to:', getErrorMessage(e));

      return [];
    }
  }

  /**
   * If method called in offline mode, some filters may not be loaded,
   * because we have local copies only for our built-in filters.
   */
  static async reloadEnabledFilters() {
    const filterIds = FiltersService.getEnabledFilters();

    // Ignore custom filters
    const commonFiltersIds = filterIds.filter((id) => CommonFilterUtils.isCommonFilter(id));

    const loadedFiltersIds = await FiltersService.#loadFilters(commonFiltersIds, true);

    /**
     * Enable only loaded filters. In offline mode, not every filter can be loaded,
     * only built-in filters from local extension's resources.
     */
    filterStateModel.enableFilters(loadedFiltersIds);

    // Reload enabled custom filters that are not loaded yet (e.g. after migration).
    // Custom filters are skipped above because they are downloaded from their
    // subscription URL, not from the backend filter list.
    const customFilterIds = filterIds.filter((id) => isCustomFilter(id));

    const customFilterTasks = customFilterIds
      .filter((id) => !FiltersService.isFilterLoaded(id))
      .map(async (id) => {
        try {
          await CustomFilterService.updateFilter({ filterId: id });
        } catch (e) {
          logger.warn(`[ext.FiltersService.reloadEnabledFilters]: Failed to reload custom filter ${id}:`, getErrorMessage(e));
        }
      });

    await Promise.all(customFilterTasks);
  }

  static getFilterMetadata(filterId) {
    if (isCustomFilter(filterId)) {
      return CustomFilterService.getFilterMetadata(filterId);
    }

    return CommonFilterService.getFilterMetadata(filterId);
  }

  static getFiltersMetadata() {
    return [...CommonFilterService.getFiltersMetadata(), ...CustomFilterService.getFiltersMetadata()];
  }

  static getFilterName(filterId) {
    const UNKNOWN_FILTER_NAME = 'Unknown';

    if (filterId === undefined) {
      return UNKNOWN_FILTER_NAME;
    }

    // Handle special virtual filters with hardcoded names
    if (filterId === AntiBannerFiltersId.UserFilterId) {
      return 'User Filter';
    }

    if (filterId === AntiBannerFiltersId.AllowlistFilterId) {
      return 'Allowlist Filter';
    }

    // Look up name from metadata for regular filters
    const filtersMetadata = FiltersService.getFiltersMetadata();
    const filterMetadata = filtersMetadata?.find((el) => el.filterId === filterId);

    return filterMetadata?.name || UNKNOWN_FILTER_NAME;
  }

  static getEnabledFilters() {
    const enabledFilters = filterStateModel.getEnabledFilters();
    const enabledGroups = groupStateModel.getEnabledGroups();

    return enabledFilters.filter((id) => {
      const filterMetadata = FiltersService.getFilterMetadata(id);

      return enabledGroups.some((groupId) => groupId === filterMetadata?.groupId);
    });
  }

  static getEnabledFiltersWithMetadata() {
    return FiltersService.getEnabledFilters()
      .map((f) => FiltersService.getFilterMetadata(f))
      .filter((f) => f !== undefined);
  }

  static #enableGroupsWereNotTouched(filtersIds) {
    const groupIds = [];

    filtersIds.forEach((filterId) => {
      const filterMetadata = FiltersService.getFilterMetadata(filterId);

      if (!filterMetadata) {
        return;
      }

      const { groupId } = filterMetadata;
      const group = groupStateModel.get(groupId);

      if (!group?.touched) {
        groupIds.push(filterMetadata.groupId);
      }
    });

    if (groupIds.length > 0) {
      groupStateModel.enableGroups(groupIds);
      logger.info(
        `[ext.FiltersService.enableGroupsWereNotTouched]: enabled groups: ${groupIds.map((id) => Categories.getGroupName(id)).join('; ')}`,
      );
    }
  }

  static #addCustomFiltersGroup(metadata) {
    const customFiltersGroup = metadata.groups.find((group) => {
      return group.groupId === AntibannerGroupsId.CustomFiltersGroupId;
    });

    if (!customFiltersGroup) {
      metadata.groups.push({
        groupId: AntibannerGroupsId.CustomFiltersGroupId,
        displayNumber: CUSTOM_FILTERS_GROUP_DISPLAY_NUMBER,
        groupName: getMessage('options_antibanner_custom_group'),
      });
    }
  }

  static async #loadMetadata() {
    const rawMetadata = await network.getLocalFiltersMetadata();

    const validFilters = [];

    rawMetadata.filters.forEach((filter) => {
      if (filter.deprecated) {
        logger.info(
          `[ext.FiltersService.loadMetadata]: Filter with id ${filter.filterId} is deprecated and shall not be used.`,
        );
        /**
         * do not filter out deprecated filter metadata as it may be needed later
         * e.g. during settings import
         */
      }

      validFilters.push(filter);
    });

    const metadata = {
      ...rawMetadata,
      filters: validFilters,
    };

    FiltersService.#addCustomFiltersGroup(metadata);
    metadataModel.setData(metadata);
  }

  static async #initMetadata() {
    const storageData = metadataModel.read();

    if (typeof storageData !== 'string') {
      await FiltersService.#loadMetadata();
      return;
    }

    try {
      const metadata = JSON.parse(storageData);
      metadataModel.setCache(metadata);
    } catch (e) {
      logger.warn(
        `[ext.FiltersService.initMetadata]: cannot parse data from "${metadataModel.key}" storage, load from local assets. Origin error:`,
        getErrorMessage(e),
      );
      await FiltersService.#loadMetadata();
    }
  }

  static #loadFilteringStates() {
    const metadata = metadataModel.getData();

    FiltersService.#initFilterStateModel(metadata);
    FiltersService.#initGroupStateModel(metadata);
    FiltersService.#initFilterVersionModel(metadata);
  }

  static #initFilterStateModel(metadata) {
    const storageData = filterStateModel.read();

    if (typeof storageData !== 'string') {
      filterStateModel.setData(FilterStateModel.applyMetadata({}, metadata));
      return;
    }

    try {
      let data = JSON.parse(storageData);
      data = FilterStateModel.applyMetadata(data, metadata);

      filterStateModel.setData(data);
    } catch (e) {
      logger.warn(
        `[ext.FiltersService.initFilterStateModel]: cannot parse data from "${filterStateModel.key}" storage, load default states. Origin error:`,
        getErrorMessage(e),
      );
      filterStateModel.setData(FilterStateModel.applyMetadata({}, metadata));
    }
  }

  static #initGroupStateModel(metadata) {
    const storageData = groupStateModel.read();

    if (typeof storageData !== 'string') {
      groupStateModel.setData(GroupStateModel.applyMetadata({}, metadata));
      return;
    }

    try {
      let data = JSON.parse(storageData);
      data = GroupStateModel.applyMetadata(data, metadata);

      groupStateModel.setData(data);
    } catch (e) {
      logger.warn(
        `[ext.FiltersService.initGroupStateModel]: cannot parse data from "${groupStateModel.key}" storage, set default states. Origin error:`,
        getErrorMessage(e),
      );
      groupStateModel.setData(GroupStateModel.applyMetadata({}, metadata));
    }
  }

  static #initFilterVersionModel(metadata) {
    const storageData = filterVersionModel.read();

    if (typeof storageData !== 'string') {
      filterVersionModel.setData(FilterVersionModel.applyMetadata({}, metadata));
      return;
    }

    try {
      let data = JSON.parse(storageData);
      data = FilterVersionModel.applyMetadata(data, metadata);

      filterVersionModel.setData(data);
    } catch (e) {
      logger.warn(
        `[ext.FiltersService.initFilterVersionModel]: cannot parse data from "${filterVersionModel.key}" storage, set default states. Origin error:`,
        getErrorMessage(e),
      );
      filterVersionModel.setData(FilterVersionModel.applyMetadata({}, metadata));
    }
  }

  static async #removeFilter(filterId) {
    filterVersionModel.delete(filterId);
    filterStateModel.delete(filterId);
    await FiltersModel.remove(filterId);
    await RawFiltersModel.remove(filterId);
  }

  /**
   * Obsolete filters are those that are not present in the metadata
   * but are installed in the storage.
   */
  static async #removeObsoleteFilters() {
    const installedFiltersIds = filterStateModel.getInstalledFilters();
    const metadataFiltersIds = FiltersService.getFiltersMetadata().map(({ filterId }) => filterId);

    const tasks = installedFiltersIds
      .filter((id) => !metadataFiltersIds.includes(id))
      .map(async (id) => {
        try {
          await FiltersService.#removeFilter(id);
          logger.info(
            `[ext.FiltersService.removeObsoleteFilters]: Filter with id ${id} removed from the storage since it is obsolete`,
          );
        } catch (e) {
          logger.error(
            `[ext.FiltersService.removeObsoleteFilters]: Cannot remove obsoleted filter ${id} from storage due to: `,
            e,
          );
        }
      });

    await Promise.allSettled(tasks);
  }

  static getInstalledAndEnabledFiltersIds() {
    // Collects filters ids and their states and filters groups ids.
    const filtersStates = filterStateModel.getData();
    const enabledGroupsIds = groupStateModel.getEnabledGroups();
    const allFiltersIds = Object.keys(filtersStates).map((id) => Number(id));

    /**
     * Selects to check only installed and enabled filters and only those
     * that have their group enabled.
     */
    return allFiltersIds.filter((id) => {
      const filterState = filtersStates[id];
      if (!filterState) {
        return false;
      }

      const { installed, enabled } = filterState;
      if (!installed || !enabled) {
        return false;
      }

      const groupMetadata = Categories.getGroupByFilterId(id);
      if (!groupMetadata) {
        return false;
      }

      const groupEnabled = enabledGroupsIds.includes(groupMetadata.groupId);
      return groupEnabled;
    });
  }
}
