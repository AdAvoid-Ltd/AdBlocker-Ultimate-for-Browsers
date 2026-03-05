import browser from 'webextension-polyfill';

export class Prefs {
  static id = browser.runtime.id;

  static baseUrl = browser.runtime.getURL('');

  static version = browser.runtime.getManifest().version;

  static language = browser.i18n.getUILanguage();
}
