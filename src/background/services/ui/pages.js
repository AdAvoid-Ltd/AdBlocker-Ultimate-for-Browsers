import browser from 'webextension-polyfill';

import { UserAgent } from '../../../common/user-agent';
import { BrowserUtils } from '../../utils';
import { CHROME_EXTENSIONS_SETTINGS_URL } from '../../../common/constants';
import { TabsApi } from '../../browser-api';
import { Prefs } from '../../prefs';
import { OPTIONS_OUTPUT } from '../../../../constants';

import {
  buildUrl,
  Endpoint,
  ExternalLinks,
} from './url-builder';

export class PagesService {
  static settingsUrl = PagesService.getExtensionPageUrl(OPTIONS_OUTPUT);

  static extensionStoreUrl = PagesService.#getExtensionStoreUrl();

  static async openSettingsPage() {
    let tab = await TabsApi.findOne({ url: `${PagesService.settingsUrl}*` });

    if (!tab) {
      tab = await browser.tabs.create({ url: PagesService.settingsUrl });
    }

    await TabsApi.focus(tab);
  }

  static getIssueReportUrl(siteUrl) {
    return buildUrl(Endpoint.Report, {
      ref: 'e',
      url: encodeURIComponent(siteUrl),
    });
  }

  static async openAbusePage(siteUrl) {
    const reportUrl = PagesService.getIssueReportUrl(siteUrl);

    await browser.tabs.create({ url: reportUrl });
  }

  static getExtensionPageUrl(filename, urlQuery) {
    let url = `${Prefs.baseUrl}${filename}.html`;

    if (typeof urlQuery === 'string') {
      url += urlQuery;
    }

    return url;
  }

  static async openExtensionStorePage() {
    await browser.tabs.create({ url: PagesService.extensionStoreUrl });
  }

  static async #openTabOnSettingsPage(url) {
    const tab = await TabsApi.findOne({ url: `${PagesService.settingsUrl}*` });

    if (!tab) {
      const newTab = await browser.tabs.create({ url });
      return newTab;
    }

    const updatedTab = await browser.tabs.update(tab.id, { url });
    return updatedTab;
  }

  static async openRulesLimitsPage() {
    const queryPart = '#OptionsPageSections.ruleLimits';

    const path = PagesService.getExtensionPageUrl(OPTIONS_OUTPUT, queryPart);

    const tab = await PagesService.#openTabOnSettingsPage(path);

    await TabsApi.focus(tab);
  }

  static async closePage(message, sender) {
    const tabId = sender.tab?.id;

    if (tabId) {
      await browser.tabs.remove(tabId);
    }
  }

  static #getExtensionStoreUrl() {
    if (UserAgent.isFirefox) {
      return ExternalLinks.FIREFOX_STORE;
    }
    if (UserAgent.isEdge) {
      return ExternalLinks.EDGE_STORE;
    }
    return ExternalLinks.CHROME_STORE;
  }

  static async openChromeExtensionsSettingsPage() {
    await browser.tabs.create({ url: CHROME_EXTENSIONS_SETTINGS_URL });
  }

  static async openExtensionDetailsPage() {
    await browser.tabs.create({ url: BrowserUtils.getExtensionDetailsUrl() });
  }
}
