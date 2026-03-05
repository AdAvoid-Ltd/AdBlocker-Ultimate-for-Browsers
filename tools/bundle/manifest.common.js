import { DOCUMENT_START_OUTPUT } from '../../constants.js';

export const commonManifest = {
  manifest_version: 2,
  name: '__MSG_name__',
  short_name: '__MSG_short_name__',
  author: 'AdAvoid Ltd.',
  default_locale: 'en',
  description: '__MSG_description__',
  icons: {
    16: 'assets/icons/enabled-16.png',
    32: 'assets/icons/enabled-32.png',
    48: 'assets/icons/enabled-48.png',
    128: 'assets/icons/enabled-128.png',
  },
  content_scripts: [
    {
      all_frames: true,
      js: [`${DOCUMENT_START_OUTPUT}.js`],
      matches: ['http://*/*', 'https://*/*'],
      match_about_blank: true,
      run_at: 'document_start',
    },
  ],
};
