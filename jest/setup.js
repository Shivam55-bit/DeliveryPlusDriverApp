require('react-native-gesture-handler/jestSetup');
require('./__mocks__/react-native-worklets');
const mockReanimated = require('react-native-reanimated/mock');

jest.mock('react-native-reanimated', () => mockReanimated);
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper', () => require('./__mocks__/NativeAnimatedHelper'));
