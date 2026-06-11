import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { MOZART } from '@/lib/mozart';

import { CenteredColumn } from './ui/centered-column';

/**
 * Cartão de apresentação do Mozart no perfil dele — deixa claro que ele é o
 * maestro/anfitrião oficial da plataforma (não um cão comum). Texto na voz do
 * Mozart: jeitinho de cachorro fofo, SEM travessão (não pode ter cara de IA).
 */
export function MozartFounderCard() {
  return (
    <CenteredColumn maxWidth={540}>
      <View
        style={{
          marginTop: 14,
          backgroundColor: '#1A1410',
          borderRadius: 20,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          overflow: 'hidden',
        }}
      >
        {/* clave de sol decorativa ao fundo */}
        <Text style={{ position: 'absolute', right: -8, bottom: -16, fontSize: 96, opacity: 0.07 }}>
          🎼
        </Text>
        <Image
          source={{ uri: MOZART.oi }}
          style={{ width: 66, height: 66 }}
          contentFit="contain"
        />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONTS.display, fontSize: 16, color: '#FBBF24', marginBottom: 4 }}>
            Oi, eu sou o Mozart! 🐾
          </Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, lineHeight: 19, color: '#E5E5E5' }}>
            eu sou o maestro aqui da casa. cuido do Maestro Pet com todo carinho, trago novidades,
            dou dicas de saúde e fico de olho pra todo mundo ficar feliz. fica à vontade que esse
            cantinho também é seu. au au!
          </Text>
        </View>
      </View>
    </CenteredColumn>
  );
}
