import { debounce } from 'lodash-es';

import { createTsWebExtension } from '@adguard/tswebextension';

import { logger } from '../../common/logger';
import { WEB_ACCESSIBLE_RESOURCES_OUTPUT } from '../../../constants';
import { eventBus } from '../event-bus';
import { FiltersModel } from '../models';
import {
  FiltersService,
  AllowlistService,
  UserRulesService,
  SettingsService,
  DocumentBlockService,
  network,
} from '../services';
import { EventType } from '../../common/constants';

export class Engine {
  api = createTsWebExtension(WEB_ACCESSIBLE_RESOURCES_OUTPUT);

  static #UPDATE_TIMEOUT_MS = 1000;

  static #filteringEnabled = true;

  debounceUpdate = debounce(this.update.bind(this), Engine.#UPDATE_TIMEOUT_MS);

  handleMessage = this.api.getMessageHandler();

  async start() {
    /**
     * By the rules of Firefox AMO, we cannot use remote scripts (and our JS rules can be counted as such).
     * Because of that, we use the following approach (that was accepted by AMO reviewers):
     *
     * 1. We pre-build JS rules from filters into the JSON file.
     * 2. At runtime we check every JS rule if it is included into JSON.
     *    If it is included we allow this rule to work since it is pre-built. Other rules are discarded.
     * 3. We also allow "User rules" and "Custom filters" to work since those rules are added manually by the user.
     *    This way filters maintainers can test new rules before including them in the filters.
     */
    if (IS_FIREFOX_AMO) {
      const localScriptRules = await network.getLocalScriptRules();

      this.api.setLocalScriptRules(localScriptRules);
    }

    const configuration = await Engine.#getConfiguration();

    logger.info('[ext.Engine.start]: Start tswebextension...');
    await this.api.start(configuration);

    const rulesCount = this.api.getRulesCount();
    logger.info(`[ext.Engine.start]: tswebextension is started. Rules count: ${rulesCount}`);
    eventBus.emit(EventType.RequestFilterUpdated);
  }

  async update() {
    const configuration = await Engine.#getConfiguration();

    logger.info('[ext.Engine.update]: Update tswebextension configuration...');
    await this.api.configure(configuration);

    const rulesCount = this.api.getRulesCount();
    logger.info(`[ext.Engine.update]: tswebextension configuration is updated. Rules count: ${rulesCount}`);
    eventBus.emit(EventType.RequestFilterUpdated);
  }

  static async #getConfiguration() {
    const enabledFilters = FiltersService.getEnabledFilters();

    const filters = [];

    const tasks = enabledFilters.map(async (filterId) => {
      try {
        const [content, sourceMap] = await Promise.all([
          FiltersModel.getFilterList(filterId),
          FiltersModel.getSourceMap(filterId),
        ]);

        if (!content) {
          logger.error(`[ext.Engine.getConfiguration]: Failed to get filter ${filterId}`);
          return;
        }

        if (!sourceMap) {
          logger.warn(`[ext.Engine.getConfiguration]: Source map is not found for filter ${filterId}`);
        }

        const trusted = FiltersService.isFilterTrusted(filterId);

        filters.push({
          filterId,
          content,
          trusted,
          sourceMap,
        });
      } catch (e) {
        logger.error(`[ext.Engine.getConfiguration]: Failed to get filter ${filterId}`, e);
      }
    });

    await Promise.all(tasks);

    const settings = {
      ...SettingsService.getTsWebExtConfiguration(false),
      filteringEnabled: Engine.#filteringEnabled,
    };

    const allowlist = AllowlistService.getAllowlistDomains();

    const trustedDomains = await DocumentBlockService.getTrustedDomains();

    const result = {
      verbose: !!IS_RELEASE,
      logLevel: logger.currentLevel,
      filters,
      userrules: {
        content: [],
        sourceMap: {},
      },
      allowlist,
      settings,
      trustedDomains,
    };

    const { filterList, sourceMap } = await UserRulesService.getUserRules();

    result.userrules.content = filterList;
    result.userrules.sourceMap = sourceMap;

    return result;
  }

  async setFilteringState(isFilteringEnabled) {
    Engine.#filteringEnabled = isFilteringEnabled;
    await this.api.setFilteringEnabled(isFilteringEnabled);
  }
}
