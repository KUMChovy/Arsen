# Arsen Codex en Android

Esta variante se instala como una aplicación distinta de OpenCode:

- Nombre: `Arsen Codex`
- Application ID: `com.kumchovy.arsen.codex`
- Web assets: `dist`
- APK debug: `android/app/build/outputs/apk/debug/app-debug.apk`

La otra variante debe usar `com.kumchovy.arsen.opencode` para que ambas puedan convivir en el mismo teléfono.

## Requisitos

- Node.js compatible con la versión de Capacitor instalada.
- pnpm 11.2.2.
- Android Studio con Android SDK, Build Tools y un dispositivo físico o emulador.
- En esta máquina el SDK está en `C:\Users\isaic\AppData\Local\Android\Sdk`.

Si Android SDK no está en `PATH`, configurar la sesión de PowerShell:

```powershell
$env:ANDROID_SDK_ROOT = 'C:\Users\isaic\AppData\Local\Android\Sdk'
$env:ANDROID_HOME = $env:ANDROID_SDK_ROOT
```

## Desarrollo y build

La primera instalación de Capacitor se hace con pnpm y mantiene la política del repositorio:

```powershell
pnpm add @capacitor/core @capacitor/android --ignore-scripts
pnpm add -D @capacitor/cli --ignore-scripts
```

Flujo normal después de cambiar la PWA:

```powershell
pnpm build
pnpm exec cap sync android
```

Los scripts equivalentes son:

```powershell
pnpm run cap:sync
pnpm run cap:build
pnpm run cap:open
pnpm run cap:run
```

`cap:build` hace el build web, sincroniza `dist` y ejecuta `assembleDebug` dentro de `android/`, por lo que produce un APK debug sin pedir un keystore de release. También puede abrirse `android/` desde Android Studio y usar el botón **Run**.

Para compilar directamente el APK debug:

```powershell
$env:ANDROID_SDK_ROOT = 'C:\Users\isaic\AppData\Local\Android\Sdk'
$env:ANDROID_HOME = $env:ANDROID_SDK_ROOT
pnpm build
pnpm exec cap sync android
Push-Location android
.\gradlew.bat assembleDebug
Pop-Location
```

Para instalarlo en un dispositivo o emulador conectado:

```powershell
& "$env:ANDROID_SDK_ROOT\platform-tools\adb.exe" devices
& "$env:ANDROID_SDK_ROOT\platform-tools\adb.exe" install -r android\app\build\outputs\apk\debug\app-debug.apk
```

## Service worker y offline

- En navegador web de producción se conserva `dist/sw.js`: las navegaciones usan network-first con fallback a `/index.html` y el resto de GET usa cache-first.
- Dentro del WebView nativo de Capacitor no se registra el service worker. El bundle se carga desde los assets locales de Android y evitar ese registro reduce el riesgo de interferir con la inyección de plugins.
- Esta decisión no cambia la PWA web: `pnpm build` debe seguir generando `dist/sw.js` y `dist/manifest.webmanifest`.

La app nativa y la web usan la misma base Dexie `arsen` e IndexedDB; no se utiliza una base nativa paralela.

## Prueba funcional de persistencia

En `Arsen Codex`, con la red desactivada:

1. Crear una rutina.
2. Agregar un ejercicio desde Sinful Shell.
3. Abrir el entrenamiento y registrar una serie.
4. Cerrar completamente la aplicación.
5. Reabrirla y comprobar que siguen la rutina, el ejercicio y la serie.

No considerar la prueba manual aprobada si no se ejecutó en un dispositivo o emulador real. Las pruebas automatizadas Dexie se ejecutan con:

```powershell
pnpm test
```

En Node 22+ con jsdom, si `window.localStorage` aparece indefinido, habilitar el almacenamiento temporal de Node para esa sesión y repetir:

```powershell
New-Item -ItemType Directory -Force .run | Out-Null
$env:NODE_OPTIONS = '--localstorage-file=.run/vitest-localstorage.json'
pnpm test
```

Si el wrapper de pnpm necesita descargar la versión fijada o el entorno impide usar scripts, la política del repositorio sigue siendo `ignore-scripts=true`; no ejecutar `pnpm approve-builds` para habilitar postinstall.
