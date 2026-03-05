/* eslint-disable no-console */

/**
 * By the rules of AMO, we cannot use remote scripts (and our JS rules can be counted as such).
 * Because of that, we use the following approach (that was accepted by AMO reviewers):
 *
 * 1. We pre-build JS rules from filters into the add-on (see the file called "local_script_rules.json").
 * 2. At runtime we check every JS rule if it is included into "local_script_rules.json".
 *    If it is included we allow this rule to work since it is pre-built. Other rules are discarded.
 * 3. We also allow "User rules" and "Custom filters" to work since those rules are added manually by the user.
 *    This way filters maintainers can test new rules before including them in the filters.
 */
import { promises as fs } from 'node:fs';
import { exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert';
import path from 'node:path';
import crypto from 'node:crypto';

import { minify } from 'terser';
import { some } from 'lodash-es';

import { CosmeticRuleType, RuleCategory } from '@adguard/agtree';
import { defaultParserOptions, FilterListParser } from '@adguard/agtree/parser';
import { CosmeticRuleBodyGenerator } from '@adguard/agtree/generator';

import {
  AssetsFiltersBrowser,
  FILTERS_DEST,
  LOCAL_SCRIPT_RULES_COMMENT_CHROME_MV3,
  LOCAL_SCRIPT_RULES_COMMENT,
  FILTER_IDS,
} from '../constants.js';

import { extractPreprocessedRawFilterList, readMetadataRuleSet } from './filter-extractor.js';

const exec = promisify(execCallback);

// Add these helper functions after imports
const AG_FUNCTION_REGEX = /var\s+(AG_[a-zA-Z0-9_]+)\s*=\s*function/;
const AG_USAGE_REGEX = /AG_[a-zA-Z0-9_]+/g;

const LF = '\n';

const LOCAL_SCRIPT_RULES_FILE_NAME = 'local_script_rules.js';

const extractAgFunctionName = (code) => {
  const match = code.match(AG_FUNCTION_REGEX);

  if (!match) {
    return null;
  }

  return match[1] || null;
};

const findAgFunctionUsages = (code) => {
  const matches = code.match(AG_USAGE_REGEX) || [];
  return [...new Set(matches)];
};

const updateLocalScriptRulesForBrowser = async (browser) => {
  const folder = FILTERS_DEST.replace('%browser', browser);
  const rules = {
    comment: LOCAL_SCRIPT_RULES_COMMENT,
    rules: {},
  };

  for (const filterId of FILTER_IDS) {

    const rawFilterList = (await fs.readFile(`${folder}/filter_${filterId}.txt`)).toString();
    const filterListNode = FilterListParser.parse(rawFilterList, {
      ...defaultParserOptions,
      includeRaws: false,
      isLocIncluded: false,
      tolerant: true,
    });

    filterListNode.children.forEach((ruleNode) => {
      if (ruleNode.category === RuleCategory.Cosmetic && ruleNode.type === CosmeticRuleType.JsInjectionRule) {
        /**
         * Re-generate raw body to make it consistent with TSUrlFilter rule instances
         * (TSUrlFilter also re-generates body from AST in the cosmetic rule constructor)
         */
        const rawBody = CosmeticRuleBodyGenerator.generate(ruleNode);
        const permittedDomains = [];
        const restrictedDomains = [];

        ruleNode.domains.children.forEach((domainNode) => {
          if (domainNode.exception) {
            restrictedDomains.push(domainNode.value);
          } else {
            permittedDomains.push(domainNode.value);
          }
        });

        const toPush = {
          permittedDomains,
          restrictedDomains,
        };

        if (rules.rules[rawBody] === undefined) {
          rules.rules[rawBody] = [toPush];
        } else if (!some(rules.rules[rawBody], toPush)) {
          rules.rules[rawBody].push(toPush);
        }
      }
    });
  }

  await fs.writeFile(
    `${FILTERS_DEST.replace('%browser', browser)}/local_script_rules.json`,
    JSON.stringify(rules, null, 4),
  );
};

const beautifyComment = (rawComment) => {
  return `/**
${rawComment
  .split(LF)
  .map((line) => (line ? ` * ${line}` : ' *'))
  .join(LF)}
 */`;
};

const calculateUniqueId = (text) => {
  return crypto.createHash('md5').update(text).digest('hex');
};

const wrapScriptCode = (uniqueId, code) => {
  return `
        try {
            const flag = 'done';
            if (Window.prototype.toString["${uniqueId}"] === flag) {
                return;
            }
            ${code}
            Object.defineProperty(Window.prototype.toString, "${uniqueId}", {
                value: flag,
                enumerable: false,
                writable: false,
                configurable: false
            });
        } catch (error) {
            console.error('Error executing AG js rule with uniqueId "${uniqueId}" due to: ' + error);
        }
    `;
};

/**
 * Beautifies a raw js-file content, saves it to the file and runs validation.
 *
 * @param rawContent Raw content.
 * @param fileName JS file name.
 */
const saveToJsFile = async (rawContent, fileName) => {
  const beautifiedJsContent = (
    await minify(rawContent, {
      mangle: false,
      compress: false,
      format: {
        beautify: true,
        comments: true,
        indent_level: 4,
      },
    })
  ).code;

  if (!beautifiedJsContent) {
    throw new Error(`Failed to minify JS content for saving to ${fileName}`);
  }

  try {
    await fs.writeFile(
      `${FILTERS_DEST.replace('%browser', AssetsFiltersBrowser.ChromiumMv3)}/${fileName}`,
      beautifiedJsContent,
    );

    // Run validation with ES modules support
    const result = await exec(
      `npx tsx ${FILTERS_DEST.replace('%browser', AssetsFiltersBrowser.ChromiumMv3)}/${fileName}`,
    );
    assert.ok(result.stderr === '', 'No errors during execution');
    assert.ok(result.stdout === '', 'No output during execution');
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};

/**
 * It is possible to follow all places using this logic by searching `JS_RULES_EXECUTION`.
 */
const updateLocalScriptRulesForChromiumMv3 = async (jsRules) => {
  const processedRules = [];
  const errors = [];
  const agFunctions = new Map();

  // First pass: extract AG_ functions
  jsRules.forEach((rule) => {
    const agFunctionName = extractAgFunctionName(rule);
    if (agFunctionName) {
      agFunctions.set(agFunctionName, rule);
      // Remove this rule from further processing as it's a utility function
      jsRules.delete(rule);
    }
  });

  // Second pass: process remaining rules

  for (const rule of jsRules) {
    try {
      const ruleKey = JSON.stringify(rule);
      let processedCode = rule;

      // Check if this rule uses any AG_ functions
      const usedAgFunctions = findAgFunctionUsages(rule);
      if (usedAgFunctions.length > 0) {
        // Simply prepend the required AG functions to the rule
        const requiredFunctions = [];
        usedAgFunctions.forEach((funcName) => {
          const code = agFunctions.get(funcName);
          if (code) {
            requiredFunctions.push(code);
          }
        });

        // insert required functions before the rule to make sure they are available
        processedCode = `${requiredFunctions.join(LF)}${LF}${rule}`;
      }

      /**
       * Unique ID is needed to prevent multiple execution of the same script.
       *
       * It may happen when script rules are being applied on WebRequest.onResponseStarted
       * and WebNavigation.onCommitted events which are independent of each other,
       * so we need to make sure that the script is executed only once.
       */
      const uniqueId = calculateUniqueId(rule);

      // wrap the code with a try-catch block with extra checking to avoid multiple executions
      processedCode = wrapScriptCode(uniqueId, processedCode);

      const minified = await minify(processedCode, {
        compress: {
          sequences: false,
        },
        parse: {
          bare_returns: true,
        },
        format: {
          beautify: true,
          indent_level: 4,
        },
      });

      if (minified.code) {
        processedRules.push(`${ruleKey}: () => {${minified.code}}`);
      } else {
        errors.push(`Was not able to minify rule: ${rule}`);
      }
    } catch (error) {
      errors.push(`Skipping invalid rule: ${rule}; Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const jsFileContent = `${beautifyComment(LOCAL_SCRIPT_RULES_COMMENT_CHROME_MV3)}
export const localScriptRules = { ${processedRules.join(`,${LF}`)} };${LF}`;

  await saveToJsFile(jsFileContent, LOCAL_SCRIPT_RULES_FILE_NAME);
};

export const updateLocalResourcesForChromiumMv3 = async () => {
  const folder = path.join(FILTERS_DEST.replace('%browser', AssetsFiltersBrowser.ChromiumMv3), 'declarative');

  const metadataRuleSet = await readMetadataRuleSet(folder);
  const ruleSetIds = metadataRuleSet.getRuleSetIds();

  const jsRules = new Set();

  for (const ruleSetId of ruleSetIds) {
    const rawFilterList = await extractPreprocessedRawFilterList(ruleSetId, folder);
    const filterListNode = FilterListParser.parse(rawFilterList, {
      ...defaultParserOptions,
      includeRaws: false,
      isLocIncluded: false,
      tolerant: true,
    });

    filterListNode.children.forEach((ruleNode) => {
      if (ruleNode.category === RuleCategory.Cosmetic && ruleNode.type === CosmeticRuleType.JsInjectionRule) {
        const rawBody = CosmeticRuleBodyGenerator.generate(ruleNode);
        jsRules.add(rawBody);
      }
    });
  }

  await updateLocalScriptRulesForChromiumMv3(jsRules);
};

export const updateLocalScriptRulesForFirefox = async () => {
  await updateLocalScriptRulesForBrowser(AssetsFiltersBrowser.Firefox);
};
