import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Card, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useTabBarHeight } from '../../src/hooks/useTabBarHeight';
import { useAuth } from '../../src/hooks/useAuth';
import { useTutees } from '../../src/hooks/useTutees';
import { paymentService, PaymentTransaction } from '../../src/services/paymentService';
import { formatCurrency } from '../../src/utils/formatCurrency';
import { formatDate } from '../../src/utils/formatDate';
import { EmptyState } from '../../src/components/EmptyState';

export default function PaymentsScreen() {
  const { user } = useAuth();
  const { tutees } = useTutees();
  const tabBarHeight = useTabBarHeight();
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [paidMap, setPaidMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.createdByTutorId || tutees.length === 0) {
      setLoading(false);
      return;
    }
    const tutorId = user.createdByTutorId;

    const cleanups: (() => void)[] = [];
    const allTransactions: PaymentTransaction[] = [];

    tutees.forEach((tutee) => {
      const unsub = paymentService.subscribeTransactionsByTuteeList(tutorId, tutee.id, (txns) => {
        const named = txns.map((t) => ({
          ...t,
          tuteeName: tuteeName(tutee),
        }));
        setTransactions((prev) => {
          const others = prev.filter((t) => t.tuteeId !== tutee.id);
          return [...others, ...named];
        });
        setLoading(false);
      });
      cleanups.push(unsub);

      const unsubPaid = paymentService.subscribeTransactionsByTutee(tutorId, tutee.id, (total) => {
        setPaidMap((prev) => ({ ...prev, [tutee.id]: total }));
      });
      cleanups.push(unsubPaid);
    });

    return () => cleanups.forEach((u) => u());
  }, [user?.createdByTutorId, tutees]);

  const tuteeName = (t: any) => `${t.firstName} ${t.surname}`;

  const totalPaid = Object.values(paidMap).reduce((s, v) => s + v, 0);
  const totalOutstanding = Math.round(tutees.reduce((sum, tutee) => {
    const paid = paidMap[tutee.id] || 0;
    const due = (tutee.totalSessions || 0) * (tutee.ratePerSession || 0);
    return sum + Math.max(due - paid, 0);
  }, 0));

  const sorted = [...transactions].sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));

  const perChild = tutees.map((t) => {
    const paid = paidMap[t.id] || 0;
    const due = (t.totalSessions || 0) * (t.ratePerSession || 0);
    return { name: tuteeName(t), paid, balance: Math.max(due - paid, 0) };
  });

  return (
    <>
      <Stack.Screen options={{
        headerShown: true,
        title: '',
        headerTintColor: '#15803d',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#f9fafb' },
        headerLeft: () => (
          <TouchableOpacity onPress={() => from ? router.replace(`/(main)/${from}`) : router.back()} style={{ marginLeft: 4 }}>
            <MaterialCommunityIcons name="chevron-left" size={28} color="#15803d" />
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

        {perChild.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Per Child</Text>
            {perChild.map((c, idx) => (
              <Card key={idx} style={styles.childCard}>
                <Card.Content style={styles.childRow}>
                  <Text style={styles.childName}>{c.name}</Text>
                  <View style={styles.childAmounts}>
                    <Text style={styles.paidText}>Paid: {formatCurrency(c.paid)}</Text>
                    {c.balance > 0 && (
                      <Text style={styles.balanceText}>Due: {formatCurrency(c.balance)}</Text>
                    )}
                  </View>
                </Card.Content>
              </Card>
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>Transactions</Text>
        {sorted.length === 0 ? (
          <EmptyState
            icon="credit-card-outline"
            title="No Transactions"
            message="No payment records available yet."
          />
        ) : (
          sorted.map((txn) => (
            <Card key={txn.id} style={styles.txnCard}>
              <Card.Content style={styles.txnRow}>
                <View style={styles.txnLeft}>
                  <Text style={styles.txnAmount}>{formatCurrency(txn.totalAmount)}</Text>
                  <Text style={styles.txnMeta}>{txn.tuteeName} · {txn.paymentMethod}</Text>
                  {txn.notes && <Text style={styles.txnNotes}>{txn.notes}</Text>}
                </View>
                <Text style={styles.txnDate}>{formatDate(txn.paymentDate)}</Text>
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 110 },
  summaryCard: { marginBottom: 20, borderRadius: 16, elevation: 2, backgroundColor: '#15803d' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 16 },
  summaryItem: { alignItems: 'center', flex: 1, gap: 4 },
  summaryValue: { fontSize: 18, fontWeight: '800', color: '#ffffff' },
  summaryLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase' },
  summaryDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.3)' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 10, marginTop: 4 },
  childCard: { marginBottom: 8, borderRadius: 12, elevation: 1 },
  childRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  childName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  childAmounts: { alignItems: 'flex-end' },
  paidText: { fontSize: 13, fontWeight: '600', color: '#059669' },
  balanceText: { fontSize: 13, fontWeight: '700', color: '#dc2626', marginTop: 2 },
  txnCard: { marginBottom: 8, borderRadius: 12, elevation: 1 },
  txnRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  txnLeft: { flex: 1 },
  txnAmount: { fontSize: 15, fontWeight: '700', color: '#111827' },
  txnMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  txnNotes: { fontSize: 11, color: '#9ca3af', marginTop: 2, fontStyle: 'italic' },
  txnDate: { fontSize: 12, color: '#9ca3af' },
});
