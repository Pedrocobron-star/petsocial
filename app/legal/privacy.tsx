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
        Última atualização: 17 de junho de 2026. Aqui está como a gente trata seus dados.
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
          Tira-dúvidas de Saúde — suas perguntas são processadas localmente no app pra mostrar a
          resposta do guia. Não coletamos nem armazenamos essas perguntas nos nossos servidores.
        </LegalListItem>
        <LegalListItem>
          Push token do device (Expo Push), guardado pra enviar lembretes de saúde — removido
          automaticamente no logout.
        </LegalListItem>
        <LegalListItem>
          Snapshot mensal do Score de Saúde (score numérico + componentes) pra mostrar evolução.
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
          Dados bancários — pagamentos Pro são processados pela Cakto (Pix ou cartão), nunca passam
          pelos nossos servidores. Não armazenamos número de cartão.
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
          Calcular o Score de Saúde e detectar alertas de saúde proativos (sem diagnosticar).
        </LegalListItem>
        <LegalListItem>
          Mostrar respostas do Tira-dúvidas de Saúde — um guia de referência que roda localmente no
          app, sem envio das suas perguntas a serviços de IA de terceiros.
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
          <strong>Cakto</strong> (Cakto Tecnologia e Pagamentos) — intermediadora de pagamento do
          Pet Pro (Pix e cartão de crédito, PCI-compliant). Recebe apenas os dados necessários pra
          processar a compra.
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
          <strong>Portabilidade</strong>: botão &quot;Exportar meus dados&quot; em Conta baixa JSON completo
          (perfil, pets, posts, sintomas, vacinas, etc).
        </LegalListItem>
        <LegalListItem>
          <strong>Eliminação</strong>: botão &quot;Excluir minha conta&quot; apaga permanente — sem volta.
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
          escrevendo pra maestropetcontato@gmail.com.
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
          Dúvidas, pedidos ou reclamações sobre privacidade: maestropetcontato@gmail.com
        </LegalParagraph>
        <LegalParagraph>
          Encarregado de Dados (DPO): Pedro Amaral. Fale pelo e-mail maestropetcontato@gmail.com.
        </LegalParagraph>
      </LegalSection>
    </LegalPage>
  );
}
