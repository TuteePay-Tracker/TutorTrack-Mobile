import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import * as Notifications from 'expo-notifications';
import { AppState } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthContext } from './AuthContext';
import {
  notificationService,
  registerMessageReplyCategory,
  isPushDisabled,
} from '../services/notificationService';
import { REPLY_ACTION_IDENTIFIER } from '../config/notifications';

interface NotificationContextType {
  pushToken: string | null;
  pushEnabled: boolean;
}

const NotificationContext = createContext<NotificationContextType>({
  pushToken: null,
  pushEnabled: false,
});

export const useNotifications = () => useContext(NotificationContext);

const navigateToRoute = (router: ReturnType<typeof useRouter>, route: string) => {
  try {
    const isChat = route.startsWith('/(main)/chat/') || route.startsWith('/chat/');
    const isAnnouncement = route.startsWith('/(main)/announcements/') || route.startsWith('/announcements/');

    if (isChat) {
      router.navigate('/(main)/chat');
      setTimeout(() => {
        router.navigate(route as any);
      }, 100);
    } else if (isAnnouncement) {
      router.navigate('/(main)/announcements');
      setTimeout(() => {
        router.navigate(route as any);
      }, 100);
    } else {
      router.navigate(route as any);
    }
  } catch (error) {
    console.warn('Failed to navigate to notification route:', error);
  }
};

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuthContext();
  const router = useRouter();
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);
  const registeredUserIdRef = React.useRef<string | null>(null);

  // Register the Reply category so chat notifications show a direct-reply
  // action (only matters on Android; harmless elsewhere).
  useEffect(() => {
    registerMessageReplyCategory();
  }, []);

  // Handle taps while the app is foregrounded or backgrounded. A reply from the
  // notification's Reply action is sent directly instead of navigating.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        if (response.actionIdentifier === REPLY_ACTION_IDENTIFIER) {
          notificationService
            .handleQuickReply(response)
            .catch((error) => console.warn('Failed to process quick reply:', error));
          return;
        }
        const route = notificationService.handleNotificationResponse(response);
        if (route) setPendingRoute(route);
      }
    );

    return () => subscription.remove();
  }, []);

  // Handle a cold start (app launched by tapping a notification). A pending
  // quick-reply is sent (idempotently) but never navigates.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await Notifications.getLastNotificationResponseAsync();
        if (!response || cancelled) return;
        if (response.actionIdentifier === REPLY_ACTION_IDENTIFIER) {
          await notificationService.handleQuickReply(response);
          return;
        }
        const route = notificationService.handleNotificationResponse(response);
        if (route) setPendingRoute(route);
      } catch (error) {
        console.warn('Failed to handle cold-start notification:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Register for push + run the payment-due daily check when a user signs in.
  //
  // Registration must NOT be gated on the UID alone: a restored parent account
  // keeps the same UID but loses its `pushTokens` subcollection when the old
  // account was cleared. `ensurePushTokenRegistered` re-saves the device token
  // whenever it is missing, so notifications keep working without the user
  // having to toggle the setting off and on.
  useEffect(() => {
    if (!user) {
      // Session ended (logout or revoked account): forget the previous user so
      // the next sign-in always re-registers their token.
      registeredUserIdRef.current = null;
      setPushToken(null);
      setPushEnabled(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const disabled = await isPushDisabled();
        if (cancelled) return;
        if (disabled) {
          setPushEnabled(false);
          return;
        }

        const token = await notificationService.ensurePushTokenRegistered();
        if (cancelled) return;
        if (token) {
          registeredUserIdRef.current = user.id;
          setPushToken(token);
          setPushEnabled(true);
        } else {
          setPushEnabled(false);
        }
      } catch (error) {
        console.warn('Failed to register for push notifications:', error);
      }
    })();

    // Payment reminders (local + remote push) only apply when notifications
    // have not been disabled from the Settings screen.
    if (user.role === 'parent') {
      isPushDisabled().then((disabled) => {
        if (disabled || cancelled) return;
        notificationService
          .schedulePaymentReminders()
          .catch((error) => console.warn('Failed to check payment reminders:', error));
      });
    }

    return () => {
      cancelled = true;
    };
  }, [user]);

  // Re-check the token whenever the app returns to the foreground. This covers
  // a restore performed while the app was backgrounded and any token cleanup
  // that happened while the device was idle.
  useEffect(() => {
    if (!user) return;

    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      isPushDisabled()
        .then((disabled) => {
          if (disabled) return undefined;
          return notificationService.ensurePushTokenRegistered().then((token) => {
            if (token) {
              registeredUserIdRef.current = user.id;
              setPushToken(token);
              setPushEnabled(true);
            }
          });
        })
        .catch((error) => {
          console.warn('Failed to refresh push token on foreground:', error);
        });
    });

    return () => subscription.remove();
  }, [user]);

  // Flush a pending notification route once the user is authenticated and the
  // auth/navigation stack is fully mounted.
  useEffect(() => {
    if (!user || !pendingRoute) return;
    const route = pendingRoute;
    setPendingRoute(null);
    setTimeout(() => navigateToRoute(router, route), 400);
  }, [user, pendingRoute, router]);

  return (
    <NotificationContext.Provider value={{ pushToken, pushEnabled }}>
      {children}
    </NotificationContext.Provider>
  );
};