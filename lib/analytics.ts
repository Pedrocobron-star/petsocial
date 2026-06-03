/**
 * Analytics — wrapper minimalista pra eventos do produto.
 *
 * Loga no console em dev + persiste em `analytics_events` no Supabase via RPC
 * `log_event` (SECURITY DEFINER, sem bloquear). Painel admin consome essa
 * tabela pra montar top events, drill-down por usuário, etc.
 *
 * Convenções:
 *  - Nome do evento em snake_case: `avatar_customize_intent`
 *  - Props com dados úteis pra segmentação: source, plan, pet_id, etc
 *  - Nunca passar PII (email, telefone). user.id é OK porque já é hash.
 */

import { Platform } from 'react-native';

import { supabase } from './supabase';

export interface AnalyticsProps {
  [key: string]: string | number | boolean | null | undefined;
}

const isDev =
  typeof __DEV__ !== 'undefined'
    ? __DEV__
    : (process.env.NODE_ENV ?? 'development') !== 'production';

/**
 * Dispara um evento de analytics. Não bloqueia (fire-and-forget).
 *
 * Comportamento:
 *  - Em dev: loga no console
 *  - Sempre: tenta gravar via RPC `log_event` em background (sem await)
 *  - Erros são silenciados — analytics nunca deve quebrar fluxo de UX
 */
export function track(event: string, props?: AnalyticsProps): void {
  // Sanitiza props pra não logar undefined nem armazenar lixo
  const cleaned: AnalyticsProps = {};
  if (props) {
    for (const k of Object.keys(props)) {
      const v = props[k];
      if (v !== undefined) cleaned[k] = v;
    }
  }

  if (isDev) {
    console.log(`[analytics] ${event}`, cleaned);
  }

  // Fire-and-forget — best effort, ignora qualquer erro
  void supabase
    .rpc('log_event', {
      p_event_name: event,
      p_props: cleaned as Record<string, unknown>,
      p_platform: Platform.OS,
    })
    .then(
      () => {},
      () => {},
    );
}

// ============================================================================
// Eventos com tipagem forte — descobríveis no autocomplete e evita typos
// ============================================================================

/** Free user clicou em "Customizar" — sinal de intent de upgrade. */
export function trackAvatarCustomizeIntent(props: {
  pet_id?: string;
  /** Resultado: trial-started, upgrade-modal, already-pro, trial-active */
  outcome: 'trial-started' | 'upgrade-modal' | 'already-pro' | 'trial-active';
}) {
  track('avatar_customize_intent', props);
}

/** Trial 7 dias iniciado. */
export function trackTrialStarted(props: { feature: 'avatar' }) {
  track('trial_started', props);
}

/** User salvou avatar customizado. */
export function trackAvatarSaved(props: {
  pet_id?: string;
  /** Source: preset / customize */
  source: 'preset' | 'customize';
  /** True se ativou heterocromia, charm, scene background — features Pro. */
  used_pro_features: boolean;
}) {
  track('avatar_saved', props);
}

/** User compartilhou avatar (PNG export). */
export function trackAvatarShared(props: { pet_id?: string }) {
  track('avatar_shared', props);
}

/** User compartilhou um lost report (cartaz PNG). */
export function trackLostReportShared(props: {
  report_id: string;
  kind: 'lost' | 'found';
  /** Days since report.created_at */
  days_searching: number;
  /** True se share API foi usada, false se caiu pra download */
  shared_via_intent: boolean;
}) {
  track('lost_report_shared', props);
}
