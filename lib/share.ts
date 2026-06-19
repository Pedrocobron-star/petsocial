import { Alert, Linking, Platform, Share } from 'react-native';

interface ShareOptions {
  title: string;
  message: string;
  url: string;
}

export async function sharePost({ title, message, url }: ShareOptions): Promise<'shared' | 'copied' | 'cancelled'> {
  if (Platform.OS === 'web') {
    const nav = globalThis.navigator;
    if (nav && typeof nav.share === 'function') {
      try {
        await nav.share({ title, text: message, url });
        return 'shared';
      } catch {
        return 'cancelled';
      }
    }
    if (nav && nav.clipboard) {
      try {
        await nav.clipboard.writeText(url);
        return 'copied';
      } catch {
        Alert.alert('Link', url);
        return 'copied';
      }
    }
    Alert.alert('Link', url);
    return 'copied';
  }

  try {
    const result = await Share.share({ title, message: `${message}\n${url}`, url });
    return result.action === Share.dismissedAction ? 'cancelled' : 'shared';
  } catch {
    return 'cancelled';
  }
}

/**
 * URL canônica pra compartilhar em redes sociais — passa pela edge function
 * `share-meta` que injeta OG/JSON-LD pra crawlers e redireciona humanos pro
 * SPA route. Quando o backend não estiver disponível (dev local), cai pro
 * SPA path direto.
 */
export function shareBaseUrl(): string {
  if (Platform.OS === 'web' && globalThis.location?.origin) {
    return globalThis.location.origin;
  }
  return 'https://maestropet.com';
}

export function postUrl(postId: string): string {
  if (Platform.OS === 'web') {
    return `${shareBaseUrl()}/share/post/${postId}`;
  }
  return `petsocial://post/${postId}`;
}

export function petUrl(petId: string): string {
  if (Platform.OS === 'web') {
    return `${shareBaseUrl()}/share/pet/${petId}`;
  }
  return `petsocial://pet/${petId}`;
}

/** Carteirinha pública (QR code) — token único, NÃO o pet id. */
export function petIdCardUrl(token: string): string {
  if (Platform.OS === 'web') {
    return `${shareBaseUrl()}/share/id/${token}`;
  }
  return `petsocial://id/${token}`;
}

/**
 * Matéria do jornal → leitor PÚBLICO /ler/{slug} (lê SEM login = aquisição).
 * A /ler tem OG + JSON-LD Article + canonical (indexável pelo Googlebot, que roda
 * JS). Pra preview RICO em crawlers sem-JS (WhatsApp/FB/Twitter) basta trocar por
 * `${shareBaseUrl()}/share/news/${slug}` — a edge share-meta já serve HTML SSR do
 * corpo (Onda C). NÃO trocar até a edge ser redeployada (senão /share/news → 404).
 */
export function newsUrl(slug: string): string {
  if (Platform.OS === 'web') {
    return `${shareBaseUrl()}/ler/${slug}`;
  }
  return `petsocial://ler/${slug}`;
}

/** Link pro hub dos jogos (Arena Pet) — usado ao compartilhar resultado. */
export function gamesUrl(): string {
  if (Platform.OS === 'web') {
    return `${shareBaseUrl()}/games`;
  }
  return 'petsocial://games';
}

/**
 * Compartilha diretamente via WhatsApp. Tenta deep link nativo;
 * se falhar, cai pro wa.me universal (abre WhatsApp Web).
 */
export async function shareToWhatsApp(text: string): Promise<boolean> {
  const encoded = encodeURIComponent(text);
  // Universal link funciona em todos os ambientes
  const universal = `https://wa.me/?text=${encoded}`;

  if (Platform.OS === 'web') {
    try {
      globalThis.open(universal, '_blank');
      return true;
    } catch {
      return false;
    }
  }

  // Mobile: tenta deep link nativo primeiro
  const native = `whatsapp://send?text=${encoded}`;
  try {
    const supported = await Linking.canOpenURL(native);
    if (supported) {
      await Linking.openURL(native);
      return true;
    }
    // Fallback: abre wa.me
    await Linking.openURL(universal);
    return true;
  } catch {
    return false;
  }
}

/**
 * Tenta abrir Instagram Stories com imagem pré-carregada.
 * Requer:
 *  - iOS: ter Instagram app instalado + ter registrado scheme 'instagram-stories'
 *  - Android: ter Instagram app instalado
 *
 * Fallback: orienta o usuário a salvar a imagem manualmente.
 *
 * @param imageUri URI local da imagem (file:// no native; blob: no web)
 * @returns true se conseguiu abrir Instagram, false se precisa instrução manual
 */
export async function shareToInstagramStory(imageUri: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  // Deep link do Instagram Stories
  // iOS: instagram-stories://share?backgroundImage=...
  // Android: usa Intent com type=image/* extra ACTION_SEND_TO_STORY
  const scheme =
    Platform.OS === 'ios'
      ? `instagram-stories://share?backgroundImage=${encodeURIComponent(imageUri)}`
      : `instagram://library?AssetPath=${encodeURIComponent(imageUri)}`;

  try {
    const supported = await Linking.canOpenURL(scheme);
    if (supported) {
      await Linking.openURL(scheme);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Copia uma string pro clipboard de forma cross-platform (web + native).
 * No native usa Share como fallback se não tiver clipboard API.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    const nav = globalThis.navigator;
    if (nav?.clipboard?.writeText) {
      try {
        await nav.clipboard.writeText(text);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
  // Native: usa Share como fallback simples (não precisa instalar expo-clipboard)
  try {
    await Share.share({ message: text });
    return true;
  } catch {
    return false;
  }
}
