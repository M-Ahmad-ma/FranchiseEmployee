import React, { useCallback, useMemo, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppDrawer } from '../shared/components/AppDrawer';
import { DrawerContent } from '../layouts/DrawerContent';
import { useAuth } from './AuthContext';
import type { MainStackParamList } from './types';
import { HomeScreen } from '../features/home/HomeScreen';
import { RequestsScreen } from '../features/requests/RequestsScreen';
import { FollowUpsScreen } from '../features/followUps/FollowUpsScreen';
import { CompanyMediaScreen } from '../features/companyMedia/CompanyMediaScreen';

const Stack = createNativeStackNavigator<MainStackParamList>();

/**
 * The signed-in area: the app's screens, wrapped in the sliding drawer.
 * The drawer sits above the whole stack so every screen — not just Home —
 * is reachable from it.
 *
 * React Navigation 7 navigators are plain function components and take no
 * `ref`, so the focused route is tracked with `screenListeners` and the
 * drawer navigates through the parent stack's nested params.
 */
export function MainShell() {
  const { signOut } = useAuth();
  const [active, setActive] = useState<keyof MainStackParamList>('Home');

  const reportActive = useCallback((name: string) => {
    setActive(name as keyof MainStackParamList);
  }, []);

  // Function form of screenListeners: it receives the focused route.
  const screenListeners = useMemo(
    () =>
      ({ route }: { route: { name: string } }) => ({
        focus: () => reportActive(route.name),
      }),
    [reportActive],
  );

  return (
    <AppDrawer drawer={<DrawerContent active={active} onSignOut={signOut} />}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
        screenListeners={screenListeners}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Requests" component={RequestsScreen} />
        <Stack.Screen name="FollowUps" component={FollowUpsScreen} />
        <Stack.Screen name="CompanyMedia" component={CompanyMediaScreen} />
      </Stack.Navigator>
    </AppDrawer>
  );
}
