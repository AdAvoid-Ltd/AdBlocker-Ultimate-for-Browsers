import { TRUSTED_DOCUMENTS_CACHE_KEY } from '../storage-keys';

import { StringStorage } from './string-storage';
import { browserModel } from './shared-instances';

export const trustedDomainsModel = new StringStorage(TRUSTED_DOCUMENTS_CACHE_KEY, browserModel);
