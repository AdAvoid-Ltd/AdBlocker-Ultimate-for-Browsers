import { logger } from '../../common/logger';
import { MessageType } from '../../common/messages';
import { messageHandler } from '../message-handler';
import { engine } from '../engine';
import { AllowlistService, TabsApi } from '../services';
import { ContextMenuAction, contextMenuEvents } from '../events';

export class AllowlistController {
  static init() {
    messageHandler.addListener(MessageType.GetAllowlistDomains, AllowlistController.#onGetAllowlistDomains);
    messageHandler.addListener(MessageType.SaveAllowlistDomains, AllowlistController.#handleDomainsSave);
    messageHandler.addListener(
      MessageType.AddAllowlistDomainForTabId,
      AllowlistController.#onAddAllowlistDomainForTabId,
    );
    messageHandler.addListener(MessageType.RemoveAllowlistDomain, AllowlistController.#onRemoveAllowlistDomain);

    contextMenuEvents.addListener(
      ContextMenuAction.SiteFilteringOn,
      AllowlistController.#enableSiteFilteringFromContextMenu,
    );

    contextMenuEvents.addListener(
      ContextMenuAction.SiteFilteringOff,
      AllowlistController.#disableSiteFilteringFromContextMenu,
    );
  }

  static #onGetAllowlistDomains() {
    return AllowlistService.getAllowlistDomains().join('\n');
  }

  static async #onAddAllowlistDomainForTabId(message) {
    const { tabId } = message.data;

    await AllowlistService.disableTabFiltering(tabId);
  }

  static async #onRemoveAllowlistDomain(message) {
    const { tabId, tabRefresh } = message.data;

    await AllowlistService.enableTabFiltering(tabId, tabRefresh);
  }

  static async #handleDomainsSave(message) {
    const { value } = message.data;

    // Handle both array and string inputs
    const domains = Array.isArray(value) ? value : value.split(/[\r\n]+/);

    AllowlistService.setAllowlistDomains(domains);

    await engine.update();
  }

  static async #enableSiteFilteringFromContextMenu() {
    const activeTab = await TabsApi.getActive();

    if (activeTab?.id) {
      await AllowlistService.enableTabFiltering(activeTab.id, true);
    } else {
      logger.warn(
        '[ext.AllowlistController.enableSiteFilteringFromContextMenu]: cannot open site report page for active tab, active tab is undefined',
      );
    }
  }

  static async #disableSiteFilteringFromContextMenu() {
    const activeTab = await TabsApi.getActive();

    if (activeTab?.id) {
      await AllowlistService.disableTabFiltering(activeTab.id);
    } else {
      logger.warn(
        '[ext.AllowlistController.disableSiteFilteringFromContextMenu]: cannot open site report page for active tab, active tab is undefined',
      );
    }
  }
}
