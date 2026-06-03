import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { useTheme } from '@/providers/theme-provider';

import { AnimatedBell } from './animated-bell';

interface Props {
  unreadMessages: number;
  unreadNotifications: number;
}

/**
 * Header refinado do Feed.
 * - Logo Pet Social com paw e gradient hint
 * - 2 ícones (chat + bell) com badges arredondados
 * - Borda inferior sutilíssima
 */
export function FeedHeader({ unreadMessages, unreadNotifications }: Props) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        paddingHorizontal: 16,
        paddingVertical: 13,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: theme.borderLight,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            backgroundColor: '#FFEDD5',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 18 }}>🐾</Text>
        </View>
        <Text
          style={{
            fontFamily: FONTS.display,
            fontSize: 22,
            color: theme.brand,
            letterSpacing: -0.5,
          }}
        >
          Pet Social
        </Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Link href={'/(app)/messages' as never} asChild>
          <Pressable
            hitSlop={6}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: theme.borderLight,
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <Ionicons name="paper-plane-outline" size={22} color={theme.text} />
            {unreadMessages > 0 ? (
              <View
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  minWidth: 16,
                  height: 16,
                  paddingHorizontal: 3,
                  borderRadius: 8,
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
            hitSlop={6}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: theme.borderLight,
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <AnimatedBell count={unreadNotifications} color={theme.text} size={22} />
            {unreadNotifications > 0 ? (
              <View
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  minWidth: 16,
                  height: 16,
                  paddingHorizontal: 3,
                  borderRadius: 8,
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
