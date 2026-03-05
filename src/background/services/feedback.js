import { logger } from '../../common/logger';

import { buildUrl, Endpoint } from './ui/url-builder';

export class FeedbackService {
  static async sendFeedback({ message, email }) {
    const formData = new FormData();
    formData.append('message', message);
    formData.append('email', email);

    try {
      await fetch(buildUrl(Endpoint.Feedback), {
        method: 'POST',
        body: formData,
      });
    } catch (error) {
      logger.error('[FeedbackService.sendFeedback]: Error:', error);
    }
  }
}
