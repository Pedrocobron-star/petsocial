import { Ionicons } from '@expo/vector-icons';
import { Link, Stack, useRouter } from 'expo-router';
import { Image, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FONTS } from '@/lib/fonts';
import { MOZART } from '@/lib/mozart';

/**
 * 404 customizado — substitui o "Unmatched Route" padrão do Expo Router.
 * Brand: paw print + tom amigável de "ops, esse caminho não existe".
 */
export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFBF5' }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 32,
          gap: 16,
        }}
      >
        {/* Mozart curioso */}
        <Image
          source={{ uri: MOZART.curioso }}
          style={{ width: 160, height: 160, marginBottom: 4 }}
          resizeMode="contain"
          accessibilityLabel="Mozart curioso"
        />

        <Text
          style={{
            fontFamily: FONTS.display,
            fontSize: 32,
            color: '#1A1410',
            textAlign: 'center',
            lineHeight: 36,
          }}
        >
          Hmm, essa página{'\n'}não existe
        </Text>

        <Text
          style={{
            fontFamily: FONTS.body,
            fontSize: 15,
            color: '#525252',
            textAlign: 'center',
            lineHeight: 22,
            maxWidth: 320,
          }}
        >
          O cachorro mordeu o link, parece 🐾{'\n'}
          Talvez você queira voltar pra home.
        </Text>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
          <Pressable
            onPress={() => router.back()}
            style={{
              backgroundColor: '#fff',
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: '#E5E5E5',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Ionicons name="arrow-back" size={16} color="#404040" />
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#404040' }}>
              Voltar
            </Text>
          </Pressable>
          <Link href="/(app)/(tabs)" asChild>
            <Pressable
              style={{
                backgroundColor: '#F97316',
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderRadius: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                shadowColor: '#F97316',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 8,
              }}
            >
              <Text style={{ fontSize: 16 }}>🐾</Text>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#fff' }}>
                Maestro Pet
              </Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}
