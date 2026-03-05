import path from 'node:path';
import { fileURLToPath } from 'node:url';

import CopyWebpackPlugin from 'copy-webpack-plugin';
import { merge } from 'webpack-merge';

import { genMv2CommonConfig } from '../webpack.common-mv2.js';
import { updateManifestBuffer } from '../../helpers.js';
import { BUILD_ENV } from '../../constants.js';
import { commonManifest } from '../manifest.common.js';

import { firefoxManifest } from './manifest.firefox.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const genFirefoxConfig = (browserConfig) => {
  const commonConfig = genMv2CommonConfig(browserConfig);

  if (!commonConfig?.output?.path) {
    throw new Error('commonConfig.output.path is undefined');
  }

  const plugins = [
    new CopyWebpackPlugin({
      patterns: [
        {
          /**
           * This is a dummy import to keep "clean" usage of
           * `CopyWebpackPlugin`. We actually use `commonManifest`
           * imported above.
           */
          from: path.resolve(__dirname, '../manifest.common.js'),
          to: 'manifest.json',
          transform: () => {
            const commonManifestContent = Buffer.from(JSON.stringify(commonManifest));

            return updateManifestBuffer(BUILD_ENV, browserConfig.browser, commonManifestContent, firefoxManifest);
          },
        },
        {
          context: 'src/resources',
          from: 'filters/firefox',
          to: 'filters',
        },
      ],
    }),
  ];

  const firefoxConfig = {
    output: {
      path: path.join(commonConfig.output.path, browserConfig.buildDir),
    },
    plugins,
  };

  return merge(commonConfig, firefoxConfig);
};
