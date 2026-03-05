import { tabsApi as tsWebExtTabsApi } from '../../tswebextension';
import { MessageType } from '../../../common/messages';
import { messageHandler } from '../../message-handler';
import { appContext, AppContextKey } from '../../app/context';
import { FramesService } from '../../services';
import { DesktopAppService } from '../../services/desktop-app';

export class PopupController {
  static init() {
    messageHandler.addListener(MessageType.GetIsEngineStarted, PopupController.getIsAppInitialized);
    messageHandler.addListener(MessageType.GetTabInfoForPopup, PopupController.getTabInfoForPopup);
    messageHandler.addListener(MessageType.GetDesktopAppStatus, PopupController.getDesktopAppStatus);
  }

  static getIsAppInitialized() {
    return appContext.get(AppContextKey.IsInit);
  }

  static getDesktopAppStatus() {
    return DesktopAppService.isActive();
  }

  static getTabInfoForPopup({ data }) {
    const { tabId } = data;

    const tabContext = tsWebExtTabsApi.getTabContext(tabId);

    if (tabContext) {
      return {
        frameInfo: FramesService.getMainFrameData(tabContext),
        options: {
          desktopAppActive: DesktopAppService.isActive(),
          desktopAppInstalled: DesktopAppService.isInstalled(),
        },
      };
    }
  }
}
