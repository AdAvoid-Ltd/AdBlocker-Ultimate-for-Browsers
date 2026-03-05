import { CUSTOM_FILTERS_START_ID } from '../../common/constants';

export function isCustomFilter(filterId) {
  return filterId >= CUSTOM_FILTERS_START_ID;
}
