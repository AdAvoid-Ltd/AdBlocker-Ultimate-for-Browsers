import { signal, batch } from '@preact/signals';
import { debounce } from 'lodash';

import { Messenger } from '../services/messenger';
import {
  ALLOWLIST_RULE_REGEX,
  EventType,
  NEW_LINE_SEPARATOR,
} from '../../common/constants';

// Model State - Granular signals

export const filters = signal([]);
export const categories = signal([]);
export const settings = signal({});
export const filtersInfo = signal({ rulesCount: 0, latestCheckTime: 0 });
export const appVersion = signal('');

export const customRulesContent = signal('');
export const whitelistContent = signal('');
export const initialLoadDone = signal(false);

// Pending toggle tracking - prevents race conditions during optimistic updates

const pendingFilterToggles = new Map();
const pendingGroupToggles = new Map();

export async function loadOptionsData() {
  try {
    const data = await Messenger.getOptionsData();

    if (!data) {
      return data;
    }

    let newFilters = data.filtersMetadata?.filters ?? [];
    if (pendingFilterToggles.size > 0) {
      newFilters = newFilters.map((f) => {
        if (!pendingFilterToggles.has(f.filterId)) return f;
        const expected = pendingFilterToggles.get(f.filterId);
        if (f.enabled === expected) {
          pendingFilterToggles.delete(f.filterId);
          return f;
        }
        return { ...f, enabled: expected };
      });
    }

    let newCategories = data.filtersMetadata?.categories ?? [];
    if (pendingGroupToggles.size > 0) {
      newCategories = newCategories.map((c) => {
        if (!pendingGroupToggles.has(c.groupId)) return c;
        const expected = pendingGroupToggles.get(c.groupId);
        if (c.enabled === expected) {
          pendingGroupToggles.delete(c.groupId);
          return c;
        }
        return { ...c, enabled: expected };
      });
    }

    batch(() => {
      filters.value = newFilters;
      categories.value = newCategories;
      settings.value = data.settings ?? {};
      filtersInfo.value = data.filtersInfo ?? { rulesCount: 0, latestCheckTime: 0 };
      appVersion.value = data.appVersion ?? '';
    });

    return data;
  } finally {
    initialLoadDone.value = true;
  }
}

export function setFilterEnabled(filterId, enabled) {
  pendingFilterToggles.set(filterId, enabled);

  filters.value = filters.value.map((f) =>
    f.filterId === filterId ? { ...f, enabled } : f,
  );
}

export function setGroupEnabled(groupId, enabled) {
  pendingGroupToggles.set(groupId, enabled);

  categories.value = categories.value.map((c) =>
    c.groupId === groupId ? { ...c, enabled } : c,
  );
}

const debouncedLoadOptions = debounce(loadOptionsData, 300);

Messenger.createEventListener(
  [
    EventType.RequestFilterUpdated,
    EventType.FiltersUpdateCheckReady,
    EventType.UpdateAllowlistFilterRules,
    EventType.CustomFilterAdded,
    EventType.UserFilterUpdated,
  ],
  () => {
    debouncedLoadOptions();
  },
);

function parseCustomRules(userRulesText) {
  const lines = (userRulesText || '').split(NEW_LINE_SEPARATOR);

  return lines.filter((line) => {
    const trimmed = line.trim();

    return trimmed && !ALLOWLIST_RULE_REGEX.test(trimmed);
  });
}

async function loadEditorData() {
  const [userRulesRes, allowlistRes] = await Promise.all([
    Messenger.getUserRules(),
    Messenger.getAllowlist(),
  ]);

  const userRulesText = userRulesRes || '';
  const customRulesLines = parseCustomRules(userRulesText);

  const allowlistRaw = allowlistRes || '';
  const allowlistDomains = allowlistRaw
    ? allowlistRaw.split(NEW_LINE_SEPARATOR).filter((d) => d.trim())
    : [];

  customRulesContent.value = customRulesLines.join(NEW_LINE_SEPARATOR).trim();
  whitelistContent.value = allowlistDomains.join(NEW_LINE_SEPARATOR);
}

async function saveEditors() {
  const customRules = (customRulesContent.value ?? '').trim();
  const whitelistRaw = (whitelistContent.value ?? '').trim();
  const whitelistArray = whitelistRaw
    ? whitelistRaw.split(NEW_LINE_SEPARATOR).map((d) => d.trim()).filter(Boolean)
    : [];

  await Promise.all([
    Messenger.saveUserRules(customRules),
    Messenger.saveAllowlist(whitelistArray),
  ]);
}

export const debouncedSaveEditors = debounce(saveEditors, 475);

// UI State

export const TAB_KEYS = ['general', 'filters', 'custom', 'whitelist', 'about'];

function tabIndexFromHash() {
  const hash = location.hash.replace('#', '');
  const idx = TAB_KEYS.indexOf(hash);

  return idx >= 0 ? idx : 0;
}

export const activeTabIndex = signal(tabIndexFromHash());
export const pageAlert = signal({ message: '', visible: false });
export const modalAlert = signal({ message: '', visible: false });

export function switchTab(i) {
  activeTabIndex.value = i;
  history.replaceState(null, '', `#${TAB_KEYS[i]}`);
}

window.addEventListener('hashchange', () => {
  activeTabIndex.value = tabIndexFromHash();
});

export function showAlert(message, modal = false) {
  if (modal) {
    modalAlert.value = { message, visible: true };
  } else {
    pageAlert.value = { message, visible: true };
  }
}

export function dismissPageAlert() {
  pageAlert.value = { ...pageAlert.value, visible: false };
}

export function dismissModalAlert() {
  modalAlert.value = { ...modalAlert.value, visible: false };
}

export const addFilterModalOpen = signal(false);

// Initialization

loadOptionsData();
loadEditorData();
