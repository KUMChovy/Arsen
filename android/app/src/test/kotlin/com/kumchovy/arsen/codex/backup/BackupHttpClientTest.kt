package com.kumchovy.arsen.codex.backup

import org.junit.Assert.*
import org.junit.Test

class BackupHttpClientTest {
    @Test fun `accepts only an HTTPS origin without credentials path query or fragment`() {
        assertEquals("https://api.example.com:8443", backupApiOrigin("https://api.example.com:8443/"))
        for (value in listOf("http://api.example.com", "https://user:pass@api.example.com", "https://api.example.com/path", "https://api.example.com/?x=1", "https://api.example.com/#x", "https://api.example.com:99999", "not a url")) {
            assertThrows(IllegalArgumentException::class.java) { backupApiOrigin(value) }
        }
    }
    @Test fun `restricts authenticated requests to backup endpoints`() {
        assertTrue(isBackupApiPath("/api/v1/backups"))
        assertTrue(isBackupApiPath("/api/v1/backups/confirm"))
        assertTrue(isBackupApiPath("/api/v1/backups/download"))
        for (path in listOf("https://evil.example", "//evil.example", "/api/v1/backups/../admin", "/api/v1/backups?x=1", "/api/v1/backups/other")) assertFalse(isBackupApiPath(path))
    }
    @Test fun `allows only the intended account and read endpoints`() {
        assertTrue(isBackupContextPostPath("/api/v1/account/devices"))
        assertTrue(isBackupContextPostPath("/api/v1/account/activate"))
        assertFalse(isBackupContextPostPath("/api/v1/account/activate?owner=other"))
        assertTrue(isBackupContextGetPath("/api/v1/backups/latest"))
        assertFalse(isBackupContextGetPath("/api/v1/backups/latest?owner=other"))
    }
}
