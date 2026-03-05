import browser from 'webextension-polyfill';

import {
  TooManyRegexpRulesError,
  TooManyUnsafeRulesError,
  TooManyRulesError,
  RULESET_NAME_PREFIX,
} from '@adguard/tswebextension/mv3';
import { getErrorMessage } from '@adguard/logger';

import { MessageType } from '../../../common/messages';
import { Categories, FiltersService } from '../../services';
import { filterStateModel, rulesLimitsModel } from '../../models';
import {
  CommonFilterUtils,
  isCustomFilter,
  arraysAreEqual,
} from '../../utils';
import { logger } from '../../../common/logger';
/**
 * Note: due to circular dependencies, import message-handler.ts after all
 * other imports.
 */
import { messageHandler } from '../../message-handler';
import { DesktopAppService } from '../../services/desktop-app';

const {
  MAX_NUMBER_OF_DYNAMIC_RULES,
  MAX_NUMBER_OF_REGEX_RULES,
  MAX_NUMBER_OF_ENABLED_STATIC_RULESETS,
  MAX_NUMBER_OF_UNSAFE_DYNAMIC_RULES = 5000,
} = browser.declarativeNetRequest;

export class RulesLimitsController {
  configurationResult = null;

  isFilteringEnabled = true;

  async init() {
    // Static filters checks before enable them.
    messageHandler.addListener(MessageType.CanEnableStaticFilterMv3, this.#canEnableStaticFilter.bind(this));
    messageHandler.addListener(MessageType.CanEnableStaticGroupMv3, this.#canEnableStaticGroup.bind(this));

    // Checks for possible limits exceeding based on the current configuration result.
    messageHandler.addListener(MessageType.CurrentLimitsMv3, this.#getRulesLimits.bind(this));

    // First read from storage and set data to cache.
    await RulesLimitsController.#initStorage();
  }

  static #getStaticEnabledFiltersCount() {
    return FiltersService.getEnabledFiltersWithMetadata().filter((f) => !isCustomFilter(f.filterId))
      .length;
  }

  static #getRuleSetsCountersMap = (result) => {
    const counters = result.staticFilters.reduce((acc, ruleset) => {
      const filterId = Number(ruleset.getId().slice(RULESET_NAME_PREFIX.length));

      acc[filterId] = {
        filterId,
        rulesCount: ruleset.getRulesCount(),
        regexpRulesCount: ruleset.getRegexpRulesCount(),
      };

      return acc;
    }, {});

    return counters;
  };

  static #getRuleSetCounters(filters, ruleSetsCounters) {
    return filters
      .filter((f) => !isCustomFilter(f.filterId))
      .map((filter) => ruleSetsCounters[filter.filterId])
      .filter((ruleSet) => ruleSet !== undefined);
  }

  static #getStaticRuleSetCounter(result, filterId) {
    const ruleSetsCounters = RulesLimitsController.#getRuleSetsCountersMap(result);
    const ruleSetsCounter = ruleSetsCounters[filterId];
    if (!ruleSetsCounter) {
      throw new Error(`RuleSetCounter for filterId ${filterId} not found`);
    }
    return ruleSetsCounter;
  }

  static #getStaticRulesRegexpsCount(result, filters) {
    const ruleSetsCounters = RulesLimitsController.#getRuleSetsCountersMap(result);

    const ruleSets = RulesLimitsController.#getRuleSetCounters(filters, ruleSetsCounters);

    return ruleSets.reduce((sum, ruleSet) => {
      return sum + ruleSet.regexpRulesCount;
    }, 0);
  }

  static #getUnsafeRulesLimitExceedErr = (result) => {
    return result.dynamicRules?.limitations.find((e) => e instanceof TooManyUnsafeRulesError);
  };

  static #getRegexpRulesLimitExceedErr = (result) => {
    return result.dynamicRules?.limitations.find((e) => e instanceof TooManyRegexpRulesError);
  };

  static #getRulesLimitExceedErr = (result) => {
    return result.dynamicRules?.limitations.find((e) => e instanceof TooManyRulesError);
  };

  static #getDynamicRulesEnabledCount(result) {
    const rulesLimitExceedErr = RulesLimitsController.#getRulesLimitExceedErr(result);
    const declarativeRulesCount = result.dynamicRules?.ruleSet.getRulesCount() || 0;
    return rulesLimitExceedErr?.numberOfMaximumRules || declarativeRulesCount;
  }

  static #getDynamicRulesExcludedCount(result) {
    const rulesLimitExceedErr = RulesLimitsController.#getRulesLimitExceedErr(result);
    return rulesLimitExceedErr?.numberOfExcludedDeclarativeRules || 0;
  }

  static #getDynamicRulesMaximumCount(result) {
    const rulesLimitExceedErr = RulesLimitsController.#getRulesLimitExceedErr(result);
    return rulesLimitExceedErr?.numberOfMaximumRules || MAX_NUMBER_OF_DYNAMIC_RULES;
  }

  static #getDynamicRegexpRulesEnabledCount(result) {
    const regexpsCount = result.dynamicRules?.ruleSet.getRegexpRulesCount() || 0;

    const regexpRulesLimitExceedErr = RulesLimitsController.#getRegexpRulesLimitExceedErr(result);
    const excludedRulesCount = regexpRulesLimitExceedErr?.excludedRulesIds.length || 0;

    return regexpsCount + excludedRulesCount;
  }

  static #getDynamicRegexpRulesMaximumCount(result) {
    const regexpRulesLimitExceedErr = RulesLimitsController.#getRegexpRulesLimitExceedErr(result);
    return regexpRulesLimitExceedErr?.numberOfMaximumRules || MAX_NUMBER_OF_REGEX_RULES;
  }

  static #getDynamicUnsafeRulesEnabledCount(result) {
    const unsafeRulesCount = result.dynamicRules?.ruleSet.getUnsafeRulesCount() || 0;

    const unsafeRulesLimitExceedErr = RulesLimitsController.#getUnsafeRulesLimitExceedErr(result);
    const excludedRulesCount = unsafeRulesLimitExceedErr?.excludedRulesIds.length || 0;

    return unsafeRulesCount + excludedRulesCount;
  }

  static #getDynamicUnsafeRulesMaximumCount(result) {
    const rulesLimitExceedErr = RulesLimitsController.#getUnsafeRulesLimitExceedErr(result);
    return rulesLimitExceedErr?.numberOfMaximumRules || MAX_NUMBER_OF_UNSAFE_DYNAMIC_RULES;
  }

  static getExpectedEnabledFilters() {
    return rulesLimitsModel.getData();
  }

  static getCurrentConfigurationEnabledFilters() {
    const ids = FiltersService.getEnabledFiltersWithMetadata()
      /**
       * Ignore custom filters, user rules, and allowlist; they do not use
       * static rules quota (they go via dynamic DNR rules).
       */
      .filter((f) => CommonFilterUtils.isCommonFilter(f.filterId))
      .map((filter) => filter.filterId);

    return ids;
  }

  static async #getActuallyEnabledFilters() {
    const enabledRuleSetsIds = await chrome.declarativeNetRequest.getEnabledRulesets();

    return enabledRuleSetsIds.map((id) => Number.parseInt(id.slice(RULESET_NAME_PREFIX.length), 10));
  }

  /**
   * Checks whether the filter limits are exceeded:
   * - if we have cached enabled filters and they are not equal to the actually enabled filters
   * (when state was broken once before);
   * - if filters from current configuration are not equal to the actually enabled filters
   * (when state became broken right now).
   */
  static async areFilterLimitsExceeded() {
    // Skip check if desktop app is handling filtering
    if (DesktopAppService.isActive()) {
      return false;
    }

    const actuallyEnabledFilters = await RulesLimitsController.#getActuallyEnabledFilters();
    if (actuallyEnabledFilters.length === 0) {
      return false;
    }

    /**
     * If there are some filters in storage - it means, that last used
     * configuration is damaged and we should notify user about them until
     * he will fix configuration or turn off this notification.
     * This case needed to save warning if service worker will restart and
     * after successful configuration update we will not notify user about
     * changed configuration or user paused and resumed protection.
     */
    const cachedEnabledFilters = RulesLimitsController.getExpectedEnabledFilters();
    if (cachedEnabledFilters.length > 0 && !arraysAreEqual(actuallyEnabledFilters, cachedEnabledFilters)) {
      return true;
    }

    /**
     * Else we do a full check of the current configuration: if filters from
     * configuration are not same as enabled filters - it means that browser
     * declined update of the configuration and we should notify user about it.
     */
    const expectedEnabledFilters = RulesLimitsController.getCurrentConfigurationEnabledFilters();

    return !arraysAreEqual(actuallyEnabledFilters, expectedEnabledFilters);
  }

  updateConfigurationResult(result, isFilteringEnabled) {
    this.configurationResult = result;
    this.isFilteringEnabled = isFilteringEnabled;
  }

  static async checkFiltersLimitsChange(update) {
    const isStateBroken = await RulesLimitsController.areFilterLimitsExceeded();

    /**
     * If state is broken - disable filters that were expected to be enabled
     * and configure tswebextension without them to activate minimal possible
     * defense via saving last enabled filters in the separate storage to
     * show them in the UI.
     */
    if (isStateBroken) {
      const expectedEnabledFilters = RulesLimitsController.getCurrentConfigurationEnabledFilters();
      const actuallyEnabledFilters = await RulesLimitsController.#getActuallyEnabledFilters();

      const filtersToDisable = expectedEnabledFilters.filter((id) => !actuallyEnabledFilters.includes(id));

      /**
       * Save last expected to be enabled filters to notify UI about them,
       * because we will disable them to run minimal possible configuration.
       * It should be done only if there are no filters in the storage,
       * otherwise previous filters list will be overwritten on successful filter enabling.
       */
      if (RulesLimitsController.getExpectedEnabledFilters().length === 0) {
        await rulesLimitsModel.setData(expectedEnabledFilters);
      }

      filterStateModel.enableFilters(actuallyEnabledFilters);
      filterStateModel.disableFilters(filtersToDisable);

      /**
       * Update tswebextension configuration without check limitations to
       * skip recursion.
       */
      await update(true);
    } else {
      // If state is not broken - clear list of "broken" filters
      const prevExpectedEnabledFilters = RulesLimitsController.getExpectedEnabledFilters();
      if (prevExpectedEnabledFilters.length > 0) {
        await this.#cleanExpectedEnabledFilters();
      }
    }
  }

  static async #cleanExpectedEnabledFilters() {
    await rulesLimitsModel.setData([]);
  }

  /**
   * Read stringified domains array from specified allowlist storage,
   * parse it and set memory cache.
   *
   * If data is not exist, set default data.
   */
  static async #initStorage() {
    try {
      const storageData = await rulesLimitsModel.read();
      if (typeof storageData === 'string') {
        const validatedData = JSON.parse(storageData);
        rulesLimitsModel.setCache(validatedData);
      } else {
        await this.#cleanExpectedEnabledFilters();
      }
    } catch (e) {
      logger.warn(
        `[ext.RulesLimitsController.initStorage]: cannot parse data from "${rulesLimitsModel.key}" storage, set default states. Origin error:`,
        getErrorMessage(e),
      );
      await this.#cleanExpectedEnabledFilters();
    }
  }

  async #getRulesLimits() {
    const staticFiltersCheck = await this.#getStaticFiltersLimitations();
    const dynamicRulesCheck = await this.#getDynamicRulesLimitations();

    return {
      ok: staticFiltersCheck.ok && dynamicRulesCheck.ok,
      staticFiltersData: staticFiltersCheck.data,
      dynamicRulesData: dynamicRulesCheck.data,
    };
  }

  async #getStaticFiltersLimitations() {
    if (!this.isFilteringEnabled) {
      return { ok: true };
    }

    const enabledFiltersCount = RulesLimitsController.#getStaticEnabledFiltersCount();
    if (enabledFiltersCount === MAX_NUMBER_OF_ENABLED_STATIC_RULESETS) {
      return {
        ok: false,
        data: {
          type: 'static',
          filtersCount: {
            current: enabledFiltersCount,
            maximum: MAX_NUMBER_OF_ENABLED_STATIC_RULESETS,
          },
        },
      };
    }

    const areFilterLimitsExceeded = await RulesLimitsController.areFilterLimitsExceeded();
    if (areFilterLimitsExceeded) {
      const actuallyEnabledFilters = await RulesLimitsController.#getActuallyEnabledFilters();
      return {
        ok: false,
        data: {
          type: 'static',
          filtersCount: {
            current: actuallyEnabledFilters.length,
            expected: RulesLimitsController.getExpectedEnabledFilters().length,
          },
        },
      };
    }

    return { ok: true };
  }

  async #getDynamicRulesLimitations() {
    if (!this.isFilteringEnabled) {
      return { ok: true };
    }

    const result = this.configurationResult;
    if (!result) {
      logger.debug('[ext.RulesLimitsController.getDynamicRulesLimitations]: configuration result is not ready yet');
      return { ok: true };
    }

    const dynamicRulesEnabledCount = RulesLimitsController.#getDynamicRulesEnabledCount(result);
    const dynamicRulesExcludedCount = RulesLimitsController.#getDynamicRulesExcludedCount(result);
    const dynamicRulesMaximumCount = RulesLimitsController.#getDynamicRulesMaximumCount(result);

    const allRulesCount = dynamicRulesEnabledCount + dynamicRulesExcludedCount;
    if (allRulesCount > dynamicRulesMaximumCount) {
      return {
        ok: false,
        data: {
          type: 'dynamic',
          rulesCount: {
            /**
             * return number of all rules (enabled + excluded)
             * to show how many rules a user is trying to enable
             */
            current: dynamicRulesEnabledCount + dynamicRulesExcludedCount,
            maximum: dynamicRulesMaximumCount,
          },
        },
      };
    }

    const dynamicRulesUnsafeEnabledCount = RulesLimitsController.#getDynamicUnsafeRulesEnabledCount(result);
    const dynamicUnsafeRegexpsMaximumCount = RulesLimitsController.#getDynamicUnsafeRulesMaximumCount(result);
    if (dynamicRulesUnsafeEnabledCount > dynamicUnsafeRegexpsMaximumCount) {
      return {
        ok: false,
        data: {
          type: 'dynamic',
          rulesUnsafeCount: {
            current: dynamicRulesUnsafeEnabledCount,
            maximum: dynamicUnsafeRegexpsMaximumCount,
          },
        },
      };
    }

    const dynamicRulesRegexpsEnabledCount = RulesLimitsController.#getDynamicRegexpRulesEnabledCount(result);
    const dynamicRulesRegexpsMaximumCount = RulesLimitsController.#getDynamicRegexpRulesMaximumCount(result);
    if (dynamicRulesRegexpsEnabledCount > dynamicRulesRegexpsMaximumCount) {
      return {
        ok: false,
        data: {
          type: 'dynamic',
          rulesRegexpsCount: {
            current: dynamicRulesRegexpsEnabledCount,
            maximum: dynamicRulesRegexpsMaximumCount,
          },
        },
      };
    }

    return { ok: true };
  }

  async #doesStaticFilterFitsInLimits(filterId) {
    const result = this.configurationResult;

    /**
     * Usually, the configuration result should be ready, when this method is called.
     * But even if it's not ready, we should not block the filter enabling.
     * In any case, the filter will not be enabled if it doesn't fit in limits.
     */
    if (!result) {
      logger.error('[ext.RulesLimitsController.doesStaticFilterFitsInLimits]: configuration result is not ready yet');
      return { ok: true };
    }

    if (!this.isFilteringEnabled) {
      return { ok: true };
    }

    const enabledFiltersCount = RulesLimitsController.#getStaticEnabledFiltersCount();
    if (enabledFiltersCount > MAX_NUMBER_OF_ENABLED_STATIC_RULESETS) {
      return {
        ok: false,
        data: {
          type: 'static',
          filtersCount: {
            current: enabledFiltersCount,
            maximum: MAX_NUMBER_OF_ENABLED_STATIC_RULESETS,
          },
        },
      };
    }

    const availableStaticRulesCount = await browser.declarativeNetRequest.getAvailableStaticRuleCount();
    const filterStaticRulesCount = RulesLimitsController.#getStaticRuleSetCounter(result, filterId);
    if (filterStaticRulesCount.rulesCount > availableStaticRulesCount) {
      return {
        ok: false,
        data: {
          type: 'static',
          rulesCount: {
            current: filterStaticRulesCount.rulesCount,
            maximum: availableStaticRulesCount,
          },
        },
      };
    }

    const enabledFilters = FiltersService.getEnabledFiltersWithMetadata();
    const allEnabledRegexpRulesCount = RulesLimitsController.#getStaticRulesRegexpsCount(result, enabledFilters);
    const allPossibleEnabledRegexpRulesCount = allEnabledRegexpRulesCount + filterStaticRulesCount.regexpRulesCount;
    if (allPossibleEnabledRegexpRulesCount > MAX_NUMBER_OF_REGEX_RULES) {
      return {
        ok: false,
        data: {
          type: 'static',
          rulesRegexpsCount: {
            current: filterStaticRulesCount.regexpRulesCount,
            maximum: MAX_NUMBER_OF_REGEX_RULES,
          },
        },
      };
    }

    return { ok: true };
  }

  async #canEnableStaticFilter(message) {
    const { filterId } = message.data;

    if (isCustomFilter(filterId)) {
      throw new Error('Custom filters should be checked with canEnableDynamicRules method');
    }

    return this.#doesStaticFilterFitsInLimits(filterId);
  }

  async #doStaticFiltersFitInLimits(filterIds) {
    const result = this.configurationResult;

    /**
     * Usually, the configuration result should be ready when this method is called.
     * But even if it's not ready, we should not block the filter enabling.
     * In any case, the filter will not be enabled if it doesn't fit in limits.
     */
    if (!result) {
      logger.error('[ext.RulesLimitsController.doStaticFiltersFitInLimits]: configuration result is not ready yet.');
      return { ok: true };
    }

    if (!this.isFilteringEnabled) {
      return { ok: true };
    }

    const enabledFiltersCount = RulesLimitsController.#getStaticEnabledFiltersCount();
    const isWithinRulesetsLimit = enabledFiltersCount + filterIds.length <= MAX_NUMBER_OF_ENABLED_STATIC_RULESETS;
    if (!isWithinRulesetsLimit) {
      return {
        ok: false,
        data: {
          type: 'static',
          filtersCount: {
            current: enabledFiltersCount,
            maximum: MAX_NUMBER_OF_ENABLED_STATIC_RULESETS,
          },
        },
      };
    }

    const availableStaticRulesCount = await browser.declarativeNetRequest.getAvailableStaticRuleCount();

    const { totalStaticRulesCount, totalRegexpRulesCount } = filterIds.reduce(
      (acc, filterId) => {
        const filterStaticRulesCount = RulesLimitsController.#getStaticRuleSetCounter(result, filterId);
        acc.totalStaticRulesCount += filterStaticRulesCount.rulesCount;
        acc.totalRegexpRulesCount += filterStaticRulesCount.regexpRulesCount;
        return acc;
      },
      { totalStaticRulesCount: 0, totalRegexpRulesCount: 0 },
    );

    const isWithinStaticRulesLimit = availableStaticRulesCount >= totalStaticRulesCount;
    if (!isWithinStaticRulesLimit) {
      return {
        ok: false,
        data: {
          type: 'static',
          rulesCount: {
            current: totalStaticRulesCount,
            maximum: availableStaticRulesCount,
          },
        },
      };
    }

    const enabledFilters = FiltersService.getEnabledFiltersWithMetadata();
    const allEnabledRegexpRulesCount = RulesLimitsController.#getStaticRulesRegexpsCount(result, enabledFilters);
    const regexpRulesIfFiltersEnabled = allEnabledRegexpRulesCount + totalRegexpRulesCount;
    const isWithinRegexRulesLimit = regexpRulesIfFiltersEnabled <= MAX_NUMBER_OF_REGEX_RULES;

    if (!isWithinRegexRulesLimit) {
      return {
        ok: false,
        data: {
          type: 'static',
          rulesRegexpsCount: {
            current: totalRegexpRulesCount,
            maximum: MAX_NUMBER_OF_REGEX_RULES,
          },
        },
      };
    }

    return {
      ok: true,
    };
  }

  async #canEnableStaticGroup(message) {
    const { groupId } = message.data;

    const group = Categories.getGroupState(groupId);
    if (!group) {
      throw new Error(`There is no group with such id: ${groupId}`);
    }

    let filters = [];
    if (group.touched) {
      filters = Categories.getEnabledFiltersIdsByGroupId(groupId);
    } else {
      filters = Categories.getRecommendedFilterIdsByGroupId(groupId);
    }

    return this.#doStaticFiltersFitInLimits(filters);
  }
}

export const rulesLimitsController = new RulesLimitsController();
