import browser from 'webextension-polyfill';

import { FiltersDownloader } from '@adguard/filters-downloader/browser';

import { LOCAL_METADATA_FILE_NAME } from '../../../../constants';
import { logger } from '../../../common/logger';
import { UserAgent } from '../../../common/user-agent';

import { NetworkSettings } from './settings-mv2';

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

  async downloadFilterRules(filterUpdateOptions, forceRemote, useOptimizedFilters, rawFilter) {
    let url = '';
    const { filterId } = filterUpdateOptions;

    const hasFilterIdInLocalFilters = this.settings.localFilterIds.indexOf(filterId) >= 0;

    if (!forceRemote && !hasFilterIdInLocalFilters) {
      /**
       * Search for 'JS_RULES_EXECUTION' to find all parts of script execution
       * process in the extension.
       *
       * Note, that downloading anything is forbidden in MV3 extension.
       */

      throw new Error(
        `Cannot locally load filter with id ${filterId} because it is not build in the extension local resources.`,
      );
    }

    let isLocalFilter = false;

    if (forceRemote || !hasFilterIdInLocalFilters) {
      if (!filterUpdateOptions.downloadUrl) {
        throw new Error(
          `Cannot download filter ${filterId}: downloadUrl is required in filterUpdateOptions`,
        );
      }
      url = filterUpdateOptions.downloadUrl;
    } else {
      const filterFileName = useOptimizedFilters ? `filter_mobile_${filterId}.txt` : `filter_${filterId}.txt`;
      url = browser.runtime.getURL(`${this.settings.localFiltersFolder}/${filterFileName}`);
      isLocalFilter = true;
    }

    // local filters do not support patches, that is why we always download them fully
    if (isLocalFilter || filterUpdateOptions.ignorePatches || !rawFilter) {
      // full remote filter update for MV2
      const result = await FiltersDownloader.downloadWithRaw(url, {
        force: true,
        definedExpressions: this.filterCompilerConditionsConstants,
        verbose: logger.isVerbose(),
        validateChecksum: false,
        validateChecksumStrict: false,
      });
      return result;
    }

    return FiltersDownloader.downloadWithRaw(url, {
      rawFilter,
      definedExpressions: this.filterCompilerConditionsConstants,
      verbose: logger.isVerbose(),
      validateChecksum: false,
      validateChecksumStrict: false,
    });
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

  async getLocalFiltersMetadata() {
    // Metadata is stored in a separate JSON file.
    const url = browser.runtime.getURL(`${this.settings.localFiltersFolder}/${LOCAL_METADATA_FILE_NAME}`);

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
      const metadata = JSON.parse(response.responseText);
      return metadata;
    } catch (e) {
      throw Network.createError('invalid response', url, response, e instanceof Error ? e : undefined);
    }
  }

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
