import browser from 'webextension-polyfill';

import { RulesLimitsController } from 'rules-limits-controller';

import { appContext, AppContextKey } from '../../app/context';
import { settingsModel } from '../../models';
import { SettingOption } from '../../storage-keys.js';
import { getIconImageData, TabsApi } from '../../browser-api';
import { getActivePromotion } from '../../../common/constants/promotions.active';
import { logger } from '../../../common/logger';
import { tabsApi as tsWebExtTabsApi } from '../../tswebextension';

import { browserAction } from './browser-action';
import { FramesService } from './frames';

const defaultIconVariants = {
  enabled: {
    19: browser.runtime.getURL('assets/icons/enabled-19.png'),
    38: browser.runtime.getURL('assets/icons/enabled-38.png'),
  },
  disabled: {
    19: browser.runtime.getURL('assets/icons/disabled-19.png'),
    38: browser.runtime.getURL('assets/icons/disabled-38.png'),
  },
  warning: {
    19: browser.runtime.getURL('assets/icons/warning-19.png'),
    38: browser.runtime.getURL('assets/icons/warning-38.png'),
  },
  loading: {
    19: browser.runtime.getURL('assets/icons/enabled-19.png'),
    38: browser.runtime.getURL('assets/icons/enabled-38.png'),
  },
};

const SetIconResult = {
  Resolved: 'resolved',
  Timeout: 'timeout',
};

class IconsService {
  static #BADGE_COLOR = '#555';

  /**
   * Flag to indicate if setIcon promise doesn't resolve (360 Browser).
   * If true, we skip awaiting setIcon calls.
   */
  static #setIconTimeoutDetected = false;

  static #SET_ICON_TIMEOUT_MS = 100;

  static async update() {
    const icon = await IconsService.#pickIconVariant();
    // Update all tabs icons
    const allTabs = await browser.tabs.query({});

    await Promise.allSettled(
      allTabs.map(async (tab) => {
        if (!tab.id) {
          return;
        }
        try {
          logger.trace(`[ext.IconsService.update]: updating icon for tab ${tab.id}`, icon);
          await IconsService.#setActionIcon(icon, tab.id);
        } catch (e) {
          logger.debug(`[ext.IconsService.update]: failed to update icon for tab ${tab.id}:`, e);
        }
      }),
    );

    const activeTab = await TabsApi.getActive();
    const tabId = activeTab?.id;
    if (!tabId) {
      return;
    }

    const tabContext = tsWebExtTabsApi.getTabContext(tabId);
    if (!tabContext) {
      return;
    }

    const frameData = FramesService.getMainFrameData(tabContext);

    try {
      await IconsService.updateTabAction(tabId, frameData);
    } catch (e) {
      logger.info(`[ext.IconsService.update]: failed to update tab icon for active tab ${tabId}:`, e);
    }
  }

  static async updateTabAction(tabId, frameData) {
    const { documentAllowlisted, totalBlockedTab } = frameData;

    // Determine extension's action new state based on the current tab state
    const icon = await IconsService.#pickIconVariant(documentAllowlisted);
    const badgeText = IconsService.#getBadgeText(totalBlockedTab, documentAllowlisted);

    // Set icon separately - don't let icon errors prevent badge updates
    try {
      await IconsService.#setActionIcon(icon, tabId);
    } catch (e) {
      logger.info(`[ext.IconsService.updateTabAction]: failed to update tab icon for tab ${tabId}:`, e);
    }

    // Set badge separately - this should work even if icon setting failed
    try {
      if (badgeText.length !== 0) {
        await browserAction.setBadgeBackgroundColor({ color: IconsService.#BADGE_COLOR });
        await browserAction.setBadgeText({ tabId, text: badgeText });
      }
    } catch (e) {
      logger.info(`[ext.IconsService.updateTabAction]: failed to update badge for tab ${tabId}:`, e);
    }
  }

  static async #setActionIcon(icon, tabId) {
    /**
     * For some reason browserAction.setIcon() promise is not resolved
     * in 360 browser MV3, the icon still sets correctly.
     * We use a timeout to avoid waiting indefinitely for the promise to resolve.
     * Once timeout is detected, we skip awaiting setIcon calls.
     */
    const setIconPromise = browserAction
      .setIcon({ imageData: await getIconImageData(icon), tabId })
      .then(() => SetIconResult.Resolved);

    if (IconsService.#setIconTimeoutDetected) {
      return;
    }

    let timeoutId;

    const timeoutPromise = new Promise((resolve) => {
      timeoutId = setTimeout(() => resolve(SetIconResult.Timeout), IconsService.#SET_ICON_TIMEOUT_MS);
    });

    const result = await Promise.race([setIconPromise, timeoutPromise]);

    if (result === SetIconResult.Timeout) {
      logger.info(
        '[ext.IconsService.setActionIcon]: setIcon promise did not resolve in time, likely 360 Browser. Skipping await for future calls.',
      );
      IconsService.#setIconTimeoutDetected = true;
    }
    clearTimeout(timeoutId);
  }

  /**
   * Picks the icon variant based on the current extension state.
   * Fallbacks to default icon variants if the current icon variants are not provided.
   *
   * Order of priority:
   * 1. Loading icon if the extension is not initialized yet.
   * 2. Warning icon if MV3 filter limits are exceeded.
   * 3. Enabled/Disabled icon based on the isDisabled parameter.
   */
  static async #pickIconVariant(isDisabled = false) {
    if (!appContext.get(AppContextKey.IsInit)) {
      return defaultIconVariants.loading;
    }

    const activePromo = getActivePromotion();
    if (activePromo?.actionIcon19 && !isDisabled) {
      return {
        19: browser.runtime.getURL(activePromo.actionIcon19),
        38: browser.runtime.getURL(activePromo.actionIcon38),
      };
    }

    const isMv3LimitsExceeded = __IS_MV3__ ? await RulesLimitsController.areFilterLimitsExceeded() : false;

    if (isMv3LimitsExceeded) {
      return defaultIconVariants.warning;
    }

    return isDisabled ? defaultIconVariants.disabled : defaultIconVariants.enabled;
  }

  static #getBadgeText(totalBlockedTab, isDisabled) {
    let totalBlocked;

    if (!isDisabled && settingsModel.get(SettingOption.ShowPageStats)) {
      totalBlocked = totalBlockedTab;
    } else {
      totalBlocked = 0;
    }

    if (totalBlocked === 0) {
      return '';
    }

    if (totalBlocked > 99) {
      return '\u221E'; // infinity symbol
    }

    return String(totalBlocked);
  }
}

export { IconsService };
