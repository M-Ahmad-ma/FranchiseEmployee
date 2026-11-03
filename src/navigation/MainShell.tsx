import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useRoute } from '@react-navigation/native';
import { AppDrawer } from '../shared/components/AppDrawer';
import { DrawerContent } from '../layouts/DrawerContent';
import { PermissionGate } from '../shared/components/PermissionGate';
import { useAuth } from './AuthContext';
import type {
  MainStackParamList,
  ModuleRoute,
  RootStackParamList,
} from './types';
import { ALL_SIDEBAR_ENTRIES, MODULE_CONFIGS } from './modules';
import { P } from '../services/permissions';
import { logScreenEvent } from '../services/perfLogger';
import { HomeScreen } from '../features/home/HomeScreen';
import { RequestsScreen } from '../features/requests/RequestsScreen';
import { FollowUpsScreen } from '../features/followUps/FollowUpsScreen';
import { CompanyMediaScreen } from '../features/companyMedia/CompanyMediaScreen';
import { LeadDetailScreen } from '../features/leads/LeadDetailScreen';
import { ModuleScreen } from '../features/modules/ModuleScreen';
import { TasksScreen } from '../features/tasks/TasksScreen';
import { TaskDetailScreen } from '../features/tasks/TaskDetailScreen';
import { MeetingsScreen } from '../features/meetings/MeetingsScreen';
import { MeetingDetailScreen } from '../features/meetings/MeetingDetailScreen';

/**
 * The stack carries detail screens too, so it is typed from the full list —
 * `MainStackParamList` deliberately excludes detail routes to keep the drawer
 * from offering a screen with no entry of its own.
 */
const Stack = createNativeStackNavigator<RootStackParamList>();

const MODULE_ROUTES = Object.keys(MODULE_CONFIGS) as ModuleRoute[];

function GuardedModuleScreen() {
  const route = useRoute();
  const config = MODULE_CONFIGS[route.name as ModuleRoute];
  return (
    <PermissionGate anyOf={config?.view}>
      <ModuleScreen />
    </PermissionGate>
  );
}

function HomeSection() {
  return (
    <PermissionGate anyOf={[P.dashboardView]}>
      <HomeScreen />
    </PermissionGate>
  );
}

function RequestsSection() {
  return (
    <PermissionGate anyOf={[P.leadsView]}>
      <RequestsScreen />
    </PermissionGate>
  );
}

function FollowUpsSection() {
  return (
    <PermissionGate anyOf={[P.followupsView]}>
      <FollowUpsScreen />
    </PermissionGate>
  );
}

function CompanyMediaSection() {
  return (
    <PermissionGate anyOf={[P.companyMediaView]}>
      <CompanyMediaScreen />
    </PermissionGate>
  );
}

function TasksSection() {
  return (
    <PermissionGate anyOf={[P.tasksView]}>
      <TasksScreen />
    </PermissionGate>
  );
}

function MeetingsSection() {
  return (
    <PermissionGate anyOf={[P.meetingsView, P.brandsView]}>
      <MeetingsScreen />
    </PermissionGate>
  );
}

function TaskDetailSection() {
  return (
    <PermissionGate anyOf={[P.tasksView]}>
      <TaskDetailScreen />
    </PermissionGate>
  );
}

function MeetingDetailSection() {
  return (
    <PermissionGate anyOf={[P.meetingsView]}>
      <MeetingDetailScreen />
    </PermissionGate>
  );
}

function LeadDetailSection() {
  return (
    <PermissionGate anyOf={[P.leadsList]}>
      <LeadDetailScreen />
    </PermissionGate>
  );
}

/**
 * The signed-in area: the app's screens, wrapped in the sliding drawer.
 * The drawer sits above the whole stack so every screen — not just Home —
 * is reachable from it.
 */
export function MainShell() {
  const { signOut, canAny } = useAuth();
  const initialScreen = useMemo<keyof MainStackParamList>(() => {
    const first = ALL_SIDEBAR_ENTRIES.find(entry => canAny(entry.view));
    return (first?.screen ?? 'Home') as keyof MainStackParamList;
  }, [canAny]);

  const [active, setActive] =
    useState<keyof MainStackParamList>(initialScreen);

  useEffect(() => {
    logScreenEvent('MainShell mounted', `initial=${initialScreen}`);
  }, [initialScreen]);

  const reportActive = useCallback((name: string) => {
    logScreenEvent(`focus ${name}`);
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

  /**
   * Detail screens keep the section they were opened from highlighted, because
   * they have no drawer entry of their own.
   */
  const detailListeners = useMemo(
    () => (parent: keyof MainStackParamList) => () => ({
      focus: () => reportActive(parent),
    }),
    [reportActive],
  );

  return (
    <AppDrawer drawer={<DrawerContent active={active} onSignOut={signOut} />}>
      <Stack.Navigator
        initialRouteName={initialScreen}
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
        screenListeners={screenListeners}>
        <Stack.Screen name="Home" component={HomeSection} />
        <Stack.Screen name="Requests" component={RequestsSection} />
        <Stack.Screen name="FollowUps" component={FollowUpsSection} />
        <Stack.Screen name="CompanyMedia" component={CompanyMediaSection} />
        <Stack.Screen name="Tasks" component={TasksSection} />
        <Stack.Screen name="Meetings" component={MeetingsSection} />

        {MODULE_ROUTES.map(route => (
          <Stack.Screen
            key={route}
            name={route}
            component={GuardedModuleScreen}
          />
        ))}

        <Stack.Screen
          name="TaskDetail"
          component={TaskDetailSection}
          listeners={detailListeners('Tasks')}
        />
        <Stack.Screen
          name="MeetingDetail"
          component={MeetingDetailSection}
          listeners={detailListeners('Meetings')}
        />
        <Stack.Screen
          name="LeadDetail"
          component={LeadDetailSection}
          options={{ animation: 'slide_from_right' }}
          listeners={detailListeners('Requests')}
        />
      </Stack.Navigator>
    </AppDrawer>
  );
}
