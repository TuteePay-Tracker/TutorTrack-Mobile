import React, { useEffect, useState, useRef } from 'react';
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
} from 'react-native';
import { Text, IconButton, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../../src/hooks/useAuth';
import { chatService } from '../../../../src/services/chatService';
import { Message, ChatThread } from '../../../../src/types/chat';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../../src/services/firebaseConfig';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import Animated, { FadeIn } from 'react-native-reanimated';

export default function ChatScreen() {
  const { id: chatId } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const isNearBottomRef = useRef(true);
  const messagesLengthRef = useRef(0);

  useEffect(() => {
    if (!chatId || !user?.id) return;

    const unsubscribe = chatService.subscribeToMessages(chatId, (msgs) => {
      setMessages(msgs);
      setLoading(false);

      if (msgs.length > messagesLengthRef.current && isNearBottomRef.current) {
        requestAnimationFrame(() => {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        });
      }
      messagesLengthRef.current = msgs.length;

      const unreadMessage = msgs.find(
        (m) => m.senderId !== user.id && m.status === 'sent'
      );
      if (unreadMessage) {
        chatService.markAsRead(chatId, user.id, unreadMessage.senderId);
      }
    });

    return () => unsubscribe();
  }, [chatId, user?.id]);

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

  const getPartnerName = () => {
    if (!thread || !user) return 'Chat';
    if (user.role === 'parent') {
      return thread.tutorName || 'Tutor';
    }
    return thread.parentName || 'Parent';
  };

  const handleSend = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || !chatId || !user?.id || !thread) return;

    const messageText = trimmed;
    setInputText('');

    const recipientId = user.role === 'tutor' ? thread.parentId : thread.tutorId;

    try {
      await chatService.sendMessage(chatId, user.id, user.name, messageText, recipientId);
    } catch (error) {
      console.error('Failed to send message:', error);
      setInputText(messageText);
    }
  };

  const handleDeleteMessage = (message: Message) => {
    if (!chatId) return;
    Alert.alert(
      'Delete message',
      'Delete this message? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await chatService.deleteMessage(chatId, message.id);
            } catch (error) {
              console.error('Failed to delete message:', error);
            }
          },
        },
      ]
    );
  };

  const handleScroll = (event: any) => {
    isNearBottomRef.current = event.nativeEvent.contentOffset.y < 80;
  };

  const formatTimestamp = (timestamp: any) => {
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
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isSent = item.senderId === user?.id;

    return (
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
          <Animated.View entering={FadeIn.duration(180)}>
            <View style={[styles.messageBubble, isSent ? styles.sentBubble : styles.receivedBubble]}>
              {!isSent && item.senderName && (
                <Text style={styles.senderName}>{item.senderName}</Text>
              )}
              <Text style={[styles.messageText, isSent ? styles.sentText : styles.receivedText]}>
                {item.text}
              </Text>
              <View style={styles.messageFooter}>
                <Text style={[styles.timestamp, isSent ? styles.sentTimestamp : styles.receivedTimestamp]}>
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
          </Animated.View>
        </View>
      </Pressable>
    );
  };

  const renderEmpty = ({ style }: { style?: StyleProp<ViewStyle> }) => (
    <View style={[styles.emptyContainer, style]}>
      <MaterialCommunityIcons name="chat-outline" size={scale(56)} color="#d1d5db" />
      <Text style={styles.emptyTitle}>Wave hello!</Text>
      <Text style={styles.emptySubtitle}>Send a message to start the conversation.</Text>
    </View>
  );

  if (loading) {
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
          data={[...messages].reverse()}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          inverted
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={[
            styles.messageList,
            messages.length === 0 && styles.messageListEmpty,
          ]}
          ListEmptyComponent={renderEmpty}
        />
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
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
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
});
