import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import type { ThemeMode } from '@/lib/theme';
import { useTheme } from '@/providers/theme-provider';

import { CenteredColumn } from './ui/centered-column';

const OPTIONS: {
  value: ThemeMode;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: 'light', label: 'Claro', icon: 'sunny' },
  { value: 'dark', label: 'Escuro', icon: 'moon' },
  { value: 'system', label: 'Auto', icon: 'phone-portrait' },
];

/**
 * Pill horizontal pra escolher tema: claro / escuro / sistema.
 * Cor de fundo respeita o tema atual; opção ativa usa brand.
 */
export function ThemeSwitcher() {
  const { theme, mode, setMode } = useTheme();

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
          Aparência
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
      </View>
    </CenteredColumn>
  );
}
