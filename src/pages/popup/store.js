import { signal, computed } from '@preact/signals';
import browser from 'webextension-polyfill';

import { Messenger } from '../services/messenger';
import { TabsApi } from '../../background/browser-api/tabs';
import { getMessage } from '../../common/i18n';
import {
  MessageType,
  messageHasTypeField,
  messageHasTypeAndDataFields,
} from '../../common/messages';

// Model State

const extensionBaseUrl = browser.runtime.getURL('');
const activeTab = signal(null);
const tabInfo = signal(null);
export const initialLoadDone = signal(false);

const frameInfo = computed(() => tabInfo.value?.frameInfo);
export const enableChecked = computed(() => !(frameInfo.value?.documentAllowlisted ?? false));

export const isWebSiteTab = computed(() =>
  frameInfo.value ? !frameInfo.value.urlFilteringDisabled : false,
);

export const desktopAppActive = computed(() => tabInfo.value?.options?.desktopAppActive ?? false);
export const desktopAppInstalled = computed(() => tabInfo.value?.options?.desktopAppInstalled ?? false);
export const totalBlockedTab = computed(() => frameInfo.value?.totalBlockedTab ?? 0);
export const totalBlocked = computed(() => frameInfo.value?.totalBlocked ?? 0);
export const documentAllowlisted = computed(() => frameInfo.value?.documentAllowlisted ?? false);
export const isFilteringPossible = computed(() => frameInfo.value?.isFilteringPossible ?? false);
export const canAddRemoveRule = computed(() => frameInfo.value?.canAddRemoveRule ?? false);
export const activeTabId = computed(() => activeTab.value?.id);

export const statusText = computed(() => {
  const securePageText = getMessage('popup_secure_page');
  const protectionEnabledText = getMessage('popup_protection_enabled');
  const protectionDisabledText = getMessage('popup_protection_disabled');

  return !isWebSiteTab.value
    ? securePageText
    : enableChecked.value
      ? protectionEnabledText
      : protectionDisabledText;
});

export const tabUrlDisplay = computed(() => {
  const tabUrl = activeTab.value?.url || '';

  if (tabUrl.startsWith(extensionBaseUrl)) {
    return 'AdBlocker Ultimate';
  }

  const domain = frameInfo.value?.domainName;

  if (domain) {
    return domain;
  }

  try {
    const url = new URL(tabUrl);
    return url.hostname.replace(/^www\./, '') || '';
  } catch {
    return '';
  }
});

async function loadPopupData() {
  try {
    const tab = await TabsApi.getActive();
    activeTab.value = tab;

    if (!tab) {
      return;
    }

    const info = await Messenger.getTabInfoForPopup(tab.id);
    if (info?.frameInfo) {
      tabInfo.value = info;
    }
  } finally {
    initialLoadDone.value = true;
  }
}

browser.runtime.onMessage.addListener((message) => {
  if (!messageHasTypeField(message)) {
    return;
  }

  if (message.type === MessageType.AppInitialized) {
    loadPopupData();

    return;
  }

  if (message.type === MessageType.UpdateTotalBlocked && messageHasTypeAndDataFields(message)) {
    const { tabId, totalBlockedTab, totalBlocked } = message.data;

    if (tabId === activeTab.value?.id) {
      tabInfo.value = {
        ...tabInfo.value,
        frameInfo: {
          ...tabInfo.value?.frameInfo,
          totalBlockedTab,
          totalBlocked,
        },
      };
    }
  }
});

// Optimistic Updates

export function setDocumentAllowlisted(allowlisted) {
  const current = tabInfo.value;
  if (!current?.frameInfo) {
    return;
  }

  tabInfo.value = {
    ...current,
    frameInfo: {
      ...current.frameInfo,
      documentAllowlisted: allowlisted,
    },
  };
}

// UI State

export const infoHover = signal(false);

// Initialization

loadPopupData();
