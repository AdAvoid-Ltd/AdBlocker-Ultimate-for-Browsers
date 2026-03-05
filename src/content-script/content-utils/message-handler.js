import { MessageType } from '@adguard/tswebextension';

import { MessageHandler } from '../../common/messages/message-handler';
import { logger } from '../../common/logger';

class ContentScriptMessageHandler extends MessageHandler {
  /**
   * For these messages we have separate handlers in the content script,
   * provided from tswebextension.
   */
  static #ExcludedAssistantMessages = new Set([MessageType.InitAssistant, MessageType.CloseAssistant]);

  // Checks if the message is internal assistant message.
  static #isInternalAssistantMessage(message) {
    return ContentScriptMessageHandler.#ExcludedAssistantMessages.has(message.type);
  }

  handleMessage(message, sender) {
    // Check type.
    if (!ContentScriptMessageHandler.isValidMessageType(message)) {
      // Do not print errors for internal assistant messages.
      if (!ContentScriptMessageHandler.#isInternalAssistantMessage(message)) {
        logger.error('[ext.ContentScriptMessageHandler.handleMessage]: invalid message:', message);
      }
      return;
    }

    const listener = this.listeners.get(message.type);

    if (listener) {
      return Promise.resolve(listener(message, sender));
    }
  }
}

export const messageHandler = new ContentScriptMessageHandler();
