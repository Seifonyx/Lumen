# Lumen iOS SideStore releases

**Stable source URL:** https://raw.githubusercontent.com/Seifonyx/Lumen/main/sidestore-source.json

The source is intentionally empty until the first **publicly reviewed**, downloadable native IPA release exists. Do **not** list an invalid URL, publish private account/QA artifacts without review, or substitute an offline demo for the connected app.

## First release and every subsequent update

1. Build a release-ready SideStore-signable **unsigned** iPhoneOS IPA. Keep `CFBundleIdentifier = io.github.seifonyx.lumen.demo` and the currently working auth/sign-in identity. **Increase `CFBundleShortVersionString` beyond the user's installed `1.0`** for the first actual update, and bump `CFBundleVersion` on each rebuild. Validate compatibility, no destructive data migration, and retained Google sign-in behavior.
2. Complete a separate **public artifact-content review** before releasing an account-connected IPA. The packaged IPA is public; inspect it for private API/provider keys, credentials, QA fixtures, secrets, personal data and unwanted signing material. Firebase public client configuration alone is not a private provider credential, but must retain proper restrictions. Preserve $0 and do not change production auth/security access.
3. Create a **draft GitHub Release** tagged `ios-v<VERSION>`, where `<VERSION>` exactly matches `CFBundleShortVersionString`. Upload one asset named **`Lumen.ipa`** and make sure the asset is fully uploaded *before* publishing.
4. Only after the artifact review passes, put this standalone line in the release notes:

   `SideStore-public-IPA-reviewed: YES`

5. **Publish** the release. The `Publish SideStore source from approved iOS release` GitHub Action checks the public download anonymously, ZIP integrity, unsigned signing state, bundle ID, version/tag match, archive size and common secret signatures. It then commits the release entry into `sidestore-source.json` on `main`. A failed check leaves the source untouched.
6. Verify the GitHub Action is green and inspect the live source JSON; then open SideStore → Sources to see the Lumen listing and update. Source discovery does **not** guarantee unattended installation: users may need to tap Update with LocalDevVPN connected, and refresh free signing every seven days.

The workflow can be retried through **Actions → Publish SideStore source from approved iOS release → Run workflow** with the existing tag if needed. No existing IPA is uploaded by the source-update workflow itself. Protect prior working binaries for rollback and never substitute the new source for real release verification.

**Important:** Do not merge the docs-only `docs/lumen-live-context` branch for project-status synchronization. GitHub website deployment and shipping a SideStore IPA are separate actions.
