module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./jest/setup.js'],
  moduleNameMapper: {
    '^react-native/Libraries/Animated/NativeAnimatedHelper$': '<rootDir>/jest/__mocks__/NativeAnimatedHelper.js',
    '^react-native-webview$': '<rootDir>/jest/__mocks__/react-native-webview.js',
    '^react-native-signature-canvas$': '<rootDir>/jest/__mocks__/react-native-signature-canvas.js'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-gesture-handler|react-native-linear-gradient|react-native-reanimated|react-native-safe-area-context|react-native-screens|react-native-signature-canvas|react-native-webview|react-native-vector-icons|react-native-worklets|react-native-image-picker|react-native-size-matters)/)'
  ],
};
