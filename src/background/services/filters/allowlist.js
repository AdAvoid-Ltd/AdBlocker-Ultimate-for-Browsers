import { tabsApi as tsWebExtTabsApi, getDomain } from '../../tswebextension';
import { logger } from '../../../common/logger';
import { eventBus } from '../../event-bus';
import { allowlistDomainsModel } from '../../models';
import { engine } from '../../engine';
import { TabsApi } from '../../browser-api';
import { AntiBannerFiltersId, EventType } from '../../../common/constants';
import { UrlUtils } from '../../utils';

import { UserRulesService } from './userrules';

export class AllowlistService {
  static init() {
    AllowlistService.#initStorage(allowlistDomainsModel);
  }

  static getAllowlistDomains() {
    return AllowlistService.#getDomains(allowlistDomainsModel);
  }

  static setAllowlistDomains(domains) {
    AllowlistService.#setDomains(domains, allowlistDomainsModel);
  }

  static addAllowlistDomain(domain) {
    AllowlistService.#addDomain(domain, allowlistDomainsModel);
  }

  static removeAllowlistDomain(domain) {
    AllowlistService.#findAndRemoveMatchedDomainsAndSubdomainMasks(domain, allowlistDomainsModel);
  }

  static #findAndRemoveMatchedDomainsAndSubdomainMasks(domain, storage) {
    const domainsToCheck = AllowlistService.#getDomains(storage);

    // Firstly check for exactly same domains in allowlist.
    const domainsToRemove = domainsToCheck.filter((record) => record === domain);

    // Make a copy of parameter before editing.
    let domainToCheck = domain.split('').join('');
    // While we have at least one dot, check for possible upper mask domains.
    while (domainToCheck.indexOf('.') > -1) {
      // Domain can be match by upper-domain mask.
      domainToCheck = UrlUtils.getUpperLevelDomain(domainToCheck);

      const matchedSubDomainMasks = domainsToCheck.filter(
        // eslint-disable-next-line
        (record) => record === `*.${domainToCheck}`
      );

      domainsToRemove.push(...matchedSubDomainMasks);
    }

    domainsToRemove.forEach((d) => {
      AllowlistService.#removeDomain(d, storage);
    });
  }

  static async enableTabFiltering(tabId, tabRefresh = false) {
    const tabContext = tsWebExtTabsApi.getTabContext(tabId);

    if (!tabContext) {
      return;
    }

    const { mainFrameRule } = tabContext;

    if (!mainFrameRule) {
      return;
    }

    const filterId = mainFrameRule.getFilterListId();

    if (filterId === AntiBannerFiltersId.UserFilterId) {
      const ruleIndex = mainFrameRule.getIndex();
      await AllowlistService.#removeAllowlistRuleFromUserList(ruleIndex, tabId, tabRefresh);
      return;
    }

    const {
      info: { url },
    } = tabContext;

    if (url && filterId === AntiBannerFiltersId.AllowlistFilterId) {
      await AllowlistService.#enableTabUrlFiltering(url, tabId, tabRefresh);
    }
  }

  static async disableTabFiltering(tabId) {
    const tabContext = tsWebExtTabsApi.getTabContext(tabId);
    if (!tabContext) {
      return;
    }

    const {
      info: { url },
    } = tabContext;
    if (url) {
      await AllowlistService.#disableTabUrlFiltering(url, tabId);
    }
  }

  static async #enableTabUrlFiltering(url, tabId, tabRefresh = false) {
    const domain = getDomain(url);

    if (!domain) {
      return;
    }

    AllowlistService.removeAllowlistDomain(domain);

    await engine.update();

    if (tabRefresh) {
      await TabsApi.reload(tabId);
    }
  }

  static async #disableTabUrlFiltering(url, tabId) {
    const domain = getDomain(url);

    if (!domain) {
      return;
    }

    AllowlistService.addAllowlistDomain(domain);

    await engine.update();

    await TabsApi.reload(tabId);
  }

  static async #removeAllowlistRuleFromUserList(ruleIndex, tabId, tabRefresh = false) {
    await UserRulesService.removeUserRuleByIndex(ruleIndex);

    await engine.update();

    if (tabRefresh) {
      await TabsApi.reload(tabId);
    }
  }

  static #addDomain(domain, storage) {
    const domains = storage.getData();

    domains.push(domain);

    AllowlistService.#setDomains(domains, storage);
  }

  static #removeDomain(domain, storage) {
    const domains = storage.getData();

    AllowlistService.#setDomains(
      domains.filter((d) => d !== domain),
      storage,
    );
  }

  static #getDomains(storage) {
    return storage.getData();
  }

  static #setDomains(domains, storage) {
    // remove empty strings
    domains = domains.filter((domain) => !!domain);

    // remove duplicates
    domains = Array.from(new Set(domains));

    storage.setData(domains);

    eventBus.emit(EventType.UpdateAllowlistFilterRules);
  }

  static #initStorage(storage, defaultData = []) {
    try {
      const storageData = storage.read();
      if (typeof storageData === 'string') {
        const data = JSON.parse(storageData);
        storage.setCache(data);
      } else {
        storage.setData(defaultData);
      }
    } catch (e) {
      logger.warn(
        `Cannot parse ${storage.key} storage data from persisted storage, reset to default. Origin error: `,
        e,
      );
      storage.setData(defaultData);
    }
  }
}
