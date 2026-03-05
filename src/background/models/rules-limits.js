import { RULES_LIMITS_KEY } from '../storage-keys';

import { StringStorage } from './string-storage';
import { browserModel } from './shared-instances';

export const rulesLimitsModel = new StringStorage(RULES_LIMITS_KEY, browserModel);
