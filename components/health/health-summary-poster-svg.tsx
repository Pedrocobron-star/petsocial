import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { View, type ViewStyle } from 'react-native';
import Svg, {
  ClipPath,
  Defs,
  Image as SvgImage,
  Line,
  Rect,
  Text as SvgText,
} from 'react-native-svg';

import { petAgeText } from '@/lib/pet-age';
import type { ParasiteSummary } from '@/lib/queries';
import type { HealthSummary, Pet } from '@/lib/types';

interface Props {
  pet: Pet;
  summary: HealthSummary;
  parasiteSummary: ParasiteSummary | undefined;
  size?: number;
  style?: ViewStyle;
}

/**
 * Cartaz "prontuário" do pet pra compartilhar com veterinário.
 * Layout 800x1100 portrait — info-dense mas legível, sem PII sensível.
 *
 * Inclui: identificação básica, resumo de saúde, próximos eventos.
 * Não inclui contato do tutor (vet já tem) nem histórico completo (use PDF futuro).
 */
export function HealthSummaryPosterSvg({
  pet,
  summary,
  parasiteSummary,
  size = 400,
  style,
}: Props) {
  const W = 800;
  const H = 1100;
  const age = petAgeText(pet.birthdate);
  const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

  // Status helpers
  const vaccinesStatus = (() => {
    if (!summary.next_vaccine) return { label: 'Sem registro', color: '#737373' };
    const d = summary.next_vaccine.days_until;
    if (d <= 0) return { label: `Vencida (${summary.next_vaccine.name})`, color: '#DC2626' };
    if (d <= 7) return { label: `Próxima em ${d}d`, color: '#F59E0B' };
    return { label: `Em dia · Próxima em ${d}d`, color: '#16A34A' };
  })();

  const parasitesStatus = (() => {
    if (!parasiteSummary || parasiteSummary.total === 0)
      return { label: 'Sem registro', color: '#737373' };
    if (parasiteSummary.overdue > 0)
      return { label: `${parasiteSummary.overdue} atrasado(s)`, color: '#DC2626' };
    if (parasiteSummary.next_due && parasiteSummary.next_due.days_until <= 7)
      return { label: `Próximo em ${parasiteSummary.next_due.days_until}d`, color: '#F59E0B' };
    return { label: 'Em dia', color: '#16A34A' };
  })();

  return (
    <View style={[{ width: size, aspectRatio: W / H }, style]}>
      <Svg width={size} height={size * (H / W)} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <ClipPath id="poster-photo">
            <Rect x="60" y="200" width="180" height="180" rx="90" />
          </ClipPath>
        </Defs>

        {/* Fundo */}
        <Rect x="0" y="0" width={W} height={H} fill="#FFFFFF" />

        {/* Header colorido */}
        <Rect x="0" y="0" width={W} height="140" fill="#1E40AF" />
        <SvgText x="60" y="62" fontSize="22" fill="#FFFFFF" opacity="0.85">
          PRONTUÁRIO RESUMIDO
        </SvgText>
        <SvgText x="60" y="110" fontSize="48" fontWeight="900" fill="#FFFFFF">
          {trunc(pet.name, 22)}
        </SvgText>

        {/* Avatar / foto */}
        <Rect x="60" y="200" width="180" height="180" rx="90" fill="#DBEAFE" />
        {pet.avatar_url ? (
          <SvgImage
            x="60"
            y="200"
            width="180"
            height="180"
            href={pet.avatar_url}
            preserveAspectRatio="xMidYMid slice"
            clipPath="url(#poster-photo)"
          />
        ) : (
          <SvgText x="150" y="320" fontSize="100" textAnchor="middle">
            🐾
          </SvgText>
        )}

        {/* Identificação */}
        <SvgText x="280" y="230" fontSize="20" fill="#737373">
          Espécie · raça
        </SvgText>
        <SvgText x="280" y="262" fontSize="26" fontWeight="bold" fill="#1A1410">
          {trunc(`${pet.species ?? 'Pet'}${pet.breed ? ' · ' + pet.breed : ''}`, 38)}
        </SvgText>

        {age ? (
          <>
            <SvgText x="280" y="310" fontSize="20" fill="#737373">
              Idade
            </SvgText>
            <SvgText x="280" y="342" fontSize="26" fontWeight="bold" fill="#1A1410">
              {trunc(age, 30)}
            </SvgText>
          </>
        ) : null}

        {summary.latest_weight ? (
          <>
            <SvgText x="280" y="380" fontSize="14" fill="#737373">
              Peso atual:{' '}
              <SvgText fontSize="14" fontWeight="bold" fill="#1A1410">
                {summary.latest_weight.weight_kg} kg
              </SvgText>{' '}
              ({format(parseISO(summary.latest_weight.weighed_at), 'd MMM yyyy', { locale: ptBR })})
            </SvgText>
          </>
        ) : null}

        {/* Divisor */}
        <Line x1="60" y1="430" x2={W - 60} y2="430" stroke="#E5E5E5" strokeWidth="2" />

        {/* Seção status */}
        <SvgText x="60" y="475" fontSize="14" fill="#737373" letterSpacing="1.5">
          STATUS DE SAÚDE
        </SvgText>

        {/* Vacinas */}
        <Rect x="60" y="495" width={W - 120} height="80" rx="12" fill="#F9FAFB" />
        <SvgText x="80" y="525" fontSize="22" fontWeight="bold" fill="#1A1410">
          💉 Vacinas
        </SvgText>
        <SvgText
          x="80"
          y="555"
          fontSize="18"
          fill={vaccinesStatus.color}
          fontWeight="bold"
        >
          {trunc(vaccinesStatus.label, 60)}
        </SvgText>

        {/* Parasitas */}
        <Rect x="60" y="590" width={W - 120} height="80" rx="12" fill="#F9FAFB" />
        <SvgText x="80" y="620" fontSize="22" fontWeight="bold" fill="#1A1410">
          💊 Antiparasitário
        </SvgText>
        <SvgText
          x="80"
          y="650"
          fontSize="18"
          fill={parasitesStatus.color}
          fontWeight="bold"
        >
          {trunc(parasitesStatus.label, 60)}
        </SvgText>

        {/* Medicações ativas */}
        <Rect x="60" y="685" width={W - 120} height="80" rx="12" fill="#F9FAFB" />
        <SvgText x="80" y="715" fontSize="22" fontWeight="bold" fill="#1A1410">
          🧪 Medicações ativas
        </SvgText>
        <SvgText x="80" y="745" fontSize="18" fill="#1A1410">
          {summary.active_medications_count > 0
            ? `${summary.active_medications_count} medicação(ões) em uso`
            : 'Nenhuma'}
        </SvgText>

        {/* Última consulta */}
        <Rect x="60" y="780" width={W - 120} height="80" rx="12" fill="#F9FAFB" />
        <SvgText x="80" y="810" fontSize="22" fontWeight="bold" fill="#1A1410">
          🩺 Última consulta
        </SvgText>
        <SvgText x="80" y="840" fontSize="18" fill="#1A1410">
          {summary.last_vet_visit
            ? `${format(parseISO(summary.last_vet_visit.visited_at), "d 'de' MMM 'de' yyyy", { locale: ptBR })} — ${trunc(summary.last_vet_visit.reason, 30)}`
            : 'Sem registro'}
        </SvgText>

        {/* Próxima consulta agendada */}
        {summary.next_vet_visit?.next_visit_at ? (
          <>
            <Rect x="60" y="880" width={W - 120} height="80" rx="12" fill="#DBEAFE" />
            <SvgText x="80" y="910" fontSize="22" fontWeight="bold" fill="#1E40AF">
              📅 Próxima consulta
            </SvgText>
            <SvgText x="80" y="940" fontSize="18" fontWeight="bold" fill="#1E3A8A">
              {format(parseISO(summary.next_vet_visit.next_visit_at), "d 'de' MMM 'de' yyyy", {
                locale: ptBR,
              })}
            </SvgText>
          </>
        ) : null}

        {/* Footer */}
        <Line x1="60" y1="1010" x2={W - 60} y2="1010" stroke="#E5E5E5" strokeWidth="2" />
        <SvgText x={W / 2} y="1045" fontSize="16" fill="#737373" textAnchor="middle">
          Gerado em {format(new Date(), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
        </SvgText>
        <SvgText x={W / 2} y="1075" fontSize="14" fill="#A3A3A3" textAnchor="middle">
          Maestro Pet · Resumo de saúde do pet
        </SvgText>
      </Svg>
    </View>
  );
}
