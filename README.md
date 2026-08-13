# Hello World iOS

A tiny React Native app using Expo, ready for an iOS `.ipa` build with EAS.

## Run locally

```powershell
npm install
npm start
```

This opens Expo Dev Tools. You can scan the QR code with Expo Go for quick testing.

## Build an IPA

An `.ipa` needs Apple's iOS build toolchain. On Windows, use EAS Build:

```powershell
npx eas-cli login
npx eas-cli init
npm run ios:ipa
```

EAS will ask for Apple Developer credentials and can manage signing for you. When the build finishes, it gives you a download link for the `.ipa`.

For a simulator build instead:

```powershell
npm run ios:simulator
```
