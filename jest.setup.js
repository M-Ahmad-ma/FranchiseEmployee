/* eslint-env jest */

jest.mock('react-native-safe-area-context', () => {
  const mock = require('react-native-safe-area-context/jest/mock');
  return mock.default ?? mock;
});

jest.mock('lucide-react-native', () => {
  const icon = name => {
    const Icon = () => null;
    Icon.displayName = name;
    return Icon;
  };
  return new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === '__esModule') {
          return true;
        }
        return icon(String(prop));
      },
    },
  );
});

jest.mock('@react-native-community/datetimepicker', () => {
  const DateTimePicker = () => null;
  return {
    __esModule: true,
    default: DateTimePicker,
  };
});
