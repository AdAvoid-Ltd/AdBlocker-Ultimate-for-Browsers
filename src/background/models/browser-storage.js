export class BrowserModel {
  #storage;

  constructor(storage = browser.storage.local) {
    this.#storage = storage;
  }

  async set(key, value) {
    await this.#storage.set({ [key]: value });
  }

  async get(key) {
    return this.#storage.get(key).then((data) => data[key]);
  }

  async remove(key) {
    await this.#storage.remove(key);
  }

  async setMultiple(data) {
    try {
      await this.#storage.set(data);
      return true;
    } catch (e) {
      return false;
    }
  }

  async removeMultiple(keys) {
    await this.#storage.remove(keys);
    return true;
  }

  async entries() {
    return this.#storage.get(null);
  }

  async keys() {
    return Object.keys(await this.entries());
  }

  async has(key) {
    return this.#storage.get(key).then((data) => key in data);
  }

  async clear() {
    await this.#storage.clear();
  }
}
