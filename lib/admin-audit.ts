import { supabase } from './supabase';

/**
 * Registra uma ação destrutiva do admin na trilha admin_audit (via RPC gated por
 * is_admin). Fire-and-forget: nunca quebra o fluxo.
 */
export async function logAdminAction(
  action: string,
  entity: string,
  entityId: string | null,
  meta?: Record<string, unknown>,
): Promise<void> {
  await supabase
    .rpc('log_admin_action', {
      p_action: action,
      p_entity: entity,
      p_entity_id: entityId,
      p_meta: (meta ?? null) as Record<string, unknown> | null,
    })
    .then(
      () => {},
      () => {},
    );
}
