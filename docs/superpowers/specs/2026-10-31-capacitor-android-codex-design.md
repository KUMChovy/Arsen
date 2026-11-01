# Arsen Codex: Android con Capacitor

## Intención

Convertir esta PWA Vite offline en una aplicación Android instalable con Capacitor, manteniendo intacta la variante web y permitiendo instalarla en el mismo teléfono que la variante OpenCode.

La identidad de esta variante será:

- `appId`: `com.kumchovy.arsen.codex`
- `appName`: `Arsen Codex`
- `webDir`: `dist`

## Objetivos

- Instalar `@capacitor/core`, `@capacitor/cli` y `@capacitor/android` usando pnpm y respetando `.npmrc` (`save-exact`, `ignore-scripts`).
- Crear `capacitor.config.ts`, generar el proyecto `android/` y sincronizarlo después de `pnpm build`.
- Producir y validar un APK debug con el Android SDK ya instalado en Windows.
- Mantener la convivencia con la variante OpenCode mediante el `appId` distinto.
- Conservar Dexie/IndexedDB como almacenamiento único de la aplicación, incluyendo el nombre de base `arsen` y el esquema vigente.
- Mantener la PWA web compilable y su offline web verificable.
- Hacer distinguible la aplicación Codex con icono y splash sencillos, sin diseñar una identidad visual final.
- Documentar instalación, build, sync, apertura en Android Studio y ubicación del APK.

## No objetivos

- Publicar en Google Play u otra tienda.
- Cambiar el modelo de datos de Dexie o migrar datos a un plugin nativo.
- Añadir plugins nativos que no sean necesarios para empaquetar esta PWA.
- Diseñar iconos o splash definitivos.
- Cambiar la variante OpenCode desde este repositorio.

## Criterios de fallo que evitaremos

- No usar un `appId` genérico o igual al de OpenCode.
- No ejecutar `npm install` ni ignorar la política `ignore-scripts`.
- No borrar ni recrear `android/` si ya existe una personalización sin inspeccionarla.
- No desactivar el service worker web para “hacer que Android funcione” sin comprobar antes la PWA.
- No usar una base IndexedDB distinta en Android, porque rompería la prueba de persistencia y la compatibilidad del flujo existente.
- No declarar el APK instalable si el build de Gradle o la inspección del artefacto falla.

## Estado actual observado

- El repositorio es Vite + React + TypeScript, con `pnpm@11.2.2`.
- `.npmrc` contiene `save-exact=true` e `ignore-scripts=true`.
- `pnpm build` hace typecheck, build de Vite y genera `dist/sw.js` con caché versionada.
- El service worker se registra solo en producción web desde `src/app/registerServiceWorker.ts`.
- Dexie usa la base `arsen`; el esquema actual es la versión 7.
- Sinful Shell ya está implementado como catálogo estático offline y sus servicios escriben copias en Dexie.
- Android SDK está instalado en `C:\Users\isaic\AppData\Local\Android\Sdk`, con `platform-tools`, Build Tools 36.x y plataforma Android 36.1. Las herramientas no están actualmente en `PATH`.

## Decisiones de implementación

### Dependencias y configuración

Se instalarán las versiones actuales compatibles de Capacitor con versiones exactas guardadas por pnpm:

- dependencia de producción: `@capacitor/core`;
- dependencias de desarrollo: `@capacitor/cli` y `@capacitor/android`.

La configuración será TypeScript y contendrá únicamente las opciones necesarias para esta primera integración:

```ts
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.kumchovy.arsen.codex',
  appName: 'Arsen Codex',
  webDir: 'dist',
}

export default config
```

Se agregará Android con la CLI y se ejecutará `pnpm build` antes de cada `pnpm exec cap sync android`. Los scripts de pnpm serán pequeños y explícitos; no se añadirá un hook postinstall porque el repositorio prohíbe depender de scripts de instalación.

### Service worker

La PWA web conservará su registro y su estrategia actual: network-first para navegaciones y cache-first para otros GET. Se verificará con build/preview que la variante web sigue generando y sirviendo `dist/sw.js`.

En la aplicación nativa se evitará registrar el service worker porque Capacitor carga el bundle localmente y la propia documentación advierte que service workers pueden interferir con la inyección de plugins en el WebView. El guard se basará en `Capacitor.isNativePlatform()`, de modo que el navegador web mantenga el comportamiento actual. Esta decisión se validará en ambos lados: la PWA web debe seguir registrando/funcionando offline y Android debe arrancar sin registro de SW ni errores de runtime.

### Identidad visual mínima

Se mantendrá el `public/icon.svg` como fuente de la identidad web, pero se añadirá una variante visual claramente rotulada para Codex en el proyecto Android mediante los recursos generados por Capacitor. El splash será una composición simple con fondo oscuro y marca “CODEX”, suficiente para distinguir instalaciones durante la comparación. No se crearán recursos de diseño final ni se modificará la identidad de OpenCode.

### Persistencia y prueba funcional

No se cambiarán `src/db/schema.ts`, el nombre `arsen`, los servicios de rutina/workout ni la lógica de Sinful Shell salvo que la prueba revele una regresión real.

La verificación tendrá dos partes:

1. Tests existentes y, si hace falta, un test de integración que compruebe que crear rutina, copiar Sinful Shell y registrar una serie escriben en Dexie.
2. Prueba manual en el APK: crear rutina, agregar el ejercicio Sinful Shell, registrar una serie, cerrar completamente la app, abrirla de nuevo y comprobar la rutina, el ejercicio y la serie.

## Flujo de validación

1. Instalar dependencias con pnpm respetando `ignore-scripts`.
2. Generar `capacitor.config.ts` y el proyecto Android.
3. Ejecutar `pnpm test` y `pnpm build`.
4. Sincronizar con `pnpm exec cap sync android` después del build.
5. Verificar `applicationId`, label y recursos nativos del proyecto Android.
6. Compilar el APK debug con el SDK instalado, usando `android/gradlew.bat` o `pnpm exec cap build android` según la versión generada.
7. Instalar el APK con `adb install -r` en un dispositivo/emulador disponible y ejecutar la prueba de persistencia.
8. Repetir la verificación web con `pnpm build` y `pnpm preview`, inspeccionando que el service worker generado y el manifest siguen presentes.

Si el SDK no tiene un dispositivo conectado, se podrá validar el artefacto APK y dejar documentado el comando exacto para la instalación; no se presentará una prueba manual de cierre/reapertura como realizada hasta ejecutarla en un dispositivo o emulador.

## Entregables

- `capacitor.config.ts`.
- `android/` generado y sincronizado.
- Dependencias y lockfile actualizados por pnpm.
- Scripts de pnpm para build/sync/open/build Android, sin hooks que violen `ignore-scripts`.
- Recursos mínimos de icono/splash de Codex.
- Documentación de comandos y prerrequisitos Android.
- Evidencia de tests, build web, sync, APK y prueba de persistencia según lo que el entorno permita.

## Llamadas del builder

- Se usará la versión actual compatible de Capacitor al momento de instalar; no se fijará manualmente una versión antigua.
- Se conservará el proyecto Android generado por Capacitor en el repositorio porque es necesario para que la app sea instalable y para validar el `applicationId`.
- La ruta del SDK se documentará como variable/configuración local, no como una ruta codificada dentro de la aplicación.
- El icono/splash mínimo se mantendrá deliberadamente simple y distinguible; el diseño final queda fuera de alcance.
