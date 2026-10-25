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
} from 'react-native';
import { Calendar, Eye, FileText, ChevronRight, CheckCircle, AlertTriangle, RefreshCw, Clock } from 'lucide-react-native';

import Colors, { SeverityColors } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

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
}

export default function HistoryScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { user } = useAuth();

  const [scans, setScans] = useState<ScanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  const handleExportPDF = () => {
    if (scans.length === 0) {
      Alert.alert('No Data to Export', 'There are no retinal scans recorded to generate a longitudinal PDF.');
      return;
    }
    Alert.alert(
      'Export PDF Report',
      `Longitudinal summary prepared with ${scans.length} screening records for clinical review and doctor sign-off.`
    );
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
          style={[styles.exportBtn, { borderColor: theme.primary }]}
          onPress={handleExportPDF}
        >
          <FileText size={18} color={theme.primary} />
          <Text style={[styles.exportBtnText, { color: theme.primary }]}>
            Export Clinical PDF Summary
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
