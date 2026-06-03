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
          marginVertical: 8,
          backgroundColor: theme.brandSurface,
          borderRadius: 18,
          padding: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          borderWidth: 1,
          borderColor: theme.borderLight,
        }}
      >
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            backgroundColor: theme.surface,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 4,
            elevation: 1,
          }}
        >
          <Text style={{ fontSize: 26 }}>{challenge.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 10,
              letterSpacing: 1.2,
              color: theme.brand,
              textTransform: 'uppercase',
              marginBottom: 2,
            }}
          >
            Desafio de hoje
          </Text>
          <Text style={{ fontFamily: FONTS.display, fontSize: 16, color: theme.text }}>
            {challenge.title}
          </Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim, marginTop: 2 }}>
            {challenge.hint}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.textDim} />
      </Pressable>
    </Link>
  );
}
