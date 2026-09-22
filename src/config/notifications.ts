export const PAYMENT_DUE_DAY = 1;

export const PAYMENT_REMINDER_DAYS_BEFORE = 5;

export const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';

export const NOTIFICATION_CHANNEL_ID = 'default';

// Category used to render the "Reply" direct-reply action on chat
// notifications. Auto-registered at app startup via setNotificationCategoryAsync.
export const MESSAGE_ACTIONS_CATEGORY_ID = 'MESSAGE_ACTIONS';

// Identifier of the quick-reply action within the message category. Response
// events for this action carry the user's typed text in `response.userText`.
export const REPLY_ACTION_IDENTIFIER = 'reply';
