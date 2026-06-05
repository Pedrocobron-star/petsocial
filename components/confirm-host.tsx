import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { registerConfirmHost, type ConfirmRequest } from '@/lib/confirm';
import { FONTS } from '@/lib/fonts';

/**
 * Host global do modal de confirmação estilizado (substitui o window.confirm
 * nativo no web). Montado uma vez no _layout. Recebe pedidos via
 * `lib/confirm.ts` (que o shim de Alert.alert aciona).
 */
export function ConfirmHost() {
  const [req, setReq] = useState<ConfirmRequest | null>(null);

  useEffect(() => {
    registerConfirmHost((r) => setReq(r));
    return () => registerConfirmHost(null);
  }, []);

  if (!req) return null;

  const close = () => setReq(null);
  const buttons = req.buttons && req.buttons.length > 0 ? req.buttons : [{ text: 'OK' }];

  return (
    <Modal transparent animationType="fade" visible onRequestClose={close}>
      <Pressable
        onPress={close}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        {/* Card — para a propagação pra não fechar ao clicar dentro */}
        <Pressable
          onPress={(e) => (e as { stopPropagation?: () => void }).stopPropagation?.()}
          style={{
            width: '100%',
            maxWidth: 380,
            backgroundColor: '#fff',
            borderRadius: 18,
            padding: 20,
          }}
        >
          <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: '#1A1410' }}>
            {req.title}
          </Text>
          {req.message ? (
            <Text
              style={{
                fontFamily: FONTS.body,
                fontSize: 14,
                lineHeight: 20,
                color: '#57534E',
                marginTop: 4,
              }}
            >
              {req.message}
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
            {buttons.map((b, i) => {
              const isCancel = b.style === 'cancel';
              const isDestructive = b.style === 'destructive';
              return (
                <Pressable
                  key={i}
                  onPress={() => {
                    close();
                    b.onPress?.();
                  }}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 10,
                    backgroundColor: isCancel ? '#F5F5F4' : isDestructive ? '#DC2626' : '#F97316',
                  }}
                  accessibilityLabel={b.text}
                >
                  <Text
                    style={{
                      fontFamily: FONTS.bodyBold,
                      fontSize: 14,
                      color: isCancel ? '#57534E' : '#fff',
                    }}
                  >
                    {b.text ?? 'OK'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
