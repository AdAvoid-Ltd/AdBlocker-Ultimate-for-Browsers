import '@adguard/tswebextension/content-script';

import { ContentUtils } from './content-utils/main';
import { SubscribeToScriptlets } from './subscribe-to-scriptlets';

/**
 * Following methods are async BUT called without await **intentionally*
 * because if they are called as sync, they can slow down frames loading in Firefox.
 */
ContentUtils.init();
SubscribeToScriptlets.init();
