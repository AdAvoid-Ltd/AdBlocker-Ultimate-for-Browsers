import { logger } from '../../common/logger';

export const ContextMenuAction = {
  SiteProtectionDisabled: 'context_site_protection_disabled',
  SiteFilteringDisabled: 'context_site_filtering_disabled',
  SiteException: 'context_site_exception',
  BlockSiteAds: 'context_block_site_ads',
  SecurityReport: 'context_security_report',
  ComplaintWebsite: 'context_complaint_website',
  SiteFilteringOn: 'context_site_filtering_on',
  SiteFilteringOff: 'context_site_filtering_off',
  EnableProtection: 'context_enable_protection',
  DisableProtection: 'context_disable_protection',
  OpenSettings: 'context_open_settings',
  OpenLog: 'context_open_log',
  UpdateFilters: 'context_update_antibanner_filters',
  DevShowRateUs: 'dev_show_rate_us',
  DevShowAlert: 'dev_show_alert',
  DevShowRulesLimits: 'dev_show_rules_limits',
};

class ContextMenuEvents {
  #listenersMap = new Map();

  addListener(event, listener) {
    if (this.#listenersMap.has(event)) {
      throw new Error(`${event} listener has already been registered`);
    }

    this.#listenersMap.set(event, listener);
  }

  async publishEvent(event) {
    const listener = this.#listenersMap.get(event);

    if (!listener) {
      logger.error(`[ext.ContextMenuEvents.publishEvent]: contextMenuEvent not found listener for ${event}!`);
      return;
    }

    return Promise.resolve(listener());
  }

  removeListeners() {
    this.#listenersMap.clear();
  }
}

export const contextMenuEvents = new ContextMenuEvents();
