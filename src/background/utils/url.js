export class UrlUtils {
  static getUpperLevelDomain(domain) {
    const parts = domain.split('.');
    parts.shift();

    return parts.join('.');
  }
}
