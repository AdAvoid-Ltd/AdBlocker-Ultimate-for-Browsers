import { logger } from '../../common/logger';
import { FILTER_LIST_EXTENSION } from '../../common/constants';

import { hybridModel } from './shared-instances';

// These filter lists are stored in raw format, and they are used in the diff update process.
const RAW_FILTER_KEY_PREFIX = 'raw_filterrules_';

export class RawFiltersModel {
  static async set(filterId, filter) {
    const key = RawFiltersModel.#getFilterKey(filterId);

    await hybridModel.set(key, filter);
  }

  static async get(filterId) {
    const key = RawFiltersModel.#getFilterKey(filterId);

    const data = await hybridModel.get(key);

    if (data === undefined || data === null) {
      return undefined;
    }

    // Validate that data is a string (raw filter content for diff/patch updates)
    if (typeof data !== 'string') {
      logger.info('[ext.RawFiltersModel.get]: received data had a format that was not expected');
      return undefined;
    }

    return data;
  }

  static async remove(filterId) {
    const key = RawFiltersModel.#getFilterKey(filterId);
    return hybridModel.remove(key);
  }

  static #getFilterKey(filterId) {
    return `${RAW_FILTER_KEY_PREFIX}${filterId}${FILTER_LIST_EXTENSION}`;
  }
}
