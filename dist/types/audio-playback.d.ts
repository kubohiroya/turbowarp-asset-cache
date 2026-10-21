export type AssetManagerAudioSource = Readonly<{
    asset: unknown;
    url?: never;
}> | Readonly<{
    url: string;
    asset?: never;
}>;
export interface AssetManagerAudioFadeOptions {
    readonly fadeIn?: number;
    readonly fadeOut?: number;
}
export interface AssetManagerAudioStopOptions {
    readonly fadeOut?: number;
    readonly signal?: AbortSignal;
}
export interface AssetManagerAudioPlaybackOptions extends AssetManagerAudioFadeOptions {
    readonly gain?: number;
    readonly muted?: boolean;
    readonly playbackRate?: number;
}
export interface AssetManagerAudioPlayOptions extends AssetManagerAudioFadeOptions {
    readonly restart?: boolean;
    readonly loop?: boolean;
    readonly signal?: AbortSignal;
}
export interface AssetManagerAudioPlayback {
    readonly ended: Promise<void>;
    readonly currentTime: number;
    readonly paused: boolean;
    readonly loop: boolean;
    readonly gain: number;
    readonly muted: boolean;
    readonly playbackRate: number;
    play(options?: AssetManagerAudioPlayOptions): Promise<void>;
    pause(): void;
    stop(options?: AssetManagerAudioStopOptions): void | Promise<void>;
    seek(seconds: number, signal?: AbortSignal): Promise<void>;
    setGain(value: number): void;
    setMuted(value: boolean): void;
    setPlaybackRate(value: number): void;
    dispose(): void;
}
export declare function validateAudioPlaybackOptions(options: AssetManagerAudioPlaybackOptions): void;
/** One reusable native element; the caller owns source resolution and resource release. */
export declare function createBrowserAudioPlayback(audio: HTMLAudioElement, options: AssetManagerAudioPlaybackOptions, release: () => void, playbackError: (cause: unknown) => Error): AssetManagerAudioPlayback;
