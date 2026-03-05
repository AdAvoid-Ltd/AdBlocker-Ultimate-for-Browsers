import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { merge } from 'webpack-merge';

import { Redirects } from '@adguard/scriptlets/redirects';

import packageJson from '../package.json' with { type: 'json' };
import { WEB_ACCESSIBLE_RESOURCES_OUTPUT_REDIRECTS } from '../constants.js';

import { BuildTargetEnv, Browser } from './constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Retrieves the sha value for the click2load.html redirects resource.
 * This value is needed to ensure that the extension's Content Security Policy (CSP)
 * includes the correct sha value, which is used to verify
 * that scripts loaded via the redirect are legitimate and have not been tampered with.
 *
 * This hash is not for a remote script, but for an inline script inside the local resource:
 * web-accessible-resources/redirects/click2load.html.
 * This web resource is used for replacing iframe content,
 * i.e. it inherits the CSP of the parent page.
 * It may disable the inline script inside unless an exclusion is specified in the manifest.
 */
const getClickToLoadSha = () => {
  const redirectsYamlPath = path.resolve(
    __dirname,
    `../src/resources/${WEB_ACCESSIBLE_RESOURCES_OUTPUT_REDIRECTS}.yml`,
  );
  const rawYaml = fs.readFileSync(redirectsYamlPath);
  const redirects = new Redirects(rawYaml.toString());
  const click2loadSource = redirects.getRedirect('click2load.html');

  if (!click2loadSource || !click2loadSource.sha) {
    throw new Error('click2load.html redirect source not found');
  }

  return click2loadSource.sha;
};

/**
 * Returns the content security policy for the given environment and browser.
 *
 * @param env The build environment.
 * @param browser The target browser.
 */
const getEnvPolicy = (env, browser) => {
  switch (browser) {
    case Browser.ChromeMv3:
      return {
        content_security_policy: {
          extension_pages: "script-src 'self'; object-src 'self'",
        },
      };
    default:
      return env === BuildTargetEnv.Dev
        ? {
          content_security_policy: `script-src 'self' 'unsafe-eval' '${getClickToLoadSha()}'; object-src 'self'`,
        }
        : {
          content_security_policy: `script-src 'self' '${getClickToLoadSha()}'; object-src 'self'`,
        };
  }
};

/**
 * Updates a manifest object with new values and returns the updated manifest.
 * Version and name are taken from package.json.
 */
const updateManifest = (buildEnv, browser, targetPart, addedPart) => {
  const union = merge(targetPart, addedPart);

  const devPolicy = getEnvPolicy(buildEnv, browser);

  const manifestVersion = union.manifest_version || targetPart.manifest_version;
  const name = union.name || targetPart.name;

  return {
    version: packageJson.version,
    manifest_version: manifestVersion,
    name,
    ...devPolicy,
    ...union,
  };
};

export const updateManifestBuffer = (
  buildEnv,
  browser,
  targetPart,
  addedPart,
) => {
  const target = JSON.parse(targetPart.toString());

  const result = updateManifest(buildEnv, browser, target, addedPart);

  return Buffer.from(JSON.stringify(result, null, 4));
};

const capitalize = (str) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const getNameSuffix = (buildEnv, browser) => {
  switch (browser) {
    case Browser.FirefoxAmo: {
      if (buildEnv === BuildTargetEnv.Beta) {
        return ' (Beta)';
      }
      if (buildEnv === BuildTargetEnv.Dev) {
        return ' (AMO Dev)';
      }
      break;
    }
    case Browser.ChromeMv3: {
      if (buildEnv === BuildTargetEnv.Beta) {
        return ' (Beta)';
      }
      if (buildEnv === BuildTargetEnv.Dev) {
        return ' (Dev)';
      }
      break;
    }
    default:
      if (buildEnv !== BuildTargetEnv.Release) {
        return ` (${capitalize(buildEnv)})`;
      }
      break;
  }
  return '';
};

export const updateLocalesMSGName = (content, env, browser) => {
  const suffix = getNameSuffix(env, browser);

  const messages = JSON.parse(content.toString());
  messages.name.message += suffix;

  return JSON.stringify(messages, null, 4);
};
