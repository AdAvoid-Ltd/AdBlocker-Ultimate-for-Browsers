import { debounce } from 'lodash-es';

/**
 * Because this file is already MV3 replacement module, we can import directly
 * from mv3 tswebextension without using aliases.
 */
import { TsWebExtension } from '@adguard/tswebextension/mv3';

import { logger } from '../../common/logger';
import { WEB_ACCESSIBLE_RESOURCES_OUTPUT_REDIRECTS } from '../../../constants';
import { eventBus } from '../event-bus';
import {
  FiltersService,
  AllowlistService,
  UserRulesService,
  SettingsService,
  toasts,
  IconsService,
  DocumentBlockService,
  CustomFilterService,
  DesktopAppService,
} from '../services';
import { RulesLimitsController, rulesLimitsController } from '../controllers/rules-limits/rules-limits-service-mv3';
import { UserRulesController } from '../controllers/userrules';
import { emptyPreprocessedFilterList, EventType } from '../../common/constants';
import { localScriptRules } from '../../resources/filters/chromium-mv3/local_script_rules';
import { FiltersModel } from '../models';
import { CommonFilterUtils } from '../utils';
import { isUserScriptsApiSupported } from '../../common/user-scripts-api';

export class Engine {
  api;

  handleMessage;

  static #UPDATE_TIMEOUT_MS = 1000;

  static #filteringEnabled = true;

  constructor() {
    this.api = new TsWebExtension(`/${WEB_ACCESSIBLE_RESOURCES_OUTPUT_REDIRECTS}`);

    /**
     * Search for 'JS_RULES_EXECUTION' to find all parts of script execution
     * process in the extension.
     *
     * 1. We collect and bundle all scripts that can be executed on web pages into
     *    the extension package into so-called `localScriptRules`.
     * 2. Rules that control when and where these scripts can be executed are also
     *    bundled within the extension package inside ruleset files.
     * 3. The rules look like: `example.org#%#scripttext`. Whenever the rule is
     *    matched, we check if there's a function for `scripttext` in
     *    `localScriptRules`, retrieve it from there and execute it.
     *
     * Here we're initializing the `localScriptRules` map in the engine so
     * that it could get the functions to execute.
     *
     * Set local script rules regardless of User Scripts API support,
     * since is User Script API is available, it can be triggered by
     * user in any moment which we cannot track, so we always need
     * to have localScriptRules set in the engine to have possibility
     * to execute scripts via scripting.executeScript with locality check.
     */
    TsWebExtension.setLocalScriptRules(localScriptRules);

    this.handleMessage = this.api.getMessageHandler();
  }

  debounceUpdate = debounce(this.update.bind(this), Engine.#UPDATE_TIMEOUT_MS);

  async start() {
    const configuration = await Engine.#getConfiguration();

    logger.info('[ext.Engine.start]: Start tswebextension...');
    const result = await this.api.start(configuration);

    rulesLimitsController.updateConfigurationResult(result, !DesktopAppService.isActive());
    UserRulesController.checkUserRulesRegexpErrors(result);

    const rulesCount = this.api.getRulesCount();
    logger.info(`[ext.Engine.start]: tswebextension is started. Rules count: ${rulesCount}`);
    eventBus.emit(EventType.RequestFilterUpdated);

    await RulesLimitsController.checkFiltersLimitsChange(this.update.bind(this));

    if (await RulesLimitsController.areFilterLimitsExceeded()) {
      toasts.showRuleLimitsAlert();
    }
    /**
     * Updates extension icon state after engine initialization in Manifest V3.
     *
     * Context:
     * 1. This is called at the end of Engine.start() after all filters are initialized
     * 2. In MV3, extension icon needs immediate update after engine start to prevent
     *    incorrect 'warning' icon state.
     *
     * Warning icon behavior:
     * - Without this update, warning icon persists until next UiService.update() call
     *   (which happens on tab change or window focus)
     * - Warning icon may be valid during initialization when:
     *   - Base filter (ID: 2) is enabled in manifest
     *   - Default filters (IDs: 2, 10) are pending enablement.
     */
    await IconsService.update();
  }

  async update(skipLimitsCheck = false) {
    const configuration = await Engine.#getConfiguration();

    logger.info('[ext.Engine.update]: Update tswebextension configuration...');
    if (skipLimitsCheck) {
      logger.info('[ext.Engine.update]: With skip limits check.');
    }
    const result = await this.api.configure(configuration);

    rulesLimitsController.updateConfigurationResult(result, !DesktopAppService.isActive());
    UserRulesController.checkUserRulesRegexpErrors(result);

    const rulesCount = this.api.getRulesCount();
    logger.info(`[ext.Engine.update]: tswebextension configuration is updated. Rules count: ${rulesCount}`);
    eventBus.emit(EventType.RequestFilterUpdated);

    if (!skipLimitsCheck) {
      await RulesLimitsController.checkFiltersLimitsChange(this.update.bind(this));

      // show the alert only if limits checking is not skipped and limits are exceeded
      if (await RulesLimitsController.areFilterLimitsExceeded()) {
        toasts.showRuleLimitsAlert();
      }
    }
    // Updates extension icon state to reflect current filtering status.
    await IconsService.update();
  }

  static async #getConfiguration() {
    const staticFiltersIds = FiltersService.getEnabledFilters()
      .filter((filterId) => CommonFilterUtils.isCommonFilter(filterId));

    const settings = {
      ...SettingsService.getTsWebExtConfiguration(true),
      filteringEnabled: Engine.#filteringEnabled,
    };

    const allowlist = AllowlistService.getAllowlistDomains();

    const userrules = {
      ...emptyPreprocessedFilterList,
      // User rules are always trusted.
      trusted: true,
      ...(await UserRulesService.getUserRules()),
    };

    const quickFixesRules = {
      ...emptyPreprocessedFilterList,
      trusted: true,
    };

    let customFilters = [];

    /**
     * Custom filters are NOT allowed for users by default. To have them enabled,
     * user must explicitly grant User scripts API permission.
     *
     * To fully comply with Chrome Web Store policies regarding remote code execution,
     * we implement a strict security-focused approach for JavaScript rule execution.
     *
     * 1. Default - regular users that did not grant User scripts API permission explicitly:
     *    - We collect and pre-build script rules from the filters and statically bundle
     *      them into the extension - STEP 1. See 'updateLocalResourcesForChromiumMv3' in our build tools.
     *      IMPORTANT: all scripts and their arguments are local and bundled within the extension.
     *    - These pre-verified local scripts are passed to the engine - STEP 2.
     *    - At runtime before the execution, we check if each script rule is included
     *      in our local scripts list (STEP 3).
     *    - Only pre-verified local scripts are executed via chrome.scripting API (STEP 4.1 and 4.2).
     *      All other scripts are discarded.
     *    - Custom filters are NOT allowed for regular users to prevent any possibility
     *      of remote code execution, regardless of rule interpretation.
     *
     * 2. For advanced users that explicitly granted User scripts API permission -
     *    via enabling the Developer mode or Allow user scripts in the extension details:
     *    - Custom filters are allowed and may contain Scriptlet and JS rules
     *      that can be executed using the browser's built-in userScripts API (STEP 4.3),
     *      which provides a secure sandbox.
     *    - This execution bypasses the local script verification process but remains
     *      isolated and secure through Chrome's native sandboxing.
     *    - This mode requires explicit user activation and is intended for advanced users only.
     *
     * IMPORTANT:
     * Custom filters are ONLY supported when User scripts API permission is explicitly enabled.
     * This strict policy prevents Chrome Web Store rejection due to potential remote script execution.
     * When custom filters are allowed, they may contain:
     * 1. Network rules – converted to DNR rules and applied via dynamic rules.
     * 2. Cosmetic rules – interpreted directly in the extension code.
     * 3. Scriptlet and JS rules – executed via the browser's userScripts API (userScripts.execute)
     *    with Chrome's native sandboxing providing security isolation.
     *
     * For regular users without User scripts API permission (default case):
     * - Only pre-bundled filters with statically verified scripts are supported.
     * - Downloading custom filters or any rules from remote sources is blocked entirely
     *   to ensure compliance with the store policies.
     *
     * This implementation ensures perfect compliance with Chrome Web Store policies
     * by preventing any possibility of remote code execution for regular users.
     *
     * It is possible to follow all places using this logic by searching JS_RULES_EXECUTION.
     */
    if (isUserScriptsApiSupported()) {
      const customFiltersWithMetadata = FiltersService.getEnabledFiltersWithMetadata()
        .filter((f) => CustomFilterService.isCustomFilterMetadata(f));

      customFilters = await Promise.all(
        customFiltersWithMetadata.map(async ({ filterId, trusted }) => {
          const preprocessedFilterList = await FiltersModel.get(filterId);

          return {
            filterId,
            trusted,
            ...(preprocessedFilterList || emptyPreprocessedFilterList),
          };
        }),
      );
    }

    const trustedDomains = await DocumentBlockService.getTrustedDomains();

    return {
      customFilters,
      quickFixesRules,
      verbose: !!IS_RELEASE || logger.isVerbose(),
      logLevel: logger.currentLevel,
      // Built-in local filters.
      staticFiltersIds,
      /**
       * Rules defined by user. Applying them depends on User Scripts API
       * permission: if it is granted, user rules are applied as-is,
       * otherwise script rules are filtered against localScriptRules.
       */
      userrules,
      allowlist,
      settings,
      filtersPath: 'filters/',
      ruleSetsPath: 'filters/declarative',
      declarativeLogEnabled: false,
      trustedDomains,
    };
  }

  async setFilteringState(isFilteringEnabled) {
    Engine.#filteringEnabled = isFilteringEnabled;
    logger.info(`[ext.Engine.setFilteringState]: Filtering ${isFilteringEnabled ? 'enabled' : 'disabled'}`);

    /**
     * Configure tswebextension with the new settings without checking limits
     * if we paused filtering.
     */
    const skipCheck = isFilteringEnabled === false;
    await this.update(skipCheck);
  }
}
