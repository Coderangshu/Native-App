import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

export function useSpeechRecognition() {
    const [recognizing, setRecognizing] = useState(false);
    const [loadingMsg, setLoadingMsg] = useState('');

    // We store the user's latest callback so we can stream transcriptions into the UI
    const [onResultCallback, setOnResultCallback] = useState<((text: string, isFinal: boolean) => void) | null>(null);

    // Listen to real-time speech events
    useSpeechRecognitionEvent('start', () => {
        setRecognizing(true);
        setLoadingMsg('');
    });

    useSpeechRecognitionEvent('end', () => {
        setRecognizing(false);
    });

    useSpeechRecognitionEvent('error', (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error !== 'no-speech') {
            Alert.alert('Speech Error', event.error);
        }
        setRecognizing(false);
    });

    useSpeechRecognitionEvent('result', (event) => {
        // Find the best transcription result
        const transcript = event.results[0]?.transcript;
        if (transcript && onResultCallback) {
            onResultCallback(transcript, event.isFinal);
        }
    });

    const startRecording = useCallback(async (onResult: (text: string, isFinal: boolean) => void) => {
        try {
            setOnResultCallback(() => onResult);

            const hasPermission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
            if (!hasPermission.granted) {
                Alert.alert('Permission Denied', 'Speech recognition permission is required to dictate.');
                return;
            }

            // Start recognizing using OS-level models
            await ExpoSpeechRecognitionModule.start({
                lang: 'en-US',
                interimResults: true,      // Essential for real-time text streaming
                maxAlternatives: 1,
                continuous: true,
                requiresOnDeviceRecognition: false, // Allow Apple/Google cloud fallback for maximum accuracy and speed
            });

        } catch (e: any) {
            console.error("Failed to start speech recognition:", e);
            Alert.alert("Error", "Could not start recording.");
            setRecognizing(false);
        }
    }, []);

    const stopRecording = useCallback(async () => {
        try {
            await ExpoSpeechRecognitionModule.stop();
        } catch (e) {
            console.error("Failed to stop speech recognition:", e);
        } finally {
            setRecognizing(false);
        }
    }, []);

    return {
        // Expose a consistent API surface similar to the former hook
        isReady: true, // Native speech is always ready instantly
        recognizing,
        loadingMsg,
        startRecording,
        stopRecording
    };
}
