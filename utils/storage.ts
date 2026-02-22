import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const storage = {
    async getItem(key: string) {
        if (Platform.OS === 'web') {
            return localStorage.getItem(key);
        }
        return await SecureStore.getItemAsync(key);
    },
    async setItem(key: string, value: string) {
        if (Platform.OS === 'web') {
            localStorage.setItem(key, value);
            return;
        }
        await SecureStore.setItemAsync(key, value);
    },
};
