import path from 'node:path';

import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';

import { Browser } from '../constants.js';

import { genFirefoxConfig } from './firefox/webpack.firefox.js';
import { genEdgeConfig } from './edge/webpack.edge.js';
import { genChromeMv3Config } from './chrome-mv3/webpack.chrome-mv3.js';
import { getBrowserConf } from './helpers.js';

const ANALYZE_REPORTS_DIR = '../../analyze-reports';

export const getWebpackConfig = (browser, isWatchMode = false) => {
  const browserConf = getBrowserConf(browser);

  let webpackConfig;

  switch (browser) {
    case Browser.ChromeMv3: {
      webpackConfig = genChromeMv3Config(browserConf, isWatchMode);
      break;
    }
    case Browser.FirefoxAmo: {
      webpackConfig = genFirefoxConfig(browserConf);
      break;
    }
    case Browser.Edge: {
      webpackConfig = genEdgeConfig(browserConf);
      break;
    }
    default: {
      throw new Error(`Unknown browser: "${browser}"`);
    }
  }

  if (process.env.ANALYZE === 'true' && webpackConfig.plugins) {
    const reportFilename = process.env.BUILD_ENV
      ? path.join(ANALYZE_REPORTS_DIR, `${browser}-${process.env.BUILD_ENV}.html`)
      : path.join(ANALYZE_REPORTS_DIR, `${browser}.html`);

    webpackConfig.plugins.push(
      new BundleAnalyzerPlugin({
        analyzerMode: 'static',
        reportFilename,
        openAnalyzer: true,
      }),
    );
  }

  return webpackConfig;
};
