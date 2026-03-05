import path from 'node:path';
import { promises as fsp } from 'node:fs';

import { BUILD_ENV, BUILD_PATH } from '../constants.js';
import packageJson from '../../package.json' with { type: 'json' };

import { getEnvConf } from './helpers.js';

const config = getEnvConf(BUILD_ENV);
const OUTPUT_PATH = config.outputPath;

const content = `version=${packageJson.version}`;
const FILE_NAME = 'build.txt';

const filePath = path.join(BUILD_PATH, OUTPUT_PATH, FILE_NAME);

/**
 * Writes build.txt file with current version
 *
 * @returns Promise which resolves when the file is written.
 */
export const buildInfo = async () => {
  await fsp.writeFile(filePath, content, 'utf-8');
};
