import { USER_SCRIPTS_API_MIN_CHROME_VERSION_REQUIRED } from './constants';
import { logger } from './logger';
import { UserAgent } from './user-agent';

/**
 * Checks if User scripts API permission is granted.
 *
 * Note: do not rely on the engine value as its reload is required
 * for the value update which is not triggered when users grant or revoke the permission.
 */
export const isUserScriptsApiSupported = () => {
  // User Scripts API only exists in MV3 Chromium browsers
  if (!__IS_MV3__) {
    return false;
  }

  try {
    // Method call which throws an error if User scripts API permission is not granted.
    chrome.userScripts.getScripts();
    return true;
  } catch {
    // User scripts API is not available.
    return false;
  }
};

export const shouldShowUserScriptsApiWarning = () => {
  if (isUserScriptsApiSupported()) {
    logger.trace('[ext.user-scripts-api]: User Scripts API permission is already granted');
    return false;
  }

  if (!__IS_MV3__) {
    logger.debug('[ext.user-scripts-api]: User Scripts API supported only in MV3');
    return false;
  }

  const currentChromeVersion = UserAgent.isChromium ? Number(UserAgent.version) : null;

  if (!currentChromeVersion) {
    logger.debug('[ext.user-scripts-api]: User Scripts API supported only in Chromium-based browsers');
    return false;
  }

  if (currentChromeVersion < USER_SCRIPTS_API_MIN_CHROME_VERSION_REQUIRED.DEV_MODE_TOGGLE) {
    logger.debug(`[ext.user-scripts-api]: User Scripts API is not supported in Chrome v${currentChromeVersion}`);
    return false;
  }

  return true;
};
