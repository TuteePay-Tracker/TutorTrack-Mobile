import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Text,
  Card,
  TextInput,
  ActivityIndicator,
  Button,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../../src/hooks/useAuth';
import { useTutees } from '../../src/hooks/useTutees';
import { useSchoolYear } from '../../src/contexts/SchoolYearContext';
import { paymentService, MonthlyRecord } from '../../src/services/paymentService';
import { Payment, PaymentMethod } from '../../src/types/payment';
import { db } from '../../src/services/firebaseConfig';
import { uploadToCloudinary } from '../../src/services/cloudinaryService';
import { formatCurrency } from '../../src/utils/formatCurrency';
import { getTuteeYearTotals, belongsToSchoolYear, isMonthInSchoolYear } from '../../src/utils/schoolYear';
import { User } from '../../src/types/user';

type MethodKey = 'gcash' | 'maya' | 'bank' | 'other';

const METHOD_LABELS: Record<MethodKey, string> = {
  gcash: 'GCash',
  maya: 'PayMaya',
  bank: 'Bank Transfer',
  other: 'Other',
};

const METHOD_ICONS: Record<MethodKey, string> = {
  gcash: 'cellphone',
  maya: 'cellphone',
  bank: 'bank',
  other: 'dots-horizontal',
};

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const formatMonthLabel = (month: string): string => {
  const [year, monthNum] = month.split('-');
  const monthIdx = parseInt(monthNum, 10) - 1;
  const name = MONTH_NAMES[monthIdx] || month;
  return `${name} ${year}`;
};

const normalizeImageUrl = (url?: string): string => {
  if (!url) return '';
  let normalized = url.trim();
  if (normalized.startsWith('//')) {
    normalized = `https:${normalized}`;
  } else if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }
  if (normalized.includes('cloudinary.com')) {
    normalized = normalized.replace('/image/upload/', '/image/upload/f_png,q_auto/');
  }
  return normalized;
};

export default function PaymentProofScreen() {
  const { tuteeId: preselectedTuteeId } = useLocalSearchParams<{ tuteeId?: string }>();
  const { user } = useAuth();
  const { tutees } = useTutees();
  const { selectedYear } = useSchoolYear();
  const router = useRouter();

  const [selectedTuteeId, setSelectedTuteeId] = useState(preselectedTuteeId || '');
  const [selectedMethod, setSelectedMethod] = useState<MethodKey | ''>('');
  const [payAmount, setPayAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [proofUrl, setProofUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tutorPaymentMethods, setTutorPaymentMethods] = useState<User['paymentMethods']>({});
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(true);
  const [monthRecords, setMonthRecords] = useState<MonthlyRecord[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [qrError, setQrError] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadPaymentMethods = async () => {
      setLoadingPaymentMethods(true);
      try {
        const tutorId = user?.role === 'tutor' ? user.id : user?.createdByTutorId;
        if (user?.role === 'tutor') {
          if (mounted) setTutorPaymentMethods(user.paymentMethods || {});
        }
        if (!tutorId) {
          if (mounted) setTutorPaymentMethods({});
          return;
        }
        const tutorDoc = await getDoc(doc(db, 'users', tutorId));
        if (mounted) {
          setTutorPaymentMethods(tutorDoc.exists() ? tutorDoc.data().paymentMethods || {} : {});
        }
      } catch (err) {
        console.error('Error fetching tutor payment details:', err);
      } finally {
        if (mounted) setLoadingPaymentMethods(false);
      }
    };
    loadPaymentMethods();
    return () => {
      mounted = false;
    };
  }, [user?.role, user?.createdByTutorId, user?.id, user?.paymentMethods]);

  const paymentMethods = tutorPaymentMethods;
  const enabledMethods: MethodKey[] = (['gcash', 'maya', 'bank', 'other'] as MethodKey[]).filter(
    (m) => paymentMethods?.[m]?.enabled
  );

  const selectedTutee = tutees.find((t) => t.id === selectedTuteeId);
  const balance = selectedTutee
    ? Math.max(Math.round(getTuteeYearTotals(selectedTutee, selectedYear).balance || 0), 0)
    : 0;

  useEffect(() => {
    if (enabledMethods.length > 0 && !selectedMethod) {
      setSelectedMethod(enabledMethods[0]);
    }
  }, [enabledMethods]);

  useEffect(() => {
    if (!selectedTuteeId || !user?.createdByTutorId) {
      setMonthRecords([]);
      setRecordsLoading(false);
      return;
    }

    const tutorId = user.createdByTutorId;
    setRecordsLoading(true);
    setSelectedMonth('');
    setQrError(false);

    const unsubRecords = paymentService.subscribeRecordsByTutee(tutorId, selectedTuteeId, (records) => {
      setMonthRecords(records.filter((r) => isMonthInSchoolYear(r.month, selectedYear)));
      setRecordsLoading(false);
    });
    const unsubPayments = paymentService.subscribePaymentsByTutee(tutorId, selectedTuteeId, (pays) => {
      setPayments(pays.filter((p) => belongsToSchoolYear(selectedYear, p)));
    });

    return () => {
      unsubRecords();
      unsubPayments();
    };
  }, [selectedTuteeId, user?.createdByTutorId, selectedYear]);

  const unpaidRecords = monthRecords.filter((r) => r.totalBalance > 0);
  const unpaidBalance = unpaidRecords.reduce((sum, r) => sum + (r.totalBalance || 0), 0);
  const oldestUnpaid = [...unpaidRecords].sort((a, b) => a.month.localeCompare(b.month))[0];

  useEffect(() => {
    if (unpaidRecords.length === 0) {
      setSelectedMonth('');
      setPayAmount('');
      return;
    }
    if (oldestUnpaid && selectedMonth !== oldestUnpaid.month) {
      setSelectedMonth(oldestUnpaid.month);
      setPayAmount(oldestUnpaid.totalBalance.toString());
    }
  }, [monthRecords]);

  const handleSelectMonth = (record: MonthlyRecord) => {
    if (oldestUnpaid && record.month !== oldestUnpaid.month) return;
    setSelectedMonth(record.month);
    setPayAmount(record.totalBalance.toString());
  };

  useEffect(() => {
    if (balance > 0 && !payAmount && unpaidRecords.length === 0) {
      setPayAmount(balance.toString());
    }
  }, [balance, unpaidRecords.length, payAmount]);

  const activeMethodConfig = selectedMethod ? paymentMethods?.[selectedMethod] : null;

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant camera roll access to upload a screenshot.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
      allowsMultipleSelection: false,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        Alert.alert('Image Too Large', 'Please select an image smaller than 5 MB.');
        return;
      }
      setProofUri(asset.uri);
      setProofUrl('');
      uploadImage(asset.uri);
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant camera access to take a photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        Alert.alert('Image Too Large', 'Please select an image smaller than 5 MB.');
        return;
      }
      setProofUri(asset.uri);
      setProofUrl('');
      uploadImage(asset.uri);
    }
  };

  const uploadImage = async (uri: string) => {
    setIsUploading(true);
    try {
      const url = await uploadToCloudinary(uri, `tuteepay/proofs/${user?.id}`);
      setProofUrl(url);
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'Failed to upload image. Please try again.');
      setProofUri(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedTutee) {
      Alert.alert('Error', 'Please select a child.');
      return;
    }
    const amountVal = parseFloat(payAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      Alert.alert('Error', 'Please enter a valid payment amount.');
      return;
    }
    if (!selectedMethod) {
      Alert.alert('Error', 'Please select a payment method.');
      return;
    }
    if (!proofUrl) {
      Alert.alert('Error', 'Please upload proof of payment.');
      return;
    }
    if (!user?.createdByTutorId) return;

    if (unpaidRecords.length > 0 && !selectedMonth) {
      Alert.alert('Error', 'Please select a billing month.');
      return;
    }

    if (unpaidRecords.length > 0 && (!oldestUnpaid || selectedMonth !== oldestUnpaid.month)) {
      Alert.alert('Cannot Pay This Month', 'Please settle the remaining balance from the previous month first.');
      return;
    }

    setIsSubmitting(true);
    try {
      const tuteeName = `${selectedTutee.firstName} ${selectedTutee.surname}`;
      const now = new Date();
      const month = selectedMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const selectedRecord = monthRecords.find((r) => r.month === month);
      const referenceBalance = selectedRecord?.totalBalance ?? balance;

      await paymentService.createPaymentProof(
        {
          tuteeId: selectedTutee.id,
          tuteeName,
          amount: amountVal,
          sessionsCovered: selectedTutee.ratePerSession > 0
            ? Math.ceil(amountVal / selectedTutee.ratePerSession)
            : 0,
          paymentMethod: METHOD_LABELS[selectedMethod] as PaymentMethod,
          paymentDate: now.toISOString().split('T')[0],
          notes: notes || undefined,
          proofUrl,
          coverageType: amountVal >= referenceBalance ? 'full' : 'partial',
          month,
        },
        user.createdByTutorId
      );

      Alert.alert('Success', 'Payment proof submitted! Your tutor will review it shortly.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit payment proof. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '',
          headerTintColor: '#ffffff',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: '#2563eb' },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 4 }}>
              <MaterialCommunityIcons name="chevron-left" size={28} color="#ffffff" />
            </TouchableOpacity>
          ),
        }}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          {/* Header Banner */}
          <View style={styles.headerBanner}>
            <Text style={styles.headerTitle}>Submit Payment</Text>
            <Text style={styles.headerSubtitle}>Upload proof of payment for your tutor to verify</Text>
          </View>

          {/* Child Selector — only shown when no tuteeId param */}
          {!preselectedTuteeId && (
            <>
              <Text style={styles.sectionLabel}>Select Child</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.childScroll}>
                {tutees.map((t) => {
                  const tuteeBalance = Math.max(
                    Math.round(getTuteeYearTotals(t, selectedYear).balance || 0),
                    0
                  );
                  const isSelected = t.id === selectedTuteeId;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      onPress={() => {
                        setSelectedTuteeId(t.id);
                        setPayAmount('');
                        setProofUri(null);
                        setProofUrl('');
                        setSelectedMonth('');
                        setQrError(false);
                      }}
                      style={[styles.childChip, isSelected && styles.childChipSelected]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.childChipText, isSelected && styles.childChipTextSelected]}>
                        {t.firstName} {t.surname}
                      </Text>
                      <Text style={[styles.childChipBalance, isSelected && styles.childChipBalanceSelected]}>
                        {formatCurrency(tuteeBalance)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}

          {/* Selected Child Info — shown when tuteeId param is provided */}
          {preselectedTuteeId && selectedTutee && (
            <Card style={styles.selectedChildCard}>
              <Card.Content style={styles.selectedChildContent}>
                <MaterialCommunityIcons name="account-outline" size={20} color="#2563eb" />
                <View style={styles.selectedChildInfo}>
                  <Text style={styles.selectedChildName}>
                    {selectedTutee.firstName} {selectedTutee.surname}
                  </Text>
                </View>
              </Card.Content>
            </Card>
          )}

          {/* Remaining Balance */}
          {selectedTutee && (
            <Card style={styles.balanceCard}>
              <Card.Content style={styles.balanceContent}>
                <MaterialCommunityIcons name="cash-remove" size={22} color="#ffffff" />
                <View style={styles.balanceInfo}>
                  <Text style={styles.balanceLabel}>Unpaid Balance</Text>
                  <Text style={styles.balanceValue}>{formatCurrency(unpaidBalance)}</Text>
                </View>
              </Card.Content>
            </Card>
          )}

          {/* Billing Month Selector */}
          {selectedTutee && (
            <>
              <Text style={styles.sectionLabel}>Billing Month</Text>
              {recordsLoading ? (
                <View style={styles.monthsLoading}>
                  <ActivityIndicator size="small" color="#15803d" />
                  <Text style={styles.monthsLoadingText}>Loading billing months...</Text>
                </View>
              ) : unpaidRecords.length === 0 ? (
                <Card style={styles.settledCard}>
                  <Card.Content style={styles.settledContent}>
                    <MaterialCommunityIcons name="check-circle-outline" size={28} color="#059669" />
                    <View style={styles.settledInfo}>
                      <Text style={styles.settledTitle}>All invoices settled!</Text>
                      <Text style={styles.settledText}>No unpaid billing months for this child.</Text>
                    </View>
                  </Card.Content>
                </Card>
              ) : (
                <View style={styles.monthList}>
                  {unpaidRecords.map((record) => {
                    const pendingPayment = payments.find((p) => p.month === record.month && p.status === 'pending');
                    const rejectedPayment = payments.find((p) => p.month === record.month && p.status === 'rejected');
                    const isSelected = record.month === selectedMonth;
                    const isBlocked = !!oldestUnpaid && record.month !== oldestUnpaid.month;
                    const blockedByLabel = isBlocked && oldestUnpaid ? formatMonthLabel(oldestUnpaid.month) : null;
                    return (
                      <TouchableOpacity
                        key={record.id}
                        onPress={() => handleSelectMonth(record)}
                        disabled={isBlocked}
                        style={[styles.monthCard, isSelected && styles.monthCardSelected, isBlocked && styles.monthCardBlocked]}
                        activeOpacity={0.7}
                      >
                        <View style={styles.monthCardLeft}>
                          <View style={styles.monthCardNameRow}>
                            <MaterialCommunityIcons
                              name={isBlocked ? 'lock-outline' : 'calendar-month'}
                              size={14}
                              color={isBlocked ? '#9ca3af' : '#374151'}
                            />
                            <Text style={[styles.monthCardName, isSelected && styles.monthCardNameSelected, isBlocked && styles.monthCardNameBlocked]}>
                              {formatMonthLabel(record.month)}
                            </Text>
                          </View>
                          {isBlocked ? (
                            <Text style={styles.monthBlockedNote}>
                              Pay {blockedByLabel} balance first
                            </Text>
                          ) : pendingPayment ? (
                            <View style={[styles.monthBadge, { backgroundColor: '#fffbeb' }]}>
                              <Text style={[styles.monthBadgeText, { color: '#b45309' }]}>Verification Pending</Text>
                            </View>
                          ) : rejectedPayment ? (
                            <View style={[styles.monthBadge, { backgroundColor: '#fef2f2' }]}>
                              <Text style={[styles.monthBadgeText, { color: '#dc2626' }]}>Rejected</Text>
                            </View>
                          ) : (
                            <View style={[styles.monthBadge, { backgroundColor: '#f3f4f6' }]}>
                              <Text style={[styles.monthBadgeText, { color: '#6b7280' }]}>Unpaid Balance</Text>
                            </View>
                          )}
                          {rejectedPayment && (
                            <Text style={styles.monthRejectedNote}>
                              {rejectedPayment.notes?.split(' | Rejected: ')[1] ||
                                rejectedPayment.notes ||
                                'Incorrect payment details'}
                            </Text>
                          )}
                        </View>
                        <View style={styles.monthCardRight}>
                          <Text style={styles.monthCardBalanceLabel}>Balance Due</Text>
                          <Text style={[styles.monthCardBalance, isSelected && styles.monthCardBalanceSelected, isBlocked && styles.monthCardBalanceBlocked]}>
                            {formatCurrency(record.totalBalance)}
                          </Text>
                        </View>
                        {isSelected && (
                          <MaterialCommunityIcons name="check-circle" size={20} color="#15803d" style={styles.monthCheck} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </>
          )}

          {/* Payment Method Selector */}
          {loadingPaymentMethods && (
            <View style={styles.methodsLoading}>
              <ActivityIndicator size="small" color="#2563eb" />
              <Text style={styles.methodsLoadingText}>Loading payment methods...</Text>
            </View>
          )}

          {!loadingPaymentMethods && enabledMethods.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Payment Method</Text>
              <View style={styles.methodGrid}>
                {enabledMethods.map((m) => {
                  const isSelected = m === selectedMethod;
                  return (
                    <TouchableOpacity
                      key={m}
                      onPress={() => setSelectedMethod(m)}
                      style={[styles.methodCard, isSelected && styles.methodCardSelected]}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons
                        name={METHOD_ICONS[m] as any}
                        size={20}
                        color={isSelected ? '#2563eb' : '#6b7280'}
                      />
                      <Text style={[styles.methodText, isSelected && styles.methodTextSelected]}>
                        {METHOD_LABELS[m]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* No Payment Methods */}
          {!loadingPaymentMethods && enabledMethods.length === 0 && (
            <Card style={styles.noMethodsCard}>
              <Card.Content style={styles.noMethodsContent}>
                <MaterialCommunityIcons name="alert-circle-outline" size={32} color="#f59e0b" />
                <Text style={styles.noMethodsTitle}>No Online Payment Methods</Text>
                <Text style={styles.noMethodsText}>
                  Your tutor has not configured online payment methods. Please contact them directly.
                </Text>
              </Card.Content>
            </Card>
          )}

          {/* Tutor Payment Details */}
          {activeMethodConfig && (
            <Card style={styles.detailsCard}>
              <Card.Content>
                <View style={styles.detailsHeader}>
                  <MaterialCommunityIcons
                    name={METHOD_ICONS[selectedMethod as MethodKey] as any}
                    size={18}
                    color="#2563eb"
                  />
                  <Text style={styles.detailsTitle}>
                    {METHOD_LABELS[selectedMethod as MethodKey]} Payment Details
                  </Text>
                </View>

                <View style={styles.detailsBody}>
                  {(activeMethodConfig as any).bankName && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Bank / Provider</Text>
                      <Text style={styles.detailValue}>{(activeMethodConfig as any).bankName}</Text>
                    </View>
                  )}
                  {activeMethodConfig.accountName && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Account Name</Text>
                      <Text style={styles.detailValue}>{activeMethodConfig.accountName}</Text>
                    </View>
                  )}
                  {activeMethodConfig.accountNumber && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Account Number</Text>
                      <Text style={styles.detailValueMono}>{activeMethodConfig.accountNumber}</Text>
                    </View>
                  )}
                  {(activeMethodConfig as any).instructions && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Instructions</Text>
                      <Text style={styles.detailInstructions}>{(activeMethodConfig as any).instructions}</Text>
                    </View>
                  )}
                </View>

                {activeMethodConfig.qrUrl ? (
                  <View style={styles.qrContainer}>
                    {qrError ? (
                      <View style={styles.qrFallback}>
                        <MaterialCommunityIcons name="qrcode-scan" size={40} color="#9ca3af" />
                        <Text style={styles.qrFallbackText}>Unable to load QR code</Text>
                        <TouchableOpacity
                          onPress={() => setQrError(false)}
                          style={styles.qrRetry}
                          activeOpacity={0.7}
                        >
                          <MaterialCommunityIcons name="refresh" size={16} color="#15803d" />
                          <Text style={styles.qrRetryText}>Retry</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <>
                        <Image
                          key={normalizeImageUrl(activeMethodConfig.qrUrl)}
                          source={{ uri: normalizeImageUrl(activeMethodConfig.qrUrl) }}
                          style={styles.qrImage}
                          resizeMode="contain"
                          onError={() => setQrError(true)}
                          onLoad={() => setQrError(false)}
                        />
                        <Text style={styles.qrLabel}>Scan to Pay</Text>
                      </>
                    )}
                  </View>
                ) : (
                  <Text style={styles.qrMissing}>No QR code uploaded by tutor</Text>
                )}
              </Card.Content>
            </Card>
          )}

          {/* Amount Input */}
          <Text style={styles.sectionLabel}>Amount Sent (₱)</Text>
          <TextInput
            mode="outlined"
            value={payAmount}
            onChangeText={setPayAmount}
            keyboardType="decimal-pad"
            placeholder="Enter amount"
            outlineColor="#e5e7eb"
            activeOutlineColor="#2563eb"
            style={styles.input}
          />

          {/* Screenshot Upload */}
          <Text style={styles.sectionLabel}>Upload Receipt / Proof of Payment</Text>
          <TouchableOpacity
            onPress={() => {
              Alert.alert('Select Image', 'Choose an option', [
                { text: 'Camera', onPress: handleTakePhoto },
                { text: 'Gallery', onPress: handlePickImage },
                { text: 'Cancel', style: 'cancel' },
              ]);
            }}
            style={styles.uploadArea}
            activeOpacity={0.7}
            disabled={isUploading}
          >
            {isUploading ? (
              <View style={styles.uploadLoading}>
                <ActivityIndicator size="small" color="#2563eb" />
                <Text style={styles.uploadLoadingText}>Uploading...</Text>
              </View>
            ) : proofUri ? (
              <View style={styles.previewContainer}>
                <Image source={{ uri: proofUri }} style={styles.previewImage} />
                {proofUrl ? (
                  <View style={styles.uploadedBadge}>
                    <MaterialCommunityIcons name="check-circle" size={16} color="#ffffff" />
                    <Text style={styles.uploadedText}>Uploaded</Text>
                  </View>
                ) : (
                  <View style={styles.uploadRetryBadge}>
                    <MaterialCommunityIcons name="refresh" size={16} color="#ffffff" />
                    <Text style={styles.uploadedText}>Tap to retry</Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.uploadPlaceholder}>
                <MaterialCommunityIcons name="camera-plus-outline" size={36} color="#9ca3af" />
                <Text style={styles.uploadText}>Tap to select screenshot</Text>
                <Text style={styles.uploadSubtext}>JPG or PNG, max 5 MB</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Reference Notes */}
          <Text style={styles.sectionLabel}>Reference Code / Notes (Optional)</Text>
          <TextInput
            mode="outlined"
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. Reference No. 123456"
            outlineColor="#e5e7eb"
            activeOutlineColor="#2563eb"
            style={styles.input}
          />

          {/* Footer Buttons */}
          <View style={styles.footer}>
            <Button
              mode="outlined"
              onPress={() => router.back()}
              style={styles.cancelButton}
              labelStyle={styles.cancelButtonText}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleSubmit}
              disabled={!proofUrl || isSubmitting || isUploading || enabledMethods.length === 0}
              loading={isSubmitting}
              style={styles.submitButton}
              labelStyle={styles.submitButtonText}
              buttonColor="#2563eb"
            >
              Submit Payment Proof
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#eff6ff' },
  content: { padding: 16, paddingBottom: 40 },

  headerBanner: {
    backgroundColor: '#2563eb',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#ffffff' },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },

  childScroll: { marginBottom: 16 },
  childChip: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    alignItems: 'center',
    minWidth: 120,
  },
  childChipSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  childChipText: { fontSize: 13, fontWeight: '700', color: '#374151' },
  childChipTextSelected: { color: '#2563eb' },
  childChipBalance: { fontSize: 11, fontWeight: '600', color: '#9ca3af', marginTop: 2 },
  childChipBalanceSelected: { color: '#059669' },

  selectedChildCard: {
    borderRadius: 12,
    marginBottom: 20,
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
    borderWidth: 1,
  },
  selectedChildContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectedChildInfo: { flex: 1 },
  selectedChildName: { fontSize: 15, fontWeight: '700', color: '#111827' },

  balanceCard: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    marginBottom: 20,
  },
  balanceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  balanceInfo: { flex: 1 },
  balanceLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase' },
  balanceValue: { fontSize: 22, fontWeight: '800', color: '#ffffff', marginTop: 2 },

  methodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: '47%',
  },
  methodCardSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  methodText: { fontSize: 13, fontWeight: '700', color: '#6b7280' },
  methodTextSelected: { color: '#2563eb' },

  methodsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginBottom: 16,
  },
  methodsLoadingText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  noMethodsCard: {
    borderRadius: 12,
    marginBottom: 20,
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: 1,
  },
  noMethodsContent: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  noMethodsTitle: { fontSize: 14, fontWeight: '700', color: '#92400e' },
  noMethodsText: { fontSize: 12, color: '#a16207', textAlign: 'center' },

  detailsCard: {
    borderRadius: 12,
    marginBottom: 20,
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    borderWidth: 1,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  detailsTitle: { fontSize: 14, fontWeight: '800', color: '#111827' },
  detailsBody: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  detailRow: { gap: 2 },
  detailLabel: { fontSize: 10, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { fontSize: 13, fontWeight: '700', color: '#111827' },
  detailValueMono: { fontSize: 13, fontWeight: '700', color: '#111827', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  detailInstructions: { fontSize: 12, color: '#6b7280', fontStyle: 'italic', marginTop: 2 },

  qrContainer: {
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  qrImage: {
    width: 180,
    height: 180,
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  qrLabel: { fontSize: 11, fontWeight: '600', color: '#9ca3af' },
  qrFallback: {
    width: 180,
    height: 180,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
  },
  qrFallbackText: { fontSize: 12, fontWeight: '600', color: '#9ca3af' },
  qrRetry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#15803d',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  qrRetryText: { fontSize: 12, fontWeight: '700', color: '#15803d' },
  qrMissing: { fontSize: 11, fontWeight: '600', color: '#9ca3af', marginTop: 12, textAlign: 'center' },

  monthsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginBottom: 16,
  },
  monthsLoadingText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  settledCard: {
    borderRadius: 12,
    marginBottom: 20,
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    borderWidth: 1,
  },
  settledContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  settledInfo: { flex: 1 },
  settledTitle: { fontSize: 14, fontWeight: '800', color: '#15803d' },
  settledText: { fontSize: 12, color: '#6b7280', marginTop: 2 },

  monthList: { gap: 8, marginBottom: 20 },
  monthCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    position: 'relative',
  },
  monthCardSelected: {
    borderColor: '#15803d',
    backgroundColor: '#f0fdf4',
  },
  monthCardBlocked: {
    opacity: 0.55,
  },
  monthCardLeft: { flex: 1, gap: 6 },
  monthCardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  monthCardName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  monthCardNameSelected: { color: '#15803d' },
  monthCardNameBlocked: { color: '#9ca3af' },
  monthBlockedNote: { fontSize: 11, color: '#b45309', fontStyle: 'italic' },
  monthBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  monthBadgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  monthRejectedNote: { fontSize: 11, color: '#dc2626', fontStyle: 'italic' },
  monthCardRight: { alignItems: 'flex-end', marginRight: 26 },
  monthCardBalanceLabel: { fontSize: 10, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase' },
  monthCardBalance: { fontSize: 15, fontWeight: '800', color: '#111827', marginTop: 2 },
  monthCardBalanceSelected: { color: '#15803d' },
  monthCardBalanceBlocked: { color: '#9ca3af' },
  monthCheck: { position: 'absolute', right: 12, top: 12 },

  input: {
    backgroundColor: '#ffffff',
    marginBottom: 16,
  },

  uploadArea: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    borderRadius: 12,
    minHeight: 160,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  uploadPlaceholder: {
    alignItems: 'center',
    gap: 8,
    padding: 24,
  },
  uploadText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  uploadSubtext: { fontSize: 11, color: '#9ca3af' },
  uploadLoading: {
    alignItems: 'center',
    gap: 8,
    padding: 24,
  },
  uploadLoadingText: { fontSize: 13, fontWeight: '600', color: '#2563eb' },
  previewContainer: {
    width: '100%',
    height: 200,
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  uploadedBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  uploadRetryBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: '#dc2626',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  uploadedText: { fontSize: 11, fontWeight: '700', color: '#ffffff' },

  footer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  cancelButton: {
    flex: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
  },
  cancelButtonText: { color: '#6b7280', fontWeight: '700' },
  submitButton: {
    flex: 1,
    borderRadius: 12,
  },
  submitButtonText: { fontWeight: '700' },
});
