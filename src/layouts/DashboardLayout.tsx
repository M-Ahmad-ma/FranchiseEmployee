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
import { ArrowLeft, Menu } from 'lucide-react-native';
import { useDrawer } from '../shared/components/AppDrawer';

const circleButton =
  'w-10 h-10 rounded-full border border-neutral-200 bg-white items-center justify-center';

interface Props {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  /** Shows a button that opens the app drawer, ahead of the back arrow. */
  showMenu?: boolean;
  children: React.ReactNode;
}

export function DashboardLayout({
  title,
  subtitle,
  showBack = true,
  showMenu = false,
  children,
}: Props) {
  const insets = useSafeAreaInsets();
  const { open } = useDrawer();
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
            <View className="flex-row items-center gap-3">
              {showMenu && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={open}
                  className={circleButton}
                  accessibilityRole="button"
                  accessibilityLabel="Open navigation">
                  <Menu size={20} color="#3F465C" />
                </TouchableOpacity>
              )}

              {/* {canGoBack && ( */}
              {/*   <TouchableOpacity */}
              {/*     activeOpacity={0.8} */}
              {/*     onPress={() => navigation.goBack()} */}
              {/*     className={circleButton} */}
              {/*     accessibilityRole="button" */}
              {/*     accessibilityLabel="Go back"> */}
              {/*     <ArrowLeft size={20} color="#3F465C" /> */}
              {/*   </TouchableOpacity> */}
              {/* )} */}

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
