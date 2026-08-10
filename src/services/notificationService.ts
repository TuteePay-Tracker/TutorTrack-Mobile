import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  doc,
  setDoc,
  collection,
  getDocs,
  getDoc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore';
import { db, auth } from './firebaseConfig';
import { paymentService } from './paymentService';
import { formatCurrency } from '../utils/formatCurrency';
import {
  PAYMENT_DUE_DAY,
  PAYMENT_REMINDER_DAYS_BEFORE,
  EXPO_PUSH_API_URL,
  NOTIFICATION_CHANNEL_ID,
} from '../config/notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type PushData = Record<string, string | number | boolean>;

interface PushMessageOptions {
  tokens: string[];
  title: string;
  body: string;
  data?: PushData;
  sound?: string;
  priority?: 'default' | 'normal' | 'high';
}

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseMonth(month: string): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, 1);
}

function getDueDate(month: string): Date | null {
  const base = parseMonth(month);
  if (!base) return null;
  return new Date(base.getFullYear(), base.getMonth(), PAYMENT_DUE_DAY);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function reminderKey(recordId: string): string {
  return `paymentReminder_${recordId}`;
}

function pushLogKey(recordId: string): string {
  return `paymentDuePush_${recordId}`;
}

export function notificationRouteFromData(data: Record<string, any>): string | null {
  if (!data || typeof data !== 'object') return null;
  const type = data.type as string | undefined;

  if (type === 'chat') {
    const chatId = data.chatId as string | undefined;
    return chatId ? `/(main)/chat/${chatId}` : null;
  }

  if (type === 'announcement') {
    const announcementId = data.announcementId as string | undefined;
    return announcementId ? `/(main)/announcements/${announcementId}` : null;
  }

  if (type === 'payment' || type === 'paymentDue') {
    return '/(main)/payments';
  }

  return null;
}

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

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563eb',
      });
    }

    const token = await Notifications.getExpoPushTokenAsync();

    const userId = auth.currentUser?.uid;
    if (userId && token.data) {
      await this.saveToken(userId, token.data);
    }

    return token.data;
  },

  async saveToken(userId: string, token: string): Promise<void> {
    try {
      // Store one document per token (id = encoded token) so re-registering
      // overwrites instead of creating duplicates. Delete-then-set keeps the
      // write a "create" for the security rules (set() on an existing doc is
      // gated by the update rule, which may not be deployed yet).
      const tokensRef = collection(db, 'users', userId, 'pushTokens');
      const docId = encodeURIComponent(token);
      await deleteDoc(doc(tokensRef, docId));
      await setDoc(doc(tokensRef, docId), {
        token,
        platform: Platform.OS,
        createdAt: Timestamp.now(),
        lastUsedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Failed to save push token:', error);
    }
  },

  async getUserTokens(userId: string): Promise<string[]> {
    if (!userId) return [];
    try {
      const tokensRef = collection(db, 'users', userId, 'pushTokens');
      const snapshot = await getDocs(tokensRef);
      const tokens = snapshot.docs
        .map((docSnap) => docSnap.data().token)
        .filter((token): token is string => typeof token === 'string' && token.length > 0);
      console.log(
        `[push] getUserTokens(${userId}) -> ${tokens.length} token(s):`,
        tokens.map((t) => t.slice(0, 30))
      );
      return tokens;
    } catch (error) {
      console.warn('Failed to fetch push tokens:', error);
      return [];
    }
  },

  async removeToken(userId: string, token: string): Promise<void> {
    try {
      const docId = encodeURIComponent(token);
      await deleteDoc(doc(db, 'users', userId, 'pushTokens', docId));
    } catch (error) {
      console.warn('Failed to remove push token:', error);
    }
  },

  async sendPushMessage({
    tokens,
    title,
    body,
    data,
    sound = 'default',
    priority = 'high',
  }: PushMessageOptions): Promise<void> {
    const uniqueTokens = [...new Set(tokens)].filter((t) => typeof t === 'string' && t.length > 0);
    if (uniqueTokens.length === 0) return;

    const userId = auth.currentUser?.uid;

    // Expo's API accepts up to 100 messages per request.
    for (let i = 0; i < uniqueTokens.length; i += 100) {
      const chunk = uniqueTokens.slice(i, i + 100);
      const messages = chunk.map((to) => ({
        to,
        title,
        body,
        sound,
        priority,
        data: data ?? undefined,
      }));

      try {
        const response = await fetch(EXPO_PUSH_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(messages),
        });

        if (!response.ok) {
          console.warn('Expo push API error:', response.status, await response.text());
          continue;
        }

        const tickets = await response.json();
        console.log('[push] Expo push API response:', JSON.stringify(tickets));
        if (Array.isArray(tickets)) {
          tickets.forEach((ticket, index) => {
            if (ticket?.status === 'error') {
              const detail = ticket.details?.error;
              if (detail === 'DeviceNotRegistered' && userId) {
                this.removeToken(userId, chunk[index]);
              } else {
                console.warn('Push ticket error:', detail, ticket.message);
              }
            }
          });
        }
      } catch (error) {
        // Network errors are transient — never delete tokens here.
        console.warn('Failed to send push:', error);
      }
    }
  },

  async sendChatNotification(
    recipientId: string,
    senderName: string,
    messageText: string,
    chatId: string
  ): Promise<void> {
    if (!recipientId) return;
    const tokens = await this.getUserTokens(recipientId);
    if (tokens.length === 0) {
      console.warn(`[push] No push tokens found for recipient ${recipientId}`);
      return;
    }

    const preview =
      messageText.length > 120 ? `${messageText.slice(0, 120)}…` : messageText;

    console.log(`[push] Sending chat push to ${tokens.length} token(s) for chat ${chatId}`);
    await this.sendPushMessage({
      tokens,
      title: senderName || 'New message',
      body: preview,
      data: { type: 'chat', chatId },
    });
  },

  async sendPaymentStatusNotification(
    parentId: string,
    status: 'accepted' | 'rejected',
    tuteeName: string,
    amount: number,
    reason?: string
  ): Promise<void> {
    if (!parentId) return;
    const tokens = await this.getUserTokens(parentId);
    if (tokens.length === 0) return;

    const amountLabel = formatCurrency(amount);
    const title =
      status === 'accepted' ? 'Payment Accepted' : 'Payment Rejected';
    const body =
      status === 'accepted'
        ? `Your payment of ${amountLabel} for ${tuteeName} was verified.`
        : `Your payment of ${amountLabel} for ${tuteeName} was rejected${reason ? `: ${reason}` : ''}.`;

    await this.sendPushMessage({
      tokens,
      title,
      body,
      data: { type: 'payment' },
    });
  },

  async sendPaymentDueNotification(
    parentId: string,
    tuteeName: string,
    dueDate: Date,
    amount: number
  ): Promise<void> {
    if (!parentId) return;
    const tokens = await this.getUserTokens(parentId);
    if (tokens.length === 0) return;

    const dueLabel = dueDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
    });

    await this.sendPushMessage({
      tokens,
      title: 'Payment Due',
      body: `${tuteeName}'s tuition (${formatCurrency(amount)}) is due on ${dueLabel}.`,
      data: { type: 'paymentDue' },
    });
  },

  async cancelScheduledReminders(recordKey: string): Promise<void> {
    const storageKey = reminderKey(recordKey);
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      const ids = raw ? (JSON.parse(raw) as string[]) : [];
      for (const id of ids) {
        try {
          await Notifications.cancelScheduledNotificationAsync(id);
        } catch (error) {
          console.warn('Failed to cancel scheduled notification:', error);
        }
      }
    } catch (error) {
      console.warn('Failed to read scheduled reminders:', error);
    }
    await AsyncStorage.removeItem(storageKey);
  },

  async rescheduleLocalReminders(
    recordKey: string,
    dates: Date[],
    tuteeName: string,
    amount: number,
    dueDate: Date
  ): Promise<void> {
    const storageKey = reminderKey(recordKey);
    await this.cancelScheduledReminders(recordKey);

    if (dates.length === 0) return;

    const dueLabel = dueDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
    });
    const newIds: string[] = [];

    for (const date of dates) {
      try {
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Payment Due',
            body: `${tuteeName}'s tuition (${formatCurrency(amount)}) is due on ${dueLabel}.`,
            sound: 'default',
            data: { type: 'paymentDue' },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date,
          },
        });
        newIds.push(id);
      } catch (error) {
        console.warn('Failed to schedule local reminder:', error);
      }
    }

    await AsyncStorage.setItem(storageKey, JSON.stringify(newIds));
  },

  /**
   * Runs a "daily" payment-due check. Best called whenever the app opens
   * (and after login). Schedules OS-level local notifications for upcoming
   * due dates (these fire even when the app is closed) and sends a remote
   * push once per day while a payment is inside the reminder window.
   */
  async schedulePaymentReminders(): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    const profile = userDoc.data();
    if (!profile || profile.role !== 'parent') return;

    const tutorId = profile.createdByTutorId as string | undefined;
    const linkedStudentIds = (profile.linkedStudentIds || []) as string[];
    if (!tutorId || linkedStudentIds.length === 0) return;

    const today = new Date();
    const todayKey = toDateKey(today);

    for (const tuteeId of linkedStudentIds) {
      let records;
      try {
        records = await paymentService.getRecordsByTutee(tutorId, tuteeId);
      } catch (error) {
        console.warn('Failed to fetch payment records for reminders:', error);
        continue;
      }

      const tuteeName = records.find((r) => r.tuteeId === tuteeId)?.tuteeName || 'Student';

      for (const record of records) {
        const recordKey = record.id || `${tuteeId}_${record.month}`;
        const amount = record.totalBalance || 0;

        // Stop reminders once the payment is marked paid.
        if (amount <= 0) {
          await this.cancelScheduledReminders(recordKey);
          continue;
        }

        const dueDate = getDueDate(record.month);
        if (!dueDate) continue;
        const reminderStart = addDays(dueDate, -PAYMENT_REMINDER_DAYS_BEFORE);

        // (1) OS-level local notifications fire even when the app is closed.
        const dates: Date[] = [];
        if (dueDate.getTime() >= today.getTime()) {
          dates.push(dueDate);
        }
        if (reminderStart.getTime() > today.getTime() && reminderStart.getTime() < dueDate.getTime()) {
          dates.push(reminderStart);
        }
        await this.rescheduleLocalReminders(recordKey, dates, tuteeName, amount, dueDate);

        // (2) One remote push per day while inside the 5-day reminder window.
        if (today.getTime() >= reminderStart.getTime() && today.getTime() <= dueDate.getTime()) {
          const lastPushed = await AsyncStorage.getItem(pushLogKey(recordKey));
          if (lastPushed !== todayKey) {
            await this.sendPaymentDueNotification(currentUser.uid, tuteeName, dueDate, amount);
            await AsyncStorage.setItem(pushLogKey(recordKey), todayKey);
          }
        }
      }
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

  handleNotificationResponse(response: Notifications.NotificationResponse): string | null {
    return notificationRouteFromData(response.notification.request.content.data as Record<string, any>);
  },

  async getLastNotificationRoute(): Promise<string | null> {
    try {
      const response = await Notifications.getLastNotificationResponseAsync();
      if (!response) return null;
      return this.handleNotificationResponse(response);
    } catch (error) {
      console.warn('Failed to read last notification response:', error);
      return null;
    }
  },
};
