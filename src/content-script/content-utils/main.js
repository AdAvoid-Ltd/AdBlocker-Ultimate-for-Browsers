import { MessageType } from '../../common/messages/constants';

import { messageHandler } from './message-handler';
import { Popups } from './popups';

export class ContentUtils {
  /**
   * IMPORTANT! It is intentionally async so it can be called without await
   * to not slow down frames loading in Firefox.
   */
  static async init() {
    if (window !== window.top) {
      return;
    }

    if (!(document instanceof Document)) {
      return;
    }

    messageHandler.init();

    messageHandler.addListener(MessageType.ShowAlertPopup, Popups.showAlertPopup);
    messageHandler.addListener(MessageType.ShowRuleLimitsAlert, Popups.showRuleLimitsAlert);
    messageHandler.addListener(MessageType.ShowRateUsPopup, Popups.showRateUsPopup);
  }
}
