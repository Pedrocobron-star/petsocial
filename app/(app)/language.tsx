import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { SUPPORTED_LOCALES, useTranslation, type Locale } from '@/lib/i18n';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

const FLAGS: Record<Locale, string> = {
  'pt-BR': '🇧🇷',
  'en-US': '🇺🇸',
  'es-ES': '🇪🇸',
};

export default function LanguageScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const { locale, setLocale, t } = useTranslation();

  const handleSelect = async (l: Locale) => {
    await setLocale(l);
    toast.success(t('language.saved'));
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: t('language.title') }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
        {SUPPORTED_LOCALES.map((l) => {
          const active = locale === l;
          return (
            <Pressable
              key={l}
              onPress={() => handleSelect(l)}
              style={{
                backgroundColor: theme.surface,
                borderRadius: 14,
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                borderWidth: 2,
                borderColor: active ? theme.brand : 'transparent',
              }}
            >
              <Text style={{ fontSize: 28 }}>{FLAGS[l]}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: theme.text }}>
                  {t(`language.${l}` as 'language.pt-BR' | 'language.en-US' | 'language.es-ES')}
                </Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim, marginTop: 2 }}>
                  {l}
                </Text>
              </View>
              {active ? (
                <Ionicons name="checkmark-circle" size={26} color={theme.brand} />
              ) : (
                <Ionicons name="ellipse-outline" size={26} color={theme.textDim} />
              )}
            </Pressable>
          );
        })}

        <View
          style={{
            marginTop: 16,
            padding: 12,
            backgroundColor: '#FEF3C7',
            borderRadius: 10,
            flexDirection: 'row',
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 14 }}>ℹ️</Text>
          <Text
            style={{
              flex: 1,
              fontFamily: FONTS.body,
              fontSize: 11,
              color: '#78350F',
              lineHeight: 16,
            }}
          >
            Translation is rolling out gradually. Some screens still show in Portuguese for now —
            we&apos;ll catch up soon.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
