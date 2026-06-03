import { Platform } from 'react-native';

/**
 * Converte um <svg> DOM (web) em data URL PNG.
 * Retorna `null` se: não estiver no web, sem suporte canvas, ou falha de load.
 *
 * O size é em pixels. Para qualidade boa em sharing, usar 512–1024.
 */
export async function svgNodeToPng(svg: Element, size = 512): Promise<string | null> {
  if (Platform.OS !== 'web') return null;
  if (typeof document === 'undefined') return null;

  // Serializa SVG. Garante xmlns no root pra browser interpretar standalone.
  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(svg);
  if (!svgString.includes('xmlns="http://www.w3.org/2000/svg"')) {
    svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  return new Promise<string | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, size, size);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        URL.revokeObjectURL(url);
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/**
 * Triggers download de data URL no browser. No native, no-op.
 */
export function downloadDataUrl(dataUrl: string, filename: string) {
  if (Platform.OS !== 'web') return;
  if (typeof document === 'undefined') return;
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Compartilha PNG via Web Share API (mobile web) ou fallback download.
 * Retorna true se ofereceu compartilhamento, false se caiu no download.
 */
export async function sharePngDataUrl(
  dataUrl: string,
  filename: string,
  title: string,
): Promise<boolean> {
  if (Platform.OS !== 'web') return false;
  if (typeof navigator === 'undefined') return false;

  // Browser não suporta Web Share API com files? Fallback download.
  const canShareFiles =
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function';

  if (!canShareFiles) {
    downloadDataUrl(dataUrl, filename);
    return false;
  }

  try {
    // Converte data URL → File
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], filename, { type: 'image/png' });

    if (!navigator.canShare({ files: [file] })) {
      downloadDataUrl(dataUrl, filename);
      return false;
    }
    await navigator.share({ title, files: [file] });
    return true;
  } catch {
    // Cancelado/erro → tenta download
    downloadDataUrl(dataUrl, filename);
    return false;
  }
}
