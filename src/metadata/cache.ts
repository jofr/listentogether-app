import { AudioInfo, PodcastEpisodes, PodcastInfo } from "./types";
import { extractAudioInfoFromUrl } from "./extract";
import { catchError } from "../util/util";

import config from "../../config.json";
import { ListeningListener } from "../listening/peer";

declare global {
    interface Window {
        metadataCache: MetadataCache;
    }
}

type EpisodesCache = {
    uris: Promise<string[]>,
    from: number,
    to: number
}

class MetadataCache {
    private audioInfoCache: Map<string, Promise<AudioInfo | null>> = new Map<string, Promise<AudioInfo | null>>();
    private podcastEpisodesCache: Map<string, EpisodesCache> = new Map<string, EpisodesCache>();
    private podcastInfoCache: Map<string, Promise<PodcastInfo | null>> = new Map<string, Promise<PodcastInfo | null>>();

    private async downloadPodcastInfo(uri: string): Promise<PodcastInfo | null> {
        const [error, response] = await catchError(fetch(`${config.podcastServiceUrl}/podcasts/byurl/?url=${uri}`));
        if (!error && (response as Response).ok) {
            const result = await (response as Response).json();
            if (result.feed) {
                return {
                    uri: result.feed.url,
                    title: result.feed.title,
                    artist: result.feed.author,
                    cover: {
                        url: result.feed.image
                    }
                }
            }
        }
        return null;
    }

    private async downloadPodcastEpisodes(uri: string, max: number): Promise<string[]> {
        let uris = [];
        
        const podcastTitle = await this.getPodcastInfo(uri).then(info => info?.title ? info.title : "");
        const podcastArtist = await this.getPodcastInfo(uri).then(info => info?.title ? info.title : "");
        const [error, response] = await catchError(fetch(`${config.podcastServiceUrl}/episodes/byurl/?url=${uri}&max=${max}`));
        if (!error && (response as Response).ok) {
            const result = await (response as Response).json();
            if (result && result.count > 0 && result.items) {
                for (const episode of result.items) {
                    uris = uris.concat(episode.enclosureUrl);

                    this.audioInfoCache.set(episode.enclosureUrl, new Promise(resolve => resolve({
                        uri: episode.enclosureUrl,
                        title: episode.title,
                        artist: podcastArtist,
                        album: podcastTitle,
                        duration: episode.duration,
                        cover: {
                            url: episode.image !== "" ? episode.image : episode.feedImage
                        }
                    })));
                }
            }
        }

        return uris;
    }

    private async syncOrExtractAudioInfo(uri: string): Promise<AudioInfo | null> {
        const extractedInfo = extractAudioInfoFromUrl(uri);
        const peer = document.querySelector("join-listening-dialog").session?.peer || window.session.peer;
        const syncedInfo = (peer as ListeningListener).requestAudioInfoFromHost(uri);

        return await Promise.race([extractedInfo, syncedInfo]);
    }

    getAudioInfo(uri: string): Promise<AudioInfo | null> {
        if (!this.audioInfoCache.has(uri)) {
            if (window.session.peer instanceof ListeningListener || document.querySelector("join-listening-dialog").session) {
                this.audioInfoCache.set(uri, this.syncOrExtractAudioInfo(uri));
            } else {
                this.audioInfoCache.set(uri, extractAudioInfoFromUrl(uri));
            }
        }
        return this.audioInfoCache.get(uri);
    }

    async getPodcastEpisodes(uri: string, from: number, to: number): Promise<PodcastEpisodes> {
        const episodesCache = this.podcastEpisodesCache.get(uri);
        if (episodesCache === undefined || from < episodesCache.from || to > episodesCache.to) {
            this.podcastEpisodesCache.set(uri, {
                uris: this.downloadPodcastEpisodes(uri, to),
                from: 0,
                to: to
            });
        }
        const uris = await this.podcastEpisodesCache.get(uri).uris.then(uris => uris.slice(from, to));
        const audios = await Promise.all(uris.map(uri => this.getAudioInfo(uri)));
        return audios;
    }

    getPodcastInfo(uri: string): Promise<PodcastInfo | null> {
        if (!this.podcastInfoCache.has(uri)) {
            this.podcastInfoCache.set(uri, this.downloadPodcastInfo(uri));
        }
        return this.podcastInfoCache.get(uri);
    }

    async searchPodcasts(query: string): Promise<PodcastInfo[]> {
        let podcasts = [];

        const [error, response] = await catchError(fetch(`${config.podcastServiceUrl}/podcasts/search/?query=${query}`));
        if (!error && (response as Response).ok) {
            const result = await (response as Response).json();
            if (result.count > 0) {
                for (const podcast of result.feeds) {
                    const info = {
                        uri: podcast.url,
                        title: podcast.title,
                        artist: podcast.author,
                        cover: {
                            url: podcast.image
                        }
                    };

                    this.podcastInfoCache.set(podcast.uri, new Promise(resolve => resolve(info)));
                    podcasts.push(info);
                }
            }
        }

        return podcasts;
    }
}

window.metadataCache = new MetadataCache();