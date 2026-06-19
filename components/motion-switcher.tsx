import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { useMotion, type MotionMode } from '@/providers/motion-provider';
import { useTheme } from '@/providers/theme-provider';

import { CenteredColumn } from './ui/centered-column';

const OPTIONS: {
  value: MotionMode;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: 'on', label: 'Ligadas', icon: 'sparkles' },
  { value: 'auto', label: 'Auto', icon: 'phone-portrait' },
  { value: 'off', label: 'Pausadas', icon: 'pause' },
];

/**
 * Pill horizontal pra escolher comportamento das animações de avatar:
 * ligadas, automáticas (segue SO) ou pausadas.
 *
 * Inclui ajuda contextual: explica que "auto" segue Reduzir Movimento do
 * dispositivo.
 */
export function MotionSwitcher() {
  const { theme } = useTheme();
  const { mode, setMode, systemReducedMotion } = useMotion();

  return (
    <CenteredColumn maxWidth={540}>
      <View style={{ marginTop: 18 }}>
        <Text
          style={{
            fontFamily: FONTS.bodyBold,
            fontSize: 11,
            letterSpacing: 1.4,
            color: theme.textDim,
            textTransform: 'uppercase',
            marginBottom: 8,
            marginLeft: 4,
          }}
        >
          Animações dos pets
        </Text>
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: 14,
            padding: 4,
            flexDirection: 'row',
            gap: 4,
            borderWidth: 1,
            borderColor: theme.borderLight,
          }}
        >
          {OPTIONS.map((opt) => {
            const active = mode === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setMode(opt.value)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 10,
                  backgroundColor: active ? theme.brand : 'transparent',
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 5,
                }}
              >
                <Ionicons
                  name={opt.icon}
                  size={14}
                  color={active ? '#fff' : theme.textMuted}
                />
                <Text
                  style={{
                    fontFamily: FONTS.bodyBold,
                    fontSize: 12,
                    color: active ? '#fff' : theme.textMuted,
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text
          style={{
            fontFamily: FONTS.body,
            fontSize: 11,
            color: theme.textDim,
            marginTop: 6,
            marginLeft: 4,
            lineHeight: 15,
          }}
        >
          {mode === 'auto'
            ? systemReducedMotion
              ? 'Detectamos "Reduzir Movimento" no seu dispositivo, animações pausadas.'
              : 'Segue a preferência de movimento do seu dispositivo.'
            : mode === 'on'
              ? 'Avatares respiram, piscam e reagem nas interações.'
              : 'Avatares estáticos. Útil pra economizar bateria e melhorar acessibilidade.'}
        </Text>
      </View>
    </CenteredColumn>
  );
}
