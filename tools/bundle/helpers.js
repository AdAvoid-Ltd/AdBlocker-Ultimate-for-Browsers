import { ENV_CONF } from '../constants.js';

import { BROWSERS_CONF } from './common-constants.js';

export const getBrowserConf = (browser) => {
  const browserConf = BROWSERS_CONF[browser];
  if (!browserConf) {
    throw new Error(`No browser config for: "${browser}"`);
  }
  return browserConf;
};

export const getEnvConf = (env) => {
  const envConfig = ENV_CONF[env];
  if (!envConfig) {
    throw new Error(`No env config for: "${env}"`);
  }
  return envConfig;
};
