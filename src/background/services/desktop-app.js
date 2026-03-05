import { logger } from '../../common/logger';
import { engine } from '../engine';
import { eventBus } from '../event-bus';
import { ALLOWLIST_RULE_REGEX, EventType } from '../../common/constants';
import { DESKTOP_APP_ACTIVE_KEY, DESKTOP_APP_INSTALLED_KEY } from '../storage-keys';
import { browserModel } from '../models';

import { AllowlistService, UserRulesService } from './filters';

const DESKTOP_APP_WS_URL = 'wss://self.adblockultimate.net/ws/api';

/**
 * Number of immediate reconnect attempts before switching to periodic retries.
 * Note: Each attempt takes ~30-60s due to browser's WebSocket connection timeout.
 */
const MAX_RECONNECT_ATTEMPTS = 3;

/**
 * Timeout for WebSocket message responses (not connection timeout).
 * The browser controls connection timeout (~30-60s), but message responses
 * need an explicit timeout to avoid hanging promises.
 */
const REQUEST_TIMEOUT_MS = 5000;

/**
 * Interval for periodic reconnection attempts after initial attempts fail.
 * Allows desktop app to be started after the extension without requiring restart.
 */
const PERIODIC_RETRY_MS = 60000;

export class DesktopAppService {
  static #ws = null;

  static #guid = null;

  static #isActive = false;

  static #isInstalled = false;

  static #settingsVersion = 0;

  static #reconnectAttempts = 0;

  static #pendingRequests = new Map();

  static #isSyncing = false;

  static async init() {
    // Load persisted installed status
    const wasInstalled = await browserModel.get(DESKTOP_APP_INSTALLED_KEY);
    if (wasInstalled) {
      DesktopAppService.#isInstalled = true;
    }

    try {
      await DesktopAppService.#connect();
    } catch {
      // Initial connection failed - reconnect logic will handle retries
      // This is expected when desktop app is not running
    }
    DesktopAppService.#setupNotifierListeners();
  }

  static isActive() {
    return DesktopAppService.#isActive;
  }

  static isInstalled() {
    return DesktopAppService.#isInstalled;
  }

  static async #connect() {
    return new Promise((resolve, reject) => {
      try {
        DesktopAppService.#ws = new WebSocket(DESKTOP_APP_WS_URL);

        DesktopAppService.#ws.onopen = async () => {
          logger.info('Connected to desktop app WebSocket');

          // Mark as installed if this is the first successful connection
          if (!DesktopAppService.#isInstalled) {
            DesktopAppService.#isInstalled = true;
            await browserModel.set(DESKTOP_APP_INSTALLED_KEY, true);
            logger.info('Desktop app detected and marked as installed');
          }

          DesktopAppService.#reconnectAttempts = 0;
          try {
            await DesktopAppService.#getKey();
            await DesktopAppService.#getSettings();

            resolve();
          } catch (error) {
            logger.error('Failed to initialize desktop app connection:', error);
            reject(error);
          }
        };

        DesktopAppService.#ws.onmessage = (event) => {
          const data = JSON.parse(event.data);

          // Handle push notifications
          if (data.action === 'updated') {
            logger.info('Desktop app settings updated, syncing...');

            DesktopAppService.#getSettings().catch((error) => {
              logger.error('Failed to sync settings after desktop update:', error);
            });

            return;
          }

          // Handle responses to pending requests
          if (data.requestId && DesktopAppService.#pendingRequests.has(data.requestId)) {
            const handler = DesktopAppService.#pendingRequests.get(data.requestId);

            handler(data);
          }
        };

        DesktopAppService.#ws.onerror = () => {
          // Error details are logged by the browser; the Event object only contains {isTrusted: true}
          reject(new Error('WebSocket connection failed'));
        };

        DesktopAppService.#ws.onclose = () => {
          logger.info('Desktop app WebSocket closed');
          DesktopAppService.#handleDisconnect();
          DesktopAppService.#reconnect();
        };
      } catch {
        // Synchronous WebSocket creation error - very rare
        reject(new Error('Failed to create WebSocket connection'));
      }
    });
  }

  static #handleDisconnect() {
    if (DesktopAppService.#isActive) {
      DesktopAppService.#isActive = false;
      // Resume extension filtering
      engine.setFilteringState(true).catch((error) => {
        logger.error('Failed to resume filtering after desktop disconnect:', error);
      });

      browserModel.set(DESKTOP_APP_ACTIVE_KEY, false).catch((error) => {
        logger.error('Failed to update DesktopAppActive setting after disconnect:', error);
      });

      logger.info('Desktop app disconnected, extension filtering resumed');
    }
  }

  /**
   * Attempts to reconnect to the desktop app.
   *
   * Phase 1: Quick retries (no delay between attempts).
   * Each attempt takes ~30-60s due to the browser's WebSocket connection timeout
   * when the server is unreachable, so no additional delay is needed.
   *
   * Phase 2: Periodic retries every 60s indefinitely.
   * Allows the desktop app to be started at any time without requiring
   * extension reload. The overhead is minimal (one failed attempt per minute).
   */
  static #reconnect() {
    if (DesktopAppService.#reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      // Phase 1: Quick retries - browser timeout (~30-60s) provides natural spacing
      DesktopAppService.#reconnectAttempts++;

      logger.debug(
        `Reconnecting to desktop app (attempt ${DesktopAppService.#reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`,
      );

      DesktopAppService.#connect().catch(() => {
        if (DesktopAppService.#reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          logger.warn(
            `Failed to connect to desktop app after ${MAX_RECONNECT_ATTEMPTS} attempts. `
            + 'Will retry periodically in case the app starts later.',
          );
        }
      });
    } else {
      // Phase 2: Periodic retries - desktop app may be started later
      setTimeout(() => {
        DesktopAppService.#connect().catch(() => {
          // Silent fail - desktop app may not be installed
        });
      }, PERIODIC_RETRY_MS);
    }
  }

  static #sendMessage(action, type, payload = {}) {
    return new Promise((resolve, reject) => {
      if (!DesktopAppService.#ws || DesktopAppService.#ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));

        return;
      }

      const requestId = Math.random().toString(36).substring(2, 15);

      const message = {
        action,
        type,
        client: 'EXT',
        key: DesktopAppService.#guid || undefined,
        requestId,
        ...payload,
      };

      const timeout = setTimeout(() => {
        DesktopAppService.#pendingRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }, REQUEST_TIMEOUT_MS);

      const handler = (response) => {
        clearTimeout(timeout);
        DesktopAppService.#pendingRequests.delete(requestId);

        if (response.result === false) {
          reject(new Error('Request failed'));
        } else {
          resolve(response);
        }
      };

      DesktopAppService.#pendingRequests.set(requestId, handler);
      DesktopAppService.#ws.send(JSON.stringify(message));
    });
  }

  static async #getKey() {
    const response = await DesktopAppService.#sendMessage('get', 'get_key');

    DesktopAppService.#guid = response.key;
    logger.info('Received desktop app UUID:', DesktopAppService.#guid);

    return response;
  }

  static async #getSettings() {
    if (!DesktopAppService.#guid) {
      await DesktopAppService.#getKey();
    }

    try {
      const response = await DesktopAppService.#sendMessage('get', 'settings');

      if (response.active && response.result) {
        DesktopAppService.#isActive = true;
        DesktopAppService.#settingsVersion = response.version || 0;

        // Pause extension filtering
        await engine.setFilteringState(false);
        await browserModel.set(DESKTOP_APP_ACTIVE_KEY, true);
        logger.info('Desktop app is active, extension filtering paused');

        // Sync settings from desktop to extension
        await DesktopAppService.#syncFromDesktop(response.rules || [], response.whitelist || []);
      } else if (DesktopAppService.#isActive) {
        DesktopAppService.#isActive = false;
        await engine.setFilteringState(true);
        await browserModel.set(DESKTOP_APP_ACTIVE_KEY, false);
        logger.info('Desktop app is inactive, extension filtering resumed');
      }
    } catch (error) {
      logger.error('Failed to get settings from desktop app:', error);

      throw error;
    }
  }

  static async #setSettings(rules, whitelist) {
    if (!DesktopAppService.#guid) {
      await DesktopAppService.#getKey();
    }

    if (!DesktopAppService.#isActive) {
      // Only sync if desktop app is active
      return;
    }

    try {
      DesktopAppService.#settingsVersion += 1;

      await DesktopAppService.#sendMessage('set', 'settings', {
        version: DesktopAppService.#settingsVersion,
        rules,
        whitelist,
      });

      logger.info('Settings synced to desktop app, version:', DesktopAppService.#settingsVersion);
    } catch (error) {
      logger.error('Failed to set settings to desktop app:', error);
      // Decrement version on failure
      DesktopAppService.#settingsVersion -= 1;
    }
  }

  static async #syncFromDesktop(rules, whitelist) {
    if (DesktopAppService.#isSyncing) {
      return;
    }

    DesktopAppService.#isSyncing = true;

    try {
      // Sync user rules (handle empty array to clear rules)
      if (Array.isArray(rules)) {
        const rulesText = rules.length > 0 ? rules.join('\n') : '';

        await UserRulesService.setUserRules(rulesText);
        logger.info(`Synced ${rules.length} user rules from desktop app`);
      }

      // Sync whitelist (handle empty array to clear whitelist)
      if (Array.isArray(whitelist)) {
        AllowlistService.setAllowlistDomains(whitelist);
        logger.info(`Synced ${whitelist.length} whitelist domains from desktop app`);
      }
    } catch (error) {
      logger.error('Failed to sync settings from desktop app:', error);
    } finally {
      DesktopAppService.#isSyncing = false;
    }
  }

  /**
   * Syncs settings from extension to desktop app.
   * Separates allowlist-style exception rules from regular rules.
   */
  static async #syncToDesktop() {
    if (!DesktopAppService.#isActive || DesktopAppService.#isSyncing) {
      return;
    }

    try {
      const userRulesText = await UserRulesService.getOriginalUserRules();
      const allRules = userRulesText
        .split(/\r?\n/)
        .map((rule) => rule.trim())
        .filter((rule) => rule.length > 0);

      // Filter out exception rules - they're already in AllowlistService
      const regularRules = allRules.filter((rule) => !rule.match(ALLOWLIST_RULE_REGEX));

      // Get whitelist directly from AllowlistService (plain domains after fix)
      const whitelist = AllowlistService.getAllowlistDomains();

      logger.debug('Regular rules:', regularRules);
      logger.debug('Whitelist domains:', whitelist);

      await DesktopAppService.#setSettings(regularRules, whitelist);
    } catch (error) {
      logger.error('Failed to sync settings to desktop app:', error);
    }
  }

  static #setupNotifierListeners() {
    // Listen for user rules updates
    eventBus.on([EventType.UserFilterUpdated], () => {
      DesktopAppService.#syncToDesktop().catch((error) => {
        logger.error('Failed to sync user rules to desktop:', error);
      });
    });

    // Listen for whitelist updates
    eventBus.on([EventType.UpdateAllowlistFilterRules], () => {
      DesktopAppService.#syncToDesktop().catch((error) => {
        logger.error('Failed to sync whitelist to desktop:', error);
      });
    });
  }
}
