# iOS Notification Scheduler

A React Native app using Expo SDK 54 for scheduling local iOS notifications.

## Run locally

```powershell
npm install
npm start
```

Scan the QR code with Expo Go on iOS. The app lets you:

- enter a notification message
- choose a date and time
- make it one-time or recurring
- repeat daily, weekly, monthly, or yearly
- view and cancel scheduled notifications

Local notifications need iOS notification permission. The app asks for it when you tap Allow or schedule your first reminder.

## Build an IPA

An `.ipa` needs Apple's iOS build toolchain. On Windows, use EAS Build:

```powershell
npx eas-cli login
npx eas-cli init
npm run ios:ipa
```

EAS will ask for Apple Developer credentials unless you build an unsigned archive. When the build finishes, it gives you a download link for the artifact.

For a simulator build instead:

```powershell
npm run ios:simulator
```
