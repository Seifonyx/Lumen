# SideStore releases

Source URL: https://raw.githubusercontent.com/Seifonyx/Lumen/main/sidestore-source.json

The source lists iOS 1.1.0 (2026-11-08). `.github/workflows/sidestore-release-source.yml` updates it
when a published GitHub release has a reviewed, downloadable native IPA.

Release format:

- Tag `ios-v<VERSION>` matches the IPA's `CFBundleShortVersionString`; increment `CFBundleVersion` for rebuilds.
- Asset name: `Lumen.ipa`, an unsigned iPhoneOS IPA with bundle ID `io.github.seifonyx.lumen.demo`.
- Release notes contain the standalone line `SideStore-public-IPA-reviewed: YES` after the public artifact
  has been checked for private credentials, personal data and signing material.

The workflow checks the public download, ZIP integrity, signing state, bundle ID, version, size and common
secret signatures before updating the source. It can be retried from Actions with the existing release tag.
It updates the listing; it does not build or upload an IPA.

In SideStore, add the source and select Update. LocalDevVPN may be needed; free signing expires after seven days.
Website deployment and an iOS IPA release are separate operations.
