import { Text, View } from 'react-native';

import {
  LegalListItem,
  LegalPage,
  LegalParagraph,
  LegalSection,
} from '@/components/legal-page';

export default function AboutPage() {
  return (
    <LegalPage title="Sobre o Pet Social">
      <View className="mb-8 items-center">
        <Text className="text-6xl">🐾</Text>
        <Text className="mt-3 text-3xl font-bold text-neutral-900">Pet Social</Text>
        <Text className="mt-1 text-base text-neutral-500">A rede dos bichinhos</Text>
      </View>

      <LegalSection title="Nossa missão">
        <LegalParagraph>
          O Pet Social existe pra dar voz aos pets. Cada bichinho tem personalidade, jeitinho próprio
          e merece um espaço onde a foto dele não compete com o almoço de ninguém. Aqui é só pet,
          pet com pet.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="O que torna a gente diferente">
        <LegalListItem>
          <Text className="font-semibold">Cada pet tem perfil próprio.</Text> Não é a sua conta com
          fotos do cachorro. É a conta do cachorro.
        </LegalListItem>
        <LegalListItem>
          <Text className="font-semibold">Encontros no parque.</Text> Marca um meetup e veja quem
          confirma presença. Sem grupo de WhatsApp bagunçado.
        </LegalListItem>
        <LegalListItem>
          <Text className="font-semibold">Sem timeline de humano.</Text> Você abre o app pra ver
          fofura, não política nem propaganda.
        </LegalListItem>
        <LegalListItem>
          <Text className="font-semibold">Grátis pra sempre.</Text> A versão básica não tem
          assinatura escondida. Sem trolagem.
        </LegalListItem>
      </LegalSection>

      <LegalSection title="Como nasceu">
        <LegalParagraph>
          A gente percebeu que tutor de pet usa o feed da rede social principal pra postar foto do
          bicho — mas o algoritmo entrega isso pra três tias que dão tchau. A ideia era criar um
          espaço onde quem entra está ali pra ver pet e nada mais.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Contato">
        <LegalParagraph>
          Tem ideia, bug ou só quer mandar foto do seu pet? Manda um email pra{' '}
          <Text className="font-semibold text-brand-dark">contato@petsocial.app</Text>.
        </LegalParagraph>
      </LegalSection>
    </LegalPage>
  );
}
