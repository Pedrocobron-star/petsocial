import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { FONTS } from '@/lib/fonts';

import { CenteredColumn } from './ui/centered-column';
import { PressScale } from './ui/press-scale';

/**
 * Banner de entrada para o Wall of Fame.
 * Card preto com troféu dourado destaque — mesma linguagem do Hub de Saúde.
 */
export function WallOfFameBanner() {
  return (
    <Animated.View entering={FadeInDown.duration(300)}>
      <CenteredColumn maxWidth={540}>
        <Link href={'/(app)/wall-of-fame' as never} asChild>
          <PressScale
            style={{
              marginTop: 12,
              backgroundColor: '#1A1410',
              borderRadius: 18,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              overflow: 'hidden',
            }}
          >
            {/* Decoração de troféus flutuante */}
            <Text
              style={{
                position: 'absolute',
                top: -8,
                right: -4,
                fontSize: 72,
                opacity: 0.06,
                transform: [{ rotate: '15deg' }],
              }}
            >
              🏆
            </Text>
            <Text
              style={{
                position: 'absolute',
                bottom: -16,
                right: 60,
                fontSize: 44,
                opacity: 0.05,
                transform: [{ rotate: '-12deg' }],
              }}
            >
              ⭐
            </Text>

            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                backgroundColor: '#FBBF24',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#FBBF24',
                shadowOpacity: 0.4,
                shadowRadius: 10,
              }}
            >
              <Text style={{ fontSize: 26 }}>🏆</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: '#fff' }}>
                Wall of Fame
              </Text>
              <Text
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 12,
                  color: '#D4D4D4',
                  marginTop: 2,
                }}
              >
                Os pets mais curtidos da semana 🥇
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#FBBF24" />
          </PressScale>
        </Link>
      </CenteredColumn>
    </Animated.View>
  );
}
