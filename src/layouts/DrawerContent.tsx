import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommonActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronRight, LogOut } from 'lucide-react-native';
import { useDrawer } from '../shared/components/AppDrawer';
import { useAuth } from '../navigation/AuthContext';
import {
  ALL_SIDEBAR_ENTRIES,
  GROUP_ORDER,
  type SidebarEntry,
} from '../navigation/modules';
import { P } from '../services/permissions';
import {
  fetchDashboardCached,
  type DashboardStats,
} from '../services/dashboardService';
import { fetchFollowupsBellCached } from '../services/followupsService';
import { logScreenEvent, markDrawerNavigation } from '../services/perfLogger';
import type {
  AppStackParamList,
  MainStackParamList,
} from '../navigation/types';

interface Props {
  active: keyof MainStackParamList;
  onSignOut: () => void;
}

/**
 * The drawer is generated from the module registry rather than a local list.
 *
 * Every section declares its own permission keys in `navigation/modules.ts`.
 * A section with no permitted key is never rendered, so the employee cannot
 * navigate into a screen whose first request would come back `403`.
 */
export function DrawerContent({ active, onSignOut }: Props) {
  const insets = useSafeAreaInsets();
  const { user, refreshProfile, isRefreshingProfile, can, canAny } = useAuth();
  const { close, isOpen } = useDrawer();
  const navigation =
    useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pendingFollowUps, setPendingFollowUps] = useState<number | null>(null);

  const canSeeDashboard = can(P.dashboardView);
  const canSeeFollowUps = can(P.followupsView);

  const entries = useMemo(
    () => ALL_SIDEBAR_ENTRIES.filter(entry => canAny(entry.view)),
    [canAny],
  );

  const grouped = useMemo(
    () =>
      GROUP_ORDER.map(group => ({
        group,
        items: entries.filter(entry => entry.group === group),
      })).filter(section => section.items.length > 0),
    [entries],
  );

  /**
   * The drawer opens after almost every navigation, so it must not start a
   * fresh `/auth/me` + `/dashboard` + `/followups/bell` burst each time. The
   * profile has its own tap-to-refresh action and is also refreshed on app
   * foreground; the counters and bell use short-lived shared caches.
   */
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    logScreenEvent('drawer opened');

    if (canSeeDashboard) {
      fetchDashboardCached()
        .then(setStats)
        .catch(() => {
          // Leave the last known counts on screen.
        });
    } else {
      setStats(null);
    }

    if (canSeeFollowUps) {
      fetchFollowupsBellCached()
        .then(bell => setPendingFollowUps(bell.count))
        .catch(() => {
          // A failed badge poll should not blank the row.
        });
    } else {
      setPendingFollowUps(null);
    }
  }, [canSeeDashboard, canSeeFollowUps, isOpen]);

  const goTo = (screen: SidebarEntry['screen']) => {
    if (screen === active) {
      close();
      return;
    }
    markDrawerNavigation(String(screen));
    /**
     * Reset the *inner* stack, not the root stack.
     *
     * Resetting the root remounts MainShell and its drawer, which costs seconds
     * and is visible in the logs as `module mounted` arriving before
     * `MainShell mounted`. Targeting the nested navigator keeps the shell alive
     * while still dropping previously visited screens, so the working set does
     * not grow.
     */
    const rootState = navigation.getState();
    const mainRoute = rootState.routes[rootState.index];
    const nestedKey = mainRoute?.state?.key;

    if (nestedKey) {
      logScreenEvent('nested reset dispatched', String(screen));
      navigation.dispatch({
        ...CommonActions.reset({
          index: 0,
          routes: [{ name: screen }],
        }),
        target: nestedKey,
      });
      logScreenEvent('nested reset returned', String(screen));
    } else {
      logScreenEvent('root navigate fallback', String(screen));
      navigation.navigate('Main', { screen });
    }
    close();
  };

  // Close first — the provider outlives MainShell, so an open drawer would
  // otherwise stay on screen over the login form after signing out.
  const handleSignOut = () => {
    close();
    onSignOut();
  };

  const initials = (user?.name ?? 'FE')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('');

  return (
    <View className="flex-1 bg-white">
      {/* ----------------------------- Profile ---------------------------- */}
      <View
        className="bg-primary-900 overflow-hidden"
        style={{ paddingTop: insets.top + 20, paddingBottom: 18 }}>
        <View
          pointerEvents="none"
          className="absolute bg-primary-400 opacity-20 rounded-full"
          style={{ width: 190, height: 190, top: -90, right: -60 }}
        />

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => void refreshProfile()}
          className="px-5"
          accessibilityRole="button"
          accessibilityLabel="Refresh profile">
          <View className="flex-row items-center gap-3">
            <View
              className="w-12 h-12 rounded-full items-center justify-center"
              style={{
                backgroundColor: 'rgba(255,255,255,0.14)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.28)',
              }}>
              <Text className="font-lato-black text-base text-white">
                {initials || 'FE'}
              </Text>
            </View>

            <View className="flex-1">
              <Text
                className="font-lato-black text-lg text-white"
                numberOfLines={1}>
                {user?.name ?? 'Franchise Employee'}
              </Text>
              <View className="flex-row items-center gap-2 mt-0.5">
                <Text
                  className="font-lato text-xs text-primary-300 flex-1"
                  numberOfLines={1}>
                  {user?.position ?? 'Franchise Employee'}
                </Text>
                {isRefreshingProfile ? (
                  <ActivityIndicator size="small" color="#A4C9FF" />
                ) : null}
              </View>
            </View>
          </View>

          {user?.email ? (
            <Text
              className="font-lato text-[11px] text-primary-400 mt-2"
              numberOfLines={1}>
              {user.email}
            </Text>
          ) : null}
        </TouchableOpacity>
      </View>

      {/* ------------------------------ Items ----------------------------- */}
      <ScrollView
        className="flex-1 px-3 pt-3"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 12 }}>
        {grouped.length === 0 ? (
          <View className="px-3 py-8">
            <Text className="font-lato-bold text-sm text-neutral-900 text-center">
              No sections available
            </Text>
            <Text className="font-lato text-xs text-neutral-600 text-center mt-1.5 leading-5">
              Your role does not include any app sections. Contact your
              administrator.
            </Text>
          </View>
        ) : (
          grouped.map(section => (
            <View key={section.group} className="mb-3">
              <Text className="font-lato-bold text-[10px] uppercase tracking-[1px] text-neutral-600 px-2 mb-1.5">
                {section.group}
              </Text>

              {section.items.map(item => {
                const isActive = item.screen === active;
                const rowClass = isActive ? 'bg-primary-200' : '';
                const discClass = isActive ? 'bg-white' : 'bg-neutral-200';
                const iconColor = isActive ? '#5279AC' : '#8990A8';
                const labelClass = isActive
                  ? 'text-primary-800'
                  : 'text-neutral-900';

                const count =
                  item.key === 'followups'
                    ? (pendingFollowUps ?? undefined)
                    : item.key === 'leads-filter' && stats
                      ? stats.requests
                      : item.key === 'company-media' && stats
                        ? stats.companies
                        : undefined;

                return (
                  <TouchableOpacity
                    key={item.key}
                    activeOpacity={0.8}
                    onPress={() => goTo(item.screen)}
                    className={`flex-row items-center gap-3 rounded-2xl px-2 py-2 mb-0.5 ${rowClass}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    accessibilityLabel={
                      count === undefined
                        ? item.label
                        : `${item.label}, ${count}`
                    }>
                    <View
                      className={`w-8 h-8 rounded-xl ${discClass} items-center justify-center`}>
                      <item.Icon size={16} color={iconColor} />
                    </View>

                    <View className="flex-1">
                      <Text className={`font-lato-bold text-sm ${labelClass}`}>
                        {item.label}
                      </Text>
                      <Text className="font-lato text-[10px] text-neutral-600 mt-0.5">
                        {item.hint}
                      </Text>
                    </View>

                    {count === undefined ? null : (
                      <View
                        className={`rounded-full px-2 py-0.5 ${isActive ? 'bg-white' : 'bg-neutral-200'
                          }`}>
                        <Text
                          className={`font-lato-bold text-[10px] ${isActive
                            ? 'text-primary-800'
                            : 'text-neutral-700'
                            }`}>
                          {count}
                        </Text>
                      </View>
                    )}

                    {isActive ? (
                      <View className="w-1.5 h-1.5 rounded-full bg-primary-700" />
                    ) : (
                      <ChevronRight size={13} color="#A3ABC4" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>

      {/* ----------------------------- Sign out --------------------------- */}
      <View className="px-4 pt-2 pb-1">
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleSignOut}
          className="flex-row items-center justify-center gap-2 rounded-2xl border border-neutral-200 py-3"
          accessibilityRole="button"
          accessibilityLabel="Sign out">
          <LogOut size={16} color="#5279AC" />
          <Text className="font-lato-bold text-sm text-primary-700">
            Sign out
          </Text>
        </TouchableOpacity>

        <Text
          className="font-lato text-[10px] text-neutral-500 text-center mt-2"
          style={{ marginBottom: Math.max(insets.bottom, 10) }}>
          Franchise Employee · v1.0
        </Text>
      </View>
    </View>
  );
}
