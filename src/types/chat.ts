export interface ChatThread {
  id: string;
  tuteeId: string;
  tuteeName: string;
  tutorId: string;
  tutorName: string;
  parentId: string;
  parentName: string;
  lastMessageText?: string;
  lastMessageSenderId?: string;
  lastMessageTimestamp?: any;
  unreadCount: Record<string, number>;
  updatedAt: any;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: any;
  status: 'sent' | 'seen';
}
