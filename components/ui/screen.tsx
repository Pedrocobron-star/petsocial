import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/providers/theme-provider';

interface Props {
  children: ReactNode;
  scroll?: boolean;
  className?: string;
  contentClassName?: string;
}

export function Screen({ children, scroll = false, className, contentClassName }: Props) {
  const { theme } = useTheme();
  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      className={`flex-1 ${className ?? ''}`}
      style={{ backgroundColor: theme.bg }}
    >
      {scroll ? (
        <ScrollView
          contentContainerClassName={`px-4 py-4 ${contentClassName ?? ''}`}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View className={`flex-1 ${contentClassName ?? ''}`}>{children}</View>
      )}
    </SafeAreaView>
  );
}
