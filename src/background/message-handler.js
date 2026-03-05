import { MESSAGE_HANDLER_NAME } from '@adguard/tswebextension/mv3';

import { APP_MESSAGE_HANDLER_NAME, MessageHandler } from '../common/messages';
import { logger } from '../common/logger';

import { engine } from './engine';

class BackgroundMessageHandler extends MessageHandler {
  handleMessage(message, sender) {
    if (message.handlerName === MESSAGE_HANDLER_NAME) {
      return engine.handleMessage(message, sender);
    }

    if (message.handlerName === APP_MESSAGE_HANDLER_NAME) {
      // Check type
      if (!BackgroundMessageHandler.isValidMessageType(message)) {
        logger.error('[ext.BackgroundMessageHandler.handleMessage]: invalid message:', message);
        return;
      }

      const listener = this.listeners.get(message.type);
      if (!listener) {
        return;
      }

      const fn = async () => {
        try {
          return await listener(message, sender);
        } catch (e) {
          logger.error(
            '[ext.BackgroundMessageHandler.handleMessage]: an error occurred while handling message:',
            message,
            'error:',
            e,
          );

          throw e;
        }
      };
      return fn();
    }
  }
}

export const messageHandler = new BackgroundMessageHandler();
