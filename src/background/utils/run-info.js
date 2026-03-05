import { APP_VERSION_KEY } from '../storage-keys';
import { Prefs } from '../prefs';
import { browserModel } from '../models';

async function getData(key) {
  const data = await browserModel.get(key);

  return data || null;
}

async function getAppVersion() {
  const appVersion = await getData(APP_VERSION_KEY);

  if (typeof appVersion === 'string') {
    return appVersion;
  }

  return null;
}

export async function getRunInfo() {
  const currentAppVersion = Prefs.version;

  const previousAppVersion = await getAppVersion();

  return {
    previousAppVersion,
    currentAppVersion,
  };
}
