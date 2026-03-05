import UAParser from 'ua-parser-js';
import browser from 'webextension-polyfill';

export class UserAgent {
  static ANDROID_OS_NAME = 'android';

  static parser = new UAParser(navigator.userAgent);

  static getBrowserName() {
    return UserAgent.isFirefoxMobile
      // Firefox mobile does not have own dedicated browser name
      ? 'Firefox Mobile'
      : UserAgent.parser.getBrowser().name;
  }

  static getSystemName() {
    return UserAgent.parser.getOS().name;
  }

  static async getIsAndroid() {
    try {
      const { os } = await browser.runtime.getPlatformInfo();
      return os === UserAgent.ANDROID_OS_NAME;
    } catch {
      // If runtime.getPlatformInfo() is not supported, we fallback to the UserAgent string.
      return UserAgent.isAndroid;
    }
  }

  static isTargetBrowser(browserName) {
    return UserAgent.parser.getBrowser().name === browserName;
  }

  static isTargetPlatform(platformName) {
    return UserAgent.getSystemName() === platformName;
  }

  static isTargetEngine(engineName) {
    return UserAgent.parser.getEngine().name === engineName;
  }

  static isTargetDeviceType(deviceType) {
    return UserAgent.parser.getDevice().type === deviceType;
  }

  static getVersion() {
    const browser = UserAgent.parser.getBrowser();
    const versionNumber = Number(browser.version?.split('.')[0]);
    return Number.isNaN(versionNumber) ? undefined : versionNumber;
  }

  static version = UserAgent.getVersion();

  static isFirefox = UserAgent.isTargetBrowser('Firefox');

  static isEdge = UserAgent.isTargetBrowser('Edge');

  static isMacOs = UserAgent.isTargetPlatform('Mac OS');

  static isWindows = UserAgent.isTargetPlatform('Windows');

  static isAndroid = UserAgent.isTargetPlatform('Android');

  static isChromium = UserAgent.isTargetEngine('Blink');

  static isMobileDevice = UserAgent.isTargetDeviceType('mobile');

  static isFirefoxMobile = UserAgent.isFirefox && UserAgent.isMobileDevice;

  static browserName = UserAgent.getBrowserName();
}
