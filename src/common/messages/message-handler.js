import browser from 'webextension-polyfill';

import { logger } from '../logger';

export const messageHasTypeField = (message) => {
  return typeof message === 'object' && message !== null && 'type' in message;
};

export const messageHasTypeAndDataFields = (message) => {
  return messageHasTypeField(message) && 'data' in message;
};

export class MessageHandler {
  listeners = new Map();

  constructor(customHandler) {
    this.handleMessage = this.handleMessage.bind(this);
    this.customHandler = customHandler;
  }

  static isValidMessageType(message) {
    return messageHasTypeField(message) && typeof message.type === 'string';
  }

  init() {
    browser.runtime.onMessage.addListener(this.handleMessage);
  }

  handleMessage(message, sender) {
    if (this.customHandler && typeof this.customHandler === 'function') {
      const res = this.customHandler(message, sender);

      if (res !== undefined) {
        return res;
      }
    }

    const listener = this.listeners.get(message.type);

    if (!listener) {
      return;
    }

    const fn = async () => {
      try {
        return await listener(message, sender);
      } catch (e) {
        logger.error('An error occurred while handling message:', message, 'error:', e);

        throw e;
      }
    };

    return fn();
  }

  addListener(type, listener) {
    if (this.listeners.has(type)) {
      throw new Error(`Message handler: ${type} listener has already been registered`);
    }

    this.listeners.set(type, listener);
  }

  removeListeners() {
    this.listeners.clear();
  }
}
