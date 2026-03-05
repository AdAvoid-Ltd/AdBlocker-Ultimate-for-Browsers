import { AntiBannerFiltersId } from '../../common/constants';
import { SettingOption } from '../storage-keys.js';

import { StringStorage } from './string-storage';
import { settingsModel } from './settings';

export class FilterStateModel extends StringStorage {
  // This filters have own complex state management
  static #unsupportedFiltersIds = [AntiBannerFiltersId.AllowlistFilterId, AntiBannerFiltersId.UserFilterId];

  static #defaultState = {
    enabled: false,
    installed: false,
    loaded: false,
  };

  get(filterId) {
    if (!this.data) {
      throw FilterStateModel.#createNotInitializedError();
    }

    return this.data[filterId];
  }

  set(filterId, state) {
    if (!this.data) {
      throw FilterStateModel.#createNotInitializedError();
    }

    this.data[filterId] = state;

    this.save();
  }

  delete(filterId) {
    if (!this.data) {
      throw FilterStateModel.#createNotInitializedError();
    }

    delete this.data[filterId];

    this.save();
  }

  getEnabledFilters() {
    if (!this.data) {
      throw FilterStateModel.#createNotInitializedError();
    }

    return Object.entries(this.data)
      .filter(([, state]) => state.enabled)
      .map(([id]) => Number(id));
  }

  getInstalledFilters() {
    if (!this.data) {
      throw FilterStateModel.#createNotInitializedError();
    }

    return Object.entries(this.data)
      .filter(([, state]) => state.installed)
      .map(([id]) => Number(id));
  }

  getAllFilters() {
    if (!this.data) {
      throw FilterStateModel.createNotInitializedError();
    }

    return Object.keys(this.data).map((id) => Number(id));
  }

  enableFilters(filterIds) {
    if (!this.data) {
      throw FilterStateModel.#createNotInitializedError();
    }

    for (let i = 0; i < filterIds.length; i += 1) {
      const filterId = filterIds[i];

      if (!filterId) {
        continue;
      }

      const data = this.data[filterId];

      if (data) {
        data.enabled = true;
      }
    }

    this.save();
  }

  disableFilters(filtersIds) {
    if (!this.data) {
      throw FilterStateModel.#createNotInitializedError();
    }
    for (let i = 0; i < filtersIds.length; i += 1) {
      const filterId = filtersIds[i];

      if (!filterId) {
        continue;
      }

      const data = this.data[filterId];

      if (data) {
        data.enabled = false;
      }
    }

    this.save();
  }

  static applyMetadata(states, metadata) {
    const { filters } = metadata;
    /**
     * Don't create filter state context for allowlist and user rules lists
     * Their state is controlled by separate modules.
     */
    const supportedFiltersMetadata = filters.filter(({ filterId }) => {
      return !FilterStateModel.#unsupportedFiltersIds.includes(filterId);
    });

    supportedFiltersMetadata.forEach(({ filterId }) => {
      if (!states[filterId]) {
        states[filterId] = { ...FilterStateModel.#defaultState };
      }
    });

    return states;
  }

  static #createNotInitializedError() {
    return new Error('Filter state data is not initialized');
  }
}

export const filterStateModel = new FilterStateModel(SettingOption.FiltersState, settingsModel);
