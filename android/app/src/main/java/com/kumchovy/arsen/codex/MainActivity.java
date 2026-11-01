package com.kumchovy.arsen.codex;

import com.getcapacitor.BridgeActivity;
import com.kumchovy.arsen.codex.health.HealthConnectPlugin;

public class MainActivity extends BridgeActivity {
    public MainActivity() {
        registerPlugin(HealthConnectPlugin.class);
    }
}
