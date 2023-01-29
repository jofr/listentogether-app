import { AudioInfo, PodcastEpisodes, PodcastInfo } from "./types";
import { extractAudioInfoFromUrl } from "./extract";
import { catchError } from "../util/util";
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
        const [error, response] = await catchError(fetch(`https://${window.settings.backendHost}/podcasts/${encodeURIComponent(uri)}`));
        if (!error && (response as Response).ok) {
            const podcast = await (response as Response).json();
            if (podcast) {
                return {
                    uri: podcast.url,
                    title: podcast.title,
                    artist: podcast.author,
                    cover: {
                        original: { url: podcast.image.original },
                        thumbnail: { url: podcast.image.thumbnail },
                        large: { url: podcast.image.large }
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
        const [error, response] = await catchError(fetch(`https://${window.settings.backendHost}/podcasts/${encodeURIComponent(uri)}/episodes?max=${max}`));
        if (!error && (response as Response).ok) {
            const episodes = await (response as Response).json();
            if (Array.isArray(episodes) && episodes.length > 0) {
                for (const episode of episodes) {
                    uris = uris.concat(episode.enclosureUrl);

                    this.audioInfoCache.set(episode.enclosureUrl, new Promise(resolve => resolve({
                        uri: episode.enclosureUrl,
                        title: episode.title,
                        artist: podcastArtist,
                        album: podcastTitle,
                        duration: episode.duration,
                        cover: {
                            original: { url: episode.image.original !== "" ? episode.image.original : episode.feedImage.original },
                            thumbnail: { url: episode.image.thumbnail !== "" ? episode.image.thumbnail : episode.feedImage.thumbnail },
                            large: { url: episode.image.large !== "" ? episode.image.large : episode.feedImage.large }
                        }
                    })));
                }
            }
        }

        return uris;
    }

    private async syncOrExtractAudioInfo(uri: string): Promise<AudioInfo | null> {
        const extractedInfo = extractAudioInfoFromUrl(uri);
        const peer = document.querySelector("join-listening-dialog").session?.listeningPeer || window.session.listeningPeer;
        const syncedInfo = (peer as ListeningListener).requestAudioInfoFromHost(uri);

        return await Promise.race([extractedInfo, syncedInfo]);
    }

    getAudioInfo(uri: string): Promise<AudioInfo | null> {
        if (!this.audioInfoCache.has(uri)) {
            if (window.session.listeningPeer instanceof ListeningListener || document.querySelector("join-listening-dialog").session) {
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
        let results = [];

        const [error, response] = await catchError(fetch(`https://${window.settings.backendHost}/podcasts?search=${query}`));
        if (!error && (response as Response).ok) {
            const podcasts = await (response as Response).json();
            if (Array.isArray(podcasts) && podcasts.length > 0) {
                for (const podcast of podcasts) {
                    const info = {
                        uri: podcast.url,
                        title: podcast.title,
                        artist: podcast.author,
                        cover: {
                            original: { url: podcast.image?.original },
                            thumbnail: { url: podcast.image?.thumbnail },
                            large: { url: podcast.image?.large }
                        }
                    }

                    this.podcastInfoCache.set(podcast.uri, new Promise(resolve => resolve(info)));
                    results.push(info);
                }
            }
        }

        return results;
    }
}

window.metadataCache = new MetadataCache();