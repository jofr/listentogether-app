import { html, HTMLTemplateResult } from "lit";

const defaultCoverData = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="100%" height="100%" fill="#b0e7ae" /><path d="m19.65 42q-3.15 0-5.325-2.175t-2.175-5.325 2.175-5.325 5.325-2.175q1.4 0 2.525 0.4t1.975 1.1v-22.5h11.7v6.75h-8.7v21.75q0 3.15-2.175 5.325t-5.325 2.175z" fill="#ffffff" /></svg>`;
export const defaultCoverObjectUrl = URL.createObjectURL(new Blob([defaultCoverData], { type: "image/svg+xml" }));

export function extractUrls(input: string): string[] | null {
    return input.match(/\bhttps?:\/\/\S+/gi);
}

export function prettyTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60.0);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function placeholderTime(): HTMLTemplateResult {
    return html`<loading-placeholder characters="2"></loading-placeholder>:<loading-placeholder characters="2"></loading-placeholder>`
}

export async function catchError<T>(promise: Promise<T>) {
    return promise.then((resolved: T) => [null, resolved]).catch((error: Error) => [error || true, null]);
}

export function stringToBytes(string: string) {
	return [...string].map(character => character.charCodeAt(0));
}

export function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

export function deepCopy(x: any) {
    return JSON.parse(JSON.stringify(x));
}

export function arraysEqual(x: any[], y: any[]) {
    if (x.length !== y.length) {
        return false;
    } else {
        for (let i = 0; i < x.length; i++) {
            if (x[i] !== y[i]) {
                return false;
            }
        }
    }

    return true;
}