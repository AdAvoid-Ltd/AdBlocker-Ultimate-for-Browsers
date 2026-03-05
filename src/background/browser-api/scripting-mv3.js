import { logger } from '../../common/logger';

export const executeScript = async (tabId, options) => {
  if (!tabId) {
    logger.debug('[ext.scripting-service-mv3]: tab id is not provided');
    return;
  }

  const { frameId, allFrames, files = [], func } = options;

  const hasFiles = files.length !== 0;
  const hasFunc = func !== undefined;

  // Ensure that at least one and not both of the 'files' or 'func' is provided
  if (hasFiles === hasFunc) {
    throw new Error('Provide either "files" or "func", but not both.');
  }

  const frameIds = frameId !== undefined ? [frameId] : undefined;

  const target = {
    tabId,
    allFrames,
    frameIds,
  };

  let executeScriptOptions;
  if (hasFiles) {
    executeScriptOptions = {
      target,
      files,
    };
  } else if (hasFunc) {
    executeScriptOptions = {
      target,
      func,
    };
  }

  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(executeScriptOptions, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
};
