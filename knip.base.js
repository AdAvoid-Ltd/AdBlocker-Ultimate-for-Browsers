/**
 * Shared knip configuration for MV2 and MV3 builds.
 * Platform-specific overrides are in knip.mv3.js and knip.mv2.js.
 */
export default {
  tags: ['-lintignore'],
  include: ['classMembers'],
  ignore: [
    'competitor/**',
    'src/resources/**',
    'docs/**',
  ],
  ignoreIssues: {
    // Storage model classes kept for API completeness
    'src/background/models/browser-storage.js': ['classMembers'],
    'src/background/models/hybrid-storage.js': ['classMembers'],
    'src/background/models/idb-storage.js': ['classMembers'],
  },
  entry: [
    // Webpack bundle entry points (from webpack.common.js)
    'src/pages/background/index.js',
    'src/pages/options/index.jsx',
    'src/pages/popup/index.jsx',
    'src/pages/assistant-inject/index.js',
    'src/pages/page-blocked/index.jsx',

    // Content scripts (injected into web pages, listed in manifest.json)
    'src/content-script/document-start-mv2.js',
    'src/content-script/document-start-mv3.js',
    'src/content-script/subscribe-to-scriptlets.js',

    // Standalone CLI scripts (run via npm scripts, not imported by app code)
    'tools/resources/download-filters.js',
  ],
  project: [
    'src/**/*.js',
    'tools/**/*.js',
  ],
  // Dependencies used by webpack config or as Node.js polyfills — not directly imported in JS
  ignoreDependencies: [
    'css-loader',
    'postcss-loader',
    'style-loader',
    'swc-loader',
    'source-map-loader',
    'preprocess-loader',
    'crypto-browserify',
    'stream-browserify',
    'vm-browserify',
    '@adguard/text-encoding',
    'punycode',
    // Build-time dependencies (injected by SWC/webpack, not directly imported)
    'core-js',
    'buffer',
    // knip can't trace file-saver usage through dynamic imports
    'file-saver',
  ],
};
