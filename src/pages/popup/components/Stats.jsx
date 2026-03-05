import { getMessage } from '../../../common/i18n';

export function Stats({ totalBlockedTab, totalBlocked, visible }) {
  if (!visible.value) {
    return null;
  }
  return (
    <div class="stats visible">
      <div class="stats__img">
        <img src="/assets/images/broom-icon.png" alt="" />
      </div>

      <div class="stats__content">
        <strong class="stats__heading">
          {getMessage('popup_tab_blocked', [(totalBlockedTab.value ?? 0).toLocaleString()])}
        </strong>

        <p class="stats__subheading">
          {getMessage('popup_tab_blocked_all', [(totalBlocked.value ?? 0).toLocaleString()])}
        </p>
      </div>
    </div>
  );
}
