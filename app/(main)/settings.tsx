import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, TextInput, Button, Avatar, Divider, Switch } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/hooks/useAuth';
import { useTabBarHeight } from '../../src/hooks/useTabBarHeight';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const [pushEnabled, setPushEnabled] = useState(false);

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?';

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
            router.replace('/(auth)/login');
          } catch {
            Alert.alert('Error', 'Failed to logout. Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: tabBarHeight }]}>
      <Text variant="headlineMedium" style={styles.header}>
        Settings
      </Text>

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
                {user?.email ?? 'No Email'}
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
            label="Email"
            value={user?.email ?? ''}
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
              onValueChange={setPushEnabled}
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

      <Text style={styles.version}>v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
    paddingBottom: 110,
  },
  header: {
    fontWeight: '700',
    color: '#2563eb',
    marginBottom: 20,
  },
  card: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
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
});
