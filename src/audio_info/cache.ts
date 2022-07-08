import { AudioInfo } from "./audio_info";
import { extractAudioInfoFromUrl } from "./extract";

declare global {
    interface Window {
        audioInfoCache: AudioInfoCache;
    }
}

class AudioInfoCache {
    private cache: Map<string, Promise<AudioInfo>> = new Map<string, Promise<AudioInfo>>();

    set(uri: string, audioInfo: AudioInfo) {
        this.cache.set(uri, new Promise((resolve) => resolve(audioInfo)));
    }

    async get(uri: string): Promise<AudioInfo> {
        if (!this.cache.has(uri)) {
            this.cache.set(uri, extractAudioInfoFromUrl(uri));
        }
        return this.cache.get(uri);
    }

    async getProperty(uri: string, property: "title" | "artist" | "album" | "duration" | "cover") {
        const audio = await this.get(uri);
        return audio[property];
    }
}

window.audioInfoCache = new AudioInfoCache();