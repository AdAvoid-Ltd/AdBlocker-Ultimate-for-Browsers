import { FilterUpdateService } from '../filters/update';
import { browserModel } from '../../models';
import { isNumber } from '../../utils';
import { logger } from '../../../common/logger';
import { UPDATE_CHECK_TIME_KEY } from '../../storage-keys';

class FilterUpdateController {
  static CHECK_PERIOD_MS = 1000 * 60 * 5; // 5 min

  static FILTER_UPDATE_PERIOD_MS = 1000 * 60 * 60; // 1 hour

  schedulerTimerId;

  constructor() {
    this.update = this.update.bind(this);
  }

  async init() {
    await this.update();
  }

  /**
   * Checks every CHECK_PERIOD_MS period whether the enabled filters
   * should be updated with setTimeout which saved to schedulerTimerId.
   */
  async update() {
    self.clearTimeout(this.schedulerTimerId);

    const prevCheckTimeMs = await browserModel.get(UPDATE_CHECK_TIME_KEY);

    /**
     * Check updates if prevCheckTimeMs is not set or
     * if it is set and last check was more than CHECK_PERIOD_MS ago.
     */
    const shouldCheckUpdates = !prevCheckTimeMs
      || (isNumber(prevCheckTimeMs) && Date.now() - prevCheckTimeMs > FilterUpdateController.FILTER_UPDATE_PERIOD_MS);

    if (shouldCheckUpdates) {
      try {
        await FilterUpdateService.autoUpdateFilters();
      } catch (e) {
        logger.error('[ext.FilterUpdateController.update]: an error occurred during filters update:', e);
      }
      /**
       * Saving current time to storage is required in the cases
       * when background page is often unloaded,
       * for example, in the cases of service workers.
       */
      await browserModel.set(UPDATE_CHECK_TIME_KEY, Date.now());
    }

    this.schedulerTimerId = self.setTimeout(async () => {
      await this.update();
    }, FilterUpdateController.CHECK_PERIOD_MS);
  }
}

export const filterUpdateController = new FilterUpdateController();
