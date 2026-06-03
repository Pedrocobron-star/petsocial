import { Component, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { speciesEmoji } from '@/lib/constants';
import type { Species } from '@/lib/types';

interface Props {
  size: number;
  /** Species do pet — fallback usa o emoji da espécie. */
  species?: Species;
  /** Background do fallback (geralmente brand light). */
  bgColor?: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Error boundary específico pro renderer SVG do Pet Avatar.
 *
 * Se renderPattern/renderEars/etc lança (config corrompido vindo do banco,
 * tipo novo não suportado, bug de coord etc), em vez de mostrar tela branca
 * mostra um fallback discreto: círculo com emoji da espécie.
 *
 * Single source of failure pra todo o sistema de avatar — usa em qualquer
 * lugar que renderize PetAvatarSvg/AnimatedPetAvatar diretamente.
 */
export class PetAvatarBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    // Log silencioso — não queremos crashar nem spammar console em listas.
    // Em produção isso poderia ir pra Sentry/análise.
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn('[PetAvatar] renderer falhou, mostrando fallback', error.message);
    }
  }

  render() {
    if (this.state.hasError) {
      const { size, species = 'other', bgColor = '#FFEDD5' } = this.props;
      return (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: bgColor,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          accessible
          accessibilityRole="image"
          accessibilityLabel="Avatar indisponível"
        >
          <Text style={{ fontSize: size * 0.5 }}>{speciesEmoji(species)}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}
