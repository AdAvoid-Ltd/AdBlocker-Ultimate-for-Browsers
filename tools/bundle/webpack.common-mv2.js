import path from 'node:path';

import webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import { merge } from 'webpack-merge';

import {
  BACKGROUND_OUTPUT,
  DOCUMENT_START_OUTPUT,
  PAGE_BLOCKED_OUTPUT,
  INDEX_HTML_FILE_NAME,
} from '../../constants.js';

import {
  BACKGROUND_PATH,
  PAGE_BLOCKED_PATH,
  DOCUMENT_START_PATH,
  htmlTemplatePluginCommonOptions,
  COMPONENT_REPLACEMENT_MATCH_REGEXP,
} from './common-constants.js';
import { ENTRY_POINTS_CHUNKS, genCommonConfig } from './webpack.common.js';

const Mv2ReplacementPlugin = new webpack.NormalModuleReplacementPlugin(
  COMPONENT_REPLACEMENT_MATCH_REGEXP,
  (resource) => {
    resource.request = resource.request.replace(/\.\/Abstract(.*)/, './Mv2$1');
  },
);

export const genMv2CommonConfig = (browserConfig, isWatchMode = false) => {
  const commonConfig = genCommonConfig(browserConfig, isWatchMode);

  return merge(commonConfig, {
    entry: {
      [BACKGROUND_OUTPUT]: {
        import: BACKGROUND_PATH,
        dependOn: ENTRY_POINTS_CHUNKS[BACKGROUND_OUTPUT],
      },
      [PAGE_BLOCKED_OUTPUT]: {
        import: PAGE_BLOCKED_PATH,
      },
      [DOCUMENT_START_OUTPUT]: {
        import: path.resolve(DOCUMENT_START_PATH, 'document-start-mv2.js'),
        runtime: false,
      },
    },
    plugins: [
      Mv2ReplacementPlugin,
      new HtmlWebpackPlugin({
        ...htmlTemplatePluginCommonOptions,
        template: path.join(BACKGROUND_PATH, INDEX_HTML_FILE_NAME),
        templateParameters: {
          browser: process.env.BROWSER,
        },
        filename: `${BACKGROUND_OUTPUT}.html`,
        chunks: [...ENTRY_POINTS_CHUNKS[BACKGROUND_OUTPUT], BACKGROUND_OUTPUT],
      }),
      new HtmlWebpackPlugin({
        ...htmlTemplatePluginCommonOptions,
        template: path.join(PAGE_BLOCKED_PATH, INDEX_HTML_FILE_NAME),
        filename: `${PAGE_BLOCKED_OUTPUT}.html`,
        chunks: [PAGE_BLOCKED_OUTPUT],
      }),
    ],
  });
};
