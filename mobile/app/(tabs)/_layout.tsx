import React from 'react';
import { Tabs } from 'expo-router';
import { Eye, Clock, UserCheck, Settings } from 'lucide-react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/context/AuthContext';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { profile } = useAuth();
  const isDoctor = profile?.role === 'clinician';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontFamily: 'PlusJakartaSans_500Medium',
          fontSize: 11,
        },
        headerStyle: {
          backgroundColor: theme.surface,
          borderBottomColor: theme.border,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          fontFamily: 'PlusJakartaSans_700Bold',
          fontSize: 18,
          color: theme.text,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Eye Screening',
          tabBarLabel: 'Screening',
          tabBarIcon: ({ color, size }) => <Eye size={size || 22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Scan History',
          tabBarLabel: 'History',
          tabBarIcon: ({ color, size }) => <Clock size={size || 22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="clinicians"
        options={{
          title: isDoctor ? 'Patient Consultations' : 'Clinician Access',
          tabBarLabel: isDoctor ? 'Consultations' : 'Clinicians',
          tabBarIcon: ({ color, size }) => <UserCheck size={size || 22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Settings & Privacy',
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings size={size || 22} color={color} />,
        }}
      />
      {/* Hide default boilerplate screen */}
      <Tabs.Screen
        name="two"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
