import { Image } from 'expo-image';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { useTheme } from '@/providers/theme-provider';

/**
 * Renderiza o corpo da matéria em blocos. Um bloco (parágrafo separado por linha
 * em branco) que seja EXATAMENTE uma imagem markdown `![legenda](url)` vira uma
 * imagem com legenda; o resto vira parágrafo de texto. Assim o CMS escreve
 * imagens no meio do texto (com legenda) sem precisar de schema novo.
 */

// Bloco inteiro = imagem markdown. ^...$ garante que texto com colchetes no meio
// de um parágrafo NÃO seja confundido com imagem.
const IMG_RE = /^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)$/;

type Block = { kind: 'text'; text: string } | { kind: 'image'; url: string; caption: string };

function parseBody(body: string): Block[] {
  return body
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0)
    .map((b): Block => {
      const m = b.match(IMG_RE);
      if (m) return { kind: 'image', url: m[2], caption: (m[1] ?? '').trim() };
      return { kind: 'text', text: b };
    });
}

export function ArticleBody({ body }: { body: string }) {
  const { theme } = useTheme();
  const blocks = useMemo(() => parseBody(body), [body]);

  return (
    <View style={{ marginTop: 18, gap: 16 }}>
      {blocks.map((block, i) =>
        block.kind === 'image' ? (
          <View key={i} style={{ gap: 6 }}>
            <Image
              source={{ uri: block.url }}
              style={{
                width: '100%',
                aspectRatio: 16 / 9,
                borderRadius: 12,
                backgroundColor: theme.brandSurface,
              }}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
            {block.caption ? <ImageCaption caption={block.caption} /> : null}
          </View>
        ) : (
          <Text
            key={i}
            style={{ fontFamily: FONTS.body, fontSize: 16.5, color: theme.text, lineHeight: 27 }}
          >
            {block.text}
          </Text>
        ),
      )}
    </View>
  );
}

/** Legenda de imagem (capa ou inline) — estilo itálico discreto, centralizado. */
export function ImageCaption({ caption }: { caption: string }) {
  const { theme } = useTheme();
  return (
    <Text
      style={{
        fontFamily: FONTS.body,
        fontSize: 12.5,
        color: theme.textDim,
        fontStyle: 'italic',
        textAlign: 'center',
        lineHeight: 18,
        paddingHorizontal: 8,
      }}
    >
      {caption}
    </Text>
  );
}
