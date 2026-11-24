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
        assertEquals(SubmissionResult.SIGN_IN_REQUIRED, submission.run(null, send))
        assertEquals(SubmissionResult.OTHER_ACCOUNT, submission.run("user_other", send))
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
}
