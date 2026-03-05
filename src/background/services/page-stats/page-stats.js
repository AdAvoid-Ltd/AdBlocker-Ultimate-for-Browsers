import { getErrorMessage } from '@adguard/logger';

import { logger } from '../../../common/logger';
import { pageStatsModel } from '../../models';

export class PageStatsService {
  static async init() {
    try {
      const storageData = await pageStatsModel.read();

      if (typeof storageData === 'string') {
        const data = JSON.parse(storageData);
        pageStatsModel.setCache(data);
      } else {
        pageStatsModel.setData({ totalBlocked: 0 });
      }
    } catch (e) {
      logger.warn(
        `[ext.PageStatsService.init]: cannot parse data from "${pageStatsModel.key}" storage, set default states. Origin error:`,
        getErrorMessage(e),
      );
      pageStatsModel.setData({ totalBlocked: 0 });
    }
  }

  static getTotalBlocked() {
    return pageStatsModel.getTotalBlocked() || 0;
  }

  static incrementTotalBlocked(value) {
    let totalBlocked = PageStatsService.getTotalBlocked();

    totalBlocked += value;

    pageStatsModel.setTotalBlocked(totalBlocked);
    return totalBlocked;
  }
}
