import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Eye, EyeOff, Lock, Mail, User, ShieldAlert, CheckCircle } from 'lucide-react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/context/AuthContext';

export default function RegisterScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { signUp } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'patient' | 'clinician'>('patient');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const validate = () => {
    if (!fullName.trim()) {
      setErrorMessage('Please enter your full legal or patient name.');
      return false;
    }
    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMessage('Please enter a valid email address.');
      return false;
    }
    if (!password) {
      setErrorMessage('Please create a secure password.');
      return false;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return false;
    }
    setErrorMessage(null);
    return true;
  };

  const handleRegister = async () => {
    if (!validate()) return;

    setLoading(true);
    setErrorMessage(null);

    const { error, data } = await signUp(email, password, fullName, role);

    setLoading(false);

    if (error) {
      setErrorMessage(error.message || 'Registration failed.');
    } else {
      // Check if email confirmation is required
      if (data?.session) {
        // Automatically logged in
        router.replace('/(tabs)');
      } else {
        // Confirmation email sent
        Alert.alert(
          'Registration Successful',
          'Your account has been created. If email verification is enabled on your system, please verify your email before logging in.',
          [{ text: 'Continue to Sign In', onPress: () => router.replace('/(auth)/login') }]
        );
      }
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Header Branding */}
        <View style={styles.headerBox}>
          <View style={[styles.logoBadge, { backgroundColor: '#E0F2FE' }]}>
            <Text style={[styles.badgeText, { color: theme.primary }]}>PATIENT & CLINICIAN ONBOARDING</Text>
          </View>
          <Text style={[styles.title, { color: theme.text }]}>Create Account</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            Join the automated clinical screening portal to record and track longitudinal retinal evaluations.
          </Text>
        </View>

        {/* Error Banner */}
        {errorMessage && (
          <View style={[styles.errorBanner, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
            <ShieldAlert size={18} color="#DC2626" />
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        )}

        {/* Form Card */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
          {/* Account Role Selector */}
          <Text style={[styles.inputLabel, { color: theme.text }]}>Select Account Type</Text>
          <View style={styles.roleToggleGroup}>
            <TouchableOpacity
              style={[
                styles.roleBtn,
                role === 'patient' && { backgroundColor: theme.primary },
              ]}
              onPress={() => setRole('patient')}
            >
              <Text
                style={[
                  styles.roleBtnText,
                  { color: role === 'patient' ? '#FFFFFF' : theme.textMuted },
                ]}
              >
                Patient
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.roleBtn,
                role === 'clinician' && { backgroundColor: theme.primary },
              ]}
              onPress={() => setRole('clinician')}
            >
              <Text
                style={[
                  styles.roleBtnText,
                  { color: role === 'clinician' ? '#FFFFFF' : theme.textMuted },
                ]}
              >
                Doctor / Clinician
              </Text>
            </TouchableOpacity>
          </View>

          {/* Full Name */}
          <Text style={[styles.inputLabel, { color: theme.text }]}>Full Name</Text>
          <View style={[styles.inputRow, { borderColor: theme.border, backgroundColor: theme.background }]}>
            <User size={18} color={theme.textMuted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="e.g. Jane Doe"
              placeholderTextColor={theme.textMuted}
              value={fullName}
              onChangeText={(text) => {
                setFullName(text);
                if (errorMessage) setErrorMessage(null);
              }}
            />
          </View>

          {/* Email Input */}
          <Text style={[styles.inputLabel, { color: theme.text }]}>Email Address</Text>
          <View style={[styles.inputRow, { borderColor: theme.border, backgroundColor: theme.background }]}>
            <Mail size={18} color={theme.textMuted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="patient@example.com"
              placeholderTextColor={theme.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errorMessage) setErrorMessage(null);
              }}
            />
          </View>

          {/* Password Input */}
          <Text style={[styles.inputLabel, { color: theme.text }]}>Password</Text>
          <View style={[styles.inputRow, { borderColor: theme.border, backgroundColor: theme.background }]}>
            <Lock size={18} color={theme.textMuted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="Min. 6 characters"
              placeholderTextColor={theme.textMuted}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errorMessage) setErrorMessage(null);
              }}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassword((prev) => !prev)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {showPassword ? (
                <EyeOff size={18} color={theme.textMuted} />
              ) : (
                <Eye size={18} color={theme.textMuted} />
              )}
            </TouchableOpacity>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>Complete Registration</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer Navigation */}
        <View style={styles.footerRow}>
          <Text style={[styles.footerText, { color: theme.textMuted }]}>
            Already have an account?{' '}
          </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text style={[styles.footerLink, { color: theme.primary }]}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  headerBox: {
    marginBottom: 20,
  },
  logoBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 12,
  },
  badgeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    letterSpacing: 1,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 26,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    lineHeight: 21,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorBannerText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: '#991B1B',
    lineHeight: 18,
  },
  card: {
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#0F1E36',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    marginBottom: 24,
  },
  roleToggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  roleBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
  },
  inputLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 15,
    paddingVertical: 12,
  },
  eyeBtn: {
    padding: 4,
  },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
  },
  footerLink: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
  },
});
