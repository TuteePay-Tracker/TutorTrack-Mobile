import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { doc, setDoc, collection, addDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from './firebaseConfig';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const notificationService = {
  async registerForPushNotifications(): Promise<string | null> {
    if (!Device.isDevice) {
      console.warn('Push notifications require a physical device');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Push notification permission not granted');
      return null;
    }

    const token = await Notifications.getExpoPushTokenAsync({
      projectId: 'tutorial-management-capstone',
    });

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#15803d',
      });
    }

    const userId = auth.currentUser?.uid;
    if (userId && token.data) {
      await this.saveToken(userId, token.data);
    }

    return token.data;
  },

  async saveToken(userId: string, token: string): Promise<void> {
    try {
      const tokensRef = collection(db, 'users', userId, 'pushTokens');
      await addDoc(tokensRef, {
        token,
        platform: Platform.OS,
        createdAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Failed to save push token:', error);
    }
  },

  addNotificationListener(
    onReceive: (notification: Notifications.Notification) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationReceivedListener(onReceive);
  },

  addResponseListener(
    onResponse: (response: Notifications.NotificationResponse) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationResponseReceivedListener(onResponse);
  },
};
