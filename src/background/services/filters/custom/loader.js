import { network } from 'network-service';

import { createPromiseWithTimeout } from '../../../utils';

const emptyDownloadResult = {
  filter: [],
  rawFilter: '',
};

export class CustomFilterLoader {
  static #DOWNLOAD_LIMIT_MS = 3 * 1000;

  static async downloadRulesWithTimeout(url, rawFilter, force) {
    return createPromiseWithTimeout(
      network.downloadFilterRulesBySubscriptionUrl(url, rawFilter, force).then((val) => val || emptyDownloadResult),
      CustomFilterLoader.#DOWNLOAD_LIMIT_MS,
      'Fetch timeout is over',
    );
  }
}
