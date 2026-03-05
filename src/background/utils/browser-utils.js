import { Prefs } from '../prefs';
import { logger } from '../../common/logger';
import { CHROME_EXTENSIONS_SETTINGS_URL } from '../../common/constants';

import { Version } from './version';

export class BrowserUtils {
  static getExtensionParams() {
    const locale = encodeURIComponent(Prefs.language);
    const version = encodeURIComponent(Prefs.version);
    const id = encodeURIComponent(Prefs.id);

    const params = [];
    params.push(`v=${version}`);
    params.push(`lang=${locale}`);
    params.push(`id=${id}`);
    return params;
  }

  static getNavigatorLanguages(limit) {
    let languages = [];
    // https://developer.mozilla.org/ru/docs/Web/API/NavigatorLanguage/languages
    if (Array.isArray(navigator.languages)) {
      // get all languages if 'limit' is not specified
      const langLimit = limit || navigator.languages.length;
      languages = navigator.languages.slice(0, langLimit);
    } else if (navigator.language) {
      languages.push(navigator.language); // .language is first in .languages
    }
    return languages;
  }

  static isSemver(version) {
    try {

      new Version(version);
    } catch (e) {
      logger.debug(`Can not parse version: "${version}", error: `, e);
      return false;
    }
    return true;
  }

  static isGreaterOrEqualsVersion(leftVersion, rightVersion) {
    const left = new Version(leftVersion);
    const right = new Version(rightVersion);
    return left.compare(right) >= 0;
  }

  static getExtensionDetailsUrl() {
    const url = new URL(CHROME_EXTENSIONS_SETTINGS_URL);
    url.searchParams.set('id', Prefs.id);
    return url.toString();
  }
}
