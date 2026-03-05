import browser from 'webextension-polyfill';

import { Prefs } from '../prefs';

import { WindowsApi } from './windows';

export class TabsApi {
  static async findOne(queryInfo) {
    const [tab] = await browser.tabs.query(queryInfo);

    return tab;
  }

  static async focus(tab) {
    const { id, windowId } = tab;

    await browser.tabs.update(id, { active: true });

    await WindowsApi.update(windowId, { focused: true });
  }

  static async getAll() {
    return browser.tabs.query({});
  }

  static async getActive() {
    return TabsApi.findOne({
      currentWindow: true,
      active: true,
    });
  }

  static isExtensionTab(tab) {
    const { url } = tab;

    if (!url) {
      return false;
    }

    try {
      const parsed = new URL(url);

      const { protocol, hostname } = parsed;

      const scheme = Prefs.baseUrl.split('://')[0];

      if (!scheme) {
        return false;
      }

      return protocol.indexOf(scheme) > -1 && hostname === Prefs.id;
    } catch (e) {
      return false;
    }
  }

  static async reload(id) {
    await browser.tabs.reload(id, {
      bypassCache: true,
    });
  }
}
