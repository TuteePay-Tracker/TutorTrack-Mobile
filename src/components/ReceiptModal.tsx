import React from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { formatDate } from '../utils/formatDate';

export interface ReceiptItem {
  id: string;
  receiptNumber?: string;
  tuteeName: string;
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  status?: string;
  coverageType?: 'full' | 'partial';
  notes?: string;
  daysPaid?: Array<{ date: string; amountDue: number; amountPaid: number; status: string }>;
}

interface ReceiptModalProps {
  visible: boolean;
  receipt: ReceiptItem | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ visible, receipt, onClose }) => {
  if (!receipt) return null;

  const receiptNumber = receipt.receiptNumber || (receipt.id ? receipt.id.slice(-8).toUpperCase() : 'RECEIPT');
  const isFull = receipt.coverageType !== 'partial';

  const formatMoney = (val: number) => {
    return `₱${(Number(val) || 0).toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getGeneratedTime = () => {
    const now = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[now.getMonth()];
    const day = now.getDate();
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${month} ${day}, ${year} ${hours}:${minutes}`;
  };

  const rows = receipt.daysPaid && receipt.daysPaid.length > 0
    ? receipt.daysPaid
    : [
        {
          date: receipt.paymentDate,
          amountDue: receipt.amount,
          amountPaid: receipt.amount,
          status: isFull ? 'paid' : 'partial',
        },
      ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Close Icon Button */}
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialCommunityIcons name="close" size={22} color="#6b7280" />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.brandTitle}>Tutor Track</Text>
              <Text style={styles.receiptTitle}>Payment Receipt</Text>
              <Text style={styles.receiptNumber}>Receipt #: {receiptNumber}</Text>
            </View>

            <View style={styles.divider} />

            {/* Student & Date */}
            <View style={styles.twoColumnRow}>
              <View style={styles.colLeft}>
                <Text style={styles.fieldLabel}>STUDENT NAME</Text>
                <Text style={styles.fieldValue}>{receipt.tuteeName || 'Student'}</Text>
              </View>
              <View style={styles.colRight}>
                <Text style={[styles.fieldLabel, styles.alignRight]}>PAYMENT DATE</Text>
                <Text style={[styles.fieldValue, styles.alignRight]}>{formatDate(receipt.paymentDate)}</Text>
              </View>
            </View>

            {/* Payment Details Section */}
            <Text style={[styles.fieldLabel, { marginTop: 18, marginBottom: 8 }]}>PAYMENT DETAILS</Text>
            <View style={styles.tableCard}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, { flex: 2.2 }]}>DATE</Text>
                <Text style={[styles.tableHeaderCell, { flex: 2, textAlign: 'right' }]}>AMOUNT DUE</Text>
                <Text style={[styles.tableHeaderCell, { flex: 2.2, textAlign: 'right' }]}>AMOUNT PAID</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1.6, textAlign: 'right' }]}>STATUS</Text>
              </View>

              {rows.map((row, idx) => {
                const isRowFull = row.status === 'paid' || row.status === 'Full';
                return (
                  <View
                    key={idx}
                    style={[
                      styles.tableRow,
                      idx > 0 && styles.tableRowBorder,
                    ]}
                  >
                    <Text style={[styles.tableCellDate, { flex: 2.2 }]}>{formatDate(row.date)}</Text>
                    <Text style={[styles.tableCellDue, { flex: 2, textAlign: 'right' }]}>
                      {formatMoney(row.amountDue)}
                    </Text>
                    <Text style={[styles.tableCellPaid, { flex: 2.2, textAlign: 'right' }]}>
                      {formatMoney(row.amountPaid)}
                    </Text>
                    <View style={{ flex: 1.6, alignItems: 'flex-end' }}>
                      <View style={[styles.statusPill, isRowFull ? styles.statusPillPaid : styles.statusPillPartial]}>
                        <Text style={[styles.statusPillText, isRowFull ? styles.statusTextPaid : styles.statusTextPartial]}>
                          {isRowFull ? 'Full' : 'Partial'}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Total Amount Paid */}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Amount Paid</Text>
              <Text style={styles.totalValue}>{formatMoney(receipt.amount)}</Text>
            </View>

            {/* Payment Method & Type */}
            <View style={styles.twoColumnRow}>
              <View style={styles.colLeft}>
                <Text style={styles.fieldLabel}>PAYMENT METHOD</Text>
                <Text style={styles.fieldValue}>{receipt.paymentMethod || 'Cash'}</Text>
              </View>
              <View style={styles.colRight}>
                <Text style={[styles.fieldLabel, styles.alignRight]}>PAYMENT TYPE</Text>
                <View style={styles.typeBadgeContainer}>
                  <View style={[styles.typeBadge, isFull ? styles.typeBadgeFull : styles.typeBadgePartial]}>
                    <Text style={[styles.typeBadgeText, isFull ? styles.typeTextFull : styles.typeTextPartial]}>
                      {isFull ? 'Full Payment' : 'Partial Payment'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Notes if available */}
            {receipt.notes ? (
              <View style={styles.notesSection}>
                <Text style={styles.fieldLabel}>NOTES</Text>
                <View style={styles.notesBox}>
                  <Text style={styles.notesText}>{receipt.notes}</Text>
                </View>
              </View>
            ) : null}

            {/* Footer */}
            <View style={styles.footerSection}>
              <Text style={styles.footerThanks}>Thank you for your payment!</Text>
              <Text style={styles.footerGenerated}>Generated on {getGeneratedTime()}</Text>
            </View>
          </ScrollView>

          {/* Close Action Button */}
          <TouchableOpacity onPress={onClose} style={styles.closeActionButton} activeOpacity={0.8}>
            <Text style={styles.closeActionText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 8,
  },
  header: {
    alignItems: 'center',
    paddingTop: 8,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  receiptTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginTop: 2,
  },
  receiptNumber: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 18,
  },
  twoColumnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  colLeft: {
    flex: 1,
    paddingRight: 8,
  },
  colRight: {
    flex: 1,
    paddingLeft: 8,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  fieldValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 3,
  },
  alignRight: {
    textAlign: 'right',
  },
  tableCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    marginTop: 2,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tableHeaderCell: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: '#ffffff',
  },
  tableRowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  tableCellDate: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1e293b',
  },
  tableCellDue: {
    fontSize: 11,
    color: '#64748b',
  },
  tableCellPaid: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
  },
  statusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  statusPillPaid: {
    backgroundColor: '#dcfce7',
  },
  statusPillPartial: {
    backgroundColor: '#ffedd5',
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: '800',
  },
  statusTextPaid: {
    color: '#15803d',
  },
  statusTextPartial: {
    color: '#c2410c',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#047857',
  },
  typeBadgeContainer: {
    alignItems: 'flex-end',
    marginTop: 4,
  },
  typeBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  typeBadgeFull: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  typeBadgePartial: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  typeTextFull: {
    color: '#047857',
  },
  typeTextPartial: {
    color: '#c2410c',
  },
  notesSection: {
    marginTop: 14,
  },
  notesBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 8,
    marginTop: 4,
  },
  notesText: {
    fontSize: 11,
    color: '#475569',
  },
  footerSection: {
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  footerThanks: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  footerGenerated: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 3,
  },
  closeActionButton: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  closeActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
});
