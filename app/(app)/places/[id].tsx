import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { copyToClipboard } from '@/lib/clipboard';
import { FONTS } from '@/lib/fonts';
import { placeKindMeta } from '@/lib/places-meta';
import {
  deletePlaceReview,
  fetchPlace,
  fetchPlaceReviews,
  fetchSavedPlaceIds,
  qk,
  toggleSavePlace,
  upsertPlaceReview,
} from '@/lib/queries';
import type { PlaceReviewWithProfile } from '@/lib/types';
import { AppThemeProvider } from '@/providers/app-theme-provider';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

export default function PlaceDetailScreen() {
  return (
    <AppThemeProvider app="places">
      <PlaceDetailInner />
    </AppThemeProvider>
  );
}

function PlaceDetailInner() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const { session } = useSession();
  const qc = useQueryClient();
  const toast = useToast();

  const placeQuery = useQuery({
    queryKey: qk.place(id),
    queryFn: () => fetchPlace(id),
    enabled: !!id,
  });
  const reviewsQuery = useQuery({
    queryKey: qk.placeReviews(id),
    queryFn: () => fetchPlaceReviews(id),
    enabled: !!id,
  });

  const place = placeQuery.data;
  const reviews = reviewsQuery.data ?? [];
  const myReview = reviews.find((r) => r.user_id === session?.user.id) ?? null;
  const meta = place ? placeKindMeta(place.kind) : null;

  const [showForm, setShowForm] = useState(false);

  const deleteMut = useMutation({
    mutationFn: () => deletePlaceReview(id, session!.user.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.placeReviews(id) });
      qc.invalidateQueries({ queryKey: qk.place(id) });
      qc.invalidateQueries({ queryKey: ['places'] });
      toast.success('Review removida');
    },
  });

  // Salvar lugar (favorito) → vai pra "Minha agenda"
  const userId = session?.user.id;
  const savedQuery = useQuery({
    queryKey: ['saved-place-ids', userId],
    queryFn: () => fetchSavedPlaceIds(userId!),
    enabled: !!userId,
    retry: false,
  });
  const isSaved = savedQuery.data?.has(id) ?? false;
  const saveMut = useMutation({
    mutationFn: () => toggleSavePlace(userId!, id, isSaved),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-place-ids'] });
      qc.invalidateQueries({ queryKey: ['saved-places'] });
      toast.success(isSaved ? 'Removido dos salvos' : 'Lugar salvo!', isSaved ? '' : 'Tá na sua agenda 🐾');
    },
    onError: () => toast.error('Erro', 'Não foi possível salvar.'),
  });

  // Distribuição de rating (5★, 4★, ..., 1★)
  const distribution = useMemo(() => {
    const counts = [0, 0, 0, 0, 0]; // index 0 = 1★, 4 = 5★
    for (const r of reviews) {
      if (r.rating >= 1 && r.rating <= 5) counts[r.rating - 1]++;
    }
    return counts;
  }, [reviews]);

  if (placeQuery.isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>
        <Stack.Screen options={{ title: 'Lugar' }} />
        <ActivityIndicator size="large" color={theme.accent.color} />
      </View>
    );
  }
  if (placeQuery.isError || !place || !meta) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
          gap: 10,
          backgroundColor: theme.bg,
        }}
      >
        <Stack.Screen options={{ title: 'Não encontrado' }} />
        <Text style={{ fontSize: 52 }}>📍</Text>
        <Text style={{ fontFamily: FONTS.display, fontSize: 20, color: theme.text, textAlign: 'center' }}>
          Lugar não encontrado
        </Text>
        <Text
          style={{
            fontFamily: FONTS.body,
            fontSize: 13,
            color: theme.textDim,
            textAlign: 'center',
            lineHeight: 19,
          }}
        >
          Esse lugar pode ter sido removido ou o link está quebrado.
        </Text>
      </View>
    );
  }

  const handleShare = async () => {
    const full = `${place.name}\n${meta.label}\n📍 ${place.address}${place.city ? `, ${place.city}` : ''}${place.phone ? `\n📞 ${place.phone}` : ''}${place.website ? `\n🌐 ${place.website}` : ''}`;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: place.name, text: full });
        return;
      } catch {
        // user cancelou ou erro → fallback clipboard
      }
    }
    const ok = await copyToClipboard(full);
    if (ok) toast.success('Copiado!', 'Cole onde quiser pra compartilhar.');
    else toast.error('Erro', 'Não consegui copiar.');
  };

  const openMapsRoute = () => {
    const q = encodeURIComponent(
      place.latitude && place.longitude
        ? `${place.latitude},${place.longitude}`
        : `${place.name} ${place.address}`,
    );
    const url = Platform.select({
      ios: `maps://?daddr=${q}&dirflg=d`,
      android: `google.navigation:q=${q}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
    });
    Linking.openURL(url!).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${q}`);
    });
  };

  const openWaze = () => {
    if (place.latitude && place.longitude) {
      Linking.openURL(
        `https://waze.com/ul?ll=${place.latitude},${place.longitude}&navigate=yes`,
      ).catch(() => {});
    } else {
      const q = encodeURIComponent(`${place.name} ${place.address}`);
      Linking.openURL(`https://waze.com/ul?q=${q}&navigate=yes`).catch(() => {});
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen
        options={{
          title: place.name,
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable
                hitSlop={10}
                onPress={() => userId && saveMut.mutate()}
                style={{ paddingHorizontal: 8 }}
                accessibilityLabel={isSaved ? 'Remover dos salvos' : 'Salvar lugar'}
              >
                <Ionicons
                  name={isSaved ? 'bookmark' : 'bookmark-outline'}
                  size={22}
                  color={theme.accent.color}
                />
              </Pressable>
              <Pressable hitSlop={10} onPress={handleShare} style={{ paddingHorizontal: 8 }}>
                <Ionicons name="share-outline" size={22} color={theme.accent.color} />
              </Pressable>
            </View>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Hero colorido por categoria */}
        <View
          style={{
            backgroundColor: meta.bg,
            paddingHorizontal: 18,
            paddingVertical: 22,
            flexDirection: 'row',
            gap: 14,
            alignItems: 'center',
          }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              backgroundColor: '#FFFFFF',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: meta.color,
              shadowOpacity: 0.2,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
            }}
          >
            <Text style={{ fontSize: 38 }}>{meta.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 11,
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  color: meta.text,
                }}
              >
                {meta.label}
              </Text>
              {place.verified ? (
                <Ionicons name="checkmark-circle" size={12} color="#16A34A" />
              ) : null}
            </View>
            <Text
              style={{ fontFamily: FONTS.display, fontSize: 24, color: theme.text, marginTop: 2 }}
              numberOfLines={3}
            >
              {place.name}
            </Text>
            {place.review_count > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                <Ionicons name="star" size={14} color="#F59E0B" />
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.text }}>
                  {place.avg_rating.toFixed(1)}
                </Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim }}>
                  ({place.review_count} {place.review_count === 1 ? 'review' : 'reviews'})
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={{ padding: 16, gap: 14 }}>
          {place.description ? (
            <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: theme.text, lineHeight: 21 }}>
              {place.description}
            </Text>
          ) : null}

          {/* CTAs de routing — destaque */}
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
            }}
          >
            <Pressable
              onPress={openMapsRoute}
              style={{
                flex: 1,
                backgroundColor: theme.accent.color,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Ionicons name="navigate" size={16} color={theme.accent.onAccent} />
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.accent.onAccent }}>
                Como chegar
              </Text>
            </Pressable>
            <Pressable
              onPress={openWaze}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor: theme.surface,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Text style={{ fontSize: 16 }}>🚗</Text>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text }}>
                Waze
              </Text>
            </Pressable>
          </View>

          {/* Info contato */}
          <View style={{ backgroundColor: theme.surface, borderRadius: 14, padding: 14, gap: 12 }}>
            <InfoRow
              icon="location-outline"
              text={`${place.address}${place.city ? `, ${place.city}` : ''}${place.state ? ` — ${place.state}` : ''}`}
            />
            {place.phone ? (
              <InfoRow
                icon="call-outline"
                text={place.phone}
                onPress={() => Linking.openURL(`tel:${place.phone}`)}
              />
            ) : null}
            {place.website ? (
              <InfoRow
                icon="globe-outline"
                text={place.website}
                onPress={() =>
                  Linking.openURL(
                    place.website!.startsWith('http') ? place.website! : `https://${place.website}`,
                  )
                }
              />
            ) : null}
            {place.hours ? <InfoRow icon="time-outline" text={place.hours} /> : null}
          </View>

          {/* Rating distribution — só quando há reviews */}
          {place.review_count >= 3 ? (
            <View style={{ backgroundColor: theme.surface, borderRadius: 14, padding: 14, gap: 8 }}>
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 11,
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                  color: theme.textDim,
                  marginBottom: 2,
                }}
              >
                Distribuição
              </Text>
              {[5, 4, 3, 2, 1].map((star) => {
                const count = distribution[star - 1];
                const pct = place.review_count > 0 ? (count / place.review_count) * 100 : 0;
                return (
                  <View key={star} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.textDim, width: 16 }}>
                      {star}
                    </Text>
                    <Ionicons name="star" size={11} color="#F59E0B" />
                    <View
                      style={{
                        flex: 1,
                        height: 6,
                        backgroundColor: theme.borderLight,
                        borderRadius: 3,
                        overflow: 'hidden',
                      }}
                    >
                      <View
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          backgroundColor: '#F59E0B',
                          borderRadius: 3,
                        }}
                      />
                    </View>
                    <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim, width: 24, textAlign: 'right' }}>
                      {count}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 2 }} />

          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 12,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              color: theme.accent.color,
            }}
          >
            Reviews
          </Text>

          {showForm ? (
            <ReviewForm
              placeId={id}
              existing={myReview}
              onCancel={() => setShowForm(false)}
              onSaved={() => {
                setShowForm(false);
                qc.invalidateQueries({ queryKey: qk.placeReviews(id) });
                qc.invalidateQueries({ queryKey: qk.place(id) });
                qc.invalidateQueries({ queryKey: ['places'] });
                toast.success('Review enviada!');
              }}
            />
          ) : (
            <Button
              title={myReview ? '✏️ Editar minha review' : '⭐ Avaliar este lugar'}
              variant={myReview ? 'secondary' : 'primary'}
              onPress={() => setShowForm(true)}
              fullWidth
            />
          )}

          {myReview && !showForm ? (
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <Pressable hitSlop={10} onPress={() => deleteMut.mutate()}>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#DC2626' }}>
                  Remover minha review
                </Text>
              </Pressable>
            </View>
          ) : null}

          {reviews.length === 0 ? (
            <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: theme.textDim, textAlign: 'center', paddingVertical: 12 }}>
              Seja o primeiro a avaliar 🐾
            </Text>
          ) : (
            reviews.map((r) => <ReviewCard key={r.id} review={r} />)
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({ icon, text, onPress }: { icon: keyof typeof Ionicons.glyphMap; text: string; onPress?: () => void }) {
  const { theme } = useTheme();
  const inner = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Ionicons name={icon} size={18} color={theme.textDim} />
      <Text
        style={{
          flex: 1,
          fontFamily: FONTS.body,
          fontSize: 13,
          color: onPress ? theme.accent.color : theme.text,
        }}
      >
        {text}
      </Text>
    </View>
  );
  if (onPress) return <Pressable onPress={onPress}>{inner}</Pressable>;
  return inner;
}

function ReviewCard({ review }: { review: PlaceReviewWithProfile }) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 12,
        padding: 12,
        gap: 6,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text }}>
          {review.profile.display_name}
        </Text>
        <View style={{ flexDirection: 'row' }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Ionicons
              key={n}
              name={n <= review.rating ? 'star' : 'star-outline'}
              size={12}
              color="#F59E0B"
            />
          ))}
        </View>
        <Text style={{ marginLeft: 'auto', fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }}>
          {formatDistanceToNow(new Date(review.created_at), { locale: ptBR, addSuffix: true })}
        </Text>
      </View>
      {review.comment ? (
        <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: theme.textMuted, lineHeight: 18 }}>
          {review.comment}
        </Text>
      ) : null}
    </View>
  );
}

function ReviewForm({
  placeId,
  existing,
  onCancel,
  onSaved,
}: {
  placeId: string;
  existing: PlaceReviewWithProfile | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { theme } = useTheme();
  const { session } = useSession();
  const [rating, setRating] = useState(existing?.rating ?? 5);
  const [comment, setComment] = useState(existing?.comment ?? '');

  const saveMut = useMutation({
    mutationFn: () =>
      upsertPlaceReview({
        place_id: placeId,
        user_id: session!.user.id,
        rating,
        comment: comment.trim() || undefined,
      }),
    onSuccess: onSaved,
  });

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 12,
        padding: 14,
        gap: 12,
        borderWidth: 1,
        borderColor: theme.border,
      }}
    >
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.text }}>Sua avaliação</Text>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setRating(n)} hitSlop={6}>
            <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={32} color="#F59E0B" />
          </Pressable>
        ))}
      </View>
      <TextInput
        value={comment}
        onChangeText={setComment}
        placeholder="Conta como foi sua experiência..."
        placeholderTextColor={theme.textDim}
        multiline
        maxLength={500}
        style={{
          backgroundColor: theme.borderLight,
          borderRadius: 10,
          padding: 10,
          fontFamily: FONTS.body,
          fontSize: 14,
          color: theme.text,
          minHeight: 80,
          textAlignVertical: 'top',
        }}
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button title="Cancelar" variant="secondary" onPress={onCancel} fullWidth />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Enviar" onPress={() => saveMut.mutate()} loading={saveMut.isPending} fullWidth />
        </View>
      </View>
    </View>
  );
}
