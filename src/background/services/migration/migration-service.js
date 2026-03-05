import { logger } from '../../../common/logger';

import { StorageFormat } from './constants';
import { detectStorageFormat } from './storage-detector';
import { MV2Migrator } from './mv2-migrator';
import { MV3Migrator } from './mv3-migrator';

export class MigrationService {
  static async migrateIfNeeded() {
    const { format, storage } = await detectStorageFormat();

    // Skip if already current format or fresh install
    if (format === StorageFormat.CURRENT || format === StorageFormat.NONE) {
      if (format === StorageFormat.CURRENT) {
        logger.debug('[ext.MigrationService.migrateIfNeeded]: Current format detected, skipping migration');
      }
      return { migrated: false, source: null };
    }

    try {
      // Migrators handle per-key errors internally and always complete
      if (format === StorageFormat.MV2_LEGACY) {
        await MV2Migrator.migrate(storage);
        return { migrated: true, source: 'mv2-legacy' };
      }

      if (format === StorageFormat.MV3_LEGACY) {
        await MV3Migrator.migrate(storage);
        return { migrated: true, source: 'mv3-legacy' };
      }
    } catch (error) {
      // Only for catastrophic failures (storage API down, etc.)
      logger.error('[ext.MigrationService.migrateIfNeeded]: Migration failed catastrophically:', error);
      return { migrated: false, source: null, error };
    }

    return { migrated: false, source: null };
  }
}
