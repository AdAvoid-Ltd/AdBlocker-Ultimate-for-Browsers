import { SettingOption } from '../storage-keys.js';

import { StringStorage } from './string-storage';
import { settingsModel } from './settings';

export class GroupStateModel extends StringStorage {
  // default group state
  static #defaultState = {
    enabled: false,
    touched: false,
  };

  get(groupId) {
    if (!this.data) {
      throw GroupStateModel.#createNotInitializedError();
    }

    return this.data[groupId];
  }

  getEnabledGroups() {
    if (!this.data) {
      throw GroupStateModel.#createNotInitializedError();
    }

    return Object.entries(this.data)
      .filter(([, state]) => state.enabled)
      .map(([id]) => Number(id));
  }

  enableGroups(groupIds, touched = true) {
    if (!this.data) {
      throw GroupStateModel.#createNotInitializedError();
    }

    for (let i = 0; i < groupIds.length; i += 1) {
      const groupId = groupIds[i];

      if (groupId !== undefined) {
        this.data[groupId] = {
          enabled: true,
          touched,
        };
      }
    }

    this.save();
  }

  disableGroups(groupIds, touched = true) {
    if (!this.data) {
      throw GroupStateModel.#createNotInitializedError();
    }

    for (let i = 0; i < groupIds.length; i += 1) {
      const groupId = groupIds[i];

      if (groupId !== undefined) {
        this.data[groupId] = {
          enabled: false,
          touched,
        };
      }
    }

    this.save();
  }

  static applyMetadata(states, metadata) {
    const { groups } = metadata;

    groups.forEach(({ groupId }) => {
      if (!states[groupId]) {
        states[groupId] = { ...GroupStateModel.#defaultState };
      }
    });

    return states;
  }

  static #createNotInitializedError() {
    return new Error('Group state data is not initialized');
  }
}

export const groupStateModel = new GroupStateModel(SettingOption.GroupsState, settingsModel);
