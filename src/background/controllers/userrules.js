import { UnsupportedRegexpError } from '@adguard/tswebextension/mv3';
import { RuleGenerator } from '@adguard/agtree/generator';

import { MessageType } from '../../common/messages';
import { messageHandler } from '../message-handler';
import { UserRulesService } from '../services';
import { logger } from '../../common/logger';

export class UserRulesController {
  static #engine;

  static async init(engine) {
    UserRulesController.#engine = engine;

    messageHandler.addListener(MessageType.GetUserRules, UserRulesController.#getUserRules);
    messageHandler.addListener(MessageType.SaveUserRules, UserRulesController.#handleUserRulesSave);
    messageHandler.addListener(MessageType.AddUserRule, UserRulesController.#handleUserRuleAdd);
    messageHandler.addListener(MessageType.RemoveUserRule, UserRulesController.#handleUserRuleRemove);

    UserRulesController.#engine.api.onAssistantCreateRule.subscribe(UserRulesController.#addUserRule);
  }

  static #getUserRules() {
    return UserRulesService.getOriginalUserRules();
  }

  static async #addUserRule(rule) {
    await UserRulesService.addUserRule(rule);

    UserRulesController.#engine.debounceUpdate();
  }

  static async #handleUserRulesSave(message) {
    const { value } = message.data;

    await UserRulesService.setUserRules(value);
    await UserRulesController.#engine.update();
  }

  static async #handleUserRuleAdd(message) {
    const { ruleText } = message.data;

    await UserRulesService.addUserRule(ruleText);

    UserRulesController.#engine.debounceUpdate();
  }

  static async #handleUserRuleRemove(message) {
    const { ruleText } = message.data;

    await UserRulesService.removeUserRule(ruleText);

    UserRulesController.#engine.debounceUpdate();
  }

  static checkUserRulesRegexpErrors(result) {
    const errors = result.dynamicRules?.errors?.filter((error) => error instanceof UnsupportedRegexpError) || [];

    if (errors.length > 0) {
      errors.forEach((error) => {
        logger.error(
          '[ext.UserRulesController.checkUserRulesRegexpErrors]: User rule parsing error:',
          `\nRule: ${RuleGenerator.generate(error.networkRule.node)}`,
          '\nReason:',
          error,
        );
      });
    }
  }
}
