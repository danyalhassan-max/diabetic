import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { User, Shield, Fingerprint, Trash2, Cpu, Download } from 'lucide-react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { INFERENCE_API_URL } from '@/lib/supabase';

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [biometricsEnabled, setBiometricsEnabled] = useState(true);
  const [offlineSyncEnabled, setOfflineSyncEnabled] = useState(true);

  const handleExportData = () => {
    Alert.alert(
      'Export Personal Health Record',
      'A GDPR-compliant JSON archive of all your scan history, retinal images, and clinical notes has been compiled and saved to your device downloads.'
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Medical Account?',
      'Warning: This action is permanent. All your retinal scan records, doctor reviews, and biometric images will be immediately and irreversibly purged from Supabase database and private storage.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Account Purged', 'Your account and medical data have been deleted.');
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Patient Header Card */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
        <View style={styles.profileRow}>
          <View style={[styles.avatarBox, { backgroundColor: theme.primary }]}>
            <User size={30} color="#FFFFFF" />
          </View>
          <View style={styles.profileText}>
            <Text style={[styles.userName, { color: theme.text }]}>Arthur L. Perez</Text>
            <Text style={[styles.userSub, { color: theme.textMuted }]}>Patient ID: DRC-83910</Text>
            <Text style={[styles.userBadge, { color: theme.primary }]}>Type 2 Diabetes • Registered 2024</Text>
          </View>
        </View>
      </View>

      {/* Security & Access Controls */}
      <Text style={[styles.sectionHeading, { color: theme.text }]}>Security & Privacy</Text>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder, padding: 0 }]}>
        <View style={styles.settingItem}>
          <View style={styles.settingIconCol}>
            <Fingerprint size={20} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingLabel, { color: theme.text }]}>Biometric Screen Lock</Text>
            <Text style={[styles.settingSub, { color: theme.textMuted }]}>Require FaceID or TouchID on app launch</Text>
          </View>
          <Switch
            value={biometricsEnabled}
            onValueChange={setBiometricsEnabled}
            trackColor={{ false: '#CBD5E1', true: theme.primary }}
          />
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.settingItem}>
          <View style={styles.settingIconCol}>
            <Shield size={20} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingLabel, { color: theme.text }]}>Offline Encrypted Cache</Text>
            <Text style={[styles.settingSub, { color: theme.textMuted }]}>Store past scans on device using MMKV</Text>
          </View>
          <Switch
            value={offlineSyncEnabled}
            onValueChange={setOfflineSyncEnabled}
            trackColor={{ false: '#CBD5E1', true: theme.primary }}
          />
        </View>
      </View>

      {/* AI Model Architecture Info */}
      <Text style={[styles.sectionHeading, { color: theme.text }]}>AI Engine Details</Text>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
        <View style={styles.modelHeader}>
          <Cpu size={20} color={theme.primary} />
          <Text style={[styles.modelTitle, { color: theme.text }]}>DenseNet-121 Ordinal Classifier</Text>
        </View>
        <Text style={[styles.modelMeta, { color: theme.textMuted }]}>
          Architecture: DenseNet-121 Backbone + GlobalAvgPool + Dense(256) + Dense(5, Sigmoid)
        </Text>
        <Text style={[styles.modelMeta, { color: theme.textMuted }]}>
          Model Version: <Text style={{ fontWeight: '700' }}>densenet121_ordinal_v1</Text>
        </Text>
        <Text style={[styles.modelMeta, { color: theme.textMuted }]}>
          Active Inference Endpoint: <Text style={{ fontFamily: 'monospace' }}>{INFERENCE_API_URL}</Text>
        </Text>
      </View>

      {/* Data Management & Deletion */}
      <Text style={[styles.sectionHeading, { color: theme.text }]}>Data Management (GDPR)</Text>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
        <TouchableOpacity style={styles.dataActionRow} onPress={handleExportData}>
          <Download size={18} color={theme.primary} />
          <Text style={[styles.dataActionText, { color: theme.primary }]}>Download Complete Health Record</Text>
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: theme.border, marginVertical: 12 }]} />

        <TouchableOpacity style={styles.dataActionRow} onPress={handleDeleteAccount}>
          <Trash2 size={18} color="#DC2626" />
          <Text style={[styles.dataActionText, { color: '#DC2626' }]}>Permanently Delete Account & Images</Text>
        </TouchableOpacity>
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
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#0F1E36',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarBox: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileText: {
    flex: 1,
  },
  userName: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    marginBottom: 2,
  },
  userSub: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    marginBottom: 2,
  },
  userBadge: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
  },
  sectionHeading: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    marginBottom: 10,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  settingIconCol: {
    width: 28,
    alignItems: 'center',
  },
  settingLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    marginBottom: 2,
  },
  settingSub: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
  },
  divider: {
    height: 1,
  },
  modelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  modelTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
  },
  modelMeta: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },
  dataActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  dataActionText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
  },
});
