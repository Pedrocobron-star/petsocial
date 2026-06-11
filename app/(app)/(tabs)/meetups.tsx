import { Ionicons } from '@expo/vector-icons';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HeaderHomeIcon } from '@/components/header-home-logo';
import { FONTS } from '@/lib/fonts';
import { AppThemeProvider } from '@/providers/app-theme-provider';
import { useTheme } from '@/providers/theme-provider';

// ⚠️ App "Rolês" (Encontros) está EM DESENVOLVIMENTO. O código da feature (lista
// de encontros, RSVP, criar evento, agenda) está no histórico do git — esta tela
// é o "em breve" temporário enquanto a experiência não está redonda. Pra reativar,
// restaure a versão anterior deste arquivo.
export default function MeetupsScreen() {
  return (
    <AppThemeProvider app="meetups">
      <ComingSoon />
    </AppThemeProvider>
  );
}

const NEXT: { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string }[] = [
  { icon: 'calendar', title: 'Encontros pet', sub: 'Marque passeios e encontrões com a galera dos pets' },
  { icon: 'paw', title: 'Quem vai', sub: 'Confirme presença e veja quais pets vão aparecer' },
  { icon: 'location', title: 'No mapa', sub: 'Encontros perto de você, integrados ao guia de Lugares' },
];

function ComingSoon() {
  const { theme } = useTheme();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
          backgroundColor: theme.surface,
          paddingHorizontal: 8,
          paddingVertical: 12,
        }}
      >
        <HeaderHomeIcon />
        <Text style={{ fontFamily: FONTS.display, fontSize: 17, color: theme.text, marginLeft: 4 }}>Rolês</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, alignItems: 'center', paddingTop: 40 }}>
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: 26,
            backgroundColor: theme.accent.color,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="construct" size={42} color={theme.accent.onAccent} />
        </View>

        <View style={{ alignItems: 'center', gap: 6 }}>
          <View
            style={{
              backgroundColor: theme.borderLight,
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 5,
            }}
          >
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 1, color: theme.accent.color }}>
              EM DESENVOLVIMENTO
            </Text>
          </View>
          <Text style={{ fontFamily: FONTS.display, fontSize: 24, color: theme.text, textAlign: 'center', marginTop: 6 }}>
            Os Rolês tão chegando 🐾
          </Text>
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 14,
              color: theme.textDim,
              textAlign: 'center',
              lineHeight: 20,
              maxWidth: 320,
            }}
          >
            Tô caprichando nos encontros e passeios em grupo pra ficar redondo antes de
            abrir. Enquanto isso, segue cuidando do seu pet e postando no feed!
          </Text>
        </View>

        <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 8, maxWidth: 480, width: '100%' }}>
          {NEXT.map((n) => (
            <View
              key={n.title}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                backgroundColor: theme.surface,
                borderRadius: 14,
                padding: 14,
                borderWidth: 1,
                borderColor: theme.borderLight,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: theme.borderLight,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name={n.icon} size={20} color={theme.accent.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.text }}>{n.title}</Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim, marginTop: 1 }}>
                  {n.sub}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
