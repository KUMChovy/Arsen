package com.kumchovy.arsen.codex

import android.app.Application
import com.clerk.api.Clerk
import com.kumchovy.arsen.codex.account.initializeClerkIfConfigured

class ArsenApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        initializeClerkIfConfigured(BuildConfig.CLERK_PUBLISHABLE_KEY) { key -> Clerk.initialize(this, publishableKey = key) }
    }
}
