package io.gitlab.listentogether;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(ShareTargetPlugin.class);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);

        String action = intent.getAction();
        String type = intent.getType();

        if (Intent.ACTION_SEND.equals(action)) {
            String text = intent.getStringExtra(Intent.EXTRA_TEXT);
            PluginHandle handle = bridge.getPlugin("ShareTarget");
            ShareTargetPlugin plugin = (ShareTargetPlugin) handle.getInstance();
            plugin.receivedTextShare(text);
        }
    }

}