import browser from 'webextension-polyfill';

import { logger } from '../../common/logger';
import { UserAgent } from '../../common/user-agent';

export class WindowsApi {
  /**
   * Checks if browser.windows API is supported.
   *
   * Do not use browser.windows API if it is not supported,
   * for example on Android: not supported in Firefox and does not work in Edge.
   */
  static async isSupported() {
    const isAndroid = await UserAgent.getIsAndroid();

    /**
     * We need separate check for Edge on Android,
     * because it has browser.windows API defined,
     * but it does nothing when you try to use it
     */
    if (isAndroid && UserAgent.isEdge) {
      return false;
    }

    return (
      !!browser.windows && typeof browser.windows.update === 'function' && typeof browser.windows.create === 'function'
    );
  }

  static async update(windowId, updateInfo) {
    if (!windowId) {
      logger.debug('[ext.WindowsApi.update]: windowId is not specified');
      return;
    }

    if (!(await WindowsApi.isSupported())) {
      logger.debug('[ext.WindowsApi.update]: browser.windows API is not supported');
      return;
    }

    await browser.windows.update(windowId, updateInfo);
  }
}
