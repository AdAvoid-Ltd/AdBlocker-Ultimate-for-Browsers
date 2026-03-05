import { useMemo } from 'preact/hooks';
import { useSignal, useComputed } from '@preact/signals';
import { Messenger } from '../../services/messenger';
import { getMessage } from '../../../common/i18n';
import { shouldShowUserScriptsApiWarning } from '../../../common/user-scripts-api';
import { UserAgent } from '../../../common/user-agent';
import { USER_SCRIPTS_API_MIN_CHROME_VERSION_REQUIRED, AntiBannerFiltersId } from '../../../common/constants';
import { isCustomFilter } from '../../../background/utils/custom-filter-utils';

import {
  activeTabIndex,
  filters,
  categories,
  loadOptionsData,
  showAlert,
  addFilterModalOpen,
  setFilterEnabled,
  setGroupEnabled,
} from '../store';
import { IconSearch } from '../../../resources/svg-icons';
import { getCategoryFromGroupId, filterFilters } from '../filters/utils';
import { FilterList } from './FilterList';

const LEARN_MORE_URL = 'https://developer.chrome.com/docs/extensions/reference/api/userScripts';

const CATEGORY_CONFIG = [
  { category: 'ad-blocking', groupId: 1, icon: '/assets/images/hand-icon.svg' },
  { category: 'privacy', groupId: 2, icon: '/assets/images/lock-icon.svg' },
  { category: 'security', groupId: 3, icon: '/assets/images/shield-icon-2.svg' },
  { category: 'language', groupId: 4, icon: '/assets/images/language-icon.svg' },
  { category: 'custom', groupId: 0, icon: '/assets/images/code-icon.svg' },
];

const FILTER_CATEGORIES = {
  'ad-blocking': 'Ad Blocking',
  privacy: 'Privacy',
  language: 'Language-specific',
  custom: 'Custom Filters',
  security: 'Security',
};

const CATEGORY_MESSAGE_KEYS = {
  'ad-blocking': 'filter_group_ad_blocking',
  privacy: 'filter_group_privacy',
  security: 'filter_group_security',
  language: 'filter_group_language_specific',
  custom: 'filter_group_custom_filters',
};

function getEnabledFiltersByCategory(filtersList) {
  return (filtersList || []).reduce((acc, filter) => {
    // Anti-circumvention is shown as a toggle in General settings tab
    if (filter.filterId === AntiBannerFiltersId.AntiCircumventionFilterId) {
      return acc;
    }

    if (!filter.enabled) {
      return acc;
    }

    const category = getCategoryFromGroupId(filter.groupId);

    if (!category) {
      return acc;
    }

    if (!Array.isArray(acc[category])) {
      acc[category] = []
    };

    acc[category].push(filter.name || '');

    return acc;
  }, {});
}

export function FiltersTab() {
  const className = useComputed(() =>
    `tabs__content ${activeTabIndex.value === 1 ? 'active' : ''}`,
  );

  const search = useSignal({ category: '', query: '', status: '' });

  const filteredFilters = useComputed(() => filterFilters(filters.value, search.value));
  const enabledByCategory = useComputed(() => getEnabledFiltersByCategory(filters.value));

  const hasSearch = useComputed(() => {
    const s = search.value;
    return !!(s.category || s.query || s.status);
  });

  const categoryEnabled = (groupId) => categories.value.find((c) => c.groupId === groupId)?.enabled ?? false;

  const showUserScriptsWarning = useMemo(() => shouldShowUserScriptsApiWarning(), []);
  const shouldEnableDevMode = useMemo(() => {
    const chromeVersion = UserAgent.isChromium ? Number(UserAgent.version) : null;
    return chromeVersion != null &&
      chromeVersion < USER_SCRIPTS_API_MIN_CHROME_VERSION_REQUIRED.ALLOW_USER_SCRIPTS_TOGGLE;
  }, []);
  const showAddFilterButton = hasSearch.value && search.value.category === 'custom' && !showUserScriptsWarning;

  const handleFilterToggle = async (filter) => {
    const shouldEnable = !filter.enabled;
    if (__IS_MV3__ && shouldEnable && !isCustomFilter(filter.filterId)) {
      const result = await Messenger.canEnableStaticFilter(filter.filterId);

      if (!result.ok) {
        showAlert('snack_on_websites_limits_exceeded_warning', false);

        return;
      }
    }

    setFilterEnabled(filter.filterId, shouldEnable);

    try {
      if (shouldEnable) {
        await Messenger.enableFilter(filter.filterId);
      } else {
        await Messenger.disableFilter(filter.filterId);
      }
    } catch (err) {
      setFilterEnabled(filter.filterId, !shouldEnable);
      showAlert('options_filters_update_error', false);
    }
  };

  const handleFilterDelete = async (filterId) => {
    if (!confirm(getMessage('options_confirm_filter_delete') || 'Are you sure you want to delete this filter?')) {
      return;
    }

    try {
      await Messenger.removeCustomFilter(filterId);

      loadOptionsData();
    } catch (err) {
      showAlert('options_filters_update_error', false);
    }
  };

  const handleCategoryToggle = async (groupId, currentEnabled) => {
    const shouldEnable = !currentEnabled;

    if (__IS_MV3__ && shouldEnable) {
      const result = await Messenger.canEnableStaticFilter(groupId);

      if (!result.ok) {
        showAlert('snack_on_websites_limits_exceeded_warning', false);
        return;
      }
    }

    setGroupEnabled(groupId, shouldEnable);

    try {
      await Messenger.updateGroupStatus(groupId, shouldEnable);
    } catch (err) {
      setGroupEnabled(groupId, !shouldEnable);
      showAlert('options_filters_update_error', false);
    }
  };

  const handleOpenSettings = async () => {
    if (shouldEnableDevMode) {
      await Messenger.openChromeExtensionsPage();
    } else {
      await Messenger.openExtensionDetailsPage();
    }
  };

  const userScriptsWarningText = useMemo(() => {
    const requiredText = getMessage('options_custom_filters_user_scripts_required');
    const actionText = shouldEnableDevMode
      ? getMessage('options_enable_developer_mode', [LEARN_MORE_URL])
      : getMessage('options_allow_user_scripts', [LEARN_MORE_URL]);

    return `${requiredText} ${actionText}`;
  }, [shouldEnableDevMode]);

  const resetSearch = () => {
    search.value = { category: '', query: '', status: '' };
  };

  return (
    <div class={className}>
      <div class="js-options">
        <div class="search">
          <IconSearch class="icon search__icon" />

          <input
            class="search__input js-search-input"
            type="text"
            placeholder={getMessage('options_search')}
            value={search.value.query}
            onInput={(e) => {
              search.value = { ...search.value, query: e.target.value.trim() };
            }}
          />

          <div class="search__select-wrapper">
            <select
              class="search__select js-search-status"
              value={search.value.status}
              onInput={(e) => {
                search.value = { ...search.value, status: e.target.value };
              }}
            >
              <option value="">{getMessage('options_filter_status_all')}</option>

              <option value="enabled">{getMessage('options_filter_status_enabled')}</option>

              <option value="disabled">{getMessage('options_filter_status_disabled')}</option>
            </select>
          </div>

          <button type="button" class="search__reset js-search-reset" onClick={resetSearch}>
            ×
          </button>
        </div>

        <div
          class={`breadcrumb ${search.value.category ? '' : 'hidden'} js-options-breadcrumb`}
          role="button"
          tabIndex={0}
          onClick={resetSearch}
          onKeyDown={(e) => e.key === 'Enter' && resetSearch()}
        >
          {search.value.category ? (FILTER_CATEGORIES[search.value.category] || search.value.category) : ''}
        </div>

        {!hasSearch.value && (
          <ul class="options options--clickable js-options-categories">
            {CATEGORY_CONFIG.map(({ category, groupId, icon }) => {
              const enabledNames = enabledByCategory.value[category];
              const enabledText = getMessage('options_filters_enabled');
              const label = enabledNames
                ? `${enabledText} ${enabledNames.join(', ')}`
                : getMessage('options_no_filters_enabled');
              const checked = categoryEnabled(groupId);

              return (
                <li
                  key={category}
                  class="options__option js-options-category"
                  data-category={category}
                  data-group-id={groupId}
                  onClick={() => {
                    if (!search.value.category) {
                      search.value = { ...search.value, category };
                    }
                  }}
                >
                  <div class="options__icon">
                    <img src={icon} alt="" />
                  </div>

                  <div class="options__text">
                    <h2>{getMessage(CATEGORY_MESSAGE_KEYS[category])}</h2>

                    <p class="js-enabled-filters">{label}</p>
                  </div>

                  <div
                    class={`toggle ${checked ? 'toggle--checked' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCategoryToggle(groupId, checked);
                    }}
                  >
                    <div class="toggle__label" />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {hasSearch.value && (
          <FilterList
            filters={filteredFilters.value}
            onToggle={handleFilterToggle}
            onDelete={handleFilterDelete}
          />
        )}

        {search.value.category === 'custom' && showUserScriptsWarning && (
          <div class="user-scripts-warning js-user-scripts-warning">
            <p
              class="user-scripts-warning__text js-user-scripts-warning-text"
              dangerouslySetInnerHTML={{ __html: userScriptsWarningText }}
            />

            <button type="button" class="btn btn--border-blue js-open-extension-settings" onClick={handleOpenSettings}>
              {getMessage('options_open_extension_settings')}
            </button>
          </div>
        )}

        <button
          type="button"
          class={`btn options__add-filter-btn js-options-add-filter ${showAddFilterButton ? '' : 'hidden'}`}
          onClick={() => (addFilterModalOpen.value = true)}
        >
          {getMessage('options_add_custom_filter')}
        </button>
      </div>
    </div>
  );
}
