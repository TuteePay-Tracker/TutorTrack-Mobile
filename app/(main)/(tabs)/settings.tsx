import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert, Modal, TouchableOpacity } from 'react-native';
import { Text, Card, TextInput, Button, Avatar, Divider, Switch } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../src/hooks/useAuth';
import { useSchoolYear } from '../../../src/contexts/SchoolYearContext';
import { useNotifications } from '../../../src/contexts/NotificationContext';
import { notificationService, isPushDisabled, setPushDisabled } from '../../../src/services/notificationService';
import { SchoolYearSelector } from '../../../src/components/SchoolYearSelector';
import { useTabBarHeight } from '../../../src/hooks/useTabBarHeight';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { pushToken } = useNotifications();
  const { displayLabel } = useSchoolYear();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [sySelectorVisible, setSySelectorVisible] = useState(false);

  // Keep the switch in sync with the real notification state every time the
  // Settings screen is shown (e.g. right after allowing the login-time prompt).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const perms = await Notifications.getPermissionsAsync();
          const disabled = await isPushDisabled();
          if (active) {
            setPushEnabled(!disabled && (perms.granted === true || !!pushToken));
          }
        } catch (error) {
          console.warn('Failed to read notification status:', error);
        }
      })();
      return () => {
        active = false;
      };
    }, [pushToken])
  );

  const handleTogglePush = async (value: boolean) => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      if (value) {
        await setPushDisabled(false);
        const perms = await Notifications.getPermissionsAsync();
        if (!perms.granted) {
          const requested = await Notifications.requestPermissionsAsync();
          if (!requested.granted) {
            setPushEnabled(false);
            Alert.alert(
              'Permission Denied',
              'Enable notifications for this app in your device settings to receive push notifications.'
            );
            return;
          }
        }
        await notificationService.registerForPushNotifications();
        setPushEnabled(true);
      } else {
        setPushEnabled(false);
        await setPushDisabled(true);
        if (user?.id && pushToken) {
          await notificationService.removeToken(user.id, pushToken);
        }
      }
    } catch (error) {
      console.warn('Failed to update push notifications:', error);
      Alert.alert('Error', 'Failed to update notification settings. Please try again.');
    } finally {
      setPushBusy(false);
    }
  };

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?';

  const handleLogout = () => {
    setLogoutModalVisible(true);
  };

  return (
    <>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <MaterialCommunityIcons name="cog-outline" size={28} color="#2563eb" />
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>Manage your account</Text>
        </View>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight }]}>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Account Information
            </Text>
            <Divider style={styles.divider} />

            <View style={styles.profileRow}>
              {user?.photoUrl ? (
                <Avatar.Image size={64} source={{ uri: user.photoUrl }} />
              ) : (
                <Avatar.Text size={64} label={initials} style={styles.avatar} />
              )}
              <View style={styles.profileInfo}>
                <Text variant="bodyLarge" style={styles.profileName}>
                  {user?.name ?? 'No Name'}
                </Text>
                <Text variant="bodyMedium" style={styles.profileEmail}>
                  {user?.email?.replace('@tuteepay.local', '') ?? 'No Email'}
                </Text>
              </View>
            </View>

            <Divider style={styles.divider} />

            <TextInput
              label="Name"
              value={user?.name ?? ''}
              mode="outlined"
              disabled
              style={styles.input}
            />
            <TextInput
              label="Phone Number"
              value={user?.contactNumber ?? ''}
              mode="outlined"
              disabled
              style={styles.input}
            />
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              School Year
            </Text>
            <Divider style={styles.divider} />

            <TouchableOpacity
              style={styles.syRow}
              onPress={() => setSySelectorVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.syLabel}>
                <MaterialCommunityIcons name="calendar-range" size={22} color="#2563eb" />
                <View>
                  <Text variant="bodyLarge" style={styles.syText}>
                    {displayLabel}
                  </Text>
                  <Text variant="bodySmall" style={styles.syHint}>
                    Tap to change school year
                  </Text>
                </View>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#2563eb" />
            </TouchableOpacity>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Notifications
            </Text>
            <Divider style={styles.divider} />

            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <MaterialCommunityIcons name="bell-outline" size={22} color="#333" />
                <Text variant="bodyLarge" style={styles.switchText}>
                  Push Notifications
                </Text>
              </View>
              <Switch
                value={pushEnabled}
                onValueChange={handleTogglePush}
                disabled={pushBusy}
                color="#2563eb"
              />
            </View>
          </Card.Content>
        </Card>

        <Button
          mode="contained"
          onPress={handleLogout}
          style={styles.logoutButton}
          buttonColor="#dc2626"
          icon="logout"
        >
          Logout
        </Button>
        <Text style={styles.version}>.</Text>
      </ScrollView>

      <Modal
        visible={logoutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalIconContainer}>
              <MaterialCommunityIcons name="logout" size={32} color="#dc2626" />
            </View>
            <Text style={styles.modalTitle}>Logout</Text>
            <Text style={styles.modalText}>
              Are you sure you want to logout? You will need to sign back in to access your account.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setLogoutModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.deleteButton]}
                onPress={async () => {
                  setLogoutModalVisible(false);
                  try {
                    await logout();
                    router.replace('/(auth)/login');
                  } catch {
                    Alert.alert('Error', 'Failed to logout. Please try again.');
                  }
                }}
              >
                <Text style={styles.deleteButtonText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <SchoolYearSelector visible={sySelectorVisible} onClose={() => setSySelectorVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eff6ff',
  },
  content: {
    padding: 20,
    paddingBottom: 110,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: '#eff6ff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerText: {
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  card: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
    backgroundColor: '#ffffff',
  },
  sectionTitle: {
    fontWeight: '600',
    color: '#2563eb',
    marginBottom: 4,
  },
  divider: {
    marginBottom: 16,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    backgroundColor: '#2563eb',
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    fontWeight: '600',
    marginBottom: 2,
  },
  profileEmail: {
    color: '#666',
  },
  input: {
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  switchText: {
    fontWeight: '500',
  },
  syRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  syLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  syText: {
    fontWeight: '600',
  },
  syHint: {
    color: '#6b7280',
    marginTop: 1,
  },
  logoutButton: {
    marginTop: 8,
    borderRadius: 8,
    paddingVertical: 4,
  },
  version: {
  textAlign: 'center',
  color: '#999',
  marginTop: 20,
  fontSize: 13,
},
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  modalIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4b5563',
  },
  deleteButton: {
    backgroundColor: '#dc2626',
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
});
