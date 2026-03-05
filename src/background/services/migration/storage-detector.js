import browser from 'webextension-polyfill';

import { SETTINGS_KEY } from '../../storage-keys';

import {
  StorageFormat,
  MV2_SETTINGS_KEY,
  MV3LegacyKey,
} from './constants';

/**
 * Detects storage format and returns both format and storage data.
 * This avoids a second storage read when migration is needed.
 * @returns {{ format: string, storage: object }}
 */
export async function detectStorageFormat() {
  const storage = await browser.storage.local.get(null);

  // Check for MV2 legacy FIRST (abu-settings wrapper)
  if (storage[MV2_SETTINGS_KEY]) {
    return { format: StorageFormat.MV2_LEGACY, storage };
  }

  // Check for MV3 legacy (enabled-filters array exists)
  // Must check BEFORE current format since both have 'settings' object
  if (
    storage[MV3LegacyKey.EnabledFilters]
    && Array.isArray(storage[MV3LegacyKey.EnabledFilters])
  ) {
    return { format: StorageFormat.MV3_LEGACY, storage };
  }

  // Check for current format (settings key with object structure)
  if (storage[SETTINGS_KEY] && typeof storage[SETTINGS_KEY] === 'object') {
    return { format: StorageFormat.CURRENT, storage: null };
  }

  return { format: StorageFormat.NONE, storage: null };
}
