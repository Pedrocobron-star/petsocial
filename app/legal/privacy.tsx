import {
  LegalListItem,
  LegalPage,
  LegalParagraph,
  LegalSection,
} from '@/components/legal-page';

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de Privacidade">
      <LegalParagraph>
        Última atualização: 23 de maio de 2026. Aqui está como a gente trata seus dados.
        Resumindo: o mínimo necessário pro app funcionar, nada vai pra anunciantes.
      </LegalParagraph>

      <LegalSection title="Dados que coletamos">
        <LegalListItem>Email e nome de exibição (autenticação via Supabase Auth).</LegalListItem>
        <LegalListItem>
          Informações dos pets que você cadastra (nome, espécie, raça, idade, foto, bio,
          configuração de avatar customizado, contatos de emergência declarados).
        </LegalListItem>
        <LegalListItem>
          Conteúdo social que você posta (fotos, vídeos, legendas, comentários, curtidas, follows,
          tags em outros pets).
        </LegalListItem>
        <LegalListItem>
          <strong>Registros de saúde do pet</strong>: vacinas aplicadas, parasitas tratados,
          consultas veterinárias, peso, dieta atual, sintomas registrados (com fotos opcionais).
        </LegalListItem>
        <LegalListItem>
          Mensagens enviadas ao assistente IA — usadas pra gerar respostas + rate-limit do plano
          free (5/dia).
        </LegalListItem>
        <LegalListItem>
          Push token do device (Expo Push), guardado pra enviar lembretes de saúde — removido
          automaticamente no logout.
        </LegalListItem>
        <LegalListItem>
          Snapshot mensal do Bidu Score (score numérico + componentes) pra mostrar evolução.
        </LegalListItem>
        <LegalListItem>
          Dados técnicos do app (versão, plataforma) pra diagnosticar bugs via tabela app_errors.
        </LegalListItem>
      </LegalSection>

      <LegalSection title="O que NÃO coletamos">
        <LegalListItem>
          Localização precisa contínua (só salvamos cidades de encontros e endereços de places que
          você cadastra manualmente).
        </LegalListItem>
        <LegalListItem>Lista de contatos do seu celular ou redes sociais.</LegalListItem>
        <LegalListItem>Histórico de navegação fora do app.</LegalListItem>
        <LegalListItem>
          Dados bancários — pagamentos Pro são processados via Stripe/MercadoPago, nunca passam
          pelos nossos servidores.
        </LegalListItem>
        <LegalListItem>
          <strong>Diagnóstico médico</strong>: o app NUNCA diagnostica. Sintomas e severidades
          registrados são percepção do tutor pra mostrar ao veterinário — não classificação clínica.
        </LegalListItem>
      </LegalSection>

      <LegalSection title="Como usamos os dados">
        <LegalListItem>
          Operar o app: mostrar feed, enviar lembretes de saúde (push local + servidor),
          processar mutações.
        </LegalListItem>
        <LegalListItem>
          Calcular o Bidu Score e detectar alertas de saúde proativos (sem diagnosticar).
        </LegalListItem>
        <LegalListItem>
          Gerar respostas do assistente IA — envio ao modelo OpenAI/Anthropic com contexto do pet
          (nome, espécie, idade) só pra resposta acertar. Mensagens são guardadas no banco.
        </LegalListItem>
        <LegalListItem>
          Entender uso agregado e melhorar o produto (analytics via eventos sem PII).
        </LegalListItem>
        <LegalListItem>Avisos importantes do app por email (transacionais, sem marketing).</LegalListItem>
      </LegalSection>

      <LegalSection title="Bases legais (LGPD)">
        <LegalListItem>
          <strong>Execução de contrato</strong>: dados de conta + pets + posts + saúde — sem eles,
          o app não funciona.
        </LegalListItem>
        <LegalListItem>
          <strong>Consentimento</strong>: push notifications, localização de encontro, sincronizar
          com sistemas externos (futuro: Apple Health, Google Fit).
        </LegalListItem>
        <LegalListItem>
          <strong>Legítimo interesse</strong>: telemetria mínima de bugs (sem PII) pra estabilidade.
        </LegalListItem>
      </LegalSection>

      <LegalSection title="Com quem compartilhamos">
        <LegalParagraph>
          Com ninguém pra fins comerciais. Prestadores de serviço técnicos com acesso restrito:
        </LegalParagraph>
        <LegalListItem>
          <strong>Supabase</strong> — banco de dados, autenticação, storage de fotos, edge
          functions. AWS infrastructure.
        </LegalListItem>
        <LegalListItem>
          <strong>Vercel</strong> — hospedagem do PWA web.
        </LegalListItem>
        <LegalListItem>
          <strong>Expo Push API</strong> — relay das notifications push pro Apple Push Notification
          Service / Firebase Cloud Messaging.
        </LegalListItem>
        <LegalListItem>
          <strong>OpenAI / Anthropic</strong> — assistente IA processa sua mensagem + contexto
          mínimo do pet pra responder. Não treinam modelos com seus dados (uso enterprise API).
        </LegalListItem>
        <LegalListItem>
          <strong>Stripe / MercadoPago</strong> — processadores de pagamento Pro (PCI-compliant).
        </LegalListItem>
        <LegalParagraph>
          Conteúdo público (perfis, posts, carteirinha via QR code) é visível a quem usa o app ou
          tem o link.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Seus direitos (LGPD Art. 18)">
        <LegalListItem>
          <strong>Acessar e editar</strong> seus dados a qualquer momento no app (Conta &gt; Editar
          perfil, Pet &gt; Editar).
        </LegalListItem>
        <LegalListItem>
          <strong>Portabilidade</strong>: botão "Exportar meus dados" em Conta baixa JSON completo
          (perfil, pets, posts, sintomas, vacinas, etc).
        </LegalListItem>
        <LegalListItem>
          <strong>Eliminação</strong>: botão "Excluir minha conta" apaga permanente — sem volta.
          Inclui registros de saúde, posts, comentários, mensagens. 24h pra propagação completa.
        </LegalListItem>
        <LegalListItem>
          <strong>Revogar consentimento</strong>: desativar push em Conta &gt; Notificações.
          Trocar idioma em Conta &gt; Idioma.
        </LegalListItem>
        <LegalListItem>
          Direito de reclamar à ANPD se entender que tratamos dados inadequadamente.
        </LegalListItem>
      </LegalSection>

      <LegalSection title="Retenção">
        <LegalParagraph>
          Dados ativos enquanto sua conta existir. Backups criptografados retidos por 30 dias após
          deleção pra fins de recuperação técnica + obrigação legal mínima.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Cookies e tracking">
        <LegalParagraph>
          Usamos apenas cookies de sessão (manter login) + localStorage pra preferências do app
          (idioma, dismiss de tour). Sem pixel de anúncio, sem tracker de marketing, sem
          fingerprinting.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Crianças">
        <LegalParagraph>
          O app é pra pessoas com 13 anos ou mais. Se descobrirmos conta de criança menor de 13,
          removemos imediatamente. Tutores legais podem solicitar deleção dos dados de menores
          escrevendo pra contato@petsocial.app.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Segurança">
        <LegalListItem>
          TLS 1.3 em todas as conexões. RLS (Row-Level Security) no banco — cada user só vê seus
          dados.
        </LegalListItem>
        <LegalListItem>Senhas hash bcrypt via Supabase Auth, nunca em texto claro.</LegalListItem>
        <LegalListItem>
          Notificamos vazamentos relevantes em até 72h conforme LGPD Art. 48.
        </LegalListItem>
      </LegalSection>

      <LegalSection title="Contato">
        <LegalParagraph>
          Dúvidas, pedidos ou reclamações sobre privacidade: contato@petsocial.app
        </LegalParagraph>
        <LegalParagraph>
          Encarregado de Dados (DPO): a ser nomeado quando atingirmos critérios LGPD Art. 41.
        </LegalParagraph>
      </LegalSection>
    </LegalPage>
  );
}
