import browser from 'webextension-polyfill';

export const browserAction = __IS_MV3__ ? browser.action : browser.browserAction;
