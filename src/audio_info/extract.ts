import * as musicMetadata from "music-metadata-browser";

import { AudioInfo } from "./audio_info";
import { catchError, extractUrls, stringToBytes } from "../util/util";

enum FileType {
    Audio, HTML, RSS, Other
}

function titleFromUrl(url: string) {
    const titleMatches = url.match(/\/([^\/?#]+)[^\/]*$/);
    if (titleMatches.length > 1) {
        return titleMatches[1];
    } else {
        return url;
    }
}

function coverPicture(pictures: musicMetadata.IPicture[]) {
    const toInternalCover = (cover: musicMetadata.IPicture) => {
        return {
            dataUrl: `data:${cover.format};base64,${cover.data.toString("base64")}`,
            objectUrl: URL.createObjectURL(new Blob([cover.data], { type: cover.format })),
            format: cover.format
        }
    };

    return pictures.reduce((previous, current) => {
        if (current.type && ["front", "cover", "cover (front)"].includes(current.type.toLowerCase())) {
            return toInternalCover(current);
        } else {
            return previous;
        }
    }, toInternalCover(pictures[0]));
}

function fileTypeFromContentTypeHeader(contentType: string) {
    const types = [
        {
            mimeTypes: ["audio/vnd.dolby.dd-raw", "audio/x-musepack", "audio/aiff", "audio/x-dsf", "audio/x-flac", "audio/wavpack", "audio/ape", "audio/mpeg", "audio/amr", "audio/x-it", "audio/vnd.wave", "audio/qcelp", "audio/opus", "audio/ogg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/aac"],
            fileType: FileType.Audio
        },
        {
            mimeTypes: ["text/html", "application/xhtml+xml"],
            fileType: FileType.HTML
        },
        {
            mimeTypes: ["application/rss+xml", "application/xml", "application/rdf+xml", "text/xml", "text/rss+xml"],
            fileType: FileType.RSS
        }
    ];

    for (const type of types) {
        if (type.mimeTypes.includes(contentType)) {
            return type.fileType;
        }
    }
    
    return FileType.Other;
}

/* Mostly taken and modified from https://github.com/sindresorhus/file-type/blob/main/core.js */
function fileTypeFromBuffer(buffer) {
    const _check = (buffer: Uint8Array, headers: any, options: any = {}) => {
        options = {
            offset: 0,
            ...options,
        };
    
        for (const [index, header] of headers.entries()) {
            // If a bitmask is set
            if (options.mask) {
                // If header doesn't equal `buf` with bits masked off
                if (header !== (options.mask[index] & buffer[index + options.offset])) {
                    return false;
                }
            } else if (header !== buffer[index + options.offset]) {
                return false;
            }
        }
    
        return true;
    }


    if (_check(buffer, [0x0B, 0x77])) {
        return FileType.Audio; // ac3, audio/vnd.dolby.dd-raw
    }

    if (_check(buffer, stringToBytes('MP+'))) {
        return FileType.Audio; // mpc, audio/x-musepack
    }

    if (_check(buffer, stringToBytes('MPCK'))) {
        return FileType.Audio; // mpc, audio/x-musepack
    }

    if (_check(buffer, stringToBytes('FORM'))) {
        return FileType.Audio; // aif, audio/aiff
    }

    if (_check(buffer, stringToBytes('DSD '))) {
        return FileType.Audio; // dsf, audio/x-dsf
    }

    if (_check(buffer, stringToBytes('fLaC'))) {
        return FileType.Audio; // flac, audio/x-flac
    }

    if (_check(buffer, stringToBytes('wvpk'))) {
        return FileType.Audio; // wv, audio/wavpack
    }

    if (_check(buffer, stringToBytes('MAC '))) {
        return FileType.Audio; // ape, audio/ape
    }

    if (_check(buffer, stringToBytes('ID3'), {})) {
        return FileType.Audio; // mp3, audio/mpeg
    }

    if (_check(buffer, stringToBytes('#!AMR'))) {
        return FileType.Audio; // amr, audio/amr
    }

    if (_check(buffer, stringToBytes('IMPM'))) {
        return FileType.Audio; // it, audio/x-it
    }

    // RIFF file format
    if (_check(buffer, [0x52, 0x49, 0x46, 0x46])) {
        if (_check(buffer, [0x57, 0x41, 0x56, 0x45], {offset: 8})) {
            return FileType.Audio; // wav, audio/vnd.wave
        }

        if (_check(buffer, [0x51, 0x4C, 0x43, 0x4D], {offset: 8})) {
            return FileType.Audio; // qcp, audio/qcelp
        }
    }

    // Ogg container format
    if (_check(buffer, stringToBytes('OggS'))) {
        // Needs to be before `ogg` check
        if (_check(buffer, [0x4F, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64]), { offset: 4 + 28 }) {
            return FileType.Audio; // opus, audio/opus
        }

        // If ' FLAC' in header  https://xiph.org/flac/faq.html
        if (_check(buffer, [0x7F, 0x46, 0x4C, 0x41, 0x43]), { offset: 4 + 28 }) {
            return FileType.Audio; // oga, audio/ogg
        }

        // 'Speex  ' in header https://en.wikipedia.org/wiki/Speex
        if (_check(buffer, [0x53, 0x70, 0x65, 0x65, 0x78, 0x20, 0x20]), { offset: 4 + 28 }) {
            return FileType.Audio; // spx, audio/ogg
        }

        // If '\x01vorbis' in header
        if (_check(buffer, [0x01, 0x76, 0x6F, 0x72, 0x62, 0x69, 0x73]), { offset: 4 + 28 }) {
            return FileType.Audio; // ogg, audio/ogg
        }
    }   

    // Mpeg container format
    if (_check(buffer, stringToBytes('ftyp'), {offset: 4}) && (buffer[8] & 0x60) !== 0x00) {
        const brandMajor = buffer.toString('binary', 8, 12).replace('\0', ' ').trim();
        if (["m4b", "f4a", "f4b"].includes(brandMajor)) {
            return FileType.Audio; // m4b/f4a/f4b, audio/mp4
        }

        if (brandMajor == "m4a") {
            return FileType.Audio; // m4a, audio/x-m4a
        }
    }

    if (buffer.length >= 2 && _check(buffer, [0xFF, 0xE0], {offset: 0, mask: [0xFF, 0xE0]})) {
        if (_check(buffer, [0x10], {offset: 1, mask: [0x16]})) {
            return FileType.Audio; // aac, audio/aac
        }

        if (_check(buffer, [0x02], {offset: 1, mask: [0x06]})) {
            return FileType.Audio; // mp3, audio/mpeg
        }

        if (_check(buffer, [0x04], {offset: 1, mask: [0x06]})) {
            return FileType.Audio; // mp2, audio/mpeg
        }

        if (_check(buffer, [0x06], {offset: 1, mask: [0x06]})) {
            return FileType.Audio; // mp1, audio/mpeg
        }
    }

    return FileType.Other;
}

async function extractAudioInfoFromStream(stream: ReadableStream): Promise<AudioInfo | null> {
    let resolveAudioInfo: (value: (AudioInfo | null) | PromiseLike<(AudioInfo | null)>) => void;
    const audioInfoPromise = new Promise<AudioInfo>((resolve, reject) => resolveAudioInfo = resolve);

    const readStream = async () => {
        const reader = stream.getReader();
        const fileTypeBytes = 100;
        const metadataBytes = 10000000;
        let fileTypeDetermined = false;
        let isAudio = false;
        let reachedEnd = false;
        let buffer = new Uint8Array();
        while (!reachedEnd && buffer.length < (isAudio ? metadataBytes : fileTypeBytes)) {
            const { done, value } = await reader.read();
    
            if (!done) {
                const mergedBuffer = new Uint8Array(buffer.length + value.length);
                mergedBuffer.set(buffer);
                mergedBuffer.set(value, buffer.length);
                buffer = mergedBuffer;
            }
    
            if (!fileTypeDetermined && buffer.length > fileTypeBytes) {
                const fileType = fileTypeFromBuffer(buffer);
                fileTypeDetermined = true;
                isAudio = (fileType === FileType.Audio);
                if (!isAudio) {
                    resolveAudioInfo(null);
                }
            }
    
            if (done || buffer.length > (isAudio ? metadataBytes : fileTypeBytes)) {
                reachedEnd = true;
                reader.cancel();
    
                if (isAudio) {
                    const metadata = await musicMetadata.parseBuffer(buffer);
                    console.log(metadata)
                    const audioInfo: AudioInfo = {
                        uri: "",
                        title: metadata.common?.title || "",
                        album: metadata.common?.album || "",
                        artist: metadata.common?.artist || "",
                        duration: metadata.format?.duration || 0.0
                    };
                    if (metadata.common?.picture) {
                        audioInfo.cover = coverPicture(metadata.common.picture);
                    }
                    resolveAudioInfo(audioInfo);
                }
            }
        }
    }
    readStream();

    return audioInfoPromise;
}

async function extractAudioInfoUsingAudioElement(url: string): Promise<AudioInfo | null> {
    let resolveFileType: (value: FileType | PromiseLike<FileType>) => void;
    const fileTypePromise = new Promise<FileType>((resolve, reject) => resolveFileType = resolve);
    const audioElement = new Audio();
    audioElement.preload = "metadata";
    audioElement.addEventListener("error", () => resolveFileType(FileType.Other));
    audioElement.addEventListener("loadedmetadata", () => resolveFileType(FileType.Audio));
    audioElement.src = url;

    const fileType = await fileTypePromise;
    if (fileType === FileType.Audio) {
        return {
            uri: url,
            title: titleFromUrl(url),
            album: "",
            artist: "",
            duration: audioElement.duration
        };
    } else {
        return null;
    }
}

export async function extractAudioInfoFromUrl(url: string): Promise<AudioInfo | null> {
    let audio: AudioInfo | null = null;

    const [error, response] = await catchError(fetch(url));
    if (!error && (response as Response).ok) {
        const contentType = (response as Response).headers.get("Content-Type");
        if (!contentType || fileTypeFromContentTypeHeader(contentType) === FileType.Audio) {
            audio = await extractAudioInfoFromStream((response as Response).body);
            if (audio !==  null) {
                audio.uri = (response as Response).url; // might have been redirected, uri is the redirected url (which is also the one getting cached, so needs to be set to this to reach the cache)
                audio.title = audio.title != "" ? audio.title : titleFromUrl(url);

                caches.open("audio-cache").then(cache => {
                    cache.add(audio.uri);
                });
            }
        } else {
            (response as Response).body.cancel();
        }
    } else {
        audio = await extractAudioInfoUsingAudioElement(url);
    }

    if (audio !== null) {
        window.audioInfoCache.set(url, audio);
    }

    return audio;
}

export async function extractAudios(input: string): Promise<AudioInfo[] | null> {
    const urls = extractUrls(input);

    if (urls === null) {
        return null;
    }

    let audios = [];
    const possibleAudios = await Promise.allSettled(urls.map(extractAudioInfoFromUrl));
    for (const possibleAudio of possibleAudios) {
        if (possibleAudio.status === "fulfilled" && possibleAudio.value !== null) {
            audios = audios.concat(possibleAudio.value);
        }
    }

    if (audios.length > 0) {
        return audios;
    } else {
        return null;
    }
}