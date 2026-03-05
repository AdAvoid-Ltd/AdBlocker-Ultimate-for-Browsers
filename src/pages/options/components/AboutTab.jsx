import { useComputed } from '@preact/signals';
import { getMessage } from '../../../common/i18n';
import { getUrlByKey } from '../../../common/url-injector';
import { IconFacebook, IconTwitter } from '../../../resources/svg-icons';
import { activeTabIndex, appVersion } from '../store';

const currentYear = new Date().getFullYear();
const HOMEPAGE_URL = getUrlByKey('HOMEPAGE');
const PRIVACY_URL = getUrlByKey('PRIVACY_POLICY');
const REPORT_URL = getUrlByKey('REPORT_PAGE');
const CONTACT_URL = getUrlByKey('CONTACT');
const CROWDIN_URL = getUrlByKey('CROWDIN');
const FACEBOOK_URL = getUrlByKey('FACEBOOK');
const TWITTER_URL = getUrlByKey('TWITTER');

export function AboutTab() {
  const className = useComputed(() =>
    `tabs__content ${activeTabIndex.value === 4 ? 'active' : ''}`,
  );

  return (
    <div class={className}>
      <div class="about">
        <div class="about__img">
          <img src="/assets/images/mascot-awake.png" alt="" />
        </div>

        <h2 class="about__heading">{getMessage('all_ads_out')}</h2>

        <p class="about__version"><span>{getMessage('version')}</span>: <span class="js-version">{appVersion.value || ''}</span></p>

        <p class="about__copy">© 2016-{currentYear} AdAvoid Ltd. <span>{getMessage('all_rights_reserved')}</span>.</p>

        <hr class="about__hr" />

        <ul class="about__links">
          <li><a href={HOMEPAGE_URL || '#'} target="_blank" rel="noopener noreferrer">{getMessage('official_website')}</a></li>

          <li><a href={PRIVACY_URL || '#'} target="_blank" rel="noopener noreferrer">{getMessage('privacy_policy')}</a></li>

          <li><a href={REPORT_URL || '#'} target="_blank" rel="noopener noreferrer">{getMessage('report_bug')}</a></li>

          <li><a href={CONTACT_URL || '#'} target="_blank" rel="noopener noreferrer">{getMessage('contact_us')}</a></li>
        </ul>

        <h3 class="about__subheading">{getMessage('follow_us')}</h3>

        <ul class="about__socials">
          <li>
            <a href={FACEBOOK_URL || '#'} title="Facebook" target="_blank" rel="noopener noreferrer">
              <IconFacebook class="icon" />
            </a>
          </li>

          <li>
            <a href={TWITTER_URL || '#'} title="Twitter" target="_blank" rel="noopener noreferrer">
              <IconTwitter class="icon" />
            </a>
          </li>
        </ul>

        <p>
          <span>{getMessage('options_want_abu_in_lang')}</span>

          {' '}

          <a href={CROWDIN_URL || '#'} target="_blank" rel="noopener noreferrer">{getMessage('options_help_translate')}</a>
        </p>
      </div>
    </div>
  );
}
