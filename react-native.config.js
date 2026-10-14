const { startCommand, bundleCommand } = require('@react-native/community-cli-plugin');

module.exports = {
  commands: [startCommand, bundleCommand],
  project: {
    ios: {
      automaticPodsInstallation: false,
    },
    android: {},
  },
  assets: ['./src/assets/fonts/'],
};
