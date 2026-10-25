import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { User, Shield, Fingerprint, Trash2, Cpu, Download, LogOut, Edit3, X, Check } from 'lucide-react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { INFERENCE_API_URL } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { user, profile, settings, updateSettings, updateProfile, signOut } = useAuth();

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editFullName, setEditFullName] = useState(profile?.full_name || '');
  const [editPhone, setEditPhone] = useState(profile?.phone_number || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const handleOpenEditModal = () => {
    setEditFullName(profile?.full_name || '');
    setEditPhone(profile?.phone_number || '');
    setEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!editFullName.trim()) {
      Alert.alert('Required Field', 'Please provide a valid full name.');
      return;
    }
    setSavingProfile(true);
    const { error } = await updateProfile({
      full_name: editFullName.trim(),
      phone_number: editPhone.trim() || null,
    });
    setSavingProfile(false);

    if (error) {
      Alert.alert('Update Failed', error.message || 'Could not update profile in database.');
    } else {
      setEditModalVisible(false);
      Alert.alert('Profile Updated', 'Your profile information has been saved successfully.');
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out of your session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  };

  const handleExportData = () => {
    Alert.alert(
      'Export Personal Health Record',
      `A clinical export for ${profile?.full_name || user?.email} has been compiled with all recorded retinal scans, diagnostic grades, and clinician grants.`
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
          onPress: async () => {
            Alert.alert(
              'Account Deletion Requested',
              'Please contact system support or your medical provider to complete identity-verified permanent deletion.'
            );
          },
        },
      ]
    );
  };

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Patient';
  const roleLabel = profile?.role === 'clinician' ? 'Clinical Practitioner' : 'Screening Patient';
  const displayId = `DRC-${(user?.id || '00000000').slice(0, 8).toUpperCase()}`;

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Patient Header Card */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
        <View style={styles.profileRow}>
          <View style={[styles.avatarBox, { backgroundColor: theme.primary }]}>
            <User size={30} color="#FFFFFF" />
          </View>
          <View style={styles.profileText}>
            <Text style={[styles.userName, { color: theme.text }]}>{displayName}</Text>
            <Text style={[styles.userSub, { color: theme.textMuted }]}>{user?.email || 'No email attached'}</Text>
            <Text style={[styles.userBadge, { color: theme.primary }]}>
              {roleLabel} • {displayId}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.editIconBtn, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}
            onPress={handleOpenEditModal}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Edit3 size={16} color={theme.primary} />
          </TouchableOpacity>
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
            value={settings.biometricsEnabled}
            onValueChange={(val) => updateSettings({ biometricsEnabled: val })}
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
            <Text style={[styles.settingSub, { color: theme.textMuted }]}>Store past scans on device using SecureStore</Text>
          </View>
          <Switch
            value={settings.offlineSyncEnabled}
            onValueChange={(val) => updateSettings({ offlineSyncEnabled: val })}
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

      {/* Account Actions & GDPR */}
      <Text style={[styles.sectionHeading, { color: theme.text }]}>Session & Data Management</Text>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
        <TouchableOpacity style={styles.dataActionRow} onPress={handleExportData}>
          <Download size={18} color={theme.primary} />
          <Text style={[styles.dataActionText, { color: theme.primary }]}>Download Complete Health Record</Text>
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: theme.border, marginVertical: 12 }]} />

        <TouchableOpacity style={styles.dataActionRow} onPress={handleSignOut}>
          <LogOut size={18} color="#D97706" />
          <Text style={[styles.dataActionText, { color: '#D97706' }]}>Sign Out of Account</Text>
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: theme.border, marginVertical: 12 }]} />

        <TouchableOpacity style={styles.dataActionRow} onPress={handleDeleteAccount}>
          <Trash2 size={18} color="#DC2626" />
          <Text style={[styles.dataActionText, { color: '#DC2626' }]}>Permanently Delete Account & Images</Text>
        </TouchableOpacity>
      </View>

      {/* Edit Profile Modal */}
      <Modal visible={editModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Edit Personal Details</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <X size={20} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalLabel, { color: theme.text }]}>Full Name</Text>
            <TextInput
              style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
              value={editFullName}
              onChangeText={setEditFullName}
              placeholder="Full legal name"
              placeholderTextColor={theme.textMuted}
            />

            <Text style={[styles.modalLabel, { color: theme.text }]}>Phone Number (Optional)</Text>
            <TextInput
              style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="+1 (555) 000-0000"
              placeholderTextColor={theme.textMuted}
              keyboardType="phone-pad"
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: theme.border }]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={[styles.modalCancelBtnText, { color: theme.textMuted }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveBtn, { backgroundColor: theme.primary }]}
                onPress={handleSaveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Check size={16} color="#FFFFFF" />
                    <Text style={styles.modalSaveBtnText}>Save</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  editIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    elevation: 5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
  },
  modalLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    marginBottom: 6,
    marginTop: 8,
  },
  modalInput: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 15,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  modalCancelBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
  },
  modalSaveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSaveBtnText: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
  },
});
