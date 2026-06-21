import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { useTheme } from '@/providers/theme-provider';

/** Botãozinho "CSV" pras listas do admin (export web). */
export function CsvButton({ onPress, theme }: { onPress: () => void; theme: ReturnType<typeof useTheme>['theme'] }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: theme.brandSurface,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 7,
      }}
    >
      <Ionicons name="download-outline" size={14} color={theme.brand} />
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.brand }}>CSV</Text>
    </Pressable>
  );
}
