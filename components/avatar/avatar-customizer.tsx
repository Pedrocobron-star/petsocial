import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { PressScale } from '@/components/ui/press-scale';
import { FONTS } from '@/lib/fonts';
import {
  ACCENT_COLORS,
  ACCESSORY_OPTIONS,
  BACKGROUND_COLORS,
  BACKGROUND_SCENE_OPTIONS,
  CHEST_OPTIONS,
  COLLAR_CHARM_OPTIONS,
  COLLAR_OPTIONS,
  defaultConfigForSpecies,
  EARS_OPTIONS,
  EYE_COLORS,
  EYES_OPTIONS,
  FUR_COLORS,
  HAIR_ACCENT_OPTIONS,
  HEAD_SHAPE_OPTIONS,
  MOUTH_OPTIONS,
  NOSE_COLORS,
  PATTERN_OPTIONS,
  SIZE_MOD_OPTIONS,
  SPECIES_OPTIONS,
  TAIL_OPTIONS,
} from '@/lib/pet-avatar-config';
import type {
  AvatarAccessory,
  AvatarBackgroundScene,
  AvatarChest,
  AvatarCollar,
  AvatarCollarCharm,
  AvatarEars,
  AvatarEyes,
  AvatarHairAccent,
  AvatarHeadShape,
  AvatarMouth,
  AvatarPattern,
  AvatarSizeMod,
  AvatarSpecies,
  AvatarTail,
  PetAvatarConfig,
} from '@/lib/types';
import { useTheme } from '@/providers/theme-provider';

import { PetAvatarSvg } from './pet-avatar-svg';

interface Props {
  config: PetAvatarConfig;
  onChange: (next: PetAvatarConfig) => void;
}

type Tab =
  | 'species'
  | 'size'
  | 'head'
  | 'ears'
  | 'eyes'
  | 'mouth'
  | 'pattern'
  | 'hair'
  | 'chest'
  | 'tail'
  | 'colors'
  | 'accessory'
  | 'collar'
  | 'charm'
  | 'background';

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: 'species', label: 'Espécie', emoji: '🐾' },
  { id: 'size', label: 'Tamanho', emoji: '📏' },
  { id: 'head', label: 'Cabeça', emoji: '🟠' },
  { id: 'ears', label: 'Orelhas', emoji: '👂' },
  { id: 'eyes', label: 'Olhos', emoji: '👀' },
  { id: 'mouth', label: 'Boca', emoji: '😊' },
  { id: 'pattern', label: 'Padrão', emoji: '🎨' },
  { id: 'hair', label: 'Cabelo', emoji: '💇' },
  { id: 'chest', label: 'Peito', emoji: '🦺' },
  { id: 'tail', label: 'Rabo', emoji: '🐕' },
  { id: 'colors', label: 'Cores', emoji: '🌈' },
  { id: 'collar', label: 'Coleira', emoji: '🎀' },
  { id: 'charm', label: 'Pingente', emoji: '🔔' },
  { id: 'accessory', label: 'Acessório', emoji: '🎩' },
  { id: 'background', label: 'Fundo', emoji: '⬜' },
];

/**
 * Editor visual do avatar customizado. Preview grande no topo + tabs
 * horizontais + grid de opções de cada tab. Cada mudança atualiza em
 * tempo real o preview via prop onChange.
 */
export function AvatarCustomizer({ config, onChange }: Props) {
  const { theme } = useTheme();
  const [tab, setTab] = useState<Tab>('species');

  const patch = (p: Partial<PetAvatarConfig>) => onChange({ ...config, ...p });

  return (
    <View style={{ gap: 14 }}>
      {/* PREVIEW grande — quando há cenário, deixa o SVG renderizar próprio fundo */}
      <View
        style={{
          alignItems: 'center',
          backgroundColor: config.background_scene ? 'transparent' : config.background_color,
          borderRadius: 20,
          paddingVertical: 24,
          paddingHorizontal: 20,
          borderWidth: 2,
          borderColor: theme.borderLight,
          overflow: 'hidden',
        }}
      >
        <PetAvatarSvg
          config={config}
          size={200}
          showBackground={!!config.background_scene}
          breathing
        />
      </View>

      {/* Tabs — wrap em múltiplas linhas pra todas as 15 categorias caberem
          sem scroll horizontal (que era confuso no web sem indicator) */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 6,
          paddingHorizontal: 4,
          justifyContent: 'center',
        }}
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <PressScale
              key={t.id}
              onPress={() => setTab(t.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: active ? theme.brand : theme.borderLight,
              }}
            >
              <Text style={{ fontSize: 12 }}>{t.emoji}</Text>
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 12,
                  color: active ? '#fff' : theme.textMuted,
                }}
              >
                {t.label}
              </Text>
            </PressScale>
          );
        })}
      </View>

      {/* Conteúdo da tab */}
      <View style={{ minHeight: 200 }}>
        {tab === 'species' ? (
          <OptionGrid
            options={SPECIES_OPTIONS}
            value={config.species}
            onSelect={(v) => {
              // Mudar espécie aplica os defaults daquela espécie (ears, head_shape, etc),
              // mas preserva cores e acessórios customizados pelo usuário.
              const defaults = defaultConfigForSpecies(v as AvatarSpecies);
              onChange({
                ...defaults,
                fur_color: config.fur_color,
                accent_color: config.accent_color,
                eye_color: config.eye_color,
                nose_color: config.nose_color,
                background_color: config.background_color,
                collar: config.collar,
                accessory: config.accessory,
              });
            }}
            renderPreview={(opt) => {
              const defaults = defaultConfigForSpecies(opt.value as AvatarSpecies);
              return (
                <PetAvatarSvg
                  config={{
                    ...defaults,
                    fur_color: config.fur_color,
                    accent_color: config.accent_color,
                    eye_color: config.eye_color,
                    nose_color: config.nose_color,
                    collar: config.collar,
                    accessory: config.accessory,
                  }}
                  size={56}
                  showBackground={false}
                  idleBlink={false}
                />
              );
            }}
          />
        ) : null}

        {tab === 'head' ? (
          <OptionGrid
            options={HEAD_SHAPE_OPTIONS}
            value={config.head_shape}
            onSelect={(v) => patch({ head_shape: v as AvatarHeadShape })}
            renderPreview={(opt) => (
              <PetAvatarSvg
                config={{ ...config, head_shape: opt.value as AvatarHeadShape }}
                size={56}
                showBackground={false}
                idleBlink={false}
              />
            )}
          />
        ) : null}

        {tab === 'ears' ? (
          <OptionGrid
            options={EARS_OPTIONS}
            value={config.ears}
            onSelect={(v) => patch({ ears: v as AvatarEars })}
            renderPreview={(opt) => (
              <PetAvatarSvg
                config={{ ...config, ears: opt.value as AvatarEars }}
                size={56}
                showBackground={false}
                idleBlink={false}
              />
            )}
          />
        ) : null}

        {tab === 'eyes' ? (
          <OptionGrid
            options={EYES_OPTIONS}
            value={config.eyes}
            onSelect={(v) => patch({ eyes: v as AvatarEyes })}
            renderPreview={(opt) => (
              <PetAvatarSvg
                config={{ ...config, eyes: opt.value as AvatarEyes }}
                size={56}
                showBackground={false}
                idleBlink={false}
              />
            )}
          />
        ) : null}

        {tab === 'mouth' ? (
          <OptionGrid
            options={MOUTH_OPTIONS}
            value={config.mouth}
            onSelect={(v) => patch({ mouth: v as AvatarMouth })}
            renderPreview={(opt) => (
              <PetAvatarSvg
                config={{ ...config, mouth: opt.value as AvatarMouth }}
                size={56}
                showBackground={false}
                idleBlink={false}
              />
            )}
          />
        ) : null}

        {tab === 'pattern' ? (
          <OptionGrid
            options={PATTERN_OPTIONS}
            value={config.pattern}
            onSelect={(v) => patch({ pattern: v as AvatarPattern })}
            renderPreview={(opt) => (
              <PetAvatarSvg
                config={{ ...config, pattern: opt.value as AvatarPattern }}
                size={56}
                showBackground={false}
                idleBlink={false}
              />
            )}
          />
        ) : null}

        {tab === 'hair' ? (
          <OptionGrid
            options={HAIR_ACCENT_OPTIONS}
            value={config.hair_accent ?? 'none'}
            onSelect={(v) =>
              patch({
                hair_accent:
                  v === 'none' ? undefined : (v as AvatarHairAccent),
              })
            }
            renderPreview={(opt) => (
              <PetAvatarSvg
                config={{
                  ...config,
                  hair_accent:
                    opt.value === 'none'
                      ? undefined
                      : (opt.value as AvatarHairAccent),
                }}
                size={56}
                showBackground={false}
                idleBlink={false}
              />
            )}
          />
        ) : null}

        {tab === 'chest' ? (
          <OptionGrid
            options={CHEST_OPTIONS}
            value={config.chest ?? 'solid'}
            onSelect={(v) => patch({ chest: v as AvatarChest })}
            renderPreview={(opt) => (
              <PetAvatarSvg
                config={{ ...config, chest: opt.value as AvatarChest }}
                size={56}
                showBackground={false}
                idleBlink={false}
              />
            )}
          />
        ) : null}

        {tab === 'tail' ? (
          <OptionGrid
            options={TAIL_OPTIONS}
            value={config.tail ?? 'none'}
            onSelect={(v) => patch({ tail: v as AvatarTail })}
            renderPreview={(opt) => (
              <PetAvatarSvg
                config={{ ...config, tail: opt.value as AvatarTail }}
                size={56}
                showBackground={false}
                idleBlink={false}
              />
            )}
          />
        ) : null}

        {tab === 'size' ? (
          <SizeRow
            value={config.size_mod ?? 1.0}
            onSelect={(v) => patch({ size_mod: v })}
            config={config}
          />
        ) : null}

        {tab === 'collar' ? (
          <OptionGrid
            options={COLLAR_OPTIONS}
            value={config.collar}
            onSelect={(v) => patch({ collar: v as AvatarCollar })}
            renderPreview={(opt) => (
              <PetAvatarSvg
                config={{ ...config, collar: opt.value as AvatarCollar }}
                size={56}
                showBackground={false}
                idleBlink={false}
              />
            )}
          />
        ) : null}

        {tab === 'charm' ? (
          config.collar === 'none' ? (
            <View style={{ paddingVertical: 28, alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 28 }}>🎀</Text>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text }}>
                Escolhe uma coleira primeiro
              </Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim, textAlign: 'center', paddingHorizontal: 20 }}>
                O pingente fica pendurado na coleira. Vai na tab &quot;Coleira&quot; e escolhe uma cor.
              </Text>
            </View>
          ) : (
            <OptionGrid
              options={COLLAR_CHARM_OPTIONS}
              value={config.collar_charm ?? 'none'}
              onSelect={(v) => patch({ collar_charm: v as AvatarCollarCharm })}
              renderPreview={(opt) => (
                <PetAvatarSvg
                  config={{ ...config, collar_charm: opt.value as AvatarCollarCharm }}
                  size={56}
                  showBackground={false}
                  idleBlink={false}
                />
              )}
            />
          )
        ) : null}

        {tab === 'accessory' ? (
          <OptionGrid
            options={ACCESSORY_OPTIONS}
            value={config.accessory}
            onSelect={(v) => patch({ accessory: v as AvatarAccessory })}
            renderPreview={(opt) => (
              <PetAvatarSvg
                config={{ ...config, accessory: opt.value as AvatarAccessory }}
                size={56}
                showBackground={false}
                idleBlink={false}
              />
            )}
          />
        ) : null}

        {tab === 'colors' ? (
          <ColorTab config={config} onChange={onChange} />
        ) : null}

        {tab === 'background' ? (
          <View style={{ gap: 14 }}>
            {/* Cenários (Pro) */}
            <View>
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 11,
                  letterSpacing: 1,
                  color: theme.textDim,
                  textTransform: 'uppercase',
                  marginBottom: 6,
                  marginLeft: 2,
                }}
              >
                Cenário
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {BACKGROUND_SCENE_OPTIONS.map((opt) => {
                  const isActive =
                    opt.value === 'none'
                      ? !config.background_scene
                      : config.background_scene === opt.value;
                  return (
                    <PressScale
                      key={opt.value}
                      onPress={() =>
                        patch({
                          background_scene:
                            opt.value === 'none'
                              ? undefined
                              : (opt.value as AvatarBackgroundScene),
                        })
                      }
                      style={{
                        width: '23%',
                        alignItems: 'center',
                        gap: 4,
                        padding: 6,
                        borderRadius: 14,
                        backgroundColor: isActive ? theme.brandSurface : theme.borderLight,
                        borderWidth: 2,
                        borderColor: isActive ? theme.brand : 'transparent',
                      }}
                    >
                      <View
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 26,
                          overflow: 'hidden',
                          backgroundColor: theme.surface,
                        }}
                      >
                        <PetAvatarSvg
                          config={{
                            ...config,
                            background_scene:
                              opt.value === 'none'
                                ? undefined
                                : (opt.value as AvatarBackgroundScene),
                          }}
                          size={52}
                          idleBlink={false}
                        />
                      </View>
                      <Text style={{ fontSize: 11 }}>{opt.emoji}</Text>
                      <Text
                        style={{
                          fontFamily: FONTS.bodyBold,
                          fontSize: 9,
                          color: isActive ? theme.brandDark : theme.textDim,
                          textAlign: 'center',
                        }}
                        numberOfLines={1}
                      >
                        {opt.label}
                      </Text>
                    </PressScale>
                  );
                })}
              </View>
            </View>

            {/* Cores sólidas (fallback se nenhum cenário) */}
            {!config.background_scene ? (
              <ColorRow
                label="Cor sólida"
                colors={BACKGROUND_COLORS}
                value={config.background_color}
                onSelect={(c) => patch({ background_color: c })}
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ============================================================================
// Grid de opções com mini-preview
// ============================================================================

function OptionGrid<T extends string>({
  options,
  value,
  onSelect,
  renderPreview,
}: {
  options: { value: T; label: string }[];
  value: T;
  onSelect: (v: T) => void;
  renderPreview?: (opt: { value: T; label: string }) => React.ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'flex-start',
      }}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <PressScale
            key={opt.value}
            onPress={() => onSelect(opt.value)}
            style={{
              width: '23%',
              alignItems: 'center',
              gap: 4,
              padding: 6,
              borderRadius: 14,
              backgroundColor: active ? theme.brandSurface : theme.borderLight,
              borderWidth: 2,
              borderColor: active ? theme.brand : 'transparent',
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                overflow: 'hidden',
                backgroundColor: theme.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {renderPreview ? renderPreview(opt) : null}
            </View>
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 9,
                color: active ? theme.brandDark : theme.textDim,
                textAlign: 'center',
                lineHeight: 11,
              }}
              numberOfLines={2}
            >
              {opt.label}
            </Text>
            {active ? (
              <Ionicons
                name="checkmark-circle"
                size={14}
                color={theme.brand}
                style={{ position: 'absolute', top: 2, right: 2 }}
              />
            ) : null}
          </PressScale>
        );
      })}
    </View>
  );
}

// ============================================================================
// Color tab — fur, accent, eye, nose em sequência
// ============================================================================

function ColorTab({
  config,
  onChange,
}: {
  config: PetAvatarConfig;
  onChange: (next: PetAvatarConfig) => void;
}) {
  const { theme } = useTheme();
  const heteroActive = !!config.eye_color_right;

  return (
    <View style={{ gap: 14 }}>
      <ColorRow
        label="Pelagem principal"
        colors={FUR_COLORS}
        value={config.fur_color}
        onSelect={(c) => onChange({ ...config, fur_color: c })}
      />
      <ColorRow
        label="Padrão / acento"
        colors={ACCENT_COLORS}
        value={config.accent_color}
        onSelect={(c) => onChange({ ...config, accent_color: c })}
      />
      <ColorRow
        label={heteroActive ? 'Olho esquerdo' : 'Olhos'}
        colors={EYE_COLORS}
        value={config.eye_color}
        onSelect={(c) => onChange({ ...config, eye_color: c })}
      />

      {/* Toggle heterocromia */}
      <PressScale
        onPress={() => {
          if (heteroActive) {
            // Desativa: remove eye_color_right
            const next = { ...config };
            delete next.eye_color_right;
            onChange(next);
          } else {
            // Ativa: começa com cor azul no direito pra dar contraste
            onChange({ ...config, eye_color_right: '#3B82F6' });
          }
        }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingVertical: 8,
          paddingHorizontal: 10,
          backgroundColor: heteroActive ? theme.brandSurface : theme.borderLight,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: heteroActive ? theme.brand : 'transparent',
        }}
      >
        <Ionicons
          name={heteroActive ? 'checkbox' : 'square-outline'}
          size={18}
          color={heteroActive ? theme.brand : theme.textMuted}
        />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 13,
              color: heteroActive ? theme.brandDark : theme.text,
            }}
          >
            Olhos de cores diferentes
          </Text>
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 11,
              color: theme.textDim,
            }}
          >
            Heterocromia — comum em Husky, Aussie, alguns gatos.
          </Text>
        </View>
      </PressScale>

      {heteroActive ? (
        <ColorRow
          label="Olho direito"
          colors={EYE_COLORS}
          value={config.eye_color_right ?? config.eye_color}
          onSelect={(c) => onChange({ ...config, eye_color_right: c })}
        />
      ) : null}

      <ColorRow
        label="Focinho"
        colors={NOSE_COLORS}
        value={config.nose_color}
        onSelect={(c) => onChange({ ...config, nose_color: c })}
      />
    </View>
  );
}

function ColorRow({
  label,
  colors,
  value,
  onSelect,
}: {
  label: string;
  colors: string[];
  value: string;
  onSelect: (color: string) => void;
}) {
  const { theme } = useTheme();
  return (
    <View>
      <Text
        style={{
          fontFamily: FONTS.bodyBold,
          fontSize: 11,
          letterSpacing: 1,
          color: theme.textDim,
          textTransform: 'uppercase',
          marginBottom: 6,
          marginLeft: 2,
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {colors.map((c) => {
          const active = c.toLowerCase() === value.toLowerCase();
          return (
            <PressScale
              key={c}
              onPress={() => onSelect(c)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: c,
                borderWidth: active ? 3 : 1,
                borderColor: active ? theme.brand : theme.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {active ? (
                <Ionicons
                  name="checkmark"
                  size={16}
                  color={isLight(c) ? '#1A1410' : '#fff'}
                />
              ) : null}
            </PressScale>
          );
        })}
        <HexInput value={value} onSelect={onSelect} />
      </View>
    </View>
  );
}

// ============================================================================
// HEX input — Pro: pet com cor totalmente customizada
// ============================================================================

const HEX_RE = /^#([0-9a-fA-F]{6})$/;

function HexInput({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (color: string) => void;
}) {
  const { theme } = useTheme();
  // Estado local pra não atualizar a cada keystroke (espera HEX válido completo)
  const [draft, setDraft] = useState<string>(value);
  const [focused, setFocused] = useState(false);

  // Sincronizar quando o value externo muda (ex: trocou de preset)
  const isCustom = useMemo(() => {
    // Heurística: se value não bate com nenhuma das paletas mostradas, é custom.
    // Conservador: sempre permite reescrever pelo input.
    return HEX_RE.test(value);
  }, [value]);

  const handleChange = (text: string) => {
    // Adiciona # se user digitou sem
    let v = text.trim();
    if (v.length > 0 && !v.startsWith('#')) v = '#' + v;
    v = v.slice(0, 7).toUpperCase();
    setDraft(v);
    if (HEX_RE.test(v)) {
      onSelect(v);
    }
  };

  const displayValue = focused ? draft : value;
  const valid = HEX_RE.test(displayValue);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        height: 36,
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: focused ? theme.brand : theme.border,
        backgroundColor: theme.surface,
      }}
    >
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: valid ? displayValue : theme.borderLight,
          borderWidth: 1,
          borderColor: theme.border,
        }}
      />
      <TextInput
        value={displayValue}
        onChangeText={handleChange}
        onFocus={() => {
          setDraft(value);
          setFocused(true);
        }}
        onBlur={() => setFocused(false)}
        placeholder="#HEX"
        placeholderTextColor={theme.textDim}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={7}
        style={{
          width: 64,
          fontFamily: FONTS.body,
          fontSize: 11,
          color: theme.text,
          paddingVertical: 0,
        }}
      />
    </View>
  );
}

function isLight(hex: string): boolean {
  const h = hex.replace('#', '');
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Luminância YIQ
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq > 150;
}

// ============================================================================
// Size row — 5 botões com preview do mesmo pet em tamanhos diferentes
// ============================================================================

function SizeRow({
  value,
  onSelect,
  config,
}: {
  value: AvatarSizeMod;
  onSelect: (v: AvatarSizeMod) => void;
  config: PetAvatarConfig;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: 10 }}>
      <Text
        style={{
          fontFamily: FONTS.body,
          fontSize: 12,
          color: theme.textDim,
          marginLeft: 4,
        }}
      >
        Compare o tamanho relativo entre pets — útil pra Chihuahua mini vs Rottweiler gigante.
      </Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {SIZE_MOD_OPTIONS.map((opt) => {
          const active = Math.abs(opt.value - value) < 0.001;
          return (
            <PressScale
              key={opt.value}
              onPress={() => onSelect(opt.value)}
              style={{
                flex: 1,
                alignItems: 'center',
                gap: 4,
                paddingVertical: 10,
                paddingHorizontal: 4,
                borderRadius: 14,
                backgroundColor: active ? theme.brandSurface : theme.borderLight,
                borderWidth: 2,
                borderColor: active ? theme.brand : 'transparent',
              }}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  overflow: 'hidden',
                  backgroundColor: theme.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <PetAvatarSvg
                  config={{ ...config, size_mod: opt.value }}
                  size={52}
                  showBackground={false}
                  idleBlink={false}
                />
              </View>
              <Text style={{ fontSize: 14 }}>{opt.emoji}</Text>
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 10,
                  color: active ? theme.brandDark : theme.textDim,
                  textAlign: 'center',
                }}
                numberOfLines={1}
              >
                {opt.label}
              </Text>
            </PressScale>
          );
        })}
      </View>
    </View>
  );
}
