import { FILTER_IDS_MV3 } from '../../../../constants';
import { logger } from '../../../common/logger';

/**
 * Network settings for MV3.
 *
 * In MV3, filters and declarative rulesets are bundled with the extension
 * and loaded from local resources. Remote filter downloading is not supported
 * due to Chrome Web Store policies.
 */
export class NetworkSettings {
  localFiltersFolder = 'filters';

  /**
   * List of filter IDs that have local copies bundled with the extension.
   * In MV3, all filters are pre-bundled.
   */
  localFilterIds = FILTER_IDS_MV3;

  async init() {
    logger.info('[ext.NetworkSettings.init]: MV3 network settings initialized');
  }
}
