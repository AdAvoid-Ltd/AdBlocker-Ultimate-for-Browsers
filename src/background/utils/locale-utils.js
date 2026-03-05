export class LocaleUtils {
  static find(locales, locale) {
    const normalizedLocales = locales.map((l) => LocaleUtils.normalizeLanguageCode(l));
    const lang = this.normalizeLanguageCode(locale);

    if (normalizedLocales.includes(lang)) {
      return lang;
    }

    const [localePart] = lang.split('_');

    if (localePart && normalizedLocales.includes(localePart)) {
      return localePart;
    }

    return null;
  }

  static normalizeLanguageCode(lang) {
    return lang.toLowerCase().replace(/-/g, '_');
  }
}
