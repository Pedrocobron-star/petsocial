import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { EmptyState } from '@/components/empty-state';
import { CenteredColumn } from '@/components/ui/centered-column';
import { PressScale } from '@/components/ui/press-scale';
import {
  createPetDocument,
  deletePetDocument,
  DOCUMENT_KINDS,
  documentKindMeta,
  fetchPetDocuments,
  FREE_DOCS_PER_PET,
  getDocumentUrl,
  pickDocumentFile,
  uploadDocumentFile,
  type DocumentKind,
  type PetDocument,
  type PickedFile,
} from '@/lib/documents';
import { FONTS } from '@/lib/fonts';
import { fetchPet, qk } from '@/lib/queries';
import { useSession } from '@/providers/session-provider';
import { useIsPro } from '@/providers/subscription-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function isoToBr(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function parseBrDate(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  let [, d, mo, y] = m;
  if (y.length === 2) y = '20' + y;
  const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const dt = new Date(iso + 'T00:00:00');
  if (Number.isNaN(dt.getTime())) return null;
  return iso;
}

export default function PetDocumentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useSession();
  const userId = session?.user.id;
  const isPro = useIsPro();

  const petQuery = useQuery({ queryKey: qk.pet(id), queryFn: () => fetchPet(id), enabled: !!id });
  const docsQuery = useQuery({
    queryKey: ['pet-documents', id],
    queryFn: () => fetchPetDocuments(id),
    enabled: !!id,
  });
  const docs = docsQuery.data ?? [];

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<DocumentKind>('exame');
  const [dateBr, setDateBr] = useState(isoToBr(todayIso()));
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);

  const resetForm = () => {
    setFormOpen(false);
    setPicked(null);
    setTitle('');
    setKind('exame');
    setDateBr(isoToBr(todayIso()));
    setNotes('');
  };

  const onAdd = async () => {
    if (!isPro && docs.length >= FREE_DOCS_PER_PET) {
      toast.info(
        'Limite do plano gratuito',
        `Você já guardou ${FREE_DOCS_PER_PET} documentos deste pet. Vire Pro pra ilimitado.`,
      );
      router.push('/pro');
      return;
    }
    const file = await pickDocumentFile();
    if (!file) return;
    setPicked(file);
    // Sugere título a partir do nome do arquivo (sem extensão)
    const base = file.name.replace(/\.[^.]+$/, '');
    setTitle(base.slice(0, 60));
    setFormOpen(true);
  };

  const onSave = async () => {
    if (!picked || !userId) return;
    if (title.trim().length < 2) {
      toast.error('Dê um nome', 'Ex: "Hemograma", "Raio-X da pata"');
      return;
    }
    setUploading(true);
    try {
      const filePath = await uploadDocumentFile(userId, picked);
      await createPetDocument({
        petId: id,
        ownerId: userId,
        kind,
        title: title.trim(),
        notes: notes.trim() || null,
        filePath,
        fileType: picked.fileType,
        fileName: picked.name,
        docDate: parseBrDate(dateBr),
      });
      await qc.invalidateQueries({ queryKey: ['pet-documents', id] });
      toast.success('Documento guardado! 🔒', 'Privado e criptografado.');
      resetForm();
    } catch (e) {
      toast.error('Erro ao guardar', e instanceof Error ? e.message : 'Tente de novo.');
    } finally {
      setUploading(false);
    }
  };

  const deleteMut = useMutation({
    mutationFn: (doc: PetDocument) => deletePetDocument(doc),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['pet-documents', id] });
      toast.success('Documento removido');
    },
    onError: () => toast.error('Não foi possível remover'),
  });

  const pet = petQuery.data;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: pet ? `Documentos · ${pet.name}` : 'Documentos' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <CenteredColumn maxWidth={540}>
          {/* Nota de privacidade */}
          <View
            style={{
              flexDirection: 'row',
              gap: 10,
              backgroundColor: '#F0FDF4',
              borderRadius: 14,
              padding: 12,
              borderWidth: 1,
              borderColor: '#BBF7D0',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <Ionicons name="lock-closed" size={18} color="#16A34A" />
            <Text style={{ flex: 1, fontFamily: FONTS.body, fontSize: 12, color: '#166534', lineHeight: 17 }}>
              Exames, laudos e receitas num lugar só. Ficam <Text style={{ fontFamily: FONTS.bodyBold }}>privados e criptografados</Text> — só você vê. Leve tudo pro vet no celular.
            </Text>
          </View>

          {/* Adicionar */}
          <PressScale
            onPress={onAdd}
            style={{
              backgroundColor: theme.brand,
              paddingVertical: 14,
              borderRadius: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginBottom: 16,
            }}
          >
            <Ionicons name="cloud-upload-outline" size={19} color="#fff" />
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: '#fff' }}>
              Adicionar documento
            </Text>
          </PressScale>

          {!isPro ? (
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim, textAlign: 'center', marginTop: -8, marginBottom: 12 }}>
              {Math.max(0, FREE_DOCS_PER_PET - docs.length)} de {FREE_DOCS_PER_PET} restantes no plano grátis
            </Text>
          ) : null}

          {/* Lista */}
          {docsQuery.isLoading ? (
            <ActivityIndicator color={theme.brand} style={{ marginTop: 24 }} />
          ) : docs.length === 0 ? (
            <EmptyState
              emoji="📂"
              title="Nenhum documento ainda"
              description="Tire foto da carteirinha de vacinação de papel, suba o PDF do último exame ou a receita do vet. Tudo organizado por pet."
            />
          ) : (
            <View style={{ gap: 10 }}>
              {docs.map((doc) => (
                <DocCard
                  key={doc.id}
                  doc={doc}
                  onDelete={() => deleteMut.mutate(doc)}
                />
              ))}
            </View>
          )}
        </CenteredColumn>
      </ScrollView>

      {/* ============ Form modal ============ */}
      <Modal visible={formOpen} transparent animationType="none" onRequestClose={resetForm}>
        <Animated.View
          entering={FadeIn.duration(150)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
        >
          <Pressable onPress={resetForm} style={{ flex: 1 }} />
          <Animated.View
            entering={SlideInDown.duration(260)}
            exiting={SlideOutDown.duration(200)}
            style={{
              backgroundColor: theme.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 12,
              paddingHorizontal: 20,
              paddingBottom: 28,
              maxHeight: '88%',
            }}
          >
            <View style={{ alignItems: 'center', paddingBottom: 10 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border }} />
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={{ fontFamily: FONTS.display, fontSize: 20, color: theme.text, marginBottom: 4 }}>
                Novo documento
              </Text>

              {/* Preview do arquivo escolhido */}
              {picked ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    backgroundColor: theme.borderLight,
                    borderRadius: 12,
                    padding: 10,
                    marginVertical: 10,
                  }}
                >
                  {picked.fileType === 'image' ? (
                    <Image source={{ uri: picked.uri }} style={{ width: 44, height: 44, borderRadius: 8 }} contentFit="cover" />
                  ) : (
                    <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="document-text" size={22} color="#DC2626" />
                    </View>
                  )}
                  <Text style={{ flex: 1, fontFamily: FONTS.body, fontSize: 12, color: theme.textDim }} numberOfLines={2}>
                    {picked.name}
                  </Text>
                </View>
              ) : null}

              <Field label="Nome do documento">
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder='Ex: "Hemograma completo"'
                  placeholderTextColor={theme.textDim}
                  style={inputStyle(theme)}
                />
              </Field>

              <Field label="Tipo">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {DOCUMENT_KINDS.map((k) => {
                    const active = kind === k.key;
                    return (
                      <Pressable
                        key={k.key}
                        onPress={() => setKind(k.key)}
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
                        <Text style={{ fontSize: 13 }}>{k.emoji}</Text>
                        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: active ? '#fff' : theme.textDim }}>
                          {k.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Field>

              <Field label="Data do documento">
                <TextInput
                  value={dateBr}
                  onChangeText={setDateBr}
                  placeholder="dd/mm/aaaa"
                  placeholderTextColor={theme.textDim}
                  keyboardType="numbers-and-punctuation"
                  style={inputStyle(theme)}
                />
              </Field>

              <Field label="Observação (opcional)">
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Ex: pedido pela Dra. Carla, repetir em 3 meses"
                  placeholderTextColor={theme.textDim}
                  multiline
                  style={[inputStyle(theme), { minHeight: 64, textAlignVertical: 'top' }]}
                />
              </Field>

              <PressScale
                onPress={onSave}
                disabled={uploading}
                style={{
                  backgroundColor: '#16A34A',
                  paddingVertical: 14,
                  borderRadius: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  marginTop: 8,
                  opacity: uploading ? 0.6 : 1,
                }}
              >
                {uploading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="lock-closed" size={17} color="#fff" />
                )}
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: '#fff' }}>
                  {uploading ? 'Guardando...' : 'Guardar documento'}
                </Text>
              </PressScale>
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  );
}

// ----------------------------------------------------------------------------

function DocCard({ doc, onDelete }: { doc: PetDocument; onDelete: () => void }) {
  const { theme } = useTheme();
  const toast = useToast();
  const [opening, setOpening] = useState(false);
  const meta = documentKindMeta(doc.kind);

  // Signed URL pro thumbnail (imagens) — cache de 50min via react-query
  const urlQuery = useQuery({
    queryKey: ['doc-url', doc.id],
    queryFn: () => getDocumentUrl(doc.file_path),
    staleTime: 50 * 60 * 1000,
  });

  const openDoc = async () => {
    setOpening(true);
    try {
      const url = urlQuery.data ?? (await getDocumentUrl(doc.file_path));
      if (url) await Linking.openURL(url);
      else toast.error('Não foi possível abrir');
    } catch {
      toast.error('Não foi possível abrir');
    } finally {
      setOpening(false);
    }
  };

  return (
    <PressScale
      onPress={openDoc}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: theme.surface,
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: theme.borderLight,
      }}
    >
      {/* Thumbnail / ícone */}
      {doc.file_type === 'image' && urlQuery.data ? (
        <Image
          source={{ uri: urlQuery.data }}
          style={{ width: 52, height: 52, borderRadius: 10, backgroundColor: theme.borderLight }}
          contentFit="cover"
        />
      ) : (
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 10,
            backgroundColor: doc.file_type === 'pdf' ? '#FEE2E2' : theme.borderLight,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {opening || urlQuery.isLoading ? (
            <ActivityIndicator size="small" color={theme.textDim} />
          ) : (
            <Ionicons
              name={doc.file_type === 'pdf' ? 'document-text' : 'image'}
              size={24}
              color={doc.file_type === 'pdf' ? '#DC2626' : theme.textDim}
            />
          )}
        </View>
      )}

      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.text }} numberOfLines={1}>
          {doc.title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 11, color: theme.brand }}>
            {meta.emoji} {meta.label}
          </Text>
          {doc.doc_date ? (
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }}>
              · {format(parseISO(doc.doc_date), "d MMM yyyy", { locale: ptBR })}
            </Text>
          ) : null}
          {doc.file_type === 'pdf' ? (
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }}>· PDF</Text>
          ) : null}
        </View>
        {doc.notes ? (
          <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim, marginTop: 2 }} numberOfLines={1}>
            {doc.notes}
          </Text>
        ) : null}
      </View>

      <Pressable
        hitSlop={8}
        onPress={(e) => {
          e.stopPropagation?.();
          onDelete();
        }}
        style={{ padding: 6 }}
      >
        <Ionicons name="trash-outline" size={18} color="#9CA3AF" />
      </Pressable>
    </PressScale>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={{ marginTop: 14, gap: 6 }}>
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.text }}>{label}</Text>
      {children}
    </View>
  );
}

function inputStyle(theme: ReturnType<typeof useTheme>['theme']) {
  return {
    backgroundColor: theme.bg,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 12,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: theme.text,
  };
}
