import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useAuthContext } from './AuthContext';
import { notificationService } from '../services/notificationService';

interface NotificationContextType {
  pushToken: string | null;
}

const NotificationContext = createContext<NotificationContextType>({
  pushToken: null,
});

export const useNotifications = () => useContext(NotificationContext);

const navigateToRoute = (router: ReturnType<typeof useRouter>, route: string) => {
  try {
    router.push(route as any);
  } catch (error) {
    console.warn('Failed to navigate to notification route:', error);
  }
};

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuthContext();
  const router = useRouter();
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);
  const registeredUserIdRef = React.useRef<string | null>(null);

  // Handle taps while the app is foregrounded or backgrounded.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const route = notificationService.handleNotificationResponse(response);
        if (route) setPendingRoute(route);
      }
    );

    return () => subscription.remove();
  }, []);

  // Handle a cold start (app launched by tapping a notification).
  useEffect(() => {
    notificationService.getLastNotificationRoute().then((route) => {
      if (route) setPendingRoute(route);
    });
  }, []);

  // Register for push + run the payment-due daily check when a user signs in.
  useEffect(() => {
    if (!user) return;

    if (registeredUserIdRef.current !== user.id) {
      registeredUserIdRef.current = user.id;
      notificationService
        .registerForPushNotifications()
        .then((token) => {
          if (token) setPushToken(token);
        })
        .catch((error) => {
          console.warn('Failed to register for push notifications:', error);
        });
    }

    if (user.role === 'parent') {
      notificationService
        .schedulePaymentReminders()
        .catch((error) => console.warn('Failed to check payment reminders:', error));
    }
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
    <NotificationContext.Provider value={{ pushToken }}>
      {children}
    </NotificationContext.Provider>
  );
};