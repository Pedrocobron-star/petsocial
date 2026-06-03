import { Ionicons } from '@expo/vector-icons';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FONTS } from '@/lib/fonts';
import { useTheme } from '@/providers/theme-provider';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
  description?: string;
}

interface ToastContextValue {
  show: (toast: Omit<Toast, 'id'>) => void;
  success: (message: string, description?: string) => void;
  error: (message: string, description?: string) => void;
  info: (message: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const insets = useSafeAreaInsets();

  const show = useCallback((t: Omit<Toast, 'id'>) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { ...t, id }]);
  }, []);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value: ToastContextValue = {
    show,
    success: (message, description) => show({ type: 'success', message, description }),
    error: (message, description) => show({ type: 'error', message, description }),
    info: (message, description) => show({ type: 'info', message, description }),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: insets.top + 12,
          left: 16,
          right: 16,
          gap: 8,
          zIndex: 9999,
        }}
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => remove(t.id)} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

const TOAST_DURATION = 3200;

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const { theme } = useTheme();
  const translateY = useSharedValue(-80);
  const opacity = useSharedValue(0);

  // Mount animation + auto-dismiss via setTimeout (not Reanimated's withDelay,
  // because reduced-motion makes withDelay/withTiming resolve instantly and
  // the toast would be removed before showing).
  useEffect(() => {
    translateY.value = withTiming(0, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.Never,
    });
    opacity.value = withTiming(1, {
      duration: 280,
      reduceMotion: ReduceMotion.Never,
    });

    const dismissTimer = setTimeout(() => {
      translateY.value = withTiming(-80, {
        duration: 240,
        easing: Easing.in(Easing.cubic),
        reduceMotion: ReduceMotion.Never,
      });
      opacity.value = withTiming(
        0,
        { duration: 240, reduceMotion: ReduceMotion.Never },
        (finished) => {
          if (finished) {
            // runOnJS not needed — setTimeout callback already runs on JS thread
          }
        },
      );
      // Remove from state after exit animation finishes
      setTimeout(onDismiss, 260);
    }, TOAST_DURATION);

    return () => clearTimeout(dismissTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const colors = colorsFor(toast.type, theme);

  return (
    <Animated.View
      style={[
        style,
        {
          backgroundColor: colors.bg,
          borderLeftWidth: 4,
          borderLeftColor: colors.accent,
          borderRadius: 14,
          paddingVertical: 12,
          paddingHorizontal: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.18,
          shadowRadius: 16,
          elevation: 6,
        },
      ]}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          backgroundColor: colors.iconBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={colors.icon} size={18} color={colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: FONTS.bodyBold,
            fontSize: 14,
            color: colors.text,
            lineHeight: 18,
          }}
        >
          {toast.message}
        </Text>
        {toast.description ? (
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 12,
              color: colors.textDim,
              marginTop: 2,
              lineHeight: 16,
            }}
          >
            {toast.description}
          </Text>
        ) : null}
      </View>
      <Pressable hitSlop={10} onPress={onDismiss}>
        <Ionicons name="close" size={18} color={colors.textDim} />
      </Pressable>
    </Animated.View>
  );
}

function colorsFor(type: ToastType, _theme: ReturnType<typeof useTheme>['theme']) {
  switch (type) {
    case 'success':
      return {
        bg: '#FFFFFF',
        accent: '#16A34A',
        iconBg: '#DCFCE7',
        icon: 'checkmark-circle' as const,
        text: '#1A1410',
        textDim: '#525252',
      };
    case 'error':
      return {
        bg: '#FFFFFF',
        accent: '#DC2626',
        iconBg: '#FEE2E2',
        icon: 'alert-circle' as const,
        text: '#1A1410',
        textDim: '#525252',
      };
    default:
      return {
        bg: '#FFFFFF',
        accent: '#F97316',
        iconBg: '#FFEDD5',
        icon: 'information-circle' as const,
        text: '#1A1410',
        textDim: '#525252',
      };
  }
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast deve estar dentro de ToastProvider');
  return ctx;
}
