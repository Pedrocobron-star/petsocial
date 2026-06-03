import { type ReactNode } from 'react';
import { Dimensions, View, type ViewStyle } from 'react-native';

import { FEED_CARD_MARGIN, MAX_FEED_WIDTH } from '@/lib/layout';

interface Props {
  children: ReactNode;
  /** Largura máxima. Default MAX_FEED_WIDTH. */
  maxWidth?: number;
  /** Aplica margem lateral? Default true. */
  withMargin?: boolean;
  style?: ViewStyle;
}

/**
 * Wrapper que limita o conteúdo a uma largura máxima (estilo Instagram Web)
 * e centraliza horizontalmente. Mobile: ocupa 100% até MAX_FEED_WIDTH.
 */
export function CenteredColumn({ children, maxWidth = MAX_FEED_WIDTH, withMargin = true, style }: Props) {
  const SCREEN_W = Dimensions.get('window').width;
  const margin = withMargin ? FEED_CARD_MARGIN : 0;
  const width = Math.min(SCREEN_W - margin * 2, maxWidth);

  return (
    <View style={[{ width, alignSelf: 'center' }, style]}>
      {children}
    </View>
  );
}
