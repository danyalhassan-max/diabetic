import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

export interface UserProfile {
  id: string;
  role: 'patient' | 'clinician';
  full_name: string;
  phone_number?: string | null;
  avatar_url?: string | null;
  medical_license_no?: string | null;
  institution_name?: string | null;
  medical_degree?: string | null;
  specialty?: string | null;
  jurisdiction?: string | null;
  clinic_address_city?: string | null;
  years_of_experience?: number | null;
  is_verified?: boolean;
  verification_status?: 'pending' | 'approved' | 'rejected';
}

export interface DoctorRegistrationData {
  medical_degree?: string;
  medical_license_no?: string;
  specialty?: string;
  jurisdiction?: string;
  institution_name?: string;
  clinic_address_city?: string;
  phone_number?: string;
  years_of_experience?: number;
}

export interface UserSettings {
  biometricsEnabled: boolean;
  offlineSyncEnabled: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  settings: UserSettings;
  isLoading: boolean;
  signIn: (email: string, pass: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    pass: string,
    fullName: string,
    role?: 'patient' | 'clinician',
    doctorDetails?: DoctorRegistrationData
  ) => Promise<{ error: Error | null; data?: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: Error | null }>;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_SETTINGS: UserSettings = {
  biometricsEnabled: true,
  offlineSyncEnabled: true,
};

async function readStorageItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
    return null;
  }
  return SecureStore.getItemAsync(key);
}

async function writeStorageItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load user profile from Supabase profiles table
  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.warn('Error fetching user profile:', error.message);
      }

      if (data) {
        setProfile(data as UserProfile);
      } else {
        // Fallback default profile if row trigger has not completed
        setProfile({
          id: userId,
          role: 'patient',
          full_name: 'Patient',
          is_verified: false,
          verification_status: 'pending',
        });
      }
    } catch (err) {
      console.warn('Failed to load profile:', err);
    }
  };

  // Load user-scoped settings from persistent SecureStore
  const loadUserSettings = async (userId: string) => {
    try {
      const stored = await readStorageItem(`user_settings_${userId}`);
      if (stored) {
        setSettings(JSON.parse(stored));
      } else {
        setSettings(DEFAULT_SETTINGS);
      }
    } catch {
      setSettings(DEFAULT_SETTINGS);
    }
  };

  useEffect(() => {
    // 1. Initial session check on application launch
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user) {
        fetchProfile(initialSession.user.id);
        loadUserSettings(initialSession.user.id);
      }
      setIsLoading(false);
    });

    // 2. Listen to ongoing auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          await fetchProfile(currentSession.user.id);
          await loadUserSettings(currentSession.user.id);
        } else {
          setProfile(null);
          setSettings(DEFAULT_SETTINGS);
        }
        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, pass: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: pass,
      });
      return { error };
    } catch (err: any) {
      return { error: err };
    }
  };

  const signUp = async (
    email: string,
    pass: string,
    fullName: string,
    role: 'patient' | 'clinician' = 'patient',
    doctorDetails?: DoctorRegistrationData
  ) => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const trimmedName = fullName.trim();
      const userRole = role || 'patient';

      const metadata: Record<string, any> = {
        full_name: trimmedName,
        role: userRole,
      };

      if (userRole === 'clinician' && doctorDetails) {
        if (doctorDetails.medical_degree) metadata.medical_degree = doctorDetails.medical_degree.trim();
        if (doctorDetails.medical_license_no) metadata.medical_license_no = doctorDetails.medical_license_no.trim();
        if (doctorDetails.specialty) metadata.specialty = doctorDetails.specialty.trim();
        if (doctorDetails.jurisdiction) metadata.jurisdiction = doctorDetails.jurisdiction.trim();
        if (doctorDetails.institution_name) metadata.institution_name = doctorDetails.institution_name.trim();
        if (doctorDetails.clinic_address_city) metadata.clinic_address_city = doctorDetails.clinic_address_city.trim();
        if (doctorDetails.phone_number) metadata.phone_number = doctorDetails.phone_number.trim();
        if (doctorDetails.years_of_experience !== undefined) metadata.years_of_experience = doctorDetails.years_of_experience;
      }

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: pass,
        options: {
          data: metadata,
        },
      });

      if (!error && data?.user) {
        const profilePayload: Record<string, any> = {
          id: data.user.id,
          full_name: trimmedName,
          role: userRole,
          is_verified: false,
          verification_status: 'pending',
        };

        if (userRole === 'clinician' && doctorDetails) {
          if (doctorDetails.medical_degree) profilePayload.medical_degree = doctorDetails.medical_degree.trim();
          if (doctorDetails.medical_license_no) profilePayload.medical_license_no = doctorDetails.medical_license_no.trim();
          if (doctorDetails.specialty) profilePayload.specialty = doctorDetails.specialty.trim();
          if (doctorDetails.jurisdiction) profilePayload.jurisdiction = doctorDetails.jurisdiction.trim();
          if (doctorDetails.institution_name) profilePayload.institution_name = doctorDetails.institution_name.trim();
          if (doctorDetails.clinic_address_city) profilePayload.clinic_address_city = doctorDetails.clinic_address_city.trim();
          if (doctorDetails.phone_number) profilePayload.phone_number = doctorDetails.phone_number.trim();
          if (doctorDetails.years_of_experience !== undefined) profilePayload.years_of_experience = doctorDetails.years_of_experience;
        }

        try {
          await supabase.from('profiles').upsert(profilePayload);
        } catch {
          // Trigger may have already created it
        }
      }

      return { error, data };
    } catch (err: any) {
      return { error: err };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      setUser(null);
      setSession(null);
      setProfile(null);
      setSettings(DEFAULT_SETTINGS);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return { error: new Error('User not authenticated') };
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (!error) {
        setProfile((prev) => (prev ? { ...prev, ...updates } : null));
      }
      return { error };
    } catch (err: any) {
      return { error: err };
    }
  };

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    if (user) {
      try {
        await writeStorageItem(`user_settings_${user.id}`, JSON.stringify(updated));
      } catch (err) {
        console.warn('Failed to persist user settings:', err);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        settings,
        isLoading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        updateProfile,
        updateSettings,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
