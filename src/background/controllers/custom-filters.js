import { EventType } from '../../common/constants';
import { MessageType } from '../../common/messages';
import { CustomFilterService } from '../services/filters/custom';
import { messageHandler } from '../message-handler';
import { eventBus } from '../event-bus';
import { engine } from '../engine';

export class CustomFiltersController {
  static init() {
    messageHandler.addListener(MessageType.LoadCustomFilterInfo, CustomFiltersController.onCustomFilterInfoLoad);

    messageHandler.addListener(MessageType.SubscribeToCustomFilter, CustomFiltersController.onCustomFilterSubscription);
    messageHandler.addListener(MessageType.RemoveAntiBannerFilter, CustomFiltersController.onCustomFilterRemove);
  }

  static async onCustomFilterInfoLoad(message) {
    const { url, title } = message.data;

    return CustomFilterService.getFilterInfo(url, title);
  }

  static async onCustomFilterSubscription(message) {
    const { filter } = message.data;

    const { customUrl, name, trusted } = filter;

    // Creates a filter and enables the group if necessary.
    const filterMetadata = await CustomFilterService.createFilter({
      customUrl,
      title: name,
      trusted,
      enabled: true,
    });

    if (__IS_MV3__) {
      await engine.update();
    } else {
      engine.debounceUpdate();
    }

    eventBus.emit(EventType.CustomFilterAdded);
    return filterMetadata;
  }

  // If the filter was enabled, the engine will be updated.
  static async onCustomFilterRemove(message) {
    const { filterId } = message.data;

    const wasEnabled = await CustomFilterService.removeFilter(filterId);
    if (wasEnabled) {
      if (__IS_MV3__) {
        await engine.update();
      } else {
        engine.debounceUpdate();
      }
    }
  }
}
