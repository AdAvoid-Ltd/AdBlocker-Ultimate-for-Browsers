import browser from 'webextension-polyfill';

import { UserAgent } from '../common/user-agent';

import { App } from './app';

let isInitialized = false;

const initWrapper = () => {
  if (isInitialized) {
    return;
  }

  App.init();
  isInitialized = true;
};

initWrapper();

/**
 * Initializes background services.
 * For Firefox, initialization happens both immediately and is registered for `onStartup` and `onInstalled` events
 * to ensure proper initialization in Firefox's non-persistent background page model.
 * This ensures the extension starts even when there are no open tabs.
 */
if (UserAgent.isFirefox) {
  browser.runtime.onStartup.addListener(initWrapper);
  browser.runtime.onInstalled.addListener(initWrapper);
}
