import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Dimensions, Pressable, Text, View } from 'react-native';

import { getTodayChallenge } from '@/lib/daily-challenges';
import { FONTS } from '@/lib/fonts';
import { FEED_CARD_MARGIN, MAX_FEED_WIDTH } from '@/lib/layout';
import { useTheme } from '@/providers/theme-provider';

export function DailyChallengeCard() {
  const challenge = getTodayChallenge();
  const { theme } = useTheme();
  const SCREEN_W = Dimensions.get('window').width;
  const width = Math.min(SCREEN_W - FEED_CARD_MARGIN * 2, MAX_FEED_WIDTH);

  return (
    <Link href="/(app)/(tabs)/create" asChild>
      <Pressable
        style={{
          width,
          alignSelf: 'center',
          marginVertical: 6,
          backgroundColor: theme.brandSurface,
          borderRadius: 16,
          padding: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          borderWidth: 1,
          borderColor: theme.borderLight,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: theme.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 21 }}>{challenge.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 9.5,
              letterSpacing: 1.1,
              color: theme.brand,
              textTransform: 'uppercase',
              marginBottom: 1,
            }}
          >
            Desafio de hoje
          </Text>
          <Text numberOfLines={1} style={{ fontFamily: FONTS.display, fontSize: 14.5, color: theme.text }}>
            {challenge.title}
          </Text>
          <Text
            numberOfLines={1}
            style={{ fontFamily: FONTS.body, fontSize: 11.5, color: theme.textDim, marginTop: 1 }}
          >
            {challenge.hint}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.textDim} />
      </Pressable>
    </Link>
  );
}
