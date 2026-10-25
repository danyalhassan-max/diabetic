import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { ShieldCheck, UserPlus, KeyRound, ExternalLink, Trash2, Clock, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

interface ClinicianGrant {
  id: string;
  patient_id: string;
  clinician_id?: string | null;
  grant_code?: string | null;
  status: 'active' | 'revoked' | 'expired';
  expires_at: string;
  created_at: string;
  clinician_profile?: {
    full_name: string;
    institution_name?: string | null;
    medical_license_no?: string | null;
  } | null;
}

export default function CliniciansScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { user } = useAuth();

  const [grants, setGrants] = useState<ClinicianGrant[]>([]);
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchGrants = useCallback(async (isRefresh = false) => {
    if (!user?.id) {
      setGrants([]);
      setActiveCode(null);
      setLoading(false);
      return;
    }

    if (!isRefresh) setLoading(true);
    setErrorMessage(null);

    try {
      // 1. Fetch active grants for this patient
      const { data, error } = await supabase
        .from('clinician_access_grants')
        .select('*')
        .eq('patient_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        setErrorMessage(error.message);
      } else if (data) {
        // Find most recent active grant code
        const activeUnclaimed = data.find((g: any) => g.grant_code && new Date(g.expires_at) > new Date());
        setActiveCode(activeUnclaimed ? activeUnclaimed.grant_code : null);

        // Fetch clinician profiles for grants that have clinician_id
        const grantsWithProfiles: ClinicianGrant[] = await Promise.all(
          data.map(async (grant: any) => {
            if (grant.clinician_id) {
              const { data: prof } = await supabase
                .from('profiles')
                .select('full_name, institution_name, medical_license_no')
                .eq('id', grant.clinician_id)
                .maybeSingle();
              return { ...grant, clinician_profile: prof };
            }
            return grant;
          })
        );
        setGrants(grantsWithProfiles);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to load clinician permissions.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchGrants();
  }, [fetchGrants]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchGrants(true);
  };

  const generateNewGrantCode = async () => {
    if (!user?.id) {
      Alert.alert('Authentication Required', 'Please sign in to generate clinician access codes.');
      return;
    }

    setGenerating(true);
    const randomCode = `${Math.floor(100 + Math.random() * 900)}-${Math.floor(100 + Math.random() * 900)}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    try {
      const { data, error } = await supabase
        .from('clinician_access_grants')
        .insert({
          patient_id: user.id,
          grant_code: randomCode,
          status: 'active',
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (error) {
        // If table not yet applied in remote Supabase, fall back to local presentation with informative notice
        setActiveCode(randomCode);
        Alert.alert(
          'Access Code Generated (Local)',
          `Code ${randomCode} generated. Note: Supabase grants table returned: ${error.message}`
        );
      } else {
        setActiveCode(randomCode);
        if (data) {
          setGrants((prev) => [data, ...prev]);
        }
        Alert.alert(
          'New Access Code Generated',
          `Share code ${randomCode} with your certified eye doctor. This grants read-only access to your retinal scans for 24 hours.`
        );
      }
    } catch (err: any) {
      setActiveCode(randomCode);
      Alert.alert('Notice', `Code ${randomCode} generated locally.`);
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = (id: string, clinicianName?: string) => {
    const targetName = clinicianName || 'this practitioner';
    Alert.alert(
      'Revoke Access?',
      `Are you sure you want to revoke scan access for ${targetName}? They will immediately lose access to your medical images.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke Access',
          style: 'destructive',
          onPress: async () => {
            if (user?.id) {
              try {
                await supabase
                  .from('clinician_access_grants')
                  .update({ status: 'revoked' })
                  .eq('id', id)
                  .eq('patient_id', user.id);
              } catch (err) {
                console.warn('Revoke DB notice:', err);
              }
            }
            setGrants((prev) => prev.filter((c) => c.id !== id));
            Alert.alert('Access Revoked', `${targetName}'s authorization has been terminated.`);
          },
        },
      ]
    );
  };

  const handleBookExternal = (clinicName: string, url: string) => {
    Alert.alert('External Clinic Referral', `Opening external scheduling website for ${clinicName}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Browser', onPress: () => Linking.openURL(url) },
    ]);
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return isoString;
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
    >
      {/* Clinician Access Delegation Card */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
        <View style={styles.cardHeaderRow}>
          <ShieldCheck size={22} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Patient-Authorized Access</Text>
        </View>
        <Text style={[styles.cardSubtitle, { color: theme.textMuted }]}>
          Your medical scans are private. Doctors can only view your scans when you explicitly grant them permission.
        </Text>

        <View style={[styles.codeBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
          <KeyRound size={20} color={theme.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.codeLabel, { color: theme.textMuted }]}>One-Time Clinician Authorization Code</Text>
            <Text style={[styles.codeValue, { color: theme.primary }]}>{activeCode || 'No Active Code'}</Text>
          </View>
          <TouchableOpacity
            style={[styles.newCodeBtn, { backgroundColor: theme.primary }]}
            onPress={generateNewGrantCode}
            disabled={generating}
            accessibilityLabel="Generate new authorization code"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {generating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.newCodeBtnText}>Generate</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Loading State */}
      {loading && !refreshing && (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.stateText, { color: theme.textMuted }]}>Checking clinician authorizations...</Text>
        </View>
      )}

      {/* Error State with Retry */}
      {!loading && errorMessage && (
        <View style={[styles.errorCard, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
          <AlertTriangle size={20} color="#DC2626" />
          <View style={{ flex: 1 }}>
            <Text style={styles.errorTitle}>Could not load clinician grants</Text>
            <Text style={styles.errorSub}>{errorMessage}</Text>
          </View>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchGrants()}>
            <RefreshCw size={14} color="#FFFFFF" />
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Authorized Doctors & Active Access Grants */}
      <Text style={[styles.sectionHeading, { color: theme.text }]}>Authorized Access Grants</Text>
      {!loading && grants.length === 0 ? (
        <View style={[styles.emptyBox, { borderColor: theme.border }]}>
          <Clock size={28} color={theme.textMuted} style={{ marginBottom: 8 }} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No Doctors Currently Authorized</Text>
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>
            Generate a one-time code above to authorize an ophthalmologist or clinical eye specialist to review your retinal scans.
          </Text>
        </View>
      ) : (
        !loading &&
        grants.map((grant) => {
          const clinicianName = grant.clinician_profile?.full_name || (grant.grant_code ? `Pending Code: ${grant.grant_code}` : 'Authorized Practitioner');
          const institution = grant.clinician_profile?.institution_name || (grant.grant_code ? 'Awaiting Doctor Redemptions' : 'Certified Ophthalmic Clinic');
          const license = grant.clinician_profile?.medical_license_no ? `License: ${grant.clinician_profile.medical_license_no}` : 'Read-Only Access Granted';

          return (
            <View
              key={grant.id}
              style={[styles.clinicianCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}
            >
              <View style={styles.clinicianInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <Text style={[styles.clinicianName, { color: theme.text }]} numberOfLines={1} ellipsizeMode="tail">
                    {clinicianName}
                  </Text>
                  {grant.clinician_profile && (
                    <CheckCircle2 size={14} color={theme.primary} />
                  )}
                </View>
                <Text style={[styles.clinicianRole, { color: theme.textMuted }]}>{institution}</Text>
                <Text style={[styles.clinicianClinic, { color: theme.primary }]}>{license}</Text>
                <Text style={[styles.grantedDate, { color: theme.textMuted }]}>
                  Granted on {formatDate(grant.created_at)} • Valid until {formatDate(grant.expires_at)}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.revokeBtn}
                onPress={() => handleRevoke(grant.id, grant.clinician_profile?.full_name)}
                accessibilityLabel="Revoke access"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Trash2 size={16} color="#DC2626" />
                <Text style={styles.revokeText}>Revoke</Text>
              </TouchableOpacity>
            </View>
          );
        })
      )}

      {/* External Ophthalmology Clinic Directory (Shared Directory Data) */}
      <Text style={[styles.sectionHeading, { color: theme.text }]}>Regional Eye Clinics & Booking</Text>
      <View style={[styles.clinicListingCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
        <View style={styles.clinicItem}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={[styles.clinicItemName, { color: theme.text }]}>St. Jude Retinal Institute</Text>
            <Text style={[styles.clinicItemSub, { color: theme.textMuted }]}>Specialized Diabetic Maculopathy & Laser Treatment</Text>
          </View>
          <TouchableOpacity
            style={[styles.bookBtn, { backgroundColor: theme.primary }]}
            onPress={() => handleBookExternal('St. Jude Retinal Institute', 'https://example.com/stjude-booking')}
            accessibilityLabel="Book visit with St. Jude Retinal Institute"
          >
            <ExternalLink size={14} color="#FFFFFF" />
            <Text style={styles.bookBtnText}>Book Visit</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.clinicItem}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={[styles.clinicItemName, { color: theme.text }]}>City Ophthalmic Diagnostic Center</Text>
            <Text style={[styles.clinicItemSub, { color: theme.textMuted }]}>Fundus Fluorescein Angiography (FFA) & OCT Imaging</Text>
          </View>
          <TouchableOpacity
            style={[styles.bookBtn, { backgroundColor: theme.primary }]}
            onPress={() => handleBookExternal('City Ophthalmic Diagnostic Center', 'https://example.com/cityeye-booking')}
            accessibilityLabel="Book visit with City Ophthalmic Diagnostic Center"
          >
            <ExternalLink size={14} color="#FFFFFF" />
            <Text style={styles.bookBtnText}>Book Visit</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#0F1E36',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  cardTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
  },
  cardSubtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  codeLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    marginBottom: 2,
  },
  codeValue: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    letterSpacing: 2,
  },
  newCodeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  newCodeBtnText: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
  },
  sectionHeading: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    marginBottom: 12,
  },
  emptyBox: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
  },
  clinicianCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  clinicianInfo: {
    flex: 1,
  },
  clinicianName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    marginBottom: 2,
  },
  clinicianRole: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    marginBottom: 2,
  },
  clinicianClinic: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    marginBottom: 4,
  },
  grantedDate: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11,
  },
  revokeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
  },
  revokeText: {
    color: '#DC2626',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
  },
  clinicListingCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    marginBottom: 32,
  },
  clinicItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
  },
  clinicItemName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    marginBottom: 2,
  },
  clinicItemSub: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
  },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  bookBtnText: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
  },
  divider: {
    height: 1,
    marginVertical: 10,
  },
  centerContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  stateText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: '#991B1B',
    marginBottom: 2,
  },
  errorSub: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: '#B91C1C',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DC2626',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
  },
  emptyTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    marginBottom: 4,
    textAlign: 'center',
  },
});
