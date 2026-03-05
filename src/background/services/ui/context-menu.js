import browser from 'webextension-polyfill';
import { nanoid } from 'nanoid';
import { throttle } from 'lodash-es';

import { OPTIONS_PAGE } from '../../../common/constants';
import { getMessage } from '../../../common/i18n';
import {
  ContextMenuAction,
  contextMenuEvents,
  settingsEvents,
} from '../../events';
import { SettingOption } from '../../storage-keys.js';
import { SettingsService } from '../settings';

const createMenu = (props) => {
  return new Promise((resolve, reject) => {
    browser.contextMenus.create(props, () => {
      if (browser.runtime.lastError) {
        reject(browser.runtime.lastError);
        return;
      }
      resolve();
    });
  });
};

export class ContextMenuService {
  static init() {
    settingsEvents.addListener(SettingOption.ShowContextMenu, ContextMenuService.#handleShowContextMenu);
    browser.contextMenus.onClicked.addListener(async (onClickData) => {
      await contextMenuEvents.publishEvent(onClickData.menuItemId);
    });
  }

  /**
   * Throttled #updateMenu.
   * Used in because #updateMenu can be called multiple times from various event listeners, but
   * context menu doesn't require fast update.
   */
  static throttledUpdateMenu = throttle(ContextMenuService.#updateMenu, 100);

  static async #updateMenu({ urlFilteringDisabled, documentAllowlisted, userAllowlisted, canAddRemoveRule, url }) {
    if (!browser.contextMenus) {
      return;
    }

    // Clean up context menu just in case.
    await ContextMenuService.#removeAll();

    // There is nothing to do if context menu is disabled
    if (!SettingsService.getSetting(SettingOption.ShowContextMenu)) {
      return;
    }

    // Used no to show settings menu item on the options page
    const isOptionsPage = !!url?.startsWith(browser.runtime.getURL(OPTIONS_PAGE));

    try {
      if (urlFilteringDisabled) {
        await ContextMenuService.#addUrlFilteringDisabledContextMenuAction(isOptionsPage);
      } else {
        if (documentAllowlisted && !userAllowlisted) {
          await ContextMenuService.#addMenuItem(ContextMenuAction.SiteException);
        } else if (canAddRemoveRule) {
          if (documentAllowlisted) {
            await ContextMenuService.#addMenuItem(ContextMenuAction.SiteFilteringOn);
          } else {
            await ContextMenuService.#addMenuItem(ContextMenuAction.SiteFilteringOff);
          }
        }
        await ContextMenuService.#addSeparator();

        if (!documentAllowlisted) {
          await ContextMenuService.#addMenuItem(ContextMenuAction.BlockSiteAds);
        }

        await ContextMenuService.#addMenuItem(ContextMenuAction.ComplaintWebsite);
        await ContextMenuService.#addSeparator();
        if (!__IS_MV3__) {
          await ContextMenuService.#addMenuItem(ContextMenuAction.UpdateFilters);
          await ContextMenuService.#addSeparator();
        }
        if (!isOptionsPage) {
          await ContextMenuService.#addMenuItem(ContextMenuAction.OpenSettings);
        }
        await ContextMenuService.#addMenuItem(ContextMenuAction.OpenLog);

        if (!IS_RELEASE) {
          await ContextMenuService.#addSeparator();
          await ContextMenuService.#addMenuItem(ContextMenuAction.DevShowRateUs);
          await ContextMenuService.#addMenuItem(ContextMenuAction.DevShowAlert);
          await ContextMenuService.#addMenuItem(ContextMenuAction.DevShowRulesLimits);
        }
      }
    } catch (e) {
      // do nothing
    }
  }

  static async #removeAll() {
    await browser.contextMenus.removeAll();
  }

  // Creates menu items for the context menu, displayed, when app filtering disabled for current tab.
  static async #addUrlFilteringDisabledContextMenuAction(isOptionsPage) {
    // Disabled because it's just informational inactive button
    await ContextMenuService.#addMenuItem(ContextMenuAction.SiteFilteringDisabled, { enabled: false });
    await ContextMenuService.#addSeparator();
    if (!isOptionsPage) {
      await ContextMenuService.#addMenuItem(ContextMenuAction.OpenSettings);
    }
    if (!__IS_MV3__) {
      await ContextMenuService.#addMenuItem(ContextMenuAction.OpenLog);
      await ContextMenuService.#addMenuItem(ContextMenuAction.UpdateFilters);
    }
    if (!IS_RELEASE) {
      await ContextMenuService.#addSeparator();
      await ContextMenuService.#addMenuItem(ContextMenuAction.DevShowRateUs);
      await ContextMenuService.#addMenuItem(ContextMenuAction.DevShowAlert);
      await ContextMenuService.#addMenuItem(ContextMenuAction.DevShowRulesLimits);
    }
  }

  static async #addMenuItem(action, options = {}) {
    const { messageArgs, ...rest } = options;

    await createMenu({
      id: action,
      contexts: ['all'],
      title: getMessage(action, messageArgs ?? []),
      ...rest,
    });
  }

  static async #addSeparator() {
    await createMenu({
      id: nanoid(), // required for Firefox
      type: 'separator',
      contexts: ['all'],
    });
  }

  static async #handleShowContextMenu(enabled) {
    // handle only disable menu, anyway user switch tab button, after enabling
    if (!enabled) {
      await ContextMenuService.#removeAll();
    }
  }
}
