import { deleteByPublicUrl } from './storage';
import { supabase } from './supabase';

interface PetStorageRefs {
  public_urls: string[];
  doc_paths: string[];
}

/**
 * Remove (best-effort) TODOS os arquivos de storage de um pet ANTES de excluir
 * a linha — senão avatar, mídia de posts, fotos de saúde e os documentos
 * PRIVADOS de exames ficam órfãos no bucket (LGPD). Ver supabase/pet-storage-cleanup.sql.
 *
 * Best-effort de propósito: se qualquer remoção falhar, NÃO bloqueia a exclusão
 * do pet (melhor apagar o registro mesmo deixando algum arquivo do que travar).
 */
export async function cleanupPetStorage(petId: string): Promise<void> {
  try {
    const { data, error } = await supabase.rpc('pet_storage_refs', { p_pet_id: petId });
    if (error || !data) return;
    const refs = data as PetStorageRefs;
    const urls = Array.isArray(refs.public_urls) ? refs.public_urls : [];
    const docs = Array.isArray(refs.doc_paths) ? refs.doc_paths : [];

    // Públicos (avatars/posts/pet-symptoms) — bucket detectado pela própria URL.
    await Promise.allSettled(urls.map((u) => deleteByPublicUrl(u)));

    // Documentos no bucket PRIVADO pet-documents (exames/laudos).
    if (docs.length > 0) {
      await supabase.storage.from('pet-documents').remove(docs).then(undefined, () => undefined);
    }
  } catch {
    // nunca bloqueia a exclusão do pet
  }
}

// Todo arquivo do usuário vive sob a pasta `<userId>/` (ver uploadToBucket e
// uploadDocumentFile). Ao excluir a CONTA, dá pra varrer a pasta inteira.
const ACCOUNT_BUCKETS = ['avatars', 'posts', 'pet-symptoms', 'pet-documents'] as const;

/**
 * Remove (best-effort) TODOS os arquivos do usuário antes de excluir a conta.
 * Como tudo fica em `<userId>/`, varremos a pasta de cada bucket. Best-effort:
 * nunca bloqueia a exclusão da conta (o delete_my_account roda de qualquer jeito).
 */
export async function cleanupAccountStorage(userId: string): Promise<void> {
  for (const bucket of ACCOUNT_BUCKETS) {
    try {
      // Re-lista do início a cada passada (a remoção encolhe a pasta). Cap de
      // segurança pra nunca loopar infinito.
      for (let i = 0; i < 60; i++) {
        const { data, error } = await supabase.storage.from(bucket).list(userId, { limit: 100 });
        if (error || !data || data.length === 0) break;
        const paths = data.filter((f) => f.name).map((f) => `${userId}/${f.name}`);
        if (paths.length === 0) break;
        const { error: rmErr } = await supabase.storage.from(bucket).remove(paths);
        if (rmErr) break; // não conseguiu remover; para pra não loopar
        if (data.length < 100) break;
      }
    } catch {
      // best-effort — segue pros outros buckets
    }
  }
}
