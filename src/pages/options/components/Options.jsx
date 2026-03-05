import { useSignal, useSignalEffect } from '@preact/signals';
import { getMessage } from '../../../common/i18n';
import { getUrlByKey } from '../../../common/url-injector';

import {
  activeTabIndex,
  switchTab,
  addFilterModalOpen,
  pageAlert,
  dismissPageAlert,
  customRulesContent,
  whitelistContent,
  initialLoadDone,
} from '../store';

import { Header } from './Header';
import { GeneralTab } from './GeneralTab';
import { FiltersTab } from './FiltersTab';
import { EditorTab } from './EditorTab';
import { AboutTab } from './AboutTab';
import { AddFilterModal } from './AddFilterModal';
import { Alert } from './Alert';

const TAB_ITEMS = [
  { key: 'general', icon: '/assets/images/cog-icon.svg', labelKey: 'options_general' },
  { key: 'filters', icon: '/assets/images/funnel-icon.svg', labelKey: 'options_filters' },
  { key: 'custom', icon: '/assets/images/list-icon.svg', labelKey: 'options_custom_rules' },
  { key: 'whitelist', icon: '/assets/images/monitor-icon.svg', labelKey: 'options_whitelist' },
  { key: 'about', icon: '/assets/images/info-icon.svg', labelKey: 'options_about' },
];

const currentYear = new Date().getFullYear();
const rateUrl = getUrlByKey('RATE_EXTENSION');
const homepageUrl = getUrlByKey('HOMEPAGE');

function TabNav() {
  const current = activeTabIndex.value;

  return (
    <ul class="tabs__nav">
      {TAB_ITEMS.map((item, i) => (
        <li
          key={item.key}
          class={`tabs__nav-item ${current === i ? 'active' : ''}`}
          onClick={() => switchTab(i)}
          role="tab"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && switchTab(i)}
        >
          <img src={item.icon} alt="" />

          <span>{getMessage(item.labelKey)}</span>
        </li>
      ))}
    </ul>
  );
}

export function Options() {
  useSignalEffect(() => {
    if (initialLoadDone.value) {
      document.body.classList.remove('loading');
    }
  });

  const modalMounted = useSignal(false);

  if (addFilterModalOpen.value) {
    modalMounted.value = true;
  }

  return (
    <div class="shell">
      <Header />

      <div class="tabs">
        <TabNav />

        <div class="tabs__body">
          <GeneralTab />

          <FiltersTab />

          <EditorTab
            index={2}
            headingKey="options_editor_desc"
            exportFileName="custom-rules.txt"
            contentSignal={customRulesContent}
          />

          <EditorTab
            index={3}
            headingKey="options_whitelist_desc"
            exportFileName="whitelist-rules.txt"
            contentSignal={whitelistContent}
          />

          <AboutTab />
        </div>
      </div>

      <div class="callout">
        <p class="callout__text">{getMessage('options_do_you_like_abu')}</p>

        <a href={rateUrl || '#'} class="btn btn--border-white" target="_blank" rel="noopener noreferrer">
          <img src="/assets/images/love-icon.svg" alt="" />

          <span>{getMessage('options_rate_us')}</span>
        </a>
      </div>

      <div class="copyright">
        © 2016-{currentYear} AdAvoid Ltd.{' '}
        <a href={homepageUrl || '#'} target="_blank" rel="noopener noreferrer" title="AdBlocker Ultimate">
          adblockultimate.net
        </a>
      </div>

      {modalMounted.value && <AddFilterModal />}

      <Alert
        message={pageAlert.value.message}
        visible={pageAlert.value.visible}
        isForModal={false}
        onDismiss={dismissPageAlert}
      />
    </div>
  );
}
