import { MessageType } from '../../../common/messages';
import { messageHandler } from '../../message-handler';
import { engine } from '../../engine';
import { Categories, SettingsService } from '../../services';
import { Prefs } from '../../prefs';
import { calculateLatestCheckTime } from '../../utils/calculate-latest-check-time';

export class SettingsController {
  static init() {
    messageHandler.addListener(MessageType.GetOptionsData, SettingsController.getOptionsData);
    messageHandler.addListener(MessageType.ChangeUserSettings, SettingsController.changeUserSettings);
  }

  static getOptionsData() {
    const filtersMetadata = Categories.getCategories();
    const filters = filtersMetadata.filters || [];
    const latestCheckTime = calculateLatestCheckTime(filters);

    return {
      settings: SettingsService.getData(),
      appVersion: Prefs.version,
      filtersInfo: {
        rulesCount: engine.api.getRulesCount(),
        latestCheckTime,
      },
      filtersMetadata,
    };
  }

  static async changeUserSettings(message) {
    const { key, value } = message.data;
    await SettingsService.setSetting(key, value);
  }
}
