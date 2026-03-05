import MD5 from 'crypto-js/md5';

import { getErrorMessage } from '@adguard/logger';

import { BrowserUtils, isCustomFilter } from '../../utils';
import { AntibannerGroupsId, CUSTOM_FILTERS_START_ID } from '../../../common/constants';
import { logger } from '../../../common/logger';
import {
  customFilterMetadataModel,
  filterStateModel,
  groupStateModel,
  filterVersionModel,
  RawFiltersModel,
  FiltersModel,
} from '../../models';

import { FilterParser } from './parser';
import { CustomFilterLoader } from './custom/loader';

/**
 * API for managing custom filters data.
 *
 * Custom filter subscription is divided into several stages:
 * - User requests custom filter data by subscription url;
 * - App downloads filter data and check, if filter was loaded before;
 * - App shows 'Add custom filter' modal window with parsed data;
 * - If user confirms subscription, filter data will be saved in app storages.
 *
 * This class also provided methods for updating and removing custom filters.
 *
 * Custom metadata is stored in customFilterMetadataModel.
 * Filters states is stored in filterStateModel.
 * Filters versions is stored in filterVersionModel.
 * Filters rules is stored in FiltersModel.
 * Raw filter rules (before applying directives) is saved in FiltersModel.
 */
export class CustomFilterService {
  static #network;

  /**
   * Reads stringified CustomFilterMetadata array from persisted storage
   * and saves it in cache.
   * If data is not exist, set empty array.
   *
   * param network - Network instance, needed for correct DI and exclude
   * circular dependencies.
   */
  static init(network) {
    CustomFilterService.#network = network;

    try {
      const storageData = customFilterMetadataModel.read();
      if (typeof storageData === 'string') {
        const data = JSON.parse(storageData);
        customFilterMetadataModel.setCache(data);
      } else {
        customFilterMetadataModel.setData([]);
      }
    } catch (e) {
      logger.warn(
        '[ext.CustomFilterService.init]: cannot parse custom filter metadata from persisted storage, reset to default. Origin error:',
        getErrorMessage(e),
      );

      customFilterMetadataModel.setData([]);
    }
  }

  /**
   * Returns Custom filter info for modal window.
   * Checks if custom filter with passed url is exist.
   * If url is new, downloads filter data from remote source, parse it and create new {@link CustomFilterInfo}.
   */
  static async getFilterInfo(url, title) {
    // Check if filter from this url was added before
    if (customFilterMetadataModel.getByUrl(url)) {
      return { errorAlreadyExists: true };
    }

    const rules = await CustomFilterService.#network.downloadFilterRulesBySubscriptionUrl(url);

    if (!rules) {
      return null;
    }

    const parsedData = FilterParser.parseFilterDataFromHeader(rules.filter);

    const filter = {
      ...parsedData,
      name: parsedData.name ? parsedData.name : title,
      timeUpdated: parsedData.timeUpdated ? parsedData.timeUpdated : new Date().toISOString(),
      customUrl: url,
      rulesCount: rules.filter.filter((rule) => rule.trim().indexOf('!') !== 0).length,
    };

    return { filter };
  }

  /**
   * Creates and save new custom filter data in linked storages from passed CustomFilterDTO.
   *
   * Downloads filter data by CustomFilterDTO and parse it.
   * Create new CustomFilterMetadata record and save it in customFilterMetadataModel,
   * Based on parsed data.
   * Creates new FilterStateData and save it in filterStateModel.
   * Creates new FilterVersionData and save it in filterVersionModel.
   * Filters rules are saved in FiltersModel.
   * Raw filter rules (before applying directives) are saved in RawFiltersModel.
   */
  static async createFilter(filterData) {
    const { customUrl, trusted, enabled } = filterData;

    // download and parse custom filter data
    const { rawRules, rules, parsed, checksum } = await CustomFilterService.#getRemoteFilterData(customUrl);

    // create new filter id
    const filterId = CustomFilterService.#genFilterId();

    logger.info(`[ext.CustomFilterService.createFilter]: create new custom filter with id ${filterId}`);

    const name = filterData.title ? filterData.title : parsed.name;

    const { description, homepage, expires, timeUpdated, version, diffPath } = parsed;

    const filterMetadata = {
      filterId,
      displayNumber: 0,
      groupId: AntibannerGroupsId.CustomFiltersGroupId,
      name,
      description,
      homepage,
      version,
      checksum,
      tags: [0],
      customUrl,
      trusted,
      expires: Number(expires),
      timeUpdated: new Date(timeUpdated).getTime(),
    };

    customFilterMetadataModel.set(filterMetadata);

    filterVersionModel.set(filterId, {
      version,
      diffPath,
      expires: filterMetadata.expires,
      lastUpdateTime: filterMetadata.timeUpdated,
      lastCheckTime: Date.now(),
      lastScheduledCheckTime: Date.now(),
    });

    filterStateModel.set(filterId, {
      loaded: true,
      installed: true,
      enabled,
    });

    /**
     * Note: we should join array of rules here, because they contain
     * preprocessed directives, e.g. including another filter via `!#include`
     * directive.
     */
    await FiltersModel.set(filterId, rules.join('\n'));
    await RawFiltersModel.set(filterId, rawRules);

    const group = groupStateModel.get(filterMetadata.groupId);

    // If group has never been enabled - enables it.
    if (group && !group.touched) {
      groupStateModel.enableGroups([filterMetadata.groupId]);
    }

    return filterMetadata;
  }

  /**
   * Updates custom filter data by id.
   *
   * Returns subscription url from customFilterMetadataModel.
   * Downloads data from remote source.
   * Checks, if new filter version available.
   * If filter need for update, save new filter data in storages.
   */
  static async updateFilter(filterUpdateOptions) {
    logger.info(`[ext.CustomFilterService.updateFilter]: update custom filter ${filterUpdateOptions.filterId} ...`);

    const filterMetadata = customFilterMetadataModel.getById(filterUpdateOptions.filterId);

    if (!filterMetadata) {
      logger.error(
        `[ext.CustomFilterService.updateFilter]: cannot find custom filter ${filterUpdateOptions.filterId} metadata`,
      );
      return null;
    }

    const { customUrl } = filterMetadata;

    const rawFilter = await RawFiltersModel.get(filterUpdateOptions.filterId);
    const filterRemoteData = await CustomFilterService.#getRemoteFilterData(
      customUrl,
      rawFilter,
      filterUpdateOptions.ignorePatches,
    );

    if (!CustomFilterService.#isFilterNeedUpdate(filterMetadata, filterRemoteData)) {
      logger.info(
        `[ext.CustomFilterService.updateFilter]: custom filter ${filterUpdateOptions.filterId} is already updated`,
      );
      return null;
    }

    logger.info(
      `[ext.CustomFilterService.updateFilter]: successfully update custom filter ${filterUpdateOptions.filterId}`,
    );
    return CustomFilterService.#updateFilterData(filterMetadata, filterRemoteData);
  }

  /**
   * Removes custom filter data from storages,
   * and returns boolean value whether the filter was enabled.
   *
   * Note: this method **does not update the engine**.
   */
  static async removeFilter(filterId) {
    logger.info(`[ext.CustomFilterService.removeFilter]: removing a custom filter ${filterId}...`);

    customFilterMetadataModel.remove(filterId);
    filterVersionModel.delete(filterId);

    const filterState = filterStateModel.get(filterId);

    filterStateModel.delete(filterId);

    await FiltersModel.remove(filterId);
    await RawFiltersModel.remove(filterId);

    logger.info('[ext.CustomFilterService.removeFilter]: custom filter removed');

    return filterState?.enabled ?? false;
  }

  static isCustomFilterMetadata(filter) {
    return isCustomFilter(filter.filterId);
  }

  static getFilterMetadata(filterId) {
    return customFilterMetadataModel.getById(filterId);
  }

  static getFiltersMetadata() {
    return customFilterMetadataModel.getData();
  }

  static async #updateFilterData(filterMetadata, { rules, rawRules, checksum, parsed }) {
    const { filterId } = filterMetadata;

    const { version, expires, timeUpdated, diffPath } = parsed;

    filterVersionModel.set(filterId, {
      version,
      diffPath,
      expires: Number(expires),
      lastUpdateTime: new Date(timeUpdated).getTime(),
      lastCheckTime: Date.now(),
      lastScheduledCheckTime: Date.now(),
    });

    const newFilterMetadata = {
      ...filterMetadata,
      version,
      checksum,
    };

    customFilterMetadataModel.set(newFilterMetadata);

    /**
     * Note: we should join array of rules here, because they contain
     * preprocessed directives, e.g. including another filter via `!#include`
     * directive.
     */
    await FiltersModel.set(filterId, rules.join('\n'));
    await RawFiltersModel.set(filterId, rawRules);

    return newFilterMetadata;
  }

  static #genFilterId() {
    let max = 0;
    customFilterMetadataModel.getData().forEach((f) => {
      if (f.filterId > max) {
        max = f.filterId;
      }
    });

    return max >= CUSTOM_FILTERS_START_ID ? max + 1 : CUSTOM_FILTERS_START_ID;
  }

  static #getChecksum(rules) {
    const rulesText = rules.join('\n');
    return MD5(rulesText).toString();
  }

  static #isFilterNeedUpdate(filter, { checksum, parsed }) {
    logger.info(`[ext.CustomFilterService.isFilterNeedUpdate]: check if custom filter ${filter.filterId} need to update`);

    /**
     * If filter has version, we simply compare it with the new one.
     * Sometimes version field is not available (e.g. for some custom filters),
     * in this case, we should check only checksum.
     * If checksum is also not available, we should update filter anyway.
     */
    if (
      // If version is not available or empty, we don't need to check it deeply
      typeof filter.version === 'string'
      && filter.version.length > 0
      && BrowserUtils.isSemver(filter.version)
      && BrowserUtils.isSemver(parsed.version)
    ) {
      return !BrowserUtils.isGreaterOrEqualsVersion(filter.version, parsed.version);
    }

    if (!filter.checksum) {
      return true;
    }

    return checksum !== filter.checksum;
  }

  static async #getRemoteFilterData(url, rawFilter, force) {
    logger.info(`[ext.CustomFilterService.getRemoteFilterData]: get custom filter data from ${url}`);

    const downloadResult = await CustomFilterLoader.downloadRulesWithTimeout(url, rawFilter, force);

    const parsed = FilterParser.parseFilterDataFromHeader(downloadResult.filter);

    const { version } = parsed;

    const checksum = !version || !BrowserUtils.isSemver(version)
      ? CustomFilterService.#getChecksum(downloadResult.filter)
      : null;

    return {
      rawRules: downloadResult.rawFilter,
      rules: downloadResult.filter,
      parsed,
      checksum,
    };
  }
}
