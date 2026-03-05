import browser from 'webextension-polyfill';

import { logger } from '../../common/logger';

export const executeScript = async (tabId, options) => {
  if (!tabId) {
    logger.debug('[ext.scripting-service-mv2]: tab id is not provided');
    return;
  }

  const { frameId, allFrames, runAt, files = [], code } = options;

  const hasFiles = files.length !== 0;
  const hasCode = code !== undefined;

  // Ensure that at least one and not both of the 'files' or 'code' is provided
  if (hasFiles === hasCode) {
    throw new Error('Provide either "files" or "code", but not both.');
  }

  const executeScriptOptions = {
    frameId,
    allFrames,
    runAt,
  };

  let tasks = [];
  if (hasFiles) {
    tasks = files.map((file) => browser.tabs.executeScript(tabId, {
      ...executeScriptOptions,
      file,
    }));
  } else if (hasCode) {
    tasks = [
      browser.tabs.executeScript(tabId, {
        ...executeScriptOptions,
        code,
      }),
    ];
  }

  const promises = await Promise.allSettled(tasks);

  // Handles errors
  promises.forEach((promise) => {
    if (promise.status === 'rejected') {
      logger.error(
        `[ext.scripting-service-mv2]: cannot inject script to frame ${frameId} and tab ${tabId} due to:`,
        promise.reason,
      );
    }
  });
};
