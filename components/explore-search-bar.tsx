import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { FONTS } from '@/lib/fonts';
import { useTheme } from '@/providers/theme-provider';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

/**
 * Search bar do Explore com microinteração de focus.
 * Borda ganha tom brand quando focado, ícone também colore.
 */
export function ExploreSearchBar({ value, onChange, placeholder = 'Buscar pets, raças, tutores...' }: Props) {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const progress = useSharedValue(0);

  const setFocus = (v: boolean) => {
    setFocused(v);
    progress.value = withTiming(v ? 1 : 0, {
      duration: 200,
      reduceMotion: ReduceMotion.Never,
    });
  };

  const animStyle = useAnimatedStyle(() => {
    // Interpola entre borderLight e brandLight conforme foca
    return {
      borderColor: progress.value > 0.5 ? theme.brand : theme.borderLight,
      backgroundColor: progress.value > 0.5 ? theme.brandSurface : theme.borderLight,
    };
  });

  return (
    <Pressable onPress={() => inputRef.current?.focus()}>
      <Animated.View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            borderRadius: 999,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderWidth: 1.5,
          },
          animStyle,
        ]}
      >
        <Ionicons
          name="search"
          size={18}
          color={focused ? theme.brand : theme.textDim}
        />
        <TextInput
          ref={inputRef}
          accessibilityLabel="Buscar"
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={theme.textDim}
          style={{
            flex: 1,
            fontFamily: FONTS.body,
            fontSize: 15,
            color: theme.text,
            padding: 0,
          }}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
        />
        {value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Limpar busca"
            hitSlop={10}
            onPress={() => onChange('')}
          >
            <Ionicons name="close-circle" size={18} color={theme.textDim} />
          </Pressable>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}
