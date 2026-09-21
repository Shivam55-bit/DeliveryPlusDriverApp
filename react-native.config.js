const { startCommand, bundleCommand } = require('@react-native/community-cli-plugin');

module.exports = {
  commands: [startCommand, bundleCommand],
  project: {
    ios: {},
    android: {},
  },
  assets: ['./src/assets/fonts/'],
};
