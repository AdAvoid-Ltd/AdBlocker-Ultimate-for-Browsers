import browser from 'webextension-polyfill';

import { MessageType } from '../../common/messages';
import { DocumentBlockService, TabsApi } from '../services';
import { engine } from '../engine';
import { messageHandler } from '../message-handler';

export class DocumentBlockController {
  static async init() {
    await DocumentBlockService.init();

    messageHandler.addListener(MessageType.AddUrlToTrusted, DocumentBlockController.#onAddUrlToTrusted);
  }

  static updateActiveTab = async (url) => {
    const tab = await TabsApi.getActive();

    if (!tab?.id) {
      return;
    }

    await browser.tabs.update(tab.id, { url });
  };

  static async #onAddUrlToTrusted({ data }) {
    const { url } = data;

    await DocumentBlockService.setTrustedDomain(url);
    await engine.update();

    DocumentBlockController.updateActiveTab(url);
  }
}
