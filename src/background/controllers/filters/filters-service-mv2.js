import { MessageType } from '../../../common/messages';
import { logger } from '../../../common/logger';
import { messageHandler } from '../../message-handler';
import { engine } from '../../engine';
import {
  Categories,
  FiltersService,
  FilterUpdateService,
  toasts,
} from '../../services';
import { ContextMenuAction, contextMenuEvents } from '../../events';
import { eventBus } from '../../event-bus';
import { EventType } from '../../../common/constants';

export class FiltersController {
  static async init() {
    messageHandler.addListener(MessageType.AddAndEnableFilter, FiltersController.#onFilterEnable);
    messageHandler.addListener(MessageType.DisableFilter, FiltersController.#onFilterDisable);
    messageHandler.addListener(MessageType.EnableFiltersGroup, FiltersController.#onGroupEnable);
    messageHandler.addListener(MessageType.DisableFiltersGroup, FiltersController.#onGroupDisable);
    messageHandler.addListener(MessageType.CheckFiltersUpdate, FiltersController.#manualCheckFiltersUpdate);

    contextMenuEvents.addListener(ContextMenuAction.UpdateFilters, FiltersController.#manualCheckFiltersUpdate);
  }

  /**
   * Enables filter on AddAndEnableFilterMessage message via FiltersController.#enableFilter.
   * If filter group has not been touched before, it will be activated.
   *
   * If filter group has been touched before and it is disabled now, the engine will not be updated.
   */
  static async #onFilterEnable(message) {
    const { filterId } = message.data;

    logger.trace(
      `[ext.FiltersController.onFilterEnable]: background received message to enable filter: id='${filterId}', name='${FiltersService.getFilterName(filterId)}'`,
    );

    /**
     * FiltersController.#enableFilter() method's second arg is 'true'
     * because it is needed to enable not touched group
     */
    FiltersController.#enableFilter(filterId, true);

    const group = Categories.getGroupByFilterId(filterId);

    if (!group) {
      return;
    }

    const { groupId } = group;

    const groupState = Categories.getGroupState(groupId);

    if (!groupState) {
      return;
    }

    if (!groupState.touched) {
      return groupId;
    }

    if (groupState.enabled) {
      engine.debounceUpdate();
    }
  }

  static async #onFilterDisable(message) {
    const { filterId } = message.data;

    logger.trace(
      `[ext.FiltersController.onFilterDisable]: background received message to disable filter: id='${filterId}', name='${FiltersService.getFilterName(filterId)}'`,
    );

    FiltersService.disableFilters([filterId]);

    const group = Categories.getGroupByFilterId(filterId);

    if (!group) {
      return;
    }

    const groupState = Categories.getGroupState(group.groupId);

    if (groupState && groupState.enabled) {
      // update the engine only if the group is enabled
      engine.debounceUpdate();
    }
  }

  /**
   * Enables group on EnableFiltersGroupMessage message via FiltersController.#enableGroup.
   *
   * If group is activated first time, provides list of recommended filters.
   */
  static async #onGroupEnable(message) {
    const { groupId } = message.data;

    const group = Categories.getGroupState(groupId);

    logger.trace(
      `[ext.FiltersController.onGroupEnable]: background received message to enable group: id='${groupId}', name='${Categories.getGroupName(groupId)}'`,
    );

    if (!group) {
      logger.error(`[ext.FiltersController.onGroupEnable]: cannot find group with ${groupId} id`);
      return;
    }

    if (group.touched) {
      FiltersController.#enableGroup(groupId);
      return;
    }

    /**
     * If this is the first time the group has been activated - load and
     * enable the recommended filters.
     */
    const recommendedFiltersIds = Categories.getRecommendedFilterIdsByGroupId(groupId);

    FiltersController.#enableGroup(groupId, recommendedFiltersIds);

    return recommendedFiltersIds;
  }

  static async #onGroupDisable(message) {
    const { groupId } = message.data;

    logger.trace(
      `[ext.FiltersController.onGroupDisable]: background received message to disable group: id='${groupId}', name='${Categories.getGroupName(groupId)}'`,
    );

    Categories.disableGroup(groupId);

    engine.debounceUpdate();
  }

  static async #manualCheckFiltersUpdate() {
    try {
      const updatedFilters = await FilterUpdateService.autoUpdateFilters(true);

      toasts.showFiltersUpdatedAlertMessage(true, updatedFilters);
      eventBus.emit(EventType.FiltersUpdateCheckReady, updatedFilters);

      return updatedFilters;
    } catch (e) {
      toasts.showFiltersUpdatedAlertMessage(false);
      eventBus.emit(EventType.FiltersUpdateCheckReady);
    }
  }

  /**
   * Enables specified group and updates filter engine.
   *
   * On first group activation we provide recommended filters,
   * that will be loaded end enabled before update checking.
   */
  static async #enableGroup(groupId, recommendedFiltersIds = []) {
    await Categories.enableGroup(groupId, true, recommendedFiltersIds);
    engine.debounceUpdate();
  }

  /**
   * Loads and enables specified filter.
   * If filter group has not been touched before, it will be activated.
   *
   * Note: this method **does not update the engine**.
   */
  static async #enableFilter(filterId, shouldEnableGroup = false) {
    await FiltersService.loadAndEnableFilters([filterId], true, shouldEnableGroup);
  }
}
