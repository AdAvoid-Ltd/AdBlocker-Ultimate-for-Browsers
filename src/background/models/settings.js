import { debounce } from 'lodash-es';

import { SETTINGS_KEY } from '../storage-keys';

import { browserModel } from './shared-instances';

class SettingsModel {
  static saveTimeoutMs = 100;

  #save = debounce(() => {
    browserModel.set(SETTINGS_KEY, this.#settings);
  }, SettingsModel.saveTimeoutMs);

  #settings;

  set(key, value) {
    if (!this.#settings) {
      throw SettingsModel.#createNotInitializedError();
    }

    this.#settings[key] = value;
    this.#save();
  }

  get(key) {
    if (!this.#settings) {
      throw SettingsModel.#createNotInitializedError();
    }

    return this.#settings[key];
  }

  remove(key) {
    if (!this.#settings) {
      throw SettingsModel.#createNotInitializedError();
    }

    if (this.#settings[key]) {
      delete this.#settings[key];
      this.#save();
    }
  }

  getData() {
    if (!this.#settings) {
      throw SettingsModel.#createNotInitializedError();
    }

    return this.#settings;
  }

  setCache(settings) {
    this.#settings = settings;
  }

  setData(settings) {
    this.setCache(settings);
    this.#save();
  }

  static #createNotInitializedError() {
    return new Error('settings is not initialized');
  }
}

export const settingsModel = new SettingsModel();
