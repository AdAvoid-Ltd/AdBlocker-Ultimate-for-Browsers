import browser from 'webextension-polyfill';

import { rulesLimitsController } from 'rules-limits-controller';

import { engine } from '../engine';
import { MessageType, sendMessage } from '../../common/messages';
import { logger } from '../../common/logger';
import { UserAgent } from '../../common/user-agent';
import { buildUrl, Endpoint } from '../services/ui/url-builder';
import { messageHandler } from '../message-handler';
import { ConnectionHandler } from '../connection-handler';
import {
  CommonFilterService,
  FiltersService,
  SettingsService,
  UpdateService,
  InstallService,
  network,
  PageStatsService,
  IconsService,
  DesktopAppService,
  localeDetect,
  MigrationService,
} from '../services';
import { eventBridgeController } from '../event-bridge';
import {
  UiController,
  PopupController,
  SettingsController,
  FiltersController,
  AllowlistController,
  UserRulesController,
  CustomFiltersController,
  DocumentBlockController,
} from '../controllers';
import { getRunInfo } from '../utils';
import { contextMenuEvents, settingsEvents } from '../events';
import { KeepAlive } from '../keep-alive';
import { ContentScriptInjector } from '../content-script-injector';

import { appContext, AppContextKey } from './context';

export class App {
  static async init() {
    // removes listeners on re-initialization, because new ones will be registered during process
    App.#removeListeners();
    App.#syncInit();
    await App.#asyncInit();
  }

  static #syncInit() {
    UiController.syncInit();
  }

  static async #asyncInit() {
    KeepAlive.init();

    // Reads persisted data from session storage.
    await engine.api.initStorage();

    /**
     * Initializes connection and message handler as soon as possible
     * to prevent connection errors from extension pages
     */
    ConnectionHandler.init();
    messageHandler.init();

    // get application run info
    const runInfo = await getRunInfo();

    const { previousAppVersion, currentAppVersion } = runInfo;
    const isAppVersionChanged = previousAppVersion !== currentAppVersion;

    // Run migration if legacy storage format detected
    const migrationResult = await MigrationService.migrateIfNeeded();
    if (migrationResult.migrated) {
      logger.info(`[ext.App.init]: Migrated from ${migrationResult.source} format`);
    }

    const isInstall = isAppVersionChanged && !previousAppVersion;
    const isUpdate = isAppVersionChanged && !!previousAppVersion;

    if (isInstall) {
      await InstallService.install({ skipSettingsInit: migrationResult.migrated });
    }

    if (isUpdate) {
      await UpdateService.update(runInfo);
    }

    // Initializes network settings.
    await network.init();

    // Initializes Settings storage data
    await SettingsService.init();

    await rulesLimitsController.init();

    /**
     * Injects content scripts into already open tabs.
     *
     * Does injection when content scripts have not been injected in the current session.
     * This avoids unnecessary injections.
     */
    if (!(await ContentScriptInjector.isInjected())) {
      await ContentScriptInjector.init();
      await ContentScriptInjector.setInjected();
    }

    /**
     * Initializes Filters data:
     * - Loads app metadata and caches it in metadata storage
     * - Initializes storages for userrules, allowlist, custom filters metadata and page-stats
     * - Initializes storages for filters state, groups state and filters versions, based on app metadata.
     */
    await FiltersService.init(isInstall);

    /**
     * Update the filters in the MV3 version for each extension update,
     * even for patches, because MV3 does not support remote filter updates
     * (either full or through diffs) and filters are updated only with
     * the update of the entire extension.
     */
    if (isUpdate) {
      const filtersIds = await FiltersService.reloadFiltersFromLocal();
      logger.info('[ext.App.asyncInit]: following filters has been updated from local resources:', filtersIds);
    }

    await PageStatsService.init();

    // Adds listeners for settings events
    SettingsController.init();

    // Adds listeners for filter and group state events (enabling, updates)
    await FiltersController.init();

    // Adds listeners specified for custom filters
    CustomFiltersController.init();

    // Adds listeners for allowlist events
    AllowlistController.init();

    // Adds listeners for userrules list events
    await UserRulesController.init(engine);

    /**
     * Adds listeners for managing ui
     * (routing between extension pages, toasts, icon update).
     */
    await UiController.init();

    // Adds listeners for popup events
    PopupController.init();

    // Initializes language detector for auto-enabling relevant filters
    localeDetect.init();

    eventBridgeController.init();

    // Called after eventBridgeController init, otherwise it won't handle messages.
    await KeepAlive.resyncEventSubscriptions();

    /**
     * Initializes Document block module
     * - Initializes persisted cache for trusted domains
     * - Adds listener for "add trusted domain" message.
     */
    await DocumentBlockController.init();

    // Sets app uninstall url
    await App.#setUninstallUrl();

    // First install additional scenario
    if (isInstall) {
      // Loads default filters
      await CommonFilterService.initDefaultFilters(true);

      // After migration, some filters may be marked as 'enabled' but not 'loaded'
      // (their IDs carried over from the legacy extension). Download them before
      // the engine starts, otherwise getConfiguration() will fail to retrieve
      // their rule content.
      if (migrationResult.migrated) {
        await FiltersService.reloadEnabledFilters();
      }

      // Write the current version to the storage only after successful initialization of the extension
      await InstallService.postSuccessInstall(currentAppVersion);
    }

    // Update additional scenario
    if (isUpdate) {
      // Filters reload logic handled below
    }

    // Runs tswebextension
    await engine.start();

    appContext.set(AppContextKey.IsInit, true);

    // Update icons to hide "loading" icon
    await IconsService.update();

    await sendMessage({ type: MessageType.AppInitialized });

    // Initialize desktop app service (after engine is started)
    DesktopAppService.init().catch((error) => {
      logger.error('Failed to initialize desktop app controller:', error);
    });
  }

  static #removeListeners() {
    messageHandler.removeListeners();
    contextMenuEvents.removeListeners();
    settingsEvents.removeListeners();
  }

  static async #setUninstallUrl() {
    const manifest = browser.runtime.getManifest();
    const uninstallUrl = buildUrl(Endpoint.Uninstall, { version: manifest.version, browser: UserAgent.browserName });

    try {
      await browser.runtime.setUninstallURL(uninstallUrl);
    } catch (e) {
      logger.error('[ext.App.setUninstallUrl]: cannot set app uninstall url. Origin error:', e);
    }
  }
}
