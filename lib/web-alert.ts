/**
 * Shim do `Alert.alert` pro WEB.
 *
 * O react-native-web NÃO implementa `Alert.alert` com botões — então
 * confirmações (excluir vacina, apagar pet, etc.) e mensagens de erro
 * silenciosamente NÃO funcionam no navegador/PWA (o callback nunca dispara).
 *
 * Aqui sobrescrevemos `Alert.alert` no web pra usar `window.confirm` /
 * `window.alert`, respeitando os botões (cancel vs confirmar). Assim TODOS os
 * ~74 usos de Alert.alert pelo app passam a funcionar no web sem precisar
 * editar cada call site. Em native, nada muda (fica o Alert nativo).
 *
 * Importado como side-effect no topo de `app/_layout.tsx` (roda uma vez, cedo).
 */
import { Alert, type AlertButton, type AlertOptions, Platform } from 'react-native';

import { showConfirm } from './confirm';

if (Platform.OS === 'web' && typeof window !== 'undefined' && Alert) {
  const webAlert = (
    title: string,
    message?: string,
    buttons?: AlertButton[],
    _options?: AlertOptions,
  ): void => {
    // Primeiro tenta o modal estilizado in-app. Sem host montado → nativo.
    if (showConfirm({ title, message, buttons })) return;

    const text = message ? `${title}\n\n${message}` : title;

    // Sem botões ou só 1 (OK / info / erro) → window.alert + dispara o onPress.
    if (!buttons || buttons.length <= 1) {
      window.alert(text);
      buttons?.[0]?.onPress?.();
      return;
    }

    // 2+ botões → confirm. "Confirmar" = 1º botão que não é cancel (ou o último).
    const cancelBtn = buttons.find((b) => b?.style === 'cancel');
    const confirmBtn =
      buttons.find((b) => b?.style !== 'cancel' && b !== cancelBtn) ?? buttons[buttons.length - 1];

    if (window.confirm(text)) confirmBtn?.onPress?.();
    else cancelBtn?.onPress?.();
  };

  (Alert as unknown as { alert: typeof webAlert }).alert = webAlert;
}
