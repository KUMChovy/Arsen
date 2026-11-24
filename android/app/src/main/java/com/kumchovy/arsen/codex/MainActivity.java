package com.kumchovy.arsen.codex;

import com.getcapacitor.BridgeActivity;
import com.kumchovy.arsen.codex.health.HealthConnectPlugin;
import com.kumchovy.arsen.codex.account.ArsenAccountPlugin;
import com.kumchovy.arsen.codex.backup.ArsenBackupPlugin;

public class MainActivity extends BridgeActivity {
    public MainActivity() {
        registerPlugin(HealthConnectPlugin.class);
        registerPlugin(ArsenAccountPlugin.class);
        registerPlugin(ArsenBackupPlugin.class);
    }
}
