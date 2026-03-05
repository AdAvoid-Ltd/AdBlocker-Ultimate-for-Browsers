import { SettingOption } from '../storage-keys.js';

import { StringStorage } from './string-storage';
import { settingsModel } from './settings';

class CustomFilterMetadataModel extends StringStorage {
  getById(filterId) {
    return this.getData().find((f) => f.filterId === filterId);
  }

  getByUrl(url) {
    return this.getData().find((f) => f.customUrl === url);
  }

  set(filter) {
    const data = this.getData().filter((f) => f.filterId !== filter.filterId);

    data.push(filter);

    this.setData(data);
  }

  remove(filterId) {
    const data = this.getData().filter((f) => f.filterId !== filterId);
    this.setData(data);
  }
}

export const customFilterMetadataModel = new CustomFilterMetadataModel(
  SettingOption.CustomFilters,
  settingsModel,
);
