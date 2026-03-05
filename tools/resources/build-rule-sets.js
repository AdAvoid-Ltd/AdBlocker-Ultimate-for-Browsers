import { convertFilters } from '@adguard/tsurlfilter/cli';

import { WEB_ACCESSIBLE_RESOURCES_OUTPUT_REDIRECTS } from '../../constants.js';
import {
  FILTERS_DEST,
  DECLARATIVE_FILTERS_DEST,
  AssetsFiltersBrowser,
} from '../constants.js';

const convert = async (browser) => {
  const filtersDir = FILTERS_DEST.replace('%browser', browser);
  const declarativeFiltersDir = `${DECLARATIVE_FILTERS_DEST.replace('%browser', browser)}`;
  await convertFilters(filtersDir, `/${WEB_ACCESSIBLE_RESOURCES_OUTPUT_REDIRECTS}`, declarativeFiltersDir, {
    debug: true,
    prettifyJson: false,
  });
};

export const convertFiltersToRulesets = async () => {
  await convert(AssetsFiltersBrowser.ChromiumMv3);
};
