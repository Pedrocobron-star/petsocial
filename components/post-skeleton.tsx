import { Dimensions, View } from 'react-native';

import { Shimmer } from './ui/shimmer';

const SCREEN_W = Math.min(Dimensions.get('window').width, 600);

export function PostSkeleton() {
  return (
    <View style={{ marginBottom: 12, backgroundColor: '#fff' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
        <Shimmer width={36} height={36} borderRadius={18} />
        <View style={{ gap: 6 }}>
          <Shimmer width={120} height={12} />
          <Shimmer width={70} height={10} />
        </View>
      </View>
      <Shimmer width={SCREEN_W} height={SCREEN_W} borderRadius={0} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingVertical: 12 }}>
        <Shimmer width={50} height={24} borderRadius={12} />
        <Shimmer width={50} height={24} borderRadius={12} />
      </View>
      <View style={{ gap: 8, paddingHorizontal: 16, paddingBottom: 16 }}>
        <Shimmer width={'75%' as unknown as number} height={12} />
        <Shimmer width={'50%' as unknown as number} height={12} />
      </View>
    </View>
  );
}
