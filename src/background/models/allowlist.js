import { SettingOption } from '../storage-keys.js';

import { StringStorage } from './string-storage';
import { settingsModel } from './settings';

export const allowlistDomainsModel = new StringStorage(SettingOption.AllowlistDomains, settingsModel);
