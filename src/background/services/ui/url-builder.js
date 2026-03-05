const BASE_URL = 'https://adblockultimate.net';

export const Endpoint = {
  Homepage: '/',
  Installed: '/installed',
  Updated: '/updated',
  Uninstall: '/uninstall',
  Upgrade: '/upgrade',
  RateExtension: '/rate-extension',
  Report: '/report',
  Privacy: '/privacy',
  Contact: '/contact',
  Windows: '/windows',
  Feedback: '/feedback-extension',
};

export const ExternalLinks = {
  FACEBOOK: 'https://facebook.com/AdBlockUltimate',
  TWITTER: 'https://twitter.com/AdBlockUltimate',
  CROWDIN: 'https://crowdin.com/profile/adblockultimate',
  CHROME_STORE: 'https://chromewebstore.google.com/detail/adblocker-ultimate/ohahllgiabjaoigichmmfljhkcfikeof',
  FIREFOX_STORE: 'https://addons.mozilla.org/firefox/addon/adblocker-ultimate/',
  EDGE_STORE: 'https://microsoftedge.microsoft.com/addons/detail/adblocker-ultimate/pciakllldcajllepkbbihkmfadfhpgel',
};

export function buildUrl(endpoint, params = {}) {
  const url = new URL(endpoint, BASE_URL);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return url.toString();
}
