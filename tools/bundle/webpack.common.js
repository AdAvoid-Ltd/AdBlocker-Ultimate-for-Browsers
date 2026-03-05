import path from 'node:path';
import { fileURLToPath } from 'node:url';

import HtmlWebpackPlugin from 'html-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import ZipWebpackPlugin from 'zip-webpack-plugin';
import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
// webpack.DefinePlugin is not named exported by webpack.
import webpack from 'webpack';

import {
  BUILD_PATH,
  Browser,
  BUILD_ENV,
} from '../constants.js';
import { updateLocalesMSGName } from '../helpers.js';
import {
  WEB_ACCESSIBLE_RESOURCES_OUTPUT,
  OPTIONS_OUTPUT,
  POPUP_OUTPUT,
  ASSISTANT_INJECT_OUTPUT,
  SCRIPTLETS_VENDOR_OUTPUT,
  TSURLFILTER_VENDOR_OUTPUT,
  TSURLFILTER_DECLARATIVE_CONVERTER_VENDOR_OUTPUT,
  TSWEBEXTENSION_VENDOR_OUTPUT,
  AGTREE_VENDOR_OUTPUT,
  CSS_TOKENIZER_VENDOR_OUTPUT,
  TEXT_ENCODING_POLYFILL_VENDOR_OUTPUT,
  BACKGROUND_OUTPUT,
  MIN_SUPPORTED_VERSION,
  INDEX_HTML_FILE_NAME,
  BuildTargetEnv,
} from '../../constants.js';
import packageJson from '../../package.json' with { type: 'json' };

import {
  ASSISTANT_INJECT_PATH,
  htmlTemplatePluginCommonOptions,
  OPTIONS_PATH,
  PAGES_PATH,
  POPUP_PATH,
} from './common-constants.js';
import { getEnvConf } from './helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = getEnvConf(BUILD_ENV);

const OUTPUT_PATH = config.outputPath;

const ACTIVE_PROMO_ID = process.env.ACTIVE_PROMO_ID;

/**
 * Separately described chunks for large entry points to avoid missing some
 * chunk dependencies in the final bundle, because we list chunks in two places:
 * - `entry.dependOn` option,
 * - `HtmlWebpackPlugin.chunks` option.
 */
export const ENTRY_POINTS_CHUNKS = {
  [BACKGROUND_OUTPUT]: [
    TSWEBEXTENSION_VENDOR_OUTPUT,
    TSURLFILTER_VENDOR_OUTPUT,
    TSURLFILTER_DECLARATIVE_CONVERTER_VENDOR_OUTPUT,
    SCRIPTLETS_VENDOR_OUTPUT,
    AGTREE_VENDOR_OUTPUT,
    CSS_TOKENIZER_VENDOR_OUTPUT,
    TEXT_ENCODING_POLYFILL_VENDOR_OUTPUT,
  ],
};

export const genCommonConfig = (browserConfig, isWatchMode = false) => {
  const isDev = BUILD_ENV === BuildTargetEnv.Dev;
  const manifestVersion = browserConfig.browser === Browser.ChromeMv3 ? 3 : 2;

  const alias = {
    tswebextension: path.resolve(
      __dirname,
      `../../src/background/tswebextension/tswebextension-mv${manifestVersion}.js`,
    ),
    app: path.resolve(__dirname, `../../src/background/app/app-mv${manifestVersion}.js`),
    engine: path.resolve(__dirname, `../../src/background/engine/engine-mv${manifestVersion}.js`),
    'scripting-controller': path.resolve(
      __dirname,
      `../../src/background/browser-api/scripting-mv${manifestVersion}.js`,
    ),
    'settings-controller': path.resolve(
      __dirname,
      `../../src/background/controllers/settings/settings-service-mv${manifestVersion}.js`,
    ),
    'filters-controller': path.resolve(
      __dirname,
      `../../src/background/controllers/filters/filters-service-mv${manifestVersion}.js`,
    ),
    'rules-limits-controller': path.resolve(
      __dirname,
      `../../src/background/controllers/rules-limits/rules-limits-service-mv${manifestVersion}.js`,
    ),
    'content-script': path.resolve(__dirname, `../../src/content-script/document-start-mv${manifestVersion}.js`),
    'network-service': path.resolve(__dirname, `../../src/background/services/network/network-mv${manifestVersion}.js`),
    'network-service-settings': path.resolve(
      __dirname,
      `../../src/background/services/network/settings-mv${manifestVersion}.js`,
    ),
    'filters-update-service': path.resolve(
      __dirname,
      `../../src/background/services/filters/update/update-mv${manifestVersion}.js`,
    ),
    'common-filter-service': path.resolve(
      __dirname,
      `../../src/background/services/filters/common/common-mv${manifestVersion}.js`,
    ),
    'filter-update-controller': path.resolve(
      __dirname,
      '../../src/background/services/filter-update/filter-update-mv2.js',
    ),
  };

  const configuration = {
    mode: config.mode,
    target: 'web',
    stats: 'verbose',
    optimization: {
      minimize: false,
      runtimeChunk: 'single',
      usedExports: true,
      sideEffects: true,
    },
    cache: isDev,
    devtool: isDev ? 'eval-source-map' : false,
    entry: {
      [OPTIONS_OUTPUT]: {
        import: OPTIONS_PATH,
      },
      [POPUP_OUTPUT]: {
        import: POPUP_PATH,
      },
      [ASSISTANT_INJECT_OUTPUT]: {
        import: ASSISTANT_INJECT_PATH,
        runtime: false,
      },
      // Library vendors
      [TSURLFILTER_VENDOR_OUTPUT]: {
        import: '@adguard/tsurlfilter',
        dependOn: [AGTREE_VENDOR_OUTPUT, CSS_TOKENIZER_VENDOR_OUTPUT, SCRIPTLETS_VENDOR_OUTPUT],
      },
      [TSURLFILTER_DECLARATIVE_CONVERTER_VENDOR_OUTPUT]: {
        import: '@adguard/tsurlfilter/es/declarative-converter',
        dependOn: [TSURLFILTER_VENDOR_OUTPUT],
      },
      [TSWEBEXTENSION_VENDOR_OUTPUT]: {
        import: '@adguard/tswebextension',
        dependOn: [SCRIPTLETS_VENDOR_OUTPUT, TSURLFILTER_VENDOR_OUTPUT, TEXT_ENCODING_POLYFILL_VENDOR_OUTPUT],
      },
      [SCRIPTLETS_VENDOR_OUTPUT]: {
        import: '@adguard/scriptlets',
        dependOn: [AGTREE_VENDOR_OUTPUT],
      },
      [AGTREE_VENDOR_OUTPUT]: ['@adguard/agtree'],
      [CSS_TOKENIZER_VENDOR_OUTPUT]: ['@adguard/css-tokenizer'],
      [TEXT_ENCODING_POLYFILL_VENDOR_OUTPUT]: ['@adguard/text-encoding'],
    },
    output: {
      path: path.join(BUILD_PATH, OUTPUT_PATH),
      filename: '[name].js',
    },
    resolve: {
      modules: [
        'node_modules',

        /**
         * By default, package managers like Yarn and NPM create a flat structure in the `node_modules` folder,
         * placing all dependencies directly in the root `node_modules`.
         * For instance, when we install `@adguard/agtree` in this project, both it and its dependency,
         * `@adguard/css-tokenizer`, are typically placed in the root `node_modules` folder.
         *
         * However, pnpm follows a different, nested structure where dependencies are stored
         * under `node_modules/.pnpm/node_modules`.
         * This structure helps reduce duplication but also means that dependencies of dependencies
         * are not directly accessible in the root.
         *
         * As a result, Webpack may fail to resolve these "nested" dependencies in pnpm's setup,
         * since they are not in the root `node_modules`.
         * To ensure Webpack can locate dependencies correctly in a pnpm project,
         * we add `node_modules/.pnpm/node_modules` to the module resolution path as a fallback.
         */
        'node_modules/.pnpm/node_modules',
      ],
      fallback: {
        crypto: 'crypto-browserify',
        stream: 'stream-browserify',
        vm: 'vm-browserify',
      },
      extensions: ['.ts', '.js', '.tsx', '.jsx'],
      // pnpm uses symlinks to manage dependencies, so we need to resolve them
      symlinks: true,
      alias,
    },
    module: {
      rules: [
        /*
         * Prevent browser console warnings with source map issue
         * by deleting source map url comments in production build
         */
        {
          test: /\.(js|ts)x?$/,
          enforce: 'pre',
          use: [
            {
              loader: 'source-map-loader',
              options: {
                filterSourceMappingUrl: () => (isDev ? 'skip' : 'remove'),
              },
            },
          ],
        },
        {
          test: /\.(js|ts)x?$/,
          exclude: /node_modules\/(?!@adguard\/tswebextension)/,
          use: [
            {
              loader: 'swc-loader',
              options: {
                env: {
                  targets: {
                    chrome: MIN_SUPPORTED_VERSION.CHROMIUM_MV3,
                    firefox: MIN_SUPPORTED_VERSION.FIREFOX,
                  },
                  mode: 'usage',
                  coreJs: '3.32',
                },
                jsc: {
                  parser: { syntax: 'typescript', tsx: true, decorators: true },
                  transform: {
                    useDefineForClassFields: true,
                    react: { runtime: 'automatic', importSource: 'preact' },
                  },
                },
              },
            },
          ],
          resolve: {
            fullySpecified: false,
          },
        },
        /**
         * CSS loader for pages - extracts to separate file to prevent FOUC (Flash of Unstyled Content).
         *
         * IMPORTANT: Use PAGES_PATH (src/pages) not individual subdirectories!
         * The soft reset in src/pages/common.pcss must be included here.
         * If only subdirectories (options/, popup/, etc.) are listed, common.pcss
         * falls through to style-loader and gets injected via JS, causing layout
         * shifts as browser defaults (list padding, button styles, image sizes)
         * flash before the reset loads.
         */
        {
          test: /\.(css|pcss)$/,
          include: [PAGES_PATH],
          use: [
            MiniCssExtractPlugin.loader,
            {
              loader: 'css-loader',
              options: {
                importLoaders: 1,
                url: false,
              },
            },
            'postcss-loader',
          ],
        },
        // CSS loader for other files - injects via JS
        {
          test: /\.(css|pcss)$/,
          exclude: [PAGES_PATH],
          use: [
            'style-loader',
            {
              loader: 'css-loader',
              options: {
                importLoaders: 1,
                url: false,
              },
            },
            'postcss-loader',
          ],
        },
        {
          test: /\.(woff|woff2|eot|ttf|otf)$/,
          type: 'asset/resource',
        },
        {
          test: /\.(svg|png)$/,
          type: 'asset/resource',
          generator: {
            filename: 'assets/images/[name][ext]',
          },
        },
        {
          test: /\.(webm|mp4)$/,
          type: 'asset/resource',
          generator: {
            filename: 'assets/videos/[name][ext]',
          },
        },
      ],
    },
    plugins: [
      new CleanWebpackPlugin(),
      new MiniCssExtractPlugin({
        filename: '[name].css',
      }),
      new HtmlWebpackPlugin({
        ...htmlTemplatePluginCommonOptions,
        template: path.join(OPTIONS_PATH, INDEX_HTML_FILE_NAME),
        filename: `${OPTIONS_OUTPUT}.html`,
        chunks: [OPTIONS_OUTPUT],
      }),
      new HtmlWebpackPlugin({
        ...htmlTemplatePluginCommonOptions,
        template: path.join(POPUP_PATH, INDEX_HTML_FILE_NAME),
        filename: `${POPUP_OUTPUT}.html`,
        chunks: [POPUP_OUTPUT],
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            context: 'src/resources',
            from: 'css',
            to: 'assets/css',
          },
          {
            context: 'src/resources',
            from: 'fonts',
            to: 'assets/fonts',
          },
          {
            context: 'src/resources',
            from: 'icons',
            to: 'assets/icons',
          },
          {
            context: 'src/resources',
            from: 'images',
            to: 'assets/images',
          },
          {
            context: 'src/resources',
            from: '_locales',
            to: '_locales',
            transform: (content) => {
              return updateLocalesMSGName(content, BUILD_ENV, browserConfig.browser);
            },
          },
          {
            context: 'src/resources',
            from: 'web-accessible-resources',
            to: WEB_ACCESSIBLE_RESOURCES_OUTPUT,
          },
          ...(ACTIVE_PROMO_ID
            ? [
              {
                from: 'src/assets/images/promotional',
                to: 'assets/images/promotional',
              },
            ]
            : []),
        ],
      }),
      new webpack.DefinePlugin({
        IS_FIREFOX_AMO: browserConfig.browser === Browser.FirefoxAmo,
        IS_RELEASE: BUILD_ENV === BuildTargetEnv.Release,
        __IS_MV3__: browserConfig.browser === Browser.ChromeMv3,
      }),
    ],
  };

  // Run the archive only if it is not a watch mode to reduce the build time.
  if (!isWatchMode && configuration.plugins) {
    // @ts-expect-error ZipWebpackPlugin has outdated types
    configuration.plugins.push(
      new ZipWebpackPlugin({
        path: '../',
        filename: `${browserConfig.zipName}-${packageJson.version}.zip`,
      }),
    );
  }

  return configuration;
};
