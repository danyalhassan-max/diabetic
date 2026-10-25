import React, { useState, useRef } from 'react';
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
  Keyboard,
  type TextInputInstance,
  type ScrollViewInstance,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  ShieldAlert,
  CheckCircle2,
  BriefcaseMedical,
  GraduationCap,
  Award,
  Building,
  MapPin,
  Phone,
  Info,
  Clock,
} from 'lucide-react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/context/AuthContext';

const SPECIALTIES = [
  'Ophthalmology',
  'Retinal Specialist',
  'Vitreoretinal Surgery',
  'Optometry',
  'General Medicine',
];

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { signUp } = useAuth();

  // Role state
  const [role, setRole] = useState<'patient' | 'clinician'>('patient');

  // Account Information (Common)
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Doctor Professional Information
  const [medicalDegree, setMedicalDegree] = useState('');
  const [medicalLicenseNo, setMedicalLicenseNo] = useState('');
  const [jurisdiction, setJurisdiction] = useState('');
  const [specialty, setSpecialty] = useState('Ophthalmology');
  const [yearsExperience, setYearsExperience] = useState('');

  // Doctor Practice Information
  const [institutionName, setInstitutionName] = useState('');
  const [clinicCity, setClinicCity] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // UI States
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form input references for keyboard Next/Done navigation
  const scrollViewRef = useRef<ScrollViewInstance>(null);
  const fullNameInputRef = useRef<TextInputInstance>(null);
  const emailInputRef = useRef<TextInputInstance>(null);
  const passwordInputRef = useRef<TextInputInstance>(null);
  const confirmPasswordInputRef = useRef<TextInputInstance>(null);
  const medicalDegreeRef = useRef<TextInputInstance>(null);
  const medicalLicenseRef = useRef<TextInputInstance>(null);
  const jurisdictionRef = useRef<TextInputInstance>(null);
  const experienceRef = useRef<TextInputInstance>(null);
  const institutionRef = useRef<TextInputInstance>(null);
  const clinicCityRef = useRef<TextInputInstance>(null);
  const phoneRef = useRef<TextInputInstance>(null);

  const handleRoleChange = (newRole: 'patient' | 'clinician') => {
    setRole(newRole);
    setErrorMessage(null);
  };

  const validate = () => {
    // 1. Account validation
    if (!fullName.trim() || fullName.trim().length < 2) {
      setErrorMessage(
        role === 'clinician'
          ? 'Please enter your professional full legal name (e.g., Dr. Sarah Jenkins).'
          : 'Please enter your full legal name.'
      );
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      fullNameInputRef.current?.focus();
      return false;
    }

    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      emailInputRef.current?.focus();
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMessage('Please enter a valid email address.');
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      emailInputRef.current?.focus();
      return false;
    }

    if (!password) {
      setErrorMessage('Please create a secure password.');
      passwordInputRef.current?.focus();
      return false;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      passwordInputRef.current?.focus();
      return false;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter your password.');
      confirmPasswordInputRef.current?.focus();
      return false;
    }

    // 2. Doctor-specific professional validation
    if (role === 'clinician') {
      if (!medicalDegree.trim()) {
        setErrorMessage('Please enter your medical qualification or degree (e.g. MBBS, MD, DO, FRCOphth).');
        medicalDegreeRef.current?.focus();
        return false;
      }
      if (!medicalLicenseNo.trim() || medicalLicenseNo.trim().length < 3) {
        setErrorMessage('Please enter a valid medical license or professional registration number.');
        medicalLicenseRef.current?.focus();
        return false;
      }
      if (!jurisdiction.trim()) {
        setErrorMessage('Please specify your registration country or jurisdiction authority (e.g., UK GMC, State Medical Board).');
        jurisdictionRef.current?.focus();
        return false;
      }
      if (!specialty.trim()) {
        setErrorMessage('Please select or specify your clinical specialty.');
        return false;
      }
      if (!institutionName.trim()) {
        setErrorMessage('Please enter your primary hospital, clinic, or practice name.');
        institutionRef.current?.focus();
        return false;
      }
      if (!clinicCity.trim()) {
        setErrorMessage('Please enter the practice city or municipality.');
        clinicCityRef.current?.focus();
        return false;
      }
    }

    setErrorMessage(null);
    return true;
  };

  const handleRegister = async () => {
    Keyboard.dismiss();
    if (!validate()) return;

    setLoading(true);
    setErrorMessage(null);

    const doctorDetails =
      role === 'clinician'
        ? {
            medical_degree: medicalDegree.trim(),
            medical_license_no: medicalLicenseNo.trim(),
            specialty: specialty.trim(),
            jurisdiction: jurisdiction.trim(),
            institution_name: institutionName.trim(),
            clinic_address_city: clinicCity.trim(),
            phone_number: phoneNumber.trim() || undefined,
            years_of_experience: yearsExperience.trim() ? parseInt(yearsExperience.trim(), 10) : undefined,
          }
        : undefined;

    const { error, data } = await signUp(
      email,
      password,
      fullName,
      role,
      doctorDetails
    );

    setLoading(false);

    if (error) {
      setErrorMessage(error.message || 'Registration failed. Please check your connection and try again.');
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      if (data?.session) {
        if (role === 'clinician') {
          Alert.alert(
            'Clinician Account Created',
            'Your clinician account has been registered in Pending Verification status. You can now access your clinician workspace.',
            [{ text: 'Continue', onPress: () => router.replace('/(tabs)') }]
          );
        } else {
          router.replace('/(tabs)');
        }
      } else {
        Alert.alert(
          'Registration Successful',
          'Your account has been created. If email verification is enabled on your system, please verify your email before signing in.',
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
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top + 16, 20),
            paddingBottom: Math.max(insets.bottom + 48, 64),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {/* Header Branding */}
        <View style={styles.headerBox}>
          <Text style={[styles.title, { color: theme.text }]}>Create Account</Text>
        </View>

        {/* Error Banner */}
        {errorMessage && (
          <View style={[styles.errorBanner, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
            <ShieldAlert size={20} color="#DC2626" />
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        )}

        {/* Step A: Accessible Role Selectable Cards */}
        <Text style={[styles.sectionHeading, { color: theme.text }]}>Select Account Type</Text>
        <View style={styles.roleCardContainer}>
          {/* Patient Card */}
          <TouchableOpacity
            style={[
              styles.roleCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
              role === 'patient' && [styles.roleCardSelected, { borderColor: theme.primary }],
            ]}
            onPress={() => handleRoleChange('patient')}
            accessibilityRole="button"
            accessibilityLabel="Select Patient account type"
            accessibilityState={{ selected: role === 'patient' }}
          >
            <View style={styles.roleCardHeader}>
              <View
                style={[
                  styles.roleIconCircle,
                  { backgroundColor: role === 'patient' ? '#E0F2FE' : '#F1F5F9' },
                ]}
              >
                <User size={17} color={role === 'patient' ? theme.primary : theme.textMuted} />
              </View>
              {role === 'patient' && <CheckCircle2 size={20} color={theme.primary} />}
            </View>
            <Text style={[styles.roleCardTitle, { color: theme.text }]}>Patient</Text>
          </TouchableOpacity>

          {/* Doctor Card */}
          <TouchableOpacity
            style={[
              styles.roleCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
              role === 'clinician' && [styles.roleCardSelected, { borderColor: theme.primary }],
            ]}
            onPress={() => handleRoleChange('clinician')}
            accessibilityRole="button"
            accessibilityLabel="Select Doctor or Clinician account type"
            accessibilityState={{ selected: role === 'clinician' }}
          >
            <View style={styles.roleCardHeader}>
              <View
                style={[
                  styles.roleIconCircle,
                  { backgroundColor: role === 'clinician' ? '#E0F2FE' : '#F1F5F9' },
                ]}
              >
                <BriefcaseMedical
                  size={17}
                  color={role === 'clinician' ? theme.primary : theme.textMuted}
                />
              </View>
              {role === 'clinician' && <CheckCircle2 size={20} color={theme.primary} />}
            </View>
            <Text style={[styles.roleCardTitle, { color: theme.text }]}>Clinician</Text>
          </TouchableOpacity>
        </View>

        {/* Doctor Verification Notice Banner */}
        {role === 'clinician' && (
          <View style={[styles.noticeBanner, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
            <Info size={20} color="#15803D" style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.noticeTitle}>Clinician Verification Policy</Text>
              <Text style={styles.noticeText}>
                New doctor accounts are created with a <Text style={{ fontWeight: '700' }}>Pending Verification</Text> status. You can redeem patient scan codes immediately, while official clinical second opinion reviews require administrator license verification.
              </Text>
            </View>
          </View>
        )}

        {/* Form Card */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
          {/* Section 1: Account Information */}
          <Text style={[styles.groupTitle, { color: theme.primary }]}>
            1. Account Credentials
          </Text>

          {/* Full Name */}
          <Text style={[styles.inputLabel, { color: theme.text }]}>
            {role === 'clinician' ? 'Full Legal Name with Title' : 'Full Name'}{' '}
            <Text style={styles.requiredStar}>*</Text>
          </Text>
          <View style={[styles.inputRow, { borderColor: theme.border, backgroundColor: theme.background }]}>
            <User size={18} color={theme.textMuted} style={styles.inputIcon} />
            <TextInput
              ref={fullNameInputRef}
              style={[styles.input, { color: theme.text }]}
              placeholder={role === 'clinician' ? 'e.g. Dr. Sarah Jenkins' : 'e.g. Jane Doe'}
              placeholderTextColor={theme.textMuted}
              autoCapitalize="words"
              autoCorrect={false}
              textContentType="name"
              autoComplete="name"
              returnKeyType="next"
              value={fullName}
              onChangeText={(text) => {
                setFullName(text);
                if (errorMessage) setErrorMessage(null);
              }}
              onSubmitEditing={() => emailInputRef.current?.focus()}
              blurOnSubmit={false}
            />
          </View>

          {/* Email */}
          <Text style={[styles.inputLabel, { color: theme.text }]}>
            Email Address <Text style={styles.requiredStar}>*</Text>
          </Text>
          <View style={[styles.inputRow, { borderColor: theme.border, backgroundColor: theme.background }]}>
            <Mail size={18} color={theme.textMuted} style={styles.inputIcon} />
            <TextInput
              ref={emailInputRef}
              style={[styles.input, { color: theme.text }]}
              placeholder={role === 'clinician' ? 'doctor@hospital.org' : 'patient@example.com'}
              placeholderTextColor={theme.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              autoComplete="email"
              returnKeyType="next"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errorMessage) setErrorMessage(null);
              }}
              onSubmitEditing={() => passwordInputRef.current?.focus()}
              blurOnSubmit={false}
            />
          </View>

          {/* Password */}
          <Text style={[styles.inputLabel, { color: theme.text }]}>
            Password <Text style={styles.requiredStar}>*</Text>
          </Text>
          <View style={[styles.inputRow, { borderColor: theme.border, backgroundColor: theme.background }]}>
            <Lock size={18} color={theme.textMuted} style={styles.inputIcon} />
            <TextInput
              ref={passwordInputRef}
              style={[styles.input, { color: theme.text }]}
              placeholder="Minimum 6 characters"
              placeholderTextColor={theme.textMuted}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              autoComplete="new-password"
              returnKeyType="next"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errorMessage) setErrorMessage(null);
              }}
              onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassword((prev) => !prev)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              accessibilityRole="button"
            >
              {showPassword ? (
                <EyeOff size={18} color={theme.textMuted} />
              ) : (
                <Eye size={18} color={theme.textMuted} />
              )}
            </TouchableOpacity>
          </View>

          {/* Confirm Password */}
          <Text style={[styles.inputLabel, { color: theme.text }]}>
            Confirm Password <Text style={styles.requiredStar}>*</Text>
          </Text>
          <View style={[styles.inputRow, { borderColor: theme.border, backgroundColor: theme.background }]}>
            <Lock size={18} color={theme.textMuted} style={styles.inputIcon} />
            <TextInput
              ref={confirmPasswordInputRef}
              style={[styles.input, { color: theme.text }]}
              placeholder="Re-enter password"
              placeholderTextColor={theme.textMuted}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              autoComplete="new-password"
              returnKeyType={role === 'clinician' ? 'next' : 'done'}
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (errorMessage) setErrorMessage(null);
              }}
              onSubmitEditing={() => {
                if (role === 'clinician') {
                  medicalDegreeRef.current?.focus();
                } else {
                  handleRegister();
                }
              }}
              blurOnSubmit={role !== 'clinician'}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowConfirmPassword((prev) => !prev)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              accessibilityRole="button"
            >
              {showConfirmPassword ? (
                <EyeOff size={18} color={theme.textMuted} />
              ) : (
                <Eye size={18} color={theme.textMuted} />
              )}
            </TouchableOpacity>
          </View>

          {/* Doctor-Specific Sections */}
          {role === 'clinician' && (
            <>
              {/* Section 2: Professional Information */}
              <View style={[styles.sectionDivider, { backgroundColor: theme.border }]} />
              <Text style={[styles.groupTitle, { color: theme.primary }]}>
                2. Professional Credentials
              </Text>

              {/* Medical Degree */}
              <Text style={[styles.inputLabel, { color: theme.text }]}>
                Medical Qualification / Degree <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={[styles.inputRow, { borderColor: theme.border, backgroundColor: theme.background }]}>
                <GraduationCap size={18} color={theme.textMuted} style={styles.inputIcon} />
                <TextInput
                  ref={medicalDegreeRef}
                  style={[styles.input, { color: theme.text }]}
                  placeholder="e.g. MBBS, MD, DO, FRCOphth"
                  placeholderTextColor={theme.textMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="next"
                  value={medicalDegree}
                  onChangeText={(text) => {
                    setMedicalDegree(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  onSubmitEditing={() => medicalLicenseRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </View>

              {/* Medical License Number */}
              <Text style={[styles.inputLabel, { color: theme.text }]}>
                Medical License / Registration No. <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={[styles.inputRow, { borderColor: theme.border, backgroundColor: theme.background }]}>
                <Award size={18} color={theme.textMuted} style={styles.inputIcon} />
                <TextInput
                  ref={medicalLicenseRef}
                  style={[styles.input, { color: theme.text }]}
                  placeholder="e.g. GMC-7492019 or MD-84920"
                  placeholderTextColor={theme.textMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="next"
                  value={medicalLicenseNo}
                  onChangeText={(text) => {
                    setMedicalLicenseNo(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  onSubmitEditing={() => jurisdictionRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </View>

              {/* Jurisdiction / Authority */}
              <Text style={[styles.inputLabel, { color: theme.text }]}>
                Licensing Authority / Jurisdiction <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={[styles.inputRow, { borderColor: theme.border, backgroundColor: theme.background }]}>
                <MapPin size={18} color={theme.textMuted} style={styles.inputIcon} />
                <TextInput
                  ref={jurisdictionRef}
                  style={[styles.input, { color: theme.text }]}
                  placeholder="e.g. General Medical Council (UK) or State Board"
                  placeholderTextColor={theme.textMuted}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="next"
                  value={jurisdiction}
                  onChangeText={(text) => {
                    setJurisdiction(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  onSubmitEditing={() => experienceRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </View>

              {/* Specialty Selector */}
              <Text style={[styles.inputLabel, { color: theme.text }]}>
                Clinical Specialty <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={styles.specialtyChipsContainer}>
                {SPECIALTIES.map((spec) => {
                  const isSelected = specialty === spec;
                  return (
                    <TouchableOpacity
                      key={spec}
                      style={[
                        styles.chip,
                        { borderColor: theme.border, backgroundColor: theme.background },
                        isSelected && { borderColor: theme.primary, backgroundColor: '#E0F2FE' },
                      ]}
                      onPress={() => setSpecialty(spec)}
                      accessibilityRole="button"
                      accessibilityLabel={`Select specialty ${spec}`}
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: isSelected ? theme.primary : theme.text },
                          isSelected && { fontFamily: 'PlusJakartaSans_700Bold' },
                        ]}
                      >
                        {spec}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Years of Experience */}
              <Text style={[styles.inputLabel, { color: theme.text }]}>
                Years of Clinical Practice <Text style={styles.optionalText}>(Optional)</Text>
              </Text>
              <View style={[styles.inputRow, { borderColor: theme.border, backgroundColor: theme.background }]}>
                <Clock size={18} color={theme.textMuted} style={styles.inputIcon} />
                <TextInput
                  ref={experienceRef}
                  style={[styles.input, { color: theme.text }]}
                  placeholder="e.g. 8"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="number-pad"
                  returnKeyType="next"
                  value={yearsExperience}
                  onChangeText={setYearsExperience}
                  onSubmitEditing={() => institutionRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </View>

              {/* Section 3: Practice & Clinic Information */}
              <View style={[styles.sectionDivider, { backgroundColor: theme.border }]} />
              <Text style={[styles.groupTitle, { color: theme.primary }]}>
                3. Practice & Clinic Location
              </Text>

              {/* Hospital / Clinic Name */}
              <Text style={[styles.inputLabel, { color: theme.text }]}>
                Hospital / Eye Clinic Name <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={[styles.inputRow, { borderColor: theme.border, backgroundColor: theme.background }]}>
                <Building size={18} color={theme.textMuted} style={styles.inputIcon} />
                <TextInput
                  ref={institutionRef}
                  style={[styles.input, { color: theme.text }]}
                  placeholder="e.g. St. Jude Eye Hospital & Clinic"
                  placeholderTextColor={theme.textMuted}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="next"
                  value={institutionName}
                  onChangeText={(text) => {
                    setInstitutionName(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  onSubmitEditing={() => clinicCityRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </View>

              {/* Clinic City */}
              <Text style={[styles.inputLabel, { color: theme.text }]}>
                Practice City / Municipality <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={[styles.inputRow, { borderColor: theme.border, backgroundColor: theme.background }]}>
                <MapPin size={18} color={theme.textMuted} style={styles.inputIcon} />
                <TextInput
                  ref={clinicCityRef}
                  style={[styles.input, { color: theme.text }]}
                  placeholder="e.g. London or Boston"
                  placeholderTextColor={theme.textMuted}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="next"
                  value={clinicCity}
                  onChangeText={(text) => {
                    setClinicCity(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  onSubmitEditing={() => phoneRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </View>

              {/* Professional Contact Phone */}
              <Text style={[styles.inputLabel, { color: theme.text }]}>
                Professional Contact Phone <Text style={styles.optionalText}>(Optional)</Text>
              </Text>
              <View style={[styles.inputRow, { borderColor: theme.border, backgroundColor: theme.background }]}>
                <Phone size={18} color={theme.textMuted} style={styles.inputIcon} />
                <TextInput
                  ref={phoneRef}
                  style={[styles.input, { color: theme.text }]}
                  placeholder="+1 (555) 019-2831"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="phone-pad"
                  returnKeyType="done"
                  textContentType="telephoneNumber"
                  autoComplete="tel"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  onSubmitEditing={handleRegister}
                />
              </View>
            </>
          )}

          {/* Submit Action */}
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
            onPress={handleRegister}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={
              role === 'clinician' ? 'Complete Doctor Registration' : 'Complete Patient Registration'
            }
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {role === 'clinician' ? 'Register Clinician Account' : 'Complete Patient Registration'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer Navigation */}
        <View style={styles.footerRow}>
          <Text style={[styles.footerText, { color: theme.textMuted }]}>
            Already have an account?{' '}
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(auth)/login')}
            accessibilityRole="button"
            accessibilityLabel="Sign In"
          >
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
    paddingHorizontal: 20,
  },
  headerBox: {
    marginBottom: 20,
    marginTop: 10,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 26,
    marginBottom: 6,
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
  sectionHeading: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    marginBottom: 10,
  },
  roleCardContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  roleCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    elevation: 1,
    shadowColor: '#0F1E36',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  roleCardSelected: {
    borderWidth: 2,
  },
  roleCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  roleIconCircle: {
    width: 25,
    height: 25,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleCardTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  noticeTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: '#15803D',
    marginBottom: 2,
  },
  noticeText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: '#166534',
    lineHeight: 17,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#0F1E36',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    marginBottom: 24,
  },
  groupTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  sectionDivider: {
    height: 1,
    marginVertical: 18,
  },
  inputLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    marginBottom: 6,
  },
  requiredStar: {
    color: '#DC2626',
    fontWeight: '700',
  },
  optionalText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11,
    color: '#94A3B8',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 14,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    paddingVertical: 11,
  },
  eyeBtn: {
    padding: 8,
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  specialtyChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
  },
  primaryBtn: {
    paddingVertical: 14,
    minHeight: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
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
    paddingVertical: 8,
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
