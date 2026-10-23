import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, Modal } from 'react-native';
import { Text, Card, Button, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useTabBarHeight } from '../../src/hooks/useTabBarHeight';
import { useAuth } from '../../src/hooks/useAuth';
import { useTutees } from '../../src/hooks/useTutees';
import { useSchoolYear } from '../../src/contexts/SchoolYearContext';
import { paymentService, PaymentTransaction, MonthlyRecord } from '../../src/services/paymentService';
import { Payment } from '../../src/types/payment';
import { Tutee } from '../../src/types/tutee';
import { formatCurrency } from '../../src/utils/formatCurrency';
import { formatDate } from '../../src/utils/formatDate';
import { EmptyState } from '../../src/components/EmptyState';
import { getTuteeYearTotals, belongsToSchoolYear, isMonthInSchoolYear } from '../../src/utils/schoolYear';
import { ReceiptModal, ReceiptItem } from '../../src/components/ReceiptModal';

type MergedTransaction = {
  id: string;
  tuteeId: string;
  tuteeName: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  notes?: string;
  status?: 'pending' | 'verified' | 'rejected';
  proofUrl?: string;
  rejectionReason?: string;
  source: 'transaction' | 'payment';
  daysPaid?: Array<{ date: string; amountDue: number; amountPaid: number; status: string }>;
  coverageType?: 'full' | 'partial';
};

const STATUS_CONFIG = {
  pending: { color: '#f59e0b', bg: '#fffbeb', label: 'Pending' },
  verified: { color: '#059669', bg: '#f0fdf4', label: 'Verified' },
  rejected: { color: '#dc2626', bg: '#fef2f2', label: 'Rejected' },
};

export default function PaymentsScreen() {
  const { user } = useAuth();
  const { tutees } = useTutees();
  const { selectedYear } = useSchoolYear();
  const tabBarHeight = useTabBarHeight();
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [recordsMap, setRecordsMap] = useState<Record<string, MonthlyRecord[]>>({});
  const [loading, setLoading] = useState(true);
  const [proofViewerUrl, setProofViewerUrl] = useState<string | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptItem | null>(null);

  const focusTuteeId = from?.startsWith('children/') ? from.split('/')[1] : undefined;
  const scopeTutees = focusTuteeId ? tutees.filter((t) => t.id === focusTuteeId) : tutees;
  const focusedTutee = focusTuteeId ? tutees.find((t) => t.id === focusTuteeId) : null;

  useEffect(() => {
    if (!user?.createdByTutorId || scopeTutees.length === 0) {
      setLoading(false);
      return;
    }
    const tutorId = user.createdByTutorId;

    const cleanups: (() => void)[] = [];

    scopeTutees.forEach((tutee) => {
      const unsub = paymentService.subscribeTransactionsByTuteeList(tutorId, tutee.id, (txns) => {
        const filtered = txns
          .filter((t) => belongsToSchoolYear(selectedYear, t))
          .map((t) => ({
            ...t,
            tuteeName: tuteeName(tutee),
          }));
        setTransactions((prev) => {
          const others = prev.filter((t) => t.tuteeId !== tutee.id);
          return [...others, ...filtered];
        });
        setLoading(false);
      });
      cleanups.push(unsub);

      const unsubRecords = paymentService.subscribeRecordsByTutee(tutorId, tutee.id, (recs) => {
        setRecordsMap((prev) => ({
          ...prev,
          [tutee.id]: recs.filter((r) => isMonthInSchoolYear(r.month, selectedYear)),
        }));
      });
      cleanups.push(unsubRecords);
    });

    const unsubPayments = paymentService.subscribeAllPayments(tutorId, scopeTutees.map((t) => t.id), (pays) => {
      setPayments(pays.filter((p) => belongsToSchoolYear(selectedYear, p)));
    });
    cleanups.push(unsubPayments);

    return () => cleanups.forEach((u) => u());
  }, [user?.createdByTutorId, scopeTutees, selectedYear]);

  const tuteeName = (t: any) => `${t.firstName} ${t.surname}`;

  const getTuteeBalance = (tutee: Tutee) => {
    return Math.max(Math.round(getTuteeYearTotals(tutee, selectedYear).balance || 0), 0);
  };

  // Total Paid = canonical per-year totals (tutor cash records + verified parent proof payments)
  const totalPaid = scopeTutees.reduce((s, tutee) =>
    s + Math.round(getTuteeYearTotals(tutee, selectedYear).totalPaid || 0), 0);
  const totalOutstanding = Math.round(scopeTutees.reduce((sum, tutee) => {
    return sum + getTuteeBalance(tutee);
  }, 0));

  // Deduplicate transactions that are already recorded in the payments collection
  const deduplicatedTransactions = transactions.filter((t) => {
    return !payments.some((p) =>
      p.tuteeId === t.tuteeId &&
      p.amount === t.totalAmount &&
      p.paymentDate === t.paymentDate &&
      p.paymentMethod === t.paymentMethod
    );
  });

  const mergedTransactions: MergedTransaction[] = [
    ...deduplicatedTransactions.map((t) => ({
      id: t.id,
      tuteeId: t.tuteeId,
      tuteeName: t.tuteeName,
      amount: t.totalAmount,
      paymentMethod: t.paymentMethod,
      paymentDate: t.paymentDate,
      notes: t.notes,
      daysPaid: t.daysPaid,
      source: 'transaction' as const,
    })),
    ...payments.map((p) => ({
      id: p.id,
      tuteeId: p.tuteeId,
      tuteeName: p.tuteeName,
      amount: p.amount,
      paymentMethod: p.paymentMethod,
      paymentDate: p.paymentDate,
      notes: p.notes,
      status: p.status,
      proofUrl: p.proofUrl,
      rejectionReason: p.rejectionReason,
      coverageType: p.coverageType,
      source: 'payment' as const,
    })),
  ].sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));

  const perChild = focusTuteeId ? [] : scopeTutees.map((t) => {
    const paid = Math.round(getTuteeYearTotals(t, selectedYear).totalPaid || 0);
    const balance = getTuteeBalance(t);
    return { id: t.id, name: tuteeName(t), paid, balance };
  });

  return (
    <>
      <Stack.Screen options={{
        headerShown: true,
        title: focusedTutee ? `${focusedTutee.firstName}'s Payments` : 'Payments',
        headerTintColor: '#2563eb',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#eff6ff' },
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 4 }}>
            <MaterialCommunityIcons name="chevron-left" size={28} color="#2563eb" />
          </TouchableOpacity>
        ),
      }} />
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight }]}>
        <Card style={styles.summaryCard}>
          <Card.Content>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <MaterialCommunityIcons name="cash-check" size={24} color="#ffffff" />
                <Text style={styles.summaryValue}>{formatCurrency(totalPaid)}</Text>
                <Text style={styles.summaryLabel}>Total Paid</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <MaterialCommunityIcons name="cash-remove" size={24} color="#ffffff" />
                <Text style={styles.summaryValue}>{formatCurrency(totalOutstanding)}</Text>
                <Text style={styles.summaryLabel}>Unpaid Balance</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        <Button
          mode="contained"
          onPress={() => router.push(focusTuteeId ? `/(main)/payment-proof?tuteeId=${focusTuteeId}` : '/(main)/payment-proof')}
          icon="cash-plus"
          buttonColor="#2563eb"
          style={styles.submitPaymentButton}
          contentStyle={styles.submitPaymentContent}
          labelStyle={styles.submitPaymentLabel}
        >
          Submit Payment
        </Button>

        {perChild.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Per Child</Text>
            {perChild.map((c) => (
              <TouchableOpacity
                key={c.id}
                onPress={() => c.balance > 0 && router.push(`/(main)/payment-proof?tuteeId=${c.id}`)}
                activeOpacity={c.balance > 0 ? 0.7 : 1}
                disabled={c.balance <= 0}
              >
                <Card style={[styles.childCard, c.balance > 0 && styles.childCardClickable]}>
                  <Card.Content style={styles.childRow}>
                    <View style={styles.childLeft}>
                      <Text style={styles.childName}>{c.name}</Text>
                      {c.balance > 0 && (
                        <Text style={styles.tapHint}>Tap to submit payment</Text>
                      )}
                    </View>
                    <View style={styles.childAmounts}>
                      <Text style={styles.paidText}>Paid: {formatCurrency(c.paid)}</Text>
                      {c.balance > 0 ? (
                        <Text style={styles.balanceText}>Due: {formatCurrency(c.balance)}</Text>
                      ) : (
                        <Text style={styles.paidFullText}>Fully Paid</Text>
                      )}
                    </View>
                  </Card.Content>
                </Card>
              </TouchableOpacity>
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>Transactions</Text>
        {mergedTransactions.length === 0 ? (
          <EmptyState
            icon="credit-card-outline"
            title="No Transactions"
            message="No payment records available yet."
          />
        ) : (
          mergedTransactions.map((txn) => {
            const statusInfo = txn.status ? STATUS_CONFIG[txn.status] : null;
            const canShowReceipt = txn.status === 'verified' || (!txn.status && txn.status !== 'pending' && txn.status !== 'rejected');
            return (
              <Card key={txn.id} style={styles.txnCard}>
                <Card.Content>
                  <View style={styles.txnRow}>
                    <View style={styles.txnLeft}>
                      <View style={styles.txnAmountRow}>
                        <Text style={styles.txnAmount}>{formatCurrency(txn.amount)}</Text>
                        {statusInfo && (
                          <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                            <Text style={[styles.statusText, { color: statusInfo.color }]}>
                              {statusInfo.label}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.txnMeta}>{focusTuteeId ? txn.paymentMethod : `${txn.tuteeName} · ${txn.paymentMethod}`}</Text>
                      {txn.notes && <Text style={styles.txnNotes}>{txn.notes}</Text>}
                      {txn.rejectionReason && txn.status === 'rejected' && (
                        <Text style={styles.rejectionText}>Reason: {txn.rejectionReason}</Text>
                      )}
                    </View>
                    <View style={styles.txnRight}>
                      <Text style={styles.txnDate}>{formatDate(txn.paymentDate)}</Text>
                      {canShowReceipt && (
                        <TouchableOpacity
                          onPress={() => setSelectedReceipt({
                            id: txn.id,
                            tuteeName: txn.tuteeName || (focusedTutee ? `${focusedTutee.firstName} ${focusedTutee.surname}` : 'Student'),
                            paymentDate: txn.paymentDate,
                            amount: txn.amount,
                            paymentMethod: txn.paymentMethod,
                            status: txn.status,
                            coverageType: txn.coverageType,
                            notes: txn.notes,
                            daysPaid: txn.daysPaid,
                          })}
                          style={styles.showReceiptBtn}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.showReceiptText}>show receipt -{'>'}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {txn.proofUrl && (txn.status === 'pending' || txn.status === 'rejected' || txn.status === 'verified') && (
                    <TouchableOpacity
                      onPress={() => setProofViewerUrl(txn.proofUrl!)}
                      style={styles.proofPreview}
                      activeOpacity={0.7}
                    >
                      <Image source={{ uri: txn.proofUrl }} style={styles.proofImage} />
                      <View style={styles.proofOverlay}>
                        <MaterialCommunityIcons name="image-outline" size={14} color="#ffffff" />
                        <Text style={styles.proofOverlayText}>View Proof</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </Card.Content>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Proof Image Viewer */}
      <Modal visible={!!proofViewerUrl} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setProofViewerUrl(null)}
        >
          <View style={styles.modalContent}>
            <TouchableOpacity
              onPress={() => setProofViewerUrl(null)}
              style={styles.modalClose}
            >
              <MaterialCommunityIcons name="close" size={24} color="#ffffff" />
            </TouchableOpacity>
            {proofViewerUrl && (
              <Image
                source={{ uri: proofViewerUrl }}
                style={styles.modalImage}
                resizeMode="contain"
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Payment Receipt Modal */}
      <ReceiptModal
        visible={!!selectedReceipt}
        receipt={selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eff6ff' },
  content: { padding: 16, paddingBottom: 110 },
  summaryCard: { marginBottom: 20, borderRadius: 16, elevation: 2, backgroundColor: '#2563eb' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 16 },
  summaryItem: { alignItems: 'center', flex: 1, gap: 4 },
  summaryValue: { fontSize: 18, fontWeight: '800', color: '#ffffff' },
  summaryLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase' },
  summaryDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.3)' },
  submitPaymentButton: { marginBottom: 20, borderRadius: 12 },
  submitPaymentContent: { paddingVertical: 4 },
  submitPaymentLabel: { fontWeight: '800', fontSize: 15 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 10, marginTop: 4 },
  childCard: { marginBottom: 8, borderRadius: 12, elevation: 1, backgroundColor: '#ffffff' },
  childCardClickable: { borderColor: '#2563eb', borderWidth: 1 },
  childRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  childLeft: { flex: 1 },
  childName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  tapHint: { fontSize: 11, fontWeight: '600', color: '#2563eb', marginTop: 2 },
  childAmounts: { alignItems: 'flex-end' },
  paidText: { fontSize: 13, fontWeight: '600', color: '#059669' },
  paidFullText: { fontSize: 13, fontWeight: '700', color: '#059669', marginTop: 2 },
  balanceText: { fontSize: 13, fontWeight: '700', color: '#dc2626', marginTop: 2 },
  txnCard: { marginBottom: 8, borderRadius: 12, elevation: 1, backgroundColor: '#ffffff' },
  txnRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  txnLeft: { flex: 1 },
  txnAmountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  txnAmount: { fontSize: 15, fontWeight: '700', color: '#111827' },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  txnMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  txnNotes: { fontSize: 11, color: '#9ca3af', marginTop: 2, fontStyle: 'italic' },
  rejectionText: { fontSize: 11, color: '#dc2626', marginTop: 2, fontStyle: 'italic' },
  txnDate: { fontSize: 12, color: '#9ca3af' },
  txnRight: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  showReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingVertical: 2,
  },
  showReceiptText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
  },
  proofPreview: {
    marginTop: 10,
    borderRadius: 8,
    overflow: 'hidden',
    height: 100,
    position: 'relative',
  },
  proofImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  proofOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  proofOverlayText: { fontSize: 11, fontWeight: '600', color: '#ffffff' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    padding: 8,
  },
  modalImage: {
    width: '90%',
    height: '70%',
    borderRadius: 8,
  },
});
