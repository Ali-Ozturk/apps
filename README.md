# Everyday Toolbox for iOS

Everyday Toolbox is an Expo SDK 55 React Native app containing five small local-first tools:

- Reminders: one-time or recurring local iOS notifications, including a Time Sensitive alarm-like option.
- Last Time: track when you last completed custom items, with relative dates and sorting.
- Countdowns: favorite events and see days/hours/minutes remaining.
- Grocery List: daily lists, automatic local-date rollover, suggestions, and history.
- API Toolbox: save and run HTTP actions, format JSON responses, and resolve `{{SECRET_NAME}}` header values from iOS Keychain.

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

For an iOS simulator build:

```powershell
npm run ios:simulator
```
