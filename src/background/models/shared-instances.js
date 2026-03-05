import browser from 'webextension-polyfill';

import { BrowserModel } from './browser-storage';
import { HybridModel } from './hybrid-storage';
import { IDBModel } from './idb-storage';

export const browserModel = new BrowserModel(browser.storage.local);

export const hybridModel = new HybridModel(browser.storage.local);

/**
 * Expose storage instances to the global scope for debugging purposes,
 * because it's hard to access them from the console in the background
 * page or impossible from Application tab -> IndexedDB (showing empty page).
 */
if (!IS_RELEASE) {

  self.hybridModel = hybridModel;

  self.HybridModel = HybridModel;

  self.IDBModel = IDBModel;
}
