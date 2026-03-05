import { FilterListPreprocessor } from 'tswebextension';

import { hybridModel } from './shared-instances';

export class FiltersModel {
  static KEY_COMBINER = '_';

  /**
   * Key for the filter list.
   * Should be the same as in `PreprocessedFilterList`.
   */
  static KEY_FILTER_LIST = 'filterList';

  static KEY_RAW_FILTER_LIST = 'rawFilterList';

  static KEY_CONVERSION_MAP = 'conversionMap';

  static KEY_SOURCE_MAP = 'sourceMap';

  static getKey(keyPrefix, filterId) {
    return `${keyPrefix}${FiltersModel.KEY_COMBINER}${filterId}`;
  }

  static async set(filterId, filter) {
    const data = {};

    let preprocessed;

    if (typeof filter === 'string') {
      preprocessed = FilterListPreprocessor.preprocess(filter);
    } else {
      preprocessed = filter;
    }

    for (const [key, value] of Object.entries(preprocessed)) {
      const storageKey = FiltersModel.getKey(key, filterId);
      data[storageKey] = value;
    }

    const succeeded = await hybridModel.setMultiple(data);

    if (!succeeded) {
      throw new Error('Transaction failed');
    }
  }

  static async has(filterId) {
    const storageKey = FiltersModel.getKey(FiltersModel.KEY_FILTER_LIST, filterId);
    return hybridModel.has(storageKey);
  }

  static async get(filterId) {
    // eslint-disable-next-line prefer-const
    let [rawFilterList, filterList, conversionMap, sourceMap] = await Promise.all([
      FiltersModel.getRawFilterList(filterId),
      FiltersModel.getFilterList(filterId),
      FiltersModel.getConversionMap(filterId),
      FiltersModel.getSourceMap(filterId),
    ]);

    if (rawFilterList === undefined || filterList === undefined || sourceMap === undefined) {
      return undefined;
    }

    if (conversionMap === undefined) {
      conversionMap = {};
    }

    return {
      filterList,
      rawFilterList,
      conversionMap,
      sourceMap,
    };
  }

  static async remove(filterId) {
    await hybridModel.removeMultiple([
      FiltersModel.getKey(FiltersModel.KEY_FILTER_LIST, filterId),
      FiltersModel.getKey(FiltersModel.KEY_RAW_FILTER_LIST, filterId),
      FiltersModel.getKey(FiltersModel.KEY_CONVERSION_MAP, filterId),
      FiltersModel.getKey(FiltersModel.KEY_SOURCE_MAP, filterId),
    ]);
  }

  static async getRawFilterList(filterId) {
    const storageKey = FiltersModel.getKey(FiltersModel.KEY_RAW_FILTER_LIST, filterId);
    return hybridModel.get(storageKey);
  }

  static async getFilterList(filterId) {
    const storageKey = FiltersModel.getKey(FiltersModel.KEY_FILTER_LIST, filterId);
    return hybridModel.get(storageKey);
  }

  static async getConversionMap(filterId) {
    const storageKey = FiltersModel.getKey(FiltersModel.KEY_CONVERSION_MAP, filterId);
    return hybridModel.get(storageKey);
  }

  static async getSourceMap(filterId) {
    const storageKey = FiltersModel.getKey(FiltersModel.KEY_SOURCE_MAP, filterId);
    return hybridModel.get(storageKey);
  }
}
