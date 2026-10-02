import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft } from 'lucide-react-native';
import { Breadcrumbs, type Crumb } from '../shared/components/Breadcrumbs';

interface Props {
  title: string;
  subtitle?: string;
  breadcrumbs?: Crumb[];
  showBack?: boolean;
  children: React.ReactNode;
}

export function DashboardLayout({
  title,
  subtitle,
  breadcrumbs,
  showBack = true,
  children,
}: Props) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const canGoBack = showBack && navigation.canGoBack();

  return (
    <View className="flex-1 bg-light" style={{ paddingTop: insets.top }}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}>
          <View className="px-4 pt-4">
            {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
            <View
              className={`flex-row items-center gap-3 ${
                breadcrumbs ? 'mt-2' : ''
              }`}>
              {canGoBack && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => navigation.goBack()}
                  className="w-10 h-10 rounded-full border border-neutral-200 bg-white items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel="Go back">
                  <ArrowLeft size={20} color="#3F465C" />
                </TouchableOpacity>
              )}
              <View className="flex-1">
                <Text className="text-neutral-900 text-2xl font-lato-black">
                  {title}
                </Text>
                {subtitle && (
                  <Text className="font-lato text-sm text-neutral-600 mt-1">
                    {subtitle}
                  </Text>
                )}
              </View>
            </View>
          </View>
          <View className="px-4 pt-6">{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
