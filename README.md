# Pulse Bluetooth Demo App

This is react-native app to scan for nearby bluetooth devices and read data from them.

## Demo

https://github.com/user-attachments/assets/f71d8926-d15d-405d-97d4-58907a2e70ac

## Running Locally

```bash
# 1. install dependencies
npm install

# 2. connect your device to the computer
# 3. make sure you have setup mobile development enviorment (Android studio for Android and Xcode for ios)


# 4a. run on android
npm run android

# 4b. run on ios
npm run ios
```

Since this app has a native component for interfacing with Bluetooth hardware, you'll need to make sure you have the native app development environment configured correctly.

Please refer expo's [android](https://docs.expo.dev/get-started/set-up-your-environment/?mode=development-build&buildEnv=local&platform=android&device=physical) or [ios](https://docs.expo.dev/get-started/set-up-your-environment/?mode=development-build&buildEnv=local&platform=ios&device=physical) setup docs for detailed steps.

I've tested the app on my Android device. I haven't tried it out on an ios device yet.
