# PROJECT_STRUCTURE

## Repository Tree (depth 4)

```text
Jada App Project/
|-- apps/
|   |-- rider/
|   |   |-- App.js
|   |   |-- app.json
|   |   |-- app.config.js
|   |   |-- metro.config.js
|   |   |-- package.json
|   |   |-- .env
|   |   |-- android/
|   |   |-- assets/
|   |   |-- package/
|   |   `-- src/
|   |       |-- sharedTest.js
|   |       |-- components/
|   |       |-- context/
|   |       |-- hooks/
|   |       |-- monitoring/
|   |       |-- navigation/
|   |       |-- screens/
|   |       |-- services/
|   |       `-- utils/
|   `-- driver/
|       |-- App.js
|       |-- app.json
|       |-- app.config.js
|       |-- metro.config.js
|       |-- package.json
|       |-- .env
|       |-- android/
|       |-- assets/
|       |-- package/
|       `-- src/
|           |-- sharedTest.js
|           |-- components/
|           |-- context/
|           |-- hooks/
|           |-- monitoring/
|           |-- navigation/
|           |-- screens/
|           |-- services/
|           `-- utils/
|-- packages/
|   `-- shared/
|       |-- package.json
|       `-- src/
|           `-- index.js
|-- functions/
|   |-- src/
|   `-- package.json
|-- firebase.json
|-- .firebaserc
`-- package.json
```

## How To Run

1. Install once at repo root:

```bash
npm install
```

2. Start rider app:

```bash
npm run rider
```

3. Start driver app:

```bash
npm run driver
```

Equivalent direct workspace commands:

```bash
npm --workspace apps/rider run start
npm --workspace apps/driver run start
```

## Shared Package

- Shared code lives in `packages/shared`.
- Package name is `@jada/shared`.
- Export is defined in `packages/shared/src/index.js`.
- Both apps import it via `src/sharedTest.js` and call it from `App.js`.

Example:

```js
import { sharedHello } from "@jada/shared";
```

## Metro Monorepo Config

Both `apps/rider/metro.config.js` and `apps/driver/metro.config.js`:

- use `getDefaultConfig(projectRoot)` from `expo/metro-config`
- set `watchFolders` to workspace root
- set `resolver.nodeModulesPaths` to:
  - app-local `node_modules`
  - repo-root `node_modules`
- preserve existing SVG transformer setup (`react-native-svg-transformer`)

Why: this makes Metro watch workspace packages and resolve dependencies/shared code correctly in a monorepo.

## App Identity Split

- Rider (`apps/rider/app.json`)
  - `expo.name`: `jada-app`
  - `expo.slug`: `jada-app`
  - `android.package`: `com.jada.app`
  - `ios.bundleIdentifier`: `com.jada.iosapp`
- Driver (`apps/driver/app.json`)
  - `expo.name`: `jada-driver`
  - `expo.slug`: `jada-driver`
  - `android.package`: `com.jada.driver`
  - `ios.bundleIdentifier`: `com.jada.driver`

## Env + Firebase Notes

- Each app has its own `.env` (`apps/rider/.env`, `apps/driver/.env`).
- Expo loads `.env` per app project root.
- `app.config.js` in each app reads `GOOGLE_MAPS_ANDROID_API_KEY` and `GOOGLE_MAPS_IOS_API_KEY` (and `EXPO_PUBLIC_...` fallbacks).
- Firebase backend code stays at repo root in `functions/`.
- If rider and driver should use different Firebase projects later, provide app-specific `google-services.json` / `GoogleService-Info.plist` and update each app config accordingly.
