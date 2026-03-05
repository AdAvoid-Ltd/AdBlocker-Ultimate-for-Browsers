import { Elements } from './elements';

export class Alerts {
  static appendAlertElement(props) {
    const { target, html, isExtensionTab, alertStyles, alertContainerStyles } = props;

    const alertContainerElement = Elements.createStyleElement(alertContainerStyles);
    document.body.insertAdjacentElement('afterbegin', alertContainerElement);
    if (isExtensionTab) {
      return Elements.appendDiv({
        target,
        html,
      });
    }

    return Elements.appendIframe({
      target,
      html,
      styles: alertStyles,
    });
  }

  static genAlertHtml(props) {
    const { title, text } = props;

    let descBlock = '';
    if (text && text.length > 0) {
      descBlock = `<div class="popup-alert__desc">
                            ${text}
                        </div>`;
    }

    // don't show description text if it is same as title or if it is equal to undefined
    if (title === text || text === 'undefined') {
      descBlock = '';
    }

    let titleBlock = '';
    if (title && title.length > 0) {
      titleBlock = `<div class="popup-alert__title">
                            ${title}
                        </div>`;
    }

    return `<div class="popup-alert">
                    ${titleBlock}
                    ${descBlock}
                </div>`;
  }
}
