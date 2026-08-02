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
import { paymentService } from '../../src/services/paymentService';
import { db } from '../../src/services/firebaseConfig';
import { uploadToCloudinary } from '../../src/services/cloudinaryService';
import { formatCurrency } from '../../src/utils/formatCurrency';
import { PaymentMethod } from '../../src/types/payment';
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

export default function PaymentProofScreen() {
  const { tuteeId: preselectedTuteeId } = useLocalSearchParams<{ tuteeId?: string }>();
  const { user } = useAuth();
  const { tutees } = useTutees();
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

  useEffect(() => {
    let mounted = true;
    const loadPaymentMethods = async () => {
      setLoadingPaymentMethods(true);
      try {
        if (user?.role === 'tutor') {
          if (mounted) setTutorPaymentMethods(user.paymentMethods || {});
          return;
        }
        if (!user?.createdByTutorId) {
          if (mounted) setTutorPaymentMethods({});
          return;
        }
        const tutorDoc = await getDoc(doc(db, 'users', user.createdByTutorId));
        if (mounted) {
          setTutorPaymentMethods(tutorDoc.exists() ? tutorDoc.data().paymentMethods || {} : {});
        }
      } catch (err) {
        console.error('Error fetching tutor payment details:', err);
        if (mounted) setTutorPaymentMethods({});
      } finally {
        if (mounted) setLoadingPaymentMethods(false);
      }
    };
    loadPaymentMethods();
    return () => {
      mounted = false;
    };
  }, [user?.role, user?.createdByTutorId, user?.paymentMethods]);

  const paymentMethods = tutorPaymentMethods;
  const enabledMethods: MethodKey[] = (['gcash', 'maya', 'bank', 'other'] as MethodKey[]).filter(
    (m) => paymentMethods?.[m]?.enabled
  );

  const selectedTutee = tutees.find((t) => t.id === selectedTuteeId);
  const balance = selectedTutee
    ? Math.max((selectedTutee.totalSessions || 0) * (selectedTutee.ratePerSession || 0) - (selectedTutee.totalPaid || 0), 0)
    : 0;

  useEffect(() => {
    if (enabledMethods.length > 0 && !selectedMethod) {
      setSelectedMethod(enabledMethods[0]);
    }
  }, [enabledMethods]);

  useEffect(() => {
    if (balance > 0 && !payAmount) {
      setPayAmount(balance.toString());
    }
  }, [balance]);

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

    setIsSubmitting(true);
    try {
      const tuteeName = `${selectedTutee.firstName} ${selectedTutee.surname}`;
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

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
          coverageType: amountVal >= balance ? 'full' : 'partial',
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
          headerStyle: { backgroundColor: '#15803d' },
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
                    (t.totalSessions || 0) * (t.ratePerSession || 0) - (t.totalPaid || 0),
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
                <MaterialCommunityIcons name="account-outline" size={20} color="#15803d" />
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
                  <Text style={styles.balanceLabel}>Remaining Balance</Text>
                  <Text style={styles.balanceValue}>{formatCurrency(balance)}</Text>
                </View>
              </Card.Content>
            </Card>
          )}

          {/* Payment Method Selector */}
          {loadingPaymentMethods && (
            <View style={styles.methodsLoading}>
              <ActivityIndicator size="small" color="#15803d" />
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
                        color={isSelected ? '#15803d' : '#6b7280'}
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
                    color="#15803d"
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

                {activeMethodConfig.qrUrl && (
                  <View style={styles.qrContainer}>
                    <Image
                      source={{ uri: activeMethodConfig.qrUrl }}
                      style={styles.qrImage}
                      resizeMode="contain"
                    />
                    <Text style={styles.qrLabel}>Scan to Pay</Text>
                  </View>
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
            activeOutlineColor="#15803d"
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
                <ActivityIndicator size="small" color="#15803d" />
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
            activeOutlineColor="#15803d"
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
              buttonColor="#15803d"
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
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 40 },

  headerBanner: {
    backgroundColor: '#15803d',
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
    borderColor: '#15803d',
    backgroundColor: '#f0fdf4',
  },
  childChipText: { fontSize: 13, fontWeight: '700', color: '#374151' },
  childChipTextSelected: { color: '#15803d' },
  childChipBalance: { fontSize: 11, fontWeight: '600', color: '#9ca3af', marginTop: 2 },
  childChipBalanceSelected: { color: '#059669' },

  selectedChildCard: {
    borderRadius: 12,
    marginBottom: 20,
    backgroundColor: '#f0fdf4',
    borderColor: '#15803d',
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
    backgroundColor: '#15803d',
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
    borderColor: '#15803d',
    backgroundColor: '#f0fdf4',
  },
  methodText: { fontSize: 13, fontWeight: '700', color: '#6b7280' },
  methodTextSelected: { color: '#15803d' },

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
    backgroundColor: '#f9fafb',
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
  uploadLoadingText: { fontSize: 13, fontWeight: '600', color: '#15803d' },
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
    backgroundColor: '#15803d',
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
