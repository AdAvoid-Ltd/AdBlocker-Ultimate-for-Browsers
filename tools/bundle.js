/* eslint-disable no-console */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { program } from 'commander';
import fse from 'fs-extra';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import { BuildTargetEnv } from '../constants.js';

import { bundleRunner } from './bundle/bundle-runner.js';
import { copyExternals } from './bundle/copy-external.js';
import { buildInfo } from './bundle/build-info.js';
import { processPromotion } from './resources/build-promotions.js';
import { Browser, BUILD_ENV } from './constants.js';
import { getWebpackConfig } from './bundle/get-webpack-config.js';

const bundleChromeMv3 = (options) => {
  // Set BROWSER env for filter source selection (MV3 = 14 filters)
  process.env.BROWSER = Browser.ChromeMv3;
  const webpackConfig = getWebpackConfig(Browser.ChromeMv3, options.watch);
  return bundleRunner(webpackConfig, options);
};

const bundleFirefoxAmo = (options) => {
  // Set BROWSER env for filter source selection (MV2 = 29 filters)
  process.env.BROWSER = Browser.FirefoxAmo;
  const webpackConfig = getWebpackConfig(Browser.FirefoxAmo, options.watch);
  return bundleRunner(webpackConfig, options);
};

const bundleEdge = (options) => {
  // Set BROWSER env for filter source selection (MV2 = 29 filters)
  process.env.BROWSER = Browser.Edge;
  const webpackConfig = getWebpackConfig(Browser.Edge, options.watch);
  return bundleRunner(webpackConfig, options);
};

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PROMOTIONS_DIR = path.join(PROJECT_ROOT, 'src/resources/promotions');

const getAvailablePromoIds = async () => {
  const configPath = path.join(PROMOTIONS_DIR, 'config.json');
  if (!(await fse.pathExists(configPath))) {
    return [];
  }
  try {
    const content = await fse.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed.map((p) => p.id).filter(Boolean) : [];
  } catch {
    return [];
  }
};

const devPlanTasks = [copyExternals, bundleFirefoxAmo, buildInfo];
const releasePlanTasks = [copyExternals, bundleFirefoxAmo, buildInfo];

const runSingleTask = async (task, options) => {
  console.log(`Running task: ${task.name}...`);
  console.time(`Time for task ${task.name}`);
  await task(options);
  console.timeEnd(`Time for task ${task.name}`);
};

const runBuildPlanTasks = async (tasks, options) => {
  for (const task of tasks) {
    await runSingleTask(task, options);
  }
};

const mainBuild = async (options) => {
  const promoId = options.promo ?? null;

  if (process.env.PROMO_BUILD === 'true' && !promoId) {
    const availableIds = await getAvailablePromoIds();
    if (availableIds.length === 0) {
      console.error('No promotion IDs found. Create src/resources/promotions/config.json and add promotions.');
      process.exit(1);
    }
    console.error('Promo ID is required for promo builds.');
    console.log(`Available promotion IDs: ${availableIds.join(', ')}`);
    console.log('Usage: pnpm run release:promo -- --promo=<promo-id>');
    process.exit(1);
  }

  await processPromotion(promoId);
  if (promoId) {
    process.env.ACTIVE_PROMO_ID = promoId;
  }

  switch (BUILD_ENV) {
    case BuildTargetEnv.Dev: {
      await runBuildPlanTasks(devPlanTasks, options);
      break;
    }
    case BuildTargetEnv.Release: {
      await runBuildPlanTasks(releasePlanTasks, options);
      break;
    }
    default:
      throw new Error('Provide BUILD_ENV to choose correct build plan');
  }
};

const main = async (options) => {
  try {
    await mainBuild(options);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
};

const chromeMv3 = async (options) => {
  try {
    await runSingleTask(bundleChromeMv3, options);
    if (!options.watch) {
      await buildInfo();
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
};

const edge = async (options) => {
  try {
    await runSingleTask(bundleEdge, options);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
};

const firefoxAmo = async (options) => {
  try {
    await runSingleTask(bundleFirefoxAmo, options);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
};

program
  .option('--watch', 'Builds in watch mode', false)
  .option('--promo <promoId>', 'Include specified promotion in build')
  .option(
    '--no-cache',
    'Builds without cache. Is useful when watch mode rebuild on the changes from the linked dependencies',
    true,
  );

program
  .command(Browser.ChromeMv3)
  .description('Builds extension for chrome-mv3 browser')
  .action(() => {
    chromeMv3(program.opts());
  });

program
  .command(Browser.Edge)
  .description('Builds extension for edge browser')
  .action(() => {
    edge(program.opts());
  });

program
  .command(Browser.FirefoxAmo)
  .description('Builds extension for firefox browser')
  .action(() => {
    firefoxAmo(program.opts());
  });

program.description('By default builds for all platforms').action(() => {
  main(program.opts());
});

program.parse(process.argv);
