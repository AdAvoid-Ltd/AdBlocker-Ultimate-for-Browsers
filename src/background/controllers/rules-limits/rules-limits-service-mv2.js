/**
 * This service is a empty dummy to correct work of MV2 build without
 * using MV3 code.
 */
export class RulesLimitsController {
  static init() {}

  static getExpectedEnabledFilters = () => {
    throw new Error('Not implemented');
  };

  static areFilterLimitsExceeded() {
    throw new Error('areFilterLimitsExceeded Not implemented');
  }
}

export const rulesLimitsController = new RulesLimitsController();
