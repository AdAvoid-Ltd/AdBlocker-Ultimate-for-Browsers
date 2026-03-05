import { logger } from '../../common/logger';
import { SettingOption } from '../storage-keys.js';

import { StringStorage } from './string-storage';
import { settingsModel } from './settings';

export class FilterVersionModel extends StringStorage {
  get(filterId) {
    if (!this.data) {
      throw FilterVersionModel.#createNotInitializedError();
    }

    return this.data[filterId];
  }

  set(filterId, data) {
    if (!this.data) {
      throw FilterVersionModel.#createNotInitializedError();
    }

    this.data[filterId] = data;

    this.save();
  }

  delete(filterId) {
    if (!this.data) {
      throw FilterVersionModel.#createNotInitializedError();
    }

    delete this.data[filterId];

    this.save();
  }

  refreshLastCheckTime(filterDetails) {
    if (!this.data) {
      throw FilterVersionModel.#createNotInitializedError();
    }

    const now = Date.now();

    for (let i = 0; i < filterDetails.length; i += 1) {
      const filterDetail = filterDetails[i];

      if (!filterDetail) {
        continue;
      }

      const { filterId, ignorePatches } = filterDetail;

      const data = this.data[filterId];

      if (!data) {
        logger.warn(
          `[ext.FilterVersionModel.refreshLastCheckTime]: failed to refresh last check time for filter ${filterId}.`,
        );
        continue;
      }

      if (ignorePatches) {
        data.lastCheckTime = now;
      } else {
        data.lastScheduledCheckTime = now;
      }
    }

    this.save();
  }

  static applyMetadata(data, metadata) {
    const { filters } = metadata;

    filters.forEach(({ filterId, version, expires, timeUpdated }) => {
      if (!data[filterId]) {
        data[filterId] = {
          version,
          expires,
          lastUpdateTime: new Date(timeUpdated).getTime(),
          lastCheckTime: Date.now(),
          lastScheduledCheckTime: Date.now(),
        };
      }
    });

    return data;
  }

  static #createNotInitializedError() {
    return new Error('Filter version data is not initialized');
  }
}

export const filterVersionModel = new FilterVersionModel(SettingOption.FiltersVersion, settingsModel);
