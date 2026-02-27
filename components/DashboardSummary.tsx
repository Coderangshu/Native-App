import { db } from '@/db';
import { meals } from '@/db/schema';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { desc } from 'drizzle-orm';
import { useRouter } from 'expo-router';
import { useCallback, useRef } from 'react';
import { Animated, Easing, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, H2, H4, ScrollView, Text, XStack, YStack } from 'tamagui';

export default function DashboardSummary() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const fadeAnim = useRef(new Animated.Value(0)).current;

    useFocusEffect(
        useCallback(() => {
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 150,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
            }).start();

            return () => {
                fadeAnim.setValue(0);
            };
        }, [fadeAnim])
    );

    // Fetch recent meals
    const { data: recentMeals, isLoading } = useQuery({
        queryKey: ['meals'],
        queryFn: async () => {
            try {
                return await db.select().from(meals).orderBy(desc(meals.createdAt)).limit(5);
            } catch (e) {
                console.error(e);
                return [];
            }
        },
    });

    return (
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
            <ScrollView flex={1} backgroundColor="$background">
                <YStack padding="$4" gap="$4" paddingTop={Math.max(insets.top, 16)}>
                    <H2>Today's Summary</H2>

                    <Card borderColor="$borderColor" borderWidth={1} padding="$4">
                        <H4>Calories: 1200 / 2000</H4>
                        <XStack gap="$2" marginTop="$2" flexWrap="wrap">
                            <Text>Protein: 80g</Text>
                            <Text>Carbs: 150g</Text>
                            <Text>Fat: 40g</Text>
                        </XStack>
                    </Card>

                    <H4>Recent Meals</H4>
                    {isLoading ? (
                        <Text>Loading...</Text>
                    ) : !recentMeals || recentMeals.length === 0 ? (
                        <Text>No meals logged yet.</Text>
                    ) : (
                        recentMeals.map((meal) => (
                            <Card key={meal.id} borderColor="$borderColor" borderWidth={1} padding="$3" marginBottom="$3">
                                <XStack gap="$3" alignItems="center">
                                    {meal.imageUri && (
                                        <Image source={{ uri: meal.imageUri }} style={{ width: 50, height: 50, borderRadius: 8 }} />
                                    )}
                                    <YStack flex={1}>
                                        <Text fontWeight="bold">{meal.name}</Text>
                                        <Text fontSize="$3" color="$color.gray10">{meal.calories} kcal</Text>
                                    </YStack>
                                </XStack>
                            </Card>
                        ))
                    )}

                    {/* Removed Log Meal Button since it's on Tab 2 now */}
                    <Button
                        onPress={() => router.push('/settings')}
                        backgroundColor="$gray10"
                        marginTop="$4"
                    >
                        <Text color="white">Settings</Text>
                    </Button>
                </YStack>
            </ScrollView>
        </Animated.View>
    );
}
