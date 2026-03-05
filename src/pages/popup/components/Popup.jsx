import { useSignalEffect } from '@preact/signals';
import { getMessage } from '../../../common/i18n';
import { getUrlByKey } from '../../../common/url-injector';

import {
  enableChecked,
  infoHover,
  desktopAppActive,
  desktopAppInstalled,
  totalBlockedTab,
  totalBlocked,
  isWebSiteTab,
  documentAllowlisted,
  isFilteringPossible,
  canAddRemoveRule,
  activeTabId,
  tabUrlDisplay,
  statusText,
  initialLoadDone,
} from '../store';

import { IconHelp, IconWindows, IconMascotCircle } from '../../../resources/svg-icons';
import { Stats } from './Stats';
import { Menu } from './Menu';
import { Banner } from './Banner';
import { Socials } from './Socials';

const homepageUrl = getUrlByKey('HOMEPAGE');
const windowsAppUrl = getUrlByKey('WINDOWS_APP');
const popupGetAbuWindows = getMessage('popup_get_abu_windows');

export function Popup() {
  useSignalEffect(() => {
    if (initialLoadDone.value) {
      document.body.classList.remove('loading');
    }
  });

  return (
    <>
      <div class={`display js-popup ${enableChecked.value ? '' : 'disabled'}`}>
        <a href={homepageUrl || '#'} class="logo" target="_blank" rel="noopener noreferrer">
          <img src="/assets/images/logo.png" alt="" />
        </a>

        <div class={`info js-info ${infoHover.value ? 'visible' : ''}`}>
          {desktopAppActive.value ? getMessage('abu_desktop_info') : ''}
        </div>

        {!desktopAppActive.value && (
          <Stats
            totalBlockedTab={totalBlockedTab}
            totalBlocked={totalBlocked}
            visible={isWebSiteTab}
          />
        )}

        <div class={`stats-desktop js-stats-desktop ${desktopAppActive.value ? 'visible' : ''}`}>
          <IconHelp
            class={`icon text__help js-btn-help ${desktopAppActive.value ? 'visible' : ''}`}
            onMouseEnter={() => (infoHover.value = true)}
            onMouseLeave={() => (infoHover.value = false)}
          />

          <strong class="text__heading js-msg">
            {desktopAppActive.value ? getMessage('desktop_app_is_running') : ''}
          </strong>
        </div>

        <div class="mascot">
          <div class="mascot__circle">
            <img src="/assets/images/circle.svg" alt="" />

            <IconMascotCircle />
          </div>

          <img class="mascot__img mascot__awake" src="/assets/images/mascot-awake.png" alt="" />

          <img class="mascot__img mascot__asleep" src="/assets/images/mascot-asleep.png" alt="" />
        </div>

        <p class="tab-url js-tab-url">{tabUrlDisplay}</p>

        <p class="status js-status">{statusText}</p>
      </div>

      <div class="actions">
        <Menu
          isWebSiteTab={isWebSiteTab}
          documentAllowlisted={documentAllowlisted}
          isFilteringPossible={isFilteringPossible}
          canAddRemoveRule={canAddRemoveRule}
          activeTabId={activeTabId}
          enableChecked={enableChecked}
        />

        <a href={windowsAppUrl || '#'} class={`btn btn-download-app ${initialLoadDone.value && !desktopAppInstalled.value ? 'visible' : ''}`} target="_blank" rel="noopener noreferrer">
          <IconWindows class="icon" />

          <span>{popupGetAbuWindows}</span>
        </a>

        <Banner />

        <Socials />
      </div>
    </>
  );
}
