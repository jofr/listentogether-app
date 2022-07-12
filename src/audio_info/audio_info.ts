export type CoverInfo = {
    dataUrl: string,
    objectUrl: string,
    format: string
}

export type AudioInfo = {
    uri: string,
    title: string,
    artist: string,
    album: string,
    duration: number,
    cover?: CoverInfo
}