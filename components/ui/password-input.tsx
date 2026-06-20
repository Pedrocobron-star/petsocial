import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useId, useState } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { useTheme } from '@/providers/theme-provider';

interface Props extends Omit<TextInputProps, 'secureTextEntry'> {
  label?: string;
  error?: string;
  hint?: string;
  /** Mostra um meter de força da senha embaixo. Default false. */
  showStrength?: boolean;
}

/**
 * Input de senha com toggle olhinho pra mostrar/ocultar.
 * Wrapper sobre TextInput com mesma aparência do Input padrão + botão
 * absoluto no canto direito.
 */
export const PasswordInput = forwardRef<TextInput, Props>(function PasswordInput(
  { label, error, hint, className, style, showStrength, value, ...rest },
  ref,
) {
  const { theme } = useTheme();
  const labelId = useId();
  const errorColor = theme.name === 'dark' ? '#F87171' : '#DC2626';
  const [reveal, setReveal] = useState(false);
  const strength = showStrength ? scorePassword(typeof value === 'string' ? value : '') : null;

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

      <View style={{ position: 'relative' }}>
        <TextInput
          ref={ref}
          value={value}
          secureTextEntry={!reveal}
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
              paddingRight: 44,
            },
            style,
          ]}
          className={className}
          {...rest}
        />
        <Pressable
          onPress={() => setReveal((r) => !r)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={reveal ? 'Ocultar senha' : 'Mostrar senha'}
          style={{
            position: 'absolute',
            right: 4,
            top: 0,
            bottom: 0,
            width: 40,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons
            name={reveal ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color={theme.textDim}
          />
        </Pressable>
      </View>

      {/* Strength meter — só se showStrength=true */}
      {strength ? (
        <View style={{ marginTop: 6, gap: 4 }}>
          <View style={{ flexDirection: 'row', gap: 3 }}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: i < strength.level ? strength.color : theme.borderLight,
                }}
              />
            ))}
          </View>
          <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 11, color: strength.color }}>
            {strength.label}
          </Text>
        </View>
      ) : null}

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
});

/**
 * Score de senha 0-4. Heurística simples mas eficaz:
 * - >= 6 chars: 1
 * - >= 10 chars: 2
 * - tem número: 2
 * - tem letra maiúscula + minúscula: 3
 * - tem símbolo: 4
 */
function scorePassword(pw: string): { level: number; label: string; color: string } | null {
  if (!pw) return { level: 0, label: 'Digite sua senha', color: '#A8A29E' };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/\d/.test(pw)) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  // Clamp 1..4
  const level = Math.max(1, Math.min(4, score));
  const labels = ['Muito fraca', 'Fraca', 'Razoável', 'Boa', 'Forte'];
  const colors = ['#DC2626', '#F59E0B', '#F59E0B', '#10B981', '#16A34A'];
  return {
    level,
    label: labels[Math.min(4, Math.floor((level / 4) * 4))],
    color: colors[Math.min(4, Math.floor((level / 4) * 4))],
  };
}
