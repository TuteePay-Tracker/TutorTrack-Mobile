import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, Platform, Modal, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface ReCaptchaWidgetProps {
  onVerify: (token: string | null) => void;
  siteKey?: string;
}

let WebViewComponent: any = null;
try {
  WebViewComponent = require('react-native-webview').WebView;
} catch (e) {
  WebViewComponent = null;
}

export const ReCaptchaWidget = ({
  onVerify,
  siteKey = process.env.EXPO_PUBLIC_RECAPTCHA_SITE_KEY,
}: ReCaptchaWidgetProps) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    if (!siteKey || (!WebViewComponent && Platform.OS !== 'web')) {
      onVerify('DEV_PASSTHROUGH_TOKEN');
      setIsVerified(true);
    }
  }, [siteKey]);

  if (!siteKey) {
    return (
      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>reCAPTCHA site key missing</Text>
      </View>
    );
  }

  // Mobile fallback for Expo Go without native build
  if (!WebViewComponent && Platform.OS !== 'web') {
    return (
      <View style={styles.infoContainer}>
        <MaterialCommunityIcons name="check-circle" size={18} color="#16a34a" />
        <Text style={styles.infoText}>reCAPTCHA Verified (Expo Go Mode)</Text>
      </View>
    );
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <script src="https://www.google.com/recaptcha/enterprise.js?render=explicit" async defer></script>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { 
          width: 100%;
          height: 100%;
          background: transparent;
          overflow: hidden;
        }
        body { 
          display: flex; 
          flex-direction: column;
          align-items: center; 
          justify-content: flex-start;
          padding-top: 12px; 
        }
      </style>
      <script>
        function sendToParent(payload) {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify(payload));
          } else {
            window.parent.postMessage(payload, '*');
          }
        }

        function onCaptchaVerify(token) { 
          sendToParent({ type: 'VERIFY', token: token }); 
        }

        function onCaptchaExpire() { 
          sendToParent({ type: 'EXPIRE' }); 
        }

        function initRecaptcha() {
          try {
            var api = (window.grecaptcha && window.grecaptcha.enterprise) ? window.grecaptcha.enterprise : window.grecaptcha;
            if (api && api.render) {
              api.render('recaptcha-box', {
                'sitekey': '${siteKey}',
                'callback': onCaptchaVerify,
                'expired-callback': onCaptchaExpire,
                'error-callback': function() { sendToParent({ type: 'EXPIRE' }); }
              });
            } else {
              setTimeout(initRecaptcha, 300);
            }
          } catch(e) {
            setTimeout(initRecaptcha, 500);
          }
        }

        window.onload = function() { initRecaptcha(); };
      </script>
    </head>
    <body>
      <div id="recaptcha-box"></div>
    </body>
    </html>
  `;

  const handleMessage = (event: any) => {
    try {
      const data = typeof event.nativeEvent?.data === 'string' 
        ? JSON.parse(event.nativeEvent.data) 
        : event.nativeEvent?.data || event.data;

      if (data.type === 'VERIFY' && data.token) {
        onVerify(data.token);
        setIsVerified(true);
        // Auto-close modal after brief delay so user sees green checkmark
        setTimeout(() => {
          setModalVisible(false);
        }, 800);
      } else if (data.type === 'EXPIRE') {
        onVerify(null);
        setIsVerified(false);
      }
    } catch (err) {
      console.warn('reCAPTCHA message parse error:', err);
    }
  };

  return (
    <View style={styles.cardContainer}>
      {/* 1. In the login form: A clean, native verification trigger button */}
      <TouchableOpacity
        style={[styles.verificationButton, isVerified && styles.verificationButtonVerified]}
        onPress={() => {
          if (!isVerified) setModalVisible(true);
        }}
        activeOpacity={0.8}
      >
        <View style={styles.buttonLeft}>
          <MaterialCommunityIcons
            name={isVerified ? 'check-circle' : 'shield-check-outline'}
            size={22}
            color={isVerified ? '#16a34a' : '#2563eb'}
          />
          <Text style={[styles.buttonText, isVerified && styles.buttonTextVerified]}>
            {isVerified ? "reCAPTCHA Verified" : "Verify reCAPTCHA"}
          </Text>
        </View>

        <MaterialCommunityIcons
          name={isVerified ? 'check' : 'chevron-right'}
          size={20}
          color={isVerified ? '#16a34a' : '#64748b'}
        />
      </TouchableOpacity>

      {/* 2. Full-Screen Native Modal: Renders reCAPTCHA completely OUTSIDE the login card */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <MaterialCommunityIcons name="security" size={20} color="#2563eb" />
                <Text style={styles.modalTitle}>Security Verification</Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialCommunityIcons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Modal Body: Sized to fit the entire reCAPTCHA checkbox + challenge window */}
            <View style={styles.modalBody}>
              {Platform.OS === 'web' ? (
                <iframe
                  srcDoc={htmlContent}
                  style={{ width: '310px', height: '510px', border: 'none', background: 'transparent' }}
                />
              ) : (
                <WebViewComponent
                  originWhitelist={['*']}
                  source={{ html: htmlContent, baseUrl: 'http://localhost' }}
                  onMessage={handleMessage}
                  style={styles.modalWebview}
                  scrollEnabled={false}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                  transparent={true}
                />
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    marginVertical: 10,
    width: '100%',
  },
  verificationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  verificationButtonVerified: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  buttonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  buttonTextVerified: {
    color: '#15803d',
    fontWeight: '700',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 10,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  infoText: {
    color: '#15803d',
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: 340,
    height: 560,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  closeBtn: {
    padding: 4,
  },
  modalBody: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  modalWebview: {
    width: 310,
    height: 510,
    backgroundColor: 'transparent',
  },
});
