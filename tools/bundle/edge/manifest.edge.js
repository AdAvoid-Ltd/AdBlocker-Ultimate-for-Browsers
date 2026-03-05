import {
  BACKGROUND_OUTPUT,
  MIN_SUPPORTED_VERSION,
  POPUP_OUTPUT,
} from '../../../constants.js';
import { OPTIONS_PAGE } from '../../../src/common/constants.js';

export const edgeManifest = {
  key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA+87ixl193xF/pYLvUN+kBlX78Ma7MAxWzgQguxyAAb2MelcDqsW35f0AKptEPprwqoL721J67u53C3dtym9UPfOn46L3xmxvuKGv/Fuc0m5JaARm+gw0zEb6xnILevDTqvBejR4RuyPhdngqttR7rRrpFHXVsGV2Ik9lAWdyHi4Cr86czRDQ/XqUgB12ETf5KGViC07MAcc+Wo65OsIh7DD5u+Vqv1utzQ8aYBgjiy+aVXtITrXx1QdUK8hiLkGNj7mBbCkjuYBIgkK9znbPZCuFAr+NTIMHPVl6gPupP9FIkeDoZ2YIcmVH4165FyWGZFe78kc0xe2RwG66Td1kAQIDAQAB',
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
  background: {
    page: `${BACKGROUND_OUTPUT}.html`,
    persistent: true,
  },
  web_accessible_resources: ['/web-accessible-resources/*'],
  options_page: OPTIONS_PAGE,
  permissions: [
    'tabs',
    '<all_urls>',
    'webRequest',
    'webRequestBlocking',
    'webNavigation',
    'storage',
    'unlimitedStorage',
    'contextMenus',
    'cookies',
  ],
  minimum_chrome_version: String(MIN_SUPPORTED_VERSION.EDGE_CHROMIUM),
};
