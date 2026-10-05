import React from 'react';
import {
  DefaultTheme,
  LinkingOptions,
  NavigationContainer,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AppStackParamList } from './types';
import { AuthProvider, useAuth } from './AuthContext';
import { MainShell } from './MainShell';
import { LoginScreen } from '../features/auth/LoginScreen';
import { AppDrawerProvider } from '../shared/components/AppDrawer';

const Stack = createNativeStackNavigator<AppStackParamList>();

const linking: LinkingOptions<AppStackParamList> = {
  prefixes: [],
  config: {
    screens: {
      Login: 'login',
      Main: {
        screens: {
          Home: '',
          Requests: 'requests',
          FollowUps: 'follow-ups',
          CompanyMedia: 'company-media',
        },
      },
    },
  },
};

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#FAF8FF',
    card: '#FFFFFF',
    text: '#3F465C',
    primary: '#5279AC',
    border: '#EEF0FF',
  },
};

function AppNavigator() {
  const { isSignedIn } = useAuth();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}>
      {isSignedIn ? (
        <Stack.Screen
          name="Main"
          component={MainShell}
          options={{ animation: 'fade' }}
        />
      ) : (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ animation: 'fade' }}
        />
      )}
    </Stack.Navigator>
  );
}

export function RootNavigator() {
  return (
    <AuthProvider>
      <AppDrawerProvider>
        <NavigationContainer linking={linking} theme={navTheme}>
          <AppNavigator />
        </NavigationContainer>
      </AppDrawerProvider>
    </AuthProvider>
  );
}
