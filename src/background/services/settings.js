import { getErrorMessage } from '@adguard/logger';

import { logger } from '../../common/logger';
import { SettingOption } from '../storage-keys';
import { settingsModel, browserModel } from '../models';
import { SETTINGS_KEY } from '../storage-keys';
import { EventType } from '../../common/constants';
import { settingsEvents } from '../events';
import { eventBus } from '../event-bus';
import { Prefs } from '../prefs';
import { ASSISTANT_INJECT_OUTPUT, PAGE_BLOCKED_OUTPUT } from '../../../constants';

import { defaultSettings } from './settings/defaults';

export class SettingsService {
  static async init() {
    try {
      const data = await browserModel.get(SETTINGS_KEY);
      const settings = data || {};
      settingsModel.setCache(settings);
    } catch (e) {
      logger.error('[ext.SettingsService.init]: cannot init settings from storage:', getErrorMessage(e));
      logger.info('[ext.SettingsService.init]: reverting settings to default values');
      const settings = { ...defaultSettings };

      // Update settings in the cache and in the storage
      settingsModel.setData(settings);
    }
  }

  static async setSetting(key, value) {
    settingsModel.set(key, value);

    await settingsEvents.publishEvent(key, value);

    // legacy event mediator for frontend
    eventBus.emit(EventType.SettingUpdated, {
      propertyName: key,
      propertyValue: value,
    });
  }

  static getSetting(key) {
    return settingsModel.get(key);
  }

  static getData() {
    return {
      names: SettingOption,
      defaultValues: defaultSettings,
      values: settingsModel.getData(),
    };
  }

  static getTsWebExtConfiguration() {
    // pass the locale explicitly as a part of the url
    const documentBlockingPageUrl = `${Prefs.baseUrl}${PAGE_BLOCKED_OUTPUT}.html?_locale=${Prefs.language}`;

    return {
      assistantUrl: `/${ASSISTANT_INJECT_OUTPUT}.js`,
      documentBlockingPageUrl,
      ...(__IS_MV3__ && {
        gpcScriptUrl: '',
        hideDocumentReferrerScriptUrl: '/hide-document-referrer.js',
      }),
      collectStats: false,
      debugScriptlets: false,
      allowlistEnabled: true,
      allowlistInverted: false,
      stealthModeEnabled: false,
      filteringEnabled: true,
      stealth: {
        blockChromeClientData: false,
        hideReferrer: false,
        hideSearchQueries: false,
        sendDoNotTrack: false,
        blockWebRTC: false,
        selfDestructThirdPartyCookies: false,
        selfDestructThirdPartyCookiesTime: 0,
        selfDestructFirstPartyCookies: false,
        selfDestructFirstPartyCookiesTime: 0,
      },
    };
  }
}
