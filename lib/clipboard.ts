import { Platform } from 'react-native';

/**
 * Copy minimalista cross-platform.
 *
 * Web: usa navigator.clipboard.writeText (HTTPS + permission)
 * Native: usa Clipboard legado do react-native (deprecated mas funciona)
 *
 * Retorna true se copiou, false se falhou. Não lança — caller decide o toast.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      if (typeof navigator === 'undefined' || !navigator.clipboard) return false;
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Native: import dinâmico do Clipboard deprecated pra evitar warning estático
    const RN: { Clipboard?: { setString: (s: string) => void } } = await import('react-native');
    if (RN.Clipboard?.setString) {
      RN.Clipboard.setString(text);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
