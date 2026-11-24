package com.kumchovy.arsen.codex.account

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

@CapacitorPlugin(name = "ArsenAccount")
class ArsenAccountPlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val controller = AccountController(ClerkAccountAuth())

    private fun run(call: PluginCall, operation: suspend () -> AccountStatus) {
        scope.launch {
            try {
                val result = operation()
                val response = JSObject().put("status", result.status)
                if (result.email != null) response.put("email", result.email)
                call.resolve(response)
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (_: Exception) { call.reject("No se pudo completar la operación de cuenta") }
        }
    }

    @PluginMethod fun getState(call: PluginCall) = run(call) { controller.state() }
    @PluginMethod fun signIn(call: PluginCall) = run(call) {
        controller.signIn(call.getString("email") ?: "", call.getString("password") ?: "")
    }
    @PluginMethod fun completeVerification(call: PluginCall) = run(call) { controller.verify() }
    @PluginMethod fun signOut(call: PluginCall) = run(call) { controller.signOut(); AccountStatus("signed-out") }

    override fun handleOnDestroy() { scope.cancel(); super.handleOnDestroy() }
}
