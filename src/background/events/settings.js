class SettingsEvents {
  #listenersMap = new Map();

  addListener(event, listener) {
    if (this.#listenersMap.has(event)) {
      throw new Error(`${event} listener has already been registered`);
    }

    this.#listenersMap.set(event, listener);
  }

  async publishEvent(event, value) {
    const listener = this.#listenersMap.get(event);
    if (listener) {
      return Promise.resolve(listener(value));
    }
  }

  removeListeners() {
    this.#listenersMap.clear();
  }
}

export const settingsEvents = new SettingsEvents();
