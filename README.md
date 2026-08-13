# Everyday Toolbox for iOS

Everyday Toolbox is an Expo SDK 55 React Native app containing five small local-first tools:

- Reminders: one-time or recurring local iOS notifications, including a Time Sensitive alarm-like option.
- Last Time: track when you last completed custom items, with relative dates and sorting.
- Countdowns: favorite events and see days/hours/minutes remaining.
- Grocery List: daily lists, automatic local-date rollover, suggestions, and history.
- API Toolbox: save and run HTTP actions, format JSON responses, and resolve `{{SECRET_NAME}}` header values from iOS Keychain.
- Receipt Vault: store searchable receipt metadata and multiple local photos.
- Daily Checklist: maintain a reusable checklist whose completion state resets on the local calendar day.
- People Notes: keep lightweight private notes for people without using iOS Contacts.
- Random Wheel: spin a real SVG segmented wheel using a random winner selected before animation.

## iOS widgets

The app includes two WidgetKit widgets:

- Everyday Overview: grocery completion, the oldest Last Time item, and the next reminder.
- Countdowns: the most important upcoming countdown, with a timeline that refreshes the remaining time.

Widgets focus on glanceable information. Tapping one opens the app, where items can be added, edited, completed, reordered, or deleted. API actions are excluded because they are not appropriate for a passive home-screen surface.

Widgets are not available in Expo Go. Build the development client and install it on the iPhone:

```powershell
npm run ios:development
```

After installing the development build, long-press the iPhone Home Screen, tap `+`, search for `Everyday Toolbox`, and add either widget. The widget extension uses the App Group `group.com.alioz.everydaytoolbox`.

## Run locally

```powershell
npm install
npm start
```

Notifications require permission on the iPhone. Data is stored locally with AsyncStorage; API secrets are stored with `expo-secure-store` and are not included in normal app storage. The main tools can run in a development client; the widgets require the development client rather than Expo Go.

Receipt photos are copied into the app's local document directory instead of being stored as base64 in AsyncStorage. Camera and photo-library access are requested only when used. On-device Vision OCR is intentionally not enabled yet; receipt metadata remains fully local and user-entered until a native OCR module is added.

The Random Wheel selects the winner with `Math.random()` before starting the animation, then rotates to that predetermined segment. Removing the winner is temporary until the current list is reset or explicitly saved as a new preset.

## Build an IPA

On Windows, use EAS Build with the locally installed CLI:

```powershell
.\node_modules\.bin\eas.cmd login
npm run ios:ipa
```

The `sidestore` profile creates an unsigned Everyday Toolbox IPA for your sideloading workflow with `withoutCredentials: true`. Use the development profile when you need the WidgetKit extension:

```powershell
npm run ios:development
```

## Versioning

Every iOS build must have a higher build number than the previous build. EAS uses remote version state and `autoIncrement: true` for `npm run ios:ipa`. The GitHub SideStore workflow increments `expo.ios.buildNumber`, commits that change back to the branch, and uses `[skip ci]` so the version commit does not trigger a second build. The marketing version in `expo.version` remains manual, so it can represent intentional releases such as `2.1.0` rather than changing on every commit.

For an iOS simulator build:

```powershell
npm run ios:simulator
```
