import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { Text, TextInput, Button, Snackbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { ReCaptchaWidget } from '../../src/components/ReCaptchaWidget';

export default function LoginScreen() {
  const { login, isLoading } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [snackVisible, setSnackVisible] = useState(false);

  const handleLogin = async () => {
    if (!phone || !password) {
      setError('Please fill in all fields');
      setSnackVisible(true);
      return;
    }

    const siteKey = process.env.EXPO_PUBLIC_RECAPTCHA_SITE_KEY;
    if (siteKey && !captchaToken) {
      setError('Please complete the reCAPTCHA verification to continue');
      setSnackVisible(true);
      return;
    }

    const sanitizedPhone = phone.replace(/\D/g, '');
    // Standard Philippine mobile number: 11 digits starting with 09
    if (!/^09\d{9}$/.test(sanitizedPhone)) {
      setError('Please enter a valid mobile number (e.g., 09XXXXXXXXX)');
      setSnackVisible(true);
      return;
    }

    try {
      await login(`${sanitizedPhone}@tuteepay.local`, password);
    } catch (err: any) {
      setError(err.message || 'Login failed');
      setSnackVisible(true);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Image source={require('../../assets/logo.jpg')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>Tutor Track</Text>
          <Text style={styles.subtitle}>Parent Portal</Text>

          <View style={styles.form}>
            <TextInput
              label="Phone Number"
              value={phone}
              onChangeText={(text) => setPhone(text.replace(/[^\d]/g, ''))}
              mode="outlined"
              keyboardType="phone-pad"
              autoCorrect={false}
              maxLength={11}
              style={styles.input}
              outlineStyle={styles.inputOutline}
              left={<TextInput.Icon icon="phone-outline" />}
            />

            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
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



            {/* reCAPTCHA Widget */}
            <ReCaptchaWidget onVerify={setCaptchaToken} />

            <Button
              mode="contained"
              onPress={handleLogin}
              loading={isLoading}
              disabled={isLoading}
              style={styles.loginButton}
              labelStyle={styles.loginButtonText}
              buttonColor="#2563eb"
            >
              Sign In
            </Button>
          </View>
        </View>

        <View style={styles.footer}>
          <MaterialCommunityIcons name="school" size={14} color="#2563eb" />
          <Text style={styles.footerText}>Tutor Track — Secure Parent Portal</Text>
        </View>
      </ScrollView>

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
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  logo: {
    width: 140,
    height: 140,
    alignSelf: 'center',
    borderRadius: 24,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 28,
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
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 16,
  },
  forgotText: {
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '600',
  },
  loginButton: {
    borderRadius: 12,
    paddingVertical: 4,
  },
  loginButtonText: {
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
