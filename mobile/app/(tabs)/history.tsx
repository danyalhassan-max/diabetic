import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { Calendar, Eye, FileText, ChevronRight, CheckCircle, AlertTriangle, RefreshCw, Clock } from 'lucide-react-native';

import Colors, { SeverityColors } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

interface ScanItem {
  id: string;
  patient_id: string;
  created_at: string;
  eye: 'OD' | 'OS';
  grade: number;
  label: string;
  probabilities?: number[];
  storage_path?: string;
  patient_notes?: string | null;
  model_version?: string;
}

export default function HistoryScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { user, profile } = useAuth();

  const [scans, setScans] = useState<ScanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filterEye, setFilterEye] = useState<'ALL' | 'OD' | 'OS'>('ALL');

  const fetchScans = useCallback(async (isRefresh = false) => {
    if (!user?.id) return;
    if (!isRefresh) setLoading(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase
        .from('scans')
        .select('*')
        .eq('patient_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        setErrorMessage(error.message);
      } else if (data) {
        setScans(data as ScanItem[]);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to retrieve scan records.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchScans();
  }, [fetchScans]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchScans(true);
  };

  const filteredScans = scans.filter((scan) => {
    if (filterEye === 'ALL') return true;
    return scan.eye === filterEye;
  });

  const getSeverity = (grade: number) => {
    switch (grade) {
      case 0: return SeverityColors.grade0;
      case 1: return SeverityColors.grade1;
      case 2: return SeverityColors.grade2;
      case 3: return SeverityColors.grade3;
      case 4: return SeverityColors.grade4;
      default: return SeverityColors.grade0;
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const handleExportPDF = async () => {
    if (scans.length === 0) {
      Alert.alert('No Data to Export', 'There are no retinal scans recorded to generate a longitudinal PDF.');
      return;
    }

    setExportingPdf(true);

    try {
      const patientName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Patient';
      const patientId = `DRC-${(user?.id || '00000000').slice(0, 8).toUpperCase()}`;
      const reportDate = new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const rowsHtml = scans
        .map((scan, idx) => {
          const eyeLabel = scan.eye === 'OD' ? 'Right Eye (OD)' : 'Left Eye (OS)';
          const badgeColor =
            scan.grade === 0 ? '#10B981' :
            scan.grade === 1 ? '#F59E0B' :
            scan.grade === 2 ? '#EA580C' :
            scan.grade === 3 ? '#DC2626' : '#991B1B';

          return `
            <tr style="border-bottom: 1px solid #E2E8F0; background-color: ${idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
              <td style="padding: 10px; font-size: 12px; color: #334155;">${formatDate(scan.created_at)}</td>
              <td style="padding: 10px; font-size: 12px; font-weight: 600; color: #0F172A;">${eyeLabel}</td>
              <td style="padding: 10px; text-align: center;">
                <span style="display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; color: #FFFFFF; background-color: ${badgeColor};">
                  Grade ${scan.grade}
                </span>
              </td>
              <td style="padding: 10px; font-size: 12px; color: #1E293B;">${scan.label}</td>
              <td style="padding: 10px; font-size: 11px; color: #64748B;">${scan.patient_notes || 'Routine screening'}</td>
            </tr>
          `;
        })
        .join('');

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Clinical Retinal Screening Report</title>
          <style>
            @page { margin: 20mm 16mm; size: A4; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0F172A; margin: 0; padding: 20px; font-size: 13px; line-height: 1.5; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #007A87; padding-bottom: 16px; margin-bottom: 20px; }
            .title-area h1 { margin: 0; font-size: 22px; color: #007A87; }
            .title-area p { margin: 4px 0 0; font-size: 12px; color: #64748B; }
            .badge-ai { background-color: #E0F2FE; color: #0284C7; font-weight: 700; padding: 4px 10px; border-radius: 6px; font-size: 11px; display: inline-block; margin-bottom: 6px; }
            .patient-card { background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px; display: table; width: 100%; box-sizing: border-box; }
            .patient-col { display: table-cell; vertical-align: top; width: 50%; }
            .patient-field { margin-bottom: 6px; }
            .field-label { font-size: 11px; color: #64748B; font-weight: 600; text-transform: uppercase; }
            .field-value { font-size: 13px; color: #0F172A; font-weight: 700; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
            th { background-color: #007A87; color: #FFFFFF; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 10px; text-align: left; }
            .guidance-box { background-color: #F0FDFA; border-left: 4px solid #007A87; padding: 12px 16px; border-radius: 4px; margin-bottom: 24px; }
            .guidance-title { font-weight: 700; color: #007A87; margin-bottom: 4px; font-size: 13px; }
            .guidance-body { font-size: 12px; color: #134E4A; line-height: 1.5; }
            .signoff-box { border: 1px solid #CBD5E1; border-radius: 8px; padding: 16px; margin-top: 28px; }
            .signoff-title { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #334155; margin-bottom: 12px; }
            .signoff-row { display: table; width: 100%; margin-top: 14px; }
            .signoff-col { display: table-cell; width: 50%; vertical-align: bottom; }
            .sig-line { border-bottom: 1px solid #94A3B8; width: 85%; height: 24px; margin-bottom: 4px; }
            .sig-label { font-size: 11px; color: #64748B; }
            .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #94A3B8; border-top: 1px solid #E2E8F0; padding-top: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title-area">
              <span class="badge-ai">CLINICAL SCREENING REPORT</span>
              <h1>Diabetic Retinopathy Longitudinal Evaluation</h1>
              <p>AI Diagnostic Engine: DenseNet-121 Ordinal Classifier (Version: densenet121_ordinal_v1)</p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; font-size: 11px; color: #64748B;">Date Issued</p>
              <p style="margin: 2px 0 0; font-size: 12px; font-weight: 700; color: #0F172A;">${reportDate}</p>
            </div>
          </div>

          <div class="patient-card">
            <div class="patient-col">
              <div class="patient-field">
                <div class="field-label">Patient Full Name</div>
                <div class="field-value">${patientName}</div>
              </div>
              <div class="patient-field">
                <div class="field-label">Medical Record / Patient ID</div>
                <div class="field-value">${patientId}</div>
              </div>
            </div>
            <div class="patient-col">
              <div class="patient-field">
                <div class="field-label">Account Email</div>
                <div class="field-value">${user?.email || 'N/A'}</div>
              </div>
              <div class="patient-field">
                <div class="field-label">Documented Screenings</div>
                <div class="field-value">${scans.length} Examination(s) Recorded</div>
              </div>
            </div>
          </div>

          <h3 style="font-size: 14px; color: #0F172A; margin: 0 0 10px;">Screening Examination History</h3>
          <table>
            <thead>
              <tr>
                <th style="width: 22%;">Date / Time</th>
                <th style="width: 18%;">Eye</th>
                <th style="width: 14%; text-align: center;">AI Grade</th>
                <th style="width: 28%;">Diagnostic Classification</th>
                <th style="width: 18%;">Clinical Notes</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="guidance-box">
            <div class="guidance-title">Clinical Scale Reference (ICDRS Guidelines)</div>
            <div class="guidance-body">
              <strong>Grade 0:</strong> No Retinopathy | <strong>Grade 1:</strong> Mild NPDR (Microaneurysms only) | <strong>Grade 2:</strong> Moderate NPDR (Microaneurysms + exudates/hemorrhages) | <strong>Grade 3:</strong> Severe NPDR (4-2-1 criteria) | <strong>Grade 4:</strong> Proliferative Diabetic Retinopathy (Neovascularization, vitreous hemorrhage).
            </div>
          </div>

          <div class="signoff-box">
            <div class="signoff-title">Attending Clinician / Ophthalmologist Second Opinion</div>
            <p style="margin: 0 0 8px; font-size: 11px; color: #475569;">
              I certify that I have inspected the retinal fundus imaging records compiled herein.
            </p>
            <div class="signoff-row">
              <div class="signoff-col">
                <div class="sig-line"></div>
                <div class="sig-label">Clinician Signature / Seal</div>
              </div>
              <div class="signoff-col">
                <div class="sig-line"></div>
                <div class="sig-label">Date & Medical License Number</div>
              </div>
            </div>
          </div>

          <div class="footer">
            CONFIDENTIAL MEDICAL REPORT &bull; Generated by Diabetic Retinopathy Screening System &bull; Compliant with Clinical Health Record Standards
          </div>
        </body>
        </html>
      `;

      // 1. Web: Directly trigger browser print dialog to avoid local file scheme restrictions
      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
        return;
      }

      // 2. Native mobile: Generate PDF file
      const { uri } = await Print.printToFileAsync({ html });

      // 3. Ensure file is in app's accessible cache directory so Android FilePermissionService permits reading
      let shareUri = uri;
      try {
        if (FileSystem.cacheDirectory) {
          const destinationUri = `${FileSystem.cacheDirectory}clinical_retinal_summary_${Date.now()}.pdf`;
          await FileSystem.copyAsync({
            from: uri,
            to: destinationUri,
          });
          shareUri = destinationUri;
        }
      } catch (copyErr) {
        console.warn('FileSystem copy notice:', copyErr);
      }

      // 4. Try native sharing, fallback gracefully to system Print/Save dialog if sharing is rejected
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        try {
          await Sharing.shareAsync(shareUri, {
            UTI: 'com.adobe.pdf',
            mimeType: 'application/pdf',
            dialogTitle: 'Export Clinical Retinal Summary',
          });
        } catch (shareErr: any) {
          console.warn('Sharing failed, falling back to Print:', shareErr);
          // Native Print dialog allows user to "Save as PDF" directly
          await Print.printAsync({ html });
        }
      } else {
        await Print.printAsync({ html });
      }
    } catch (err: any) {
      Alert.alert('PDF Export Notice', err.message || 'Could not compile clinical PDF summary.');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleViewScan = (scan: ScanItem) => {
    Alert.alert(
      `Scan Record (${scan.eye === 'OD' ? 'Right Eye - OD' : 'Left Eye - OS'})`,
      `Diagnostic Grade: Grade ${scan.grade}\nClassification: ${scan.label}\nCaptured: ${formatDate(scan.created_at)}\nStorage Path: ${scan.storage_path || 'Local Device'}`
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
    >
      {/* Overview Card */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
        <Text style={[styles.title, { color: theme.text }]}>Longitudinal Eye Tracking</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          Review progression across previous retinal examinations and export clinical reports.
        </Text>

        <TouchableOpacity
          style={[
            styles.exportBtn,
            { borderColor: theme.primary },
            exportingPdf && { opacity: 0.6 },
          ]}
          onPress={handleExportPDF}
          disabled={exportingPdf || loading}
          accessibilityLabel="Export Clinical PDF Summary"
        >
          {exportingPdf ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <FileText size={18} color={theme.primary} />
          )}
          <Text style={[styles.exportBtnText, { color: theme.primary }]}>
            {exportingPdf ? 'Compiling Clinical PDF...' : 'Export Clinical PDF Summary'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['ALL', 'OD', 'OS'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.filterTab,
              filterEye === tab && { backgroundColor: theme.primary },
            ]}
            onPress={() => setFilterEye(tab)}
          >
            <Text
              style={[
                styles.filterTabText,
                filterEye === tab && styles.filterTabTextActive,
              ]}
            >
              {tab === 'ALL' ? `All Eyes (${scans.length})` : tab === 'OD' ? 'Right Eye (OD)' : 'Left Eye (OS)'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Loading Indicator */}
      {loading && !refreshing && (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.stateText, { color: theme.textMuted }]}>Loading retinal scan history...</Text>
        </View>
      )}

      {/* Error Message with Retry */}
      {!loading && errorMessage && (
        <View style={[styles.errorCard, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
          <AlertTriangle size={20} color="#DC2626" />
          <View style={{ flex: 1 }}>
            <Text style={styles.errorTitle}>Could not load scans</Text>
            <Text style={styles.errorSub}>{errorMessage}</Text>
          </View>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchScans()}>
            <RefreshCw size={14} color="#FFFFFF" />
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Empty State */}
      {!loading && !errorMessage && filteredScans.length === 0 && (
        <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}>
          <Clock size={40} color={theme.textMuted} style={{ marginBottom: 12 }} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No Retinal Scans Found</Text>
          <Text style={[styles.emptySub, { color: theme.textMuted }]}>
            {filterEye === 'ALL'
              ? 'When you capture and grade a retinal fundus photograph in the Screening tab, your diagnostic records will appear here.'
              : `No scans recorded for ${filterEye === 'OD' ? 'Right Eye (OD)' : 'Left Eye (OS)'}.`}
          </Text>
        </View>
      )}

      {/* List of Scans */}
      {!loading &&
        filteredScans.map((scan) => {
          const severity = getSeverity(scan.grade);
          return (
            <View
              key={scan.id}
              style={[styles.scanCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}
            >
              <View style={styles.scanTopRow}>
                <View style={styles.scanDateRow}>
                  <Calendar size={14} color={theme.textMuted} />
                  <Text style={[styles.scanDate, { color: theme.textMuted }]}>{formatDate(scan.created_at)}</Text>
                </View>
                <View style={[styles.eyeBadge, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                  <Eye size={12} color={theme.primary} />
                  <Text style={[styles.eyeBadgeText, { color: theme.primary }]}>
                    {scan.eye === 'OD' ? 'Right Eye (OD)' : 'Left Eye (OS)'}
                  </Text>
                </View>
              </View>

              <View style={styles.scanBodyRow}>
                <View style={[styles.gradePill, { backgroundColor: severity.badgeBg, borderColor: severity.badgeBorder }]}>
                  {scan.grade === 0 ? (
                    <CheckCircle size={14} color={severity.indicator} />
                  ) : (
                    <AlertTriangle size={14} color={severity.indicator} />
                  )}
                  <Text style={[styles.gradePillText, { color: severity.text }]}>
                    Grade {scan.grade}: {severity.label}
                  </Text>
                </View>
              </View>

              {scan.patient_notes && (
                <Text style={[styles.scanNotes, { color: theme.textMuted }]}>{scan.patient_notes}</Text>
              )}

              <TouchableOpacity
                style={[styles.scanFooter, { borderTopColor: theme.border }]}
                onPress={() => handleViewScan(scan)}
              >
                <Text style={[styles.viewDetailsText, { color: theme.primary }]}>View Diagnostic Details</Text>
                <ChevronRight size={16} color={theme.primary} />
              </TouchableOpacity>
            </View>
          );
        })}
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
    elevation: 2,
    shadowColor: '#0F1E36',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  exportBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterTab: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
  },
  filterTabText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: '#475569',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  scanCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  scanTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  scanDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scanDate: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
  },
  eyeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  eyeBadgeText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
  },
  scanBodyRow: {
    marginBottom: 8,
  },
  gradePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  gradePillText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
  },
  scanNotes: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  scanFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
  },
  viewDetailsText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
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
  emptyCard: {
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
