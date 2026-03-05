import { getMessage } from '../../../common/i18n';
import { getUrlByKey } from '../../../common/url-injector';
import { IconFacebook, IconTwitter } from '../../../resources/svg-icons';

const FACEBOOK_URL = getUrlByKey('FACEBOOK');
const TWITTER_URL = getUrlByKey('TWITTER');

export function Socials() {
  return (
    <ul class="socials">
      <li>
        <a href={FACEBOOK_URL || '#'} class="social" data-social="facebook" target="_blank" rel="noopener noreferrer" title={getMessage('popup_share_on_fb')}>
          <IconFacebook class="icon" />
        </a>
      </li>

      <li>
        <a href={TWITTER_URL || '#'} class="social" data-social="twitter" target="_blank" rel="noopener noreferrer" title={getMessage('popup_share_on_twitter')}>
          <IconTwitter class="icon" />
        </a>
      </li>
    </ul>
  );
}
