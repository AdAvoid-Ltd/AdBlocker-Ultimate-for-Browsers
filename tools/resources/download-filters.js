import path from 'node:path';
import fs from 'node:fs';
import crypto from 'crypto';
import { fileURLToPath } from 'node:url';

import fse from 'fs-extra';
import axios from 'axios';

import { cliLog } from '../cli-log.js';
import {
  FILTERS_DEST,
  AssetsFiltersBrowser,
  FILTERS_MV3,
  FILTERS_MV2,
  getFilterDownloadUrl,
} from '../constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const METADATA_FILE_NAME = 'filters.json';
const METADATA_SOURCE_PATH = path.resolve(__dirname, '../filters-metadata.json');

const CHECKSUM_PATTERN = /^\s*!\s*checksum[\s-:]+([\w\+/=]+).*[\r\n]+/i;

/**
 * Get filter download URLs.
 * @param {boolean} isMv3 - Whether to get MV3 filters (14) or MV2 filters (29)
 */
const getFilterDownloadUrls = (isMv3 = false) => {
  const filters = [];
  const filterList = isMv3 ? FILTERS_MV3 : FILTERS_MV2;

  for (const filter of filterList) {
    filters.push({
      url: getFilterDownloadUrl(filter),
      fileName: `filter_${filter.id}.txt`,
      validate: false,
    });
  }

  return filters;
};

const normalizeResponse = (response) => {
  const partOfResponse = response.substring(0, 200);
  const match = partOfResponse.match(CHECKSUM_PATTERN);
  if (match) {
    response = response.replace(match[0], '');
  }
  response = response.replace(/\r/g, '');
  response = response.replace(/\n+/g, '\n');
  return response;
};

export const calculateChecksum = (body) => {
  return crypto.createHash('md5').update(normalizeResponse(body)).digest('base64').replace(/=/g, '');
};

const validateChecksum = (resourceData, body) => {
  const partOfResponse = body.substring(0, 200);
  const checksumMatch = partOfResponse.match(CHECKSUM_PATTERN);

  if (!checksumMatch || !checksumMatch[1]) {
    cliLog.error(`Filter rules from ${resourceData.url} does not contain a checksum ${partOfResponse}`);
    return;
  }

  const bodyChecksum = calculateChecksum(body);

  if (bodyChecksum !== checksumMatch[1]) {
    cliLog.error(`Wrong checksum: found ${bodyChecksum}, expected ${checksumMatch[1]}`);
  }

  cliLog.info('Checksum is valid');
};

const downloadFilter = async (resourceData, browser) => {
  const { url, fileName, validate } = resourceData;

  const filtersDir = FILTERS_DEST.replace('%browser', browser);

  fse.ensureDirSync(filtersDir);

  cliLog.info(`Downloading ${url}...`);

  const response = await axios.get(url, { responseType: 'arraybuffer' });

  const content = response.data.toString();

  if (validate) {
    validateChecksum(resourceData, content);
  }

  await fs.promises.writeFile(path.join(filtersDir, fileName), response.data);

  cliLog.info('Done');

  return content;
};

/**
 * Copy filters metadata JSON to the filters directory.
 */
const copyMetadata = async (browser) => {
  const filtersDir = FILTERS_DEST.replace('%browser', browser);
  fse.ensureDirSync(filtersDir);

  const destPath = path.join(filtersDir, METADATA_FILE_NAME);
  await fse.copyFile(METADATA_SOURCE_PATH, destPath);
  cliLog.info(`Copied metadata to ${destPath}`);
};

/**
 * Download filters for a specific browser (MV2: Edge, Firefox).
 * Downloads all 29 filters for MV2 browsers.
 */
const downloadFiltersForBrowser = async (browser) => {
  cliLog.info(`Downloading filters for ${browser} (MV2 - 29 filters)...`);

  await copyMetadata(browser);

  const urls = getFilterDownloadUrls(false);
  for (const resourceData of urls) {
    await downloadFilter(resourceData, browser);
  }
};

/**
 * Download filters for MV3 (Chromium).
 * Downloads raw filter files that will be converted to declarative rulesets.
 * Downloads only 14 core filters for MV3.
 */
export const downloadFiltersForMv3 = async () => {
  const browser = AssetsFiltersBrowser.ChromiumMv3;
  cliLog.info(`Downloading filters for ${browser} (MV3 - 14 filters)...`);

  await copyMetadata(browser);

  const urls = getFilterDownloadUrls(true);
  for (const resourceData of urls) {
    await downloadFilter(resourceData, browser);
  }
};

/**
 * Main entry point for downloading filters.
 */
export const downloadFilters = async () => {
  await downloadFiltersForBrowser(AssetsFiltersBrowser.Edge);
  await downloadFiltersForBrowser(AssetsFiltersBrowser.Firefox);
  await downloadFiltersForMv3();
};
