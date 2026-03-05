import browser from 'webextension-polyfill';

import { getDomain, isHttpRequest } from '../tswebextension';
import { SettingOption } from '../storage-keys.js';
import {
  groupStateModel,
  metadataModel,
  settingsModel,
} from '../models';
import { engine } from '../engine';
import { AntibannerGroupsId } from '../../common/constants';

import { toasts } from './ui';
import { FiltersService } from './filters/main';
import { CommonFilterService } from './filters/common';
import { DesktopAppService } from './desktop-app';

class LocaleDetect {
  static SUCCESS_HIT_COUNT = 3;

  static MAX_HISTORY_LENGTH = 10;

  static domainToLanguagesMap = {
    // Russian
    ru: 'ru',
    by: 'ru',
    kz: 'ru',
    uz: 'ru',
    kg: 'ru',
    // Ukrainian
    ua: 'uk',
    // English
    com: 'en',
    au: 'en',
    uk: 'en',
    nz: 'en',
    // German
    de: 'de',
    at: 'de',
    li: 'de',
    // Japanese
    jp: 'ja',
    // Dutch
    nl: 'nl',
    // French
    fr: 'fr',
    mc: 'fr',
    ht: 'fr',
    // Spanish
    es: 'es',
    mx: 'es',
    ar: 'es',
    cl: 'es',
    uy: 'es',
    pe: 'es',
    ve: 'es',
    ec: 'es',
    bo: 'es',
    py: 'es',
    pa: 'es',
    cr: 'es',
    ni: 'es',
    hn: 'es',
    gt: 'es',
    sv: 'es',
    do: 'es',
    pr: 'es',
    cat: 'es',
    // Italian
    it: 'it',
    sm: 'it',
    // Portuguese
    pt: 'pt',
    br: 'pt',
    ao: 'pt',
    mz: 'pt',
    cv: 'pt',
    // Polish
    pl: 'pl',
    // Czech
    cz: 'cs',
    // Bulgarian
    bg: 'bg',
    // Lithuanian
    lt: 'lt',
    // Latvian
    lv: 'lv',
    // Arabic
    eg: 'ar',
    dz: 'ar',
    kw: 'ar',
    ae: 'ar',
    ma: 'ar',
    jo: 'ar',
    lb: 'ar',
    bh: 'ar',
    qa: 'ar',
    iq: 'ar',
    tn: 'ar',
    // Slovakian
    sk: 'sk',
    // Romanian
    ro: 'ro',
    md: 'ro',
    // Suomi
    fi: 'fi',
    // Icelandic
    is: 'is',
    // Norwegian
    no: 'no',
    // Greek
    gr: 'el',
    // Hungarian
    hu: 'hu',
    // Hebrew
    il: 'he',
    // Chinese
    cn: 'zh',
    tw: 'zh',
    // Indonesian
    id: 'id',
    // Malaysian
    my: 'id',
    // Turkish
    tr: 'tr',
    // Serbian
    sr: 'sr',
    ba: 'sr',
    // Croatian
    hr: 'hr',
    // Hindi
    in: 'hi',
    // Bangla:
    bd: 'hi',
    // Sri Lanka
    lk: 'hi',
    // Nepal:
    np: 'hi',
    // Estonian:
    ee: 'et',
    // Persian:
    ir: 'fa',
    // Tajik:
    tj: 'fa',
    // Korean:
    kr: 'ko',
    // Danish:
    dk: 'da',
    // Faroese:
    fo: 'fo',
    // Vietnamese:
    vn: 'vi',
    // Thai:
    th: 'th',
    // Swedish:
    se: 'sv',
    ax: 'sv',
  };

  #browsingLanguages = [];

  /**
   * Because listener for tab updates cannot be paused during filter loading,
   * we should save status of loading for each language to exclude double loading.
   */
  #loadingLanguagesMutex = {};

  constructor() {
    this.onTabUpdated = this.onTabUpdated.bind(this);
  }

  init() {
    browser.tabs.onUpdated.addListener(this.onTabUpdated);
  }

  async onTabUpdated(tabId, changeInfo, tab) {
    if (tab.status === 'complete' && !__IS_MV3__) {
      await this.#detectTabLanguage(tab);
    }
  }

  async #detectTabLanguage(tab) {
    const autoDetectEnabled = settingsModel.get(SettingOption.AutoDetectFilters);
    const isDesktopAppActive = DesktopAppService.isActive();

    if (
      !autoDetectEnabled
      || isDesktopAppActive
      || !tab.url
      // Check language only for http://... tabs
      || !isHttpRequest(tab.url)
    ) {
      return;
    }

    if (tab.id && browser.tabs && browser.tabs.detectLanguage) {
      // https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/tabs/detectLanguage
      try {
        const language = await browser.tabs.detectLanguage(tab.id);
        this.#detectLanguage(language);
      } catch (e) {
        // do nothing
      }
      return;
    }

    /**
     * Detecting language by top-level domain if extension API language detection is unavailable
     * Ignore hostnames which length is less or equal to 8
     */
    const host = getDomain(tab.url);
    if (host && host.length > 8) {
      const parts = host.split('.');
      const tld = parts.at(-1);

      if (!tld) {
        return;
      }

      const lang = LocaleDetect.domainToLanguagesMap[tld];

      if (!lang) {
        return;
      }

      await this.#detectLanguage(lang);
    }
  }

  /**
   * Stores language in the special array containing languages of the last visited pages.
   * If user has visited enough pages with a specified language we call special callback
   * to auto-enable filter for this language.
   */
  async #detectLanguage(language) {
    /**
     * For an unknown language "und" will be returned
     * https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/tabs/detectLanguage.
     */
    if (!language || language === 'und') {
      return;
    }

    this.#browsingLanguages.push({
      language,
      time: Date.now(),
    });

    if (this.#browsingLanguages.length > LocaleDetect.MAX_HISTORY_LENGTH) {
      this.#browsingLanguages.shift();
    }

    const history = this.#browsingLanguages.filter((h) => {
      return h.language === language;
    });

    if (history.length >= LocaleDetect.SUCCESS_HIT_COUNT && !this.#loadingLanguagesMutex[language]) {
      // Lock mutex to exclude double loading.
      this.#loadingLanguagesMutex[language] = true;

      const filterIds = metadataModel.getFilterIdsForLanguage(language);
      await LocaleDetect.#onFilterDetectedByLocale(filterIds);

      // Free mutex for language.
      delete this.#loadingLanguagesMutex[language];
    }
  }

  static async #onFilterDetectedByLocale(filterIds) {
    if (!filterIds || filterIds.length === 0) {
      return;
    }

    const disabledFiltersIds = filterIds.filter((filterId) => !FiltersService.isFilterEnabled(filterId));

    groupStateModel.enableGroups([AntibannerGroupsId.LanguageFiltersGroupId]);

    if (disabledFiltersIds.length === 0) {
      return;
    }

    const remote = !__IS_MV3__;
    await FiltersService.loadAndEnableFilters(disabledFiltersIds, remote);
    engine.debounceUpdate();

    const filters = [];

    disabledFiltersIds.forEach((filterId) => {
      const filter = CommonFilterService.getFilterMetadata(filterId);

      if (filter) {
        filters.push(filter);
      }
    });

    toasts.showFiltersEnabledAlertMessage(filters);
  }
}

export const localeDetect = new LocaleDetect();
