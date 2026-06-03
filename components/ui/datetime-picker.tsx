import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

interface Props {
  label?: string;
  value: Date | null;
  onChange: (date: Date) => void;
  error?: string;
  minimumDate?: Date;
}

export function DateTimePickerInput({ label, value, onChange, error, minimumDate }: Props) {
  if (Platform.OS === 'web') {
    return <WebPicker label={label} value={value} onChange={onChange} error={error} minimumDate={minimumDate} />;
  }
  return <NativePicker label={label} value={value} onChange={onChange} error={error} minimumDate={minimumDate} />;
}

function WebPicker({ label, value, onChange, error, minimumDate }: Props) {
  const toLocalInput = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const min = minimumDate ? toLocalInput(minimumDate) : undefined;
  return (
    <View className="w-full">
      {label ? <Text className="mb-1.5 text-sm font-medium text-neutral-700">{label}</Text> : null}
      <input
        type="datetime-local"
        value={value ? toLocalInput(value) : ''}
        min={min}
        onChange={(e: { target: { value: string } }) => {
          const v = e.target.value;
          if (!v) return;
          onChange(new Date(v));
        }}
        style={{
          borderWidth: 1,
          borderColor: error ? '#ef4444' : '#d4d4d4',
          backgroundColor: '#fff',
          borderRadius: 12,
          paddingTop: 12,
          paddingBottom: 12,
          paddingLeft: 16,
          paddingRight: 16,
          fontSize: 16,
          color: '#111',
        }}
      />
      {error ? <Text className="mt-1 text-xs text-red-600">{error}</Text> : null}
    </View>
  );
}

function NativePicker({ label, value, onChange, error, minimumDate }: Props) {
  const [mode, setMode] = useState<'none' | 'date' | 'time'>('none');
  const [draft, setDraft] = useState<Date>(value ?? new Date(Date.now() + 60 * 60 * 1000));

  const openPicker = () => setMode('date');

  return (
    <View className="w-full">
      {label ? <Text className="mb-1.5 text-sm font-medium text-neutral-700">{label}</Text> : null}
      <Pressable
        onPress={openPicker}
        className={`flex-row items-center justify-between rounded-xl border bg-white px-4 py-3 ${
          error ? 'border-red-500' : 'border-neutral-300'
        }`}
      >
        <Text className={value ? 'text-base text-neutral-900' : 'text-base text-neutral-400'}>
          {value
            ? format(value, "EEE, dd 'de' MMM 'às' HH:mm", { locale: ptBR })
            : 'Toque pra escolher data e hora'}
        </Text>
        <Ionicons name="calendar-outline" size={20} color="#737373" />
      </Pressable>
      {error ? <Text className="mt-1 text-xs text-red-600">{error}</Text> : null}

      {mode === 'date' ? (
        <DateTimePicker
          value={draft}
          mode="date"
          minimumDate={minimumDate}
          onChange={(_, selected) => {
            if (!selected) {
              setMode('none');
              return;
            }
            const merged = new Date(draft);
            merged.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
            setDraft(merged);
            setMode('time');
          }}
        />
      ) : null}

      {mode === 'time' ? (
        <DateTimePicker
          value={draft}
          mode="time"
          onChange={(_, selected) => {
            setMode('none');
            if (!selected) return;
            const merged = new Date(draft);
            merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
            setDraft(merged);
            onChange(merged);
          }}
        />
      ) : null}
    </View>
  );
}
