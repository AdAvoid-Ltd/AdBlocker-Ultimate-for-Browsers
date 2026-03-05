/* eslint-disable no-console */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import fse from 'fs-extra';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const ACTIVE_PROMOTIONS_PATH = path.join(PROJECT_ROOT, 'src/common/constants/promotions.active.js');
const PROMOTIONS_DIR = path.join(PROJECT_ROOT, 'src/resources/promotions');
const TEMP_ASSETS_DIR = path.join(PROJECT_ROOT, 'src/assets/images/promotional');

const REQUIRED_FIELDS = ['id', 'nameKey', 'startDate', 'endDate', 'buttonTextKey', 'linkUrl', 'titleKey'];

const validateConfig = (config, promoId) => {
  for (const field of REQUIRED_FIELDS) {
    if (!(field in config) || config[field] === null || config[field] === undefined) {
      throw new Error(
        `Invalid promotion config for "${promoId}": missing required field "${field}"`,
      );
    }
  }

  if (config.id !== promoId) {
    throw new Error(
      `Promotion ID mismatch: config has "${config.id}" but expected "${promoId}"`,
    );
  }
};

const resolveAssetPath = async (promoAssetsDir, assetFilename, assetType) => {
  if (!assetFilename) {
    return null;
  }

  const assetPath = path.join(promoAssetsDir, assetFilename);
  const assetExists = await fse.pathExists(assetPath);

  if (!assetExists) {
    const assets = await fse.readdir(promoAssetsDir);
    const matchedAsset = assets.find((a) => a.toLowerCase() === assetFilename.toLowerCase());

    if (matchedAsset) {
      console.log(
        `⚠ Warning: Asset filename case mismatch. Config has "${assetFilename}", using "${matchedAsset}"`,
      );
      return `assets/images/promotional/${matchedAsset}`;
    }

    throw new Error(
      `Asset not found: ${assetPath}\n`
        + `The ${assetType} "${assetFilename}" specified in config.json does not exist in the assets directory.`,
    );
  }

  return `assets/images/promotional/${assetFilename}`;
};

const resizeIcon = async (iconPath, outputDir, baseName) => {
  const sizes = [16, 19, 24, 32, 38, 48, 128];
  const iconPaths = {};

  for (const size of sizes) {
    const iconSizePath = path.join(outputDir, `${baseName}-${size}.png`);

    await sharp(iconPath)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(iconSizePath);

    iconPaths[`icon${size}`] = `assets/images/promotional/${baseName}-${size}.png`;
  }

  console.log(
    `✓ Generated resized icons: ${sizes.map((s) => `${baseName}-${s}.png`).join(', ')}`,
  );

  return iconPaths;
};

const cleanPromotionFiles = async () => {
  const emptyPromotionsCode = `/**
 * Active promotion configuration (generated at build time)
 * This file is empty when no promotion is active
 */

export const PROMOTIONS = [];

/**
 * Get the currently active promotion based on current UTC date
 * @returns {Object|null} The active promotion object or null if no promotion is active
 */
export const getActivePromotion = () => {
  return null;
};
`;

  await fse.writeFile(ACTIVE_PROMOTIONS_PATH, emptyPromotionsCode, 'utf-8');
  console.log('✓ Created empty promotions.active.js (no active promotion)');

  if (await fse.pathExists(TEMP_ASSETS_DIR)) {
    await fse.emptyDir(TEMP_ASSETS_DIR);
  }
};

export const processPromotion = async (promoId) => {
  if (!promoId) {
    await cleanPromotionFiles();
    return;
  }

  console.log(`Processing promotion: ${promoId}`);

  const promoConfigPath = path.join(PROMOTIONS_DIR, 'config.json');
  if (!(await fse.pathExists(promoConfigPath))) {
    throw new Error(
      `Promotion config not found: ${promoConfigPath}\n`
        + 'Please ensure config.json exists in: src/resources/promotions/config.json',
    );
  }

  let promotionsArray;
  try {
    const configContent = await fse.readFile(promoConfigPath, 'utf-8');
    const parsed = JSON.parse(configContent);

    if (!Array.isArray(parsed)) {
      throw new Error('config.json must be an array of promotion objects');
    }

    if (parsed.length === 0) {
      throw new Error('config.json array is empty');
    }

    promotionsArray = parsed;
  } catch (error) {
    throw new Error(
      `Failed to parse promotion config: ${promoConfigPath}\n${error.message}`,
    );
  }

  const promotion = promotionsArray.find((p) => p.id === promoId);

  if (!promotion) {
    const availableIds = promotionsArray.map((p) => p.id).join(', ');
    throw new Error(
      `Promotion "${promoId}" not found in config.json. Available promotions: ${availableIds}`,
    );
  }

  validateConfig(promotion, promoId);

  if (promotion.iconImage) {
    const promoAssetsDir = path.join(PROMOTIONS_DIR, promoId);
    const iconPath = path.join(promoAssetsDir, promotion.iconImage);
    if (!(await fse.pathExists(iconPath))) {
      throw new Error(
        `Promotional banner icon not found: ${iconPath}\nPlease ensure iconImage exists in: src/resources/promotions/${promoId}/`,
      );
    }
  }

  if (promotion.actionIcon) {
    const promoAssetsDir = path.join(PROMOTIONS_DIR, promoId);
    const actionIconPath = path.join(promoAssetsDir, promotion.actionIcon);
    if (!(await fse.pathExists(actionIconPath))) {
      throw new Error(
        `Promotional action icon not found: ${actionIconPath}\nPlease ensure actionIcon exists in: src/resources/promotions/${promoId}/`,
      );
    }
  }

  const promoAssetsDir = path.join(PROMOTIONS_DIR, promoId);
  if (!(await fse.pathExists(promoAssetsDir))) {
    throw new Error(
      `Promotional assets directory not found: ${promoAssetsDir}\nPlease ensure assets are in: src/resources/promotions/${promoId}/`,
    );
  }

  const backgroundImagePath = await resolveAssetPath(
    promoAssetsDir,
    promotion.backgroundImage,
    'backgroundImage',
  );

  const bannerIconPath = promotion.iconImage
    ? await resolveAssetPath(promoAssetsDir, promotion.iconImage, 'iconImage')
    : null;

  await fse.ensureDir(TEMP_ASSETS_DIR);
  await fse.emptyDir(TEMP_ASSETS_DIR);

  let resizedActionIcons = null;
  if (promotion.actionIcon) {
    const actionIconFile = path.join(promoAssetsDir, promotion.actionIcon);
    if (!(await fse.pathExists(actionIconFile))) {
      throw new Error(`Action icon file not found: ${actionIconFile}`);
    }

    const actionIconBaseName = path.parse(promotion.actionIcon).name;
    resizedActionIcons = await resizeIcon(actionIconFile, TEMP_ASSETS_DIR, actionIconBaseName);
  }

  const updatedPromotion = {
    ...promotion,
    backgroundImage: backgroundImagePath,
    iconImage: bannerIconPath,
    ...(resizedActionIcons && {
      actionIcon16: resizedActionIcons.icon16,
      actionIcon19: resizedActionIcons.icon19,
      actionIcon24: resizedActionIcons.icon24,
      actionIcon32: resizedActionIcons.icon32,
      actionIcon38: resizedActionIcons.icon38,
      actionIcon48: resizedActionIcons.icon48,
      actionIcon128: resizedActionIcons.icon128,
    }),
  };

  const assets = await fse.readdir(promoAssetsDir);
  for (const asset of assets) {
    if (asset === promotion.actionIcon) {
      continue;
    }
    const srcPath = path.join(promoAssetsDir, asset);
    const destPath = path.join(TEMP_ASSETS_DIR, asset);
    await fse.copy(srcPath, destPath);
    console.log(`✓ Copied asset: ${asset}`);
  }

  const finalPromotionsCode = `/**
 * Active promotion configuration (generated at build time)
 * This file contains only the promotion specified during build
 */

export const PROMOTIONS = ${JSON.stringify([updatedPromotion], null, 2)};

/**
 * Get the currently active promotion based on current UTC date
 * Promotions run from 00:00:00 UTC to 23:59:59 UTC on their specified dates
 * @returns {Object|null} The active promotion object or null if no promotion is active
 */
export const getActivePromotion = () => {
  const now = new Date();
  const utcYear = now.getUTCFullYear();
  const utcMonth = String(now.getUTCMonth() + 1).padStart(2, '0');
  const utcDay = String(now.getUTCDate()).padStart(2, '0');
  const todayStr = utcYear + '-' + utcMonth + '-' + utcDay;

  for (const promo of PROMOTIONS) {
    if (todayStr >= promo.startDate && todayStr <= promo.endDate) {
      return promo;
    }
  }

  return null;
};
`;

  await fse.writeFile(ACTIVE_PROMOTIONS_PATH, finalPromotionsCode, 'utf-8');
  console.log(`✓ Promotion "${promoId}" processed successfully`);
};
