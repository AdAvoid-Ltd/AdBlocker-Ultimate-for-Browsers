import browser from 'webextension-polyfill';

import { logger } from '../../common/logger';
import {
  SETTINGS_KEY,
  APP_VERSION_KEY,
  INSTALLED_ON_KEY,
  LAST_UPDATE_KEY,
} from '../storage-keys';
import { UserAgent } from '../../common/user-agent';
import { browserModel } from '../models';

import { buildUrl, Endpoint } from './ui/url-builder';
import { defaultSettings } from './settings/defaults';

export class InstallService {
  static async install({ skipSettingsInit = false } = {}) {
    if (skipSettingsInit) {
      logger.info('[ext.InstallService.install]: Skipping default settings init (migration already applied)');
    } else {
      await browserModel.set(SETTINGS_KEY, defaultSettings);
    }

    const now = Date.now();
    await browserModel.set(INSTALLED_ON_KEY, now);
    await browserModel.set(LAST_UPDATE_KEY, now);

    const manifest = browser.runtime.getManifest();
    const params = {
      version: manifest.version,
      browser: UserAgent.browserName,
    };
    await browser.tabs.create({ url: buildUrl(Endpoint.Installed, params) });
  }

  static async postSuccessInstall(currentAppVersion) {
    await browserModel.set(APP_VERSION_KEY, currentAppVersion);
  }

  // For rate-us eligibility.
  static async isDayAfterInstall() {
    const installedOn = await browserModel.get(INSTALLED_ON_KEY);
    if (!installedOn) {
      return false;
    }
    const installDate = new Date(installedOn);
    const dayAfterInstall = new Date(installDate);
    dayAfterInstall.setDate(installDate.getDate() + 1);
    const today = new Date();
    return today.toDateString() === dayAfterInstall.toDateString();
  }

  static async isPinnedToToolbar() {
    try {
      if (browser.action && typeof browser.action.getUserSettings === 'function') {
        const userSettings = await browser.action.getUserSettings();
        return userSettings?.isOnToolbar ?? false;
      }
    } catch (e) {
      // API not available or failed
    }
    return false;
  }
}
