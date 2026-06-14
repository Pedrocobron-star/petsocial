import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { useTheme } from '@/providers/theme-provider';

/**
 * Peças legais compartilhadas pelos murais de Adoção e Achados.
 *
 * - RulesCheckbox: aceite obrigatório das Regras de Anúncios de Animais, com
 *   link opcional pra ler o texto completo (/legal/animais).
 * - ModerationNotice: aviso de como/quando o anúncio entra no ar
 *   ('review24h' = Adoção passa por aprovação; 'instant' = Achados na hora).
 * - PendingBadge: selo "Em análise" pro dono ver o próprio anúncio pendente.
 */

export function RulesCheckbox({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: () => void;
}) {
  const { theme } = useTheme();
  const router = useRouter();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
      <Pressable
        onPress={onToggle}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel="Li e concordo com as regras"
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: checked ? theme.brand : theme.border,
          backgroundColor: checked ? theme.brand : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 1,
        }}
      >
        {checked ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
      </Pressable>
      <Text style={{ flex: 1, fontFamily: FONTS.body, fontSize: 13, color: theme.text, lineHeight: 19 }}>
        <Text onPress={onToggle}>Li e concordo com as </Text>
        <Text
          onPress={() => router.push('/legal/animais' as never)}
          style={{ fontFamily: FONTS.bodyBold, color: theme.brand, textDecorationLine: 'underline' }}
        >
          Regras de Anúncios de Animais
        </Text>
        <Text onPress={onToggle}>
          {' '}— informações verdadeiras e ciência de que o Maestro Pet apenas divulga.
        </Text>
      </Text>
    </View>
  );
}

export function ModerationNotice({ variant }: { variant: 'review24h' | 'instant' }) {
  const { theme } = useTheme();
  const review = variant === 'review24h';
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 8,
        backgroundColor: theme.brandSurface,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: theme.brandLight,
      }}
    >
      <Ionicons
        name={review ? 'shield-checkmark' : 'flash'}
        size={18}
        color={theme.brandDark}
        style={{ marginTop: 1 }}
      />
      <Text style={{ flex: 1, fontFamily: FONTS.body, fontSize: 12, color: theme.brandDark, lineHeight: 17 }}>
        {review ? (
          <>
            Seu anúncio passa por uma <Text style={{ fontFamily: FONTS.bodyBold }}>revisão</Text> e entra
            no ar em até <Text style={{ fontFamily: FONTS.bodyBold }}>24 horas</Text> após a aprovação.
            Isso protege a comunidade contra golpes e maus-tratos.
          </>
        ) : (
          <>
            Seu reporte entra no ar <Text style={{ fontFamily: FONTS.bodyBold }}>na hora</Text> — todo
            minuto conta. Reportes que violarem as regras podem ser removidos a qualquer momento.
          </>
        )}
      </Text>
    </View>
  );
}

/** Selo "Em análise" — mostrado pro dono enquanto o anúncio aguarda aprovação. */
export function PendingBadge({ compact }: { compact?: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#FEF3C7',
        paddingHorizontal: compact ? 8 : 10,
        paddingVertical: compact ? 3 : 4,
        borderRadius: 999,
      }}
    >
      <Ionicons name="time-outline" size={compact ? 12 : 13} color="#92400E" />
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: compact ? 10 : 11, color: '#92400E' }}>
        Em análise
      </Text>
    </View>
  );
}
