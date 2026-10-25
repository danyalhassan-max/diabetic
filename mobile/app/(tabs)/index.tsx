import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Image as ImageIcon, CheckCircle, AlertTriangle, Info, RefreshCw } from 'lucide-react-native';

import Colors, { SeverityColors } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { INFERENCE_API_URL } from '@/lib/supabase';

interface PredictionResult {
  grade: number;
  label: string;
  probabilities: number[];
  model_version: string;
}

export default function ScreeningScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [selectedEye, setSelectedEye] = useState<'OD' | 'OS'>('OD');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);

  const pickImage = async (useCamera: boolean) => {
    try {
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
        base64: true,
      };

      let pickerResult;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Camera permission is required to capture retinal images.');
          return;
        }
        pickerResult = await ImagePicker.launchCameraAsync(options);
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Photo library permission is required to select retinal images.');
          return;
        }
        pickerResult = await ImagePicker.launchImageLibraryAsync(options);
      }

      if (!pickerResult.canceled && pickerResult.assets && pickerResult.assets.length > 0) {
        const asset = pickerResult.assets[0];
        setImageUri(asset.uri);
        setImageBase64(asset.base64 || null);
        setResult(null); // Reset previous prediction
      }
    } catch (err: any) {
      Alert.alert('Selection Error', err.message || 'Could not select image.');
    }
  };

  const runDiagnosticInference = async () => {
    if (!imageUri) {
      Alert.alert('Missing Image', 'Please capture or choose a fundus photograph first.');
      return;
    }

    setLoading(true);
    try {
      let response;
      if (imageBase64) {
        // Send fast JSON base64 payload
        response = await fetch(`${INFERENCE_API_URL}/api/predict`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Bypass-Tunnel-Reminder': 'true',
          },
          body: JSON.stringify({ image: imageBase64 }),
        });
      } else {
        // Multipart fallback
        const formData = new FormData();
        formData.append('image', {
          uri: imageUri,
          name: 'fundus.jpg',
          type: 'image/jpeg',
        } as any);

        response = await fetch(`${INFERENCE_API_URL}/api/predict`, {
          method: 'POST',
          headers: {
            'Bypass-Tunnel-Reminder': 'true',
          },
          body: formData,
        });
      }

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Diagnostic inference failed.');
      }

      setResult({
        grade: data.grade,
        label: data.label,
        probabilities: data.probabilities,
        model_version: data.model_version,
      });
    } catch (err: any) {
      Alert.alert('Inference Failed', `${err.message}\nMake sure the AI backend is active on ${INFERENCE_API_URL}.`);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityStyle = (grade: number) => {
    switch (grade) {
      case 0: return SeverityColors.grade0;
      case 1: return SeverityColors.grade1;
      case 2: return SeverityColors.grade2;
      case 3: return SeverityColors.grade3;
      case 4: return SeverityColors.grade4;
      default: return SeverityColors.grade0;
    }
  };

  const getClinicalAdvice = (grade: number) => {
    switch (grade) {
      case 0:
        return 'No diabetic retinopathy lesions detected. Maintain glycemic control (HbA1c < 7%) and schedule a routine screening in 12 months.';
      case 1:
        return 'Mild microaneurysms detected. Maintain tight blood glucose and blood pressure control. Routine follow-up recommended in 6–12 months.';
      case 2:
        return 'Moderate non-proliferative changes identified. Formal dilated eye examination by an eye specialist recommended within 3 months.';
      case 3:
        return 'Severe retinopathy findings detected. Prompt consultation with an ophthalmologist or retinal specialist recommended within 2–4 weeks.';
      case 4:
        return 'High-risk proliferative diabetic retinopathy detected. Urgent ophthalmic referral required for evaluation of photocoagulation or anti-VEGF therapy.';
      default:
        return 'Follow up with your healthcare provider.';
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header Banner */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
        <Text style={[styles.title, { color: theme.text }]}>Automated Retinal Screening</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          Upload or capture a retinal fundus photograph to receive an AI-assisted diagnostic grade.
        </Text>

        {/* Eye Selection Toggle */}
        <View style={styles.eyeSelectorRow}>
          <Text style={[styles.selectorLabel, { color: theme.text }]}>Target Eye:</Text>
          <View style={styles.toggleGroup}>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                selectedEye === 'OD' && { backgroundColor: theme.primary },
              ]}
              onPress={() => setSelectedEye('OD')}
            >
              <Text style={[styles.toggleText, selectedEye === 'OD' && styles.toggleTextActive]}>
                Right Eye (OD)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.toggleBtn,
                selectedEye === 'OS' && { backgroundColor: theme.primary },
              ]}
              onPress={() => setSelectedEye('OS')}
            >
              <Text style={[styles.toggleText, selectedEye === 'OS' && styles.toggleTextActive]}>
                Left Eye (OS)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Image Preview or Placeholder */}
        {imageUri ? (
          <View style={styles.previewContainer}>
            <Image source={{ uri: imageUri }} style={styles.fundusPreview} resizeMode="cover" />
            <TouchableOpacity style={styles.changeImageBtn} onPress={() => pickImage(false)}>
              <RefreshCw size={16} color="#FFFFFF" />
              <Text style={styles.changeImageText}>Replace Image</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.placeholderBox, { borderColor: theme.border }]}>
            <ImageIcon size={44} color={theme.primary} />
            <Text style={[styles.placeholderText, { color: theme.textMuted }]}>
              No retinal photo selected
            </Text>
            <Text style={[styles.placeholderSubtext, { color: theme.textMuted }]}>
              JPEG or PNG • Centered on optic disc or macula
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.secondaryBtn, { borderColor: theme.primary }]}
            onPress={() => pickImage(false)}
          >
            <ImageIcon size={18} color={theme.primary} />
            <Text style={[styles.actionBtnText, { color: theme.primary }]}>Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.secondaryBtn, { borderColor: theme.primary }]}
            onPress={() => pickImage(true)}
          >
            <Camera size={18} color={theme.primary} />
            <Text style={[styles.actionBtnText, { color: theme.primary }]}>Camera</Text>
          </TouchableOpacity>
        </View>

        {imageUri && (
          <TouchableOpacity
            style={[styles.primarySubmitBtn, { backgroundColor: theme.primary }]}
            onPress={runDiagnosticInference}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primarySubmitText}>Run AI Diagnostic Assessment</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Results Section */}
      {result && (
        <View style={[styles.card, styles.resultCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
          <View style={styles.resultHeader}>
            <View
              style={[
                styles.severityBadge,
                {
                  backgroundColor: getSeverityStyle(result.grade).badgeBg,
                  borderColor: getSeverityStyle(result.grade).badgeBorder,
                },
              ]}
            >
              {result.grade === 0 ? (
                <CheckCircle size={16} color={getSeverityStyle(result.grade).indicator} />
              ) : (
                <AlertTriangle size={16} color={getSeverityStyle(result.grade).indicator} />
              )}
              <Text style={[styles.severityBadgeText, { color: getSeverityStyle(result.grade).text }]}>
                {getSeverityStyle(result.grade).label}
              </Text>
            </View>
            <Text style={[styles.eyeTag, { color: theme.textMuted }]}>
              Eye: {selectedEye === 'OD' ? 'Right (OD)' : 'Left (OS)'}
            </Text>
          </View>

          <Text style={[styles.resultGradeTitle, { color: theme.text }]}>
            Grade {result.grade} Assessment
          </Text>
          <Text style={[styles.resultFullLabel, { color: theme.textMuted }]}>{result.label}</Text>

          {/* Advice Box */}
          <View style={styles.adviceBox}>
            <Text style={styles.adviceHeader}>Clinical Recommendation:</Text>
            <Text style={styles.adviceBody}>{getClinicalAdvice(result.grade)}</Text>
          </View>

          {/* Probability Breakdown */}
          <View style={styles.probContainer}>
            <Text style={[styles.probTitle, { color: theme.text }]}>Cumulative Threshold Scores:</Text>
            {result.probabilities.map((prob, idx) => (
              <View key={idx} style={styles.probRow}>
                <Text style={[styles.probLabel, { color: theme.textMuted }]}>Grade ≥ {idx}:</Text>
                <View style={styles.barBg}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${Math.min(100, Math.round(prob * 100))}%`,
                        backgroundColor: prob >= 0.5 ? theme.primary : '#94A3B8',
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.probVal, { color: theme.text }]}>{(prob * 100).toFixed(1)}%</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Persistent Medical Disclaimer */}
      <View style={[styles.disclaimerBox, { borderColor: '#FDE68A' }]}>
        <Info size={18} color="#D97706" style={{ marginTop: 2 }} />
        <Text style={styles.disclaimerText}>
          <Text style={{ fontWeight: '700' }}>Clinical AI Notice: </Text>
          This application provides automated screening assistance and is not a substitute for clinical examination or diagnosis by an eye-care professional.
        </Text>
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
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#0F1E36',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  eyeSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  selectorLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
  },
  toggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    padding: 3,
  },
  toggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  toggleText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: '#475569',
  },
  toggleTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  placeholderBox: {
    height: 180,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
    backgroundColor: 'rgba(0, 122, 135, 0.02)',
  },
  placeholderText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    marginTop: 8,
  },
  placeholderSubtext: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    marginTop: 4,
  },
  previewContainer: {
    position: 'relative',
    marginVertical: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  fundusPreview: {
    width: '100%',
    height: 240,
    borderRadius: 12,
  },
  changeImageBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 30, 54, 0.85)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  changeImageText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  secondaryBtn: {
    backgroundColor: 'transparent',
  },
  actionBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
  },
  primarySubmitBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primarySubmitText: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
  },
  resultCard: {
    borderColor: '#99F6E4',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  severityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  severityBadgeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  eyeTag: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
  },
  resultGradeTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 22,
    marginBottom: 4,
  },
  resultFullLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    marginBottom: 14,
  },
  adviceBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#007A87',
    marginBottom: 16,
  },
  adviceHeader: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: '#0F1E36',
    marginBottom: 4,
  },
  adviceBody: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: '#334155',
  },
  probContainer: {
    marginTop: 8,
  },
  probTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    marginBottom: 8,
  },
  probRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  probLabel: {
    width: 80,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
  },
  barBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  probVal: {
    width: 45,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    textAlign: 'right',
  },
  disclaimerBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFFBEB',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 32,
  },
  disclaimerText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    lineHeight: 17,
    color: '#92400E',
  },
});
