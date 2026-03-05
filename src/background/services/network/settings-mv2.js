import { FILTER_IDS_MV2 } from '../../../../constants';
import { logger } from '../../../common/logger';

/**
 * Network settings for MV2.
 *
 * Filters are downloaded using `downloadUrl` from bundled metadata
 * (filters-metadata.json). The URL template system was removed as part of
 * the migration from competitor's filters to our own at filters.adavoid.org.
 */
export class NetworkSettings {
  localFiltersFolder = 'filters';

  /**
   * List of filter IDs that have local copies bundled with the extension.
   * Used by isFilterHasLocalCopy() to check if a fallback exists when
   * remote download fails.
   */
  localFilterIds = FILTER_IDS_MV2;

  async init() {
    logger.info('[ext.NetworkSettings.init]: MV2 network settings initialized');
  }
}
