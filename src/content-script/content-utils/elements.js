const MAX_Z_INDEX = '2147483647';

export class Elements {
  static createStyleElement(css) {
    const styleElement = document.createElement('style');
    styleElement.appendChild(document.createTextNode(css));
    return styleElement;
  }

  static appendIframe({ target, html, styles }) {
    const styleElement = Elements.createStyleElement(styles);
    const prependedHtml = `${styleElement.outerHTML}\n${html}`;

    const iframe = document.createElement('iframe');
    iframe.src = 'about:blank';
    iframe.style.position = 'fixed';
    iframe.style.zIndex = MAX_Z_INDEX;
    iframe.srcdoc = prependedHtml;
    target.insertAdjacentElement('afterbegin', iframe);

    return iframe;
  }

  static appendDiv({ target, html }) {
    const div = document.createElement('div');
    div.innerHTML = html;
    target.insertAdjacentElement('afterbegin', div);
    div.style.zIndex = MAX_Z_INDEX;
    return div;
  }
}
