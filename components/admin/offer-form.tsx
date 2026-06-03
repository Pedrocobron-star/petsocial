import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { FONTS } from '@/lib/fonts';
import { OFFER_CATEGORIES, type Offer, type OfferCategory, type OfferInput } from '@/lib/offers';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

function isoToBr(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function parseBrDate(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  let [, d, mo, y] = m;
  if (y.length === 2) y = '20' + y;
  const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  if (Number.isNaN(new Date(iso + 'T00:00:00').getTime())) return null;
  return iso;
}

/** Formulário compartilhado de Oferta (criar OU editar). Admin only. */
export function OfferForm({
  initial,
  submitLabel,
  onSubmit,
  submitting,
}: {
  initial?: Partial<Offer>;
  submitLabel: string;
  onSubmit: (input: OfferInput) => Promise<void>;
  submitting?: boolean;
}) {
  const toast = useToast();

  const [brand, setBrand] = useState(initial?.brand ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [discountLabel, setDiscountLabel] = useState(initial?.discount_label ?? '');
  const [couponCode, setCouponCode] = useState(initial?.coupon_code ?? '');
  const [ctaUrl, setCtaUrl] = useState(initial?.cta_url ?? '');
  const [ctaLabel, setCtaLabel] = useState(initial?.cta_label ?? 'Aproveitar');
  const [category, setCategory] = useState<OfferCategory>(initial?.category ?? 'racao');
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? '');
  const [validUntil, setValidUntil] = useState(isoToBr(initial?.valid_until));
  const [priority, setPriority] = useState(String(initial?.priority ?? 0));
  const [active, setActive] = useState(initial?.active ?? true);
  const [notes, setNotes] = useState(initial?.notes ?? '');

  const handleSubmit = async () => {
    if (!brand.trim()) {
      toast.error('Marca obrigatória', 'Ex: Petlove, Golden, Cobasi');
      return;
    }
    if (!title.trim()) {
      toast.error('Título obrigatório', 'Ex: 20% OFF na primeira compra');
      return;
    }
    if (!ctaUrl.trim()) {
      toast.error('Link obrigatório', 'Pra onde o usuário vai ao clicar');
      return;
    }
    if (validUntil.trim() && !parseBrDate(validUntil)) {
      toast.error('Data inválida', 'Use dd/mm/aaaa ou deixe em branco');
      return;
    }
    try {
      await onSubmit({
        brand: brand.trim(),
        title: title.trim(),
        description: description.trim() || null,
        discount_label: discountLabel.trim() || null,
        coupon_code: couponCode.trim() || null,
        cta_url: ctaUrl.trim(),
        cta_label: ctaLabel.trim() || 'Aproveitar',
        category,
        image_url: imageUrl.trim() || null,
        valid_until: parseBrDate(validUntil),
        priority: parseInt(priority, 10) || 0,
        active,
        notes: notes.trim() || null,
      });
    } catch (e) {
      toast.error('Erro ao salvar', e instanceof Error ? e.message : 'Tente novamente');
    }
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 120 }}
      keyboardShouldPersistTaps="handled"
    >
      <SectionTitle title="Patrocinador" />
      <Field label="Marca *" value={brand} onChange={setBrand} placeholder="Ex: Petlove, Golden, Cobasi" />
      <ChipRow
        label="Categoria"
        options={OFFER_CATEGORIES.map((c) => ({ value: c.key, label: `${c.emoji} ${c.label}` }))}
        value={category}
        onChange={(v) => setCategory(v as OfferCategory)}
      />

      <SectionTitle title="Oferta" />
      <Field label="Título *" value={title} onChange={setTitle} placeholder="Ex: 20% OFF na primeira compra" />
      <Field
        label="Selo de desconto (opcional)"
        value={discountLabel}
        onChange={setDiscountLabel}
        placeholder="Ex: 20% OFF · Frete grátis · Leve 3 pague 2"
      />
      <Field
        label="Descrição (opcional)"
        value={description}
        onChange={setDescription}
        placeholder="Detalhes da promoção, regras, validade..."
        multiline
      />
      <Field
        label="Cupom (opcional)"
        value={couponCode}
        onChange={setCouponCode}
        placeholder="Ex: PETSOCIAL20"
        autoCapitalize="characters"
      />

      <SectionTitle title="Destino" />
      <Field
        label="Link *"
        value={ctaUrl}
        onChange={setCtaUrl}
        placeholder="https://loja.com.br/..."
        autoCapitalize="none"
        keyboardType="url"
      />
      <Field label="Texto do botão" value={ctaLabel} onChange={setCtaLabel} placeholder="Aproveitar" />
      <Field
        label="URL da imagem/logo (opcional)"
        value={imageUrl}
        onChange={setImageUrl}
        placeholder="https://..."
        autoCapitalize="none"
        keyboardType="url"
      />

      <SectionTitle title="Publicação" />
      <Field label="Válido até (dd/mm/aaaa, vazio = sem prazo)" value={validUntil} onChange={setValidUntil} placeholder="31/12/2026" />
      <Field label="Prioridade (maior aparece primeiro)" value={priority} onChange={setPriority} placeholder="0" keyboardType="numeric" />
      <Toggle label="Ativo (aparece pros usuários)" value={active} onChange={setActive} />
      <Field label="Notas internas (só admin)" value={notes} onChange={setNotes} placeholder="Contato, valor pago, período..." multiline />

      <Button title={submitLabel} onPress={handleSubmit} loading={submitting} fullWidth />
    </ScrollView>
  );
}

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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'url' | 'numeric';
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
    </View>
  );
}

function ChipRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.text }}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {options.map((opt) => {
          const isActive = value === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: isActive ? '#F97316' : '#FFEDD5',
              }}
            >
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: isActive ? '#FFFFFF' : '#9A3412' }}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
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
      <Text style={{ flex: 1, fontFamily: FONTS.body, fontSize: 13, color: theme.text }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: '#F97316', false: '#D4D4D8' }} thumbColor="#FFFFFF" />
    </View>
  );
}
