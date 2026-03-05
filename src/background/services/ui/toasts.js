import browser from 'webextension-polyfill';

import { getMessage } from '../../../common/i18n';
import { logger } from '../../../common/logger';
import { TabsApi } from '../../browser-api';
import { sendTabMessage, MessageType } from '../../../common/messages';

import { buildUrl, Endpoint } from './url-builder';

const StylesAssetsPath = {
  AlertPopup: '/assets/css/alert-popup.css',
  AlertContainer: '/assets/css/alert-container.css',
  RulesLimitsPopup: '/assets/css/rules-limits-popup.css',
  RulesLimitsContainer: '/assets/css/rules-limits-container.css',
  RateUsPopup: '/assets/css/rate-us-popup.css',
  RateUsContainer: '/assets/css/rate-us-container.css',
};

class Toasts {
  static #MAX_TRIES = 500;

  static #TRIES_TIMEOUT_MS = 5000; // 5 sec

  #styles = new Map();

  async init() {
    const tasks = Object.values(StylesAssetsPath).map(async (path) => {
      const url = browser.runtime.getURL(path);
      const response = await fetch(url);
      const styles = await response.text();
      this.#styles.set(path, styles);
    });

    await Promise.all(tasks);
  }

  async showRuleLimitsAlert(triesCount = 1) {
    try {
      if (triesCount > Toasts.#MAX_TRIES) {
        // Give up
        logger.warn('[ext.Toasts.showRuleLimitsAlert]: reached max tries on attempts to show rule limits alert popup.');
        return;
      }

      const alertStyles = this.#styles.get(StylesAssetsPath.RulesLimitsPopup);
      const alertContainerStyles = this.#styles.get(StylesAssetsPath.RulesLimitsContainer);

      if (!alertStyles || !alertContainerStyles) {
        logger.error('[ext.Toasts.showRuleLimitsAlert]: alert assets is not loaded!');
        return;
      }

      const tab = await TabsApi.getActive();
      if (tab?.id) {
        const mainText = getMessage('snack_on_websites_limits_exceeded_warning');
        const linkText = getMessage('options_rule_limits');

        await sendTabMessage(tab.id, {
          type: MessageType.ShowRuleLimitsAlert,
          data: {
            isExtensionTab: TabsApi.isExtensionTab(tab),
            mainText,
            linkText,
            alertStyles,
            alertContainerStyles,
          },
        });
      }
    } catch (e) {

      self.setTimeout(() => {
        this.showRuleLimitsAlert(triesCount + 1);
      }, Toasts.#TRIES_TIMEOUT_MS);
    }
  }

  async showRateUsPopup(triesCount = 1) {
    try {
      if (triesCount > Toasts.#MAX_TRIES) {
        logger.warn('[ext.Toasts.showRateUsPopup]: reached max tries.');
        return;
      }

      const alertStyles = this.#styles.get(StylesAssetsPath.RateUsPopup);
      const alertContainerStyles = this.#styles.get(StylesAssetsPath.RateUsContainer);

      if (!alertStyles || !alertContainerStyles) {
        logger.error('[ext.Toasts.showRateUsPopup]: rate-us assets not loaded.');
        return;
      }

      const tab = await TabsApi.getActive();
      if (!tab?.id) {
        self.setTimeout(() => this.showRateUsPopup(triesCount + 1), Toasts.#TRIES_TIMEOUT_MS);
        return;
      }

      const assetsUrl = browser.runtime.getURL('assets/images');
      const strings = {
        shield_hooray: getMessage('shield_hooray'),
        shield_adfree_browsing_achieved: getMessage('shield_adfree_browsing_achieved'),
        shield_do_you_like_abu: getMessage('shield_do_you_like_abu'),
        yes: getMessage('yes'),
        no: getMessage('no'),
        shield_rate_txt: getMessage('shield_rate_txt'),
        shield_rate_us: getMessage('shield_rate_us'),
        shield_no_thanks: getMessage('shield_no_thanks'),
        shield_tell_how_to_improve: getMessage('shield_tell_how_to_improve'),
        shield_message: getMessage('shield_message'),
        shield_email: getMessage('shield_email'),
        shield_send_feedback: getMessage('shield_send_feedback'),
        shield_thank_you: getMessage('shield_thank_you'),
      };

      await sendTabMessage(tab.id, {
        type: MessageType.ShowRateUsPopup,
        data: {
          isExtensionTab: TabsApi.isExtensionTab(tab),
          alertStyles,
          alertContainerStyles,
          strings,
          assetsUrl,
          rateExtensionUrl: buildUrl(Endpoint.RateExtension),
        },
      });
    } catch (e) {
      self.setTimeout(() => this.showRateUsPopup(triesCount + 1), Toasts.#TRIES_TIMEOUT_MS);
    }
  }

  async showAlertMessage(title, text, triesCount = 1) {
    try {
      if (triesCount > Toasts.#MAX_TRIES) {
        // Give up
        logger.warn('[ext.Toasts.showAlertMessage]: reached max tries on attempts to show alert popup');
        return;
      }

      const tab = await TabsApi.getActive();
      const alertStyles = this.#styles.get(StylesAssetsPath.AlertPopup);
      const alertContainerStyles = this.#styles.get(StylesAssetsPath.AlertContainer);

      if (!alertStyles || !alertContainerStyles) {
        logger.error('[ext.Toasts.showAlertMessage]: alert assets styles are not loaded!');
        return;
      }

      if (tab?.id) {
        await sendTabMessage(tab.id, {
          type: MessageType.ShowAlertPopup,
          data: {
            isExtensionTab: TabsApi.isExtensionTab(tab),
            title,
            text,
            alertStyles,
            alertContainerStyles,
          },
        });
      }
    } catch (e) {

      self.setTimeout(() => {
        this.showAlertMessage(title, text, triesCount + 1);
      }, Toasts.#TRIES_TIMEOUT_MS);
    }
  }

  showFiltersEnabledAlertMessage(filters) {
    const { title, text } = Toasts.#getFiltersEnabledResultMessage(filters);

    this.showAlertMessage(title, text);
  }

  showFiltersUpdatedAlertMessage(success, filters) {
    const { title, text } = Toasts.#getFiltersUpdateResultMessage(success, filters);

    this.showAlertMessage(title, text);
  }

  static #getFiltersEnabledResultMessage(enabledFilters) {
    const title = getMessage('alert_popup_filter_enabled_title');

    const text = enabledFilters
      .sort((a, b) => a.displayNumber - b.displayNumber)
      .map((filter) => getMessage('alert_popup_filter_enabled_desc', [filter.name]));

    return {
      title,
      text,
    };
  }

  static #getFiltersUpdateResultMessage(success, updatedFilters) {
    if (!success || !updatedFilters) {
      return {
        title: getMessage('options_popup_update_title_error'),
        text: getMessage('options_popup_update_error'),
      };
    }

    const title = '';

    if (updatedFilters.length === 0) {
      return {
        title,
        text: getMessage('options_popup_update_not_found'),
      };
    }

    let text = updatedFilters
      .sort((a, b) => {
        if (a.groupId === b.groupId) {
          return a.displayNumber - b.displayNumber;
        }
        return Number(a.groupId === b.groupId);
      })
      .map((filter) => `${filter.name}`)
      .join(', ');

    if (updatedFilters.length > 1) {
      text += ` ${getMessage('options_popup_update_filters')}`;
    } else {
      text += ` ${getMessage('options_popup_update_filter')}`;
    }

    return {
      title,
      text,
    };
  }
}

export const toasts = new Toasts();
