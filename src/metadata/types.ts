export type AudioUri = string;

export type CoverInfo = {
    url?: AudioUri,
    dataUrl?: string,
    objectUrl?: string,
    format?: string
}

export type AudioInfo = {
    uri: AudioUri,
    title: string,
    artist: string,
    album: string,
    duration: number,
    cover?: {
        original: CoverInfo,
        thumbnail: CoverInfo,
        large: CoverInfo
    }
}

export type PodcastEpisodes = AudioInfo[];

export type PodcastInfo = {
    uri: AudioUri,
    title: string,
    artist: string,
    description: string,
    cover?: {
        original: CoverInfo,
        thumbnail: CoverInfo,
        large: CoverInfo
    }
}