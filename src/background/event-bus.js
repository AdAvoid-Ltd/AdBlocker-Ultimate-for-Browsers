import { logger } from '../common/logger';
import { EventType } from '../common/constants';

class EventBus {
  #nextId = 0;

  #validEventNames = {};

  #listeners = {};

  #listenerFilters = {};

  // Make accessible only constants without functions. They will be passed to content-page.
  events = EventType;

  constructor() {
    Object.entries(EventType).forEach(([key, value]) => {
      this[key] = value;
      this.#validEventNames[value] = key;
    });
  }

  on(events, listener) {
    if (typeof listener !== 'function') {
      throw new Error('Illegal listener');
    }
    const listenerId = this.#nextId + 1;
    this.#nextId = listenerId;
    this.#listeners[listenerId] = listener;
    this.#listenerFilters[listenerId] = events;
    return listenerId;
  }

  onAll(listener) {
    if (typeof listener !== 'function') {
      throw new Error('Illegal listener');
    }
    const listenerId = this.#nextId + 1;
    this.#nextId = listenerId;
    this.#listeners[listenerId] = listener;
    return listenerId;
  }

  off(listenerId) {
    delete this.#listeners[listenerId];
    delete this.#listenerFilters[listenerId];
  }

  emit(...args) {
    const [event] = args;
    if (!event || !(event in this.#validEventNames)) {
      throw new Error(`Illegal event: ${event}`);
    }

    Object.entries(this.#listeners).forEach(([listenerId, listener]) => {
      const events = this.#listenerFilters[Number(listenerId)];
      if (events && events.length > 0 && events.indexOf(event) < 0) {
        return;
      }
      try {
        listener.apply(listener, args);
      } catch (ex) {
        logger.error(`Error invoking listener for ${event} cause:`, ex);
      }
    });
  }
}

export const eventBus = new EventBus();
