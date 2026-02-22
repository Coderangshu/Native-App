
// Attempt to load the native module safely
let NativeModule: any = null;
try {
    NativeModule = require('expo-speech-recognition').ExpoSpeechRecognitionModule;
} catch (e) {
    // Module not found (e.g., Expo Go)
    console.log("Speech Recognition not available (Native Module missing)", e);
}

// Check availability securely
const isNativeAvailable = !!NativeModule && typeof NativeModule.start === 'function';

// Safe Export of the Module
export const ExpoSpeechRecognitionModule = isNativeAvailable ? NativeModule : {
    start: () => console.warn("Speech Recognition not available (Native Module missing)"),
    stop: () => { },
    abort: () => { },
    requestPermissionsAsync: async () => ({ status: 'denied', granted: false, canAskAgain: false, expires: 'never' }),
    getPermissionsAsync: async () => ({ status: 'denied', granted: false, canAskAgain: false, expires: 'never' }),
    isRecognitionAvailable: () => false,
    supportsOnDeviceRecognition: () => false,
    supportsRecording: () => false,
    addListener: () => ({ remove: () => { } }),
    removeAllListeners: () => { },
};

// Safe Export of the Hook
export function useSpeechRecognitionEvent(eventName: string, listener: (event: any) => void) {
    if (isNativeAvailable) {
        try {
            // Dynamically require to avoid import errors if package is in weird state
            const { useSpeechRecognitionEvent: originalHook } = require('expo-speech-recognition');
            return originalHook(eventName, listener);
        } catch (e) {
            console.warn("Failed to load useSpeechRecognitionEvent:", e);
        }
    }
    // No-op if not available
}
