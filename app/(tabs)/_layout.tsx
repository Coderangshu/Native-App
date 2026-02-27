import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, Pressable, useColorScheme } from 'react-native';

import Colors from '@/constants/Colors';
import { tabTransitionState } from '@/utils/tabTransition';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, XStack } from 'tamagui';

function CustomPillTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const tabRadius = 999;
  const activeRouteName = state.routes[state.index]?.name;

  if (activeRouteName === 'two') {
    return null;
  }

  return (
    <XStack
      position="absolute"
      bottom={Math.max(insets.bottom, Platform.OS === 'ios' ? 14 : 10)}
      left={12}
      right={12}
      justifyContent="center"
      alignItems="center"
    >
      <XStack
        backgroundColor="$blue10"
        borderRadius={tabRadius}
        shadowColor="black"
        shadowOffset={{ width: 0, height: 4 }}
        shadowOpacity={0.1}
        shadowRadius={10}
        elevation={5}
        width="100%"
        maxWidth={220}
        height={42}
      >
        <Pressable
          onPress={() => {
            tabTransitionState.fromSummaryToLog = true;
            navigation.navigate('two');
          }}
          style={{
            flex: 1,
            borderRadius: tabRadius,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text
            color="white"
            fontWeight="bold"
            fontSize="$3"
            numberOfLines={1}
          >
            Log Meal
          </Text>
        </Pressable>
      </XStack>
    </XStack>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      tabBar={(props) => <CustomPillTabBar {...props} />}
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          headerShown: false,
          title: 'Summary',
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          headerShown: false,
          title: 'Log Meal',
        }}
      />
    </Tabs>
  );
}
