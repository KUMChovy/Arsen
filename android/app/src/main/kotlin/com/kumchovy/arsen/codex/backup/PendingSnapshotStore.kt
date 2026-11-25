package com.kumchovy.arsen.codex.backup

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.File
import java.io.FileOutputStream
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.MessageDigest
import kotlinx.serialization.json.*
import javax.crypto.Cipher
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

data class PendingSnapshot(val owner: String, val revision: Long, val payload: ByteArray, val sha256: String)

class PendingSnapshotStore(private val directory: File, private val key: SecretKey, private val maxBytes: Int, private val fileName: String = "pending.snapshot") {
    companion object {
        private val lock = Any()
        private val magic = "ARSN2N01".toByteArray(Charsets.US_ASCII)
        private const val MAX_REVISION = 9007199254740991L
        private val ownerPattern = Regex("^user_[A-Za-z0-9]{1,123}$")
    }

    init { require(maxBytes in 1..(Int.MAX_VALUE - 2048)) }
    private val target get() = File(directory, fileName)
    private fun inFlight() = PendingSnapshotStore(directory, key, maxBytes, "inflight.snapshot")
    private fun eligible() = PendingSnapshotStore(directory, key, maxBytes, "eligible.snapshot")

    private fun previousLocalDay(file: File): Boolean = file.isFile && file.lastModified() > 0 &&
        backupEligibleOnLocalDay(java.time.Instant.ofEpochMilli(file.lastModified()), java.time.Instant.now(), java.time.ZoneId.systemDefault())

    fun beginSubmission(): PendingSnapshot? = synchronized(lock) {
        val active = inFlight()
        active.readLocked()?.let { return@synchronized it }
        val source = if (eligible().target.exists()) eligible() else this
        val pending = source.readLocked() ?: return@synchronized null
        Files.move(source.target.toPath(), active.target.toPath(), StandardCopyOption.ATOMIC_MOVE)
        pending
    }

    fun beginAutomaticSubmission(): PendingSnapshot? = synchronized(lock) {
        val active = inFlight()
        active.readLocked()?.let { return@synchronized it }
        val candidate = if (eligible().target.exists()) eligible() else this
        if (!previousLocalDay(candidate.target)) return@synchronized null
        val pending = candidate.readLocked() ?: return@synchronized null
        Files.move(candidate.target.toPath(), active.target.toPath(), StandardCopyOption.ATOMIC_MOVE)
        pending
    }

    fun confirmSubmission(snapshot: PendingSnapshot): Boolean = synchronized(lock) {
        val active = inFlight()
        val current = active.readLocked() ?: return@synchronized false
        if (current.owner != snapshot.owner || current.revision != snapshot.revision || current.sha256 != snapshot.sha256) return@synchronized false
        val equivalent = readEquivalent()
        if (equivalent != null && equivalent.owner == current.owner && equivalent.revision == current.revision) {
            val activeEnvelope = decodePendingEnvelope(current, maxBytes)
            val equivalentEnvelope = decodePendingEnvelope(equivalent, maxBytes)
            if (activeEnvelope.deviceId == equivalentEnvelope.deviceId && activeEnvelope.manifestSha256 == equivalentEnvelope.manifestSha256) {
                Files.delete(active.target.toPath())
                return@synchronized true
            }
        }
        val temp = File.createTempFile("confirmed-", ".tmp", directory)
        try {
            active.target.inputStream().use { input -> FileOutputStream(temp).use { output -> input.copyTo(output); output.fd.sync() } }
            Files.move(temp.toPath(), File(directory, "confirmed.snapshot").toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
            Files.delete(active.target.toPath())
        } finally { if (temp.exists()) temp.delete() }
        true
    }

    fun write(owner: String, revision: Long, payload: ByteArray): PendingSnapshot = synchronized(lock) {
        require(ownerPattern.matches(owner) && revision in 0..MAX_REVISION && payload.isNotEmpty() && payload.size <= maxBytes)
        val safePayload = payload.copyOf()
        val fingerprint = hash(safePayload)
        val saved = eligible().readLocked()
        if (saved != null) {
            check(saved.owner == owner && revision >= saved.revision) { "Hay una instantánea elegible de otra cuenta o más reciente" }
            if (revision == saved.revision) {
                check(saved.sha256 == fingerprint) { "La revisión elegible contiene datos diferentes" }
                return@synchronized saved
            }
        }
        val active = inFlight().readLocked()
        if (active != null) {
            check(active.owner == owner && revision >= active.revision) { "Hay una instantánea en curso de otra cuenta o más reciente" }
            if (revision == active.revision) {
                check(active.sha256 == fingerprint) { "La revisión en curso contiene datos diferentes" }
                return@synchronized active
            }
        }
        val previous = readLocked()
        if (previous != null) {
            check(previous.owner == owner && revision >= previous.revision) { "Hay una instantánea pendiente de otra cuenta o más reciente" }
            if (revision == previous.revision) {
                check(previous.sha256 == fingerprint) { "La revisión pendiente contiene datos diferentes" }
                return@synchronized previous
            }
            if (saved == null && previousLocalDay(target)) Files.move(target.toPath(), eligible().target.toPath(), StandardCopyOption.ATOMIC_MOVE)
        }
        persistLocked(owner, revision, safePayload)
    }

    private fun persistLocked(owner: String, revision: Long, safePayload: ByteArray): PendingSnapshot {
        val fingerprint = hash(safePayload)
        val plaintext = ByteArrayOutputStream().use { buffer ->
            DataOutputStream(buffer).use { output -> output.writeUTF(owner); output.writeLong(revision); output.writeInt(safePayload.size); output.write(safePayload) }
            buffer.toByteArray()
        }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key)
        cipher.updateAAD(magic)
        check(cipher.iv.size == 12) { "El cifrado no proporcionó un nonce válido" }
        val encrypted = cipher.doFinal(plaintext)
        check(directory.isDirectory || directory.mkdirs()) { "No se pudo crear el directorio de respaldo" }
        val temp = File.createTempFile("pending-", ".tmp", directory)
        try {
            FileOutputStream(temp).use { output -> output.write(magic); output.write(cipher.iv); output.write(encrypted); output.fd.sync() }
            Files.move(temp.toPath(), target.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
        } finally { if (temp.exists()) temp.delete() }
        return PendingSnapshot(owner, revision, safePayload, fingerprint)
    }

    fun read(): PendingSnapshot? = synchronized(lock) { inFlight().readLocked() ?: eligible().readLocked() ?: readLocked() }

    fun readPrepared(): PendingSnapshot? = synchronized(lock) { readLocked() }

    fun readAllPending(): List<PendingSnapshot> = synchronized(lock) {
        listOfNotNull(inFlight().readLocked(), eligible().readLocked(), readLocked())
    }

    fun readConfirmed(): PendingSnapshot? = synchronized(lock) {
        PendingSnapshotStore(directory, key, maxBytes, "confirmed.snapshot").readLocked()
    }

    fun readEquivalent(): PendingSnapshot? = synchronized(lock) {
        PendingSnapshotStore(directory, key, maxBytes, "equivalent.snapshot").readLocked()
    }

    fun recordEquivalent(snapshot: PendingSnapshot, confirmedBackupId: String, reconfirmedFrom: String): Boolean = synchronized(lock) {
        val current = inFlight().readLocked() ?: return@synchronized false
        if (current.owner != snapshot.owner || current.revision != snapshot.revision || current.sha256 != snapshot.sha256) return@synchronized false
        decodePendingEnvelope(current, maxBytes)
        val root = Json.parseToJsonElement(current.payload.toString(Charsets.UTF_8)).jsonObject
        val payload = JsonObject(root + mapOf("backupId" to JsonPrimitive(confirmedBackupId), "baseBackupId" to JsonPrimitive(reconfirmedFrom))).toString().toByteArray(Charsets.UTF_8)
        val equivalent = PendingSnapshot(current.owner, current.revision, payload, hash(payload))
        decodePendingEnvelope(equivalent, maxBytes)
        PendingSnapshotStore(directory, key, maxBytes, "equivalent.snapshot").persistLocked(current.owner, current.revision, payload)
        true
    }

    fun acknowledge(owner: String, revision: Long, sha256: String): Boolean = synchronized(lock) {
        val current = readLocked() ?: return@synchronized false
        if (current.owner != owner || current.revision != revision || current.sha256 != sha256) return@synchronized false
        Files.delete(target.toPath())
        true
    }

    private fun readLocked(): PendingSnapshot? {
        if (!target.exists()) return null
        val maxFileBytes = maxBytes + 2048
        val buffer = ByteArrayOutputStream()
        target.inputStream().buffered().use { input ->
            val chunk = ByteArray(8192)
            while (true) {
                val count = input.read(chunk)
                if (count < 0) break
                check(buffer.size() <= maxFileBytes - count) { "La instantánea excede el límite" }
                buffer.write(chunk, 0, count)
            }
        }
        val bytes = buffer.toByteArray()
        check(bytes.size >= magic.size + 12 + 16 && bytes.copyOfRange(0, magic.size).contentEquals(magic)) { "Formato de instantánea inválido" }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, bytes.copyOfRange(magic.size, magic.size + 12)))
        cipher.updateAAD(magic)
        val plaintext = cipher.doFinal(bytes, magic.size + 12, bytes.size - magic.size - 12)
        return DataInputStream(ByteArrayInputStream(plaintext)).use { input ->
            val owner = input.readUTF()
            val revision = input.readLong()
            val length = input.readInt()
            check(ownerPattern.matches(owner) && revision in 0..MAX_REVISION && length in 1..maxBytes && input.available() == length) { "Datos de instantánea inválidos" }
            val payload = ByteArray(length)
            input.readFully(payload)
            PendingSnapshot(owner, revision, payload, hash(payload))
        }
    }

    private fun hash(payload: ByteArray): String = MessageDigest.getInstance("SHA-256").digest(payload).joinToString("") { "%02x".format(it.toInt() and 0xff) }
}
