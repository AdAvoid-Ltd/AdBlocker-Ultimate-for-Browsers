/* eslint-disable no-console */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import webpack from 'webpack';
import { merge } from 'webpack-merge';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const bundleRunner = (webpackConfig, options) => {
  const { watch, cache } = options;

  /**
   * Without cache, building watches linked dependencies, but building takes 5-7 seconds.
   * With cache, building happens almost instantly, but changes from linked dependencies are not applied.
   */
  if (watch) {
    /**
     * Disabling cache is crucial in watch mode as it allows tracking
     * changes in the @adguard dependencies and rebuilding vendors correctly.
     */
    webpackConfig = merge(webpackConfig, { cache });
  }

  const compiler = webpack(webpackConfig);

  if (watch) {
    compiler.hooks.watchRun.tap('WatchStart', () => {
      console.log('🔨🔧🪚  Building...');
    });
  }

  const run = watch
    ? (cb) => compiler.watch(
      {
        /**
         * We may be using symlinked dependencies (tsurlfilter, etc) so it's
         * important that watch should follow symlinks.
         */
        followSymlinks: true,
        aggregateTimeout: 300,
        /**
         * This will exclude everything in node_modules except for @adguard, build,
         * and _locales (the latter unexpectedly triggers even though it is not changing, which could be a bug
         * in webpack).
         */
        ignored: [
          '/node_modules(?!\/@adguard)/',
          'build',
          path.resolve(__dirname, 'src/resources/_locales'),
        ],
      },
      cb,
    )
    : (cb) => compiler.run(cb);

  return new Promise((resolve, reject) => {
    run((err, stats) => {
      if (err) {
        console.error(err.stack || err);
        if (err.details) {
          console.error(err.details);
        }
        reject();
        return;
      }

      if (stats.hasErrors()) {
        console.log(
          stats.toString({
            colors: true,
            all: false,
            errors: true,
            moduleTrace: true,
            logging: 'error',
          }),
        );
        reject();
        return;
      }

      console.log(
        stats.toString({
          chunks: false, // Makes the build much quieter
          colors: true, // Shows colors in the console
        }),
      );
      resolve();
    });
  });
};
