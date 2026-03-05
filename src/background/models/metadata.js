import { SettingOption } from '../storage-keys.js';
import { LocaleUtils } from '../utils';

import { StringStorage } from './string-storage';
import { settingsModel } from './settings';

class MetadataModel extends StringStorage {
  getFilters() {
    if (!this.data) {
      throw MetadataModel.#createNotInitializedError();
    }

    return this.data.filters;
  }

  getFilter(filterId) {
    if (!this.data) {
      throw MetadataModel.#createNotInitializedError();
    }

    return this.data.filters.find((el) => el.filterId === filterId);
  }

  getGroups() {
    if (!this.data) {
      throw MetadataModel.#createNotInitializedError();
    }

    return this.data.groups;
  }

  getGroup(groupId) {
    if (!this.data) {
      throw MetadataModel.#createNotInitializedError();
    }

    return this.data.groups.find((el) => el.groupId === groupId);
  }

  getTags() {
    if (!this.data) {
      throw MetadataModel.#createNotInitializedError();
    }

    return this.data.tags;
  }

  getTag(tagId) {
    if (!this.data) {
      throw MetadataModel.#createNotInitializedError();
    }

    return this.data.tags.find((el) => el.tagId === tagId);
  }

  getDnrRulesetsVersion() {
    if (!this.data) {
      throw MetadataModel.#createNotInitializedError();
    }

    return this.data.version;
  }

  getDnrRulesetsBuildTimestampMs() {
    if (!this.data) {
      throw MetadataModel.#createNotInitializedError();
    }

    return this.data.versionTimestampMs;
  }

  getFilterIdsForLanguage(locale) {
    if (!locale) {
      return [];
    }

    return this.getFilters()
      .filter(({ languages }) => languages.length > 0 && LocaleUtils.find(languages, locale))
      .map(({ filterId }) => filterId);
  }

  static #createNotInitializedError() {
    return new Error('Metadata is not initialized');
  }
}

export const metadataModel = new MetadataModel(SettingOption.Metadata, settingsModel);
