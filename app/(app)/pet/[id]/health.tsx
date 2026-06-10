import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { AreaHero } from '@/components/area-hero';
import { HealthListSkeleton } from '@/components/health/health-list-skeleton';
import { HealthScoreCard } from '@/components/health/health-score-card';
import { HealthRecordPdfButton } from '@/components/health/health-record-pdf-button';
import { HealthScoreTrend } from '@/components/health/health-score-trend';
import { HealthShareButton } from '@/components/health/health-share-button';
import { HealthTimeline } from '@/components/health/health-timeline';
import { PaywallCard } from '@/components/paywall-card';
import { AI_ASSISTANT_ENABLED } from '@/lib/constants';
import { FONTS } from '@/lib/fonts';
import { monthlyDietCost } from '@/lib/diet-brands';
import {
  computeHealthAlerts,
  type HealthAlert,
} from '@/lib/health-alerts';
import { computeHealthScore } from '@/lib/health-score';
import {
  fetchActiveDiet,
  fetchHealthSnapshots,
  fetchHealthSummary,
  fetchHealthTimeline,
  fetchParasiteSummary,
  fetchPet,
  fetchPetSymptoms,
  qk,
  type ParasiteSummary,
} from '@/lib/queries';
import type { PetSymptom } from '@/lib/types';
import { AppThemeProvider } from '@/providers/app-theme-provider';
import { useIsPro } from '@/providers/subscription-provider';
import { useTheme } from '@/providers/theme-provider';

export default function HealthHubScreen() {
  return (
    <AppThemeProvider app="health">
      <HealthHubInner />
    </AppThemeProvider>
  );
}

function HealthHubInner() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();

  const petQuery = useQuery({ queryKey: qk.pet(id), queryFn: () => fetchPet(id), enabled: !!id });
  const summaryQuery = useQuery({
    queryKey: qk.healthSummary(id),
    queryFn: () => fetchHealthSummary(id),
    enabled: !!id,
  });
  const parasiteSummaryQuery = useQuery({
    queryKey: qk.parasiteSummary(id),
    queryFn: () => fetchParasiteSummary(id),
    enabled: !!id,
  });
  const timelineQuery = useQuery({
    queryKey: qk.healthTimeline(id),
    queryFn: () => fetchHealthTimeline(id, 12),
    enabled: !!id,
  });
  const activeSymptomsQuery = useQuery({
    queryKey: qk.petSymptoms(id, 'active'),
    queryFn: () => fetchPetSymptoms(id, 'active'),
    enabled: !!id,
  });
  const snapshotsQuery = useQuery({
    queryKey: qk.healthSnapshots(id),
    queryFn: () => fetchHealthSnapshots(id, 12),
    enabled: !!id,
  });
  const activeDietQuery = useQuery({
    queryKey: qk.petDietActive(id),
    queryFn: () => fetchActiveDiet(id),
    enabled: !!id,
  });

  const pet = petQuery.data;
  const summary = summaryQuery.data;
  const parasiteSummary = parasiteSummaryQuery.data;
  const timeline = timelineQuery.data ?? [];
  const activeSymptoms = activeSymptomsQuery.data ?? [];
  const snapshots = snapshotsQuery.data ?? [];
  const computedScore = summary ? computeHealthScore(summary, parasiteSummary) : null;
  // Cadastro de saúde incompleto: nenhuma das 3 dimensões essenciais
  // (vacina, vermífugo, consulta) tem registro. Aí não faz sentido mostrar
  // "evolução" — não há histórico real pra acompanhar ainda.
  const healthIncomplete =
    computedScore != null &&
    computedScore.components.filter(
      (c) =>
        (c.key === 'vaccines' || c.key === 'parasites' || c.key === 'vet_visits') &&
        c.status !== 'na',
    ).length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: pet ? `Saúde — ${pet.name}` : 'Saúde' }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 110 }}>
        <AreaHero area="health" />

        {!summary || !pet ? (
          <HealthListSkeleton withHeader count={2} />
        ) : null}

        {summary && pet ? (
          <HealthScoreCard
            petName={pet.name}
            summary={summary}
            parasiteSummary={parasiteSummary}
          />
        ) : null}

        {pet && computedScore && !healthIncomplete ? (
          <HealthScoreTrend
            petId={id}
            currentScore={computedScore.score}
            currentComponents={{ components: computedScore.components }}
            snapshots={snapshots}
          />
        ) : null}

        {pet && summary ? (
          <AlertsPreview
            petId={id}
            alerts={computeHealthAlerts({
              pet,
              summary,
              symptoms: activeSymptoms,
              // parasiteSummary não bate o tipo de ParasiteTreatment[],
              // alertas detalhados de parasitas aparecem na tela dedicada
            })}
            parasiteSummary={parasiteSummary}
          />
        ) : null}

        <SectionTitle title="Atalhos" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <ShortcutCard
            href={`/pet/${id}/vaccinations`}
            emoji="💉"
            label="Vacinas"
            sublabel={summary?.next_vaccine ? `Próxima: ${summary.next_vaccine.name}` : 'Carteira de vacinação'}
            tint="#FED7AA"
            textTint="#9A3412"
          />
          <ShortcutCard
            href={`/pet/${id}/parasites`}
            emoji="💊"
            label="Vermífugo & Pulga"
            sublabel={parasiteSubtitle(parasiteSummary)}
            tint="#DCFCE7"
            textTint="#166534"
          />
          <ShortcutCard
            href={`/pet/${id}/medications`}
            emoji="🧪"
            label="Remédios"
            sublabel={
              summary
                ? `${summary.active_medications_count} ativo${summary.active_medications_count === 1 ? '' : 's'}${summary.due_medications_today > 0 ? ` • ${summary.due_medications_today} hoje` : ''}`
                : 'Lembretes diários'
            }
            tint="#DBEAFE"
            textTint="#1E40AF"
          />
          <ShortcutCard
            href={`/pet/${id}/symptoms`}
            emoji="📝"
            label="Sintomas"
            sublabel={symptomsSubtitle(activeSymptoms)}
            tint="#FEF3C7"
            textTint="#92400E"
          />
          <ShortcutCard
            href={`/pet/${id}/vet-visits`}
            emoji="🩺"
            label="Consultas"
            sublabel={
              summary?.last_vet_visit
                ? `Última: ${format(parseISO(summary.last_vet_visit.visited_at), 'd MMM', { locale: ptBR })}`
                : 'Timeline com vet'
            }
            tint="#DCFCE7"
            textTint="#166534"
          />
          <ShortcutCard
            href={`/pet/${id}/weight`}
            emoji="⚖️"
            label="Peso"
            sublabel={
              summary?.latest_weight
                ? `${summary.latest_weight.weight_kg} kg`
                : 'Gráfico ao longo do tempo'
            }
            tint="#FCE7F3"
            textTint="#9D174D"
          />
          <ShortcutCard
            href={`/pet/${id}/documents`}
            emoji="📂"
            label="Exames & Laudos"
            sublabel="Guarde exames, receitas e laudos"
            tint="#EDE9FE"
            textTint="#5B21B6"
          />
          <ShortcutCard
            href={`/pet/${id}/recap`}
            emoji="📅"
            label="Resumo do mês"
            sublabel="A saúde do mês em números"
            tint="#FEF3C7"
            textTint="#92400E"
          />
          <ShortcutCard
            href={`/pet/${id}/expenses`}
            emoji="💰"
            label="Gastos"
            sublabel="Quanto seu pet custa por mês"
            tint="#DCFCE7"
            textTint="#166534"
          />
          <ShortcutCard
            href={`/pet/${id}/diet`}
            emoji="🥣"
            label="Dieta"
            sublabel={dietSubtitle(activeDietQuery.data)}
            tint="#FFF7ED"
            textTint="#9A3412"
          />
          {AI_ASSISTANT_ENABLED ? (
            <ShortcutCard
              href={`/pet/${id}/ai-assistant`}
              emoji="🤖"
              label="Assistente IA"
              sublabel="Dúvidas sobre saúde, vacinas e mais"
              tint="#1A1410"
              textTint="#FCD34D"
            />
          ) : null}
          <ShortcutCard
            href={`/places?kind=vet`}
            emoji="🩺"
            label="Encontrar vet"
            sublabel="Veterinários perto de você"
            tint="#DBEAFE"
            textTint="#1E40AF"
          />
          <ShortcutCard
            href={`/pet/${id}/health-calendar`}
            emoji="📆"
            label="Calendário"
            sublabel="Vista mensal de tudo"
            tint="#E0F2FE"
            textTint="#0C4A6E"
          />
          <ShortcutCard
            href={`/pet/${id}/time-capsule`}
            emoji="📼"
            label="Retrospectiva"
            sublabel="Um ano com seu pet em números"
            tint="#FEF3C7"
            textTint="#92400E"
          />
        </View>

        {summary?.next_vet_visit ? (
          <>
            <SectionTitle title="Próxima consulta agendada" />
            <View style={{ backgroundColor: theme.surface, borderRadius: 14, padding: 14, gap: 4 }}>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.text }}>
                {format(parseISO(summary.next_vet_visit.next_visit_at!), "d 'de' MMMM", { locale: ptBR })}
              </Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: theme.textDim }}>
                {summary.next_vet_visit.clinic_name ?? summary.next_vet_visit.vet_name ?? 'Veterinário'}
              </Text>
            </View>
          </>
        ) : null}

        <SectionTitle title="Histórico recente" />
        <HealthTimeline events={timeline} limit={8} />

        {/* Compartilhar prontuário com vet */}
        {summary && pet ? (
          <View style={{ marginTop: 8, gap: 10 }}>
            <HealthShareButton pet={pet} summary={summary} parasiteSummary={parasiteSummary} />
            <HealthRecordPdfButton pet={pet} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  const { theme } = useTheme();
  return (
    <Text
      style={{
        fontFamily: FONTS.bodyBold,
        fontSize: 11,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        color: theme.accent.color,
        marginTop: 8,
        marginBottom: 4,
      }}
    >
      {title}
    </Text>
  );
}

function dietSubtitle(diet: Awaited<ReturnType<typeof fetchActiveDiet>> | undefined): string {
  if (!diet) return 'Anote a ração';
  const cost = monthlyDietCost({
    daily_amount_g: diet.daily_amount_g,
    package_size_g: diet.package_size_g,
    package_cost_brl: diet.package_cost_brl,
  });
  if (cost != null) return `${diet.brand} · R$ ${cost.toFixed(0)}/mês`;
  return diet.brand;
}

function symptomsSubtitle(active: PetSymptom[]): string {
  if (active.length === 0) return 'Anote pro vet';
  const flagged = active.filter((s) => s.flagged_for_vet).length;
  const severe = active.filter((s) => s.severity >= 4).length;
  if (severe > 0) {
    return `⚠️ ${severe} grave${severe > 1 ? 's' : ''} ativo${severe > 1 ? 's' : ''}`;
  }
  if (flagged > 0) {
    return `🩺 ${flagged} pra vet`;
  }
  return `${active.length} ativo${active.length > 1 ? 's' : ''}`;
}

function parasiteSubtitle(summary: ParasiteSummary | undefined): string {
  if (!summary || summary.total === 0) return 'Bravecto, NexGard, Drontal...';
  if (summary.overdue > 0) {
    return `⚠️ ${summary.overdue} atrasado${summary.overdue > 1 ? 's' : ''}`;
  }
  if (summary.next_due && summary.next_due.days_until <= 7) {
    const d = summary.next_due.days_until;
    if (d === 0) return `${summary.next_due.product_name} hoje!`;
    return `${summary.next_due.product_name} em ${d}d`;
  }
  if (summary.next_due) {
    return `Próximo: ${summary.next_due.product_name}`;
  }
  return `${summary.total} ${summary.total === 1 ? 'registro' : 'registros'}`;
}

function AlertsPreview({
  petId,
  alerts,
  parasiteSummary,
}: {
  petId: string;
  alerts: HealthAlert[];
  parasiteSummary: ParasiteSummary | undefined;
}) {
  const { theme } = useTheme();
  const isPro = useIsPro();
  // Adiciona alertas de parasitas inline (parasiteSummary tem dados resumidos
  // que o computeHealthAlerts não recebe nessa preview pra evitar query extra)
  const parasiteAlerts: HealthAlert[] = [];
  if (parasiteSummary?.next_due) {
    const d = parasiteSummary.next_due.days_until;
    const productName = parasiteSummary.next_due.product_name;
    if (d < 0) {
      parasiteAlerts.push({
        id: 'parasite-summary-overdue',
        severity: 'urgent',
        category: 'parasite',
        emoji: '🦟',
        title: `${productName} atrasado ${Math.abs(d)}d`,
        description: 'Toque pra reaplicar.',
        action: { label: 'Ver parasitas', href: `/pet/${petId}/parasites` },
        daysUntil: d,
      });
    } else if (d <= 7) {
      parasiteAlerts.push({
        id: 'parasite-summary-soon',
        severity: 'warning',
        category: 'parasite',
        emoji: '💊',
        title: d === 0 ? `${productName} vence hoje` : `${productName} em ${d}d`,
        description: 'Programe a reaplicação.',
        action: { label: 'Ver parasitas', href: `/pet/${petId}/parasites` },
        daysUntil: d,
      });
    }
  }

  // Combina e mostra só os 3 mais urgentes na preview
  const combined = [...alerts, ...parasiteAlerts].sort((a, b) => {
    const order = { urgent: 0, warning: 1, info: 2 } as const;
    if (order[a.severity] !== order[b.severity]) {
      return order[a.severity] - order[b.severity];
    }
    return (a.daysUntil ?? Infinity) - (b.daysUntil ?? Infinity);
  });

  if (combined.length === 0) return null;

  // Alertas preventivos (info) = coaching do Pet Pro. Urgentes/atenção sempre livres.
  const rendered = isPro ? combined : combined.filter((a) => a.severity !== 'info');
  const lockedInfo = combined.length - rendered.length;
  const preview = rendered.slice(0, 3);
  const hasMore = combined.length > preview.length;

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <SectionTitle title={`Lembretes (${combined.length})`} />
        <Link href={`/pet/${petId}/health-alerts` as never} asChild>
          <Pressable hitSlop={6}>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: theme.accent.color, marginTop: 8 }}>
              Ver todos →
            </Text>
          </Pressable>
        </Link>
      </View>
      {preview.map((a) => (
        <AlertRow key={a.id} alert={a} />
      ))}
      {preview.length === 0 && lockedInfo > 0 ? (
        <PaywallCard
          intent="health-coach"
          emoji="🩺"
          title="Coach de prevenção no Pet Pro"
          description={`${lockedInfo} dica${lockedInfo === 1 ? '' : 's'} de prevenção esperando (check-up, pesagem, fase da vida). Urgências e atenções você sempre vê de graça.`}
          compact
        />
      ) : null}
      {hasMore ? (
        <Link href={`/pet/${petId}/health-alerts` as never} asChild>
          <Pressable
            style={{
              padding: 10,
              borderRadius: 10,
              backgroundColor: '#F1F5F9',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#475569' }}>
              + {combined.length - preview.length}{' '}
              {combined.length - preview.length === 1 ? 'alerta' : 'alertas'}
            </Text>
          </Pressable>
        </Link>
      ) : null}
    </View>
  );
}

function AlertRow({ alert }: { alert: HealthAlert }) {
  const colors = {
    urgent: { bg: '#FEE2E2', title: '#991B1B', sub: '#7F1D1D' },
    warning: { bg: '#FEF3C7', title: '#92400E', sub: '#78350F' },
    info: { bg: '#DBEAFE', title: '#1E40AF', sub: '#1E3A8A' },
  }[alert.severity];

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 12,
        backgroundColor: colors.bg,
        borderRadius: 14,
        padding: 14,
        alignItems: 'center',
      }}
    >
      <Text style={{ fontSize: 22 }}>{alert.emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: colors.title }}>
          {alert.title}
        </Text>
        <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: colors.sub, marginTop: 2 }}>
          {alert.description}
        </Text>
      </View>
    </View>
  );
}

function ShortcutCard({
  href,
  emoji,
  label,
  sublabel,
  tint,
  textTint,
}: {
  href: string;
  emoji: string;
  label: string;
  sublabel: string;
  tint: string;
  textTint: string;
}) {
  return (
    <Link href={href as never} asChild>
      <Pressable
        style={{
          flex: 1,
          minWidth: '47%',
          backgroundColor: tint,
          borderRadius: 16,
          padding: 14,
          gap: 6,
        }}
      >
        <Text style={{ fontSize: 28 }}>{emoji}</Text>
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: textTint }}>{label}</Text>
        <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: textTint, opacity: 0.85 }} numberOfLines={1}>
          {sublabel}
        </Text>
        <Ionicons
          name="chevron-forward"
          size={16}
          color={textTint}
          style={{ position: 'absolute', right: 12, top: 14, opacity: 0.5 }}
        />
      </Pressable>
    </Link>
  );
}
