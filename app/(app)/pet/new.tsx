import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { PetForm } from '@/components/pet-form';
import { PremiumBadge } from '@/components/premium-badge';
import { Screen } from '@/components/ui/screen';
import { UpgradeModal } from '@/components/upgrade-modal';
import { safeErrorMessage } from '@/lib/errors';
import { FONTS } from '@/lib/fonts';
import { qk, upsertPetPrivate } from '@/lib/queries';
import { claimReferral, clearPendingRef, readPendingRef } from '@/lib/referral';
import { supabase } from '@/lib/supabase';
import { FREE_TIER_LIMITS, PRO_TIER_LIMITS } from '@/lib/types';
import { useActivePet } from '@/providers/active-pet-provider';
import { useSession } from '@/providers/session-provider';
import { useIsPro } from '@/providers/subscription-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

export default function NewPetScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { session } = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const userId = session?.user.id;
  const isPro = useIsPro();
  const { pets } = useActivePet();
  const [showUpgrade, setShowUpgrade] = useState(false);

  if (!userId) return null;

  const petCount = pets.length;
  const maxPets = isPro ? PRO_TIER_LIMITS.maxPets : FREE_TIER_LIMITS.maxPets;
  const reachedLimit = petCount >= maxPets;
  const remainingFree = Math.max(0, FREE_TIER_LIMITS.maxPets - petCount);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Novo pet', headerShown: true }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* Header motivacional */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
          <Text style={{ fontFamily: FONTS.display, fontSize: 26, color: theme.text }}>
            {petCount === 0 ? 'Primeiro pet? 🐾' : 'Mais um pra família 🎉'}
          </Text>
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 14,
              color: theme.textDim,
              marginTop: 4,
              lineHeight: 20,
            }}
          >
            Cada pet tem seu próprio perfil, feed e carteirinha. Você pode mudar
            tudo depois — comece simples.
          </Text>

          {/* Indicator de plano */}
          {reachedLimit ? (
            <View
              style={{
                marginTop: 14,
                padding: 12,
                backgroundColor: isPro ? theme.borderLight : '#FEF3C7',
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                borderWidth: 1,
                borderColor: isPro ? theme.borderLight : '#FBBF24',
              }}
            >
              <Ionicons name="lock-closed" size={18} color={isPro ? theme.textDim : '#92400E'} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: isPro ? theme.text : '#78350F' }}>
                  {isPro ? 'Limite do Pet Pro' : 'Limite do plano gratuito'}
                </Text>
                <Text
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 11,
                    color: isPro ? theme.textDim : '#78350F',
                    marginTop: 2,
                  }}
                >
                  {isPro
                    ? `Você atingiu o máximo de ${PRO_TIER_LIMITS.maxPets} pets do Pet Pro.`
                    : `Você já tem ${FREE_TIER_LIMITS.maxPets} ${FREE_TIER_LIMITS.maxPets === 1 ? 'pet' : 'pets'}. Vire Pro pra ter até ${PRO_TIER_LIMITS.maxPets} pets.`}
                </Text>
              </View>
              {!isPro ? <PremiumBadge size={14} /> : null}
            </View>
          ) : !isPro ? (
            <View
              style={{
                marginTop: 14,
                padding: 10,
                backgroundColor: theme.borderLight,
                borderRadius: 10,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Ionicons name="information-circle-outline" size={16} color={theme.textDim} />
              <Text style={{ flex: 1, fontFamily: FONTS.body, fontSize: 12, color: theme.textDim }}>
                Plano gratuito: pode cadastrar mais{' '}
                <Text style={{ fontFamily: FONTS.bodyBold }}>
                  {remainingFree} {remainingFree === 1 ? 'pet' : 'pets'}
                </Text>
                .
              </Text>
            </View>
          ) : null}
        </View>

        <PetForm
          userId={userId}
          submitLabel="Adicionar pet"
          onSubmit={async (data) => {
            if (reachedLimit) {
              if (isPro) {
                toast.error('Limite de pets', `O Pet Pro permite até ${PRO_TIER_LIMITS.maxPets} pets.`);
              } else {
                setShowUpgrade(true);
              }
              return;
            }
            try {
              // Convite: registra quem indicou ANTES de inserir — o 1º pet
              // dispara a recompensa (7 dias de Pro pra ambos) via trigger.
              const pendingRef = readPendingRef();
              if (pendingRef) {
                await claimReferral(pendingRef).catch(() => false);
              }
              // Base do pet -> tabela `pets`
              const { data: created, error } = await supabase
                .from('pets')
                .insert({
                  owner_id: userId,
                  name: data.name,
                  species: data.species,
                  breed: data.breed || null,
                  birthdate: data.birthdate || null,
                  bio: data.bio || null,
                  avatar_url: data.avatar_url || null,
                })
                .select('id')
                .single();
              if (error) throw error;
              // PII médica/carteirinha -> tabela-filha `pet_private` (RLS dono-only)
              if (created?.id) {
                await upsertPetPrivate(created.id, {
                  microchip_number: data.microchip_number || null,
                  rga_number: data.rga_number || null,
                  blood_type: data.blood_type || null,
                  allergies: data.allergies || null,
                  known_conditions: data.known_conditions || null,
                  emergency_contact_name: data.emergency_contact_name || null,
                  emergency_contact_phone: data.emergency_contact_phone || null,
                  preferred_vet_name: data.preferred_vet_name || null,
                  preferred_vet_phone: data.preferred_vet_phone || null,
                  sinpatinhas_id: data.sinpatinhas_id || null,
                });
              }
              clearPendingRef();
              await qc.invalidateQueries({ queryKey: qk.myPets(userId) });
              toast.success(`${data.name} entrou na família! 🎉`, 'Bora customizar o avatar?');
              router.back();
            } catch (e) {
              toast.error('Não consegui adicionar o pet', safeErrorMessage(e));
              throw e;
            }
          }}
        />
      </ScrollView>
      <UpgradeModal
        visible={showUpgrade}
        onClose={() => {
          setShowUpgrade(false);
          router.back();
        }}
        reason="maxPets"
      />
    </Screen>
  );
}
