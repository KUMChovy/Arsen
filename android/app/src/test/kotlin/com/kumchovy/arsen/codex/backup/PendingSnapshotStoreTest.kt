package com.kumchovy.arsen.codex.backup

import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import javax.crypto.KeyGenerator

class PendingSnapshotStoreTest {
    @get:Rule val temp = TemporaryFolder()
    private fun key() = KeyGenerator.getInstance("AES").apply { init(256) }.generateKey()

    @Test fun `encrypts and restores a snapshot without placing plaintext on disk`() {
        val secret = key()
        val store = PendingSnapshotStore(temp.root, secret, 1024)
        val data = "datos privados de entrenamiento".toByteArray()
        val written = store.write("user_abc", 8, data)
        val raw = temp.root.resolve("pending.snapshot").readBytes().toString(Charsets.ISO_8859_1)
        assertFalse(raw.contains("datos privados"))
        val read = PendingSnapshotStore(temp.root, secret, 1024).read()!!
        assertEquals("user_abc", read.owner)
        assertEquals(8L, read.revision)
        assertArrayEquals(data, read.payload)
        assertEquals(written.sha256, read.sha256)
    }

    @Test fun `does not discard a newer snapshot when the old upload finishes`() {
        val secret = key()
        val first = PendingSnapshotStore(temp.root, secret, 1024)
        val worker = PendingSnapshotStore(temp.root, secret, 1024)
        val old = first.write("user_abc", 8, "old".toByteArray())
        first.write("user_abc", 9, "new".toByteArray())
        assertFalse(worker.acknowledge(old.owner, old.revision, old.sha256))
        assertEquals(9L, worker.read()!!.revision)
        val current = worker.read()!!
        assertTrue(worker.acknowledge(current.owner, current.revision, current.sha256))
        assertNull(first.read())
    }

    @Test fun `rejects changed owner payload and corrupt ciphertext without deleting it`() {
        val store = PendingSnapshotStore(temp.root, key(), 1024)
        val current = store.write("user_abc", 8, "data".toByteArray())
        assertFalse(store.acknowledge("user_other", current.revision, current.sha256))
        assertFalse(store.acknowledge(current.owner, current.revision, "0".repeat(64)))
        val file = temp.root.resolve("pending.snapshot")
        val bytes = file.readBytes()
        bytes[bytes.lastIndex] = (bytes.last().toInt() xor 1).toByte()
        file.writeBytes(bytes)
        assertThrows(Exception::class.java) { store.read() }
        assertTrue(file.exists())
    }

    @Test fun `rejects invalid identity revision and oversized data`() {
        val store = PendingSnapshotStore(temp.root, key(), 4)
        assertThrows(IllegalArgumentException::class.java) { store.write("", 0, byteArrayOf(1)) }
        assertThrows(IllegalArgumentException::class.java) { store.write("user_abc", -1, byteArrayOf(1)) }
        assertThrows(IllegalArgumentException::class.java) { store.write("user_abc", 0, ByteArray(5)) }
        assertNull(store.read())
    }

    @Test fun `does not replace another account or a newer local snapshot`() {
        val store = PendingSnapshotStore(temp.root, key(), 1024)
        val original = store.write("user_abc", 8, "first".toByteArray())
        assertThrows(IllegalStateException::class.java) { store.write("user_other", 9, "other".toByteArray()) }
        assertThrows(IllegalStateException::class.java) { store.write("user_abc", 7, "older".toByteArray()) }
        assertThrows(IllegalStateException::class.java) { store.write("user_abc", 8, "different".toByteArray()) }
        assertEquals(original.sha256, store.read()!!.sha256)
    }
}
