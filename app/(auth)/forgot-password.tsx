import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TextInput, Button, Snackbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';

export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [snackVisible, setSnackVisible] = useState(false);

  const handleReset = async () => {
    if (!email) {
      setError('Please enter your email');
      setSnackVisible(true);
      return;
    }

    setIsLoading(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
      setSnackVisible(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons name="lock-reset" size={32} color="#fff" />
        </View>
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>
          {sent
            ? `A password reset link has been sent to ${email}`
            : 'Enter your email to receive a password reset link'}
        </Text>

        {!sent && (
          <View style={styles.form}>
            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              outlineStyle={styles.inputOutline}
              left={<TextInput.Icon icon="email-outline" />}
            />

            <Button
              mode="contained"
              onPress={handleReset}
              loading={isLoading}
              disabled={isLoading}
              style={styles.resetButton}
              labelStyle={styles.resetButtonText}
              buttonColor="#2563eb"
            >
              Send Reset Link
            </Button>
          </View>
        )}

        {sent && (
          <Button
            mode="contained"
            onPress={() => router.back()}
            style={styles.resetButton}
            labelStyle={styles.resetButtonText}
            buttonColor="#2563eb"
          >
            Back to Login
          </Button>
        )}

        <Button
          mode="text"
          onPress={() => router.back()}
          style={styles.backButton}
          labelStyle={styles.backText}
        >
          Back to Login
        </Button>
      </View>

      <Snackbar
        visible={snackVisible}
        onDismiss={() => setSnackVisible(false)}
        duration={4000}
        style={styles.snackbar}
      >
        {error}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    elevation: 4,
  },
  iconContainer: {
    width: 56,
    height: 56,
    backgroundColor: '#2563eb',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 24,
    lineHeight: 18,
  },
  form: {
    gap: 4,
  },
  input: {
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  inputOutline: {
    borderRadius: 12,
  },
  resetButton: {
    borderRadius: 12,
    paddingVertical: 4,
  },
  resetButtonText: {
    fontWeight: '700',
    fontSize: 15,
  },
  backButton: {
    marginTop: 12,
    alignSelf: 'center',
  },
  backText: {
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '600',
  },
  snackbar: {
    backgroundColor: '#dc2626',
  },
});
