import React from 'react';
import {
  DefaultTheme,
  LinkingOptions,
  NavigationContainer,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { HomeScreen } from '../features/home/HomeScreen';
import { RequestsScreen } from '../features/requests/RequestsScreen';
import { FollowUpsScreen } from '../features/followUps/FollowUpsScreen';
import { CompanyMediaScreen } from '../features/companyMedia/CompanyMediaScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [],
  config: {
    screens: {
      Home: '',
      Requests: 'requests',
      FollowUps: 'follow-ups',
      CompanyMedia: 'company-media',
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

export function RootNavigator() {
  return (
    <NavigationContainer linking={linking} theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Requests" component={RequestsScreen} />
        <Stack.Screen name="FollowUps" component={FollowUpsScreen} />
        <Stack.Screen name="CompanyMedia" component={CompanyMediaScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
