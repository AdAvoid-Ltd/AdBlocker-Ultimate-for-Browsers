import { FIREFOX_APP_ID } from '../../constants.js';
import { OPTIONS_PAGE } from '../../../src/common/constants.js';
import {
  BACKGROUND_OUTPUT,
  MIN_SUPPORTED_VERSION,
  POPUP_OUTPUT,
} from '../../../constants.js';

const MIN_SUPPORTED_DESKTOP_VERSION_STR = `${String(MIN_SUPPORTED_VERSION.FIREFOX)}.0`;

const MIN_SUPPORTED_ANDROID_VERSION_STR = `${String(MIN_SUPPORTED_VERSION.FIREFOX_MOBILE)}.0`;

export const firefoxManifest = {
  background: {
    page: `${BACKGROUND_OUTPUT}.html`,
    persistent: false,
  },
  browser_action: {
    default_icon: {
      16: 'assets/icons/enabled-16.png',
      19: 'assets/icons/enabled-19.png',
      38: 'assets/icons/enabled-38.png',
      128: 'assets/icons/enabled-128.png',
    },
    default_title: '__MSG_name__',
    default_popup: `${POPUP_OUTPUT}.html`,
  },
  web_accessible_resources: ['/web-accessible-resources/*'],
  browser_specific_settings: {
    gecko: {
      id: FIREFOX_APP_ID,
      strict_min_version: MIN_SUPPORTED_DESKTOP_VERSION_STR,
    },
    gecko_android: {
      strict_min_version: MIN_SUPPORTED_ANDROID_VERSION_STR,
    },
  },
  options_ui: {
    page: OPTIONS_PAGE,
    open_in_tab: true,
  },
  permissions: [
    'tabs',
    '<all_urls>',
    'webRequest',
    'webRequestBlocking',
    'webNavigation',
    'storage',
    'contextMenus',
    'cookies',
  ],
  optional_permissions: ['clipboardRead', 'clipboardWrite'],
};
