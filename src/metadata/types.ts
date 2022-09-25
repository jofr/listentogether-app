export type CoverInfo = {
    url?: string,
    dataUrl?: string,
    objectUrl?: string,
    format?: string
}

export type AudioInfo = {
    uri: string,
    title: string,
    artist: string,
    album: string,
    duration: number,
    cover?: CoverInfo
}

export type PodcastEpisodes = AudioInfo[];

export type PodcastInfo = {
    uri: string,
    title: string,
    artist: string,
    cover?: CoverInfo
}