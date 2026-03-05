import browser from 'webextension-polyfill';

import {
  APP_VERSION_KEY,
  LAST_UPDATE_KEY,
  SHOW_RATE_US_POPUP_KEY,
} from '../../storage-keys';
import { buildUrl, Endpoint } from '../ui/url-builder';
import { UserAgent } from '../../../common/user-agent';
import { browserModel } from '../../models';
import { InstallService } from '../install';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export class UpdateService {
  static async update({ currentAppVersion }) {
    await browserModel.set(SHOW_RATE_US_POPUP_KEY, false);
    await browserModel.set(APP_VERSION_KEY, currentAppVersion);

    const lastUpdate = (await browserModel.get(LAST_UPDATE_KEY)) || 0;
    const now = Date.now();

    if (now - lastUpdate > NINETY_DAYS_MS) {
      const isPinned = await InstallService.isPinnedToToolbar();
      const params = {
        version: currentAppVersion,
        browser: UserAgent.browserName,
        p: isPinned ? '1' : '0',
      };
      await browser.tabs.create({ url: buildUrl(Endpoint.Updated, params) });
    }

    await browserModel.set(LAST_UPDATE_KEY, now);
  }
}
