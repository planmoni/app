import React, { useEffect, useState } from 'react';
import { Channel, MessageList, MessageInput, Chat } from 'stream-chat-expo';
import { chatClient } from '../lib/streamChat';
import { Text, Modal, View, Pressable } from 'react-native';

interface SupportChatProps {
  userId: string;
  userName: string;
  userImage?: string;
  onClose: () => void;
}

export default function SupportChat({ userId, userName, userImage, onClose }: SupportChatProps) {
  const [channel, setChannel] = useState<any>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function setup() {
      await chatClient.connectUser(
        { id: userId, name: userName, image: userImage },
        chatClient.devToken(userId) // TODO: Use a real token in production
      );
      // Use a unique channel ID for each user-support pair
      const channelId = `support_${userId}`;
      const supportChannel = chatClient.channel('messaging', channelId, {
        members: [userId, 'support'],
      });
      await supportChannel.watch();
      if (isMounted) setChannel(supportChannel);
    }
    setup();
    return () => {
      isMounted = false;
      chatClient.disconnectUser();
    };
  }, [userId, userName, userImage]);

  const handleClose = () => {
    setVisible(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <Pressable style={{ padding: 16, alignSelf: 'flex-end' }} onPress={handleClose}>
          <Text style={{ color: '#1E3A8A', fontWeight: 'bold' }}>Close</Text>
        </Pressable>
        {!channel ? (
          <Text style={{ padding: 24, textAlign: 'center' }}>Loading chat...</Text>
        ) : (
          <Chat client={chatClient}>
            <Channel channel={channel}>
              <MessageList />
              <MessageInput />
            </Channel>
          </Chat>
        )}
      </View>
    </Modal>
  );
} 