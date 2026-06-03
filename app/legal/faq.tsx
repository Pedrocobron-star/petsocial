import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { LegalPage } from '@/components/legal-page';

const FAQS = [
  {
    q: 'O Pet Social é grátis mesmo?',
    a: 'Sim. Você pode cadastrar quantos pets quiser, postar, seguir e marcar encontros sem pagar nada. No futuro pode rolar funcionalidade premium, mas o que existe hoje continua grátis.',
  },
  {
    q: 'Posso ter mais de um pet na mesma conta?',
    a: 'Pode. O modelo é justamente esse — uma conta de tutor controla N pets. Cada pet tem perfil próprio, seguidores próprios e posta em nome próprio. Você troca de "pet ativo" no topo do feed ou na aba Perfil.',
  },
  {
    q: 'Por que não tem timeline de humano?',
    a: 'Porque o ponto do app é pet. Se você quer ver foto da tia no almoço, tem outras redes. Aqui é só fofura animal.',
  },
  {
    q: 'Posso usar o app em vários dispositivos?',
    a: 'Pode. Funciona no navegador (web), no celular (iOS, Android) e até em tablet. Mesma conta em todos os dispositivos.',
  },
  {
    q: 'Como funciona um encontro (meetup)?',
    a: 'Um pet cria o encontro com local, data e descrição. Outros pets podem confirmar presença com um toque. Você vê na aba Encontros tudo que tá rolando, divido entre "Próximos", "Que vou" e "Sou host".',
  },
  {
    q: 'O que acontece se eu excluir um pet?',
    a: 'Todos os posts, comentários, seguidores e encontros desse pet específico são removidos. Os outros pets da sua conta continuam intactos.',
  },
  {
    q: 'E se eu excluir minha conta inteira?',
    a: 'Todos os seus pets, posts, comentários, encontros e dados são removidos do nosso banco. Em até 30 dias os arquivos de mídia (fotos/vídeos) também são apagados do storage.',
  },
  {
    q: 'Posso reportar um post inapropriado?',
    a: 'Por enquanto não tem botão de reportar no app — manda email pra contato@petsocial.app com o link do post. A gente avalia em até 48h.',
  },
  {
    q: 'O Pet Social tem versão mobile na App Store ou Play Store?',
    a: 'Ainda não. A versão atual roda no navegador do celular (PWA, dá pra instalar como app). Versões nativas pras lojas estão no roadmap.',
  },
  {
    q: 'Como mudo minha senha?',
    a: 'Na tela de login, clica em "Esqueci a senha" e siga as instruções por email.',
  },
];

export default function FAQPage() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <LegalPage title="Perguntas Frequentes">
      <View className="gap-3">
        {FAQS.map((item, i) => {
          const isOpen = open === i;
          return (
            <Pressable
              key={i}
              onPress={() => setOpen(isOpen ? null : i)}
              className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4"
            >
              <View className="flex-row items-center justify-between gap-3">
                <Text className="flex-1 text-base font-semibold text-neutral-900">{item.q}</Text>
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#737373" />
              </View>
              {isOpen ? (
                <Text className="mt-3 text-base leading-relaxed text-neutral-700">{item.a}</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </LegalPage>
  );
}
