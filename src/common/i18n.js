import browser from 'webextension-polyfill';

export function getMessage(messageName, substitutions = []) {
  return browser.i18n.getMessage(messageName, substitutions);
}
