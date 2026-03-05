import browser from 'webextension-polyfill';

import { KEEP_ALIVE_PORT_NAME } from '../common/constants';
import { messageHasTypeAndDataFields, MessageType } from '../common/messages';
import { logger } from '../common/logger';

import { eventBus } from './event-bus';
import { KeepAlive } from './keep-alive';

export class ConnectionHandler {
  static init() {
    browser.runtime.onConnect.addListener(ConnectionHandler.#handleConnection);
  }

  static #handleConnection(port) {
    let listenerId;

    logger.debug(`[ext.ConnectionHandler.handleConnection]: port "${port.name}" connected`);

    ConnectionHandler.#onPortConnection(port);

    port.onMessage.addListener((message) => {
      if (!messageHasTypeAndDataFields(message)) {
        logger.error(
          '[ext.ConnectionHandler.handleConnection]: received message in ConnectionHandler.handleConnection has no type or data field:',
          message,
        );
        return;
      }

      if (message.type !== MessageType.AddLongLivedConnection) {
        return;
      }

      const {
        data: { events },
      } = message;

      listenerId = eventBus.on(events, async (...data) => {
        try {
          const message = {
            type: MessageType.NotifyListeners,
            data,
          };
          port.postMessage(message);
        } catch (e) {
          logger.error(
            '[ext.ConnectionHandler.handleConnection]: failed to send message to the port due to an error:',
            e,
          );
        }
      });
    });

    port.onDisconnect.addListener(() => {
      if (chrome.runtime.lastError) {
        logger.debug(
          '[ext.ConnectionHandler.handleConnection]: an error occurred on disconnect',
          browser.runtime.lastError,
        );
      }
      ConnectionHandler.#onPortDisconnection(port);
      eventBus.off(listenerId);
      logger.debug(`[ext.ConnectionHandler.handleConnection]: port "${port.name}" disconnected`);
    });
  }

  static #onPortConnection(port) {
    switch (true) {
      case port.name === KEEP_ALIVE_PORT_NAME: {
        // This handler exists solely to prevent errors from the default case.
        logger.debug('[ext.ConnectionHandler.onPortConnection]: connected to the port');
        break;
      }

      default: {
        throw new Error(`There is no such pages ${port.name}`);
      }
    }
  }

  static #onPortDisconnection(port) {
    switch (true) {
      case port.name === KEEP_ALIVE_PORT_NAME: {
        // when the port disconnects, we try to find a new tab to inject the content script
        KeepAlive.executeScriptOnTab();
        break;
      }

      default: {
        throw new Error(`There is no such pages ${port.name}`);
      }
    }
  }
}
