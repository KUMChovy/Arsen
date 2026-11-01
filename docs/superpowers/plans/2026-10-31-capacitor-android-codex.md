# Arsen Codex Android with Capacitor Implementation Plan

> **For inline execution:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. No Git operations are authorized; do not create commits, branches, worktrees, tags, or pushes.

**Goal:** Add a distinct Capacitor Android application for this PWA with `com.kumchovy.arsen.codex`, compile a debug APK with the installed Android SDK, and preserve the web PWA/Dexie offline behavior.

**Architecture:** Keep the existing Vite output as the single web bundle and use Capacitor only as the native container. The browser keeps the existing production service worker; the Capacitor WebView skips service-worker registration to avoid native plugin-injection conflicts while continuing to use the same Dexie database and domain services.

**Tech Stack:** React 19, TypeScript, Vite, Dexie/IndexedDB, pnpm 11.2.2, Capacitor current compatible release, Android Gradle project, Android SDK Build Tools 36.x, Android platform 36.1.

**Spec:** `docs/superpowers/specs/2026-10-31-capacitor-android-codex-design.md`

## Global Constraints

- `appId` must be `com.kumchovy.arsen.codex`.
- `appName` must be `Arsen Codex`.
- `webDir` must be `dist`.
- Install and run project tooling through pnpm; do not run npm install.
- Respect `.npmrc`: `save-exact=true` and `ignore-scripts=true`.
- Do not change Dexie database name `arsen` or schema version 7.
- Keep web service-worker behavior working; skip it only in native Capacitor runtime after testing both paths.
- Do not perform any Git operation.
- The OpenCode variant is outside this repository; only ensure this app's package ID is distinct.

## Review Focus

- Native versus browser service-worker registration: native must not register it, while production web still does; pin in `src/app/registerServiceWorker.test.ts`.
- Fresh Android installs versus updates: `applicationId`, launcher label, and debug APK path must be stable; pin with generated Android manifest/resource inspection and `adb install -r`.
- Missing or non-PATH Android SDK variables: build commands must work with the discovered SDK path supplied through `ANDROID_SDK_ROOT`/`ANDROID_HOME`; pin in `CAPACITOR.md` and the build verification command.
- Dexie continuity after native restart: routine, Sinful Shell copy, and registered set must remain in the same IndexedDB database; pin with existing Dexie integration tests plus the manual APK flow.
- Web build/offline regression: `dist/sw.js`, manifest, and web preview must remain generated; pin with `pnpm test`, `pnpm build`, and preview artifact checks.

### Task 1: Install Capacitor and define project commands

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml` (written by pnpm)
- Create: `capacitor.config.ts`

**Interfaces:**
- Consumes: Existing Vite `dist` output and package manager configuration.
- Produces: Exact Capacitor package versions, typed config, and pnpm scripts used by later tasks.

- [ ] **Step 1: Record the pre-change baseline**

  Run `pnpm test` and `pnpm build` before installing anything. Record pass/fail output and confirm the working tree contains no unrelated changes; do not use Git commands to do so.

- [ ] **Step 2: Install the three required packages with pnpm**

  Run:

  ```powershell
  pnpm add @capacitor/core @capacitor/android
  pnpm add -D @capacitor/cli
  ```

  The commands must leave `ignore-scripts=true` in force and save exact versions. Verify `package.json` and `pnpm-lock.yaml` contain all three packages and no npm lockfile was created.

- [ ] **Step 3: Create `capacitor.config.ts`**

  Export a `CapacitorConfig` with exactly `appId: 'com.kumchovy.arsen.codex'`, `appName: 'Arsen Codex'`, and `webDir: 'dist'`. If the installed CLI exposes a typed pnpm package-manager option, set `npmClient: 'pnpm'`; otherwise keep all commands explicitly prefixed with `pnpm exec` and document that choice.

- [ ] **Step 4: Add pnpm scripts**

  Add these scripts without replacing existing web scripts:

  - `cap:sync`: `pnpm build && pnpm exec cap sync android`
  - `cap:build`: `pnpm build && pnpm exec cap sync android && pnpm exec cap build android`
  - `cap:open`: `pnpm exec cap open android`
  - `cap:run`: `pnpm exec cap run android`

- [ ] **Step 5: Verify the config and package manager path**

  Run `pnpm exec cap --version` and `pnpm exec cap doctor`. Expected: the CLI loads from pnpm, recognizes the typed config, and reports no missing Capacitor core/platform package.

### Task 2: Make service-worker behavior explicit and testable

**Files:**
- Modify: `src/app/registerServiceWorker.ts`
- Create: `src/app/registerServiceWorker.test.ts`

**Interfaces:**
- Consumes: `Capacitor.isNativePlatform()` from `@capacitor/core` and the existing production-only registration behavior.
- Produces: `shouldRegisterServiceWorker(environment)` helper and a runtime guard that preserves browser PWA registration.

- [ ] **Step 1: Write failing tests for the registration policy**

  Add tests for `shouldRegisterServiceWorker({ hasServiceWorker, isDev, isNative })`:

  - native production with service-worker support returns `false`;
  - browser production with service-worker support returns `true`;
  - browser development returns `false`;
  - browser production without service-worker support returns `false`.

- [ ] **Step 2: Run the focused test and verify it fails**

  Run `pnpm test src/app/registerServiceWorker.test.ts`. Expected: FAIL because the helper does not yet exist.

- [ ] **Step 3: Implement the minimal policy**

  In `src/app/registerServiceWorker.ts`, import `Capacitor`, export the typed helper, and make `registerServiceWorker()` pass `('serviceWorker' in navigator)`, `import.meta.env.DEV`, and `Capacitor.isNativePlatform()` into it. Keep the existing `load` listener, registration URL `/sw.js`, and ignored registration failure behavior unchanged.

- [ ] **Step 4: Run the focused test and verify it passes**

  Run `pnpm test src/app/registerServiceWorker.test.ts`. Expected: PASS for all four policy cases.

- [ ] **Step 5: Verify the web path is still present**

  Run `pnpm build`; inspect `dist/sw.js`, `dist/manifest.webmanifest`, and `dist/index.html`. Expected: all three exist and the generated service worker still contains the existing navigation network-first and asset cache-first strategies.

### Task 3: Generate and configure the Android project

**Files:**
- Create: `android/` via `pnpm exec cap add android`
- Modify: generated Android application label, icon, and splash resource files under `android/app/src/main/`

**Interfaces:**
- Consumes: `capacitor.config.ts`, installed Capacitor packages, and a successful `dist` build.
- Produces: Android project with `applicationId com.kumchovy.arsen.codex`, label `Arsen Codex`, and visually distinct Codex resources.

- [ ] **Step 1: Add Android after a successful web build**

  Run `pnpm build`, then `pnpm exec cap add android`. Expected: `android/` is generated and the CLI reports the configured app ID/name.

- [ ] **Step 2: Inspect generated native resource paths**

  Read the generated `android/app/src/main/AndroidManifest.xml`, Gradle namespace/application ID files, `values/strings.xml`, and splash/theme resource files before changing them. Do not delete or recreate the generated project.

- [ ] **Step 3: Apply the Codex identity**

  Set the generated Android label to `Arsen Codex`, set launcher and round-launcher icons to a small Codex-specific vector/resource using the existing dark theme and a visible Codex accent, and set the starting splash background/mark to the same distinguishable identity. Keep resources local to `android/app/src/main/res/`; do not add a third-party asset pipeline.

- [ ] **Step 4: Verify native identifiers and resources**

  Search the generated project for `com.kumchovy.arsen.codex` and `Arsen Codex`, and confirm the launcher manifest references the Codex resources. Expected: no `com.kumchovy.arsen.opencode` or generic placeholder remains in this project.

### Task 4: Sync the web bundle and document the repeatable Android workflow

**Files:**
- Modify: `capacitor.config.ts` only if CLI validation found a supported pnpm setting missing
- Create: `CAPACITOR.md`
- Generated/modified by Capacitor: `android/`

**Interfaces:**
- Consumes: Android project from Task 3 and the package scripts from Task 1.
- Produces: Documented build/install workflow and a synchronized native web bundle.

- [ ] **Step 1: Sync after a production web build**

  Set the local SDK variables for this environment and run:

  ```powershell
  $env:ANDROID_SDK_ROOT = 'C:\Users\isaic\AppData\Local\Android\Sdk'
  $env:ANDROID_HOME = $env:ANDROID_SDK_ROOT
  pnpm build
  pnpm exec cap sync android
  ```

  Expected: Capacitor copies the current `dist` bundle into the Android assets and finishes without npm install or postinstall execution.

- [ ] **Step 2: Write `CAPACITOR.md`**

  Document prerequisites, the exact app ID/name, the SDK environment variables, `pnpm build`, `pnpm exec cap sync android`, `pnpm run cap:build`, Android Studio opening, debug APK path, `adb install -r`, `pnpm run cap:run`, and the fact that the OpenCode variant must use `com.kumchovy.arsen.opencode`.

- [ ] **Step 3: Document the service-worker and persistence policy**

  State that web production keeps the existing SW, Capacitor skips SW registration, and both runtimes use Dexie database `arsen`; include the manual persistence checklist from Task 5.

- [ ] **Step 4: Verify documentation commands are internally consistent**

  Run each local, non-GUI command listed in the document once where feasible. Expected: paths and script names match the files in the repository.

### Task 5: Compile, install, and validate the app end-to-end

**Files:**
- No planned source changes; modify only a file that fails a concrete verification with the smallest fix.

**Interfaces:**
- Consumes: web tests/build, service-worker guard, synchronized Android project, and documentation.
- Produces: Evidence for APK generation, installability, coexistence identity, web compilation, offline persistence, and Sinful Shell behavior.

- [ ] **Step 1: Run the complete web test suite**

  Run `pnpm test`. Expected: all existing tests and the new service-worker policy tests pass.

- [ ] **Step 2: Build and sync the production bundle**

  Run `pnpm build` followed by `pnpm exec cap sync android`. Expected: TypeScript, Vite, service-worker generation, and Capacitor copy all pass.

- [ ] **Step 3: Compile the debug APK with the installed SDK**

  Run `pnpm exec cap build android` or, if the CLI does not expose the required Android build option, run `android\gradlew.bat assembleDebug` from the repository root with `ANDROID_SDK_ROOT` and `ANDROID_HOME` set. Expected: `android/app/build/outputs/apk/debug/app-debug.apk` exists and the Gradle build exits successfully.

- [ ] **Step 4: Verify package identity in the APK/project**

  Use the generated manifest/project metadata and, if available, `aapt2 dump badging` from the installed Build Tools to verify package `com.kumchovy.arsen.codex` and label `Arsen Codex`. Confirm the APK does not claim the OpenCode package ID.

- [ ] **Step 5: Install on the available Android target**

  Run the absolute SDK `platform-tools\adb.exe` with `devices`, then `adb install -r android\app\build\outputs\apk\debug\app-debug.apk` when a device/emulator is listed. Expected: installation succeeds without uninstalling the other variant; record the package ID and target used.

- [ ] **Step 6: Execute the manual persistence flow**

  In the installed `Arsen Codex` app: create a routine, add the Sinful Shell exercise, register one series, fully close the app, reopen it, and verify the routine, exercise, and series remain. Also verify the Sinful Shell screen opens and works without network access. If no target is connected, report this exact limitation and do not claim the manual flow passed.

- [ ] **Step 7: Recheck the web PWA path**

  Run `pnpm build` and `pnpm preview`; verify the web bundle serves, `dist/sw.js` exists, and the browser path remains the only path that registers the service worker. Do not remove the SW based on native behavior.

- [ ] **Step 8: Final review without Git operations**

  Read all changed source/config/docs and verify only the approved Capacitor, Android, service-worker, resource, and documentation files changed. Do not commit, branch, or push.

