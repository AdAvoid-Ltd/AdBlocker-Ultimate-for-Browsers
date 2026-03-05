import { RuleGenerator } from '@adguard/agtree';

import {
  getDomain,
  isHttpRequest,
  MAIN_FRAME_ID,
} from '../../tswebextension';
import { AntiBannerFiltersId } from '../../../common/constants';
import { appContext, AppContextKey } from '../../app/context';
import { PageStatsService } from '../page-stats';
import { engine } from '../../engine';

export class FramesService {
  static getMainFrameData({ info, frames, blockedRequestCount, mainFrameRule }) {
    const mainFrame = frames.get(MAIN_FRAME_ID);

    const url = info?.url || mainFrame?.url || null;

    const domainName = url ? getDomain(url) : null;

    const urlFilteringDisabled = !url || !isHttpRequest(url);

    const isFilteringPossible = appContext.get(AppContextKey.IsInit) && !urlFilteringDisabled;

    let frameRule = null;
    let documentAllowlisted = false;
    let userAllowlisted = false;
    let canAddRemoveRule = false;

    const totalBlocked = PageStatsService.getTotalBlocked();

    const totalBlockedTab = blockedRequestCount;

    if (isFilteringPossible) {
      documentAllowlisted = !!mainFrameRule && mainFrameRule.isFilteringDisabled();
      if (documentAllowlisted && mainFrameRule) {
        const filterId = mainFrameRule.getFilterListId();

        userAllowlisted = filterId === AntiBannerFiltersId.UserFilterId
          || filterId === AntiBannerFiltersId.AllowlistFilterId;

        const ruleNode = engine.api.retrieveRuleNode(mainFrameRule.getFilterListId(), mainFrameRule.getIndex());

        let ruleText = '<Cannot retrieve rule text>';

        if (ruleNode) {
          ruleText = RuleGenerator.generate(ruleNode);
        }

        frameRule = {
          filterId,
          ruleText,
        };
      }
      // It means site in exception
      canAddRemoveRule = !(documentAllowlisted && !userAllowlisted);
    }

    return {
      url,
      isFilteringPossible,
      domainName,
      urlFilteringDisabled,
      documentAllowlisted,
      userAllowlisted,
      canAddRemoveRule,
      frameRule,
      totalBlockedTab,
      totalBlocked,
    };
  }
}
