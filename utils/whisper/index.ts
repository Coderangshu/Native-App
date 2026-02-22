import * as FileSystem from 'expo-file-system';
import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';
// @ts-ignore
import { initWhisper, WhisperContext } from 'whisper.rn';

const MODEL_URL_TINY = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin';
const MODEL_URL_SMALL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin';

export function useWhisperSTT() {
    const [recognizing, setRecognizing] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [loadingMsg, setLoadingMsg] = useState('');
    const [modelType, setModelType] = useState<'tiny.en' | 'small' | null>(null);

    const whisperContext = useRef<WhisperContext | null>(null);
    const stopRecordingRef = useRef<(() => Promise<void>) | null>(null);

    const initModel = async (useSmall: boolean = false) => {
        if (Platform.OS === 'web') return; // Handled by web implementation

        setLoadingMsg('Checking hardware...');
        const url = useSmall ? MODEL_URL_SMALL : MODEL_URL_TINY;
        const modelName = useSmall ? 'ggml-small.en.bin' : 'ggml-tiny.en.bin';
        setModelType(useSmall ? 'small' : 'tiny.en');

        // @ts-ignore
        const docDir = FileSystem.documentDirectory as string;
        const dirInfo = await FileSystem.getInfoAsync(docDir + 'whisper/');
        if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(docDir + 'whisper/');
        }
        const modelPath = docDir + 'whisper/' + modelName;

        const fileInfo = await FileSystem.getInfoAsync(modelPath);

        if (!fileInfo.exists) {
            setLoadingMsg(`Downloading ${useSmall ? 'Small' : 'Tiny'} Model (~${useSmall ? '241' : '75'}MB)...`);
            await FileSystem.downloadAsync(url, modelPath);
        }

        setLoadingMsg('Initializing AI...');
        try {
            whisperContext.current = await initWhisper({ filePath: modelPath });
            setIsReady(true);
            setLoadingMsg('');
        } catch (e) {
            console.error("Failed to init whisper:", e);
            setLoadingMsg('Failed to load AI');
        }
    };

    const startRecording = useCallback(async (onResult: (text: string, isFinal: boolean) => void) => {
        if (!whisperContext.current) return;

        try {
            setRecognizing(true);
            const { stop, subscribe } = await whisperContext.current.transcribeRealtime({
                language: 'en',
                onProgress: (progress: number) => {
                    // whisper.rn progress might not map 1:1 to interim results cleanly, 
                    // but we can pass final chunks
                },
            });

            stopRecordingRef.current = async () => {
                await stop();
                setRecognizing(false);
            };

            // whisper.rn transcribes in chunks. Let's subscribe to the final transcript promise if needed, 
            // or handle interim if supported by realtime.
            subscribe((evt: any) => {
                if (evt.isCapturing) return; // ignore pure capture events
                const isFinal = evt.isStopped || !!evt.result;
                if (evt.result?.includes('[BLANK_AUDIO]')) return;

                onResult(evt.result || '', isFinal);
            });

        } catch (e) {
            console.error("Recording error:", e);
            setRecognizing(false);
        }
    }, []);

    const stopRecording = useCallback(async () => {
        if (stopRecordingRef.current) {
            await stopRecordingRef.current();
            stopRecordingRef.current = null;
        }
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
