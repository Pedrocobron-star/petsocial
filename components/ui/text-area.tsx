import { useId } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { useTheme } from '@/providers/theme-provider';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  rows?: number;
}

export function TextArea({ label, error, hint, rows = 4, className, style, ...rest }: Props) {
  const { theme } = useTheme();
  const labelId = useId();
  const errorColor = theme.name === 'dark' ? '#F87171' : '#DC2626';
  return (
    <View className="w-full">
      {label ? (
        <Text
          nativeID={labelId}
          style={{
            fontFamily: FONTS.bodySemibold,
            fontSize: 13,
            color: theme.textMuted,
            marginBottom: 6,
          }}
        >
          {label}
        </Text>
      ) : null}
      <TextInput
        multiline
        textAlignVertical="top"
        placeholderTextColor={theme.textDim}
        accessibilityLabelledBy={label ? labelId : undefined}
        style={[
          {
            fontFamily: FONTS.body,
            fontSize: 15,
            color: theme.text,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: error ? errorColor : theme.border,
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
            minHeight: rows * 22,
          },
          style,
        ]}
        className={className}
        {...rest}
      />
      {error ? (
        <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 12, color: errorColor, marginTop: 4 }}>
          {error}
        </Text>
      ) : null}
      {!error && hint ? (
        <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim, marginTop: 4 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
