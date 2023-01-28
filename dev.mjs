/**
 * Starts a parcel dev server and checks if the service worker has been modified
 * after each build. If it has been modified it injects the manifest for
 * precaching as the last step of the build process.
 */

import { Parcel } from "@parcel/core";
import { injectManifest } from "workbox-build";
import { statSync } from "fs";

import workboxConfig from "./workbox-config.js";

const serviceWorkerPath = "dist/service-worker.js";
let serviceWorkerLastModified = statSync(serviceWorkerPath).mtimeMs;

let bundler = new Parcel({
    entries: "src/index.html",
    defaultConfig: "@parcel/config-default",
    serveOptions: {
        port: 1234
    }
});

await bundler.watch((err, buildEvent) => {
    if (buildEvent.type == "buildSuccess") {
        let bundles = buildEvent.bundleGraph.getBundles();
        console.log(`✨ Built ${bundles.length} bundles in ${buildEvent.buildTime}ms!`);
        if (statSync(serviceWorkerPath).mtimeMs !== serviceWorkerLastModified) {
            injectManifest(workboxConfig).then(() => {
                serviceWorkerLastModified = statSync(serviceWorkerPath).mtimeMs;
                console.log("Injected service worker manifest");
            });
        }
    }
});