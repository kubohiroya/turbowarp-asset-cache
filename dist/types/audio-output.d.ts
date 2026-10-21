export declare function createAudioAmplifier(audio: HTMLAudioElement): {
    setGain(value: number): void;
    resume(): Promise<void>;
    dispose: () => void;
};
