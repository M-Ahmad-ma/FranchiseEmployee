module.exports = {
  preset: '@react-native/jest-preset',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '\\.css$': '<rootDir>/__mocks__/cssMock.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-native-documents|nativewind|react-native-css-interop|@react-navigation|react-native-image-picker|react-native-screens|react-native-safe-area-context|react-native-svg)/)',
  ],
};
