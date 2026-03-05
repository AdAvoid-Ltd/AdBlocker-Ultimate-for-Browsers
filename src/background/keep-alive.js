import browser from 'webextension-polyfill';

import { executeScript } from 'scripting-controller';

import { logger } from '../common/logger';
import { UserAgent } from '../common/user-agent';
import { KEEP_ALIVE_PORT_NAME } from '../common/constants';
import { Messenger } from '../pages/services/messenger';

import { isHttpRequest } from './tswebextension';

const keepAliveCode = `
(() => {
    // used to avoid multiple connections from the same tab
    if (window.keepAlive) {
        return;
    }

    function connect() {
        browser.runtime.connect({ name: '${KEEP_ALIVE_PORT_NAME}' })
            .onDisconnect
            .addListener(() => {
                connect();
            });
    }

    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            // The page is restored from BFCache, set up a new connection.
            connect();
        }
    });

    connect();

    window.keepAlive = true;
})();
`;

function keepAliveFunc() {
  /**
   * We avoid adding a global type declaration to prevent confusion with the service worker,
   * as this will be used only on this page.
   */

  if (window.keepAlive) {
    return;
  }

  // Connects to the background script and reconnects if disconnected.
  function connect() {
    /**
     * not in the constant, because it is injected into the page, and it will lose the context of this variable
     * @see KEEP_ALIVE_PORT_NAME
     */
    chrome.runtime.connect({ name: 'keep-alive' }).onDisconnect.addListener(() => {
      connect();
    });
  }

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      // The page is restored from BFCache, set up a new connection.
      connect();
    }
  });

  connect();

  /**
   * We avoid adding a global type declaration to prevent confusion with the service worker,
   * as this will be used only on this page.
   */

  window.keepAlive = true;
}

/**
 * Class responsible for keeping the Chrome service worker or Firefox service worker page alive.
 * It connects to a port, with its handler located in ConnectionHandler.
 * This is used to prevent ad blinking caused by the termination of the service worker or event page.
 * This implementation is temporary and will be removed once a faster engine initialization mechanism is in place.
 */
export class KeepAlive {
  static init() {
    if (UserAgent.isFirefox || __IS_MV3__) {
      // When tab updates, we try to inject the content script to it.
      browser.tabs.onUpdated.addListener(KeepAlive.#onUpdate);
      KeepAlive.#keepServiceWorkerAlive();

      KeepAlive.executeScriptOnTab();
    }
  }

  /**
   * Called after the background page has reloaded.
   * It is necessary for event page, which can reload,
   * but options page subscribes to events only once.
   * This function notifies all listeners to update by sending an UpdateListeners message.
   */
  static async resyncEventSubscriptions() {
    try {
      await Messenger.updateListeners();
    } catch (e) {
      /**
       * This error occurs if there are no pages able to handle this listener.
       * It could happen if the background page reloaded when the options page was not open.
       */
      logger.debug('[ext.KeepAlive.resyncEventSubscriptions]: cannot update listeners:', e);
    }
  }

  static async executeScriptOnTab(tabs = null) {
    tabs = tabs || (await browser.tabs.query({ url: '*://*/*' }));

    for (const tab of tabs) {
      try {
        if (__IS_MV3__) {

          await executeScript(tab.id, { func: keepAliveFunc });
        } else {

          await executeScript(tab.id, { code: keepAliveCode });
        }
        return;
      } catch (e) {
        // use debug level to avoid extension errors when blocking pages is loading
        logger.debug(`[ext.KeepAlive.executeScriptOnTab]: Tab ${tab.id} error: ${e}`);
      }
    }
  }

  /**
   * Prolongs the service worker's lifespan by periodically invoking a runtime API.
   *
   * Note:
   * - This is not an official solution and may be removed or become unsupported in the future.
   * - It does not restart the service worker if it has already been terminated.
   *   For that, a port connect/disconnect workaround is used.
   */
  static #keepServiceWorkerAlive() {
    /**
     * Usually a service worker dies after 30 seconds,
     * using 20 seconds should be enough to keep it alive.
     */
    const KEEP_ALIVE_INTERVAL_MS = 20000;
    setInterval(async () => {
      await browser.runtime.getPlatformInfo();
    }, KEEP_ALIVE_INTERVAL_MS);
  }

  static #onUpdate = (tabId, info, tab) => {
    if (info.url && isHttpRequest(info.url)) {
      KeepAlive.executeScriptOnTab([tab]);
    }
  };
}
