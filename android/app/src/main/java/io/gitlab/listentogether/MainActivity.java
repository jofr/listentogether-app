package io.gitlab.listentogether;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.webkit.ServiceWorkerClient;
import android.webkit.ServiceWorkerController;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(ShareTargetPlugin.class);
        
        super.onCreate(savedInstanceState);

        if(Build.VERSION.SDK_INT >= 24 ){
            ServiceWorkerController swController = ServiceWorkerController.getInstance();

            swController.setServiceWorkerClient(new ServiceWorkerClient() {
                @Override
                public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
                    return bridge.getLocalServer().shouldInterceptRequest(request);
                }
            });
        }
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