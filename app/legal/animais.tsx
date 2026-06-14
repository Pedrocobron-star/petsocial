import type { ReactNode } from 'react';
import { Text } from 'react-native';

import { LegalListItem, LegalPage, LegalParagraph, LegalSection } from '@/components/legal-page';
import { FONTS } from '@/lib/fonts';

/**
 * Regras de Anúncios de Animais — base legal pros murais de Adoção e Achados.
 * Texto em PT-BR, linguagem clara. O ponto central: o Maestro Pet é só um
 * canal de DIVULGAÇÃO e não se responsabiliza pela troca/entrega do animal.
 */
export default function AnimalListingRulesScreen() {
  return (
    <LegalPage title="Regras de Anúncios de Animais">
      <LegalParagraph>
        Estas regras valem para quem publica um animal nos murais de Adoção e de Achados e Perdidos
        do Maestro Pet. Ao marcar “Li e concordo” e publicar, você declara que leu, entende e aceita
        tudo o que está aqui. Atualizado em junho de 2026.
      </LegalParagraph>

      <LegalSection title="1. O papel do Maestro Pet">
        <LegalParagraph>
          O Maestro Pet é uma plataforma de <LegalBold>divulgação</LegalBold>. Nós conectamos pessoas
          — não somos parte de nenhuma adoção, doação, resgate, devolução ou entrega de animal.
        </LegalParagraph>
        <LegalListItem>
          Não intermediamos a negociação, não acompanhamos visitas nem entregas e não fiscalizamos
          presencialmente os envolvidos.
        </LegalListItem>
        <LegalListItem>
          Não garantimos a veracidade das informações publicadas nem a idoneidade de quem anuncia ou
          de quem responde a um anúncio.
        </LegalListItem>
        <LegalListItem>
          Toda combinação, visita, transporte e entrega acontece diretamente entre as partes, por
          conta e risco delas.
        </LegalListItem>
      </LegalSection>

      <LegalSection title="2. Isenção de responsabilidade">
        <LegalParagraph>
          O Maestro Pet <LegalBold>não se responsabiliza</LegalBold>, em nenhuma hipótese, por:
        </LegalParagraph>
        <LegalListItem>
          a veracidade, exatidão ou atualidade das informações, fotos e contatos de cada anúncio;
        </LegalListItem>
        <LegalListItem>
          a conduta, a identidade ou as intenções de anunciantes e interessados;
        </LegalListItem>
        <LegalListItem>
          a saúde, o temperamento, o histórico, a procedência ou o destino do animal;
        </LegalListItem>
        <LegalListItem>
          golpes, fraudes, prejuízos, danos ou conflitos resultantes do contato entre as partes;
        </LegalListItem>
        <LegalListItem>
          acordos, pagamentos ou entregas feitos dentro ou fora da plataforma.
        </LegalListItem>
        <LegalParagraph>
          A responsabilidade por tudo o que for publicado e por toda a negociação é exclusiva de quem
          anuncia e de quem aceita o anúncio.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="3. É proibido (o anúncio pode ser removido sem aviso)">
        <LegalListItem>
          <LegalBold>Vender animais</LegalBold> ou cobrar qualquer valor como condição da adoção/doação.
          Os murais são para divulgação sem fins comerciais.
        </LegalListItem>
        <LegalListItem>
          Anunciar um animal sobre o qual você <LegalBold>não tem o direito ou a autorização</LegalBold>{' '}
          de dispor.
        </LegalListItem>
        <LegalListItem>
          Maus-tratos, abandono, descarte ou qualquer prática que viole a Lei de Crimes Ambientais
          (Lei nº 9.605/1998) e a legislação aplicável de proteção animal.
        </LegalListItem>
        <LegalListItem>
          Informações falsas, fotos que não sejam do animal anunciado, dados de terceiros sem
          consentimento, spam ou links suspeitos.
        </LegalListItem>
        <LegalListItem>
          Conteúdo ofensivo, discriminatório, enganoso ou ilegal de qualquer natureza.
        </LegalListItem>
      </LegalSection>

      <LegalSection title="4. Responsabilidades de quem anuncia">
        <LegalListItem>Fornecer informações verdadeiras, completas e atualizadas.</LegalListItem>
        <LegalListItem>Ter o direito de anunciar aquele animal.</LegalListItem>
        <LegalListItem>Tratar interessados com respeito e responder de boa-fé.</LegalListItem>
        <LegalListItem>
          Conduzir a adoção ou a devolução de forma responsável — converse, oriente sobre castração e
          vacinas e, quando possível, use um termo de adoção responsável.
        </LegalListItem>
      </LegalSection>

      <LegalSection title="5. Moderação e prazos">
        <LegalListItem>
          <LegalBold>Adoção:</LegalBold> todo anúncio passa por uma revisão e entra no ar em até{' '}
          <LegalBold>24 horas</LegalBold> após a aprovação. Essa checagem ajuda a coibir golpes e
          má-fé.
        </LegalListItem>
        <LegalListItem>
          <LegalBold>Achados e Perdidos:</LegalBold> por se tratar de urgência, os reportes vão ao ar
          imediatamente, mas podem ser revisados e removidos a qualquer momento.
        </LegalListItem>
        <LegalListItem>
          O Maestro Pet pode editar, ocultar ou remover qualquer anúncio que viole estas regras, sem
          aviso prévio, e suspender contas reincidentes.
        </LegalListItem>
      </LegalSection>

      <LegalSection title="6. Dicas de segurança">
        <LegalListItem>Prefira encontros e entregas em locais públicos e movimentados.</LegalListItem>
        <LegalListItem>
          Desconfie de quem cobra valores, “taxas” ou pede transferências antecipadas.
        </LegalListItem>
        <LegalListItem>Confira documentos e faça um termo de adoção sempre que possível.</LegalListItem>
        <LegalListItem>Nunca compartilhe dados sensíveis (senhas, códigos, dados bancários).</LegalListItem>
      </LegalSection>

      <LegalSection title="7. Denúncias">
        <LegalParagraph>
          Viu um anúncio suspeito, uma venda disfarçada ou indício de maus-tratos? Fale com a gente
          pelos canais de suporte do app. Avaliamos cada caso e removemos o que violar estas regras.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="8. Aceite">
        <LegalParagraph>
          Ao marcar “Li e concordo” e publicar um animal, você confirma que leu, entendeu e concorda
          com estas regras, e assume integral responsabilidade pelo conteúdo do anúncio e pela
          negociação com terceiros.
        </LegalParagraph>
      </LegalSection>
    </LegalPage>
  );
}

// Negrito INLINE (herda cor/tamanho do Text pai).
function LegalBold({ children }: { children: ReactNode }) {
  return <Text style={{ fontFamily: FONTS.bodyBold }}>{children}</Text>;
}
