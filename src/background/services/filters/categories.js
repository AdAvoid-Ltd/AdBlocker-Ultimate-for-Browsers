import { UserAgent } from '../../../common/user-agent';
import { RECOMMENDED_TAG_ID } from '../../../common/constants';
import { CommonFilterUtils } from '../../utils';
import {
  metadataModel,
  filterStateModel,
  groupStateModel,
  filterVersionModel,
  customFilterMetadataModel,
} from '../../models';
import { logger } from '../../../common/logger';

import { CommonFilterService } from './common';
import { FilterUpdateService } from './update';
import { FiltersService } from './main';

export class Categories {
  static PURPOSE_MOBILE_TAG_ID = 19;

  static getCategories() {
    const groups = Categories.getGroups();
    const filters = Categories.getFilters();

    const categories = groups.map((group) => ({
      ...group,
      filters: Categories.selectFiltersByGroupId(group.groupId, filters),
    }));

    return {
      filters,
      categories,
    };
  }

  static getGroupState(groupId) {
    return groupStateModel.get(groupId);
  }

  /**
   * Enables specified group of filters and check updates for enabled filters.
   *
   * On first group activation we provide recommended filters,
   * that will be loaded end enabled before update checking.
   */
  static async enableGroup(groupId, update, recommendedFiltersIds = []) {
    if (recommendedFiltersIds.length > 0) {
      await FiltersService.loadAndEnableFilters(recommendedFiltersIds, update);
    }

    if (update) {
      // Always checks updates for enabled filters of the group.
      const enabledFiltersIds = Categories.getEnabledFiltersIdsByGroupId(groupId);
      await FilterUpdateService.checkForFiltersUpdates(enabledFiltersIds);
    }

    groupStateModel.enableGroups([groupId]);
    logger.info(
      `[ext.Categories.enableGroup]: enabled group: id='${groupId}', name='${Categories.getGroupName(groupId)}'`,
    );
  }

  static disableGroup(groupId) {
    groupStateModel.disableGroups([groupId]);
    logger.info(
      `[ext.Categories.disableGroup]: disabled group: id='${groupId}', name='${Categories.getGroupName(groupId)}'`,
    );
  }

  static getGroupByFilterId(filterId) {
    const filter = metadataModel.getFilter(filterId);

    customFilterMetadataModel.getById(filterId);

    if (!filter) {
      return;
    }

    return metadataModel.getGroup(filter.groupId);
  }

  static isRecommendedFilter(filter) {
    return filter.tags.includes(RECOMMENDED_TAG_ID);
  }

  static isMobileFilter(filter) {
    return filter.tags.includes(Categories.PURPOSE_MOBILE_TAG_ID);
  }

  static isFilterMatchPlatform(filter) {
    if (Categories.isMobileFilter(filter)) {
      return !!UserAgent.isAndroid;
    }
    return true;
  }

  /**
   * Returns recommended filters, which meet next requirements:
   * 1. Filter has recommended tag;
   * 2. If filter has language tag, tag should match with user locale;
   * 3. Filter should correspond to platform mobile or desktop.
   */
  static getRecommendedFilterIdsByGroupId(groupId) {
    const { categories } = Categories.getCategories();

    const langSuitableFilters = CommonFilterService.getLangSuitableFilters();

    const group = categories.find((category) => category.groupId === groupId);

    if (!group?.filters) {
      return [];
    }

    const { filters } = group;

    const result = [];

    filters.forEach((filter) => {
      if (Categories.isRecommendedFilter(filter) && Categories.isFilterMatchPlatform(filter)) {
        /**
         * get ids intersection to enable recommended filters matching the lang tag
         * only if filter has language
         */
        if (filter.languages && filter.languages.length > 0) {
          if (langSuitableFilters.includes(filter.filterId)) {
            result.push(filter.filterId);
          }
        } else {
          result.push(filter.filterId);
        }
      }
    });

    return result;
  }

  static getTagsDetails(tagsIds) {
    const tagsMetadata = metadataModel.getTags();

    const tagsDetails = [];

    for (let i = 0; i < tagsIds.length; i += 1) {
      const tagId = tagsIds[i];

      const tagDetails = tagsMetadata.find((tag) => tag.tagId === tagId);

      if (tagDetails) {
        if (tagDetails.keyword.startsWith('reference:')) {
          // Hide 'reference:' tags
          continue;
        }

        if (!tagDetails.keyword.startsWith('lang:')) {
          // Hide prefixes except of 'lang:'
          tagDetails.keyword = tagDetails.keyword.substring(tagDetails.keyword.indexOf(':') + 1);
        }

        tagsDetails.push(tagDetails);
      }
    }

    return tagsDetails;
  }

  static getFilters() {
    const filtersMetadata = FiltersService.getFiltersMetadata();

    const result = [];

    filtersMetadata.forEach((filterMetadata) => {
      // skip deprecated filters
      if (CommonFilterUtils.isRegularFilterMetadata(filterMetadata) && filterMetadata.deprecated) {
        return;
      }

      const { filterId, tags, version, expires, timeUpdated, diffPath } = filterMetadata;

      const filterState = filterStateModel.get(filterId);
      if (!filterState) {
        logger.error(`[ext.Categories.getFilters]: cannot find filter ${filterId} state data`);
        return;
      }

      let filterVersion = filterVersionModel.get(filterId);
      if (!filterVersion) {
        logger.info(
          `[ext.Categories.getFilters]: Cannot find filter ${filterId} version data, restoring it from metadata`,
        );
        const dayAgoMs = Date.now() - 1000 * 60 * 60 * 24; // 24 hours
        filterVersion = {
          version,
          expires,
          lastUpdateTime: new Date(timeUpdated).getTime(),
          // this is set in the past to force update check
          lastCheckTime: dayAgoMs,
          lastScheduledCheckTime: dayAgoMs,
          diffPath,
        };
        filterVersionModel.set(filterId, filterVersion);
      }

      const tagsDetails = Categories.getTagsDetails(tags);

      result.push({
        ...filterMetadata,
        ...filterState,
        ...filterVersion,
        tagsDetails,
      });
    });

    return result;
  }

  static getGroups() {
    const groupsMetadata = metadataModel.getGroups();

    const result = [];

    groupsMetadata.forEach((groupMetadata) => {
      const groupState = groupStateModel.get(groupMetadata.groupId);

      if (!groupState) {
        logger.error(`[ext.Categories.getGroups]: cannot find group ${groupMetadata.groupId} state data`);
        return;
      }

      result.push({
        ...groupMetadata,
        ...groupState,
      });
    });

    return result;
  }

  static selectFiltersByGroupId(groupId, filters) {
    return filters.filter((filter) => filter.groupId === groupId);
  }

  static getEnabledFiltersIdsByGroupId(groupId) {
    const filtersMetadata = FiltersService.getFiltersMetadata();

    return filtersMetadata
      .filter((filter) => filter.groupId === groupId)
      .filter(({ filterId }) => {
        const filterState = filterStateModel.get(filterId);

        return filterState?.enabled;
      })
      .map(({ filterId }) => filterId);
  }

  static getGroupName(groupId) {
    // Group name should always be defined, using 'Unknown' as a fallback just in case
    const UNKNOWN_GROUP_NAME = 'Unknown';

    const groupsMetadata = metadataModel.getGroups();
    const group = groupsMetadata.find((group) => group.groupId === groupId);

    return group ? group.groupName : UNKNOWN_GROUP_NAME;
  }
}
