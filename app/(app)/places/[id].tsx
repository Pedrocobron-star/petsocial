import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { copyToClipboard } from '@/lib/clipboard';
import { FONTS } from '@/lib/fonts';
import { placeKindMeta } from '@/lib/places-meta';
import {
  addPlacePhoto,
  deletePlacePhoto,
  deletePlaceReview,
  fetchPlace,
  fetchPlacePhotos,
  fetchPlaceReviews,
  fetchSavedPlaceIds,
  qk,
  toggleSavePlace,
  upsertPlaceReview,
} from '@/lib/queries';
import { deleteFromBucket, guessExtension, uploadToBucket } from '@/lib/storage';
import type { PlacePhoto, PlaceReviewWithProfile } from '@/lib/types';
import { AppThemeProvider } from '@/providers/app-theme-provider';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

const ADMIN_EMAIL = 'pedrocobron@gmail.com';
const MAX_PLACE_PHOTOS = 12;
const MAX_REVIEW_PHOTOS = 4;

// Categorias de nota estilo Google Maps (todas opcionais; a nota geral é o `rating`).
const ASPECTS = [
  { key: 'rating_service', label: 'Atendimento', emoji: '🤝' },
  { key: 'rating_price', label: 'Custo-benefício', emoji: '💸' },
  { key: 'rating_cleanliness', label: 'Limpeza', emoji: '🧼' },
  { key: 'rating_petfriendly', label: 'Pet-friendly', emoji: '🐾' },
] as const;

type AspectKey = (typeof ASPECTS)[number]['key'];

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
  const reviews = useMemo(() => reviewsQuery.data ?? [], [reviewsQuery.data]);
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

  // Médias por categoria (estilo Google Maps): só aspectos que alguém avaliou.
  const aspectAverages = useMemo(() => {
    return ASPECTS.map((a) => {
      const vals = reviews
        .map((r) => r[a.key])
        .filter((v): v is number => v != null);
      const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
      return { ...a, avg, count: vals.length };
    }).filter((a) => a.avg != null);
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

        {/* Galeria de fotos da comunidade */}
        <PlacePhotosSection placeId={id} accentColor={meta.color} />

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

          {/* Médias por categoria — estilo Google Maps */}
          {aspectAverages.length > 0 ? (
            <View style={{ backgroundColor: theme.surface, borderRadius: 14, padding: 14, gap: 10 }}>
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 11,
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                  color: theme.textDim,
                }}
              >
                Notas por categoria
              </Text>
              {aspectAverages.map((a) => (
                <View key={a.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 15, width: 22 }}>{a.emoji}</Text>
                  <Text style={{ flex: 1, fontFamily: FONTS.body, fontSize: 13, color: theme.text }}>
                    {a.label}
                  </Text>
                  <View
                    style={{
                      flex: 1.4,
                      height: 6,
                      backgroundColor: theme.borderLight,
                      borderRadius: 3,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        width: `${((a.avg ?? 0) / 5) * 100}%`,
                        height: '100%',
                        backgroundColor: '#F59E0B',
                        borderRadius: 3,
                      }}
                    />
                  </View>
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text, width: 30, textAlign: 'right' }}>
                    {a.avg!.toFixed(1)}
                  </Text>
                </View>
              ))}
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

/** Extrai o caminho "<userId>/<arquivo>" do URL público do bucket 'posts'. */
function storagePathFromUrl(publicUrl: string): string {
  const marker = '/object/public/posts/';
  const idx = publicUrl.indexOf(marker);
  return idx >= 0 ? publicUrl.substring(idx + marker.length) : '';
}

function PlacePhotosSection({ placeId, accentColor }: { placeId: string; accentColor: string }) {
  const { theme } = useTheme();
  const { session } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const userId = session?.user.id;
  const isAdmin = session?.user.email === ADMIN_EMAIL;

  const photosQuery = useQuery({
    queryKey: qk.placePhotos(placeId),
    queryFn: () => fetchPlacePhotos(placeId),
    enabled: !!placeId,
  });
  const photos = photosQuery.data ?? [];

  const [uploading, setUploading] = useState(false);
  const [viewer, setViewer] = useState<PlacePhoto | null>(null);

  const addMut = useMutation({
    mutationFn: async (input: { url: string; storage_path: string }) =>
      addPlacePhoto({
        place_id: placeId,
        user_id: userId!,
        url: input.url,
        storage_path: input.storage_path,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.placePhotos(placeId) });
      toast.success('Foto adicionada 📸', 'Valeu por ajudar a comunidade!');
    },
    onError: () => toast.error('Não consegui salvar a foto'),
  });

  const delMut = useMutation({
    mutationFn: async (photo: PlacePhoto) => {
      await deletePlacePhoto(photo.id);
      await deleteFromBucket('posts', photo.url);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.placePhotos(placeId) });
      setViewer(null);
      toast.success('Foto removida');
    },
    onError: () => toast.error('Não consegui remover'),
  });

  const pickPhoto = async () => {
    if (!userId) {
      toast.error('Faça login pra adicionar foto');
      return;
    }
    if (photos.length >= MAX_PLACE_PHOTOS) {
      toast.info(`Máximo ${MAX_PLACE_PHOTOS} fotos por lugar`);
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.error('Permissão negada', 'Libere o acesso à galeria pra anexar foto');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    try {
      const asset = result.assets[0];
      const ext = guessExtension(asset.uri, 'jpg');
      const url = await uploadToBucket('posts', userId, asset.uri, ext);
      const storage_path = storagePathFromUrl(url);
      addMut.mutate({ url, storage_path });
    } catch (e) {
      toast.error('Erro no upload', e instanceof Error ? e.message : '');
    } finally {
      setUploading(false);
    }
  };

  const canDelete = (photo: PlacePhoto) => isAdmin || photo.user_id === userId;

  return (
    <View style={{ paddingTop: 14, gap: 8 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
        }}
      >
        <Text
          style={{
            fontFamily: FONTS.bodyBold,
            fontSize: 12,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            color: accentColor,
          }}
        >
          Fotos {photos.length > 0 ? `(${photos.length})` : ''}
        </Text>
        <Pressable
          onPress={pickPhoto}
          disabled={uploading || addMut.isPending}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: uploading ? 0.6 : 1 }}
          hitSlop={8}
        >
          {uploading || addMut.isPending ? (
            <ActivityIndicator size="small" color={accentColor} />
          ) : (
            <Ionicons name="camera" size={16} color={accentColor} />
          )}
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: accentColor }}>
            Adicionar foto
          </Text>
        </Pressable>
      </View>

      {photos.length === 0 ? (
        <Text
          style={{
            fontFamily: FONTS.body,
            fontSize: 13,
            color: theme.textDim,
            paddingHorizontal: 16,
            paddingVertical: 6,
          }}
        >
          Sem fotos ainda. Seja o primeiro a mostrar como é esse lugar 📸
        </Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
        >
          {photos.map((p) => (
            <Pressable key={p.id} onPress={() => setViewer(p)}>
              <Image
                source={{ uri: p.url }}
                style={{ width: 150, height: 150, borderRadius: 14, backgroundColor: theme.borderLight }}
                resizeMode="cover"
              />
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Lightbox */}
      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' }}>
          <Pressable
            onPress={() => setViewer(null)}
            style={{ position: 'absolute', top: 50, right: 20, zIndex: 2, padding: 8 }}
            hitSlop={12}
          >
            <Ionicons name="close" size={30} color="#FFFFFF" />
          </Pressable>
          {viewer ? (
            <Image source={{ uri: viewer.url }} style={{ width: '100%', height: '70%' }} resizeMode="contain" />
          ) : null}
          {viewer && canDelete(viewer) ? (
            <Pressable
              onPress={() => delMut.mutate(viewer)}
              disabled={delMut.isPending}
              style={{
                position: 'absolute',
                bottom: 50,
                alignSelf: 'center',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingVertical: 10,
                paddingHorizontal: 18,
                borderRadius: 999,
                backgroundColor: 'rgba(220,38,38,0.9)',
              }}
            >
              <Ionicons name="trash" size={16} color="#FFFFFF" />
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#FFFFFF' }}>
                {delMut.isPending ? 'Removendo...' : 'Remover foto'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </Modal>
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
  const [viewer, setViewer] = useState<string | null>(null);
  const photos = review.photo_urls ?? [];
  const filledAspects = ASPECTS.filter((a) => review[a.key] != null);

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 12,
        padding: 12,
        gap: 8,
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

      {/* Sub-notas por categoria (estilo Google Maps) */}
      {filledAspects.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {filledAspects.map((a) => (
            <View
              key={a.key}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 3,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 999,
                backgroundColor: theme.borderLight,
              }}
            >
              <Text style={{ fontSize: 11 }}>{a.emoji}</Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textMuted }}>
                {a.label}
              </Text>
              <Ionicons name="star" size={10} color="#F59E0B" />
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: theme.text }}>
                {review[a.key]}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {review.comment ? (
        <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: theme.textMuted, lineHeight: 18 }}>
          {review.comment}
        </Text>
      ) : null}

      {/* Fotos da avaliação */}
      {photos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {photos.map((url) => (
            <Pressable key={url} onPress={() => setViewer(url)}>
              <Image
                source={{ uri: url }}
                style={{ width: 92, height: 92, borderRadius: 10, backgroundColor: theme.borderLight }}
                resizeMode="cover"
              />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' }}>
          <Pressable
            onPress={() => setViewer(null)}
            style={{ position: 'absolute', top: 50, right: 20, zIndex: 2, padding: 8 }}
            hitSlop={12}
          >
            <Ionicons name="close" size={30} color="#FFFFFF" />
          </Pressable>
          {viewer ? (
            <Image source={{ uri: viewer }} style={{ width: '100%', height: '70%' }} resizeMode="contain" />
          ) : null}
        </View>
      </Modal>
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
  const toast = useToast();
  const [rating, setRating] = useState(existing?.rating ?? 5);
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [aspects, setAspects] = useState<Record<AspectKey, number | null>>({
    rating_service: existing?.rating_service ?? null,
    rating_price: existing?.rating_price ?? null,
    rating_cleanliness: existing?.rating_cleanliness ?? null,
    rating_petfriendly: existing?.rating_petfriendly ?? null,
  });
  const [photoUrls, setPhotoUrls] = useState<string[]>(existing?.photo_urls ?? []);
  const [uploading, setUploading] = useState(false);
  // Fotos que JÁ estão salvas na review: não apagar do storage até o save confirmar
  // (senão cancelar a edição deixaria link morto na review persistida).
  const originalPhotos = existing?.photo_urls ?? [];

  const pickPhoto = async () => {
    if (!session?.user.id) return;
    if (photoUrls.length >= MAX_REVIEW_PHOTOS) {
      toast.info(`Máximo ${MAX_REVIEW_PHOTOS} fotos por avaliação`);
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.error('Permissão negada', 'Libere o acesso à galeria pra anexar foto');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    try {
      const asset = result.assets[0];
      const ext = guessExtension(asset.uri, 'jpg');
      const url = await uploadToBucket('posts', session.user.id, asset.uri, ext);
      setPhotoUrls((prev) => [...prev, url]);
    } catch (e) {
      toast.error('Erro no upload', e instanceof Error ? e.message : '');
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (url: string) => {
    setPhotoUrls((prev) => prev.filter((u) => u !== url));
    // Só apaga do storage AGORA se a foto foi subida nesta sessão (não persistida).
    // Foto que já estava na review é apagada só quando o save confirmar (ver onSuccess).
    if (!originalPhotos.includes(url)) {
      deleteFromBucket('posts', url).catch(() => undefined);
    }
  };

  // Cancelar: limpa do storage as fotos subidas nesta sessão que não foram salvas.
  const handleCancel = () => {
    for (const url of photoUrls) {
      if (!originalPhotos.includes(url)) deleteFromBucket('posts', url).catch(() => undefined);
    }
    onCancel();
  };

  const saveMut = useMutation({
    mutationFn: () =>
      upsertPlaceReview({
        place_id: placeId,
        user_id: session!.user.id,
        rating,
        comment: comment.trim() || undefined,
        photo_urls: photoUrls,
        rating_service: aspects.rating_service,
        rating_price: aspects.rating_price,
        rating_cleanliness: aspects.rating_cleanliness,
        rating_petfriendly: aspects.rating_petfriendly,
      }),
    onSuccess: () => {
      // Save confirmado: agora sim apaga do storage as fotos originais que foram removidas.
      for (const url of originalPhotos) {
        if (!photoUrls.includes(url)) deleteFromBucket('posts', url).catch(() => undefined);
      }
      onSaved();
    },
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
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.text }}>Nota geral</Text>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setRating(n)} hitSlop={6}>
            <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={32} color="#F59E0B" />
          </Pressable>
        ))}
      </View>

      {/* Notas por categoria (opcionais) — estilo Google Maps */}
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.textDim }}>
        Avalie por categoria (opcional)
      </Text>
      {ASPECTS.map((a) => (
        <View key={a.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: theme.text }}>
            {a.emoji} {a.label}
          </Text>
          <View style={{ flexDirection: 'row', gap: 2 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                hitSlop={4}
                onPress={() =>
                  // toca na estrela já marcada = limpa a categoria
                  setAspects((prev) => ({ ...prev, [a.key]: prev[a.key] === n ? null : n }))
                }
              >
                <Ionicons
                  name={(aspects[a.key] ?? 0) >= n ? 'star' : 'star-outline'}
                  size={22}
                  color="#F59E0B"
                />
              </Pressable>
            ))}
          </View>
        </View>
      ))}

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

      {/* Fotos da avaliação */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {photoUrls.map((url) => (
          <View key={url}>
            <Image
              source={{ uri: url }}
              style={{ width: 70, height: 70, borderRadius: 10, backgroundColor: theme.borderLight }}
              resizeMode="cover"
            />
            <Pressable
              onPress={() => removePhoto(url)}
              hitSlop={6}
              style={{
                position: 'absolute',
                top: -6,
                right: -6,
                backgroundColor: '#DC2626',
                borderRadius: 999,
                width: 20,
                height: 20,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="close" size={13} color="#FFFFFF" />
            </Pressable>
          </View>
        ))}
        {photoUrls.length < MAX_REVIEW_PHOTOS ? (
          <Pressable
            onPress={pickPhoto}
            disabled={uploading}
            style={{
              width: 70,
              height: 70,
              borderRadius: 10,
              borderWidth: 1.5,
              borderColor: theme.border,
              borderStyle: 'dashed',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
            }}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={theme.accent.color} />
            ) : (
              <>
                <Ionicons name="camera" size={20} color={theme.accent.color} />
                <Text style={{ fontFamily: FONTS.body, fontSize: 9, color: theme.textDim }}>Foto</Text>
              </>
            )}
          </Pressable>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button title="Cancelar" variant="secondary" onPress={handleCancel} fullWidth />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title="Enviar"
            onPress={() => saveMut.mutate()}
            loading={saveMut.isPending}
            disabled={uploading}
            fullWidth
          />
        </View>
      </View>
    </View>
  );
}
