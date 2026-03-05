import { SettingOption } from '../../storage-keys.js';
import { UserAgent } from '../../../common/user-agent';

export const DEFAULT_FILTERS_UPDATE_PERIOD = -1;

const DEFAULT_ALLOWLIST = [];

export const defaultSettings = {
  [SettingOption.AutoDetectFilters]: !(!(UserAgent.isWindows || UserAgent.isMacOs) || UserAgent.isEdge),
  [SettingOption.FiltersUpdatePeriod]: DEFAULT_FILTERS_UPDATE_PERIOD,
  [SettingOption.ShowPageStats]: true,
  [SettingOption.ShowContextMenu]: true,
  [SettingOption.AllowlistDomains]: JSON.stringify(DEFAULT_ALLOWLIST),
};
