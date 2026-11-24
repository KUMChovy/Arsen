package com.kumchovy.arsen.codex.backup

import java.security.MessageDigest
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test

class BackupLiveDownloadTest {
    @Test fun verifiesRealPrivateDownloadWithoutLoggingItsContents() = runBlocking {
        val url = System.getenv("ARSEN_PROBE_SIGNED_URL")
        val origin = System.getenv("ARSEN_PRIVATE_BLOB_ORIGIN")
        val path = System.getenv("ARSEN_PROBE_OBJECT_PATH")
        val expected = System.getenv("ARSEN_PROBE_SHA256")
        val size = System.getenv("ARSEN_PROBE_SIZE")?.toIntOrNull()
        assumeTrue(url != null && origin != null && path != null && expected != null && size != null)
        assertTrue(validBackupDownloadUrl(url!!, path!!, origin!!))
        val bytes = BackupHttpClient("https://api.example.test", origin).download(url, size!!)
        val hash = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it.toInt() and 255) }
        assertEquals(size.toLong(), bytes.size.toLong())
        assertEquals(expected, hash)
    }
}
