import path from 'node:path';

import webpack from 'webpack';
import { merge } from 'webpack-merge';
import HtmlWebpackPlugin from 'html-webpack-plugin';

import {
  BACKGROUND_OUTPUT,
  PAGE_BLOCKED_OUTPUT,
  DOCUMENT_START_OUTPUT,
  INDEX_HTML_FILE_NAME,
} from '../../constants.js';

import {
  BACKGROUND_PATH,
  PAGE_BLOCKED_PATH,
  DOCUMENT_START_PATH,
  htmlTemplatePluginCommonOptions,
  COMPONENT_REPLACEMENT_MATCH_REGEXP,
} from './common-constants.js';
import { genCommonConfig } from './webpack.common.js';

const Mv3ReplacementPlugin = new webpack.NormalModuleReplacementPlugin(
  COMPONENT_REPLACEMENT_MATCH_REGEXP,
  (resource) => {
    resource.request = resource.request.replace(/\.\/Abstract(.*)/, './Mv3$1');
  },
);

export const genMv3CommonConfig = (browserConfig, isWatchMode) => {
  const commonConfig = genCommonConfig(browserConfig, isWatchMode);

  return merge(commonConfig, {
    entry: {
      /**
       * Don't needed to specify chunks for MV3, because Service workers
       * in MV3 must be a single file as they run in a short-lived
       * execution environment (they are terminated when idle) and cannot
       * use eval, importScripts, or external scripts dynamically
       */
      [BACKGROUND_OUTPUT]: {
        import: BACKGROUND_PATH,
        runtime: false,
      },
      [PAGE_BLOCKED_OUTPUT]: {
        import: PAGE_BLOCKED_PATH,
      },
      [DOCUMENT_START_OUTPUT]: {
        import: path.resolve(DOCUMENT_START_PATH, 'document-start-mv3.js'),
        runtime: false,
      },
    },
    plugins: [
      Mv3ReplacementPlugin,
      new HtmlWebpackPlugin({
        ...htmlTemplatePluginCommonOptions,
        template: path.join(PAGE_BLOCKED_PATH, INDEX_HTML_FILE_NAME),
        filename: `${PAGE_BLOCKED_OUTPUT}.html`,
        chunks: [PAGE_BLOCKED_OUTPUT],
      }),
    ],
  });
};
