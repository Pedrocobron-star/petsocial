import { Ionicons } from '@expo/vector-icons';
import { Pressable, type PressableProps, type ViewStyle } from 'react-native';

interface Props extends Omit<PressableProps, 'children' | 'style' | 'accessibilityLabel'> {
  /** Nome do ícone Ionicons. */
  name: keyof typeof Ionicons.glyphMap;
  /** Tamanho do ícone em pixels. */
  size?: number;
  /** Cor do ícone. */
  color?: string;
  /**
   * Label semântico OBRIGATÓRIO — usado por screen readers (VoiceOver, TalkBack).
   * Sem isso, o leitor anuncia só "button" — péssimo pra acessibilidade.
   */
  accessibilityLabel: string;
  /** Hit slop em px (área tocável extra além do visível). Default 8. */
  hitSlop?: number;
  /** Estilo do container do botão. */
  style?: ViewStyle;
}

/**
 * Botão de ícone com acessibilidade enforçada pelo TypeScript.
 *
 * Substitui o padrão `<Pressable><Ionicons /></Pressable>` que esquece
 * accessibilityLabel ~80% das vezes. O `accessibilityLabel` é prop required
 * — se você esquecer, TS reclama.
 *
 * Uso:
 *   <IconButton name="trash-outline" accessibilityLabel="Apagar post" onPress={...} />
 */
export function IconButton({
  name,
  size = 22,
  color = '#1A1410',
  accessibilityLabel,
  hitSlop = 8,
  style,
  ...rest
}: Props) {
  return (
    <Pressable
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={style}
      {...rest}
    >
      <Ionicons name={name} size={size} color={color} />
    </Pressable>
  );
}
