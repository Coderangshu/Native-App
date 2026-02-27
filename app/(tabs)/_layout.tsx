import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, Pressable } from 'react-native';

import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Text, XStack } from 'tamagui';

function CustomPillTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <XStack
      position="absolute"
      bottom={Platform.OS === 'ios' ? 30 : 20}
      left={0}
      right={0}
      justifyContent="center"
      alignItems="center"
    >
      <XStack
        backgroundColor="$background"
        borderRadius="$10"
        padding="$2"
        shadowColor="black"
        shadowOffset={{ width: 0, height: 4 }}
        shadowOpacity={0.1}
        shadowRadius={10}
        elevation={5}
        gap="$2"
        borderWidth={1}
        borderColor="$borderColor"
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];

          let label = options.title !== undefined ? options.title : route.name;
          if (route.name === 'index') label = 'Summary';
          if (route.name === 'two') label = 'Log Meal';

          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable key={route.key} onPress={onPress}>
              <XStack
                paddingHorizontal="$4"
                paddingVertical="$2"
                borderRadius="$10"
                backgroundColor={isFocused ? "$blue10" : "transparent"}
              >
                <Text color={isFocused ? "white" : "$color"} fontWeight={isFocused ? "bold" : "normal"}>
                  {label as string}
                </Text>
              </XStack>
            </Pressable>
          );
        })}
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
        headerShown: useClientOnlyValue(false, true),
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
