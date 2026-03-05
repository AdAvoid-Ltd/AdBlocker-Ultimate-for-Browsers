import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import CopyWebpackPlugin from 'copy-webpack-plugin';
import { merge } from 'webpack-merge';

import { RulesetsInjector } from '@adguard/dnr-rulesets';

import { genMv3CommonConfig } from '../webpack.common-mv3.js';
import { updateManifestBuffer } from '../../helpers.js';
import {
  AssetsFiltersBrowser,
  BUILD_ENV,
  FILTERS_DEST,
} from '../../constants.js';
import { commonManifest } from '../manifest.common.js';

import { chromeMv3Manifest } from './manifest.chrome-mv3.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RULESET_NAME_PREFIX = 'ruleset_';

/**
 * Base filter id - it is the main filter that is enabled by default.
 */
const BASE_FILTER_ID = '2';

const rulesetsInjector = new RulesetsInjector();

export const genChromeMv3Config = (browserConfig, isWatchMode) => {
  const commonConfig = genMv3CommonConfig(browserConfig, isWatchMode);

  if (!commonConfig?.output?.path) {
    throw new Error('commonConfig.output.path is undefined');
  }

  const transformManifest = (content) => {
    const filters = fs
      .readdirSync(FILTERS_DEST.replace('%browser', path.join(AssetsFiltersBrowser.ChromiumMv3, '/declarative')))
      .filter((filter) => filter.match(/ruleset_\d+/));

    return updateManifestBuffer(
      BUILD_ENV,
      browserConfig.browser,
      content,
      rulesetsInjector.applyRulesets((id) => `filters/declarative/${id}/${id}.json`, chromeMv3Manifest, filters, {
        forceUpdate: true,
        enable: [BASE_FILTER_ID],
        rulesetPrefix: RULESET_NAME_PREFIX,
      }),
    );
  };

  const chromeMv3Config = {
    devtool: BUILD_ENV === 'dev' ? 'inline-source-map' : false,
    entry: {},
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
            transform: () => {
              return transformManifest(Buffer.from(JSON.stringify(commonManifest)));
            },
          },
          {
            context: 'src/resources',
            from: 'filters/chromium-mv3',
            to: 'filters',
          },
        ],
      }),
    ],
  };

  return merge(commonConfig, chromeMv3Config);
};
