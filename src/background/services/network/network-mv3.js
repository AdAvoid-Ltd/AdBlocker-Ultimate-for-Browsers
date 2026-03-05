import browser from 'webextension-polyfill';

import { FiltersDownloader } from '@adguard/filters-downloader/browser';
import { getRuleSetPath } from '@adguard/tsurlfilter/es/declarative-converter-utils';
import { METADATA_RULESET_ID, MetadataRuleSet } from '@adguard/tsurlfilter/es/declarative-converter';
import { TsWebExtension } from '@adguard/tswebextension/mv3';

import { logger } from '../../../common/logger';
import { UserAgent } from '../../../common/user-agent';
import { NEWLINE_CHAR_REGEX } from '../../../common/constants';
import { FiltersStoragesAdapter } from '../../models';

import { NetworkSettings } from './settings-mv3';

class Network {
  settings = new NetworkSettings();

  filterCompilerConditionsConstants = {
    adguard: true,
    adguard_ext_chromium: UserAgent.isChromium,
    adguard_ext_firefox: UserAgent.isFirefox,
    adguard_ext_edge: UserAgent.isEdge,
    adguard_ext_safari: false,
  };

  loadingSubscriptions = {};

  async init() {
    await this.settings.init();
  }

  isFilterHasLocalCopy(filterId) {
    return this.settings.localFilterIds.includes(filterId);
  }

  /**
   * Load filter rules from bundled local resources.
   *
   * In MV3, all common filters are pre-bundled with the extension and loaded
   * from IndexedDB (synced from declarative rulesets). Remote downloading is
   * not supported. Custom filters use downloadFilterRulesBySubscriptionUrl().
   */
  async downloadFilterRules(filterUpdateOptions) {
    const { filterId } = filterUpdateOptions;

    /**
     * For MV3 we load local filters from the prepared data in filters storage,
     * to which we write the binary data from @adguard/dnr-rulesets.
     *
     * Sync the declarative ruleset with IndexedDB to ensure the filter
     * data is available in the storage before attempting to retrieve it.
     * Note: because this method called before first run of tswebextension,
     * it will use it's own default log level.
     */
    await TsWebExtension.syncRuleSetWithIdbByFilterId(filterId, 'filters/declarative');

    const rawFilterList = await FiltersStoragesAdapter.getRawFilterList(filterId);

    if (!rawFilterList) {
      throw new Error(`Cannot find filter with id ${filterId}`);
    }

    return {
      filter: rawFilterList.split(NEWLINE_CHAR_REGEX),
      rawFilter: rawFilterList,
    };
  }

  async downloadFilterRulesBySubscriptionUrl(url, rawFilter, force) {
    if (url in this.loadingSubscriptions) {
      return;
    }

    this.loadingSubscriptions[url] = true;

    try {
      const downloadData = await FiltersDownloader.downloadWithRaw(url, {
        definedExpressions: this.filterCompilerConditionsConstants,
        force,
        rawFilter,
        verbose: logger.isVerbose(),
        validateChecksum: true,
        // use false because we know that custom filters might not have checksums
        validateChecksumStrict: false,
      });

      delete this.loadingSubscriptions[url];

      // Get the first rule to check if it is an adblock agent (like [Adblock Plus 2.0]). If so, ignore it.
      const firstRule = downloadData.filter[0]?.trim();

      if (firstRule && firstRule.startsWith('[') && firstRule.endsWith(']')) {
        downloadData.filter.shift();
      }

      return downloadData;
    } catch (e) {
      delete this.loadingSubscriptions[url];
      const message = e instanceof Error ? e.message : 'Unknown error while filter downloading by subscription url';

      throw new Error(message, { cause: e });
    }
  }

  /**
   * Loads filters metadata from local file.
   * For MV3, it loads metadata from the metadata ruleset file.
   */
  async getLocalFiltersMetadata() {
    /**
     * For MV3, the filters metadata is stored in the metadata ruleset.
     * The reason for this is that it allows us to perform extension updates
     * where only the JSON files of the rulesets are changed.
     */
    const metadataRuleSetPath = getRuleSetPath(METADATA_RULESET_ID, `${this.settings.localFiltersFolder}/declarative`);
    const url = browser.runtime.getURL(metadataRuleSetPath);

    let response;

    try {
      response = await Network.fetchJson(url);
    } catch (e) {
      const exMessage = e instanceof Error ? e.message : 'could not load local filters metadata';
      throw Network.createError(exMessage, url);
    }

    if (!response?.responseText) {
      throw Network.createError('empty response', url, response);
    }

    try {
      const metadataRuleSet = MetadataRuleSet.deserialize(response.responseText);
      // Filters metadata is stored as an additional property in the metadata ruleset.
      const filtersMetadata = metadataRuleSet.getAdditionalProperty('metadata') || {};
      const metadata = {
        version: metadataRuleSet.getAdditionalProperty('version'),
        versionTimestampMs: metadataRuleSet.getAdditionalProperty('versionTimestampMs'),
        ...filtersMetadata,
      };
      return metadata;
    } catch (e) {
      throw Network.createError('invalid response', url, response, e instanceof Error ? e : undefined);
    }
  }

  // This method should be called only in the Firefox AMO.
  async getLocalScriptRules() {
    const url = browser.runtime.getURL(`${this.settings.localFiltersFolder}/local_script_rules.json`);

    let response;

    try {
      response = await Network.fetchJson(url);
    } catch (e) {
      const exMessage = e instanceof Error ? e.message : 'could not load local script rules';
      throw Network.createError(exMessage, url);
    }

    if (!response?.responseText) {
      throw Network.createError('empty response', url, response);
    }

    try {
      const localScriptRules = JSON.parse(response.responseText);

      return localScriptRules;
    } catch (e) {
      throw Network.createError('invalid response', url, response, e instanceof Error ? e : undefined);
    }
  }

  static async fetchJson(url) {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const responseText = await response.text();

    return {
      ...response,
      mozBackgroundRequest: true,
      responseText,
    };
  }

  static createError(message, url, response, originError) {
    let errorMessage = `
            error:                    ${message}
            requested url:            ${url}`;

    if (response) {
      errorMessage = `
            error:                    ${message}
            requested url:            ${url}
            request status text:      ${response.statusText}`;
    }

    return new Error(errorMessage, { cause: originError });
  }
}

export const network = new Network();
