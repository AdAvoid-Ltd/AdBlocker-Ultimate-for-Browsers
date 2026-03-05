import base from './knip.base.js';

export default {
  ...base,
  ignoreIssues: {
    ...base.ignoreIssues,
    // MV2 dummy stubs for MV3-only RulesLimits API shape compatibility
    'src/background/controllers/rules-limits/rules-limits-service-mv2.js': ['classMembers'],
  },
  entry: [
    ...base.entry,
    // MV3 implementation files as extra entry points (not reachable via MV2 aliases)
    'src/background/app/app-mv3.js',
    'src/background/engine/engine-mv3.js',
    'src/background/tswebextension/tswebextension-mv3.js',
    'src/background/browser-api/scripting-mv3.js',
    'src/background/controllers/settings/settings-service-mv3.js',
    'src/background/controllers/filters/filters-service-mv3.js',
    'src/background/controllers/rules-limits/rules-limits-service-mv3.js',
    'src/background/services/network/network-mv3.js',
    'src/background/services/network/settings-mv3.js',
    'src/background/services/filters/update/update-mv3.js',
    'src/background/services/filters/common/common-mv3.js',
  ],
  // Webpack alias resolution pointing to MV2 files
  paths: {
    'app': ['./src/background/app/app-mv2.js'],
    'engine': ['./src/background/engine/engine-mv2.js'],
    'tswebextension': ['./src/background/tswebextension/tswebextension-mv2.js'],
    'scripting-controller': ['./src/background/browser-api/scripting-mv2.js'],
    'settings-controller': ['./src/background/controllers/settings/settings-service-mv2.js'],
    'filters-controller': ['./src/background/controllers/filters/filters-service-mv2.js'],
    'rules-limits-controller': ['./src/background/controllers/rules-limits/rules-limits-service-mv2.js'],
    'network-service': ['./src/background/services/network/network-mv2.js'],
    'network-service-settings': ['./src/background/services/network/settings-mv2.js'],
    'filters-update-service': ['./src/background/services/filters/update/update-mv2.js'],
    'common-filter-service': ['./src/background/services/filters/common/common-mv2.js'],
    'filter-update-controller': ['./src/background/services/filter-update/filter-update-mv2.js'],
  },
};
