import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Screen } from '@/components/ui/screen';
import { TextArea } from '@/components/ui/text-area';
import { UserInitialAvatar } from '@/components/user-initial-avatar';
import { FONTS } from '@/lib/fonts';
import { fetchProfile, qk, updateProfile } from '@/lib/queries';
import { guessExtension, uploadToBucket } from '@/lib/storage';
import { useSession } from '@/providers/session-provider';
import { useToast } from '@/providers/toast-provider';

const BIO_MAX = 280;

export default function EditProfileScreen() {
  const router = useRouter();
  const { session } = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const userId = session?.user.id;

  const profileQuery = useQuery({
    queryKey: userId ? qk.profile(userId) : ['profile', 'anon'],
    queryFn: () => fetchProfile(userId!),
    enabled: !!userId,
  });

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profileQuery.data) {
      setDisplayName(profileQuery.data.display_name);
      setBio(profileQuery.data.bio ?? '');
      setAvatarUrl(profileQuery.data.avatar_url);
    }
  }, [profileQuery.data]);

  if (!userId) return null;

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.error('Permissão necessária', 'Libere o acesso à galeria nas configurações.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploadingAvatar(true);
    try {
      const asset = result.assets[0];
      const ext = guessExtension(asset.uri, 'jpg');
      const url = await uploadToBucket('avatars', userId, asset.uri, ext);
      setAvatarUrl(url);
    } catch (e) {
      toast.error('Erro no upload', e instanceof Error ? e.message : 'Tente outra foto.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const removeAvatar = () => setAvatarUrl(null);

  const onSubmit = async () => {
    const name = displayName.trim();
    if (name.length < 2) {
      setError('Nome muito curto (mínimo 2 caracteres)');
      return;
    }
    if (bio.length > BIO_MAX) {
      setError(`Bio muito longa (máximo ${BIO_MAX} caracteres)`);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await updateProfile(userId, {
        display_name: name,
        bio: bio.trim() || null,
        avatar_url: avatarUrl,
      });
      await qc.invalidateQueries({ queryKey: qk.profile(userId) });
      toast.success('Perfil atualizado!');
      router.back();
    } catch (e) {
      toast.error('Erro ao salvar', e instanceof Error ? e.message : 'Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const bioCount = bio.length;
  const bioWarn = bioCount > BIO_MAX - 30; // amarelo perto do limit
  const bioOver = bioCount > BIO_MAX;

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView contentContainerClassName="px-4 pb-12" keyboardShouldPersistTaps="handled">
          <Text style={{ fontFamily: FONTS.display, fontSize: 24, color: '#1A1410', marginBottom: 16 }}>
            Editar perfil
          </Text>

          {/* Avatar com fallback HumanAvatar quando sem foto */}
          <View className="mb-6 items-center">
            <Pressable
              onPress={pickAvatar}
              accessibilityLabel="Mudar foto de perfil"
              style={{
                width: 112,
                height: 112,
                borderRadius: 56,
                overflow: 'hidden',
                backgroundColor: '#FFEDD5',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              <UserInitialAvatar
                avatarUrl={avatarUrl}
                displayName={displayName}
                userId={userId}
                size={112}
              />
              {/* Overlay camera icon sempre visível pra deixar claro que é editável */}
              <View
                style={{
                  position: 'absolute',
                  right: 4,
                  bottom: 4,
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: '#F97316',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: '#FFFFFF',
                }}
              >
                <Ionicons name="camera" size={14} color="#FFFFFF" />
              </View>
            </Pressable>
            <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: '#737373', marginTop: 8 }}>
              {uploadingAvatar
                ? 'Enviando...'
                : avatarUrl
                  ? 'Toque pra trocar'
                  : 'Toque pra adicionar foto (ou use o avatar gerado)'}
            </Text>
            {avatarUrl ? (
              <Pressable onPress={removeAvatar} hitSlop={6} style={{ marginTop: 4 }}>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#DC2626' }}>
                  Remover foto
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View className="gap-3">
            <Input
              label="Nome"
              placeholder="Como podemos te chamar"
              value={displayName}
              onChangeText={(v) => {
                setDisplayName(v);
                if (error) setError(null);
              }}
              error={error && error.toLowerCase().includes('nome') ? error : undefined}
              maxLength={50}
            />
            <View>
              <TextArea
                label="Bio (opcional)"
                placeholder="Fala um pouco sobre você"
                value={bio}
                onChangeText={(v) => {
                  setBio(v);
                  if (error && error.toLowerCase().includes('bio')) setError(null);
                }}
                rows={3}
              />
              <Text
                style={{
                  fontFamily: FONTS.bodyMedium,
                  fontSize: 11,
                  color: bioOver ? '#DC2626' : bioWarn ? '#F59E0B' : '#737373',
                  textAlign: 'right',
                  marginTop: 4,
                }}
              >
                {bioCount}/{BIO_MAX}
              </Text>
              {error && error.toLowerCase().includes('bio') ? (
                <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 12, color: '#DC2626', marginTop: 4 }}>
                  {error}
                </Text>
              ) : null}
            </View>
            <View className="mt-2">
              <Button
                title="Salvar"
                onPress={onSubmit}
                loading={submitting}
                disabled={bioOver}
                fullWidth
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
