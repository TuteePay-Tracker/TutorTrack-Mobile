import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  Timestamp,
  getDocs,
  getDoc,
  writeBatch,
  deleteDoc,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, auth } from './firebaseConfig';
import { notificationService } from './notificationService';
import { ChatThread, Message } from '../types/chat';
import { Tutee } from '../types/tutee';

export const chatService = {
  subscribeToThreads(
    userId: string,
    role: string,
    callback: (threads: ChatThread[]) => void,
    errorCallback?: (error: Error) => void
  ): () => void {
    const chatsRef = collection(db, 'chats');
    const field = role === 'tutor' ? 'tutorId' : 'parentId';
    const q = query(chatsRef, where(field, '==', userId));

    return onSnapshot(
      q,
      (snapshot) => {
        const threads = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as ChatThread[];

        threads.sort((a, b) => {
          const aTime = a.lastMessageTimestamp?.toDate?.() || new Date(0);
          const bTime = b.lastMessageTimestamp?.toDate?.() || new Date(0);
          return bTime.getTime() - aTime.getTime();
        });

        callback(threads);
      },
      (error) => {
        errorCallback?.(error);
      }
    );
  },

  subscribeToMessages(chatId: string, callback: (messages: Message[]) => void): () => void {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef);

    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Message[];

      messages.sort((a, b) => {
        const aTime = a.timestamp?.toDate?.() || new Date(0);
        const bTime = b.timestamp?.toDate?.() || new Date(0);
        return aTime.getTime() - bTime.getTime();
      });

      callback(messages);
    });
  },

  async sendMessage(
    chatId: string,
    senderId: string,
    senderName: string,
    text: string,
    recipientId: string
  ): Promise<void> {
    const messagesRef = collection(db, 'chats', chatId, 'messages');

    await addDoc(messagesRef, {
      senderId,
      senderName,
      text,
      timestamp: Timestamp.now(),
      status: 'sent',
    });

    const threadDoc = await getDoc(doc(db, 'chats', chatId));
    const currentUnread = threadDoc.data()?.unreadCount?.[recipientId] || 0;

    await updateDoc(doc(db, 'chats', chatId), {
      lastMessageText: text,
      lastMessageSenderId: senderId,
      lastMessageTimestamp: Timestamp.now(),
      updatedAt: Timestamp.now(),
      [`unreadCount.${recipientId}`]: currentUnread + 1,
    });

    // Fire-and-forget push to the receiver only (never the sender).
    notificationService
      .sendChatNotification(recipientId, senderName, text, chatId)
      .catch((error) => console.warn('Failed to send chat push:', error));
  },

  async markAsRead(chatId: string, readerId: string, writerId: string): Promise<void> {
    await updateDoc(doc(db, 'chats', chatId), {
      [`unreadCount.${readerId}`]: 0,
    });

    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const unreadQuery = query(
      messagesRef,
      where('senderId', '==', writerId),
      where('status', '==', 'sent')
    );

    const snapshot = await getDocs(unreadQuery);
    const batch = writeBatch(db);
    snapshot.docs.forEach((docSnap) => {
      batch.update(docSnap.ref, { status: 'seen' });
    });
    await batch.commit();
  },

  async deleteMessage(chatId: string, messageId: string): Promise<void> {
    await deleteDoc(doc(db, 'chats', chatId, 'messages', messageId));

    const latestQuery = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'desc'),
      limit(1)
    );
    const latestSnap = await getDocs(latestQuery);

    if (latestSnap.empty) {
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessageText: '',
        lastMessageSenderId: '',
        lastMessageTimestamp: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    } else {
      const latest = latestSnap.docs[0].data();
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessageText: latest.text || '',
        lastMessageSenderId: latest.senderId || '',
        lastMessageTimestamp: latest.timestamp || Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }
  },

  async getOrCreateThread(
    tutee: Tutee,
    parentId: string,
    tutorId: string
  ): Promise<ChatThread> {
    const threadRef = doc(db, 'chats', tutee.id);
    const threadSnap = await getDoc(threadRef);

    if (threadSnap.exists()) {
      return { id: threadSnap.id, ...threadSnap.data() } as ChatThread;
    }

    const tutorDoc = await getDoc(doc(db, 'users', tutorId));
    const parentDoc = await getDoc(doc(db, 'users', parentId));

    const threadData = {
      tuteeId: tutee.id,
      tuteeName: `${tutee.firstName} ${tutee.surname}`,
      tutorId,
      tutorName: tutorDoc.data()?.name || 'Tutor',
      parentId,
      parentName: parentDoc.data()?.name || 'Parent',
      lastMessageText: '',
      lastMessageSenderId: '',
      lastMessageTimestamp: Timestamp.now(),
      unreadCount: {},
      updatedAt: Timestamp.now(),
    };

    const { setDoc } = await import('firebase/firestore');
    await setDoc(threadRef, threadData);

    return { id: tutee.id, ...threadData } as ChatThread;
  },
};
