# Everyday Toolbox for iOS

Everyday Toolbox is an Expo SDK 54 React Native app containing five small local-first tools:

- Reminders: one-time or recurring local iOS notifications, including a Time Sensitive alarm-like option.
- Last Time: track when you last completed custom items, with relative dates and sorting.
- Countdowns: favorite events and see days/hours/minutes remaining.
- Grocery List: daily lists, automatic local-date rollover, suggestions, and history.
- API Toolbox: save and run HTTP actions, format JSON responses, and resolve `{{SECRET_NAME}}` header values from iOS Keychain.

## Run locally

```powershell
npm install
npm start
```

Most tools work in Expo Go. Notifications require permission on the iPhone. Data is stored locally with AsyncStorage; API secrets are stored with `expo-secure-store` and are not included in normal app storage.

## WidgetKit

The countdown data model is ready for a native iOS WidgetKit extension, but Expo Go cannot load WidgetKit extensions. A proper iOS development build must add a WidgetKit target, an App Group shared container, and a small Swift timeline provider that reads the selected countdowns from the shared container. The app should call `WidgetCenter.shared.reloadAllTimelines()` whenever countdown data changes. This requires an Apple Developer build and cannot be represented by a JavaScript-only Expo Go app.

## Build an IPA

On Windows, use EAS Build with the locally installed CLI:

```powershell
.\node_modules\.bin\eas.cmd login
npm run ios:ipa
```

The `sidestore` profile creates an unsigned Everyday Toolbox IPA for your sideloading workflow with `withoutCredentials: true`. For the WidgetKit version, use the development profile after adding the native extension and App Group configuration:

```powershell
npm run ios:development
```

For an iOS simulator build:

```powershell
npm run ios:simulator
```
