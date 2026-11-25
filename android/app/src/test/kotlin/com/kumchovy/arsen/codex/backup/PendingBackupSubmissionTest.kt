package com.kumchovy.arsen.codex.backup

import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import javax.crypto.KeyGenerator
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking

class PendingBackupSubmissionTest {
    @get:Rule val temp = TemporaryFolder()
    private fun store() = PendingSnapshotStore(temp.root, KeyGenerator.getInstance("AES").apply { init(256) }.generateKey(), 1024)

    @Test fun `requires the same signed in account before submitting`() = runBlocking {
        val store = store()
        store.write("user_abc", 1, byteArrayOf(1))
        val submission = PendingBackupSubmission(store)
        var calls = 0
        val send: suspend (PendingSnapshot) -> Boolean = { calls++; true }
        assertEquals(SubmissionResult.SIGN_IN_REQUIRED, submission.run(null, submitAndConfirm = send))
        assertEquals(SubmissionResult.OTHER_ACCOUNT, submission.run("user_other", submitAndConfirm = send))
        assertEquals(0, calls)
        assertNotNull(store.read())
    }

    @Test fun `retains the snapshot on failed unconfirmed and throwing uploads`() = runBlocking {
        val store = store()
        store.write("user_abc", 1, byteArrayOf(1))
        val submission = PendingBackupSubmission(store)
        assertEquals(SubmissionResult.RETRY, submission.run("user_abc") { false })
        assertThrows(IllegalStateException::class.java) { runBlocking { submission.run("user_abc") { error("network") } } }
        assertNotNull(store.read())
    }

    @Test fun `removes only the version confirmed by the server`() = runBlocking {
        val store = store()
        val submission = PendingBackupSubmission(store)
        assertEquals(SubmissionResult.NOTHING_PENDING, submission.run(null) { fail("unexpected upload"); true })
        store.write("user_abc", 1, byteArrayOf(1))
        assertEquals(SubmissionResult.NEWER_PENDING, submission.run("user_abc") { store.write("user_abc", 2, byteArrayOf(2)); true })
        assertEquals(2L, store.read()!!.revision)
        assertEquals(SubmissionResult.CONFIRMED, submission.run("user_abc") { true })
        assertNull(store.read())
    }

    @Test fun `supports asynchronous session and transport work`() = runBlocking {
        val store = store()
        store.write("user_abc", 1, byteArrayOf(1))
        val result = PendingBackupSubmission(store).run("user_abc") {
            delay(1)
            true
        }
        assertEquals(SubmissionResult.CONFIRMED, result)
        assertNull(store.read())
    }

    @Test fun `retries the original snapshot after a newer revision arrives and the response is lost`() = runBlocking {
        val key = KeyGenerator.getInstance("AES").apply { init(256) }.generateKey()
        val store = PendingSnapshotStore(temp.root, key, 1024)
        store.write("user_abc", 1, byteArrayOf(1))
        assertEquals(SubmissionResult.RETRY, PendingBackupSubmission(store).run("user_abc") {
            store.write("user_abc", 2, byteArrayOf(2)); false
        })
        val restarted = PendingSnapshotStore(temp.root, key, 1024)
        assertEquals(SubmissionResult.NEWER_PENDING, PendingBackupSubmission(restarted).run("user_abc") {
            assertEquals(1L, it.revision); true
        })
        assertEquals(2L, restarted.read()!!.revision)
        assertEquals(1L, restarted.readConfirmed()!!.revision)
    }

    @Test fun `retains an upload when its confirmation cannot be persisted`() = runBlocking {
        val store = store()
        store.write("user_abc", 1, byteArrayOf(1))
        temp.root.resolve("confirmed.snapshot").mkdir()
        assertThrows(Exception::class.java) { runBlocking { PendingBackupSubmission(store).run("user_abc") { true } } }
        assertEquals(1L, store.read()!!.revision)
    }

    @Test fun `does not let another account replace an upload in progress`() = runBlocking {
        val store = store()
        store.write("user_abc", 1, byteArrayOf(1))
        PendingBackupSubmission(store).run("user_abc") { false }
        assertThrows(IllegalStateException::class.java) { store.write("user_other", 2, byteArrayOf(2)) }
        assertEquals(SubmissionResult.OTHER_ACCOUNT, PendingBackupSubmission(store).run("user_other") { fail("unexpected upload"); true })
        assertEquals(1L, store.read()!!.revision)
    }
}
