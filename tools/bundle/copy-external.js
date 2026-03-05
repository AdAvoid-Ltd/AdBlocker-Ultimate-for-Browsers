import { copyWar } from '@adguard/tswebextension/cli';

import { WEB_ACCESSIBLE_RESOURCES_OUTPUT } from '../../constants.js';

export const copyExternals = async () => {
  await copyWar(`src/resources/${WEB_ACCESSIBLE_RESOURCES_OUTPUT}`);
};
