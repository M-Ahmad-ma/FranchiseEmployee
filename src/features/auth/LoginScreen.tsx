import React, { useCallback, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Eye, EyeOff, ShieldCheck, Store } from 'lucide-react-native';
import { useAuth } from '../../navigation/AuthContext';
import { isValidEmail, MIN_PASSWORD_LENGTH } from '../../services/authService';
import { Button } from '../../shared/components/Button';
import { Card } from '../../shared/components/Card';
import { TextField } from '../../shared/components/TextField';

const styles = StyleSheet.create({
  panel: {
    backgroundColor: '#1C4878',
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#A4C9FF',
  },
  blobTop: {
    width: 240,
    height: 240,
    top: -140,
    right: -80,
    opacity: 0.18,
  },
  blobBottom: {
    width: 200,
    height: 200,
    bottom: -130,
    left: -60,
    opacity: 0.14,
  },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
});

export function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const passwordRef = useRef<React.ComponentRef<typeof TextInput> | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = useCallback(() => {
    const next: { email?: string; password?: string } = {};
    if (!email.trim()) {
      next.email = 'Email is required.';
    } else if (!isValidEmail(email)) {
      next.email = 'Enter a valid email address.';
    }
    if (!password) {
      next.password = 'Password is required.';
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      next.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [email, password]);

  const submit = useCallback(async () => {
    setFormError(null);
    if (!validate()) {
      return;
    }
    setLoading(true);
    try {
      await signIn({ email, password });
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }, [email, password, signIn, validate]);

  return (
    <View className="flex-1 bg-light">
      <StatusBar barStyle="light-content" />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}>
          {/* ---------------------------- Brand panel --------------------------- */}
          <View
            style={[
              styles.panel,
              { paddingTop: insets.top + 36, paddingBottom: 56 },
            ]}>
            <View pointerEvents="none" style={[styles.blob, styles.blobTop]} />
            <View
              pointerEvents="none"
              style={[styles.blob, styles.blobBottom]}
            />

            <View className="px-6">
              <View style={styles.logo}>
                <Store size={24} color="#FFFFFF" />
              </View>

              <Text className="font-lato-black text-3xl text-white mt-6">
                Welcome back
              </Text>
              <Text className="font-lato text-sm text-primary-300 mt-2 leading-5">
                Sign in to your Franchise Employee workspace.
              </Text>
            </View>
          </View>

          {/* ------------------------------ Form ------------------------------- */}
          <View style={{ marginTop: -36 }} className="px-4">
            <Card className="bg-white rounded-3xl p-5">
              <Text className="font-lato-black text-xl text-neutral-900">
                Sign in
              </Text>
              <Text className="font-lato text-xs text-neutral-600 mt-1">
                Use your company email to continue.
              </Text>

              {formError ? (
                <View className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mt-4">
                  <Text className="font-lato text-sm text-red-500 leading-5">
                    {formError}
                  </Text>
                </View>
              ) : null}

              <View className="mt-5">
                <TextField
                  testID="login-email"
                  label="Email"
                  required
                  value={email}
                  onChangeText={text => {
                    setEmail(text);
                    if (errors.email) {
                      setErrors(prev => ({ ...prev, email: undefined }));
                    }
                  }}
                  placeholder="you@company.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="emailAddress"
                  returnKeyType="next"
                  error={errors.email}
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />

                <TextField
                  testID="login-password"
                  inputRef={passwordRef}
                  label="Password"
                  required
                  value={password}
                  onChangeText={text => {
                    setPassword(text);
                    if (errors.password) {
                      setErrors(prev => ({ ...prev, password: undefined }));
                    }
                  }}
                  placeholder="••••••••"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                  returnKeyType="go"
                  error={errors.password}
                  onSubmitEditing={submit}
                  rightSlot={
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => setShowPassword(prev => !prev)}
                      accessibilityRole="button"
                      accessibilityLabel={
                        showPassword ? 'Hide password' : 'Show password'
                      }>
                      {showPassword ? (
                        <EyeOff size={18} color="#8990A8" />
                      ) : (
                        <Eye size={18} color="#8990A8" />
                      )}
                    </TouchableOpacity>
                  }
                />
              </View>

              <Button
                title="Sign in"
                size="lg"
                className="mt-1"
                loading={loading}
                testID="login-submit"
                onPress={submit}
              />

              <Text className="font-lato text-[11px] text-neutral-600 text-center leading-4 mt-4">
                Demo build — any valid email and a {MIN_PASSWORD_LENGTH}+
                character password will sign you in.
              </Text>
            </Card>
          </View>

          {/* ------------------------------ Footer ----------------------------- */}
          <View className="flex-row items-center justify-center gap-1.5 mt-6">
            <ShieldCheck size={14} color="#A3ABC4" />
            <Text className="font-lato text-[11px] text-neutral-500">
              Protected workspace · Franchise Employee
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
