import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  CalendarClock,
  ChevronRight,
  Filter,
  Images,
  LayoutDashboard,
  LogOut,
} from 'lucide-react-native';
import { useDrawer } from '../shared/components/AppDrawer';
import { useAuth } from '../navigation/AuthContext';
import type {
  AppStackParamList,
  MainStackParamList,
} from '../navigation/types';

interface Item {
  screen: keyof MainStackParamList;
  label: string;
  hint: string;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
}

const ITEMS: Item[] = [
  {
    screen: 'Home',
    label: 'Dashboard',
    hint: 'Overview & priorities',
    Icon: LayoutDashboard,
  },
  {
    screen: 'Requests',
    label: 'Leads Requests',
    hint: 'Filter & qualify leads',
    Icon: Filter,
  },
  {
    screen: 'FollowUps',
    label: 'Follow-ups',
    hint: 'Due, overdue & upcoming',
    Icon: CalendarClock,
  },
  {
    screen: 'CompanyMedia',
    label: 'Company Media',
    hint: 'Images, videos & PDFs',
    Icon: Images,
  },
];

interface Props {
  active: keyof MainStackParamList;
  onSignOut: () => void;
}

export function DrawerContent({ active, onSignOut }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { close } = useDrawer();
  const navigation =
    useNavigation<NativeStackNavigationProp<AppStackParamList>>();

  const goTo = (screen: keyof MainStackParamList) => {
    navigation.navigate('Main', { screen });
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
        style={{ paddingTop: insets.top + 20, paddingBottom: 22 }}>
        <View
          pointerEvents="none"
          className="absolute bg-primary-400 opacity-20 rounded-full"
          style={{ width: 190, height: 190, top: -90, right: -60 }}
        />

        <View className="px-5">
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
              <Text
                className="font-lato text-xs text-primary-300 mt-0.5"
                numberOfLines={1}>
                {user?.role ?? 'Franchise Employee'}
              </Text>
            </View>
          </View>

          {user?.email ? (
            <Text
              className="font-lato text-[11px] text-primary-400 mt-3"
              numberOfLines={1}>
              {user.email}
            </Text>
          ) : null}
        </View>
      </View>

      {/* ------------------------------ Items ----------------------------- */}
      <View className="px-3 pt-5 pb-2">
        <Text className="font-lato-bold text-[10px] uppercase tracking-[1px] text-neutral-600 px-2 mb-2">
          Sections
        </Text>

        {ITEMS.map(item => {
          const isActive = item.screen === active;
          const rowClass = isActive ? 'bg-primary-200' : '';
          const discClass = isActive ? 'bg-white' : 'bg-neutral-200';
          const iconColor = isActive ? '#5279AC' : '#8990A8';
          const labelClass = isActive ? 'text-primary-800' : 'text-neutral-900';

          return (
            <TouchableOpacity
              key={item.screen}
              activeOpacity={0.8}
              onPress={() => goTo(item.screen)}
              className={`flex-row items-center gap-3 rounded-2xl px-2 py-2.5 mb-1 ${rowClass}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={item.label}>
              <View
                className={`w-9 h-9 rounded-xl ${discClass} items-center justify-center`}>
                <item.Icon size={17} color={iconColor} />
              </View>

              <View className="flex-1">
                <Text className={`font-lato-bold text-sm ${labelClass}`}>
                  {item.label}
                </Text>
                <Text className="font-lato text-[11px] text-neutral-600 mt-0.5">
                  {item.hint}
                </Text>
              </View>

              {isActive ? (
                <View className="w-1.5 h-1.5 rounded-full bg-primary-700" />
              ) : (
                <ChevronRight size={14} color="#A3ABC4" />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <View className="flex-1" />

      {/* ----------------------------- Sign out --------------------------- */}
      <View className="px-4 pt-3 pb-1">
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
          className="font-lato text-[10px] text-neutral-500 text-center mt-3"
          style={{ marginBottom: Math.max(insets.bottom, 12) }}>
          Franchise Employee · v1.0
        </Text>
      </View>
    </View>
  );
}
