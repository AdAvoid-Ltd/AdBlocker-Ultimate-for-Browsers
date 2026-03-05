import browser from 'webextension-polyfill';

import { logger } from '../../common/logger';
import {
  APP_MESSAGE_HANDLER_NAME,
  MessageType,
  messageHasTypeAndDataFields,
  messageHasTypeField,
} from '../../common/messages';

class Messenger {
  static async #sendMessage(type, data) {
    const response = await browser.runtime.sendMessage({
      handlerName: APP_MESSAGE_HANDLER_NAME,
      type,
      data,
    });

    return response;
  }

  static async createEventListener(events, callback, onUnloadCallback) {
    let listenerId;

    const response = await Messenger.#sendMessage(MessageType.CreateEventListener, { events });

    listenerId = response;

    const onUpdateListeners = async () => {
      const updatedResponse = await Messenger.#sendMessage(MessageType.CreateEventListener, { events });

      listenerId = updatedResponse;
    };

    browser.runtime.onMessage.addListener((message) => {
      if (!messageHasTypeField(message)) {
        logger.error('Received message in Messenger.createEventListener has no type field: ', message);
        return undefined;
      }

      if (message.type === MessageType.NotifyListeners) {
        if (!messageHasTypeAndDataFields(message)) {
          logger.error('Received message with type MessageType.NotifyListeners has no data: ', message);
          return undefined;
        }

        const castedMessage = message;

        const [type, ...data] = castedMessage.data;

        if (events.includes(type)) {
          callback({ type, data });
        }
      }
      if (message.type === MessageType.UpdateListeners) {
        onUpdateListeners();
      }
    });

    const onUnload = () => {
      if (!listenerId) {
        return;
      }

      Messenger.#sendMessage(MessageType.RemoveListener, { listenerId });

      listenerId = null;

      if (typeof onUnloadCallback === 'function') {
        onUnloadCallback();
      }
    };

    window.addEventListener('beforeunload', onUnload);
    window.addEventListener('unload', onUnload);

    return onUnload;
  }

  static async updateListeners() {
    return Messenger.#sendMessage(MessageType.UpdateListeners);
  }

  static async getOptionsData() {
    return Messenger.#sendMessage(MessageType.GetOptionsData);
  }

  static async changeUserSetting(settingId, value) {
    await Messenger.#sendMessage(MessageType.ChangeUserSettings, {
      key: settingId,
      value,
    });
  }

  static async enableFilter(filterId) {
    return Messenger.#sendMessage(MessageType.AddAndEnableFilter, { filterId });
  }

  static async disableFilter(filterId) {
    return Messenger.#sendMessage(MessageType.DisableFilter, { filterId });
  }

  static async getUserRules() {
    return Messenger.#sendMessage(MessageType.GetUserRules);
  }

  static async saveUserRules(value) {
    await Messenger.#sendMessage(MessageType.SaveUserRules, { value });
  }

  static async getAllowlist() {
    return Messenger.#sendMessage(MessageType.GetAllowlistDomains);
  }

  static async saveAllowlist(value) {
    await Messenger.#sendMessage(MessageType.SaveAllowlistDomains, { value });
  }

  static async updateFilters() {
    if (__IS_MV3__) {
      logger.debug('Filters update is not supported in MV3');
      return [];
    }

    return Messenger.#sendMessage(MessageType.CheckFiltersUpdate);
  }

  static async updateGroupStatus(id, enabled) {
    const type = enabled ? MessageType.EnableFiltersGroup : MessageType.DisableFiltersGroup;
    const groupId = Number.parseInt(id, 10);

    return Messenger.#sendMessage(type, { groupId });
  }

  static async checkCustomUrl(url) {
    return Messenger.#sendMessage(MessageType.LoadCustomFilterInfo, { url });
  }

  static async addCustomFilter(filter) {
    return Messenger.#sendMessage(MessageType.SubscribeToCustomFilter, { filter });
  }

  static async removeCustomFilter(filterId) {
    await Messenger.#sendMessage(MessageType.RemoveAntiBannerFilter, { filterId });
  }

  static async getIsEngineStarted() {
    return Messenger.#sendMessage(MessageType.GetIsEngineStarted);
  }

  static async getTabInfoForPopup(tabId) {
    return Messenger.#sendMessage(MessageType.GetTabInfoForPopup, { tabId });
  }

  static async openSettingsTab() {
    return Messenger.#sendMessage(MessageType.OpenSettingsTab);
  }

  static async openAssistant() {
    return Messenger.#sendMessage(MessageType.OpenAssistant);
  }

  static async removeAllowlistDomain(tabId, tabRefresh) {
    return Messenger.#sendMessage(MessageType.RemoveAllowlistDomain, { tabId, tabRefresh });
  }

  static async addAllowlistDomain(tabId) {
    return Messenger.#sendMessage(MessageType.AddAllowlistDomainForTabId, { tabId });
  }

  static async addUserRule(ruleText) {
    await Messenger.#sendMessage(MessageType.AddUserRule, { ruleText });
  }

  static async removeUserRule(ruleText) {
    await Messenger.#sendMessage(MessageType.RemoveUserRule, { ruleText });
  }

  static async canEnableStaticFilter(filterId) {
    return Messenger.#sendMessage(MessageType.CanEnableStaticFilterMv3, { filterId });
  }

  static async canEnableStaticGroup(groupId) {
    return Messenger.#sendMessage(MessageType.CanEnableStaticGroupMv3, { groupId });
  }

  static async getCurrentLimits() {
    return Messenger.#sendMessage(MessageType.CurrentLimitsMv3);
  }

  static async addUrlToTrusted(url) {
    return Messenger.#sendMessage(MessageType.AddUrlToTrusted, { url });
  }

  static async openChromeExtensionsPage() {
    return Messenger.#sendMessage(MessageType.OpenChromeExtensionsSettingsPage);
  }

  static async openExtensionDetailsPage() {
    return Messenger.#sendMessage(MessageType.OpenExtensionDetailsPage);
  }
}

export { Messenger };
