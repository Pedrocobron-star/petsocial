import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MetaTags } from '@/components/meta-tags';
import { CenteredColumn } from '@/components/ui/centered-column';
import {
  BR_STATES,
  fetchEndorsementByToken,
  submitEndorsement,
} from '@/lib/endorsements';
import { FONTS } from '@/lib/fonts';

/**
 * Página PÚBLICA de endosso veterinário — acessada pelo vet via link
 * /endorse/{token}. Sem login. O vet vê o resumo do pet + vacinas e endossa
 * com nome + CRMV.
 *
 * Honestidade: deixamos claro na tela que isto é um ENDOSSO (identificação +
 * confirmação dos dados pelo profissional), não uma assinatura ICP-Brasil.
 */
export default function PublicEndorseScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const qc = useQueryClient();

  const [vetName, setVetName] = useState('');
  const [crmvNumber, setCrmvNumber] = useState('');
  const [crmvState, setCrmvState] = useState('');
  const [vetNotes, setVetNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [statePickerOpen, setStatePickerOpen] = useState(false);

  const query = useQuery({
    queryKey: ['endorse', token],
    queryFn: () => fetchEndorsementByToken(token),
    enabled: !!token,
  });

  const data = query.data;

  const mutation = useMutation({
    mutationFn: () =>
      submitEndorsement({
        token,
        vetName: vetName.trim(),
        crmvNumber: crmvNumber.trim(),
        crmvState: crmvState || undefined,
        vetNotes: vetNotes.trim() || undefined,
      }),
    onSuccess: (res) => {
      if (res.ok) {
        qc.invalidateQueries({ queryKey: ['endorse', token] });
      } else {
        setFormError(
          res.error === 'invalid_data'
            ? 'Preencha nome e número do CRMV.'
            : res.error?.startsWith('already_')
              ? 'Este pedido já foi respondido.'
              : 'Não foi possível registrar. Tente de novo.',
        );
      }
    },
    onError: () => setFormError('Erro de conexão. Tente de novo.'),
  });

  const onSubmit = () => {
    setFormError(null);
    if (vetName.trim().length < 2) {
      setFormError('Informe seu nome completo.');
      return;
    }
    if (crmvNumber.trim().length < 1) {
      setFormError('Informe o número do seu CRMV.');
      return;
    }
    mutation.mutate();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFBF5' }}>
      <Stack.Screen options={{ headerShown: false }} />
      <MetaTags
        title="Endosso veterinário · Pet Social"
        description="Confirme e endosse a carteirinha de saúde deste pet."
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <CenteredColumn maxWidth={520}>
          {/* Brand header */}
          <View style={{ alignItems: 'center', paddingTop: 28, paddingBottom: 12, gap: 4 }}>
            <Text style={{ fontSize: 32 }}>🐾</Text>
            <Text style={{ fontFamily: FONTS.display, fontSize: 20, color: '#1A1410' }}>
              Pet Social
            </Text>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#16A34A', letterSpacing: 0.8 }}>
              ENDOSSO VETERINÁRIO
            </Text>
          </View>

          {query.isLoading ? (
            <ActivityIndicator color="#F97316" style={{ padding: 40 }} />
          ) : null}

          {/* Token inválido */}
          {data && !data.found ? (
            <Card>
              <Text style={{ fontSize: 36, textAlign: 'center' }}>🔗</Text>
              <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: '#1A1410', textAlign: 'center' }}>
                Link inválido ou expirado
              </Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: '#525252', textAlign: 'center', lineHeight: 20 }}>
                Peça ao tutor pra gerar um novo link de endosso no app.
              </Text>
            </Card>
          ) : null}

          {/* Já assinado (ou acabou de assinar) */}
          {data?.found && data.status === 'signed' ? (
            <Card>
              <View
                style={{
                  width: 64, height: 64, borderRadius: 32, backgroundColor: '#DCFCE7',
                  alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
                }}
              >
                <Ionicons name="checkmark-circle" size={40} color="#16A34A" />
              </View>
              <Text style={{ fontFamily: FONTS.display, fontSize: 20, color: '#1A1410', textAlign: 'center' }}>
                Endosso registrado!
              </Text>
              {data.endorsement ? (
                <View style={{ backgroundColor: '#F0FDF4', borderRadius: 12, padding: 14, gap: 4 }}>
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#166534' }}>
                    {data.endorsement.vet_name}
                  </Text>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: '#166534' }}>
                    CRMV{data.endorsement.crmv_state ? `-${data.endorsement.crmv_state}` : ''}{' '}
                    {data.endorsement.crmv_number}
                  </Text>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: '#15803D' }}>
                    {format(parseISO(data.endorsement.signed_at), "d 'de' MMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                  </Text>
                </View>
              ) : null}
              <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: '#525252', textAlign: 'center', lineHeight: 19 }}>
                O endosso aparece agora na carteirinha de {data.pet?.name}. Obrigado por confirmar! 🐾
              </Text>
            </Card>
          ) : null}

          {/* Pendente — formulário de endosso */}
          {data?.found && data.status === 'pending' && data.pet ? (
            <View style={{ gap: 14, paddingHorizontal: 16 }}>
              {/* Resumo do pet */}
              <Card>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#9A3412', letterSpacing: 1, textTransform: 'uppercase' }}>
                  Pet a endossar
                </Text>
                <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: '#1A1410' }}>
                  {data.pet.name}
                </Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: '#525252' }}>
                  {speciesPt(data.pet.species)}
                  {data.pet.breed ? ` · ${data.pet.breed}` : ''}
                  {data.pet.birthdate ? ` · nasc. ${format(parseISO(data.pet.birthdate), 'd MMM yyyy', { locale: ptBR })}` : ''}
                </Text>
                {data.tutor?.display_name ? (
                  <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: '#737373' }}>
                    Tutor: {data.tutor.display_name}
                  </Text>
                ) : null}
                {data.pet.microchip_number || data.pet.sinpatinhas_id ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 2 }}>
                    {data.pet.microchip_number ? (
                      <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#737373' }}>
                        Microchip: {data.pet.microchip_number}
                      </Text>
                    ) : null}
                    {data.pet.sinpatinhas_id ? (
                      <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#737373' }}>
                        SinPatinhas: {data.pet.sinpatinhas_id}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </Card>

              {/* Vacinas */}
              {data.vaccines && data.vaccines.length > 0 ? (
                <Card>
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#9A3412', letterSpacing: 1, textTransform: 'uppercase' }}>
                    Vacinas registradas ({data.vaccines.length})
                  </Text>
                  <View style={{ gap: 8, marginTop: 2 }}>
                    {data.vaccines.slice(0, 8).map((v, i) => (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="medkit-outline" size={15} color="#16A34A" />
                        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#1A1410', flex: 1 }} numberOfLines={1}>
                          {v.name}
                        </Text>
                        <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: '#737373' }}>
                          {format(parseISO(v.applied_at), 'd MMM yy', { locale: ptBR })}
                        </Text>
                      </View>
                    ))}
                  </View>
                </Card>
              ) : null}

              {/* Formulário do vet */}
              <Card>
                <Text style={{ fontFamily: FONTS.display, fontSize: 16, color: '#1A1410' }}>
                  Confirme e endosse
                </Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: '#525252', lineHeight: 17, marginBottom: 4 }}>
                  Como veterinário(a), você confirma que reviu os dados acima. Seu nome e CRMV ficam registrados na carteirinha.
                </Text>

                <Input label="Seu nome completo" value={vetName} onChange={setVetName} placeholder="Ex: Dra. Carla Mendes" />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 2 }}>
                    <Input label="Número CRMV" value={crmvNumber} onChange={setCrmvNumber} placeholder="Ex: 12345" keyboardType="number-pad" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#1A1410', marginBottom: 6 }}>UF</Text>
                    <Pressable
                      onPress={() => setStatePickerOpen((v) => !v)}
                      style={{
                        backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E7E2DA',
                        borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                      }}
                    >
                      <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: crmvState ? '#1A1410' : '#A8A29E' }}>
                        {crmvState || '—'}
                      </Text>
                      <Ionicons name="chevron-down" size={14} color="#737373" />
                    </Pressable>
                  </View>
                </View>
                {statePickerOpen ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: -4 }}>
                    {BR_STATES.map((uf) => (
                      <Pressable
                        key={uf}
                        onPress={() => { setCrmvState(uf); setStatePickerOpen(false); }}
                        style={{
                          paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
                          backgroundColor: crmvState === uf ? '#16A34A' : '#F0FDF4',
                        }}
                      >
                        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: crmvState === uf ? '#FFF' : '#166534' }}>
                          {uf}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                <Input label="Observação (opcional)" value={vetNotes} onChange={setVetNotes} placeholder="Ex: Tudo conferido no exame de hoje" multiline />

                {formError ? (
                  <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 13, color: '#DC2626' }}>{formError}</Text>
                ) : null}

                <Pressable
                  onPress={onSubmit}
                  disabled={mutation.isPending}
                  style={{
                    backgroundColor: '#16A34A', paddingVertical: 15, borderRadius: 12,
                    alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
                    opacity: mutation.isPending ? 0.6 : 1,
                  }}
                >
                  <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: '#FFFFFF' }}>
                    {mutation.isPending ? 'Registrando...' : 'Endossar carteirinha'}
                  </Text>
                </Pressable>

                <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#A8A29E', textAlign: 'center', lineHeight: 16 }}>
                  Este é um endosso de identificação profissional. Não substitui assinatura digital
                  certificada (ICP-Brasil) nem responsabiliza por dados que você não verificou.
                </Text>
              </Card>
            </View>
          ) : null}
        </CenteredColumn>
      </ScrollView>
    </SafeAreaView>
  );
}

// ----------------------------------------------------------------------------

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: '#FFFFFF', borderRadius: 18, padding: 20, marginHorizontal: 16, marginTop: 12,
        gap: 8, borderWidth: 1, borderColor: '#F1ECE5',
        shadowColor: '#1A1410', shadowOpacity: 0.04, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
      }}
    >
      {children}
    </View>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'number-pad';
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#1A1410' }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#A8A29E"
        multiline={multiline}
        keyboardType={keyboardType}
        style={{
          backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E7E2DA', borderRadius: 10,
          padding: 12, fontFamily: FONTS.body, fontSize: 14, color: '#1A1410',
          minHeight: multiline ? 60 : undefined, textAlignVertical: multiline ? 'top' : 'auto',
        }}
      />
    </View>
  );
}

function speciesPt(species: string): string {
  return (
    {
      dog: 'Cão', cat: 'Gato', bird: 'Pássaro', rabbit: 'Coelho',
      reptile: 'Réptil', rodent: 'Roedor', fish: 'Peixe', other: 'Pet',
    }[species] ?? 'Pet'
  );
}
