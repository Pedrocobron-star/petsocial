import { View } from 'react-native';

import { Shimmer } from '@/components/ui/shimmer';

interface Props {
  /** Quantos cards "fantasma" mostrar. Default 3. */
  count?: number;
  /** Se true, mostra também um header card (score / banner). Default false. */
  withHeader?: boolean;
}

/**
 * Esqueleto genérico pra lista de saúde — vacinas, sintomas, parasitas,
 * consultas, etc. Mantém o layout estável enquanto a query carrega,
 * evitando o flash de tela branca.
 */
export function HealthListSkeleton({ count = 3, withHeader = false }: Props) {
  return (
    <View style={{ gap: 12 }}>
      {withHeader ? (
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            padding: 16,
            gap: 10,
            borderWidth: 1,
            borderColor: '#F5F5F5',
          }}
        >
          <Shimmer width="60%" height={14} />
          <Shimmer width="40%" height={28} />
          <Shimmer width="100%" height={6} borderRadius={3} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Shimmer width={90} height={22} borderRadius={11} />
            <Shimmer width={90} height={22} borderRadius={11} />
            <Shimmer width={90} height={22} borderRadius={11} />
          </View>
        </View>
      ) : null}

      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </View>
  );
}

function SkeletonRow() {
  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 14,
        gap: 10,
        borderWidth: 1,
        borderColor: '#F5F5F5',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Shimmer width={36} height={36} borderRadius={18} />
        <View style={{ flex: 1, gap: 6 }}>
          <Shimmer width="70%" height={14} />
          <Shimmer width="40%" height={11} />
        </View>
      </View>
      <Shimmer width="100%" height={10} />
      <Shimmer width="80%" height={10} />
    </View>
  );
}
