import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AvatarCustomizer } from '@/components/avatar/avatar-customizer';
import { AvatarShareButton } from '@/components/avatar/avatar-share-button';
import { PetAvatarSvg } from '@/components/avatar/pet-avatar-svg';
import { PremiumBadge } from '@/components/premium-badge';
import { Button } from '@/components/ui/button';
import { CenteredColumn } from '@/components/ui/centered-column';
import { PressScale } from '@/components/ui/press-scale';
import { UpgradeModal } from '@/components/upgrade-modal';
import { FONTS } from '@/lib/fonts';
import {
  AVATAR_PRESETS,
  defaultConfigForSpecies,
  resolveAvatarConfig,
} from '@/lib/pet-avatar-config';
import {
  trackAvatarCustomizeIntent,
  trackAvatarSaved,
  trackTrialStarted,
} from '@/lib/analytics';
import {
  formatTrialRemaining,
  getTrialState,
  startTrial,
  type TrialState,
} from '@/lib/avatar-trial';
import { fetchPet, qk, updatePet } from '@/lib/queries';
import type { AvatarSpecies, PetAvatarConfig, Species } from '@/lib/types';
import { useSession } from '@/providers/session-provider';
import { useIsPro } from '@/providers/subscription-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

/** Mapeia Species (do banco) para AvatarSpecies (subset suportado pelo avatar). */
function toAvatarSpecies(s: Species | undefined | null): AvatarSpecies {
  if (s === 'dog' || s === 'cat' || s === 'rabbit' || s === 'bird' || s === 'fish') {
    return s;
  }
  return 'other';
}

type Mode = 'presets' | 'customize';

export default function AvatarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const { theme } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const qc = useQueryClient();
  const isPro = useIsPro();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [trial, setTrial] = useState<TrialState | null>(null);
  // Pode customizar se Pro OU trial ativo
  const canCustomize = isPro || (trial?.active ?? false);

  const petQuery = useQuery({
    queryKey: qk.pet(id),
    queryFn: () => fetchPet(id),
    enabled: !!id,
  });

  const pet = petQuery.data;
  const isOwner = pet?.owner_id === session?.user.id;

  // Estado local do avatar. Inicia como null e é hidratado apenas UMA VEZ
  // quando o pet termina de carregar (evita reinicializar sobre edições do usuário).
  const [config, setConfig] = useState<PetAvatarConfig | null>(null);
  const [mode, setMode] = useState<Mode>('presets');

  useEffect(() => {
    if (pet && config === null) {
      setConfig(
        resolveAvatarConfig(pet.avatar_config, toAvatarSpecies(pet.species)),
      );
    }
  }, [pet, config]);

  // Carrega estado do trial 7 dias
  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;
    getTrialState(userId).then(setTrial);
  }, [session?.user.id]);

  // Safety: se não pode customizar, força volta pra presets (deep link, etc).
  useEffect(() => {
    if (mode === 'customize' && !canCustomize) {
      setMode('presets');
    }
  }, [mode, canCustomize]);

  // Quando free clica "Customizar": se nunca usou trial, oferece; senão paywall.
  const handleCustomizeClick = async () => {
    if (canCustomize) {
      trackAvatarCustomizeIntent({
        pet_id: id,
        outcome: isPro ? 'already-pro' : 'trial-active',
      });
      setMode('customize');
      return;
    }
    const userId = session?.user.id;
    if (!userId) {
      trackAvatarCustomizeIntent({ pet_id: id, outcome: 'upgrade-modal' });
      setShowUpgrade(true);
      return;
    }
    // Nunca usou trial → começa
    if (!trial?.used) {
      const next = await startTrial(userId);
      setTrial(next);
      setMode('customize');
      trackAvatarCustomizeIntent({ pet_id: id, outcome: 'trial-started' });
      trackTrialStarted({ feature: 'avatar' });
      toast.success('Trial ativado!', '7 dias grátis pra customizar à vontade ✨');
      return;
    }
    // Trial já usado (ativo ou expirado) e não é Pro → paywall
    trackAvatarCustomizeIntent({ pet_id: id, outcome: 'upgrade-modal' });
    setShowUpgrade(true);
  };

  const saveMutation = useMutation({
    mutationFn: (next: PetAvatarConfig) =>
      updatePet(id, { avatar_config: next }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.pet(id) });
      qc.invalidateQueries({ queryKey: qk.myPets(session!.user.id) });
      toast.success('Avatar atualizado!', 'Ficou um charme ✨');
      router.back();
    },
    onError: (e) => Alert.alert('Erro ao salvar', e instanceof Error ? e.message : ''),
  });

  const handleSave = () => {
    if (!config) return;
    // Detecta uso de features Pro pra segmentar conversão
    const usedProFeatures = !!(
      config.collar_charm ||
      config.background_scene ||
      config.hair_accent ||
      config.eye_color_right
    );
    trackAvatarSaved({
      pet_id: id,
      source: mode === 'customize' ? 'customize' : 'preset',
      used_pro_features: usedProFeatures,
    });
    saveMutation.mutate(config);
  };

  const handleReset = () => {
    Alert.alert(
      'Resetar avatar?',
      'Volta pro padrão da espécie. Você pode customizar depois.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Resetar',
          style: 'destructive',
          onPress: () => setConfig(defaultConfigForSpecies(toAvatarSpecies(pet?.species))),
        },
      ],
    );
  };

  if (!pet || !config) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Stack.Screen options={{ title: 'Avatar' }} />
        <Text style={{ fontFamily: FONTS.body, color: theme.textDim }}>Carregando...</Text>
      </View>
    );
  }

  if (!isOwner) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <Stack.Screen options={{ title: `Avatar · ${pet.name}` }} />
        <CenteredColumn maxWidth={420}>
          <View style={{ padding: 20, alignItems: 'center', gap: 16 }}>
            <PetAvatarSvg config={pet.avatar_config} size={220} breathing />
            <Text
              style={{
                fontFamily: FONTS.display,
                fontSize: 22,
                color: theme.text,
                textAlign: 'center',
              }}
            >
              Avatar de {pet.name}
            </Text>
            <Text
              style={{
                fontFamily: FONTS.body,
                fontSize: 13,
                color: theme.textDim,
                textAlign: 'center',
              }}
            >
              Só o tutor pode customizar.
            </Text>
          </View>
        </CenteredColumn>
      </View>
    );
  }

  const presetsForSpecies = AVATAR_PRESETS.filter(
    (p) => p.config.species === config.species,
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen
        options={{
          title: `Avatar · ${pet.name}`,
          headerRight: () => (
            <Pressable onPress={handleReset} hitSlop={10}>
              <Ionicons name="refresh" size={20} color={theme.text} />
            </Pressable>
          ),
        }}
      />

      <ScrollView contentContainerStyle={{ paddingVertical: 12, paddingBottom: 120 }}>
        <CenteredColumn maxWidth={540}>
          {/* Toggle Presets / Customizar */}
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: theme.borderLight,
              borderRadius: 12,
              padding: 3,
              gap: 2,
              marginBottom: 14,
            }}
          >
            <PressScale
              onPress={() => setMode('presets')}
              style={{
                flex: 1,
                paddingVertical: 9,
                borderRadius: 9,
                backgroundColor: mode === 'presets' ? theme.surface : 'transparent',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
              }}
            >
              <Ionicons
                name="apps"
                size={14}
                color={mode === 'presets' ? theme.brand : theme.textDim}
              />
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 12,
                  color: mode === 'presets' ? theme.brand : theme.textDim,
                }}
              >
                Presets prontos
              </Text>
            </PressScale>
            <PressScale
              onPress={handleCustomizeClick}
              style={{
                flex: 1,
                paddingVertical: 9,
                borderRadius: 9,
                backgroundColor: mode === 'customize' ? theme.surface : 'transparent',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
              }}
            >
              <Ionicons
                name="color-palette"
                size={14}
                color={mode === 'customize' ? theme.brand : theme.textDim}
              />
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 12,
                  color: mode === 'customize' ? theme.brand : theme.textDim,
                }}
              >
                Customizar
              </Text>
              {!canCustomize ? <PremiumBadge size={12} /> : null}
            </PressScale>
          </View>

          {mode === 'presets' ? (
            <Animated.View entering={FadeIn.duration(200)}>
              <PresetsList
                config={config}
                onSelect={(c) => setConfig(c)}
                onEnterCustomize={handleCustomizeClick}
                isPro={canCustomize}
              />
            </Animated.View>
          ) : (
            <Animated.View entering={FadeIn.duration(200)}>
              <AvatarCustomizer config={config} onChange={setConfig} />
            </Animated.View>
          )}

          {/* Banner trial ativo */}
          {!isPro && trial?.active ? (
            <View
              style={{
                marginTop: 14,
                padding: 10,
                backgroundColor: '#FEF3C7',
                borderRadius: 10,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                borderWidth: 1,
                borderColor: '#FBBF24',
              }}
            >
              <Text style={{ fontSize: 14 }}>⏳</Text>
              <Text
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 11,
                  color: '#7C2D12',
                  flex: 1,
                }}
              >
                Trial Pet Pro:{' '}
                <Text style={{ fontFamily: FONTS.bodyBold }}>
                  {formatTrialRemaining(trial.msRemaining)} restante{trial.msRemaining > 24 * 60 * 60 * 1000 ? 's' : ''}
                </Text>
                . Assina já pra não perder.
              </Text>
              <PressScale
                onPress={() => setShowUpgrade(true)}
                style={{
                  backgroundColor: '#F59E0B',
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 8,
                }}
              >
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#FFFFFF' }}>
                  Assinar
                </Text>
              </PressScale>
            </View>
          ) : null}

          {/* Counter de combinações */}
          {mode === 'customize' ? (
            <View
              style={{
                marginTop: 14,
                padding: 10,
                backgroundColor: theme.brandSurface,
                borderRadius: 10,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                borderWidth: 1,
                borderColor: theme.brandLight,
              }}
            >
              <Text style={{ fontSize: 14 }}>✨</Text>
              <Text
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 11,
                  color: theme.brandDark,
                  flex: 1,
                }}
              >
                Mais de 50 milhões de combinações possíveis — seu pet único.
              </Text>
            </View>
          ) : null}
        </CenteredColumn>
      </ScrollView>

      {/* Bottom save bar */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 24,
          backgroundColor: theme.surface,
          borderTopWidth: 1,
          borderTopColor: theme.borderLight,
        }}
      >
        <CenteredColumn maxWidth={540}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Button
                title="Salvar avatar"
                onPress={handleSave}
                loading={saveMutation.isPending}
                fullWidth
              />
            </View>
            <AvatarShareButton config={config} petName={pet.name} petId={id} label="" />
            <PetAvatarSvg config={config} size={50} />
          </View>
        </CenteredColumn>
      </View>

      <UpgradeModal
        visible={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        reason="avatarCustom"
      />
    </View>
  );
}

// ============================================================================
// Lista de presets
// ============================================================================
function PresetsList({
  config,
  onSelect,
  onEnterCustomize,
  isPro,
}: {
  config: PetAvatarConfig;
  onSelect: (next: PetAvatarConfig) => void;
  onEnterCustomize: () => void;
  isPro: boolean;
}) {
  const { theme } = useTheme();
  const [query, setQuery] = useState('');

  // Normaliza pra busca acento-insensível e case-insensible.
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');

  const q = normalize(query.trim());

  const presetsForSpecies = useMemo(
    () =>
      AVATAR_PRESETS.filter((p) => p.config.species === config.species)
        .filter((p) => (q.length === 0 ? true : normalize(p.name).includes(q))),
    [config.species, q],
  );
  const otherPresets = useMemo(
    () =>
      AVATAR_PRESETS.filter((p) => p.config.species !== config.species)
        .filter((p) => (q.length === 0 ? true : normalize(p.name).includes(q))),
    [config.species, q],
  );

  const handleRandomize = () => {
    // Random sobre todos os presets disponíveis
    const pool = AVATAR_PRESETS;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    onSelect(pick.config);
  };

  return (
    <View style={{ gap: 14 }}>
      {/* Preview atual — quando há cenário, deixa o SVG renderizar próprio fundo */}
      <View
        style={{
          alignItems: 'center',
          backgroundColor: config.background_scene ? 'transparent' : config.background_color,
          borderRadius: 20,
          paddingVertical: 24,
          borderWidth: 2,
          borderColor: theme.borderLight,
          overflow: 'hidden',
        }}
      >
        <PetAvatarSvg
          config={config}
          size={180}
          showBackground={!!config.background_scene}
          breathing
        />
      </View>

      {/* Action row: busca + randomize */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 12,
            backgroundColor: theme.surface,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.borderLight,
          }}
        >
          <Ionicons name="search" size={14} color={theme.textDim} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar raça..."
            placeholderTextColor={theme.textDim}
            style={{
              flex: 1,
              paddingVertical: 10,
              fontFamily: FONTS.body,
              fontSize: 13,
              color: theme.text,
            }}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10}>
              <Ionicons name="close-circle" size={16} color={theme.textDim} />
            </Pressable>
          ) : null}
        </View>
        <PressScale
          onPress={handleRandomize}
          style={{
            paddingHorizontal: 14,
            backgroundColor: theme.brandSurface,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 5,
            borderWidth: 1,
            borderColor: theme.brandLight,
          }}
        >
          <Ionicons name="dice" size={16} color={theme.brand} />
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.brand }}>
            Surpresa
          </Text>
        </PressScale>
      </View>

      {/* Spoiler: o que dá pra fazer com Pet Pro (só free) */}
      {!isPro ? <ProSpoiler config={config} onUpgradeClick={onEnterCustomize} /> : null}

      {presetsForSpecies.length > 0 ? (
        <>
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 11,
              letterSpacing: 1.2,
              color: theme.brand,
              textTransform: 'uppercase',
              marginLeft: 4,
            }}
          >
            Sugestões pra sua espécie
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {presetsForSpecies.map((p) => (
              <PresetCard
                key={p.slug}
                name={p.name}
                config={p.config}
                active={
                  p.config.fur_color === config.fur_color &&
                  p.config.pattern === config.pattern &&
                  p.config.tail === config.tail
                }
                onPress={() => onSelect(p.config)}
              />
            ))}
          </View>
        </>
      ) : null}

      {presetsForSpecies.length === 0 && otherPresets.length === 0 ? (
        <View style={{ paddingVertical: 28, alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 28 }}>🔍</Text>
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 13,
              color: theme.text,
            }}
          >
            Nenhuma raça encontrada
          </Text>
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 11,
              color: theme.textDim,
            }}
          >
            Tenta outro nome ou customize do zero.
          </Text>
        </View>
      ) : null}

      {otherPresets.length > 0 ? (
        <>
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 11,
              letterSpacing: 1.2,
              color: theme.textDim,
              textTransform: 'uppercase',
              marginLeft: 4,
              marginTop: 6,
            }}
          >
            Outros bichos
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {otherPresets.map((p) => (
              <PresetCard
                key={p.slug}
                name={p.name}
                config={p.config}
                active={false}
                onPress={() => onSelect(p.config)}
              />
            ))}
          </View>
        </>
      ) : null}

      {isPro ? (
        <PressScale
          onPress={onEnterCustomize}
          style={{
            marginTop: 6,
            backgroundColor: theme.brand,
            paddingVertical: 12,
            borderRadius: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <Ionicons name="color-palette" size={16} color="#fff" />
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#fff' }}>
            Customizar do zero
          </Text>
        </PressScale>
      ) : (
        <PressScale
          onPress={onEnterCustomize}
          style={{
            marginTop: 6,
            backgroundColor: '#FBBF24',
            paddingVertical: 14,
            paddingHorizontal: 14,
            borderRadius: 16,
            gap: 6,
            borderWidth: 1.5,
            borderColor: '#F59E0B',
            shadowColor: '#F59E0B',
            shadowOpacity: 0.25,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 16 }}>⭐</Text>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#7C2D12' }}>
              Personalizar com Pet Pro
            </Text>
            <PremiumBadge size={14} />
          </View>
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 11,
              color: '#7C2D12',
              opacity: 0.85,
              lineHeight: 14,
            }}
          >
            Muda cor da pelagem, dos olhos, acessórios e decora a coleira com sininho, plaquinha, estrela ✨
          </Text>
        </PressScale>
      )}
    </View>
  );
}

// ============================================================================
// ProSpoiler — mostra ao free o que ele pode fazer com Pro (3 variações)
// ============================================================================

function ProSpoiler({
  config,
  onUpgradeClick,
}: {
  config: PetAvatarConfig;
  onUpgradeClick: () => void;
}) {
  // 3 variações do avatar atual com customizações exclusivas Pro
  const variations: { label: string; config: PetAvatarConfig }[] = [
    {
      label: 'Pingente + coleira dourada',
      config: { ...config, collar: 'gold', collar_charm: 'star' },
    },
    {
      label: 'Cor fantasia',
      config: { ...config, fur_color: '#C084FC', accent_color: '#FBA9CC' },
    },
    {
      label: 'Topete + lacinho',
      config: { ...config, hair_accent: 'topknot', accessory: 'bow' },
    },
  ];

  return (
    <View
      style={{
        backgroundColor: '#FEF3C7',
        borderRadius: 18,
        padding: 14,
        gap: 12,
        borderWidth: 1.5,
        borderColor: '#FBBF24',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={{ fontSize: 14 }}>⭐</Text>
        <Text
          style={{
            fontFamily: FONTS.bodyBold,
            fontSize: 12,
            color: '#7C2D12',
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            flex: 1,
          }}
        >
          Com Pet Pro você pode
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {variations.map((v, i) => (
          <PressScale
            key={i}
            onPress={onUpgradeClick}
            style={{
              flex: 1,
              alignItems: 'center',
              gap: 4,
              padding: 8,
              borderRadius: 14,
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: '#FCD34D',
            }}
          >
            <View style={{ position: 'relative' }}>
              <PetAvatarSvg
                config={v.config}
                size={64}
                showBackground={false}
                idleBlink={false}
              />
              {/* Cadeado pequeno no canto */}
              <View
                style={{
                  position: 'absolute',
                  right: -2,
                  bottom: -2,
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: '#FBBF24',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1.5,
                  borderColor: '#FFFFFF',
                }}
              >
                <Ionicons name="lock-closed" size={11} color="#FFFFFF" />
              </View>
            </View>
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 9,
                color: '#7C2D12',
                textAlign: 'center',
                lineHeight: 11,
              }}
              numberOfLines={2}
            >
              {v.label}
            </Text>
          </PressScale>
        ))}
      </View>
      <PressScale
        onPress={onUpgradeClick}
        style={{
          backgroundColor: '#F59E0B',
          paddingVertical: 9,
          borderRadius: 10,
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 5,
        }}
      >
        <Ionicons name="sparkles" size={14} color="#FFFFFF" />
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#FFFFFF' }}>
          Desbloquear customização
        </Text>
      </PressScale>
      <Text
        style={{
          fontFamily: FONTS.body,
          fontSize: 10,
          color: '#7C2D12',
          opacity: 0.75,
          textAlign: 'center',
        }}
      >
        7 dias grátis · cancele quando quiser
      </Text>
    </View>
  );
}

const PresetCard = memo(function PresetCard({
  name,
  config,
  active,
  onPress,
}: {
  name: string;
  config: PetAvatarConfig;
  active: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <PressScale
      onPress={onPress}
      style={{
        width: '31%',
        alignItems: 'center',
        gap: 4,
        padding: 8,
        borderRadius: 14,
        backgroundColor: active ? theme.brandSurface : theme.surface,
        borderWidth: 2,
        borderColor: active ? theme.brand : theme.borderLight,
      }}
    >
      <PetAvatarSvg config={config} size={70} idleBlink={false} />
      <Text
        style={{
          fontFamily: FONTS.bodyBold,
          fontSize: 11,
          color: active ? theme.brandDark : theme.text,
          textAlign: 'center',
          marginTop: 2,
        }}
        numberOfLines={1}
      >
        {name}
      </Text>
    </PressScale>
  );
});
