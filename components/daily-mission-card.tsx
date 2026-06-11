import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { TutorLevelBar } from '@/components/tutor-level-bar';
import {
  fetchMyMonthlyMissionRank,
  fetchTodayMission,
  qkMyMonthlyMission,
  qkTodayMission,
} from '@/lib/daily-missions';
import { FONTS } from '@/lib/fonts';
import { fetchMyTutorPoints, qkMyTutorPoints } from '@/lib/tutor-points';
import { useTheme } from '@/providers/theme-provider';

/**
 * Card "Missão do dia" no topo do feed: um objetivo de foto por dia, com
 * hashtag pra pontuar. Some quando não há missão pro dia. Cumprida = estado
 * verde com streak; pendente = CTA que abre o criar-post já com a hashtag.
 */
export function DailyMissionCard() {
  const { theme } = useTheme();
  const router = useRouter();

  const query = useQuery({
    queryKey: qkTodayMission,
    queryFn: fetchTodayMission,
    staleTime: 5 * 60_000,
  });
  const rankQuery = useQuery({
    queryKey: qkMyMonthlyMission,
    queryFn: fetchMyMonthlyMissionRank,
    staleTime: 60_000,
  });
  const tutorPtsQuery = useQuery({
    queryKey: qkMyTutorPoints,
    queryFn: fetchMyTutorPoints,
    staleTime: 60_000,
  });

  const m = query.data;
  if (!m) return null;

  const done = m.done_today;

  return (
    <View
      style={{
        marginHorizontal: 12,
        marginTop: 12,
        marginBottom: 4,
        borderRadius: 18,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: done ? '#86EFAC' : '#FED7AA',
        backgroundColor: done ? '#F0FDF4' : '#FFF7ED',
      }}
    >
      <View style={{ padding: 16, gap: 10 }}>
        {/* Cabeçalho */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: done ? '#DCFCE7' : '#FFEDD5',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 24 }}>{m.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 10.5,
                  letterSpacing: 1.2,
                  color: done ? '#15803D' : '#C2410C',
                }}
              >
                MISSÃO DO DIA
              </Text>
              <View
                style={{
                  backgroundColor: done ? '#16A34A' : '#F97316',
                  borderRadius: 999,
                  paddingHorizontal: 7,
                  paddingVertical: 1,
                }}
              >
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 9.5, color: '#fff' }}>
                  +{m.points} pts
                </Text>
              </View>
            </View>
            <Text style={{ fontFamily: FONTS.display, fontSize: 17, color: theme.text, marginTop: 1 }}>
              {m.title}
            </Text>
          </View>
        </View>

        {/* Prompt */}
        <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: theme.textDim, lineHeight: 18 }}>
          {m.prompt}
        </Text>

        {/* Rodapé: estado + streak */}
        {done ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: '#DCFCE7',
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
            <Text style={{ flex: 1, fontFamily: FONTS.bodyBold, fontSize: 13, color: '#15803D' }}>
              Missão cumprida hoje! 🏆
            </Text>
            {m.streak > 1 ? (
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#15803D' }}>
                🔥 {m.streak} dias
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable
              onPress={() => router.push(`/(app)/(tabs)/create?tag=${encodeURIComponent(m.hashtag)}` as never)}
              style={{
                flex: 1,
                backgroundColor: '#F97316',
                borderRadius: 12,
                paddingVertical: 11,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
              }}
            >
              <Ionicons name="camera" size={17} color="#fff" />
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13.5, color: '#fff' }}>
                Postar com #{m.hashtag}
              </Text>
            </Pressable>
            {m.streak > 0 ? (
              <View style={{ alignItems: 'center', paddingHorizontal: 4 }}>
                <Text style={{ fontFamily: FONTS.display, fontSize: 16, color: '#C2410C' }}>🔥{m.streak}</Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 9, color: theme.textDim }}>streak</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Nível de Tutor — soma de TODAS as fontes de PT (saúde + missão + social). */}
        <TutorLevelBar
          points={tutorPtsQuery.data ?? m.total_points}
          onPress={() => router.push('/(app)/tutor-points' as never)}
        />

        {/* Atalho pro ranking MENSAL — o 1º do mês ganha 1 mês de Pro. */}
        <Pressable
          onPress={() => router.push('/(app)/mission-ranking' as never)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: '#1A1410',
            borderRadius: 12,
            paddingVertical: 9,
            paddingHorizontal: 11,
          }}
        >
          <Text style={{ fontSize: 16 }}>🏆</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#FBBF24' }}>
              Ranking do mês
            </Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 10.5, color: '#E5E5E5', marginTop: 1 }}>
              {rankQuery.data ? `Você está em ${rankQuery.data.rank}º · ` : ''}o 1º ganha 1 mês de Pet Pro
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#F59E0B" />
        </Pressable>
      </View>
    </View>
  );
}
