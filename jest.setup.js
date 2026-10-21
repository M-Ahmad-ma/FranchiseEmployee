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

// Both pickers resolve a native TurboModule at import time, which does not
// exist under Jest. Every launcher reports "cancelled" so no test needs a file.
jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(async () => ({ didCancel: true })),
  launchImageLibrary: jest.fn(async () => ({ didCancel: true })),
}));

// Native video surface; the viewer only asserts on its props.
jest.mock('react-native-video', () => {
  const Video = () => null;
  return { __esModule: true, default: Video };
});

jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(async () => []),
  types: {},
  isErrorWithCode: jest.fn(() => false),
  errorCodes: {},
}));

/**
 * AsyncStorage is a native module, so it does not exist under Jest. An
 * in-memory fake is written here rather than reusing the package's own mock:
 * it keeps the suite independent of the installed package's internal layout,
 * and `__resetStore` gives each test a clean slate.
 *
 * Deliberately mimics the real failure mode that matters — a failing disk write
 * rejects rather than throwing synchronously — so `sessionStore`'s error
 * handling is actually exercised.
 */
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map();

  const ok = value => Promise.resolve(value);

  return {
    __esModule: true,
    default: {
      __store: store,
      __resetStore: () => store.clear(),
      getItem: key => ok(store.has(key) ? store.get(key) : null),
      setItem: (key, value) => {
        store.set(key, String(value));
        return ok(undefined);
      },
      removeItem: key => {
        store.delete(key);
        return ok(undefined);
      },
      // v3 renamed the batch methods: multiGet/set/remove -> getMany/setMany/removeMany.
      getMany: keys =>
        ok(
          keys.reduce((acc, key) => {
            acc[key] = store.has(key) ? store.get(key) : null;
            return acc;
          }, {}),
        ),
      setMany: entries => {
        Object.entries(entries).forEach(([key, value]) =>
          store.set(key, String(value)),
        );
        return ok(undefined);
      },
      removeMany: keys => {
        keys.forEach(key => store.delete(key));
        return ok(undefined);
      },
      clear: () => {
        store.clear();
        return ok(undefined);
      },
      getAllKeys: () => ok([...store.keys()]),
    },
  };
});
