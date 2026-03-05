import { abuAssistant } from '@adguard/assistant';

if (!window.adguardAssistant) {
  window.adguardAssistant = abuAssistant();
}
