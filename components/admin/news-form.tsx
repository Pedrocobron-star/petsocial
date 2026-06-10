import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { FONTS } from '@/lib/fonts';
import {
  fetchCategories,
  qkNews,
  slugify,
  type AffiliateProduct,
  type AffiliateStore,
  type NewsArticle,
  type NewsArticleInput,
  type NewsStatus,
} from '@/lib/news';
import { guessExtension, uploadToBucket } from '@/lib/storage';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

const STORES: { value: AffiliateStore; label: string }[] = [
  { value: 'shopee', label: 'Shopee' },
  { value: 'mercadolivre', label: 'Mercado Livre' },
  { value: 'amazon', label: 'Amazon' },
  { value: 'outro', label: 'Outro' },
];

const DEFAULT_AUTHOR = 'Redação Maestro Pet';

/**
 * Formulário compartilhado de matéria do Portal de Notícias (criar OU editar).
 * Monta um NewsArticleInput e delega para onSubmit.
 */
export function NewsForm({
  initial,
  submitLabel,
  onSubmit,
  submitting,
  onDelete,
}: {
  initial?: NewsArticle;
  submitLabel: string;
  onSubmit: (input: NewsArticleInput) => Promise<void>;
  submitting?: boolean;
  onDelete?: () => void;
}) {
  const { theme } = useTheme();
  const { session } = useSession();
  const toast = useToast();
  const userId = session?.user.id;

  const categoriesQuery = useQuery({
    queryKey: qkNews.categories(),
    queryFn: fetchCategories,
  });
  const categories = categoriesQuery.data ?? [];

  const [title, setTitle] = useState(initial?.title ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(initial?.category_id ?? null);
  const [dek, setDek] = useState(initial?.dek ?? '');
  const [coverUrl, setCoverUrl] = useState(initial?.cover_url ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [authorName, setAuthorName] = useState(initial?.author_name ?? DEFAULT_AUTHOR);
  const [isFeatured, setIsFeatured] = useState(initial?.is_featured ?? false);
  const [status, setStatus] = useState<NewsStatus>(initial?.status ?? 'draft');
  const [products, setProducts] = useState<AffiliateProduct[]>(initial?.affiliate_products ?? []);

  const [uploadingCover, setUploadingCover] = useState(false);
  // Trava o auto-slug assim que o usuário edita o slug à mão (ou se já existe um).
  const slugTouched = useRef(!!initial?.slug);

  const onTitleChange = (next: string) => {
    setTitle(next);
    if (!slugTouched.current) setSlug(slugify(next));
  };

  const onSlugChange = (next: string) => {
    slugTouched.current = true;
    setSlug(next);
  };

  const pickCover = async () => {
    if (!userId) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.9,
      aspect: [16, 9],
    });
    if (result.canceled || !result.assets?.[0]) return;
    const uri = result.assets[0].uri;
    try {
      setUploadingCover(true);
      const ext = guessExtension(uri, 'jpg');
      const url = await uploadToBucket('sponsored', userId, uri, ext);
      setCoverUrl(url);
      toast.success('Capa enviada');
    } catch (e) {
      toast.error('Erro no upload', e instanceof Error ? e.message : 'Tente de novo');
    } finally {
      setUploadingCover(false);
    }
  };

  const addProduct = () => {
    setProducts((prev) => [...prev, { label: '', url: '', store: 'shopee', price: '' }]);
  };

  const updateProduct = (index: number, patch: Partial<AffiliateProduct>) => {
    setProducts((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  const removeProduct = (index: number) => {
    setProducts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const cleanTitle = title.trim();
    const cleanSlug = slug.trim();
    if (!cleanTitle) {
      toast.error('Título obrigatório', 'Dá um nome pra matéria antes de salvar');
      return;
    }
    if (!cleanSlug) {
      toast.error('Slug obrigatório', 'O slug forma o link da matéria');
      return;
    }
    // Sanitiza os produtos: descarta linhas sem label ou sem URL.
    const cleanProducts: AffiliateProduct[] = products
      .map((p) => ({
        label: p.label.trim(),
        url: p.url.trim(),
        store: p.store,
        price: p.price?.trim() || undefined,
        image_url: p.image_url?.trim() || undefined,
      }))
      .filter((p) => p.label && p.url);

    try {
      await onSubmit({
        slug: cleanSlug,
        category_id: categoryId,
        title: cleanTitle,
        dek: dek.trim() || null,
        cover_url: coverUrl || null,
        body: body,
        author_name: authorName.trim() || DEFAULT_AUTHOR,
        status,
        is_featured: isFeatured,
        affiliate_products: cleanProducts,
      });
    } catch (e) {
      toast.error('Erro ao salvar', e instanceof Error ? e.message : 'Tente novamente');
    }
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 140 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Identidade */}
      <SectionTitle title="Matéria" />
      <Field
        label="Título *"
        value={title}
        onChange={onTitleChange}
        placeholder="Ex.: 5 cuidados essenciais com filhotes no inverno"
      />
      <Field
        label="Slug (link) *"
        value={slug}
        onChange={onSlugChange}
        placeholder="cuidados-filhotes-inverno"
        autoCapitalize="none"
        hint="Gerado a partir do título. Edite só se precisar."
      />

      {/* Categoria */}
      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.text }}>
          Categoria
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
        >
          <CategoryPill
            label="Sem categoria"
            emoji="🚫"
            selected={categoryId === null}
            onPress={() => setCategoryId(null)}
          />
          {categories.map((cat) => (
            <CategoryPill
              key={cat.id}
              label={cat.name}
              emoji={cat.emoji}
              color={cat.color}
              selected={categoryId === cat.id}
              onPress={() => setCategoryId(cat.id)}
            />
          ))}
        </ScrollView>
        {categoriesQuery.isLoading ? (
          <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }}>
            Carregando categorias…
          </Text>
        ) : null}
      </View>

      <Field
        label="Linha fina (dek)"
        value={dek}
        onChange={setDek}
        placeholder="Resumo curto que aparece abaixo do título"
        multiline
      />

      {/* Capa */}
      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.text }}>Capa</Text>
        {coverUrl ? (
          <View
            style={{
              borderRadius: 12,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: theme.borderLight,
            }}
          >
            <Image
              source={{ uri: coverUrl }}
              style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: theme.brandSurface }}
              contentFit="cover"
              transition={200}
            />
            <View style={{ flexDirection: 'row', gap: 8, padding: 8 }}>
              <Button title="Trocar capa" variant="secondary" size="sm" onPress={pickCover} />
              <Button
                title="Remover"
                variant="ghost"
                size="sm"
                onPress={() => setCoverUrl('')}
              />
            </View>
          </View>
        ) : (
          <Pressable
            onPress={pickCover}
            disabled={uploadingCover}
            style={{
              backgroundColor: theme.surface,
              borderWidth: 2,
              borderColor: theme.borderLight,
              borderStyle: 'dashed',
              borderRadius: 12,
              padding: 22,
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Ionicons
              name={uploadingCover ? 'cloud-upload' : 'image'}
              size={24}
              color={theme.brand}
            />
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.brand }}>
              {uploadingCover ? 'Enviando…' : 'Enviar capa'}
            </Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }}>
              Proporção 16:9 recomendada
            </Text>
          </Pressable>
        )}
      </View>

      {/* Corpo */}
      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.text }}>Texto</Text>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Escreva a matéria... (parágrafos separados por linha em branco)"
          placeholderTextColor={theme.textDim}
          multiline
          textAlignVertical="top"
          style={{
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.borderLight,
            borderRadius: 10,
            padding: 12,
            fontFamily: 'monospace',
            fontSize: 14,
            lineHeight: 21,
            color: theme.text,
            minHeight: 240,
          }}
        />
      </View>

      <Field
        label="Autor"
        value={authorName}
        onChange={setAuthorName}
        placeholder={DEFAULT_AUTHOR}
      />

      {/* Configuração */}
      <SectionTitle title="Publicação" />
      <Toggle
        label="Matéria em destaque (capa do portal)"
        value={isFeatured}
        onChange={setIsFeatured}
      />

      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.text }}>Status</Text>
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: theme.surface,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.borderLight,
            padding: 4,
            gap: 4,
          }}
        >
          <Segment
            label="Rascunho"
            selected={status === 'draft'}
            onPress={() => setStatus('draft')}
          />
          <Segment
            label="Publicada"
            selected={status === 'published'}
            onPress={() => setStatus('published')}
          />
        </View>
      </View>

      {/* Produtos afiliados */}
      <SectionTitle title="Produtos afiliados" />
      {products.length === 0 ? (
        <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim }}>
          Nenhum produto. Adicione links de afiliados que aparecem no fim da matéria.
        </Text>
      ) : null}
      {products.map((product, index) => (
        <ProductRow
          key={index}
          product={product}
          onChange={(patch) => updateProduct(index, patch)}
          onRemove={() => removeProduct(index)}
        />
      ))}
      <Pressable
        onPress={addProduct}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          backgroundColor: theme.brandSurface,
          borderWidth: 1,
          borderColor: theme.brandLight,
          borderRadius: 10,
          paddingVertical: 12,
        }}
      >
        <Ionicons name="add" size={18} color={theme.brand} />
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.brand }}>
          Adicionar produto
        </Text>
      </Pressable>

      {/* Ações */}
      <View style={{ gap: 10, marginTop: 8 }}>
        <Button title={submitLabel} onPress={handleSubmit} loading={submitting} fullWidth />
        {onDelete ? (
          <Button title="Apagar matéria" variant="danger" onPress={onDelete} fullWidth />
        ) : null}
      </View>
    </ScrollView>
  );
}

// ----------------------------------------------------------------------------
// Sub-componentes
// ----------------------------------------------------------------------------

function SectionTitle({ title }: { title: string }) {
  const { theme } = useTheme();
  return (
    <Text
      style={{
        fontFamily: FONTS.bodyBold,
        fontSize: 11,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        color: theme.brand,
        marginTop: 8,
      }}
    >
      {title}
    </Text>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  autoCapitalize = 'sentences',
  keyboardType,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'email-address' | 'number-pad' | 'url';
  hint?: string;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.text }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.textDim}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        style={{
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.borderLight,
          borderRadius: 10,
          padding: 12,
          fontFamily: FONTS.body,
          fontSize: 14,
          color: theme.text,
          minHeight: multiline ? 70 : undefined,
          textAlignVertical: multiline ? 'top' : 'auto',
        }}
      />
      {hint ? (
        <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }}>{hint}</Text>
      ) : null}
    </View>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.borderLight,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 10,
      }}
    >
      <Text style={{ flex: 1, fontFamily: FONTS.body, fontSize: 13, color: theme.text }}>
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: theme.brand, false: '#D4D4D8' }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

function Segment({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: selected ? theme.brand : 'transparent',
      }}
    >
      <Text
        style={{
          fontFamily: FONTS.bodyBold,
          fontSize: 13,
          color: selected ? theme.accent.onAccent : theme.textMuted,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function CategoryPill({
  label,
  emoji,
  color,
  selected,
  onPress,
}: {
  label: string;
  emoji: string;
  color?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const accent = color ?? theme.brand;
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: selected ? accent : theme.borderLight,
        backgroundColor: selected ? accent : theme.surface,
      }}
    >
      <Text style={{ fontSize: 14 }}>{emoji}</Text>
      <Text
        style={{
          fontFamily: FONTS.bodyBold,
          fontSize: 12,
          color: selected ? '#FFFFFF' : theme.text,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ProductRow({
  product,
  onChange,
  onRemove,
}: {
  product: AffiliateProduct;
  onChange: (patch: Partial<AffiliateProduct>) => void;
  onRemove: () => void;
}) {
  const { theme } = useTheme();
  const inputStyle = {
    backgroundColor: theme.bg,
    borderWidth: 1,
    borderColor: theme.borderLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: theme.text,
  } as const;
  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.borderLight,
        borderRadius: 12,
        padding: 12,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TextInput
          value={product.label}
          onChangeText={(v) => onChange({ label: v })}
          placeholder="Nome do produto"
          placeholderTextColor={theme.textDim}
          style={[inputStyle, { flex: 1 }]}
        />
        <Pressable onPress={onRemove} hitSlop={8}>
          <Ionicons name="close-circle" size={22} color="#9F1239" />
        </Pressable>
      </View>
      <TextInput
        value={product.url}
        onChangeText={(v) => onChange({ url: v })}
        placeholder="https://link-de-afiliado.com"
        placeholderTextColor={theme.textDim}
        autoCapitalize="none"
        keyboardType="url"
        style={inputStyle}
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          value={product.price ?? ''}
          onChangeText={(v) => onChange({ price: v })}
          placeholder="Preço (ex.: R$ 49,90)"
          placeholderTextColor={theme.textDim}
          style={[inputStyle, { flex: 1 }]}
        />
      </View>
      {/* Loja */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {STORES.map((s) => {
          const selected = product.store === s.value;
          return (
            <Pressable
              key={s.value}
              onPress={() => onChange({ store: s.value })}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 999,
                borderWidth: 1.5,
                borderColor: selected ? theme.brand : theme.borderLight,
                backgroundColor: selected ? theme.brand : theme.bg,
              }}
            >
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 11,
                  color: selected ? '#FFFFFF' : theme.textMuted,
                }}
              >
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
