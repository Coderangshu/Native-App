import { db } from '@/db';
import { meals } from '@/db/schema';
import { GeminiService } from '@/services/gemini';
import { storage } from '@/utils/storage';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { Button, H4, Image, Input, ScrollView, Spinner, Switch, Text, XStack, YStack } from 'tamagui';
import { useWhisperSTT } from '../utils/whisper';

// 1. Define a type for your analysis
interface MealAnalysis {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

export default function LogMealScreen() {
    // 2. Move ALL hooks to the top
    const params = useLocalSearchParams();
    const router = useRouter();

    const [imageUri, setImageUri] = useState<string | undefined>(params.imageUri as string);
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [analysis, setAnalysis] = useState<MealAnalysis | null>(null);
    const {
        isReady,
        recognizing,
        loadingMsg,
        modelType,
        initModel,
        startRecording,
        stopRecording
    } = useWhisperSTT();

    const [isSpeaking, setIsSpeaking] = useState(false);

    const [useSmallModel, setUseSmallModel] = useState(false);

    useEffect(() => {
        initModel(useSmallModel);
    }, [useSmallModel]);

    // 4. Add cleanup for unmounting
    useEffect(() => {
        return () => {
            Speech.stop();
            stopRecording();
        };
    }, []);

    // Helper Functions
    const speakAnalysis = () => {
        if (!analysis) return;

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

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 1,
        });

        if (!result.canceled) {
            setImageUri(result.assets[0].uri);
        }
    };

    const handleRecordToggle = async () => {
        if (recognizing) {
            await stopRecording();
        } else {
            await startRecording((text, isFinal) => {
                if (isFinal) {
                    setDescription(prev => (prev ? prev + " " + text : text));
                }
            });
        }
    };

    const analyzeMeal = async () => {
        setLoading(true);
        try {
            const storedKey = await storage.getItem('gemini_api_key');

            if (!storedKey) {
                Alert.alert('Missing API Key', 'Please set your Gemini API Key in Settings.');
                setLoading(false);
                return;
            }

            const service = new GeminiService(storedKey);
            const result = await service.analyzeMeal(imageUri, description);

            if (result.error) {
                Alert.alert('AI Error', result.error);
            } else {
                setAnalysis(result);
            }
        } catch (e) {
            Alert.alert('Error', 'Failed to analyze meal. Please try again.');
            console.error("Analyze Error:", e);
        } finally {
            setLoading(false);
        }
    };

    const saveMeal = async () => {
        if (!analysis) return;

        try {
            await db.insert(meals).values({
                name: analysis.name || 'Unknown Meal',
                calories: analysis.calories || 0,
                protein: analysis.protein || 0,
                carbs: analysis.carbs || 0,
                fat: analysis.fat || 0,
                imageUri: imageUri,
                transcription: description,
            });
            router.replace('/(tabs)');
        } catch (e) {
            Alert.alert('Error', 'Failed to save meal.');
            console.error(e);
        }
    };

    return (
        <ScrollView flex={1} backgroundColor="$background" contentContainerStyle={{ padding: 20 }}>
            <YStack gap="$4" paddingBottom="$8">
                <H4>Log Meal</H4>

                {!imageUri ? (
                    <YStack gap="$3" borderColor="$borderColor" borderWidth={1} borderRadius="$4" padding="$4" alignItems="center" justifyContent="center" height={200} backgroundColor="$color.gray2">
                        <Text color="$color.gray11">No image selected</Text>
                        <XStack gap="$3">
                            <Button onPress={() => router.push('/camera')} backgroundColor="$blue10">
                                Take Photo
                            </Button>
                            <Button onPress={pickImage} backgroundColor="$gray10">
                                Gallery
                            </Button>
                        </XStack>
                    </YStack>
                ) : (
                    <YStack gap="$2">
                        <Image source={{ uri: imageUri }} width="100%" height={300} borderRadius="$4" resizeMode="cover" />
                        <Button onPress={() => setImageUri(undefined)} size="$2" chromeless>Remove Image</Button>
                    </YStack>
                )}

                <YStack gap="$2">
                    <Text fontWeight="bold">Description (Text or Voice)</Text>
                    <Input
                        placeholder="Describe your meal (e.g. 'Grilled chicken with rice')..."
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                    />
                    <XStack alignItems="center" gap="$2" marginTop="$2" marginBottom="$2">
                        <Switch size="$3" checked={useSmallModel} onCheckedChange={setUseSmallModel}>
                            <Switch.Thumb />
                        </Switch>
                        <YStack>
                            <Text fontSize="$3">Use 'Small' Model (Slower, More Accurate)</Text>
                            <Text fontSize="$2" color="$color.gray11">Current: {modelType === 'small' ? 'Small' : 'Tiny.en (Faster, Less Accurate)'}</Text>
                        </YStack>
                    </XStack>

                    {loadingMsg ? (
                        <XStack gap="$2" alignItems="center" padding="$2" backgroundColor="$yellow4" borderRadius="$2">
                            <Spinner size="small" color="$yellow10" />
                            <Text color="$yellow11" fontSize="$3">{loadingMsg}</Text>
                        </XStack>
                    ) : (
                        <Button
                            backgroundColor={recognizing ? "$red10" : "$blue10"}
                            onPress={handleRecordToggle}
                            disabled={!isReady}
                            opacity={!isReady ? 0.5 : 1}
                        >
                            {recognizing ? 'Stop Recording' : 'Record Voice Description (Private AI)'}
                        </Button>
                    )}
                </YStack>

                <Button onPress={analyzeMeal} disabled={loading} icon={loading ? <Spinner /> : undefined} backgroundColor="$purple10" marginTop="$4">
                    {loading ? 'Analyzing...' : 'Analyze with AI'}
                </Button>

                {analysis && (
                    <YStack gap="$2" padding="$4" borderColor="$borderColor" borderWidth={1} borderRadius="$4">
                        <Text fontWeight="bold" fontSize="$5">{analysis.name}</Text>
                        <XStack justifyContent="space-between">
                            <Text>Calories: {analysis.calories}</Text>
                            <Text>P: {analysis.protein}g C: {analysis.carbs}g F: {analysis.fat}g</Text>
                        </XStack>

                        <XStack gap="$2" marginTop="$2">
                            <Button onPress={speakAnalysis} backgroundColor={isSpeaking ? "$orange10" : "$blue10"} flex={1}>
                                {isSpeaking ? 'Stop Speaking' : 'Read Aloud'}
                            </Button>
                            <Button onPress={saveMeal} backgroundColor="$green10" flex={1}>
                                Save Meal
                            </Button>
                        </XStack>
                    </YStack>
                )}
            </YStack>
        </ScrollView>
    );
}