fastlane documentation
================
# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```
xcode-select --install
```

Install _fastlane_ using
```
[sudo] gem install fastlane -NV
```
or alternatively using `brew install fastlane`

# Available Actions
### git_check
```
fastlane git_check
```
Various checks for git branch

----

## iOS
### ios certificates
```
fastlane ios certificates
```
Fetch certificates and provisioning profiles
### ios build
```
fastlane ios build
```
Build the iOS application.
### ios bump
```
fastlane ios bump
```
Increment the build bersion.
### ios beta
```
fastlane ios beta
```
Ship to Testflight.
### ios beta_ci
```
fastlane ios beta_ci
```
Ship to TestFlight in CI

----

## Android
### android apk
```
fastlane android apk
```
Build the Android application for Debug.
### android build
```
fastlane android build
```
Build the Android application for Release.
### android beta
```
fastlane android beta
```
Ship to Playstore Beta.

----

This README.md is auto-generated and will be re-generated every time [fastlane](https://fastlane.tools) is run.
More information about fastlane can be found on [fastlane.tools](https://fastlane.tools).
The documentation of fastlane can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
