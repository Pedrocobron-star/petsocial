import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { supabase } from './supabase';

export async function uploadToBucket(
  bucket: 'avatars' | 'posts' | 'pet-symptoms' | 'sponsored',
  userId: string,
  localUri: string,
  ext: string,
): Promise<string> {
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  let body: ArrayBuffer | Blob;
  let contentType =
    ext === 'mp4' || ext === 'mov' || ext === 'webm' ? `video/${ext === 'mov' ? 'quicktime' : ext}` : `image/${ext === 'jpg' ? 'jpeg' : ext}`;

  if (Platform.OS === 'web') {
    const res = await fetch(localUri);
    body = await res.blob();
    contentType = body.type || contentType;
  } else {
    const file = new File(localUri);
    const base64 = await file.base64();
    body = decodeBase64(base64);
  }

  const { error } = await supabase.storage.from(bucket).upload(path, body, {
    contentType,
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

function decodeBase64(b64: string): ArrayBuffer {
  const binary = globalThis.atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export function guessExtension(uri: string, fallback: 'jpg' | 'mp4' = 'jpg'): string {
  const match = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return (match?.[1] ?? fallback).toLowerCase();
}

/**
 * Apaga um objeto do bucket pelo URL público.
 * Best-effort — silencia erro (objeto pode já ter sido removido).
 */
export async function deleteFromBucket(
  bucket: 'avatars' | 'posts' | 'pet-symptoms' | 'sponsored',
  publicUrl: string,
): Promise<void> {
  try {
    const marker = `/object/public/${bucket}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx < 0) return;
    const path = publicUrl.substring(idx + marker.length);
    if (!path) return;
    await supabase.storage.from(bucket).remove([path]);
  } catch {
    // ignora
  }
}

/**
 * Apaga um objeto público detectando o bucket pela PRÓPRIA URL
 * (/object/public/<bucket>/<path>). Útil pra limpar mídia de buckets variados
 * de uma vez (ex.: ao excluir um pet). Best-effort — silencia erro.
 */
export async function deleteByPublicUrl(publicUrl: string): Promise<void> {
  try {
    const marker = '/object/public/';
    const idx = publicUrl.indexOf(marker);
    if (idx < 0) return;
    const rest = publicUrl.substring(idx + marker.length); // <bucket>/<path...>
    const slash = rest.indexOf('/');
    if (slash < 0) return;
    const bucket = rest.substring(0, slash);
    const path = rest.substring(slash + 1).split('?')[0];
    if (!bucket || !path) return;
    await supabase.storage.from(bucket).remove([path]);
  } catch {
    // ignora
  }
}
