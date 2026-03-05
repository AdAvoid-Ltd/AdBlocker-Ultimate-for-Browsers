import { throttle } from 'lodash-es';

import { MessageType, sendMessage } from '../../../common/messages';
import { logger } from '../../../common/logger';

import { ContextMenuService } from './context-menu';
import { FramesService } from './frames';
import { IconsService } from './icons';

export class UiService {
  static #THROTTLE_DELAY_MS = 100;

  static #throttledUpdateAction = throttle((tabId, frameData) => {
    IconsService.updateTabAction(tabId, frameData);
    UiService.#broadcastTotalBlockedMessage(tabId, frameData);
  }, UiService.#THROTTLE_DELAY_MS);

  static async update(tabContext) {
    const frameData = FramesService.getMainFrameData(tabContext);

    await ContextMenuService.throttledUpdateMenu(frameData);

    const tabId = tabContext.info.id;
    UiService.#throttledUpdateAction(tabId, frameData);
  }

  static async #broadcastTotalBlockedMessage(tabId, frameData) {
    const { totalBlocked, totalBlockedTab } = frameData;

    try {
      await sendMessage({
        type: MessageType.UpdateTotalBlocked,
        data: {
          tabId,
          totalBlocked,
          totalBlockedTab,
        },
      });
    } catch (e) {
      logger.info('Failed to broadcast total blocked message:', e);
    }
  }
}
