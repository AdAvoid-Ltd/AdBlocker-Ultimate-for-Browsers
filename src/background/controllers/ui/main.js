import browser from 'webextension-polyfill';

import {
  tabsApi as tsWebExtTabsApi,
  defaultFilteringLog,
  FilteringEventType,
} from '../../tswebextension';
import { SHOW_RATE_US_POPUP_KEY } from '../../storage-keys';
import { logger } from '../../../common/logger';
import { messageHandler } from '../../message-handler';
import { MessageType } from '../../../common/messages';
import {
  toasts,
  TabsApi,
  PagesService,
  AssistantService,
  ContextMenuService,
  UiService,
  PageStatsService,
  FeedbackService,
  InstallService,
} from '../../services';
import { browserModel } from '../../models';
import { ContextMenuAction, contextMenuEvents } from '../../events';

export class UiController {
  static #blockedCountIncrement = 1;

  /**
   * For MV3, handlers should be registered on the top level in sync functions,
   * otherwise they may not work or work incorrectly.
   */
  static syncInit() {
    if (browser.contextMenus) {
      ContextMenuService.init();
    }

    contextMenuEvents.addListener(ContextMenuAction.OpenSettings, PagesService.openSettingsPage);
    contextMenuEvents.addListener(ContextMenuAction.ComplaintWebsite, UiController.#openAbusePageForActiveTab);
    contextMenuEvents.addListener(ContextMenuAction.BlockSiteAds, AssistantService.openAssistant);
    contextMenuEvents.addListener(ContextMenuAction.DevShowRateUs, UiController.#devShowRateUs);
    contextMenuEvents.addListener(ContextMenuAction.DevShowAlert, UiController.#devShowAlert);
    contextMenuEvents.addListener(ContextMenuAction.DevShowRulesLimits, UiController.#devShowRulesLimits);
  }

  static async init() {
    await toasts.init();

    UiController.#maybeShowRateUsPopup();

    messageHandler.addListener(MessageType.OpenSettingsTab, PagesService.openSettingsPage);

    messageHandler.addListener(MessageType.OpenAbuseTab, UiController.#openAbusePage);

    messageHandler.addListener(MessageType.OpenExtensionStore, PagesService.openExtensionStorePage);
    messageHandler.addListener(
      MessageType.OpenChromeExtensionsSettingsPage,
      PagesService.openChromeExtensionsSettingsPage,
    );
    messageHandler.addListener(MessageType.OpenExtensionDetailsPage, PagesService.openExtensionDetailsPage);

    messageHandler.addListener(MessageType.OpenAssistant, AssistantService.openAssistant);

    messageHandler.addListener(MessageType.SendFeedback, UiController.#sendFeedback);

    messageHandler.addListener(MessageType.OpenRulesLimitsTab, PagesService.openRulesLimitsPage);
    messageHandler.addListener(MessageType.ScriptletCloseWindow, PagesService.closePage);

    tsWebExtTabsApi.onCreate.subscribe(UiService.update);
    tsWebExtTabsApi.onUpdate.subscribe(UiService.update);
    tsWebExtTabsApi.onActivate.subscribe(UiService.update);

    defaultFilteringLog.addEventListener(FilteringEventType.ApplyBasicRule, UiController.#onBasicRuleApply);
  }

  static async #openAbusePage({ data }) {
    const { url } = data;

    await PagesService.openAbusePage(url);
  }

  static async #sendFeedback({ data }) {
    await FeedbackService.sendFeedback(data);
  }

  static async #devShowRateUs() {
    await toasts.showRateUsPopup();
  }

  static async #devShowAlert() {
    await toasts.showAlertMessage('[DEV] Alert', 'Test alert message');
  }

  static async #devShowRulesLimits() {
    await toasts.showRuleLimitsAlert();
  }

  // If rate-us is eligible (day after install, not yet dismissed), marks as shown and shows popup.
  static async #maybeShowRateUsPopup() {
    const showRateUsPopup = await browserModel.get(SHOW_RATE_US_POPUP_KEY);
    if (showRateUsPopup === false) {
      return;
    }

    const isDayAfter = await InstallService.isDayAfterInstall();
    if (!isDayAfter) {
      return;
    }

    await browserModel.set(SHOW_RATE_US_POPUP_KEY, false);
    await toasts.showRateUsPopup();
  }

  static async #openAbusePageForActiveTab() {
    const activeTab = await TabsApi.getActive();

    if (activeTab?.url) {
      await PagesService.openAbusePage(activeTab.url);
    } else {
      logger.warn(
        '[ext.UiController.openAbusePageForActiveTab]: cannot open abuse page for active tab, active tab is undefined',
      );
    }
  }

  static async #onBasicRuleApply({ data }) {
    const { isAllowlist, tabId } = data;

    // If rule is not blocking, ignore it
    if (isAllowlist) {
      return;
    }

    // Always increment total blocked count
    PageStatsService.incrementTotalBlocked(UiController.#blockedCountIncrement);

    const tabContext = tsWebExtTabsApi.getTabContext(tabId);

    // If tab context is not found, do not update request blocking counter and icon badge for tab
    if (!tabContext) {
      return;
    }

    await UiService.update(tabContext);
  }
}
