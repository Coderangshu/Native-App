import { storage } from '@/utils/storage';
// import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { Button, H4, Input, Label, Switch, Text, XStack, YStack } from 'tamagui';

export default function SettingsScreen() {
    const [apiKey, setApiKey] = useState('');
    const [isDarkMode, setIsDarkMode] = useState(true); // TODO: sync with global state

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        const key = await storage.getItem('gemini_api_key');
        if (key) setApiKey(key);
    };

    const saveSettings = async () => {
        try {
            if (apiKey.trim()) { // Don't save empty strings accidentally clearing it unless intended
                await storage.setItem('gemini_api_key', apiKey);
                Alert.alert('Success', 'API Key saved successfully!');
            } else {
                // await SecureStore.deleteItemAsync('gemini_api_key'); 
                // Storage util doesn't have delete yet, just set empty
                await storage.setItem('gemini_api_key', '');
                Alert.alert('Success', 'API Key removed.');
            }
        } catch (e) {
            Alert.alert('Error', 'Failed to save settings.');
        }
    };

    return (
        <YStack flex={1} padding="$4" gap="$4" backgroundColor="$background">
            <H4>Settings</H4>

            <YStack gap="$2">
                <Label>Gemini API Key</Label>
                <Input
                    value={apiKey}
                    onChangeText={setApiKey}
                    placeholder="Enter your Gemini API Key"
                    secureTextEntry
                />
                <Text fontSize="$2" color="$color.gray10">
                    Get your free key from Google AI Studio.
                </Text>
            </YStack>

            <XStack alignItems="center" justifyContent="space-between">
                <Label>Dark Mode</Label>
                <Switch checked={isDarkMode} onCheckedChange={setIsDarkMode}>
                    <Switch.Thumb />
                </Switch>
            </XStack>

            <Button onPress={saveSettings} backgroundColor="$blue10">
                <Text color="white">Save Settings</Text>
            </Button>
        </YStack>
    );
}
