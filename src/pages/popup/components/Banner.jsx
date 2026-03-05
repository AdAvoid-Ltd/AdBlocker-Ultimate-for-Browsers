import { signal } from '@preact/signals';
import browser from 'webextension-polyfill';

import { getMessage } from '../../../common/i18n';
import { getActivePromotion } from '../../../common/constants/promotions.active';
import { buildUrl, Endpoint } from '../../../background/services/ui/url-builder';
import { PROMO_BANNER_DISMISSED_PREFIX } from '../../../background/storage-keys';

// --- Signals (module scope) ---

const promo = signal(null);
const visible = signal(false);

// --- Data loading ---

(async () => {
  const activePromo = getActivePromotion();

  if (!activePromo) {
    return;
  }

  const storageKey = `${PROMO_BANNER_DISMISSED_PREFIX}${activePromo.id}`;
  const result = await browser.storage.local.get([storageKey]);

  if (result[storageKey] === true) {
    return;
  }

  promo.value = activePromo;
  visible.value = true;
})();

// --- Component (pure render) ---

async function handleClose() {
  if (!promo.value) {
    return;
  }

  visible.value = false;

  const storageKey = `${PROMO_BANNER_DISMISSED_PREFIX}${promo.value.id}`;

  await browser.storage.local.set({ [storageKey]: true });
}

export function Banner() {
  if (!promo.value || !visible.value) {
    return null;
  }

  const bgUrl = promo.value.backgroundImage
    ? browser.runtime.getURL(promo.value.backgroundImage)
    : null;

  const iconUrl = promo.value.iconImage ? browser.runtime.getURL(promo.value.iconImage) : null;
  const title = getMessage(promo.value.titleKey) || '';

  const buttonText =
    getMessage(promo.value.buttonTextKey) || getMessage('popup_promo_button') || 'Learn More';

  const linkUrl = promo.value.linkUrl || buildUrl(Endpoint.Upgrade);

  return (
    <div class="promotional-banner">
      <button type="button" class="promotional-banner__close" aria-label="Close banner" onClick={handleClose}>×</button>

      <div
        class="promotional-banner__background"
        style={bgUrl ? { backgroundImage: `url('${bgUrl}')`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      />

      <div class="promotional-banner__content">
        <div class="promotional-banner__icon" style={{ display: iconUrl ? 'flex' : 'none' }}>
          <img src={iconUrl || ''} alt="" class="promotional-banner__icon-image" />
        </div>

        <div class="promotional-banner__text">
          <span class="promotional-banner__title">{title}</span>

          <a href={linkUrl} class="promotional-banner__button" target="_blank" rel="noopener noreferrer">{buttonText}</a>
        </div>
      </div>
    </div>
  );
}
