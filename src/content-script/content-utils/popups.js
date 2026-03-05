import { sendMessage, MessageType } from '../../common/messages';

import { Alerts } from './alerts';
import { Elements } from './elements';

export class Popups {
  static #triesCount = 10;

  static #HIDE_TIMEOUT_MS = 1000 * 4;

  static #retryTimeoutMs = 500;

  /**
   * Remove iframe after click event fire on link
   * NOTICE: if here is used value equal to 0,
   * then iframe is closed early than link is clicked
   */
  static #removeFrameTimeoutMs = 10;

  static showAlertPopup({ data }) {
    const { text, title, isExtensionTab, alertStyles, alertContainerStyles } = data;

    if (!title && !text) {
      return;
    }

    let messages = [];
    if (Array.isArray(text)) {
      messages = text;
    } else {
      messages = [text];
    }

    let fullText = '';
    for (let i = 0; i < messages.length; i += 1) {
      if (i > 0) {
        fullText += ', ';
      }
      fullText += messages[i];
    }

    const html = Alerts.genAlertHtml({
      title,
      text: fullText,
    });

    Popups.#appendAlertPopup(0, {
      html,
      isExtensionTab,
      alertStyles,
      alertContainerStyles,
    });
  }

  static showRuleLimitsAlert({ data }) {
    const { isExtensionTab, mainText, linkText, alertStyles, alertContainerStyles } = data;

    const iframeHtml = `
            <div id="rules-limits-popup" class="rules-limits-popup">
                <div class="rules-limits-popup__info-icon"></div>
                <div class="rules-limits-popup__content">
                    <p> ${mainText} </p>
                    <button id="open-rule-limits-link" type="button"> ${linkText} </button>
                </div>
                <button
                    aria-label="close"
                    type="button"
                    class="rules-limits-popup__close close-iframe"
                ></button>
            </div>
        `;

    Popups.#appendPopup(0, {
      iframeHtml,
      iframeStyles: alertContainerStyles,
      iframeClassName: 'rules-limits-iframe',
      alertStyles,
      isExtensionTab,
      onIframeInjected: (iframe) => {
        const isListening = Popups.#handleOpenRulesLimitsPage(iframe);
        if (!isListening) {
          iframe.addEventListener('load', () => {
            Popups.#handleOpenRulesLimitsPage(iframe);
          });
        }

        // iframe should be hidden after some time
        const removeTimeout = setTimeout(() => {
          iframe.parentNode?.removeChild(iframe);
        }, Popups.#HIDE_TIMEOUT_MS);

        /**
         * Mouseover event listener:
         * - clear timeout to prevent iframe from closing if user hovers over the iframe;
         * - remove event listener after first hover.
         */
        const focusListener = () => {
          clearTimeout(removeTimeout);
          iframe.removeEventListener('mouseover', focusListener);
        };

        iframe.addEventListener('mouseover', focusListener);
      },
    });

    return true;
  }

  static #appendAlertPopup(count, props) {
    if (count >= Popups.#triesCount) {
      return;
    }

    if (document.body) {
      const alertElement = Alerts.appendAlertElement({
        ...props,
        target: document.body,
      });

      alertElement.classList.add('alert-iframe');
      alertElement.onload = () => {
        alertElement.style.visibility = 'visible';
      };
      setTimeout(() => {
        if (alertElement && alertElement.parentNode) {
          alertElement.parentNode.removeChild(alertElement);
        }
      }, Popups.#HIDE_TIMEOUT_MS);
    } else {
      setTimeout(() => {
        Popups.#appendAlertPopup(count + 1, props);
      }, Popups.#retryTimeoutMs);
    }
  }

  static #appendPopup(count, props) {
    if (count >= Popups.#triesCount) {
      return;
    }

    const { isExtensionTab, iframeStyles, iframeClassName, iframeHtml, alertStyles, onIframeInjected } = props;

    if (document.body && !isExtensionTab) {
      const iframeCss = Elements.createStyleElement(iframeStyles);
      document.body.insertAdjacentElement('afterbegin', iframeCss);

      const iframe = Elements.appendIframe({
        target: document.body,
        html: iframeHtml,
        styles: alertStyles,
      });

      iframe.classList.add(iframeClassName);

      const isListening = Popups.#handleCloseIframe(iframe);
      if (!isListening) {
        iframe.addEventListener('load', () => {
          Popups.#handleCloseIframe(iframe);
        });
      }

      if (onIframeInjected) {
        onIframeInjected(iframe);
      }
    } else {
      setTimeout(() => {
        Popups.#appendPopup(count + 1, props);
      }, 500);
    }
  }

  static #handleCloseIframe(iframe) {
    const iframeDocument = iframe.contentDocument || iframe.contentWindow?.document;

    if (!iframeDocument) {
      return false;
    }

    const closeElements = iframeDocument.querySelectorAll('.close-iframe');

    if (closeElements.length === 0) {
      return false;
    }
    closeElements.forEach((element) => {
      element.addEventListener('click', () => {
        setTimeout(() => {
          iframe.parentNode?.removeChild(iframe);
        }, Popups.#removeFrameTimeoutMs);
      });
    });

    return true;
  }

  static #handleOpenRulesLimitsPage(iframe) {
    const iframeDocument = iframe.contentDocument || iframe.contentWindow?.document;

    if (!iframeDocument) {
      return false;
    }

    const link = iframeDocument.querySelector('#open-rule-limits-link');

    if (!link) {
      return false;
    }

    const clickHandler = () => {
      // Open rules limits settings page.
      sendMessage({ type: MessageType.OpenRulesLimitsTab });

      // After redirect to settings page, close iframe.
      const removeTimeout = setTimeout(() => {
        iframe.parentNode?.removeChild(iframe);
        clearTimeout(removeTimeout);
      }, Popups.#removeFrameTimeoutMs);

      link.removeEventListener('click', clickHandler);
    };

    link.addEventListener('click', clickHandler);

    return true;
  }

  static showRateUsPopup({ data }) {
    const {
      alertStyles,
      alertContainerStyles,
      strings,
      assetsUrl,
      rateExtensionUrl,
      isExtensionTab,
    } = data;

    if (!alertStyles || !alertContainerStyles || !strings || !assetsUrl || !rateExtensionUrl) {
      return;
    }

    const s = strings;
    const iframeHtml = `
<div class="rate-us-popup js-rate-us-popup">
  <button type="button" class="close-btn js-close-btn" aria-label="close">×</button>
  <div class="screen current prompt js-screen js-screen-prompt">
    <img class="logo" src="${assetsUrl}/logo.png" alt="">
    <h2 class="heading">${s.shield_hooray}</h2>
    <h2 class="subheading">${s.shield_adfree_browsing_achieved}</h2>
    <img class="bochko" src="${assetsUrl}/mascot-awake.png" alt="">
    <h2 class="question">${s.shield_do_you_like_abu}</h2>
    <div class="actions">
      <button type="button" class="js-btn-yes">${s.yes}</button>
      <button type="button" class="js-btn-no">${s.no}</button>
    </div>
  </div>
  <div class="screen answer answer-yes js-screen js-screen-answer-yes">
    <h2 class="heading">${s.shield_rate_txt}</h2>
    <a href="${rateExtensionUrl}" target="_blank" rel="noopener noreferrer" class="btn js-close-btn">${s.shield_rate_us}</a>
    <button type="button" class="no-btn js-close-btn">${s.shield_no_thanks}</button>
  </div>
  <div class="screen answer answer-no js-screen js-screen-answer-no">
    <h2 class="heading">${s.shield_tell_how_to_improve}</h2>
    <form class="form js-feedback-form">
      <textarea class="message-field" name="message" placeholder="${s.shield_message}" required></textarea>
      <input class="email-field" type="email" name="email" placeholder="${s.shield_email}" required>
      <button type="submit" class="btn">${s.shield_send_feedback}</button>
    </form>
    <div class="thank-you-msg">
      <h1 class="heading">${s.shield_thank_you}</h1>
    </div>
  </div>
</div>`;

    Popups.#appendPopup(0, {
      iframeHtml,
      iframeStyles: alertContainerStyles,
      iframeClassName: 'rate-us-iframe',
      alertStyles,
      isExtensionTab,
      onIframeInjected: (iframe) => {
        const isReady = Popups.#handleRateUsIframe(iframe);
        if (!isReady) {
          iframe.addEventListener('load', () => {
            Popups.#handleRateUsIframe(iframe);
          });
        }
      },
    });
  }

  static #handleRateUsIframe(iframe) {
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      return false;
    }

    const popup = doc.querySelector('.js-rate-us-popup');
    const btnYes = doc.querySelector('.js-btn-yes');
    const btnNo = doc.querySelector('.js-btn-no');
    const form = doc.querySelector('.js-feedback-form');
    const closeBtns = doc.querySelectorAll('.js-close-btn');

    if (!popup || !btnYes || !btnNo || !form) {
      return false;
    }

    const showScreen = (selector) => {
      doc.querySelectorAll('.js-screen').forEach((el) => el.classList.remove('current'));
      const screen = doc.querySelector(selector);
      if (screen) {
        screen.classList.add('current');
      }
    };

    const removeIframe = () => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    };

    const handleClose = () => {
      popup.classList.remove('opaque');
    };

    const handleTransitionEnd = (e) => {
      if (e.target === popup && !popup.classList.contains('opaque')) {
        removeIframe();
      }
    };

    btnYes.addEventListener('click', () => showScreen('.js-screen-answer-yes'));
    btnNo.addEventListener('click', () => showScreen('.js-screen-answer-no'));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const message = formData.get('message');
      const email = formData.get('email');
      sendMessage({ type: MessageType.SendFeedback, data: { message, email } });
      doc.querySelector('.js-screen-answer-no')?.classList.add('sent');
      setTimeout(removeIframe, 1500);
    });

    popup.addEventListener('transitionend', handleTransitionEnd);
    closeBtns.forEach((btn) => btn.addEventListener('click', handleClose));

    setTimeout(() => popup.classList.add('opaque'), 1500);

    return true;
  }
}
