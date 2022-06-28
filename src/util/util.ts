export function extractURLs(input: string): string[] | null {
    return input.match(/\bhttps?:\/\/\S+/gi);
}

export function prettyTime(seconds: number) {
    const minutes = Math.floor(seconds / 60.0);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export async function catchError<T>(promise: Promise<T>) {
    return promise.then((resolved: T) => [null, resolved]).catch((error: Error) => [error || true, null])
}

export function stringToBytes(string: string) {
	return [...string].map(character => character.charCodeAt(0));
}

export function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}