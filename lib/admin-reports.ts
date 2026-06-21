/**
 * Moderação admin — fila de denúncias (tabela `reports`) + ações destrutivas.
 * Backend: supabase/admin-moderation.sql (RPCs gated por is_admin + audit).
 */
import type { ReportTargetKind } from './types';
import { supabase } from './supabase';

// Fonte única do tipo em lib/types.ts (re-exportado aqui pra compat de imports).
export type { ReportTargetKind };
export type ReportStatus = 'open' | 'reviewed' | 'dismissed' | 'actioned';

export interface AdminReport {
  id: string;
  target_kind: ReportTargetKind;
  target_id: string;
  reason: string;
  notes: string | null;
  status: ReportStatus;
  created_at: string;
  reporter_email: string | null;
  reporter_name: string | null;
  target_reports_count: number;
}

export const qkAdminReports = (status: string) => ['admin-reports', status] as const;

export async function fetchAdminReports(status: ReportStatus | 'all' = 'open'): Promise<AdminReport[]> {
  const { data, error } = await supabase.rpc('admin_list_reports', {
    p_status: status === 'all' ? null : status,
    p_limit: 200,
  });
  if (error) throw error;
  return (data ?? []) as AdminReport[];
}

export async function adminResolveReport(id: string, status: ReportStatus): Promise<void> {
  const { error } = await supabase.rpc('admin_resolve_report', { p_id: id, p_status: status });
  if (error) throw error;
}

export async function adminDeletePost(postId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_post', { p_post_id: postId });
  if (error) throw error;
}

export async function adminDeleteComment(commentId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_comment', { p_comment_id: commentId });
  if (error) throw error;
}

/** Remove uma DM denunciada (abusiva). Resolve a denúncia + audita. */
export async function adminDeleteMessage(messageId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_message', { p_message_id: messageId });
  if (error) throw error;
}

/** Remove um reporte de Achados/Perdidos abusivo. Retorna URLs pra limpar o bucket. */
export async function adminDeleteLostReport(reportId: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('admin_delete_lost_report', { p_id: reportId });
  if (error) throw error;
  return (data ?? []) as string[];
}

export async function adminBanUser(userId: string, ban: boolean, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('admin_ban_user', {
    p_user_id: userId,
    p_ban: ban,
    p_reason: reason ?? null,
  });
  if (error) throw error;
}

// Rótulos legíveis pros motivos de denúncia.
export const REPORT_REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Assédio',
  inappropriate: 'Conteúdo impróprio',
  animal_abuse: 'Maus-tratos a animal',
  impersonation: 'Falsidade ideológica',
  misinformation: 'Desinformação',
  other: 'Outro',
};

export const REPORT_KIND_LABELS: Record<ReportTargetKind, string> = {
  post: 'Post',
  comment: 'Comentário',
  user: 'Usuário',
  pet: 'Pet',
  message: 'Mensagem',
  lost_report: 'Achado/Perdido',
  adoption_listing: 'Adoção',
};
