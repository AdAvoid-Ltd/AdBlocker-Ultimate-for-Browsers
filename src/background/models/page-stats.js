import { PAGE_STATISTIC_KEY } from '../storage-keys';

import { StringStorage } from './string-storage';
import { browserModel } from './shared-instances';

class PageStatsModel extends StringStorage {
  getTotalBlocked() {
    return this.getData().totalBlocked;
  }

  setTotalBlocked(value) {
    if (!this.data) {
      throw PageStatsModel.#createNotInitializedError();
    }

    this.data.totalBlocked = value;
    return this.save();
  }

  static #createNotInitializedError() {
    return new Error('Page stats is not initialized');
  }
}

export const pageStatsModel = new PageStatsModel(PAGE_STATISTIC_KEY, browserModel);
