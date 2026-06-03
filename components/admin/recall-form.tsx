import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { FONTS } from '@/lib/fonts';
import {
  RECALL_CATEGORY_LABEL,
  RECALL_SEVERITY_LABEL,
  type Recall,
  type RecallCategory,
  type RecallInput,
  type RecallSeverity,
  type RecallSource,
} from '@/lib/recalls';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

/**
 * Formulário compartilhado de Recall (criar OU editar). Admin only.
 *
 * Campos: marca (matching), produto, título, descrição, lotes, severidade,
 * categoria, fonte, URL oficial, data, região, ativo, notas.
 */
export function RecallForm({
  initial,
  submitLabel,
  onSubmit,
  submitting,
}: {
  initial?: Partial<Recall>;
  submitLabel: string;
  onSubmit: (input: RecallInput) => Promise<void>;
  submitting?: boolean;
}) {
  const { theme } = useTheme();
  const toast = useToast();

  const [brand, setBrand] = useState(initial?.brand ?? '');
  const [productName, setProductName] = useState(initial?.product_name ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [affectedLots, setAffectedLots] = useState(initial?.affected_lots ?? '');
  const [severity, setSeverity] = useState<RecallSeverity>(initial?.severity ?? 'medium');
  const [category, setCategory] = useState<RecallCategory>(initial?.category ?? 'racao');
  const [source, setSource] = useState<RecallSource>(initial?.source ?? 'Fabricante');
  const [sourceUrl, setSourceUrl] = useState(initial?.source_url ?? '');
  const [region, setRegion] = useState(initial?.region ?? '');
  const [active, setActive] = useState(initial?.active ?? true);
  const [notes, setNotes] = useState(initial?.notes ?? '');

  const handleSubmit = async () => {
    if (!brand.trim()) {
      toast.error('Marca obrigatória', 'Usada pra cruzar com os produtos do tutor');
      return;
    }
    if (!title.trim() || !description.trim()) {
      toast.error('Título e descrição obrigatórios');
      return;
    }
    try {
      await onSubmit({
        brand: brand.trim(),
        product_name: productName.trim() || null,
        title: title.trim(),
        description: description.trim(),
        affected_lots: affectedLots.trim() || null,
        severity,
        category,
        source,
        source_url: sourceUrl.trim() || null,
        region: region.trim() || null,
        active,
        notes: notes.trim() || null,
      });
    } catch (e) {
      toast.error('Erro ao salvar', e instanceof Error ? e.message : 'Tente novamente');
    }
  };

  const severities: RecallSeverity[] = ['low', 'medium', 'high'];
  const categories: RecallCategory[] = [
    'racao',
    'petisco',
    'medicamento',
    'antipulga',
    'acessorio',
    'outro',
  ];
  const sources: RecallSource[] = ['Anvisa', 'MAPA', 'Fabricante', 'Imprensa', 'Comunidade'];

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 120 }}
      keyboardShouldPersistTaps="handled"
    >
      <SectionTitle title="Produto afetado" />
      <Field
        label="Marca * (usada pra cruzar com tutores)"
        value={brand}
        onChange={setBrand}
        placeholder="Ex: Golden, Drontal, Premier"
      />
      <Field
        label="Produto específico (opcional)"
        value={productName ?? ''}
        onChange={setProductName}
        placeholder="Ex: Golden Formula Frango Adulto"
      />

      <SectionTitle title="Classificação" />
      <ChipRow
        label="Severidade"
        options={severities.map((s) => ({ value: s, label: RECALL_SEVERITY_LABEL[s] }))}
        value={severity}
        onChange={(v) => setSeverity(v as RecallSeverity)}
      />
      <ChipRow
        label="Categoria"
        options={categories.map((c) => ({ value: c, label: RECALL_CATEGORY_LABEL[c] }))}
        value={category}
        onChange={(v) => setCategory(v as RecallCategory)}
      />

      <SectionTitle title="Comunicado" />
      <Field
        label="Título *"
        value={title}
        onChange={setTitle}
        placeholder="Ex: Recall: Ração Golden lote 2025-A"
      />
      <Field
        label="Descrição * (o que houve + o que o tutor deve fazer)"
        value={description}
        onChange={setDescription}
        placeholder="Ex: Identificada contaminação por... Pare de oferecer e troque na loja onde comprou."
        multiline
      />
      <Field
        label="Lotes afetados (opcional)"
        value={affectedLots ?? ''}
        onChange={setAffectedLots}
        placeholder="Ex: Lotes 2025A, 2025B · Validade 03/2026"
        multiline
      />

      <SectionTitle title="Procedência" />
      <ChipRow
        label="Fonte"
        options={sources.map((s) => ({ value: s, label: s }))}
        value={source}
        onChange={(v) => setSource(v as RecallSource)}
      />
      <Field
        label="URL oficial (opcional)"
        value={sourceUrl ?? ''}
        onChange={setSourceUrl}
        placeholder="https://anvisa.gov.br/..."
        autoCapitalize="none"
        keyboardType="url"
      />
      <Field
        label="Região afetada (vazio = nacional)"
        value={region ?? ''}
        onChange={setRegion}
        placeholder="Ex: SP, Centro-Oeste"
      />

      <SectionTitle title="Publicação" />
      <Toggle label="Ativo (aparece pros tutores)" value={active} onChange={setActive} />
      <Field
        label="Notas internas (só admin)"
        value={notes ?? ''}
        onChange={setNotes}
        placeholder="Fonte original, contato, etc"
        multiline
      />

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
  keyboardType?: 'default' | 'url';
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
          const active = value === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: active ? '#F97316' : '#FFEDD5',
              }}
            >
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 12,
                  color: active ? '#FFFFFF' : '#9A3412',
                }}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
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
        trackColor={{ true: '#F97316', false: '#D4D4D8' }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}
