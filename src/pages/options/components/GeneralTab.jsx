import { useComputed } from '@preact/signals';
import { Messenger } from '../../services/messenger';
import { getMessage } from '../../../common/i18n';
import {
  activeTabIndex,
  filters,
  settings,
  loadOptionsData,
  setFilterEnabled,
  showAlert,
} from '../store';
import { SettingOption } from '../../../background/storage-keys';
import { AntiBannerFiltersId } from '../../../common/constants';

const SETTINGS = [
  {
    settingKey: SettingOption.AutoDetectFilters,
    titleKey: 'options_auto_activate_lang_filters_title',
    descKey: 'options_auto_activate_lang_filters_desc',
  },
  {
    settingKey: SettingOption.ShowPageStats,
    titleKey: 'browser_action_popup_show_number_in_icon',
    descKey: 'options_number_icon_desc',
  },
  {
    settingKey: SettingOption.ShowContextMenu,
    titleKey: 'options_enable_context_menu_title',
    descKey: 'options_enable_context_menu_desc',
  },
];

export function GeneralTab() {
  const className = useComputed(() =>
    `tabs__content ${activeTabIndex.value === 0 ? 'active' : ''}`,
  );

  const values = useComputed(() => settings.value?.values || {});

  const antiCircumventionEnabled = useComputed(() => {
    const filter = filters.value.find((f) => f.filterId === AntiBannerFiltersId.AntiCircumventionFilterId);
    return filter?.enabled ?? false;
  });

  const handleToggle = async (settingKey) => {
    await Messenger.changeUserSetting(settingKey, !values.value[settingKey]);
    loadOptionsData();
  };

  const handleAntiCircumventionToggle = async () => {
    const shouldEnable = !antiCircumventionEnabled.value;
    const filterId = AntiBannerFiltersId.AntiCircumventionFilterId;

    setFilterEnabled(filterId, shouldEnable);

    try {
      if (shouldEnable) {
        await Messenger.enableFilter(filterId);
      } else {
        await Messenger.disableFilter(filterId);
      }
    } catch (err) {
      setFilterEnabled(filterId, !shouldEnable);
      showAlert('options_filters_update_error', false);
    }
  };

  return (
    <div class={className}>
      <ul class="options">
        {!__IS_MV3__ && (
          <li class="options__option">
            <div class="options__text">
              <h2>{getMessage('options_anti_circumvention_title')}</h2>
              <p>{getMessage('options_anti_circumvention_desc')}</p>
            </div>

            <div
              class={`toggle ${antiCircumventionEnabled.value ? 'toggle--checked' : ''}`}
              onClick={handleAntiCircumventionToggle}
            >
              <div class="toggle__label" />
            </div>
          </li>
        )}
        {SETTINGS.map(({ settingKey, titleKey, descKey }) => {
          const enabled = values.value[settingKey];

          return (
            <li key={settingKey} class="options__option">
              <div class="options__text">
                <h2>{getMessage(titleKey)}</h2>

                <p>{getMessage(descKey)}</p>
              </div>

              <div
                class={`toggle ${enabled ? 'toggle--checked' : ''}`}
                onClick={() => handleToggle(settingKey)}
              >
                <div class="toggle__label" />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
