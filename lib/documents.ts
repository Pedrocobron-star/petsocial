/**
 * Carteira de exames & laudos — documentos de saúde do pet.
 *
 * O tutor guarda exames, laudos, receitas, atestados e scans da carteirinha de
 * vacinação. Arquivos ficam num bucket PRIVADO (pet-documents); guardamos só o
 * caminho e geramos signed URLs de curta duração pra visualizar (LGPD).
 *
 * Sem nenhum ato médico — é só guarda e organização do que pertence ao tutor.
 */

import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { supabase } from './supabase';

// ============================================================================
// Tipos
// ============================================================================

export type DocumentKind = 'exame' | 'laudo' | 'receita' | 'atestado' | 'vacina' | 'outro';

export interface PetDocument {
  id: string;
  created_at: string;
  pet_id: string;
  owner_id: string;
  kind: DocumentKind;
  title: string;
  notes: string | null;
  file_path: string;
  file_type: 'pdf' | 'image';
  file_name: string | null;
  doc_date: string | null;
}

export interface PickedFile {
  uri: string;
  name: string;
  ext: string;
  fileType: 'pdf' | 'image';
  contentType: string;
}

export const DOCUMENT_KINDS: { key: DocumentKind; label: string; emoji: string }[] = [
  { key: 'exame', label: 'Exame', emoji: '🧪' },
  { key: 'laudo', label: 'Laudo', emoji: '📋' },
  { key: 'receita', label: 'Receita', emoji: '💊' },
  { key: 'atestado', label: 'Atestado', emoji: '📄' },
  { key: 'vacina', label: 'Carteira de vacina', emoji: '💉' },
  { key: 'outro', label: 'Outro', emoji: '📎' },
];

export function documentKindMeta(kind: DocumentKind) {
  return DOCUMENT_KINDS.find((k) => k.key === kind) ?? DOCUMENT_KINDS[5];
}

/** Limite do plano gratuito por pet (Pro = ilimitado). */
export const FREE_DOCS_PER_PET = 15;

// ============================================================================
// File picker (web: input file aceita imagem+pdf; native: ImagePicker imagens)
// ============================================================================

export async function pickDocumentFile(): Promise<PickedFile | null> {
  if (Platform.OS === 'web') {
    return new Promise<PickedFile | null>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,application/pdf';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        const isPdf =
          file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const ext = isPdf ? 'pdf' : (file.name.split('.').pop() || 'jpg').toLowerCase();
        resolve({
          uri: URL.createObjectURL(file),
          name: file.name,
          ext,
          fileType: isPdf ? 'pdf' : 'image',
          contentType: file.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
        });
      };
      // Se o usuário cancelar, onchange não dispara — resolvemos null no foco de volta
      input.oncancel = () => resolve(null);
      input.click();
    });
  }

  // Native: imagens (foto do exame/carteirinha de papel)
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const ext = (asset.uri.split('.').pop() || 'jpg').toLowerCase();
  return {
    uri: asset.uri,
    name: asset.fileName || `documento.${ext}`,
    ext,
    fileType: 'image',
    contentType: asset.mimeType || 'image/jpeg',
  };
}

// ============================================================================
// Upload / signed URL
// ============================================================================

function decodeBase64(b64: string): ArrayBuffer {
  const binary = globalThis.atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** Sobe o arquivo pro bucket privado e devolve o file_path. */
export async function uploadDocumentFile(userId: string, file: PickedFile): Promise<string> {
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${file.ext}`;

  let body: ArrayBuffer | Blob;
  if (Platform.OS === 'web') {
    const res = await fetch(file.uri);
    body = await res.blob();
  } else {
    const f = new File(file.uri);
    const base64 = await f.base64();
    body = decodeBase64(base64);
  }

  const { error } = await supabase.storage.from('pet-documents').upload(path, body, {
    contentType: file.contentType,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

/** Gera uma signed URL (1h) pra visualizar um documento. */
export async function getDocumentUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('pet-documents')
    .createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

// ============================================================================
// CRUD
// ============================================================================

export async function fetchPetDocuments(petId: string): Promise<PetDocument[]> {
  const { data, error } = await supabase
    .from('pet_documents')
    .select('*')
    .eq('pet_id', petId)
    .order('doc_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data ?? []) as PetDocument[];
}

export async function countPetDocuments(petId: string): Promise<number> {
  const { count, error } = await supabase
    .from('pet_documents')
    .select('id', { count: 'exact', head: true })
    .eq('pet_id', petId);
  if (error) return 0;
  return count ?? 0;
}

export async function createPetDocument(input: {
  petId: string;
  ownerId: string;
  kind: DocumentKind;
  title: string;
  notes?: string | null;
  filePath: string;
  fileType: 'pdf' | 'image';
  fileName?: string | null;
  docDate?: string | null;
}): Promise<PetDocument> {
  const { data, error } = await supabase
    .from('pet_documents')
    .insert({
      pet_id: input.petId,
      owner_id: input.ownerId,
      kind: input.kind,
      title: input.title,
      notes: input.notes || null,
      file_path: input.filePath,
      file_type: input.fileType,
      file_name: input.fileName || null,
      doc_date: input.docDate || null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as PetDocument;
}

/** Apaga o registro + o arquivo do storage (best-effort no storage). */
export async function deletePetDocument(doc: PetDocument): Promise<void> {
  const { error } = await supabase.from('pet_documents').delete().eq('id', doc.id);
  if (error) throw error;
  try {
    await supabase.storage.from('pet-documents').remove([doc.file_path]);
  } catch {
    // ignora — o registro já foi removido
  }
}
