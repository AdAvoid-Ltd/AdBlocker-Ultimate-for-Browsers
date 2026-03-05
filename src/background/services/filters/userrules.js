import {
  FilterListPreprocessor,
  getRuleSourceIndex,
  getRuleSourceText,
} from '@adguard/tsurlfilter';
import { getErrorMessage } from '@adguard/logger';

import { logger } from '../../../common/logger';
import {
  AntiBannerFiltersId,
  NEWLINE_CHAR_REGEX,
  NEWLINE_CHAR_UNIX,
  EventType,
} from '../../../common/constants';
import { eventBus } from '../../event-bus';
import { FiltersModel, FiltersStoragesAdapter } from '../../models';

export class UserRulesService {
  /**
   * Parses data from user rules list.
   * If it's undefined or if it's an initialization after installation - sets
   * empty user rules list.
   */
  static async init(isInstall) {
    try {
      // Check if user filter is present in the storage to avoid errors.
      if (!(await FiltersModel.has(AntiBannerFiltersId.UserFilterId))) {
        await FiltersModel.set(
          AntiBannerFiltersId.UserFilterId,
          FilterListPreprocessor.createEmptyPreprocessedFilterList(),
        );
      } else {
        await FiltersModel.get(AntiBannerFiltersId.UserFilterId);
      }
    } catch (e) {
      if (!isInstall) {
        logger.warn(
          '[ext.UserRulesService.init]: cannot parse user filter list from persisted storage, reset to default. Origin error:',
          getErrorMessage(e),
        );
      }
      await FiltersModel.set(
        AntiBannerFiltersId.UserFilterId,
        FilterListPreprocessor.createEmptyPreprocessedFilterList(),
      );
    }
  }

  static async getUserRules() {
    const data = await FiltersModel.get(AntiBannerFiltersId.UserFilterId);

    if (!data) {
      return FilterListPreprocessor.createEmptyPreprocessedFilterList();
    }

    return data;
  }

  /**
   * When we save user rules, the rules may be modified (e.g converted),
   * but when user opens the editor, we need to show their original rules.
   * User rules is a bit special because for that list we store the whole original filter list.
   */
  static async getOriginalUserRules() {
    return (await FiltersStoragesAdapter.getOriginalFilterList(AntiBannerFiltersId.UserFilterId)) ?? '';
  }

  static async addUserRule(rule) {
    let userRulesFilter = await UserRulesService.getOriginalUserRules();

    if (!userRulesFilter.endsWith(NEWLINE_CHAR_UNIX)) {
      userRulesFilter += NEWLINE_CHAR_UNIX;
    }

    userRulesFilter += rule;

    await UserRulesService.setUserRules(userRulesFilter);
  }

  static async removeUserRule(rule) {
    const userRulesTest = await UserRulesService.getOriginalUserRules();

    const userRulesToSave = userRulesTest
      .split(NEWLINE_CHAR_REGEX)
      .filter((r) => r !== rule)
      .join(NEWLINE_CHAR_UNIX);

    await UserRulesService.setUserRules(userRulesToSave);
  }

  static async removeUserRuleByIndex(index) {
    const [rawFilterList, sourceMap, conversionMap] = await Promise.all([
      FiltersStoragesAdapter.getRawFilterList(AntiBannerFiltersId.UserFilterId),
      FiltersStoragesAdapter.getSourceMap(AntiBannerFiltersId.UserFilterId),
      FiltersStoragesAdapter.getConversionMap(AntiBannerFiltersId.UserFilterId),
    ]);

    if (!sourceMap || !conversionMap || !rawFilterList) {
      return false;
    }

    const lineStartIndex = getRuleSourceIndex(index, sourceMap);

    const ruleText = conversionMap[lineStartIndex] ?? getRuleSourceText(index, rawFilterList);

    if (!ruleText) {
      return false;
    }

    await UserRulesService.removeUserRule(ruleText);

    return true;
  }

  static async setUserRules(rulesText) {
    await FiltersModel.set(AntiBannerFiltersId.UserFilterId, rulesText);

    eventBus.emit(EventType.UserFilterUpdated);
  }
}
