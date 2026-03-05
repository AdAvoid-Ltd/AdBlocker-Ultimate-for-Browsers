import browser from 'webextension-polyfill';

import { FiltersStorage as TsWebExtensionFiltersStorage } from '@adguard/tswebextension/filters-storage';
import { extractRuleSetId } from '@adguard/tsurlfilter/es/declarative-converter-utils';
import { METADATA_RULESET_ID } from '@adguard/tsurlfilter/es/declarative-converter';

import { FilterListPreprocessor } from 'tswebextension';

import { FiltersModel as BrowserExtensionFiltersModel } from './filters';

/**
 * The `FiltersStoragesAdapter` is a high-level class responsible for ensuring that
 * the appropriate filter storage is invoked for different types of filters.
 *
 * In the MV3 version, static filters (rulesets) are deployed alongside the extension in JSON format.
 * Our engine operates on binary data (which is part of the preprocessed filters),
 * but these JSON rulesets do not support storing binary data. Additionally,
 * querying data from JSON is not the most efficient operation.
 *
 * To address this, `TSWebExtension` internally manages its own IndexedDB store,
 * where it automatically synchronizes rulesets as preprocessed filter lists.
 * However, this logic applies only to rulesets in MV3. User filters, allowlists, and custom filters
 * are not affected by this mechanism—they are still stored using the classic `FiltersStorage`,
 * which is managed by the browser extension.
 *
 * To simplify the usage of multiple storages, we introduced this adapter,
 * which always calls the appropriate storage for each filter list.
 * This allows the lower-level storage implementations to remain focused on
 * their specific responsibilities while ensuring seamless integration.
 */
export class FiltersStoragesAdapter {
  // Cache for static MV3 filter IDs.
  static #staticFilterIds = null;

  static async getRawFilterList(filterId) {
    if (__IS_MV3__) {
      const staticFilterIds = FiltersStoragesAdapter.#getStaticFilterIds();
      if (staticFilterIds !== null && staticFilterIds.has(filterId)) {
        return TsWebExtensionFiltersStorage.getRawFilterList(filterId);
      }
    }

    return BrowserExtensionFiltersModel.getRawFilterList(filterId);
  }

  static async getConversionMap(filterId) {
    if (__IS_MV3__) {
      const staticFilterIds = FiltersStoragesAdapter.#getStaticFilterIds();
      if (staticFilterIds !== null && staticFilterIds.has(filterId)) {
        return TsWebExtensionFiltersStorage.getConversionMap(filterId);
      }
    }

    return BrowserExtensionFiltersModel.getConversionMap(filterId);
  }

  static async getSourceMap(filterId) {
    if (__IS_MV3__) {
      const staticFilterIds = FiltersStoragesAdapter.#getStaticFilterIds();
      if (staticFilterIds !== null && staticFilterIds.has(filterId)) {
        return TsWebExtensionFiltersStorage.getSourceMap(filterId);
      }
    }

    return BrowserExtensionFiltersModel.getSourceMap(filterId);
  }

  static async getOriginalFilterList(filterId) {
    const [rawFilterList, conversionMap] = await Promise.all([
      FiltersStoragesAdapter.getRawFilterList(filterId),
      FiltersStoragesAdapter.getConversionMap(filterId),
    ]);

    if (rawFilterList === undefined) {
      return undefined;
    }

    if (conversionMap === undefined) {
      return rawFilterList;
    }

    return FilterListPreprocessor.getOriginalFilterListText({
      rawFilterList,
      conversionMap,
    });
  }

  static #getStaticFilterIds() {
    if (!__IS_MV3__) {
      return null;
    }

    if (FiltersStoragesAdapter.#staticFilterIds !== null) {
      return FiltersStoragesAdapter.#staticFilterIds;
    }

    const manifest = browser.runtime.getManifest();

    if (!manifest.declarative_net_request) {
      return null;
    }

    FiltersStoragesAdapter.#staticFilterIds = new Set(
      manifest.declarative_net_request.rule_resources
        .map(({ id }) => extractRuleSetId(id))
        /**
         * Metadata ruleset is not a real ruleset, so we should not include it in the list of static rulesets.
         * Also, its ID is conflicting with the ID of User Rules.
         */
        .filter((id) => id !== null && id !== METADATA_RULESET_ID),
    );

    return FiltersStoragesAdapter.#staticFilterIds;
  }
}
