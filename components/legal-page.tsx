import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FONTS } from '@/lib/fonts';

interface Props {
  title: string;
  children: ReactNode;
}

export function LegalPage({ title, children }: Props) {
  const router = useRouter();
  return (
    <SafeAreaView edges={['top']} className="flex-1" style={{ backgroundColor: '#FFFBF5' }}>
      <View className="flex-row items-center gap-3 border-b border-orange-100 bg-white px-4 py-3">
        <Pressable hitSlop={10} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </Pressable>
        <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: '#1A1410' }}>{title}</Text>
      </View>
      <ScrollView contentContainerClassName="px-6 py-8 pb-16">
        <View className="mx-auto w-full max-w-3xl">{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

interface SectionProps {
  title: string;
  children: ReactNode;
}

export function LegalSection({ title, children }: SectionProps) {
  return (
    <View className="mb-8">
      <Text
        style={{
          fontFamily: FONTS.display,
          fontSize: 22,
          color: '#1A1410',
          marginBottom: 12,
        }}
      >
        {title}
      </Text>
      <View className="gap-3">{children}</View>
    </View>
  );
}

export function LegalParagraph({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        fontFamily: FONTS.body,
        fontSize: 15,
        lineHeight: 24,
        color: '#404040',
      }}
    >
      {children}
    </Text>
  );
}

export function LegalListItem({ children }: { children: ReactNode }) {
  return (
    <View className="flex-row gap-2">
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 16, color: '#F97316', lineHeight: 24 }}>
        •
      </Text>
      <Text
        style={{
          flex: 1,
          fontFamily: FONTS.body,
          fontSize: 15,
          lineHeight: 24,
          color: '#404040',
        }}
      >
        {children}
      </Text>
    </View>
  );
}
