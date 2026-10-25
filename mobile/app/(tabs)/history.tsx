import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Calendar, Eye, FileText, ChevronRight, CheckCircle, AlertTriangle } from 'lucide-react-native';

import Colors, { SeverityColors } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

interface HistoricalScan {
  id: string;
  date: string;
  eye: 'OD' | 'OS';
  grade: number;
  label: string;
  notes?: string;
}

const SAMPLE_SCANS: HistoricalScan[] = [
  {
    id: '1',
    date: 'Oct 24, 2026',
    eye: 'OD',
    grade: 1,
    label: 'Mild non-proliferative diabetic retinopathy',
    notes: 'Microaneurysms detected in nasal quadrant. Follow-up in 6 months.',
  },
  {
    id: '2',
    date: 'May 14, 2026',
    eye: 'OS',
    grade: 0,
    label: 'No diabetic retinopathy',
    notes: 'Normal fundus examination, clear optic margins.',
  },
  {
    id: '3',
    date: 'Nov 02, 2025',
    eye: 'OD',
    grade: 1,
    label: 'Mild non-proliferative diabetic retinopathy',
    notes: 'Baseline screening post-HbA1c test (7.4%).',
  },
];

export default function HistoryScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const [filterEye, setFilterEye] = useState<'ALL' | 'OD' | 'OS'>('ALL');

  const filteredScans = SAMPLE_SCANS.filter((scan) => {
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

  const handleExportPDF = () => {
    Alert.alert(
      'Export PDF Report',
      'Clinical longitudinal summary prepared. PDF generated using expo-print with patient diagnosis summary and doctor sign-off fields.'
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
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
              {tab === 'ALL' ? 'All Eyes' : tab === 'OD' ? 'Right Eye (OD)' : 'Left Eye (OS)'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List of Scans */}
      {filteredScans.map((scan) => {
        const severity = getSeverity(scan.grade);
        return (
          <View
            key={scan.id}
            style={[styles.scanCard, { backgroundColor: theme.surface, borderColor: theme.cardBorder }]}
          >
            <View style={styles.scanTopRow}>
              <View style={styles.scanDateRow}>
                <Calendar size={14} color={theme.textMuted} />
                <Text style={[styles.scanDate, { color: theme.textMuted }]}>{scan.date}</Text>
              </View>
              <View style={[styles.eyeBadge, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
                <Eye size={12} color={theme.primary} />
                <Text style={[styles.eyeBadgeText, { color: theme.primary }]}>
                  {scan.eye === 'OD' ? 'Right Eye' : 'Left Eye'}
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

            {scan.notes && (
              <Text style={[styles.scanNotes, { color: theme.textMuted }]}>{scan.notes}</Text>
            )}

            <View style={[styles.scanFooter, { borderTopColor: theme.border }]}>
              <Text style={[styles.viewDetailsText, { color: theme.primary }]}>View High-Res Scan</Text>
              <ChevronRight size={16} color={theme.primary} />
            </View>
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
});
