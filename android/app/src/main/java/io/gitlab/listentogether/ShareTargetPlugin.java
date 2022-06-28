package io.gitlab.listentogether;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ShareTarget")
public class ShareTargetPlugin extends Plugin {

    public void receivedTextShare(String text) {
        JSObject event = new JSObject();
        event.put("text", text);
        notifyListeners("receiveshare", event);
    }

}