import {
  BACKGROUND_OUTPUT,
  MIN_SUPPORTED_VERSION,
  POPUP_OUTPUT,
} from '../../../constants.js';
import { OPTIONS_PAGE } from '../../../src/common/constants.js';

export const chromeMv3Manifest = {
  manifest_version: 3,
  key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAr2Pqt+V0eGdP/ZlzTEf3fbsSi+S+VTz/dmchekNg0dPN9B+3/d+/ZUA/1Aon0sniTcDlisRAl1YByp0j1RchO7W5I/JCSq4gWn6sSZcyaON626hiDjIRATBf0Sxhzlur8Ukxgn1XL7ThotmPLI+o9CNMC1kvHY3FvKEmqDGHA1QzrgNuwlBh6vEXutndbGh6AkSLJCnqAxpa0GcnQ8T+ZoEXlubZ4G6ZMYpivLjma0OIUCSfv3vK4odevZ3In7S60aUPsj7ANKMTpErEtsIxi3DKry2jLEI4WQ3u2fsf41iCKhSFtsRbe3TKJMbQwZ4hMCVl/vEh7mvVlnA7qZx9ZwIDAQAB',
  action: {
    default_icon: {
      16: 'assets/icons/enabled-16.png',
      19: 'assets/icons/enabled-19.png',
      38: 'assets/icons/enabled-38.png',
      128: 'assets/icons/enabled-128.png',
    },
    default_title: '__MSG_name__',
    default_popup: `${POPUP_OUTPUT}.html`,
  },
  background: {
    service_worker: `${BACKGROUND_OUTPUT}.js`,
  },
  host_permissions: ['<all_urls>'],
  minimum_chrome_version: String(MIN_SUPPORTED_VERSION.CHROMIUM_MV3),
  web_accessible_resources: [
    {
      resources: ['web-accessible-resources/*'],
      matches: ['http://*/*', 'https://*/*'],
      use_dynamic_url: true,
    },
  ],
  options_page: OPTIONS_PAGE,
  permissions: [
    'tabs',
    'webRequest',
    'webNavigation',
    'storage',
    'unlimitedStorage',
    'contextMenus',
    'cookies',
    'declarativeNetRequest',
    'declarativeNetRequestFeedback',
    'scripting',
    'userScripts',
  ],
};
