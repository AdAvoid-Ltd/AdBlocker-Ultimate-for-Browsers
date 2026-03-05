import path from 'node:path';
import { fileURLToPath } from 'node:url';

import CopyWebpackPlugin from 'copy-webpack-plugin';
import { merge } from 'webpack-merge';

import { genMv2CommonConfig } from '../webpack.common-mv2.js';
import { updateManifestBuffer } from '../../helpers.js';
import { BUILD_ENV } from '../../constants.js';
import { commonManifest } from '../manifest.common.js';

import { edgeManifest } from './manifest.edge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const genEdgeConfig = (browserConfig) => {
  const commonConfig = genMv2CommonConfig(browserConfig);

  if (!commonConfig?.output?.path) {
    throw new Error('commonConfig.output.path is undefined');
  }

  const edgeConfig = {
    output: {
      path: path.join(commonConfig.output.path, browserConfig.buildDir),
    },
    plugins: [
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
            transform: () => updateManifestBuffer(
              BUILD_ENV,
              browserConfig.browser,
              Buffer.from(JSON.stringify(commonManifest)),
              edgeManifest,
            ),
          },
          {
            context: 'src/resources',
            from: 'filters/edge',
            to: 'filters',
          },
        ],
      }),
    ],
  };

  return merge(commonConfig, edgeConfig);
};
