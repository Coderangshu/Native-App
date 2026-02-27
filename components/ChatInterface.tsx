import { db } from '@/db';
import { meals } from '@/db/schema';
import { GeminiService } from '@/services/gemini';
import { useSpeechRecognition } from '@/utils/speech';
import { storage } from '@/utils/storage';
import { tabTransitionState } from '@/utils/tabTransition';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft, Check, ChevronDown, ChevronUp, Mic, MicOff, Plus, Save, Send } from '@tamagui/lucide-icons';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, Animated, Easing, Platform, Image as RNImage, useWindowDimensions } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Adapt, Button, Input, Popover, ScrollView, Select, Sheet, Spinner, Text, XStack, YStack, useTheme } from 'tamagui';

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
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const isSmallScreen = width < 380;
    const theme = useTheme();

    // Chat State
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    // Input State
    const [imageUris, setImageUris] = useState<string[]>([]);
    const [inputText, setInputText] = useState('');
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [aiModel, setAiModel] = useState('gemini-2.5-flash');
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [isBackTransitioning, setIsBackTransitioning] = useState(false);
    const hasDraft = inputText.trim() !== '' || imageUris.length > 0;
    const lastToggleTime = useRef(0);

    let modelLabel = 'Fast';
    if (aiModel === 'gemini-2.5-flash-lite') modelLabel = 'Thinking';
    if (aiModel === 'gemini-1.5-pro') modelLabel = 'Pro';

    const backMorph = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.98)).current;

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

    useFocusEffect(
        useCallback(() => {
            let animation: Animated.CompositeAnimation | undefined;

            if (tabTransitionState.fromSummaryToLog) {
                backMorph.setValue(0);
                animation = Animated.timing(backMorph, {
                    toValue: 1,
                    duration: 250,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: false,
                });

                animation.start(() => {
                    tabTransitionState.fromSummaryToLog = false;
                });
            } else {
                backMorph.setValue(1);
            }

            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 150,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 1,
                    duration: 150,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true,
                })
            ]).start();

            return () => {
                animation?.stop();
                fadeAnim.setValue(0);
                scaleAnim.setValue(0.98);
            };
        }, [backMorph, fadeAnim, scaleAnim])
    );

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

    const handleBackToSummary = () => {
        if (isBackTransitioning) return;

        setIsBackTransitioning(true);
        Animated.parallel([
            Animated.timing(backMorph, {
                toValue: 0,
                duration: 250,
                easing: Easing.inOut(Easing.cubic),
                useNativeDriver: false,
            }),
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 150,
                easing: Easing.in(Easing.quad),
                useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
                toValue: 0.98,
                duration: 150,
                easing: Easing.in(Easing.quad),
                useNativeDriver: true,
            })
        ]).start(() => {
            tabTransitionState.fromSummaryToLog = false;
            router.replace('/(tabs)');
            setIsBackTransitioning(false);
        });
    };

    const pillWidth = Math.min(width - 24, 220);
    const pillTargetX = (width / 2) - (pillWidth / 2) - 24;
    const pillTargetY = 12;

    const backWidth = backMorph.interpolate({
        inputRange: [0, 1],
        outputRange: [pillWidth, 42],
    });

    const backTranslateX = backMorph.interpolate({
        inputRange: [0, 1],
        outputRange: [pillTargetX, 0],
    });

    const backTranslateY = backMorph.interpolate({
        inputRange: [0, 1],
        outputRange: [pillTargetY, 0],
    });

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
            behavior="padding"
            keyboardVerticalOffset={0}
            enabled={Platform.OS !== 'web'}
            style={{ flex: 1, backgroundColor: theme.background.val }}
        >
            <YStack flex={1}>
                <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
                    <YStack flex={1} backgroundColor="$background">
                        {/* Header (Top) */}
                        <XStack padding="$4" paddingTop={Math.max(insets.top, 8)} justifyContent="center" alignItems="center" backgroundColor="$background" borderBottomWidth={1} borderColor="$borderColor">
                            <Text fontSize={18} fontWeight="bold" color="$color">AI Analyst</Text>
                        </XStack>

                        {/* Chat Feed */}
                        <ScrollView
                            ref={scrollViewRef}
                            flex={1}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="on-drag"
                            contentContainerStyle={{ padding: 16, paddingBottom: 18 }}
                        >
                            <YStack gap="$4">
                                {messages.length === 0 && (
                                    <YStack alignItems="center" justifyContent="center" marginTop="$10" opacity={0.5}>
                                        <Text fontSize="$5" color="$color">What did you eat today?</Text>
                                        <Text fontSize="$3" marginTop="$2" color="$gray10">Send a photo or describe your meal.</Text>
                                    </YStack>
                                )}

                                {messages.map((msg) => (
                                    <YStack key={msg.id} alignSelf={msg.role === 'user' ? 'flex-end' : 'flex-start'} maxWidth={isSmallScreen ? "92%" : "85%"} gap="$2">
                                        <YStack
                                            backgroundColor={msg.role === 'user' ? '$blue5' : '$background'}
                                            padding="$3"
                                            borderRadius="$4"
                                            borderTopRightRadius={msg.role === 'user' ? 4 : '$4'}
                                            borderTopLeftRadius={msg.role === 'ai' ? 4 : '$4'}
                                            borderWidth={msg.role === 'ai' ? 1 : 0}
                                            borderColor="$borderColor"
                                        >
                                            {msg.images && msg.images.length > 0 && (
                                                <XStack flexWrap="wrap" gap="$2" marginBottom={msg.text ? "$2" : "$0"}>
                                                    {msg.images.map((uri, idx) => (
                                                        <RNImage
                                                            key={idx}
                                                            source={{ uri }}
                                                            style={{
                                                                width: isSmallScreen ? 84 : 100,
                                                                height: isSmallScreen ? 84 : 100,
                                                                borderRadius: 8
                                                            }}
                                                        />
                                                    ))}
                                                </XStack>
                                            )}

                                            {msg.text && <Text color={msg.role === 'user' ? '$blue11' : '$color'} fontSize="$4">{msg.text}</Text>}

                                            {msg.isLoading && (
                                                <XStack alignItems="center" gap="$2">
                                                    <Spinner size="small" color="$blue9" />
                                                    <Text fontStyle="italic" color="$gray10">Analyzing...</Text>
                                                </XStack>
                                            )}

                                            {msg.analysis && (
                                                <YStack gap="$2" marginTop="$2">
                                                    <Text fontWeight="bold" fontSize="$5" color="$color">{msg.analysis.name}</Text>
                                                    <XStack justifyContent="space-between" paddingBottom="$2" borderBottomWidth={1} borderColor="$borderColor">
                                                        <Text color="$color">Calories: {msg.analysis.calories}</Text>
                                                    </XStack>
                                                    <Text fontSize="$3" color="$gray10">P: {msg.analysis.protein}g | C: {msg.analysis.carbs}g | F: {msg.analysis.fat}g</Text>

                                                    <XStack gap="$2" marginTop="$4">
                                                        <Button size="$3" flex={1} onPress={() => speakAnalysis(msg.analysis!)} backgroundColor={isSpeaking ? "$orange8" : "$gray5"}>
                                                            <Text color="$color">{isSpeaking ? 'Stop' : 'Read'}</Text>
                                                        </Button>
                                                        <Button size="$3" flex={2} icon={Save} onPress={() => {
                                                            const userMsgIdx = messages.findIndex(m => m.id === msg.id) - 1;
                                                            const userMsg = userMsgIdx >= 0 ? messages[userMsgIdx] : null;
                                                            saveMeal(msg.analysis!, userMsg?.text || '', userMsg?.images || []);
                                                        }} backgroundColor="$green8">
                                                            <Text color="white">Save Meal</Text>
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
                        <YStack paddingHorizontal={12} backgroundColor="$background" paddingBottom={insets.bottom > 0 ? insets.bottom : 8} >
                            <YStack backgroundColor="$gray3" borderRadius={28} padding={12}>

                                {/* Image Previews */}
                                {imageUris.length > 0 && (
                                    <XStack gap="$2" paddingBottom={8}>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                            {imageUris.map((uri, index) => (
                                                <YStack key={index} marginRight="$2" position="relative">
                                                    <RNImage source={{ uri }} style={{ width: 60, height: 60, borderRadius: 8 }} />
                                                    <Button
                                                        size="$1" circular backgroundColor="$red9" position="absolute" top={-5} right={-5}
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
                                    color="$color"
                                    value={inputText}
                                    onChangeText={setInputText}
                                    size="$5"
                                    fontSize={16}
                                    paddingHorizontal={4}
                                    paddingTop={0}
                                    paddingBottom={10}
                                    multiline
                                    maxHeight={120}
                                    focusStyle={{ outlineWidth: 0, borderWidth: 0 }}
                                />

                                <XStack alignItems="center" gap="$2">
                                    <XStack width={42} height={42} />

                                    <Button
                                        circular
                                        size="$3"
                                        width={42}
                                        height={42}
                                        backgroundColor="transparent"
                                        icon={<Plus color="$gray10" size={24} />}
                                        onPress={handleAddPhoto}
                                        hoverStyle={{ backgroundColor: '$gray5' }}
                                        disabled={isBackTransitioning}
                                        zIndex={1}
                                    />

                                    <XStack flex={1} />

                                    <XStack gap="$2" alignItems="center" flexShrink={0}>
                                        <YStack width={Platform.OS === 'web' ? (isSmallScreen ? 108 : 132) : undefined}>
                                            {Platform.OS === 'web' ? (
                                                <Popover
                                                    placement="top-end"
                                                    open={popoverOpen}
                                                    onOpenChange={(isOpen) => {
                                                        const now = Date.now();
                                                        if (now - lastToggleTime.current > 200) {
                                                            setPopoverOpen(isOpen);
                                                            lastToggleTime.current = now;
                                                        }
                                                    }}
                                                    allowFlip
                                                >
                                                    <Popover.Trigger asChild>
                                                        <Button
                                                            width="100%"
                                                            height={42}
                                                            iconAfter={popoverOpen ? <ChevronUp size={14} color="$gray10" /> : <ChevronDown size={14} color="$gray10" />}
                                                            size="$3"
                                                            backgroundColor="$gray4"
                                                            borderWidth={0}
                                                            borderRadius={999}
                                                            paddingHorizontal={16}
                                                            justifyContent="center"
                                                            hoverStyle={{ backgroundColor: '$gray5' }}
                                                        >
                                                            <Text color="$color" fontSize={15} fontWeight="600">{modelLabel}</Text>
                                                        </Button>
                                                    </Popover.Trigger>

                                                    {/* Note we give it a subtle animation and drop shadow similar to target */}
                                                    <Popover.Content
                                                        borderWidth={1}
                                                        borderColor="$borderColor"
                                                        backgroundColor="$gray3"
                                                        borderRadius={20}
                                                        padding="$0"
                                                        elevation={20}
                                                        minWidth={280}
                                                        shadowColor="#000"
                                                        shadowOpacity={0.3}
                                                        shadowRadius={24}
                                                        shadowOffset={{ width: 0, height: 10 }}
                                                    >
                                                        <YStack paddingBottom="$2" paddingTop="$2">
                                                            <Text color="$gray10" paddingHorizontal="$4" paddingTop="$2" paddingBottom="$3" fontSize={14}>Gemini 3</Text>

                                                            <XStack
                                                                paddingHorizontal="$4"
                                                                paddingVertical="$3"
                                                                onPress={() => { setAiModel('gemini-2.5-flash'); setPopoverOpen(false); }}
                                                                backgroundColor={aiModel === 'gemini-2.5-flash' ? '$gray4' : 'transparent'}
                                                                hoverStyle={{ backgroundColor: '$gray5' }}
                                                                alignItems="center"
                                                            >
                                                                <YStack flex={1}>
                                                                    <Text color="$color" fontSize={16} fontWeight={aiModel === 'gemini-2.5-flash' ? "600" : "500"}>Fast</Text>
                                                                    <Text color="$gray10" fontSize={13} marginTop="$1">Answers quickly</Text>
                                                                </YStack>
                                                                {aiModel === 'gemini-2.5-flash' && <Check size={18} color="$blue10" />}
                                                            </XStack>

                                                            <XStack
                                                                paddingHorizontal="$4"
                                                                paddingVertical="$3"
                                                                onPress={() => { setAiModel('gemini-2.5-flash-lite'); setPopoverOpen(false); }}
                                                                backgroundColor={aiModel === 'gemini-2.5-flash-lite' ? '$gray4' : 'transparent'}
                                                                hoverStyle={{ backgroundColor: '$gray5' }}
                                                                alignItems="center"
                                                            >
                                                                <YStack flex={1}>
                                                                    <Text color="$color" fontSize={16} fontWeight={aiModel === 'gemini-2.5-flash-lite' ? "600" : "500"}>Thinking</Text>
                                                                    <Text color="$gray10" fontSize={13} marginTop="$1">Solves complex problems</Text>
                                                                </YStack>
                                                                {aiModel === 'gemini-2.5-flash-lite' && <Check size={18} color="$blue10" />}
                                                            </XStack>

                                                            <XStack
                                                                paddingHorizontal="$4"
                                                                paddingVertical="$3"
                                                                onPress={() => { setAiModel('gemini-1.5-pro'); setPopoverOpen(false); }}
                                                                backgroundColor={aiModel === 'gemini-1.5-pro' ? '$gray4' : 'transparent'}
                                                                hoverStyle={{ backgroundColor: '$gray5' }}
                                                                alignItems="center"
                                                            >
                                                                <YStack flex={1}>
                                                                    <Text color="$color" fontSize={16} fontWeight={aiModel === 'gemini-1.5-pro' ? "600" : "500"}>Pro</Text>
                                                                    <Text color="$gray10" fontSize={13} marginTop="$1">Advanced math and code with 1.5 Pro</Text>
                                                                </YStack>
                                                                {aiModel === 'gemini-1.5-pro' && <Check size={18} color="$blue10" />}
                                                            </XStack>
                                                        </YStack>
                                                    </Popover.Content>
                                                </Popover>
                                            ) : (
                                                <Select value={aiModel} onValueChange={setAiModel} disablePreventBodyScroll>
                                                    <Select.Trigger
                                                        height={38}
                                                        size="$3"
                                                        backgroundColor="$gray4"
                                                        borderWidth={0}
                                                        borderRadius={999}
                                                        paddingHorizontal={16}
                                                        justifyContent="center"
                                                        focusStyle={{ outlineWidth: 0, borderWidth: 0 }}
                                                    >
                                                        <Select.Value placeholder="Model">
                                                            <Text color="$color" fontSize={15} fontWeight="600">{modelLabel}</Text>
                                                        </Select.Value>
                                                    </Select.Trigger>

                                                    <Adapt when="sm" platform="touch">
                                                        <Sheet modal dismissOnSnapToBottom snapPointsMode="fit">
                                                            <Sheet.Overlay backgroundColor="rgba(0,0,0,0.5)" />
                                                            <Sheet.Frame padding="$4" paddingBottom="$8" borderTopLeftRadius={28} borderTopRightRadius={28} backgroundColor="$gray3">
                                                                <YStack alignItems="center" marginBottom="$2">
                                                                    <Sheet.Handle backgroundColor="$gray8" width={40} />
                                                                </YStack>
                                                                <Adapt.Contents />
                                                            </Sheet.Frame>
                                                        </Sheet>
                                                    </Adapt>

                                                    <Select.Content zIndex={200000}>
                                                        <Select.Viewport minWidth={260}>
                                                            <Select.Group>
                                                                <Select.Label color="$gray10" paddingTop="$0" paddingBottom="$4" fontSize={14}>Gemini 3</Select.Label>
                                                                <Select.Item index={0} value="gemini-2.5-flash" paddingVertical="$3">
                                                                    <YStack flex={1}>
                                                                        <Select.ItemText color="$color" fontSize={16} fontWeight={aiModel === 'gemini-2.5-flash' ? "600" : "500"}>Fast</Select.ItemText>
                                                                        <Text fontSize={13} color="$gray10" marginTop="$1">Answers quickly</Text>
                                                                    </YStack>
                                                                    {aiModel === 'gemini-2.5-flash' && <Select.ItemIndicator marginLeft="auto"><Check size={20} color="$blue10" /></Select.ItemIndicator>}
                                                                </Select.Item>
                                                                <Select.Item index={1} value="gemini-2.5-flash-lite" paddingVertical="$3">
                                                                    <YStack flex={1}>
                                                                        <Select.ItemText color="$color" fontSize={16} fontWeight={aiModel === 'gemini-2.5-flash-lite' ? "600" : "500"}>Thinking</Select.ItemText>
                                                                        <Text fontSize={13} color="$gray10" marginTop="$1">Solves complex problems</Text>
                                                                    </YStack>
                                                                    {aiModel === 'gemini-2.5-flash-lite' && <Select.ItemIndicator marginLeft="auto"><Check size={20} color="$blue10" /></Select.ItemIndicator>}
                                                                </Select.Item>
                                                                <Select.Item index={2} value="gemini-1.5-pro" paddingVertical="$3">
                                                                    <YStack flex={1}>
                                                                        <Select.ItemText color="$color" fontSize={16} fontWeight={aiModel === 'gemini-1.5-pro' ? "600" : "500"}>Pro</Select.ItemText>
                                                                        <Text fontSize={13} color="$gray10" marginTop="$1">Advanced math and code with 1.5 Pro</Text>
                                                                    </YStack>
                                                                    {aiModel === 'gemini-1.5-pro' && <Select.ItemIndicator marginLeft="auto"><Check size={20} color="$blue10" /></Select.ItemIndicator>}
                                                                </Select.Item>
                                                            </Select.Group>
                                                        </Select.Viewport>
                                                    </Select.Content>
                                                </Select>
                                            )}
                                        </YStack>

                                        {hasDraft ? (
                                            <Button
                                                circular
                                                size="$3"
                                                width={42}
                                                height={42}
                                                backgroundColor="$blue10"
                                                icon={<Send color="white" size={16} />}
                                                onPress={() => handleSend()}
                                                hoverStyle={{ backgroundColor: '$blue11' }}
                                            />
                                        ) : (
                                            <Button
                                                circular
                                                size="$3"
                                                width={42}
                                                height={42}
                                                backgroundColor={recognizing ? "$red8" : "transparent"}
                                                icon={recognizing ? <MicOff color="white" size={20} /> : <Mic size={20} color="$gray10" />}
                                                onPress={handleRecordToggle}
                                                hoverStyle={{ backgroundColor: recognizing ? '$red9' : '$gray5' }}
                                            />
                                        )}
                                    </XStack>
                                </XStack>
                            </YStack>
                        </YStack>
                    </YStack>
                </Animated.View>

                {/* Float the morphing back button above the entire fading screen */}
                <Animated.View
                    style={{
                        position: 'absolute',
                        left: 24,
                        bottom: (insets.bottom > 0 ? insets.bottom : 8) + 12,
                        width: backWidth,
                        height: 42,
                        transform: [{ translateX: backTranslateX }, { translateY: backTranslateY }],
                        zIndex: 1000,
                        elevation: 10,
                    }}
                >
                    <Button
                        size="$3"
                        width="100%"
                        height={42}
                        borderRadius={999}
                        backgroundColor="$blue10"
                        justifyContent="center"
                        onPress={handleBackToSummary}
                        pressStyle={{ opacity: 0.9 }}
                        disabled={isBackTransitioning}
                    >
                        <ArrowLeft color="white" size={20} />
                    </Button>
                </Animated.View>
            </YStack>
        </KeyboardAvoidingView>
    );
}
