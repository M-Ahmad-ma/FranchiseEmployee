import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CalendarClock, ChevronRight, Filter, Images } from 'lucide-react-native';
import type { RootStackParamList } from '../../navigation/types';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { Card } from '../../shared/components/Card';

const SECTIONS: {
  title: string;
  subtitle: string;
  screen: keyof RootStackParamList;
  icon: React.ReactNode;
}[] = [
  {
    title: 'Filter Leads Requests',
    subtitle: 'Filter leads requests by various criteria',
    screen: 'Requests',
    icon: <Filter size={20} color="#5279AC" />,
  },
  {
    title: 'Follow-ups',
    subtitle: 'Scheduled lead follow-ups',
    screen: 'FollowUps',
    icon: <CalendarClock size={20} color="#5279AC" />,
  },
  {
    title: 'Company Media',
    subtitle: 'Images, videos, PDFs & locations for companies',
    screen: 'CompanyMedia',
    icon: <Images size={20} color="#5279AC" />,
  },
];

export function HomeScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <DashboardLayout
      title="Home"
      subtitle="Dashboard sections"
      showBack={false}>
      {SECTIONS.map(section => (
        <Card key={section.screen} className="bg-white rounded-2xl mb-3">
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate(section.screen)}
            className="flex-row items-center gap-3 px-4 py-4"
            accessibilityRole="button">
            <View className="w-10 h-10 rounded-full bg-primary-200 items-center justify-center">
              {section.icon}
            </View>
            <View className="flex-1">
              <Text className="font-lato-bold text-base text-neutral-900">
                {section.title}
              </Text>
              <Text className="font-lato text-xs text-neutral-700 mt-0.5">
                {section.subtitle}
              </Text>
            </View>
            <ChevronRight size={18} color="#8990A8" />
          </TouchableOpacity>
        </Card>
      ))}
    </DashboardLayout>
  );
}
