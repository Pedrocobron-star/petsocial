import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { FONTS } from '@/lib/fonts';
import type { PlaceAdminInput } from '@/lib/places-admin';
import type { Place, PlaceKind, PlaceSpecies } from '@/lib/types';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

const KINDS: { value: PlaceKind; label: string; emoji: string }[] = [
  { value: 'vet', label: 'Veterinário', emoji: '🩺' },
  { value: 'pet_shop', label: 'Pet Shop', emoji: '🛍️' },
  { value: 'grooming', label: 'Banho & Tosa', emoji: '🛁' },
  { value: 'hotel', label: 'Hotel', emoji: '🏨' },
  { value: 'daycare', label: 'Creche', emoji: '🐕' },
  { value: 'park', label: 'Parque', emoji: '🌳' },
  { value: 'restaurant', label: 'Restaurante', emoji: '🍽️' },
  { value: 'cafe', label: 'Café', emoji: '☕' },
  { value: 'event', label: 'Evento', emoji: '🎉' },
  { value: 'beach', label: 'Praia', emoji: '🏖️' },
  { value: 'training', label: 'Adestrador', emoji: '🎓' },
  { value: 'other', label: 'Outro', emoji: '📍' },
];

const SPECIES: { value: PlaceSpecies; label: string }[] = [
  { value: 'all', label: 'Pra todos 🐾' },
  { value: 'dog', label: 'Cães 🐶' },
  { value: 'cat', label: 'Gatos 🐱' },
  { value: 'other', label: 'Outras 🐰' },
];

export function PlaceForm({
  initial,
  submitLabel,
  onSubmit,
  submitting,
}: {
  initial?: Partial<Place>;
  submitLabel: string;
  onSubmit: (input: PlaceAdminInput) => Promise<void>;
  submitting?: boolean;
}) {
  const toast = useToast();

  const [name, setName] = useState(initial?.name ?? '');
  const [kind, setKind] = useState<PlaceKind>(initial?.kind ?? 'vet');
  const [species, setSpecies] = useState<PlaceSpecies>(initial?.species ?? 'all');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [stateUf, setStateUf] = useState(initial?.state ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [website, setWebsite] = useState(initial?.website ?? '');
  const [hours, setHours] = useState(initial?.hours ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [verified, setVerified] = useState(initial?.verified ?? true);

  const handleSubmit = async () => {
    if (name.trim().length < 2) {
      toast.error('Nome obrigatório');
      return;
    }
    if (address.trim().length < 3) {
      toast.error('Endereço obrigatório');
      return;
    }
    try {
      await onSubmit({
        name: name.trim(),
        kind,
        species,
        address: address.trim(),
        city: city.trim() || null,
        state: stateUf.trim() || null,
        phone: phone.trim() || null,
        website: website.trim() || null,
        hours: hours.trim() || null,
        description: description.trim() || null,
        verified,
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
      <SectionTitle title="Lugar" />
      <Field label="Nome *" value={name} onChange={setName} placeholder="Ex: Parque Villa-Lobos" />

      <ChipRow
        label="Categoria"
        options={KINDS.map((k) => ({ value: k.value, label: `${k.emoji} ${k.label}` }))}
        value={kind}
        onChange={(v) => setKind(v as PlaceKind)}
      />
      <ChipRow
        label="Atende"
        options={SPECIES.map((s) => ({ value: s.value, label: s.label }))}
        value={species}
        onChange={(v) => setSpecies(v as PlaceSpecies)}
      />

      <SectionTitle title="Endereço" />
      <Field label="Endereço *" value={address} onChange={setAddress} placeholder="Rua, número, bairro" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 2 }}>
          <Field label="Cidade" value={city ?? ''} onChange={setCity} placeholder="São Paulo" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="UF" value={stateUf ?? ''} onChange={setStateUf} placeholder="SP" autoCapitalize="characters" />
        </View>
      </View>

      <SectionTitle title="Contato (opcional)" />
      <Field label="Telefone" value={phone ?? ''} onChange={setPhone} placeholder="(11) 90000-0000" />
      <Field
        label="Website / Instagram"
        value={website ?? ''}
        onChange={setWebsite}
        placeholder="exemplo.com"
        autoCapitalize="none"
        keyboardType="url"
      />
      <Field label="Horário" value={hours ?? ''} onChange={setHours} placeholder="Seg-Sex 9h-18h" />
      <Field
        label="Descrição"
        value={description ?? ''}
        onChange={setDescription}
        placeholder="O que tem de especial pra pets?"
        multiline
      />

      <SectionTitle title="Publicação" />
      <Toggle label="Verificado ✓ (selo de curadoria)" value={verified} onChange={setVerified} />

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
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: active ? '#FFFFFF' : '#9A3412' }}>
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
