import React from 'react';
import { Text, View } from 'react-native';
import { Lock } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { Button } from './Button';
import { useAuth } from '../../navigation/AuthContext';
import type { PermissionKey } from '../../services/permissions';

interface GateProps {
  /** Access is allowed when any of these keys is present. */
  anyOf?: readonly PermissionKey[];
  /** Access is allowed only when every key is present. */
  allOf?: readonly PermissionKey[];
  children: React.ReactNode;
}

/**
 * Keeps a forbidden screen from mounting at all, so it cannot fire its first
 * fetch and turn a hidden sidebar item into a `403` from a deep link.
 */
export function PermissionGate({ anyOf, allOf, children }: GateProps) {
  const { canAny, canAll } = useAuth();

  const allowed =
    (!anyOf || anyOf.length === 0 || canAny(anyOf)) &&
    (!allOf || allOf.length === 0 || canAll(allOf));

  if (!allowed) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}

export function AccessDenied() {
  const navigation = useNavigation();

  return (
    <DashboardLayout
      title="No access"
      subtitle="Your role does not include this section"
      showMenu>
      <View className="items-center py-10 px-4">
        <View className="w-16 h-16 rounded-full bg-primary-200 items-center justify-center mb-4">
          <Lock size={28} color="#5279AC" />
        </View>
        <Text className="font-lato-bold text-lg text-neutral-900 text-center">
          You don&apos;t have access to this
        </Text>
        <Text className="font-lato text-sm text-neutral-600 text-center mt-2 leading-5">
          Ask your administrator if you need this permission added to your role.
        </Text>

        {navigation.canGoBack() ? (
          <Button
            title="Go back"
            size="lg"
            className="mt-6 w-full"
            onPress={() => navigation.goBack()}
          />
        ) : null}
      </View>
    </DashboardLayout>
  );
}
