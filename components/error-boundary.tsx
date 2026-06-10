import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { MOZART } from '@/lib/mozart';
import { captureError } from '@/lib/sentry';

interface Props {
  children: ReactNode;
  /** Texto opcional pro botão de retry. Default "Tentar de novo". */
  retryLabel?: string;
  /** Fallback custom. Quando ausente, usa o default brandeado. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Captura erros em runtime dentro da subtree e mostra UI de fallback
 * em vez de tela branca + crash.
 *
 * Envia erro pra `captureError()` (que loga em `app_errors` no Supabase).
 *
 * Uso recomendado: envolver rotas grandes ou subtrees críticas.
 *   <ErrorBoundary>
 *     <ScreenContent />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    captureError(error, {
      tags: { source: 'react_error_boundary' },
      extra: {
        componentStack: info.componentStack?.slice(0, 2000),
      },
    });
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return (
        <DefaultFallback
          error={this.state.error}
          onReset={this.reset}
          retryLabel={this.props.retryLabel ?? 'Tentar de novo'}
        />
      );
    }
    return this.props.children;
  }
}

function DefaultFallback({
  error,
  onReset,
  retryLabel,
}: {
  error: Error;
  onReset: () => void;
  retryLabel: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#FFFBF5',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 16,
      }}
    >
      <Image
        source={{ uri: MOZART.triste }}
        style={{ width: 132, height: 132 }}
        resizeMode="contain"
        accessibilityLabel="Mozart triste"
      />
      <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: '#1A1410', textAlign: 'center' }}>
        Ops, algo deu errado
      </Text>
      <Text
        style={{
          fontFamily: FONTS.body,
          fontSize: 14,
          color: '#525252',
          textAlign: 'center',
          maxWidth: 320,
          lineHeight: 20,
        }}
      >
        Tivemos um problema carregando essa tela. Já capturamos o erro pra investigar — você pode
        tentar de novo ou voltar pra home.
      </Text>
      {__DEV__ ? (
        <Text
          style={{
            fontFamily: FONTS.body,
            fontSize: 11,
            color: '#9F1239',
            marginTop: 8,
            maxWidth: 320,
            textAlign: 'center',
          }}
        >
          {error.message}
        </Text>
      ) : null}
      <Pressable
        onPress={onReset}
        accessibilityLabel={retryLabel}
        style={{
          marginTop: 8,
          backgroundColor: '#F97316',
          paddingHorizontal: 24,
          paddingVertical: 12,
          borderRadius: 12,
        }}
      >
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#FFFFFF' }}>
          {retryLabel}
        </Text>
      </Pressable>
    </View>
  );
}
