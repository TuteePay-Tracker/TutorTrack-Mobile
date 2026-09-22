import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Pressable,
  Alert,
  StyleProp,
  ViewStyle,
  Animated as RNAnimated,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../../src/hooks/useAuth';
import { chatService } from '../../../../src/services/chatService';
import { Message, ChatThread } from '../../../../src/types/chat';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../../src/services/firebaseConfig';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import Swipeable from 'react-native-gesture-handler/Swipeable';

const ESTIMATED_ROW_HEIGHT = 72;

const SwipeableMessageRow = React.memo(function SwipeableMessageRow({
  item,
  children,
  onSwipeToReply,
}: {
  item: Message;
  children: React.ReactNode;
  onSwipeToReply: (message: Message) => void;
}) {
  const swipeableRef = useRef<any>(null);

  return (
    <Swipeable
      ref={swipeableRef}
      onSwipeableLeftWillOpen={() => {
        onSwipeToReply(item);
        setTimeout(() => {
          swipeableRef.current?.close();
        }, 100);
      }}
      renderLeftActions={(progress, dragX) => {
        const trans = dragX.interpolate({
          inputRange: [0, 50, 100],
          outputRange: [-30, 0, 10],
          extrapolate: 'clamp',
        });
        return (
          <View style={styles.swipeLeftAction}>
            <RNAnimated.View style={{ transform: [{ translateX: trans }] }}>
              <MaterialCommunityIcons name="reply" size={scale(22)} color="#2563eb" />
            </RNAnimated.View>
          </View>
        );
      }}
      friction={2}
      leftThreshold={80}
    >
      {children}
    </Swipeable>
  );
});

export default function ChatScreen() {
  const { id: chatId } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [olderMessages, setOlderMessages] = useState<Message[]>([]);
  const [latestMessages, setLatestMessages] = useState<Message[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);

  const [thread, setThread] = useState<ChatThread | null>(null);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const isNearBottomRef = useRef(true);
  const lastMessageIdRef = useRef<string | null>(null);
  const oldestTimestampRef = useRef<any>(null);
  const isLoadingOlderRef = useRef(false);

  const latestMessagesRef = useRef<Message[]>([]);

  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);

  const allMessages = useMemo(() => {
    return [...olderMessages, ...latestMessages];
  }, [olderMessages, latestMessages]);

  useEffect(() => {
    latestMessagesRef.current = latestMessages;
  }, [latestMessages]);

  const reversedMessages = useMemo(() => {
    const reversed = [];
    for (let i = allMessages.length - 1; i >= 0; i--) {
      reversed.push(allMessages[i]);
    }
    return reversed;
  }, [allMessages]);

  useEffect(() => {
    if (!chatId || !user?.id) return;
    let cancelled = false;

    const init = async () => {
      setInitialLoading(true);
      setOlderMessages([]);
      setLatestMessages([]);
      setHasMore(true);
      lastMessageIdRef.current = null;
      oldestTimestampRef.current = null;
      isLoadingOlderRef.current = false;

      try {
        const initial = await chatService.fetchInitialMessages(chatId);
        if (cancelled) return;

        const sortedAsc = [...initial].sort((a, b) => {
          const aT = a.timestamp?.toDate?.()?.getTime?.() || 0;
          const bT = b.timestamp?.toDate?.()?.getTime?.() || 0;
          return aT - bT;
        });

        setLatestMessages(sortedAsc);
        lastMessageIdRef.current = sortedAsc.length > 0 ? sortedAsc[sortedAsc.length - 1].id : null;

        if (sortedAsc.length > 0) {
          oldestTimestampRef.current = sortedAsc[0].timestamp;
        }
        if (sortedAsc.length < 30) {
          setHasMore(false);
        }

        setInitialLoading(false);

        requestAnimationFrame(() => {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
        });

        const unreadMessage = sortedAsc.find(
          (m) => m.senderId !== user.id && m.status === 'sent'
        );
        if (unreadMessage) {
          chatService.markAsRead(chatId, user.id, unreadMessage.senderId);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load messages:', error);
          setInitialLoading(false);
        }
      }
    };

    init();

    const unsubscribe = chatService.subscribeToLatestMessages(chatId, (newestDesc) => {
      if (cancelled) return;

      const sortedAsc = [...newestDesc].sort((a, b) => {
        const aT = a.timestamp?.toDate?.()?.getTime?.() || 0;
        const bT = b.timestamp?.toDate?.()?.getTime?.() || 0;
        return aT - bT;
      });

      setLatestMessages((prev) => {
        const prevIds = new Set(prev.map((m) => m.id));
        const merged = [...sortedAsc];

        prev.forEach((msg) => {
          if (!sortedAsc.some((s) => s.id === msg.id)) {
            merged.push(msg);
          }
        });

        merged.sort((a, b) => {
          const aT = a.timestamp?.toDate?.()?.getTime?.() || 0;
          const bT = b.timestamp?.toDate?.()?.getTime?.() || 0;
          return aT - bT;
        });

        return merged;
      });

      const newestId = sortedAsc.length > 0 ? sortedAsc[sortedAsc.length - 1].id : null;
      if (newestId && newestId !== lastMessageIdRef.current && isNearBottomRef.current) {
        requestAnimationFrame(() => {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        });
      }
      lastMessageIdRef.current = newestId;

      const unreadMessage = newestDesc.find(
        (m) => m.senderId !== user.id && m.status === 'sent'
      );
      if (unreadMessage) {
        chatService.markAsRead(chatId, user.id, unreadMessage.senderId);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [chatId, user?.id]);

  const loadOlderMessages = useCallback(async () => {
    if (!chatId || !hasMore || isLoadingOlderRef.current) return;
    isLoadingOlderRef.current = true;
    setLoadingOlder(true);

    try {
      const older = await chatService.fetchOlderMessages(chatId, oldestTimestampRef.current);
      if (older.length === 0) {
        setHasMore(false);
        setLoadingOlder(false);
        isLoadingOlderRef.current = false;
        return;
      }

      const sortedAsc = [...older].sort((a, b) => {
        const aT = a.timestamp?.toDate?.()?.getTime?.() || 0;
        const bT = b.timestamp?.toDate?.()?.getTime?.() || 0;
        return aT - bT;
      });

      setOlderMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const existingLatestIds = new Set(latestMessagesRef.current.map((m) => m.id));
        const deduped = sortedAsc.filter(
          (m) => !existingIds.has(m.id) && !existingLatestIds.has(m.id)
        );
        return [...deduped, ...prev];
      });

      oldestTimestampRef.current = sortedAsc[0].timestamp;

      if (older.length < 30) {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Failed to load older messages:', error);
    } finally {
      setLoadingOlder(false);
      isLoadingOlderRef.current = false;
    }
  }, [chatId, hasMore]);

  useEffect(() => {
    if (!chatId) return;

    const loadThread = async () => {
      try {
        const threadDoc = await getDoc(doc(db, 'chats', chatId));
        if (threadDoc.exists()) {
          setThread({ id: threadDoc.id, ...threadDoc.data() } as ChatThread);
        }
      } catch (error) {
        console.error('Failed to load thread info:', error);
      }
    };

    loadThread();
  }, [chatId]);

  const getPartnerName = useCallback(() => {
    if (!thread || !user) return 'Chat';
    if (user.role === 'parent') {
      return thread.tutorName || 'Tutor';
    }
    return thread.parentName || 'Parent';
  }, [thread, user]);

  const handleSend = useCallback(async () => {
    const trimmed = inputText.trim();
    if (!trimmed || !chatId || !user?.id || !thread) return;

    const messageText = trimmed;
    setInputText('');

    const replyToParam = replyingTo
      ? {
          id: replyingTo.id,
          text: replyingTo.text,
          senderName: replyingTo.senderName,
        }
      : undefined;

    setReplyingTo(null);

    const recipientId = user.role === 'tutor' ? thread.parentId : thread.tutorId;

    try {
      await chatService.sendMessage(chatId, user.id, user.name, messageText, recipientId, replyToParam);

      isNearBottomRef.current = true;
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      setInputText(messageText);
    }
  }, [inputText, chatId, user, thread, replyingTo]);

  const handleDeleteMessage = useCallback((message: Message) => {
    setMessageToDelete(message);
    setDeleteModalVisible(true);
  }, []);

  const handleScroll = useCallback((event: any) => {
    isNearBottomRef.current = event.nativeEvent.contentOffset.y < 80;
  }, []);

  const handleEndReached = useCallback(() => {
    loadOlderMessages();
  }, [loadOlderMessages]);

  const formatTimestamp = useCallback((timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const timeStr = `${displayHours}:${minutes} ${ampm}`;

    if (isToday) return timeStr;

    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${month}/${day} ${timeStr}`;
  }, []);

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: ESTIMATED_ROW_HEIGHT,
      offset: ESTIMATED_ROW_HEIGHT * index,
      index,
    }),
    []
  );

  const onSwipeToReply = useCallback((message: Message) => {
    setReplyingTo(message);
  }, []);

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => {
      const isSent = item.senderId === user?.id;
      const hasReply = !!item.replyToText;

      return (
        <SwipeableMessageRow item={item} onSwipeToReply={onSwipeToReply}>
          <Pressable
            onLongPress={isSent ? () => handleDeleteMessage(item) : undefined}
            delayLongPress={350}
          >
            <View
              style={[
                styles.messageRow,
                isSent ? styles.sentRow : styles.receivedRow,
              ]}
            >
              <View style={[styles.messageBubble, isSent ? styles.sentBubble : styles.receivedBubble]}>
                {!isSent && item.senderName && (
                  <Text style={styles.senderName}>{item.senderName}</Text>
                )}
                {hasReply && (
                  <View
                    style={[
                      styles.replyBubblePreview,
                      isSent ? styles.sentReplyPreview : styles.receivedReplyPreview,
                    ]}
                  >
                    <Text
                      style={[
                        styles.replyPreviewSender,
                        isSent ? styles.sentReplySender : styles.receivedReplySender,
                      ]}
                    >
                      {item.replyToSenderName === user?.name ? 'You' : item.replyToSenderName}
                    </Text>
                    <Text
                      style={[
                        styles.replyPreviewText,
                        isSent ? styles.sentReplyText : styles.receivedReplyText,
                      ]}
                      numberOfLines={1}
                    >
                      {item.replyToText}
                    </Text>
                  </View>
                )}
                <Text style={[styles.messageText, isSent ? styles.sentText : styles.receivedText]}>
                  {item.text}
                </Text>
                <View style={styles.messageFooter}>
                  <Text
                    style={[
                      styles.timestamp,
                      isSent ? styles.sentTimestamp : styles.receivedTimestamp,
                    ]}
                  >
                    {formatTimestamp(item.timestamp)}
                  </Text>
                  {isSent && (
                    <MaterialCommunityIcons
                      name={item.status === 'seen' ? 'check-all' : 'check'}
                      size={scale(14)}
                      color={item.status === 'seen' ? '#93c5fd' : 'rgba(255,255,255,0.6)'}
                      style={styles.readReceipt}
                    />
                  )}
                </View>
              </View>
            </View>
          </Pressable>
        </SwipeableMessageRow>
      );
    },
    [user, handleDeleteMessage, formatTimestamp, onSwipeToReply]
  );

  const renderEmpty = useCallback(
    ({ style }: { style?: StyleProp<ViewStyle> }) => (
      <View style={[styles.emptyContainer, style]}>
        <MaterialCommunityIcons name="chat-outline" size={scale(56)} color="#d1d5db" />
        <Text style={styles.emptyTitle}>Wave hello!</Text>
        <Text style={styles.emptySubtitle}>Send a message to start the conversation.</Text>
      </View>
    ),
    []
  );

  const renderHeader = useCallback(() => {
    if (!hasMore && reversedMessages.length === 0) return null;
    if (loadingOlder) {
      return (
        <View style={styles.olderLoader}>
          <ActivityIndicator size="small" color="#2563eb" />
        </View>
      );
    }
    return null;
  }, [loadingOlder, hasMore, reversedMessages.length]);

  if (initialLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: getPartnerName(),
          headerTintColor: '#2563eb',
        }}
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior="padding"
        keyboardVerticalOffset={insets.top + scale(56)}
      >
        <FlatList
          ref={flatListRef}
          data={reversedMessages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          inverted
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={[
            styles.messageList,
            reversedMessages.length === 0 && styles.messageListEmpty,
          ]}
          ListEmptyComponent={renderEmpty}
          ListHeaderComponent={renderHeader}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          getItemLayout={getItemLayout}
          windowSize={11}
          maxToRenderPerBatch={15}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews
        />
        {replyingTo && (
          <View style={styles.replyBar}>
            <View style={styles.replyBarIndicator} />
            <View style={styles.replyBarContent}>
              <Text style={styles.replyBarTitle}>
                Replying to {replyingTo.senderId === user?.id ? 'yourself' : replyingTo.senderName}
              </Text>
              <Text style={styles.replyBarText} numberOfLines={1}>
                {replyingTo.text}
              </Text>
            </View>
            <IconButton
              icon="close-circle"
              iconColor="#9ca3af"
              size={scale(20)}
              onPress={() => setReplyingTo(null)}
              style={styles.replyCloseButton}
            />
          </View>
        )}
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + verticalScale(8) }]}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type your message here..."
            placeholderTextColor="#9ca3af"
            multiline
            maxLength={1000}
          />
          <IconButton
            icon="send"
            iconColor={inputText.trim() ? '#2563eb' : '#d1d5db'}
            size={scale(24)}
            onPress={handleSend}
            disabled={!inputText.trim()}
            style={styles.sendButton}
          />
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalIconContainer}>
              <MaterialCommunityIcons name="trash-can-outline" size={scale(32)} color="#ef4444" />
            </View>
            <Text style={styles.modalTitle}>Delete message</Text>
            <Text style={styles.modalText}>
              Are you sure you want to delete this message? This action cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.deleteButton]}
                onPress={async () => {
                  if (messageToDelete && chatId) {
                    try {
                      await chatService.deleteMessage(chatId, messageToDelete.id);
                    } catch (error) {
                      console.error('Failed to delete message:', error);
                    } finally {
                      setDeleteModalVisible(false);
                      setMessageToDelete(null);
                    }
                  }
                }}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eff6ff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
  },
  loadingText: {
    marginTop: verticalScale(12),
    color: '#6b7280',
    fontSize: moderateScale(14),
  },
  messageList: {
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(12),
  },
  messageListEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  messageRow: {
    marginVertical: verticalScale(3),
  },
  sentRow: {
    alignItems: 'flex-end',
  },
  receivedRow: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: scale(18),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(10),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: verticalScale(1) },
    shadowOpacity: 0.08,
    shadowRadius: scale(2),
    elevation: 1,
  },
  sentBubble: {
    backgroundColor: '#2563eb',
    borderTopRightRadius: scale(4),
  },
  receivedBubble: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderTopLeftRadius: scale(4),
  },
  senderName: {
    fontSize: moderateScale(11),
    fontWeight: '700',
    color: '#2563eb',
    marginBottom: verticalScale(2),
    textTransform: 'uppercase',
  },
  messageText: {
    fontSize: moderateScale(15),
    lineHeight: verticalScale(21),
  },
  sentText: {
    color: '#ffffff',
  },
  receivedText: {
    color: '#1f2937',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: verticalScale(4),
    gap: scale(4),
  },
  timestamp: {
    fontSize: moderateScale(11),
  },
  sentTimestamp: {
    color: 'rgba(255,255,255,0.7)',
  },
  receivedTimestamp: {
    color: '#9ca3af',
  },
  readReceipt: {
    marginLeft: scale(2),
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(48),
  },
  emptyTitle: {
    fontSize: moderateScale(17),
    fontWeight: '700',
    color: '#374151',
    marginTop: verticalScale(14),
  },
  emptySubtitle: {
    fontSize: moderateScale(13),
    color: '#9ca3af',
    marginTop: verticalScale(4),
    textAlign: 'center',
  },
  olderLoader: {
    paddingVertical: verticalScale(16),
    alignItems: 'center',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(8),
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  textInput: {
    flex: 1,
    minHeight: verticalScale(40),
    maxHeight: verticalScale(100),
    backgroundColor: '#f3f4f6',
    borderRadius: scale(20),
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(10),
    fontSize: moderateScale(15),
    color: '#1f2937',
    marginRight: scale(4),
  },
  sendButton: {
    margin: 0,
  },
  swipeLeftAction: {
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: scale(20),
    width: scale(80),
  },
  replyBubblePreview: {
    borderLeftWidth: 3,
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(4),
    borderRadius: scale(4),
    marginBottom: verticalScale(6),
  },
  sentReplyPreview: {
    borderLeftColor: '#93c5fd',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  receivedReplyPreview: {
    borderLeftColor: '#2563eb',
    backgroundColor: '#f3f4f6',
  },
  replyPreviewSender: {
    fontSize: moderateScale(11),
    fontWeight: '700',
    marginBottom: verticalScale(1),
  },
  sentReplySender: {
    color: '#ffffff',
  },
  receivedReplySender: {
    color: '#2563eb',
  },
  replyPreviewText: {
    fontSize: moderateScale(12),
  },
  sentReplyText: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  receivedReplyText: {
    color: '#4b5563',
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(8),
    backgroundColor: '#f3f4f6',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  replyBarIndicator: {
    width: 4,
    height: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 2,
  },
  replyBarContent: {
    flex: 1,
    marginLeft: scale(10),
  },
  replyBarTitle: {
    fontSize: moderateScale(12),
    fontWeight: '700',
    color: '#2563eb',
  },
  replyBarText: {
    fontSize: moderateScale(13),
    color: '#4b5563',
    marginTop: verticalScale(1),
  },
  replyCloseButton: {
    margin: 0,
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
    borderRadius: scale(20),
    padding: scale(24),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  modalIconContainer: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(28),
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(16),
  },
  modalTitle: {
    fontSize: moderateScale(18),
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: verticalScale(8),
  },
  modalText: {
    fontSize: moderateScale(14),
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: verticalScale(20),
    marginBottom: verticalScale(24),
  },
  modalButtons: {
    flexDirection: 'row',
    gap: scale(12),
    width: '100%',
  },
  modalButton: {
    flex: 1,
    height: verticalScale(44),
    borderRadius: scale(12),
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  cancelButtonText: {
    fontSize: moderateScale(15),
    fontWeight: '600',
    color: '#4b5563',
  },
  deleteButton: {
    backgroundColor: '#ef4444',
  },
  deleteButtonText: {
    fontSize: moderateScale(15),
    fontWeight: '600',
    color: '#ffffff',
  },
});
