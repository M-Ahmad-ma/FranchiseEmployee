# Build & Run

```sh
npm install
bundle install
bundle exec pod install   # iOS only, first clone / after native dep changes
npm run android           # or: npm run ios
```

## Native dependencies

The picker libraries need a real device or emulator — the mocks in
`jest.setup.js` only stand in for Jest.

| Package | Used by | Rebuild needed? |
|---|---|---|
| `react-native-image-picker` | Company Media uploads, lead info images | yes |
| `@react-native-documents/picker` | PDF selection for Company Media | yes |
| `react-native-video` | In-app video playback in Company Media | yes |

## Building a test APK

A dummy signing key for internal builds lives at `android/app/testing.keystore`,
with credentials and build commands in
[`TESTING_KEYSTORE.md`](./TESTING_KEYSTORE.md).

```sh
cd android && ./gradlew assembleQa
```

Use this rather than `assembleDebug` when you need an APK that runs without
Metro. Do not publish anything signed with it — the password is in the repo.

Adding either one invalidates the native build; rerun `pod install` (iOS) or
rebuild the app (Android). Both resolve a TurboModule at import time, which is
why they are mocked for tests.

## Checks

```sh
npm run lint     # 0 errors (warnings are pre-existing inline-style noise)
npm test
npx tsc --noEmit
```

## Pointing at the server

`src/config/index.ts` holds two switches:

- `API_BASE_URL` — the server origin. `TEAM_API_BASE` appends `/api/team`.
- `USE_MOCK` — `true` returns fixtures from `src/services/mockFixtures.ts`;
  `false` hits the real endpoints. Every service branches on this flag.

Flip `USE_MOCK` to `false` to exercise the live API. Note that the picker
mocks are test-only, so uploads work normally outside Jest.

### Seeing what the API returns

Two flags, both off by default. Turn them on in the files named below and the
output appears in the Metro terminal (`npx react-native start`) or the Xcode
console.

| Flag | File | Effect |
|---|---|---|
| `LOG_API` | `src/services/apiLogger.ts` | Every request: method, route, status, timing, request and response bodies |
| `LOG_API_BODIES` | `src/services/apiLogger.ts` | Set `false` to keep bodies out of the log and see only method/status/timing |
| `LOG_MOCK` | `src/services/mockLogger.ts` | Every mocked call, with the fixture returned instead |
| `LOG_MOCK_BODIES` | `src/services/mockLogger.ts` | Set `false` to log only the endpoint name |

Set `LOG_API = true` **and** `USE_MOCK = false` together. With mocks on there is
no HTTP traffic, which is why the two are separate — a silent log then means
fixtures were served, not that the server failed to respond.

Lines look like this:

```
[api 14:22:31] → GET /api/team/leads/filter?pipeline=2 {"mock":false}
[api 14:22:31] ← GET /api/team/leads/filter {"status":200,"in":"184ms"}
[api 14:22:31]   response: {"status":true,"data":{"leads":[...]},"meta":{...}}
[api 14:22:31] ✗ POST /api/team/media/upload {"status":400,"in":"96ms","error":"..."}
```

`→` is sent, `←` received, `✗` failed. Bodies are truncated at 2 KB so a
200-row list does not bury the console, and the real byte count is appended
when that happens.

Both loggers are forced off in release builds (`__DEV__`). They print response
bodies, which include session state and employee phone numbers, so do not
leave `LOG_API` on in a build you ship.

### Session handling

The API is session-based, not token-based. `httpClient.ts` keeps its own
`ci_session` jar and replays the cookie on every request, and catches the
2-hour expiry locally so a lapsed session drops to Login before a request
fails.

The jar is in memory only, so **every app restart requires signing in again.**
Persisting it across launches needs `@react-native-async-storage/async-storage`
plus storing `sessionExpiresAt` alongside it — not implemented, since it was
outside the scope of the endpoint work.