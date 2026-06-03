import { forwardRef } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { FONTS } from '@/lib/fonts';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<TextInput, Props>(function Input(
  { label, error, hint, className, style, ...rest },
  ref,
) {
  return (
    <View className="w-full">
      {label ? (
        <Text
          style={{
            fontFamily: FONTS.bodySemibold,
            fontSize: 13,
            color: '#404040',
            marginBottom: 6,
          }}
        >
          {label}
        </Text>
      ) : null}
      <TextInput
        ref={ref}
        placeholderTextColor="#9ca3af"
        style={[
          {
            fontFamily: FONTS.body,
            fontSize: 15,
            color: '#1A1410',
          },
          style,
        ]}
        className={`rounded-xl border border-neutral-300 bg-white px-4 py-3 ${
          error ? 'border-red-500' : ''
        } ${className ?? ''}`}
        {...rest}
      />
      {error ? (
        <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 12, color: '#dc2626', marginTop: 4 }}>
          {error}
        </Text>
      ) : null}
      {!error && hint ? (
        <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: '#737373', marginTop: 4 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});
