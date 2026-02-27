import { db } from '@/db';
import { meals } from '@/db/schema';
import { GeminiService } from '@/services/gemini';
import { useSpeechRecognition } from '@/utils/speech';
import { storage } from '@/utils/storage';
import { Check, ChevronDown, Mic, MicOff, Plus, Save, Send } from '@tamagui/lucide-icons';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import React, { useEffect, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, KeyboardAvoidingView, Platform, Image as RNImage } from 'react-native';
import { Button, Input, ScrollView, Select, Spinner, Text, XStack, YStack } from 'tamagui';

interface MealAnalysis {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

interface ChatMessage {
    id: string;
    role: 'user' | 'ai';
    text?: string;
    images?: string[];
    analysis?: MealAnalysis;
    isLoading?: boolean;
}

export default function ChatInterface() {
    const router = useRouter();
    const scrollViewRef = useRef<ScrollView>(null);

    // Chat State
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    // Input State
    const [imageUris, setImageUris] = useState<string[]>([]);
    const [inputText, setInputText] = useState('');
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [aiModel, setAiModel] = useState('gemini-2.5-flash');

    const {
        recognizing,
        loadingMsg,
        startRecording,
        stopRecording
    } = useSpeechRecognition();

    useEffect(() => {
        return () => {
            Speech.stop();
            stopRecording();
        };
    }, []);

    // Auto-scroll on new message
    useEffect(() => {
        setTimeout(() => {
            // @ts-ignore
            scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
    }, [messages, imageUris]);

    // Helpers
    const speakAnalysis = (analysis: MealAnalysis) => {
        const textToSpeak = `This is ${analysis.name}. It contains ${analysis.calories} calories, ${analysis.protein} grams of protein, ${analysis.carbs} grams of carbs, and ${analysis.fat} grams of fat.`;

        if (isSpeaking) {
            Speech.stop();
            setIsSpeaking(false);
        } else {
            setIsSpeaking(true);
            Speech.speak(textToSpeak, {
                onDone: () => setIsSpeaking(false),
                onStopped: () => setIsSpeaking(false),
                onError: () => setIsSpeaking(false),
            });
        }
    };

    const pickImageGallery = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 1,
        });

        if (!result.canceled) {
            setImageUris(prev => [...prev, result.assets[0].uri]);
        }
    };

    const pickImageCamera = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Camera access is required to take photos.');
            return;
        }

        let result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 1,
        });

        if (!result.canceled) {
            setImageUris(prev => [...prev, result.assets[0].uri]);
        }
    };

    const handleAddPhoto = () => {
        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: ['Cancel', 'Take Photo', 'Choose from Gallery'],
                    cancelButtonIndex: 0,
                },
                (buttonIndex) => {
                    if (buttonIndex === 1) {
                        pickImageCamera();
                    } else if (buttonIndex === 2) {
                        pickImageGallery();
                    }
                }
            );
        } else if (Platform.OS === 'web') {
            const useCamera = window.confirm('Click OK to Take Photo, or Cancel to open Gallery');
            if (useCamera) {
                pickImageCamera();
            } else {
                pickImageGallery();
            }
        } else {
            Alert.alert(
                'Add Photo',
                'Choose a photo source',
                [
                    { text: 'Take Photo', onPress: pickImageCamera },
                    { text: 'Gallery', onPress: pickImageGallery },
                    { text: 'Cancel', style: 'cancel' }
                ]
            );
        }
    };

    const handleRecordToggle = async () => {
        if (recognizing) {
            await stopRecording();
        } else {
            await startRecording((text, isFinal) => {
                if (isFinal) {
                    setInputText(prev => (prev ? prev + " " + text : text));
                }
            });
        }
    };

    const handleRateLimitHit = (currentModel: string) => {
        const fallbackModel = currentModel === 'gemini-2.5-flash'
            ? 'gemini-2.5-flash-lite'
            : 'gemini-2.5-flash';

        Alert.alert(
            'AI Model Limit Reached 🚦',
            `You have hit the usage limit for ${currentModel}. Would you like to switch to ${fallbackModel} and try again?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Switch & Retry',
                    onPress: () => {
                        setAiModel(fallbackModel);
                        handleSend(fallbackModel);
                    }
                }
            ]
        );
    };

    const handleSend = async (modelOverride?: string) => {
        if (inputText.trim() === '' && imageUris.length === 0) return;

        const currentText = inputText;
        const currentImages = [...imageUris];

        // Add to Chat
        const userMsgId = Date.now().toString();
        setMessages(prev => [...prev, {
            id: userMsgId,
            role: 'user',
            text: currentText,
            images: currentImages,
        }]);

        // Add loading AI msg
        const aiMsgId = (Date.now() + 1).toString();
        setMessages(prev => [...prev, {
            id: aiMsgId,
            role: 'ai',
            isLoading: true,
        }]);

        setInputText('');
        setImageUris([]);

        try {
            const storedKey = await storage.getItem('gemini_api_key');

            if (!storedKey) {
                Alert.alert('Missing API Key', 'Please set your Gemini API Key in Settings.');
                // Remove loading msg
                setMessages(prev => prev.filter(m => m.id !== aiMsgId));
                return;
            }

            const activeModel = typeof modelOverride === 'string' ? modelOverride : aiModel;
            const service = new GeminiService(storedKey);

            // Send the first image to Gemini since it accepts a single URI parameter currently
            const result = await service.analyzeMeal(currentImages[0], currentText, activeModel);

            setMessages(prev => prev.map(m => {
                if (m.id === aiMsgId) {
                    if (result.error) {
                        return { ...m, isLoading: false, text: "AI Error: " + result.error };
                    }
                    return { ...m, isLoading: false, analysis: result as MealAnalysis };
                }
                return m;
            }));

        } catch (e: any) {
            // Remove loading msg and show error
            setMessages(prev => prev.filter(m => m.id !== aiMsgId));

            if (e?.name === 'QuotaExceededError') {
                const activeModel = typeof modelOverride === 'string' ? modelOverride : aiModel;
                handleRateLimitHit(activeModel);
            } else {
                Alert.alert('Error', 'Failed to analyze meal. Please try again.');
            }
            console.error("Analyze Error:", e);
        }
    };

    const saveMeal = async (analysis: MealAnalysis, transcription: string, images: string[]) => {
        try {
            await db.insert(meals).values({
                name: analysis.name || 'Unknown Meal',
                calories: analysis.calories || 0,
                protein: analysis.protein || 0,
                carbs: analysis.carbs || 0,
                fat: analysis.fat || 0,
                transcription: transcription || 'Logged via Chat',
            });

            for (const uri of images) {
                try {
                    if (uri.startsWith('file://')) {
                        await FileSystem.deleteAsync(uri, { idempotent: true });
                    }
                } catch (cleanupError) {
                    console.error("Failed to delete cached image:", uri, cleanupError);
                }
            }

            router.replace('/(tabs)');
        } catch (e) {
            Alert.alert('Error', 'Failed to save meal.');
            console.error(e);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1, backgroundColor: '#ffffff' }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
        >
            <YStack flex={1} backgroundColor="#ffffff" paddingBottom={Platform.OS === 'ios' ? 110 : 90}>
                {/* Header (Top) */}
                <XStack padding="$4" justifyContent="center" alignItems="center" backgroundColor="#ffffff" borderBottomWidth={1} borderColor="#eeeeee">
                    <Text fontSize={18} fontWeight="bold" color="#333333">AI Analyst</Text>
                </XStack>

                {/* Chat Feed */}
                <ScrollView ref={scrollViewRef} flex={1} contentContainerStyle={{ padding: 16 }}>
                    <YStack gap="$4">
                        {messages.length === 0 && (
                            <YStack alignItems="center" justifyContent="center" marginTop="$10" opacity={0.5}>
                                <Text fontSize="$5" color="#333333">What did you eat today?</Text>
                                <Text fontSize="$3" marginTop="$2" color="#666666">Send a photo or describe your meal.</Text>
                            </YStack>
                        )}

                        {messages.map((msg) => (
                            <YStack key={msg.id} alignSelf={msg.role === 'user' ? 'flex-end' : 'flex-start'} maxWidth="85%" gap="$2">
                                <YStack
                                    backgroundColor={msg.role === 'user' ? '#e8f0fe' : '#ffffff'}
                                    padding="$3"
                                    borderRadius="$4"
                                    borderTopRightRadius={msg.role === 'user' ? 4 : '$4'}
                                    borderTopLeftRadius={msg.role === 'ai' ? 4 : '$4'}
                                    borderWidth={msg.role === 'ai' ? 1 : 0}
                                    borderColor="#eeeeee"
                                >
                                    {msg.images && msg.images.length > 0 && (
                                        <XStack flexWrap="wrap" gap="$2" marginBottom={msg.text ? "$2" : "$0"}>
                                            {msg.images.map((uri, idx) => (
                                                <RNImage key={idx} source={{ uri }} style={{ width: 100, height: 100, borderRadius: 8 }} />
                                            ))}
                                        </XStack>
                                    )}

                                    {msg.text && <Text color="#333333" fontSize="$4">{msg.text}</Text>}

                                    {msg.isLoading && (
                                        <XStack alignItems="center" gap="$2">
                                            <Spinner size="small" color="#1a73e8" />
                                            <Text fontStyle="italic" color="#666666">Analyzing...</Text>
                                        </XStack>
                                    )}

                                    {msg.analysis && (
                                        <YStack gap="$2" marginTop="$2">
                                            <Text fontWeight="bold" fontSize="$5" color="#333333">{msg.analysis.name}</Text>
                                            <XStack justifyContent="space-between" paddingBottom="$2" borderBottomWidth={1} borderColor="#eeeeee">
                                                <Text color="#333333">Calories: {msg.analysis.calories}</Text>
                                            </XStack>
                                            <Text fontSize="$3" color="#666666">P: {msg.analysis.protein}g | C: {msg.analysis.carbs}g | F: {msg.analysis.fat}g</Text>

                                            <XStack gap="$2" marginTop="$4">
                                                <Button size="$3" flex={1} onPress={() => speakAnalysis(msg.analysis!)} backgroundColor={isSpeaking ? "#fbbc04" : "#f1f3f4"}>
                                                    <Text color="#333333">{isSpeaking ? 'Stop' : 'Read'}</Text>
                                                </Button>
                                                <Button size="$3" flex={2} icon={Save} onPress={() => {
                                                    const userMsgIdx = messages.findIndex(m => m.id === msg.id) - 1;
                                                    const userMsg = userMsgIdx >= 0 ? messages[userMsgIdx] : null;
                                                    saveMeal(msg.analysis!, userMsg?.text || '', userMsg?.images || []);
                                                }} backgroundColor="#34a853">
                                                    <Text color="#ffffff">Save Meal</Text>
                                                </Button>
                                            </XStack>
                                        </YStack>
                                    )}
                                </YStack>
                            </YStack>
                        ))}
                    </YStack>
                </ScrollView>

                {/* Input Area (Bottom) styled perfectly like Gemini UI */}
                <YStack paddingHorizontal={16} paddingBottom={8} backgroundColor="#ffffff">
                    <YStack backgroundColor="#f0f4f9" borderRadius={24} padding={12}>

                        {/* Image Previews */}
                        {imageUris.length > 0 && (
                            <XStack gap="$2" paddingBottom={8}>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    {imageUris.map((uri, index) => (
                                        <YStack key={index} marginRight="$2" position="relative">
                                            <RNImage source={{ uri }} style={{ width: 60, height: 60, borderRadius: 8 }} />
                                            <Button
                                                size="$1" circular backgroundColor="#ea4335" position="absolute" top={-5} right={-5}
                                                onPress={() => setImageUris(prev => prev.filter((_, i) => i !== index))}
                                            >
                                                <Text color="white" fontSize={10}>X</Text>
                                            </Button>
                                        </YStack>
                                    ))}
                                </ScrollView>
                            </XStack>
                        )}

                        <Input
                            borderWidth={0}
                            backgroundColor="transparent"
                            placeholder={recognizing ? "Listening..." : "Ask Gemini 3"}
                            placeholderTextColor="$gray10"
                            color="#202124"
                            value={inputText}
                            onChangeText={setInputText}
                            size="$5"
                            fontSize={16}
                            paddingHorizontal={4}
                            paddingTop={0}
                            paddingBottom={16}
                            multiline
                            maxHeight={120}
                            focusStyle={{ outlineWidth: 0, borderWidth: 0 }}
                        />

                        <XStack justifyContent="space-between" alignItems="center">
                            {/* Left tools */}
                            <XStack alignItems="center">
                                <Button circular size="$3" backgroundColor="transparent" icon={<Plus color="#444746" size={24} />} onPress={handleAddPhoto} hoverStyle={{ backgroundColor: '#e5e7eb' }} />
                            </XStack>

                            {/* Right tools (Model Selector, Mic, Send) */}
                            <XStack gap={8} alignItems="center">
                                <Select value={aiModel} onValueChange={setAiModel} disablePreventBodyScroll>
                                    <Select.Trigger minWidth={80} iconAfter={<ChevronDown size={14} color="#444746" />} size="$3" backgroundColor="transparent" borderWidth={0} padding={0} justifyContent="flex-end" hoverStyle={{ backgroundColor: 'transparent' }} focusStyle={{ outlineWidth: 0, borderWidth: 0 }}>
                                        <Select.Value placeholder="Model">
                                            <Text color="#444746" fontSize={14}>{aiModel === 'gemini-2.5-flash' ? 'Fast' : 'Lite'}</Text>
                                        </Select.Value>
                                    </Select.Trigger>
                                    <Select.Content zIndex={200000}>
                                        <Select.ScrollUpButton alignItems="center" justifyContent="center" position="relative" width="100%" height="$3"><ChevronDown size={20} /></Select.ScrollUpButton>
                                        <Select.Viewport minWidth={200} backgroundColor="#ffffff">
                                            <Select.Group>
                                                <Select.Label color="#5f6368">Gemini Models</Select.Label>
                                                <Select.Item index={0} value="gemini-2.5-flash">
                                                    <Select.ItemText color="#202124">Fast (Flash)</Select.ItemText>
                                                    <Select.ItemIndicator marginLeft="auto"><Check size={16} color="#1a73e8" /></Select.ItemIndicator>
                                                </Select.Item>
                                                <Select.Item index={1} value="gemini-2.5-flash-lite">
                                                    <Select.ItemText color="#202124">Lite (Flash Lite)</Select.ItemText>
                                                    <Select.ItemIndicator marginLeft="auto"><Check size={16} color="#1a73e8" /></Select.ItemIndicator>
                                                </Select.Item>
                                            </Select.Group>
                                        </Select.Viewport>
                                        <Select.ScrollDownButton alignItems="center" justifyContent="center" position="relative" width="100%" height="$3"><ChevronDown size={20} /></Select.ScrollDownButton>
                                    </Select.Content>
                                </Select>

                                <Button
                                    circular size="$3"
                                    backgroundColor={recognizing ? "#ea4335" : "transparent"}
                                    icon={recognizing ? <MicOff color="#ffffff" size={20} /> : <Mic size={20} color="#444746" />}
                                    onPress={handleRecordToggle}
                                    hoverStyle={{ backgroundColor: recognizing ? '#d93025' : '#e5e7eb' }}
                                />

                                {(inputText.trim() !== '' || imageUris.length > 0) && (
                                    <Button
                                        circular size="$3"
                                        backgroundColor="#1a73e8"
                                        icon={<Send color="#ffffff" size={16} />}
                                        onPress={() => handleSend()}
                                        hoverStyle={{ backgroundColor: '#1557b0' }}
                                    />
                                )}
                            </XStack>
                        </XStack>
                    </YStack>
                </YStack>
            </YStack>
        </KeyboardAvoidingView>
    );
}
