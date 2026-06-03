import { useRouter } from 'expo-router';
import { Text, type TextStyle } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { tokenize } from '@/lib/text-parsing';
import { useTheme } from '@/providers/theme-provider';

interface Props {
  text: string;
  baseStyle?: TextStyle;
  numberOfLines?: number;
}

/**
 * Renderiza texto com #hashtags e @menções como links clicáveis.
 * Hashtags: cor laranja saturada + bold pro destaque.
 * Menções: cor roxa pra diferenciar.
 */
export function RichText({ text, baseStyle, numberOfLines }: Props) {
  const { theme } = useTheme();
  const router = useRouter();
  const tokens = tokenize(text);

  return (
    <Text numberOfLines={numberOfLines} style={baseStyle}>
      {tokens.map((t, i) => {
        if (t.type === 'hashtag') {
          return (
            <Text
              key={i}
              onPress={() =>
                router.push({ pathname: '/tag/[name]' as never, params: { name: t.value } as never })
              }
              style={{
                fontFamily: FONTS.bodyBold,
                color: '#EA580C', // Laranja mais saturado
                letterSpacing: -0.1,
              }}
            >
              #{t.value}
            </Text>
          );
        }
        if (t.type === 'mention') {
          return (
            <Text
              key={i}
              style={{
                fontFamily: FONTS.bodyBold,
                color: '#7C3AED', // Roxo pra menções
                letterSpacing: -0.1,
              }}
            >
              @{t.value}
            </Text>
          );
        }
        return (
          <Text key={i} style={baseStyle}>
            {t.value}
          </Text>
        );
      })}
    </Text>
  );
}
