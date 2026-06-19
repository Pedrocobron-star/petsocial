import { Text } from 'react-native';

import {
  LegalListItem,
  LegalPage,
  LegalParagraph,
  LegalSection,
} from '@/components/legal-page';

export default function TermsPage() {
  return (
    <LegalPage title="Termos de Uso">
      <LegalParagraph>
        Última atualização: 17 de junho de 2026. Ao usar o Maestro Pet, você concorda com estes
        termos. Lê com calma — é curto.
      </LegalParagraph>

      <LegalSection title="1. Quem pode usar">
        <LegalListItem>Você precisa ter no mínimo 13 anos.</LegalListItem>
        <LegalListItem>Você é o tutor (ou responsável) dos pets que cadastra.</LegalListItem>
        <LegalListItem>
          Uma conta por pessoa. Pode cadastrar quantos pets quiser dentro dela.
        </LegalListItem>
      </LegalSection>

      <LegalSection title="2. Conteúdo que você posta">
        <LegalListItem>
          <strong>Você mantém a propriedade</strong> de todo conteúdo que posta (fotos, vídeos,
          textos, registros de saúde). O Maestro Pet NÃO toma posse do seu material.
        </LegalListItem>
        <LegalListItem>
          Você é responsável por garantir que tem direito de publicar — incluindo imagem de outros
          pets, locais e (raramente) pessoas que aparecem nas fotos.
        </LegalListItem>
        <LegalListItem>
          Não poste conteúdo que não seja do seu pet. Não poste rosto de humano sem consentimento
          explícito daquela pessoa.
        </LegalListItem>
        <LegalListItem>
          Conteúdo que mostre maus tratos, violência contra animais, nudez, ódio, assédio ou
          discurso ilegal é removido imediatamente e a conta é banida sem aviso.
        </LegalListItem>
      </LegalSection>

      <LegalSection title="3. Licença que você concede pro Maestro Pet">
        <LegalParagraph>
          Ao postar conteúdo no Maestro Pet, você nos concede uma licença{' '}
          <strong>limitada, mundial, não-exclusiva, isenta de royalties</strong> pra:
        </LegalParagraph>
        <LegalListItem>
          Hospedar, armazenar, reproduzir, processar, transmitir e exibir seu conteúdo
          <strong> exclusivamente dentro do escopo de operação do app</strong> (mostrar no feed,
          perfil do pet, posts, carteirinha digital, share links).
        </LegalListItem>
        <LegalListItem>
          Adaptar tecnicamente o conteúdo pra exibição correta — redimensionar fotos, gerar
          thumbnails, transcodar vídeos, otimizar pra diferentes telas.
        </LegalListItem>
        <LegalListItem>
          Gerar artefatos derivados pra <strong>uso pessoal seu</strong>: PDF da carteira vacinal,
          PDF de sintomas pro vet, retrospectivas anuais, cartazes Lost & Found.
        </LegalListItem>
        <LegalListItem>
          Exibir conteúdo público em previews de share (WhatsApp, Twitter, etc) via Open Graph
          quando você ou outro user compartilha o link.
        </LegalListItem>
        <LegalParagraph>
          <strong>O que NÃO fazemos com seu conteúdo:</strong>
        </LegalParagraph>
        <LegalListItem>
          Não vendemos, alugamos ou cedemos seu conteúdo pra terceiros (anunciantes, brokers de
          dados, etc).
        </LegalListItem>
        <LegalListItem>
          Não usamos suas fotos em campanhas de marketing externas sem permissão explícita por
          escrito.
        </LegalListItem>
        <LegalListItem>
          Não treinamos modelos de IA com seu conteúdo. O Tira-dúvidas de Saúde é um guia de
          referência que roda localmente no app — suas perguntas não são enviadas a serviços de
          IA de terceiros.
        </LegalListItem>
        <LegalParagraph>
          Esta licença <strong>termina automaticamente</strong> quando você apaga o conteúdo ou
          exclui a conta. Pode levar até 30 dias pra remoção completa dos backups (obrigação
          técnica de segurança).
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="4. Direito de imagem do pet">
        <LegalParagraph>
          O ordenamento brasileiro NÃO reconhece direito de imagem pra animais (LCFI Art. 82-A
          c.c. CC Art. 20). Mas reconhece direito do tutor sobre fotos/vídeos do pet como
          extensão da sua propriedade. Você declara, ao postar, que é o tutor (ou tem autorização
          do tutor) e responde por qualquer reclamação de terceiros sobre o conteúdo.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="5. Saúde e cuidados: o que somos e NÃO somos">
        <LegalListItem>
          <strong>O Maestro Pet NÃO é veterinário</strong>. Sintomas, severidades, calendários
          sugeridos e respostas do Tira-dúvidas de Saúde são <strong>referência informativa</strong>,
          nunca diagnóstico nem prescrição.
        </LegalListItem>
        <LegalListItem>
          Registros de saúde (vacinas, parasitas, sintomas, peso) são <strong>seus</strong> — você
          os mostra ao veterinário. Não substituem consulta.
        </LegalListItem>
        <LegalListItem>
          O calendário vacinal sugerido segue protocolos brasileiros padrão (CRMV/WSAVA/MSD/Zoetis),
          mas o protocolo final depende do seu vet — raça, lifestyle e região alteram.
        </LegalListItem>
        <LegalListItem>
          <strong>Em emergências</strong>: procure atendimento veterinário imediatamente. O app
          mostra vets próximos via Pet Map, mas não substitui ligar/levar.
        </LegalListItem>
      </LegalSection>

      <LegalSection title="6. Tira-dúvidas de Saúde">
        <LegalListItem>
          É um guia de referência GRATUITO e ilimitado, com respostas pré-escritas sobre cuidados
          gerais. Não é uma IA conversacional e não tem custo nem limite de uso.
        </LegalListItem>
        <LegalListItem>
          As respostas são geradas localmente no app a partir de uma base de conteúdo. Suas
          perguntas não saem do seu dispositivo nem são enviadas a serviços de terceiros.
        </LegalListItem>
        <LegalListItem>
          O guia NÃO diagnostica nem prescreve. Respostas têm disclaimers claros. Sempre confirme
          com um veterinário.
        </LegalListItem>
      </LegalSection>

      <LegalSection title="7. Comportamento">
        <LegalListItem>
          Trate outros tutores com respeito. Aqui é parque, não trincheira.
        </LegalListItem>
        <LegalListItem>
          Spam, propaganda, links suspeitos ou ofertas comerciais sem aprovação não são permitidos.
        </LegalListItem>
        <LegalListItem>
          Encontros (meetups) são por sua conta e risco. A gente facilita o encontro, mas não
          fiscaliza o que acontece nele.
        </LegalListItem>
        <LegalListItem>
          Pet Map é colaborativo. Reviews de estabelecimentos refletem opinião dos usuários, não
          nossa.
        </LegalListItem>
      </LegalSection>

      <LegalSection title="8. Pet Pro (compra avulsa)">
        <LegalListItem>
          O Pet Pro é uma <strong>compra avulsa (pagamento único)</strong>, não uma assinatura
          recorrente. Você compra o plano mensal (R$ 14,90, libera os recursos por 30 dias) ou o
          anual (R$ 99,90, libera por 365 dias).
        </LegalListItem>
        <LegalListItem>
          <strong>Não há renovação automática nem cobrança recorrente.</strong> Quando o período
          acaba, sua conta volta ao plano grátis e você só paga de novo se quiser — nada é cobrado
          sem você comprar outra vez.
        </LegalListItem>
        <LegalListItem>
          Pagamento por <strong>Pix ou cartão de crédito</strong>, processado pela{' '}
          <strong>Cakto</strong> (Cakto Tecnologia e Pagamentos), nossa intermediadora de pagamento.
          Os dados do seu pagamento são tratados pela Cakto — o Maestro Pet não armazena número de
          cartão.
        </LegalListItem>
        <LegalListItem>
          <strong>Direito de arrependimento:</strong> por ser uma compra online, você pode desistir
          e pedir reembolso integral em até <strong>7 dias corridos</strong> a partir do pagamento
          (Art. 49 do Código de Defesa do Consumidor). É só mandar email pra
          maestropetcontato@gmail.com com o email da compra.
        </LegalListItem>
        <LegalListItem>
          Recursos Pro hoje: <strong>até 6 pets</strong>, posts ilimitados, relatórios e gráficos
          de saúde, co-tutores e o prontuário/carteirinha em PDF sem marca d&apos;água. O que é
          grátis (1 pet, vacinas, lembretes, carteirinha, Jornal Pet e Tira-dúvidas) continua
          grátis.
        </LegalListItem>
        <LegalListItem>
          <strong>Fornecedor:</strong> o Maestro Pet é operado por Pedro Amaral (pessoa física,
          CPF 412.***.***-95). Contato e suporte: maestropetcontato@gmail.com. O endereço completo
          do responsável pode ser solicitado a qualquer momento por esse e-mail.
        </LegalListItem>
      </LegalSection>

      <LegalSection title="9. Conta e segurança">
        <LegalListItem>
          Você é responsável pela segurança da sua conta. Não compartilha sua senha.
        </LegalListItem>
        <LegalListItem>
          Pode excluir sua conta a qualquer momento em Conta &gt; Excluir minha conta. Todos os
          seus dados (pets, posts, comentários, registros de saúde) são removidos
          irreversivelmente em 24h.
        </LegalListItem>
        <LegalListItem>
          Pode exportar todos os seus dados como JSON antes de excluir.
        </LegalListItem>
      </LegalSection>

      <LegalSection title="10. Limitação de responsabilidade">
        <LegalParagraph>
          O Maestro Pet é fornecido &ldquo;como é&rdquo;. Fazemos nosso melhor pra manter o serviço
          no ar, mas não garantimos disponibilidade 100%. Não somos responsáveis por:
        </LegalParagraph>
        <LegalListItem>
          Encontros marcados, perdas, danos ou conflitos entre tutores/pets.
        </LegalListItem>
        <LegalListItem>
          Decisões de saúde tomadas com base em informação do app (sempre consulte vet).
        </LegalListItem>
        <LegalListItem>
          Indisponibilidade momentânea de notificações push em razão de Apple/Google/falha de rede.
        </LegalListItem>
        <LegalListItem>
          Conteúdo postado por outros usuários (use o botão &quot;Reportar&quot; pra moderação).
        </LegalListItem>
      </LegalSection>

      <LegalSection title="11. Mudanças nos termos">
        <LegalParagraph>
          Estes termos podem mudar. Quando mudarem, a gente avisa pelo email da conta + banner no
          app. Se você continuar usando depois da mudança, considera-se que aceitou.
        </LegalParagraph>
      </LegalSection>

      <LegalParagraph>
        Tem dúvida? Manda email pra{' '}
        <Text className="font-semibold text-brand-dark">maestropetcontato@gmail.com</Text>.
      </LegalParagraph>
    </LegalPage>
  );
}
