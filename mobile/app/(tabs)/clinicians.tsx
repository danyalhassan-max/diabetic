import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { ShieldCheck, UserPlus, KeyRound, ExternalLink, Trash2 } from 'lucide-react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function CliniciansScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [grantCode, setGrantCode] = useState<string | null>('749-182');
  const [activeClinicians, setActiveClinicians] = useState([
    {
      id: 'doc-1',
      name: 'Dr. Aris Thorne, MD',
      role: 'Consultant Ophthalmologist',
      clinic: 'St. Jude Eye Care Center',
      grantedAt: 'Oct 24, 2026',
      status: 'Active',
    },
  ]);

  const generateNewGrantCode = () => {
    const randomCode = `${Math.floor(100 + Math.random() * 900)}-${Math.floor(100 + Math.random() * 900)}`;
    setGrantCode(randomCode);
    Alert.alert(
      'New Access Code Generated',
      `Share code ${randomCode} with your certified eye doctor. This code grants read-only access to your retinal scans for 24 hours.`
    );
  };

  const handleRevoke = (id: string, name: string) => {
    Alert.alert(
      'Revoke Access?',
      `Are you sure you want to revoke scan access for ${name}? They will immediately lose access to your medical images.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke Access',
          style: 'destructive',
          onPress: () => {
            setActiveClinicians((prev) => prev.filter((c) => c.id !== id));
            Alert.alert('Access Revoked', `${name}'s authorization has been terminated.`);
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

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
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
            <Text style={[styles.codeValue, { color: theme.primary }]}>{grantCode || 'No Active Code'}</Text>
          </View>
          <TouchableOpacity style={[styles.newCodeBtn, { backgroundColor: theme.primary }]} onPress={generateNewGrantCode}>
            <Text style={styles.newCodeBtnText}>Generate</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Authorized Doctors List */}
      <Text style={[styles.sectionHeading, { color: theme.text }]}>Authorized Clinicians</Text>
      {activeClinicians.length === 0 ? (
        <View style={[styles.emptyBox, { borderColor: theme.border }]}>
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>
            No doctors currently have access to your scans.
          </Text>
        </View>
      ) : (
        activeClinicians.map((clinician) => (
          <View
            key={clinician.id}
            style={[styles.clinicianCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}
          >
            <View style={styles.clinicianInfo}>
              <Text style={[styles.clinicianName, { color: theme.text }]}>{clinician.name}</Text>
              <Text style={[styles.clinicianRole, { color: theme.textMuted }]}>{clinician.role}</Text>
              <Text style={[styles.clinicianClinic, { color: theme.primary }]}>{clinician.clinic}</Text>
              <Text style={[styles.grantedDate, { color: theme.textMuted }]}>
                Authorized on {clinician.grantedAt}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.revokeBtn}
              onPress={() => handleRevoke(clinician.id, clinician.name)}
            >
              <Trash2 size={16} color="#DC2626" />
              <Text style={styles.revokeText}>Revoke</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      {/* External Ophthalmology Clinic Directory */}
      <Text style={[styles.sectionHeading, { color: theme.text }]}>Regional Eye Clinics & Booking</Text>
      <View style={[styles.clinicListingCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
        <View style={styles.clinicItem}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.clinicItemName, { color: theme.text }]}>St. Jude Retinal Institute</Text>
            <Text style={[styles.clinicItemSub, { color: theme.textMuted }]}>Specialized Diabetic Maculopathy & Laser Treatment</Text>
          </View>
          <TouchableOpacity
            style={[styles.bookBtn, { backgroundColor: theme.primary }]}
            onPress={() => handleBookExternal('St. Jude Retinal Institute', 'https://example.com/stjude-booking')}
          >
            <ExternalLink size={14} color="#FFFFFF" />
            <Text style={styles.bookBtnText}>Book Visit</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.clinicItem}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.clinicItemName, { color: theme.text }]}>City Ophthalmic Diagnostic Center</Text>
            <Text style={[styles.clinicItemSub, { color: theme.textMuted }]}>Fundus Fluorescein Angiography (FFA) & OCT Imaging</Text>
          </View>
          <TouchableOpacity
            style={[styles.bookBtn, { backgroundColor: theme.primary }]}
            onPress={() => handleBookExternal('City Ophthalmic Diagnostic Center', 'https://example.com/cityeye-booking')}
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
});
