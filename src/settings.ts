import Cookies from "js-cookie";

import config from "../config.json";

export class Settings {
    private defaults = {
        "firstUse": true,
        "darkMode": false,
        "useCustomBackend": false,
        "customBackendHost": ""
    }

    private parseFromStringValue(value: string): boolean | string {
        if (value === "true") {
            return true;
        } else if (value === "false") {
            return false;
        } else {
            return value;
        }
    }

    private encodeToStringValue(value: boolean | string) {
        if (value === true) {
            return "true";
        } else if (value === false) {
            return "false";
        } else {
            return value;
        }
    }

    private getSetting(setting: string): boolean | string {
        const stored = Cookies.get(setting);
        if (stored !== undefined) {
            return this.parseFromStringValue(stored);
        } else {
            return this.defaults[setting];
        }
    }

    private setSetting(setting: string, value: boolean | string) {
        Cookies.set(setting, this.encodeToStringValue(value), { expires: 365 });
    }

    get firstUse() {
        return this.getSetting("firstUse") as boolean;
    }

    set firstUse(value: boolean) {
        this.setSetting("firstUse", value);
    }

    get darkMode() {
        return this.getSetting("darkMode") as boolean;
    }

    set darkMode(value: boolean) {
        if (value === true) {
            document.body.classList.add("dark-mode");
        } else {
            document.body.classList.remove("dark-mode");
        }

        this.setSetting("darkMode", value);
    }

    get useCustomBackend(): boolean {
        return this.getSetting("useCustomBackend") as boolean;
    }

    set useCustomBackend(value: boolean) {
        this.setSetting("useCustomBackend", value);
    }

    get customBackendHost(): string {
        return this.getSetting("customBackendHost") as string;
    }

    set customBackendHost(value: string) {
        this.setSetting("customBackendHost", value);
    }

    get backendHost(): string {
        if (this.useCustomBackend) {
            return this.customBackendHost;
        } else {
            return config.backendHost;
        }
    }
}