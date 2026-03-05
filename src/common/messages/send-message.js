import browser from 'webextension-polyfill';

import { APP_MESSAGE_HANDLER_NAME } from './constants';

export async function sendMessage(message) {
  try {
    return await browser.runtime.sendMessage({
      handlerName: APP_MESSAGE_HANDLER_NAME,
      ...message,
    });
  } catch (e) {
    // do nothing
  }
}

export async function sendTabMessage(tabId, message) {
  return browser.tabs.sendMessage(tabId, {
    handlerName: APP_MESSAGE_HANDLER_NAME,
    ...message,
  });
}
