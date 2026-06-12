/**
 * Fotos de saúde — componentes reutilizáveis pra anexar imagens em registros
 * de saúde (vacinas, consultas, etc).
 *
 *  - <HealthPhotoPicker>  : usado em FORMULÁRIOS. Mostra thumbnails, botão de
 *    adicionar e remover. Sobe a foto na hora pro bucket e devolve as URLs.
 *  - <HealthPhotoThumbs>  : usado em CARDS (read-only). Thumbnails que abrem
 *    um lightbox em tela cheia com navegação.
 *
 * Reutiliza o bucket `pet-symptoms` (fotos de saúde, RLS por user no path
 * <uid>/...). Mesmo padrão de upload dos sintomas — sem novo bucket.
 */
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { deleteFromBucket, guessExtension, uploadToBucket } from '@/lib/storage';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

const BUCKET = 'pet-symptoms';

export function HealthPhotoPicker({
  photoUrls,
  onChange,
  max = 4,
  label = 'Fotos (opcional)',
  hint,
}: {
  photoUrls: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  label?: string;
  hint?: string;
}) {
  const { theme } = useTheme();
  const toast = useToast();
  const { session } = useSession();
  const [uploading, setUploading] = useState(false);

  const pick = async () => {
    if (photoUrls.length >= max) {
      toast.info(`Máximo ${max} fotos`);
      return;
    }
    if (!session?.user.id) {
      toast.error('Faça login pra adicionar foto');
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
      quality: 0.75,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    try {
      const asset = result.assets[0];
      const ext = guessExtension(asset.uri, 'jpg');
      const url = await uploadToBucket(BUCKET, session.user.id, asset.uri, ext);
      onChange([...photoUrls, url]);
    } catch (e) {
      toast.error('Erro no upload', e instanceof Error ? e.message : '');
    } finally {
      setUploading(false);
    }
  };

  const remove = (url: string) => {
    onChange(photoUrls.filter((u) => u !== url));
    // Best-effort: remove do storage (não bloqueia se a RLS rejeitar).
    deleteFromBucket(BUCKET, url).catch(() => undefined);
  };

  return (
    <View>
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.textDim, marginBottom: 6 }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {photoUrls.map((url) => (
          <View key={url} style={{ position: 'relative' }}>
            <Image source={{ uri: url }} style={{ width: 72, height: 72, borderRadius: 10 }} />
            <Pressable
              onPress={() => remove(url)}
              hitSlop={8}
              style={{
                position: 'absolute',
                top: -6,
                right: -6,
                backgroundColor: '#DC2626',
                borderRadius: 999,
                width: 22,
                height: 22,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="close" size={14} color="#fff" />
            </Pressable>
          </View>
        ))}
        {photoUrls.length < max ? (
          <Pressable
            onPress={pick}
            disabled={uploading}
            style={{
              width: 72,
              height: 72,
              borderRadius: 10,
              borderWidth: 1.5,
              borderColor: theme.border,
              borderStyle: 'dashed',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.borderLight,
            }}
          >
            {uploading ? (
              <ActivityIndicator color={theme.brand} />
            ) : (
              <Ionicons name="camera-outline" size={24} color={theme.textDim} />
            )}
          </Pressable>
        ) : null}
      </View>
      {hint ? (
        <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim, marginTop: 6 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function HealthPhotoThumbs({
  photoUrls,
  size = 56,
}: {
  photoUrls: string[] | null | undefined;
  size?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  if (!photoUrls || photoUrls.length === 0) return null;

  return (
    <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        {photoUrls.map((url, i) => (
          <Pressable key={url} onPress={() => setActive(i)}>
            <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: 8 }} />
          </Pressable>
        ))}
      </View>

      <Modal
        visible={active !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActive(null)}
      >
        <Pressable
          onPress={() => setActive(null)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.92)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {active !== null ? (
            <Image
              source={{ uri: photoUrls[active] }}
              style={{ width: '92%', height: '78%' }}
              resizeMode="contain"
            />
          ) : null}
          <Pressable
            onPress={() => setActive(null)}
            hitSlop={12}
            style={{ position: 'absolute', top: 48, right: 24 }}
          >
            <Ionicons name="close" size={32} color="#fff" />
          </Pressable>
          {photoUrls.length > 1 && active !== null ? (
            <View
              style={{
                position: 'absolute',
                bottom: 48,
                flexDirection: 'row',
                gap: 20,
                alignItems: 'center',
              }}
            >
              <Pressable
                onPress={() => setActive((active - 1 + photoUrls.length) % photoUrls.length)}
                hitSlop={12}
              >
                <Ionicons name="chevron-back" size={32} color="#fff" />
              </Pressable>
              <Text style={{ color: '#fff', fontFamily: FONTS.body, fontSize: 14 }}>
                {active + 1}/{photoUrls.length}
              </Text>
              <Pressable
                onPress={() => setActive((active + 1) % photoUrls.length)}
                hitSlop={12}
              >
                <Ionicons name="chevron-forward" size={32} color="#fff" />
              </Pressable>
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </>
  );
}
