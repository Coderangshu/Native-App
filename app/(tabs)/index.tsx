import { db } from '@/db';
import { meals } from '@/db/schema';
import { useQuery } from '@tanstack/react-query';
import { desc } from 'drizzle-orm';
import { useRouter } from 'expo-router';
import { Image } from 'react-native';
import { Button, Card, H2, H4, ScrollView, Text, XStack, YStack } from 'tamagui';

export default function Dashboard() {
  const router = useRouter();

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
    <ScrollView flex={1} backgroundColor="$background">
      <YStack padding="$4" gap="$4" safeArea>
        <H2>Today's Summary</H2>

        <Card borderColor="$borderColor" borderWidth={1} padding="$4">
          <H4>Calories: 1200 / 2000</H4>
          <XStack gap="$2" marginTop="$2">
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

        <Button
          onPress={() => router.push('/log')}
          backgroundColor="$blue10"
          color="white"
          size="$5"
          marginTop="$4"
        >
          Log Meal
        </Button>

        <Button
          onPress={() => router.push('/settings')}
          backgroundColor="$gray10"
          color="white"
          marginTop="$4"
        >
          Settings
        </Button>
      </YStack>
    </ScrollView>
  );
}
