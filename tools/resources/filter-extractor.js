import { readFile } from 'fs/promises';

import { METADATA_RULESET_ID, MetadataRuleSet } from '@adguard/tsurlfilter/es/declarative-converter';
import { getRuleSetPath } from '@adguard/tsurlfilter/es/declarative-converter-utils';

export const readMetadataRuleSet = async (folder) => {
  const metadataRuleSetPath = getRuleSetPath(METADATA_RULESET_ID, folder);
  const content = await readFile(metadataRuleSetPath, 'utf-8');
  return MetadataRuleSet.deserialize(content);
};

export const extractPreprocessedRawFilterList = async (ruleSetId, folder) => {
  const ruleSetPath = getRuleSetPath(ruleSetId, folder);
  const rawRuleSetContent = await readFile(ruleSetPath, 'utf-8');
  const ruleSetContent = JSON.parse(rawRuleSetContent);

  return ruleSetContent[0].metadata.rawFilterList;
};
