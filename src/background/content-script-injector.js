import { getHostname } from 'tldts';
import browser from 'webextension-polyfill';

import { getErrorMessage } from '@adguard/logger';

import { isHttpRequest } from 'tswebextension';

import { executeScript } from 'scripting-controller';

import { UserAgent } from '../common/user-agent';
import { logger } from '../common/logger';
import { DOCUMENT_START_OUTPUT } from '../../constants';

import { CONTENT_SCRIPT_INJECTION_FLAG } from './storage-keys';
import { TabsApi } from './browser-api/tabs';
import { browserModel } from './models';
import { createPromiseWithTimeout } from './utils';

export class ContentScriptInjector {
  static #INJECTED_KEY = 'content-script-injected';

  static #INJECTION_LIMIT_MS = 1000;

  static #contentScripts = [
    ContentScriptInjector.#createContentScriptUrl(DOCUMENT_START_OUTPUT),
  ];

  static #jsInjectRestrictedHostnames = {
    chromium: ['chrome.google.com', 'chromewebstore.google.com'],
    firefox: [
      'accounts-static.cdn.mozilla.net',
      'accounts.firefox.com',
      'addons.cdn.mozilla.net',
      'addons.mozilla.org',
      'api.accounts.firefox.com',
      'content.cdn.mozilla.net',
      'discovery.addons.mozilla.org',
      'install.mozilla.org',
      'oauth.accounts.firefox.com',
      'profile.accounts.firefox.com',
      'support.mozilla.org',
      'sync.services.mozilla.com',
    ],
    edge: ['microsoftedge.microsoft.com'],
  };

  static async init() {
    // Check if content scripts were already injected after extension update
    const injectionFlag = await browserModel.get(CONTENT_SCRIPT_INJECTION_FLAG);
    if (Boolean(injectionFlag) === true) {
      logger.info(
        '[ext.ContentScriptInjector.init]: Content scripts already injected after extension update, skipping injection',
      );
      await browserModel.remove(CONTENT_SCRIPT_INJECTION_FLAG);
      return;
    }

    const tabs = await TabsApi.getAll();

    const tasks = [];

    tabs.forEach((tab) => {
      // Do not inject scripts into extension pages, browser internals and tabs without id
      if (typeof tab.id !== 'number' || !ContentScriptInjector.#canInjectJs(tab)) {
        return;
      }

      const { id } = tab;

      tasks.push(ContentScriptInjector.#inject(id, ContentScriptInjector.#contentScripts));
    });

    /**
     * Loading order is not matter,
     * because all content-scripts are independent and tabs have been already loaded
     */
    const promises = await Promise.allSettled(tasks);

    // Handles errors
    promises.forEach((promise) => {
      if (promise.status === 'rejected') {
        logger.error('Cannot inject scripts to tab due to: ', promise.reason);
      }
    });
  }

  static async #inject(tabId, files) {
    try {
      /**
       * This implementation uses Promise.race() to prevent content script injection
       * from freezing the application when Chrome drops tabs.
       */
      await createPromiseWithTimeout(
        executeScript(tabId, {
          allFrames: true,
          files,
        }),
        ContentScriptInjector.#INJECTION_LIMIT_MS,
        `Content script inject timeout because tab with id ${tabId} does not respond`,
      );
    } catch (error) {
      // re-throw error with custom message
      throw new Error(`Cannot inject ${files.join(', ')} to tab with id ${tabId}. Error: ${getErrorMessage(error)}`);
    }
  }

  static #createContentScriptUrl(output) {
    return `/${output}.js`;
  }

  static #canInjectJs(tab) {
    if (
      typeof tab.url !== 'string'
      || !isHttpRequest(tab.url)
      // Tabs with both 'unloaded' and 'loading' statuses can be frozen and thus should be skipped
      || tab.status !== 'complete'
      || tab.discarded
    ) {
      return false;
    }

    const hostname = getHostname(tab.url);

    if (!hostname) {
      return false;
    }

    const restricted = ContentScriptInjector.#jsInjectRestrictedHostnames;

    if (UserAgent.isChromium && restricted.chromium.includes(hostname)) {
      return false;
    }

    if (UserAgent.isFirefox && restricted.firefox.includes(hostname)) {
      return false;
    }

    if (UserAgent.isEdge && restricted.edge.includes(hostname)) {
      return false;
    }

    return true;
  }

  /**
   * Checks if session storage is available in the browser. If session storage
   * is available then we suppose that background (event page for firefox or
   * service worker for chromium) can die and we need to check if content
   * scripts were injected to exclude double injection.
   *
   * If session storage is not available (in MV2), we suppose that background
   * will not die and we don't need to check if content scripts were injected.
   */
  static isSessionStorageAvailable() {
    return browser.storage?.session !== undefined;
  }

  static async setInjected() {
    if (!ContentScriptInjector.isSessionStorageAvailable()) {
      return;
    }

    try {
      await browser.storage.session.set({ [ContentScriptInjector.#INJECTED_KEY]: true });
    } catch (e) {
      logger.error('Cannot set injected flag in session storage', e);
    }
  }

  /**
   * Checks if content scripts have been injected.
   * Uses session storage since it is faster than sending a message to the content script.
   * As of November 25, 2025, Firefox v132.0.2 takes 1 second to send a message,
   * whereas reading from the session storage takes only 1 ms.
   */
  static async isInjected() {
    if (!ContentScriptInjector.isSessionStorageAvailable()) {
      return false;
    }

    let isInjected = false;
    try {
      const result = await browser.storage.session.get(ContentScriptInjector.#INJECTED_KEY);
      isInjected = result[ContentScriptInjector.#INJECTED_KEY] === true;
    } catch (e) {
      logger.error('Cannot get injected flag from session storage', e);
    }

    return isInjected;
  }
}
