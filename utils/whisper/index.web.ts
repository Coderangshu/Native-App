import { env, pipeline } from '@xenova/transformers';
import { useCallback, useRef, useState } from 'react';

// Configure transformers to use the cache effectively
env.allowLocalModels = false;
env.useBrowserCache = true;

declare global {
    interface Window {
        webkitAudioContext: typeof AudioContext;
    }
}

export function useWhisperSTT() {
    const [recognizing, setRecognizing] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [loadingMsg, setLoadingMsg] = useState('');
    const [modelType, setModelType] = useState<'tiny.en' | 'small' | null>(null);

    const transcriber = useRef<any>(null);
    const audioContext = useRef<AudioContext | null>(null);
    const mediaStream = useRef<MediaStream | null>(null);
    const processor = useRef<ScriptProcessorNode | null>(null);
    const audioData = useRef<Float32Array>(new Float32Array(0));

    const initModel = async (useSmall: boolean = false) => {
        setLoadingMsg('Loading Web AI...');
        setModelType(useSmall ? 'small' : 'tiny.en');
        const modelId = useSmall ? 'Xenova/whisper-small.en' : 'Xenova/whisper-tiny.en';

        try {
            transcriber.current = await pipeline('automatic-speech-recognition', modelId, {
                progress_callback: (info: any) => {
                    if (info.status === 'downloading') {
                        setLoadingMsg(`Downloading AI Model (${Math.round(info.progress || 0)}%)`);
                    } else if (info.status === 'ready') {
                        setLoadingMsg('');
                    }
                }
            });
            setIsReady(true);
            setLoadingMsg('');
        } catch (e) {
            console.error("Transformers load error:", e);
            setLoadingMsg('Failed to load AI');
        }
    };

    const concatFloat32Arrays = (a: Float32Array, b: Float32Array) => {
        const c = new Float32Array(a.length + b.length);
        c.set(a, 0);
        c.set(b, a.length);
        return c;
    };

    const startRecording = useCallback(async (onResult: (text: string, isFinal: boolean) => void) => {
        if (!transcriber.current) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStream.current = stream;

            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            audioContext.current = new AudioContextClass({ sampleRate: 16000 });

            const source = audioContext.current.createMediaStreamSource(stream);
            processor.current = audioContext.current.createScriptProcessor(4096, 1, 1);

            audioData.current = new Float32Array(0);

            processor.current.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                audioData.current = concatFloat32Arrays(audioData.current, inputData);
            };

            source.connect(processor.current);
            processor.current.connect(audioContext.current.destination);

            setRecognizing(true);
        } catch (e) {
            console.error("Microphone error:", e);
            setRecognizing(false);
        }
    }, []);

    const stopRecording = useCallback(async (onResult?: (text: string, isFinal: boolean) => void) => {
        setRecognizing(false);

        // Stop recording
        if (processor.current) {
            processor.current.disconnect();
            processor.current = null;
        }
        if (mediaStream.current) {
            mediaStream.current.getTracks().forEach(t => t.stop());
            mediaStream.current = null;
        }
        if (audioContext.current) {
            await audioContext.current.close();
            audioContext.current = null;
        }

        // Run inference on collected data
        if (audioData.current.length > 0 && transcriber.current && onResult) {
            setLoadingMsg('Transcribing...');
            try {
                const output = await transcriber.current(audioData.current, {
                    language: 'en',
                    task: 'transcribe'
                });
                onResult(output.text.trim(), true);
            } catch (e) {
                console.error("Transcription error:", e);
            } finally {
                setLoadingMsg('');
            }
        }

        audioData.current = new Float32Array(0);
    }, []);

    return {
        isReady,
        recognizing,
        loadingMsg,
        modelType,
        initModel,
        startRecording,
        stopRecording
    };
}
