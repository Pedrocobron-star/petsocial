import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { Image, Pressable, Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { MOZART } from '@/lib/mozart';
import { useTheme } from '@/providers/theme-provider';

import { AnimatedBell } from './animated-bell';

interface Props {
  unreadMessages: number;
  unreadNotifications: number;
}

/**
 * Header compacto do Feed — logo + chat + sino. Baixo de propósito pra sobrar
 * tela pro conteúdo.
 */
export function FeedHeader({ unreadMessages, unreadNotifications }: Props) {
  const { theme } = useTheme();
  const router = useRouter();

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        paddingHorizontal: 14,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: theme.borderLight,
      }}
    >
      <Pressable
        onPress={() => router.replace('/(app)/phone' as never)}
        accessibilityRole="button"
        accessibilityLabel="Voltar pro celular do pet"
        hitSlop={8}
        style={{ flexDirection: 'row', alignItems: 'center' }}
      >
        <Image
          source={{ uri: MOZART.rosto }}
          style={{ width: 34, height: 34 }}
          resizeMode="contain"
          accessibilityLabel=""
        />
      </Pressable>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Link href={'/(app)/messages' as never} asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              unreadMessages > 0
                ? `Mensagens, ${unreadMessages} não lidas`
                : 'Mensagens'
            }
            hitSlop={6}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              backgroundColor: theme.borderLight,
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <Ionicons name="paper-plane-outline" size={20} color={theme.text} />
            {unreadMessages > 0 ? (
              <View
                style={{
                  position: 'absolute',
                  top: 3,
                  right: 3,
                  minWidth: 15,
                  height: 15,
                  paddingHorizontal: 3,
                  borderRadius: 7.5,
                  backgroundColor: theme.brand,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: theme.surface,
                }}
              >
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 9, color: '#fff' }}>
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </Link>
        <Link href={'/(app)/notifications' as never} asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              unreadNotifications > 0
                ? `Notificações, ${unreadNotifications} não lidas`
                : 'Notificações'
            }
            hitSlop={6}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              backgroundColor: theme.borderLight,
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <AnimatedBell count={unreadNotifications} color={theme.text} size={20} />
            {unreadNotifications > 0 ? (
              <View
                style={{
                  position: 'absolute',
                  top: 3,
                  right: 3,
                  minWidth: 15,
                  height: 15,
                  paddingHorizontal: 3,
                  borderRadius: 7.5,
                  backgroundColor: '#EF4444',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: theme.surface,
                }}
              >
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 9, color: '#fff' }}>
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </Link>
      </View>
    </View>
  );
}
