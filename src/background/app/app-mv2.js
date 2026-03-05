import browser from 'webextension-polyfill';

import { engine } from '../engine';
import { MessageType, sendMessage } from '../../common/messages';
import { logger } from '../../common/logger';
import { UserAgent } from '../../common/user-agent';
import { buildUrl, Endpoint } from '../services/ui/url-builder';
import { ContentScriptInjector } from '../content-script-injector';
import { messageHandler } from '../message-handler';
import { ConnectionHandler } from '../connection-handler';
import {
  CommonFilterService,
  FiltersService,
  SettingsService,
  UpdateService,
  InstallService,
  PageStatsService,
  IconsService,
  DesktopAppService,
  localeDetect,
  filterUpdateController,
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
  DocumentBlockController,
  CustomFiltersController,
} from '../controllers';
import { getRunInfo } from '../utils';
import { contextMenuEvents, settingsEvents } from '../events';
import { KeepAlive } from '../keep-alive';

import { appContext, AppContextKey } from './context';

const trackInitTimesForDebugging = async () => {
  const DEBUG_INIT_LOGGING_FLAG_KEY = '_test_debug-init-logging-flag';
  const LOGGING_DISABLED_BY_DEFAULT = false;
  const INIT_TIMES_STORAGE_KEY = '_test_init-times-key';

  const isLoggingEnabled = (await browser.storage.local.get(DEBUG_INIT_LOGGING_FLAG_KEY))[DEBUG_INIT_LOGGING_FLAG_KEY]
    || LOGGING_DISABLED_BY_DEFAULT;

  if (isLoggingEnabled) {
    const rawLoggedInitTimes = (await browser.storage.local.get(INIT_TIMES_STORAGE_KEY))[INIT_TIMES_STORAGE_KEY];

    const loggedInitTimes = Array.isArray(rawLoggedInitTimes) ? rawLoggedInitTimes : [];

    // Current time in local format
    const currentLocalTime = new Date().toLocaleString();

    await browser.storage.local.set({ [INIT_TIMES_STORAGE_KEY]: [...loggedInitTimes, currentLocalTime] });
  }
};

export class App {
  static async init() {
    App.#removeListeners();

    UiController.syncInit();

    await trackInitTimesForDebugging();

    KeepAlive.init();

    await engine.api.initStorage();

    /**
     * Initializes connection and message handler as soon as possible
     * to prevent connection errors from extension pages
     */
    ConnectionHandler.init();
    messageHandler.init();

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

    await SettingsService.init();

    /**
     * Injects content scripts into already opened tabs.
     *
     * Does injection when content scripts have not been injected in the current session -
     * avoids unnecessary injections.
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
      /**
       * Some filters may be 'enabled' during update but not 'loaded' yet,
       * e.g. separate annoyances filters are enabled instead of the deprecated
       * combined annoyances filter during the migration.
       *
       * We cannot load them during UpdateService.update()
       * because it is executed too early,
       * and filter state data is not initialized at that moment.
       *
       * And they should be loaded before the engine start,
       * otherwise we will not be able to enable them later.
       */
      await FiltersService.reloadEnabledFilters();
    }

    // Runs tswebextension
    await engine.start();

    appContext.set(AppContextKey.IsInit, true);

    // Update icons to hide "loading" icon
    await IconsService.update();

    /**
     * Initialize filters updates, after engine started, so that it won't mingle with engine
     * initialization from current rules
     */
    filterUpdateController.init();

    // Initialize desktop app service (after engine is started)
    DesktopAppService.init().catch((error) => {
      logger.error('Failed to initialize desktop app controller:', error);
    });

    await sendMessage({ type: MessageType.AppInitialized });
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
      logger.error('Cannot set app uninstall url. Origin error: ', e);
    }
  }
}
