package com.kumchovy.arsen.codex.backup

import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.security.MessageDigest
import java.util.Base64
import kotlinx.serialization.json.*

class EnvelopeBinary(val id: String, val bytes: ByteArray)
class PendingEnvelope(
    val backupId: String, val deviceId: String, val baseBackupId: String?, val revision: Long,
    val manifest: String, val manifestSha256: String, val includesHealth: Boolean,
    val healthConsent: Boolean, val sizeBytes: Long, val binaries: List<EnvelopeBinary>,
)

private val uuidPattern = Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")
private val shaPattern = Regex("^[0-9a-f]{64}$")
private const val MAX_SAFE_NUMBER = 9007199254740991L
private fun digest(bytes: ByteArray) = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it.toInt() and 255) }
private fun JsonObject.text(key: String): String = (this[key] as? JsonPrimitive)?.takeIf { it.isString }?.content ?: error("Campo de respaldo inválido")
private fun JsonObject.number(key: String): Long {
    val value = this[key] as? JsonPrimitive ?: error("Campo de respaldo inválido")
    check(!value.isString && value.content.matches(Regex("^(0|[1-9][0-9]*)$"))) { "Número de respaldo inválido" }
    return value.longOrNull?.takeIf { it in 0..MAX_SAFE_NUMBER } ?: error("Número de respaldo inválido")
}
private fun JsonObject.flag(key: String): Boolean {
    val value = this[key] as? JsonPrimitive ?: error("Campo de respaldo inválido")
    check(!value.isString) { "Campo de respaldo inválido" }
    return value.booleanOrNull ?: error("Campo de respaldo inválido")
}
private fun JsonObject.only(keys: Set<String>) { check(this.keys == keys) { "Formato de respaldo inválido" } }

fun decodePendingEnvelope(snapshot: PendingSnapshot, maxBytes: Int): PendingEnvelope {
    require(maxBytes in 1..(Int.MAX_VALUE - 2048))
    check(snapshot.payload.isNotEmpty() && snapshot.payload.size <= maxBytes && shaPattern.matches(snapshot.sha256) && digest(snapshot.payload) == snapshot.sha256) { "Instantánea inválida" }
    val decoder = Charsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT)
    val root = Json.parseToJsonElement(decoder.decode(ByteBuffer.wrap(snapshot.payload)).toString()) as? JsonObject ?: error("Sobre inválido")
    root.only(setOf("version", "backupId", "deviceId", "baseBackupId", "revision", "manifest", "manifestSha256", "includesHealth", "healthConsent", "sizeBytes", "binaries"))
    check(root.number("version") == 1L) { "Versión de sobre no compatible" }
    val backupId = root.text("backupId"); val deviceId = root.text("deviceId")
    val baseBackupId = if (root["baseBackupId"] == JsonNull) null else root.text("baseBackupId")
    check(uuidPattern.matches(backupId) && uuidPattern.matches(deviceId) && (baseBackupId == null || uuidPattern.matches(baseBackupId))) { "Identificador inválido" }
    val revision = root.number("revision")
    check(revision == snapshot.revision) { "Revisión incompatible" }
    val manifest = root.text("manifest"); val manifestBytes = manifest.toByteArray(Charsets.UTF_8)
    val manifestSha256 = root.text("manifestSha256")
    check(manifestBytes.isNotEmpty() && manifestBytes.size <= minOf(maxBytes, 4 * 1024 * 1024) && shaPattern.matches(manifestSha256) && digest(manifestBytes) == manifestSha256) { "Manifiesto inválido" }
    val manifestObject = Json.parseToJsonElement(manifest) as? JsonObject ?: error("Manifiesto inválido")
    manifestObject.only(setOf("version", "tables", "assets", "health"))
    check(manifestObject.number("version") == 1L) { "Versión de contrato incompatible" }
    val health = manifestObject["health"] as? JsonArray ?: error("Salud inválida")
    val includesHealth = root.flag("includesHealth"); val healthConsent = root.flag("healthConsent")
    check(includesHealth == health.isNotEmpty() && (!includesHealth || healthConsent)) { "Consentimiento incompatible" }
    val tables = manifestObject["tables"] as? JsonObject ?: error("Tablas inválidas")
    val settings = tables["settings"] as? JsonArray ?: error("Configuración inválida")
    val deviceSettings = settings.singleOrNull() as? JsonObject ?: error("Configuración inválida")
    check(deviceSettings["storagePersisted"] == JsonNull && listOf("lastContractBackupSha256", "notificationPermission", "healthIntegrationEnabled", "healthIntegrationFirstConnectedAt", "lastDeloadNotificationDate").none(deviceSettings::containsKey)) { "Configuración de dispositivo no permitida" }
    val sessions = tables["workoutSessions"] as? JsonArray ?: error("Sesiones inválidas")
    check(sessions.all { it is JsonObject && !it.containsKey("health") && !it.containsKey("healthHistory") }) { "Salud fuera del formato permitido" }
    val assets = manifestObject["assets"] as? JsonArray ?: error("Componentes inválidos")
    check(assets.size <= 5000) { "Demasiados componentes" }
    val hashes = mutableMapOf<String, String>()
    for (entry in assets) {
        val asset = entry as? JsonObject ?: error("Componente inválido")
        asset.only(setOf("id", "sha256"))
        val id = asset.text("id"); val hash = asset.text("sha256")
        check(id.isNotEmpty() && id.length <= 256 && shaPattern.matches(hash) && hashes.put(id, hash) == null) { "Componente inválido" }
    }
    val binaryRows = root["binaries"] as? JsonArray ?: error("Componentes inválidos")
    check(binaryRows.size == hashes.size) { "Componentes incompletos" }
    var total = manifestBytes.size.toLong()
    val binaries = binaryRows.map { entry ->
        val binary = entry as? JsonObject ?: error("Componente inválido")
        binary.only(setOf("id", "base64"))
        val id = binary.text("id"); val encoded = binary.text("base64")
        val expected = hashes.remove(id) ?: error("Componente duplicado o desconocido")
        val bytes = Base64.getDecoder().decode(encoded)
        total += bytes.size
        check(bytes.isNotEmpty() && total <= maxBytes && Base64.getEncoder().encodeToString(bytes) == encoded && digest(bytes) == expected) { "Componente inválido" }
        EnvelopeBinary(id, bytes)
    }
    val sizeBytes = root.number("sizeBytes")
    check(hashes.isEmpty() && total == sizeBytes) { "Tamaño de respaldo incompatible" }
    return PendingEnvelope(backupId, deviceId, baseBackupId, revision, manifest, manifestSha256, includesHealth, healthConsent, sizeBytes, binaries)
}
