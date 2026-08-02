import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, Button, Snackbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';

export default function ChangePasswordScreen() {
  const { user, changePassword, refreshUser } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [snackVisible, setSnackVisible] = useState(false);

  const handleSubmit = async () => {
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      setSnackVisible(true);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      setSnackVisible(true);
      return;
    }

    setIsLoading(true);
    try {
      await changePassword(newPassword);
      await refreshUser();
      router.replace('/(main)');
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        setError('Session expired. Please log out and log in again, then change your password.');
      } else {
        setError(err.message || 'Failed to change password');
      }
      setSnackVisible(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons name="shield-check" size={32} color="#fff" />
        </View>
        <Text style={styles.title}>Set Your Password</Text>
        <Text style={styles.subtitle}>
          Welcome, <Text style={{ fontWeight: '700' }}>{user?.name}</Text>! You must set a new password before continuing.
        </Text>

        <View style={styles.form}>
          <TextInput
            label="New Password"
            value={newPassword}
            onChangeText={setNewPassword}
            mode="outlined"
            secureTextEntry={!showPassword}
            style={styles.input}
            outlineStyle={styles.inputOutline}
            left={<TextInput.Icon icon="lock-outline" />}
            right={
              <TextInput.Icon
                icon={showPassword ? 'eye-off' : 'eye'}
                onPress={() => setShowPassword(!showPassword)}
              />
            }
          />

          <TextInput
            label="Confirm New Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            mode="outlined"
            secureTextEntry={!showPassword}
            style={styles.input}
            outlineStyle={styles.inputOutline}
            left={<TextInput.Icon icon="lock-check-outline" />}
          />

          <View style={styles.noteContainer}>
            <MaterialCommunityIcons name="information-outline" size={16} color="#d97706" />
            <Text style={styles.noteText}>
              Your new password must be at least 8 characters. Choose something strong and memorable.
            </Text>
          </View>

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={isLoading}
            disabled={isLoading}
            style={styles.submitButton}
            labelStyle={styles.submitButtonText}
            buttonColor="#2563eb"
          >
            Set Password & Continue
          </Button>
        </View>
      </View>

      <View style={styles.footer}>
        <MaterialCommunityIcons name="school" size={14} color="#2563eb" />
        <Text style={styles.footerText}>Tutor Track — Secure Parent Portal</Text>
      </View>

      <Snackbar
        visible={snackVisible}
        onDismiss={() => setSnackVisible(false)}
        duration={4000}
        style={styles.snackbar}
      >
        {error}
      </Snackbar>
    </KeyboardAvoidingView>
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
    width: 60,
    height: 60,
    backgroundColor: '#2563eb',
    borderRadius: 18,
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
    marginBottom: 12,
  },
  inputOutline: {
    borderRadius: 12,
  },
  noteContainer: {
    flexDirection: 'row',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    marginBottom: 16,
    gap: 8,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: '#92400e',
    lineHeight: 16,
  },
  submitButton: {
    borderRadius: 12,
    paddingVertical: 4,
  },
  submitButtonText: {
    fontWeight: '700',
    fontSize: 15,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    gap: 6,
  },
  footerText: {
    fontSize: 12,
    color: '#6b7280',
  },
  snackbar: {
    backgroundColor: '#dc2626',
  },
});
