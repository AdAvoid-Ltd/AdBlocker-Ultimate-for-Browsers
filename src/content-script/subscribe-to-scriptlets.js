import { MessageType, sendMessage } from '../common/messages';

// Loaded on content script start to ensure the fastest load
export class SubscribeToScriptlets {
  static #removeListenerTimeoutMs = 1000;

  static #closeWindowEventName = 'adguard:scriptlet-close-window';

  static #subscribedToCloseWindowEventName = 'adguard:subscribed-to-close-window';

  /**
   * IMPORTANT! It is intentionally async so it can be called without await
   * to not slow down frames loading in Firefox.
   */
  static init() {
    SubscribeToScriptlets.#subscribeToCloseWindow();
  }

  /**
   * Subscribe to close-window scriptlet's event
   * window.close() usage is restricted in Chrome so we use tabs API to do that
   */
  static #subscribeToCloseWindow() {
    // Events may be passed differently in MV3
    window.addEventListener(SubscribeToScriptlets.#closeWindowEventName, SubscribeToScriptlets.#closeWindowHandler);

    setTimeout(() => {
      window.removeEventListener(
        SubscribeToScriptlets.#closeWindowEventName,
        SubscribeToScriptlets.#closeWindowHandler,
      );
    }, SubscribeToScriptlets.#removeListenerTimeoutMs);

    // Scriptlet is loaded first so we notify it that content script is ready
    dispatchEvent(new Event(SubscribeToScriptlets.#subscribedToCloseWindowEventName));
  }

  static #closeWindowHandler() {
    sendMessage({ type: MessageType.ScriptletCloseWindow });
  }
}
