import { useCallback } from 'preact/hooks';
import { Messenger } from '../../services/messenger';
import { getMessage } from '../../../common/i18n';
import { setDocumentAllowlisted } from '../store';

export function Menu({
  isWebSiteTab,
  documentAllowlisted,
  isFilteringPossible,
  canAddRemoveRule,
  activeTabId,
  enableChecked,
}) {
  const handleEnableClick = useCallback(() => {
    if (!isWebSiteTab.value || !isFilteringPossible.value || !canAddRemoveRule.value || activeTabId.value == null) {
      return;
    }

    const wasAllowlisted = documentAllowlisted.value;
    const tabId = activeTabId.value;

    setDocumentAllowlisted(!wasAllowlisted);

    if (wasAllowlisted) {
      Messenger.removeAllowlistDomain(tabId, true);
    } else {
      Messenger.addAllowlistDomain(tabId);
    }
  }, [isWebSiteTab, documentAllowlisted, isFilteringPossible, canAddRemoveRule, activeTabId]);

  const handleBlockClick = useCallback(async () => {
    if (!isWebSiteTab.value) {
      return;
    }

    await Messenger.openAssistant();

    window.close();
  }, [isWebSiteTab]);

  const handleSettingsClick = useCallback(() => {
    Messenger.openSettingsTab();
  }, []);

  return (
    <ul class="menu">
      <li class={`menu__item ${isWebSiteTab.value ? '' : 'disabled'}`} onClick={isWebSiteTab.value ? handleEnableClick : undefined}>
        <div class="menu__icon">
          <img src="/assets/images/shield-icon.png" alt="" />
        </div>

        <span class="checkbox-label">{getMessage('popup_enabled_on_site')}</span>

        <div class={`toggle ${enableChecked.value ? 'toggle--checked' : ''}`}>
          <div class="toggle__label" />
        </div>
      </li>

      <li class={`menu__item ${isWebSiteTab.value ? '' : 'disabled'}`} onClick={handleBlockClick}>
        <div class="menu__icon">
          <img src="/assets/images/cross-icon.png" alt="" />
        </div>

        <span>{getMessage('browser_action_popup_block_element')}</span>
      </li>

      <li class="menu__item" onClick={handleSettingsClick}>
        <div class="menu__icon">
          <img src="/assets/images/cog-icon.png" alt="" />
        </div>

        <span>{getMessage('popup_settings')}</span>
      </li>
    </ul>
  );
}
