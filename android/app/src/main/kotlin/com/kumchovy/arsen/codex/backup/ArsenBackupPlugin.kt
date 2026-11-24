package com.kumchovy.arsen.codex.backup

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.kumchovy.arsen.codex.BuildConfig
import com.kumchovy.arsen.codex.account.ClerkSessionSource
import com.kumchovy.arsen.codex.account.NativeSessionProvider
import com.kumchovy.arsen.codex.account.SessionResult
import java.io.File
import java.security.MessageDigest
import java.util.UUID
import java.util.Base64
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@CapacitorPlugin(name = "ArsenBackup")
class ArsenBackupPlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    @PluginMethod fun prepareContext(call: PluginCall) {
        if (BuildConfig.ARSEN_BACKUP_API_ORIGIN.isEmpty()) { call.reject("Respaldo no configurado"); return }
        scope.launch {
            try {
                val result = withContext(Dispatchers.IO) {
                    val sessions = NativeSessionProvider(ClerkSessionSource())
                    val session = sessions.get()
                    if (session.result != SessionResult.READY || session.owner == null) return@withContext BackupContextResult(BackupContextStatus.SIGN_IN_REQUIRED)
                    val key = MessageDigest.getInstance("SHA-256").digest(session.owner.toByteArray()).joinToString("") { "%02x".format(it.toInt() and 255) }
                    val preferences = context.getSharedPreferences("arsen-backup-devices", android.content.Context.MODE_PRIVATE)
                    val id = synchronized(ArsenBackupPlugin::class.java) {
                        preferences.getString(key, null) ?: UUID.randomUUID().toString().also { check(preferences.edit().putString(key, it).commit()) }
                    }
                    val prepared = BackupContext(sessions, BackupHttpClient(BuildConfig.ARSEN_BACKUP_API_ORIGIN)).prepare(id)
                    if (prepared.status == BackupContextStatus.READY && prepared.owner != session.owner) BackupContextResult(BackupContextStatus.ACCOUNT_CHANGED) else prepared
                }
                val response = JSObject().put("status", result.status.name)
                if (result.owner != null) response.put("owner", result.owner)
                if (result.deviceId != null) response.put("deviceId", result.deviceId)
                response.put("baseBackupId", result.baseBackupId ?: org.json.JSONObject.NULL)
                result.summary?.let { summary -> response.put("summary", JSObject().put("id", summary.id).put("deviceId", summary.deviceId).put("localRevision", summary.localRevision).put("contractVersion", summary.contractVersion).put("sizeBytes", summary.sizeBytes).put("includesHealth", summary.includesHealth).put("confirmedAt", summary.confirmedAt)) }
                call.resolve(response)
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (_: Exception) { call.reject("No se pudo consultar el respaldo") }
        }
    }

    @PluginMethod fun stage(call: PluginCall) {
        val payload = call.getString("payload")
        val revision = backupBridgeRevision(call.data.opt("revision"))
        val expectedOwner = call.getString("owner")
        val periodic = call.getBoolean("periodic", false) == true
        if (payload == null || revision == null || expectedOwner.isNullOrEmpty() || payload.length > MAX_PENDING_BACKUP_BYTES || BuildConfig.ARSEN_BACKUP_API_ORIGIN.isEmpty()) {
            call.reject("No se puede preparar el respaldo")
            return
        }
        scope.launch {
            try {
                val result = withContext(Dispatchers.IO) {
                    val store = PendingSnapshotStore(File(context.noBackupFilesDir, "arsen-backup"), AndroidBackupKey.getOrCreate(), MAX_PENDING_BACKUP_BYTES)
                    PendingBackupStager(store, NativeSessionProvider(ClerkSessionSource()), MAX_PENDING_BACKUP_BYTES).stage(revision, payload.toByteArray(Charsets.UTF_8), expectedOwner)
                }
                if (result == BackupStageResult.STORED) {
                    BackupScheduler.enqueue(context)
                    if (periodic) BackupScheduler.schedulePeriodic(context)
                }
                call.resolve(JSObject().put("status", result.name))
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (_: Exception) { call.reject("No se pudo preparar el respaldo") }
        }
    }

    @PluginMethod fun download(call: PluginCall) {
        val backupId = call.getString("backupId")
        val expectedOwner = call.getString("owner")
        if (backupId.isNullOrEmpty() || expectedOwner.isNullOrEmpty() || BuildConfig.ARSEN_BACKUP_API_ORIGIN.isEmpty()) { call.reject("Respaldo no disponible"); return }
        scope.launch {
            try {
                val result = withContext(Dispatchers.IO) {
                    val sessions = NativeSessionProvider(ClerkSessionSource())
                    val archive = BackupRestoreTransport(BackupHttpClient(BuildConfig.ARSEN_BACKUP_API_ORIGIN, BuildConfig.ARSEN_PRIVATE_BLOB_ORIGIN), MAX_PENDING_BACKUP_BYTES, BuildConfig.ARSEN_PRIVATE_BLOB_ORIGIN).download(expectedOwner, backupId) {
                        val session = sessions.get()
                        check(session.result == SessionResult.READY && session.owner == expectedOwner && session.token != null)
                        session.token
                    }
                    val session = sessions.get()
                    check(session.result == SessionResult.READY && session.owner == expectedOwner)
                    archive
                }
                val binaries = com.getcapacitor.JSArray()
                result.binaries.forEach { binaries.put(JSObject().put("id", it.id).put("base64", Base64.getEncoder().encodeToString(it.bytes))) }
                call.resolve(JSObject().put("manifest", result.manifest.toString(Charsets.UTF_8)).put("manifestSha256", result.manifestSha256).put("binaries", binaries))
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (_: Exception) { call.reject("No se pudo verificar el respaldo") }
        }
    }

    @PluginMethod fun getPending(call: PluginCall) {
        scope.launch {
            try {
                val exists = withContext(Dispatchers.IO) {
                    val store = PendingSnapshotStore(File(context.noBackupFilesDir, "arsen-backup"), AndroidBackupKey.getOrCreate(), MAX_PENDING_BACKUP_BYTES)
                    store.read() != null
                }
                call.resolve(JSObject().put("pending", exists))
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (_: Exception) { call.reject("No se pudo comprobar el respaldo pendiente") }
        }
    }

    @PluginMethod fun retryPending(call: PluginCall) {
        val owner = call.getString("owner")
        if (owner.isNullOrEmpty() || BuildConfig.ARSEN_BACKUP_API_ORIGIN.isEmpty()) { call.reject("Respaldo no disponible"); return }
        scope.launch {
            try {
                val result = withContext(Dispatchers.IO) {
                    val store = PendingSnapshotStore(File(context.noBackupFilesDir, "arsen-backup"), AndroidBackupKey.getOrCreate(), MAX_PENDING_BACKUP_BYTES)
                    PendingBackupRetry(store, NativeSessionProvider(ClerkSessionSource())) { BackupScheduler.enqueue(context) }.run(owner)
                }
                call.resolve(JSObject().put("status", result.name))
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (_: Exception) { call.reject("No se pudo reintentar el respaldo") }
        }
    }

    override fun handleOnDestroy() { scope.cancel(); super.handleOnDestroy() }
}
