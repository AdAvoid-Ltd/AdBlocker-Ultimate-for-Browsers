import { logger } from '../../../common/logger';
import { engine } from '../../engine';
import { TabsApi } from '../../browser-api';

export class AssistantService {
  static async openAssistant() {
    const activeTab = await TabsApi.getActive();

    if (!activeTab?.id) {
      logger.warn('Cannot open assistant in active tab');
      return;
    }

    try {
      await engine.api.openAssistant(activeTab.id);
    } catch (e) {
      logger.warn('Cannot open assistant in active tab due to: ', e);
    }
  }
}
