import { AntiBannerFiltersId } from '../../common/constants';

import { isCustomFilter } from './custom-filter-utils';

export class CommonFilterUtils {
  static isCommonFilter(filterId) {
    return !isCustomFilter(filterId) && filterId !== AntiBannerFiltersId.UserFilterId
      && filterId !== AntiBannerFiltersId.AllowlistFilterId;
  }

  static isRegularFilterMetadata(filter) {
    return CommonFilterUtils.isCommonFilter(filter.filterId);
  }
}
