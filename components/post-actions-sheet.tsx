import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { useTheme } from '@/providers/theme-provider';

interface Action {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color?: string;
  onPress: () => void;
  destructive?: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  actions: Action[];
}

/**
 * Bottom sheet com ações contextuais (long press em posts/comentários).
 * Estilo iOS action sheet, com handle de arrasto visual.
 */
export function PostActionsSheet({ visible, onClose, actions }: Props) {
  const { theme } = useTheme();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.4)',
          justifyContent: 'flex-end',
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: theme.surface,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            paddingVertical: 12,
            paddingBottom: 30,
          }}
        >
          {/* Drag handle */}
          <View
            style={{
              alignSelf: 'center',
              width: 40,
              height: 4,
              borderRadius: 999,
              backgroundColor: theme.border,
              marginBottom: 10,
            }}
          />
          {actions.map((a, i) => (
            <Pressable
              key={i}
              onPress={() => {
                onClose();
                setTimeout(() => a.onPress(), 200);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                paddingHorizontal: 22,
                paddingVertical: 14,
              }}
            >
              <Ionicons
                name={a.icon}
                size={22}
                color={a.destructive ? '#DC2626' : a.color ?? theme.text}
              />
              <Text
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 16,
                  color: a.destructive ? '#DC2626' : a.color ?? theme.text,
                }}
              >
                {a.label}
              </Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
