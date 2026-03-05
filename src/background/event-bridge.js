import browser from 'webextension-polyfill';

import { MessageType } from '../common/messages';

import { eventBus } from './event-bus';
import { messageHandler } from './message-handler';

class EventBridgeController {
  #subscriberSenders = new Map();

  constructor() {
    this.handleSubscribe = this.handleSubscribe.bind(this);
    this.handleUnsubscribe = this.handleUnsubscribe.bind(this);
  }

  init() {
    messageHandler.addListener(MessageType.CreateEventListener, this.handleSubscribe);
    messageHandler.addListener(MessageType.RemoveListener, this.handleUnsubscribe);
  }

  handleSubscribe(message, sender) {
    const { events } = message.data;

    const listenerId = eventBus.on(events, (...data) => {
      const sender = this.#subscriberSenders.get(listenerId);
      if (!sender) {
        return;
      }

      const message = {
        type: MessageType.NotifyListeners,
        data,
      };

      // sender.tab is only present for content scripts
      if (sender.tab && sender.tab.id) {
        browser.tabs.sendMessage(sender.tab.id, message);
      } else {
        /**
         * for extension pages, e.g. popup or options, sender.tab is undefined,
         * so runtime messaging is used
         */
        browser.runtime.sendMessage(message);
      }
    });

    this.#subscriberSenders.set(listenerId, sender);
    return listenerId;
  }

  handleUnsubscribe(message) {
    const { listenerId } = message.data;

    eventBus.off(listenerId);
    this.#subscriberSenders.delete(listenerId);
  }
}

export const eventBridgeController = new EventBridgeController();
