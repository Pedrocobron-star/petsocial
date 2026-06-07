import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Confetti } from '@/components/confetti';
import { GameDifficultyPicker } from '@/components/game-difficulty-picker';
import { GameGradeBadge } from '@/components/game-grade-badge';
import { GameLeaderboard } from '@/components/game-leaderboard';
import { Button } from '@/components/ui/button';
import { FONTS } from '@/lib/fonts';
import { submitGameScore, type GameDifficulty } from '@/lib/games';
import { haptic } from '@/lib/haptics';
import { useActivePet } from '@/providers/active-pet-provider';
import { useSession } from '@/providers/session-provider';

const BG = '#140E22';
const DIFF_KEY = 'petsocial:game-diff:caminho';
const STEP_MS = 300;
const MAX_CMDS = 28;

// ============================================================================
// Fases hand-authored (D=cão, T=petisco, #=obstáculo, .=livre). Todas têm
// solução garantida (tracei à mão); o `par` (menor caminho) é calculado por BFS
// em runtime — então a pontuação por eficiência nunca depende de eu contar certo.
// O cão anda 1 célula por seta na direção absoluta; bater em parede/borda = erro.
// ============================================================================
const LEVELS: Record<GameDifficulty, string[][]> = {
  1: [
    ['D..T'],
    ['D...', '...T'],
    ['D..', '.#.', '..T'],
    ['D...', '.##.', '...T'],
    ['D.#.', '..#.', '...T'],
  ],
  2: [
    ['D....', '..#..', '....T'],
    ['D....', '###.#', '....T'],
    ['D....', '.###.', '....T'],
    ['D####', '.....', '####T'],
    ['D....', '.#.#.', '.#.#.', '....T'],
  ],
  3: [
    ['D....#', '####.#', '#....#', '#.####', '#....T'],
    ['D....', '.###.', '.#...', '.#.#.', '...#T'],
    ['D.....', '.####.', '.#..#.', '.#.##.', '.....T'],
  ],
};

type Dir = 'up' | 'down' | 'left' | 'right';
const DIRS: Record<Dir, [number, number]> = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
};
const ARROW: Record<Dir, string> = { up: '⬆️', down: '⬇️', left: '⬅️', right: '➡️' };

interface Parsed {
  rows: number;
  cols: number;
  start: [number, number];
  treat: [number, number];
  wall: Set<string>;
}
const cellKey = (r: number, c: number) => `${r},${c}`;

function parseLevel(grid: string[]): Parsed {
  const rows = grid.length;
  const cols = grid[0].length;
  let start: [number, number] = [0, 0];
  let treat: [number, number] = [0, 0];
  const wall = new Set<string>();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = grid[r][c];
      if (ch === 'D') start = [r, c];
      else if (ch === 'T') treat = [r, c];
      else if (ch === '#') wall.add(cellKey(r, c));
    }
  }
  return { rows, cols, start, treat, wall };
}

/** Menor número de passos do cão até o petisco (BFS). 99 se não houver caminho. */
function bfsPar(p: Parsed): number {
  const q: [number, number, number][] = [[p.start[0], p.start[1], 0]];
  const seen = new Set<string>([cellKey(p.start[0], p.start[1])]);
  while (q.length) {
    const [r, c, d] = q.shift()!;
    if (r === p.treat[0] && c === p.treat[1]) return d;
    for (const [dr, dc] of Object.values(DIRS)) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= p.rows || nc >= p.cols) continue;
      const k = cellKey(nr, nc);
      if (p.wall.has(k) || seen.has(k)) continue;
      seen.add(k);
      q.push([nr, nc, d + 1]);
    }
  }
  return 99;
}

type Phase = 'idle' | 'playing' | 'over';

export default function CaminhoGameScreen() {
  const { activePet } = useActivePet();
  const { session } = useSession();
  const qc = useQueryClient();
  const userId = session?.user.id;
  const dogEmoji = activePet?.species === 'cat' ? '🐈' : '🐕';

  const [difficulty, setDifficulty] = useState<GameDifficulty>(2);
  const [phase, setPhase] = useState<Phase>('idle');
  const [levelIdx, setLevelIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [commands, setCommands] = useState<Dir[]>([]);
  const [dogPos, setDogPos] = useState<[number, number]>([0, 0]);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const aliveRef = useRef(true);
  const scoreRef = useRef(0);
  scoreRef.current = score;
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const levels = LEVELS[difficulty];
  const level = useMemo(() => parseLevel(levels[levelIdx] ?? levels[0]), [levels, levelIdx]);
  const par = useMemo(() => bfsPar(level), [level]);

  // dificuldade escolhida persiste (default 2 / Médio)
  useEffect(() => {
    AsyncStorage.getItem(DIFF_KEY)
      .then((v) => {
        const n = v ? parseInt(v, 10) : NaN;
        if (n === 1 || n === 2 || n === 3) setDifficulty(n);
      })
      .catch(() => {});
  }, []);

  const changeDifficulty = (d: GameDifficulty) => {
    setDifficulty(d);
    AsyncStorage.setItem(DIFF_KEY, String(d)).catch(() => {});
  };

  const start = () => {
    const first = parseLevel(levels[0]);
    setLevelIdx(0);
    setScore(0);
    setCommands([]);
    setDogPos(first.start);
    setMessage(null);
    setRunning(false);
    setPhase('playing');
  };

  const addCmd = (dir: Dir) => {
    if (running) return;
    setMessage(null);
    setCommands((c) => (c.length >= MAX_CMDS ? c : [...c, dir]));
    haptic.light();
  };
  const undoCmd = () => {
    if (running) return;
    setCommands((c) => c.slice(0, -1));
  };
  const clearCmds = () => {
    if (running) return;
    setCommands([]);
    setDogPos(level.start);
    setMessage(null);
  };

  const advanceOrFinish = (gainedTotal: number) => {
    if (levelIdx + 1 < levels.length) {
      const next = parseLevel(levels[levelIdx + 1]);
      setLevelIdx(levelIdx + 1);
      setCommands([]);
      setDogPos(next.start);
      setMessage(null);
    } else {
      setPhase('over');
      if (userId && gainedTotal > 0) {
        submitGameScore({ game: 'caminho', score: gainedTotal, petId: activePet?.id ?? null, userId, difficulty })
          .then(() => {
            qc.invalidateQueries({ queryKey: ['game-leaderboard', 'caminho'] });
            qc.invalidateQueries({ queryKey: ['game-my-rank', 'caminho'] });
            qc.invalidateQueries({ queryKey: ['game-streak'] });
          })
          .catch(() => {});
      }
    }
  };

  const run = () => {
    if (running || commands.length === 0) return;
    setRunning(true);
    setMessage(null);
    let pos: [number, number] = [level.start[0], level.start[1]];
    setDogPos(pos);
    let i = 0;

    const tick = () => {
      if (!aliveRef.current) return;
      if (i >= commands.length) {
        // acabaram as setas sem chegar
        setRunning(false);
        setDogPos(level.start);
        setMessage({ text: `Quase! O ${dogEmoji === '🐈' ? 'gato' : 'Au-Au'} parou no meio do caminho.`, ok: false });
        haptic.warning();
        return;
      }
      const [dr, dc] = DIRS[commands[i]];
      const nr = pos[0] + dr;
      const nc = pos[1] + dc;
      i++;
      if (nr < 0 || nc < 0 || nr >= level.rows || nc >= level.cols || level.wall.has(cellKey(nr, nc))) {
        // bateu
        setRunning(false);
        setDogPos(level.start);
        setMessage({ text: 'Ops! Bateu num obstáculo. Ajusta as setas e tenta de novo.', ok: false });
        haptic.error();
        return;
      }
      pos = [nr, nc];
      setDogPos(pos);
      if (pos[0] === level.treat[0] && pos[1] === level.treat[1]) {
        // chegou!
        const used = i;
        const bonus = Math.max(0, 50 - Math.max(0, used - par) * 15);
        const gained = 100 + bonus;
        const total = scoreRef.current + gained;
        setScore(total);
        setRunning(false);
        setMessage({
          text: bonus >= 50 ? `Perfeito! +${gained} 🌟` : `Boa! +${gained}`,
          ok: true,
        });
        haptic.success();
        setTimeout(() => {
          if (aliveRef.current) advanceOrFinish(total);
        }, 1100);
        return;
      }
      setTimeout(tick, STEP_MS);
    };
    setTimeout(tick, STEP_MS);
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <Stack.Screen
        options={{
          title: '🐕 Caminho do Au-Au',
          headerShown: true,
          headerStyle: { backgroundColor: BG },
          headerTintColor: '#fff',
          headerTitleStyle: { color: '#fff', fontFamily: FONTS.display },
        }}
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 16 }}>
        {phase === 'idle' ? (
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderRadius: 20,
              padding: 20,
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Text style={{ fontSize: 44 }}>🐕</Text>
            <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: '#fff', textAlign: 'center' }}>
              Caminho do Au-Au
            </Text>
            <Text
              style={{
                fontFamily: FONTS.body,
                fontSize: 13,
                color: 'rgba(255,255,255,0.75)',
                textAlign: 'center',
                lineHeight: 19,
              }}
            >
              Monte a sequência de setas e toque em ▶️ — o pet anda sozinho até o petisco 🦴, desviando dos
              obstáculos 🌵. Resolva as fases usando o mínimo de setas!
            </Text>
            <GameGradeBadge game="caminho" variant="idle" />
            <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
              Dificuldade
            </Text>
            <GameDifficultyPicker value={difficulty} onChange={changeDifficulty} disabled={false} />
            <Button title="Jogar" onPress={start} fullWidth />
          </View>
        ) : null}

        {phase === 'playing' ? (
          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#fff' }}>
                Fase {levelIdx + 1}/{levels.length}
              </Text>
              <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: '#FBBF24' }}>{score} pts</Text>
            </View>

            <Board level={level} dogPos={dogPos} dogEmoji={dogEmoji} />

            {message ? (
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 13.5,
                  color: message.ok ? '#34D399' : '#FCA5A5',
                  textAlign: 'center',
                }}
              >
                {message.text}
              </Text>
            ) : (
              <Text
                style={{ fontFamily: FONTS.body, fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}
              >
                Melhor caminho: {par} {par === 1 ? 'passo' : 'passos'}
              </Text>
            )}

            {/* fila de comandos */}
            <View
              style={{
                minHeight: 44,
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 6,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: 12,
                padding: 8,
              }}
            >
              {commands.length === 0 ? (
                <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                  Toque nas setas pra montar o caminho
                </Text>
              ) : (
                commands.map((d, i) => (
                  <Text key={i} style={{ fontSize: 20 }}>
                    {ARROW[d]}
                  </Text>
                ))
              )}
            </View>

            {/* botões de seta */}
            <View style={{ alignItems: 'center', gap: 8 }}>
              <ArrowBtn dir="up" onPress={addCmd} disabled={running} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <ArrowBtn dir="left" onPress={addCmd} disabled={running} />
                <ArrowBtn dir="down" onPress={addCmd} disabled={running} />
                <ArrowBtn dir="right" onPress={addCmd} disabled={running} />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={undoCmd}
                disabled={running || commands.length === 0}
                style={{
                  paddingVertical: 11,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  opacity: running || commands.length === 0 ? 0.4 : 1,
                }}
              >
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#fff' }}>↶ Desfazer</Text>
              </Pressable>
              <Pressable
                onPress={clearCmds}
                disabled={running || commands.length === 0}
                style={{
                  paddingVertical: 11,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  opacity: running || commands.length === 0 ? 0.4 : 1,
                }}
              >
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#fff' }}>🗑 Limpar</Text>
              </Pressable>
              <Pressable
                onPress={run}
                disabled={running || commands.length === 0}
                style={{
                  flex: 1,
                  paddingVertical: 11,
                  borderRadius: 12,
                  alignItems: 'center',
                  backgroundColor: '#F97316',
                  opacity: running || commands.length === 0 ? 0.5 : 1,
                }}
              >
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#fff' }}>
                  {running ? '🐾 Andando…' : '▶️ Executar'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {phase === 'over' ? (
          <View style={{ gap: 14 }}>
            <View
              style={{
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: 20,
                padding: 22,
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Text style={{ fontSize: 44 }}>🏆</Text>
              <Text style={{ fontFamily: FONTS.display, fontSize: 28, color: '#FBBF24' }}>{score} pts</Text>
              <Text
                style={{ fontFamily: FONTS.body, fontSize: 13, color: 'rgba(255,255,255,0.75)', textAlign: 'center' }}
              >
                Você guiou o {dogEmoji} por todas as fases! Tente um nível mais difícil pra multiplicar os pontos.
              </Text>
              <Button title="Jogar de novo" onPress={start} fullWidth />
            </View>
            <GameLeaderboard game="caminho" limit={20} currentUserId={userId} />
          </View>
        ) : null}
      </ScrollView>
      {phase === 'over' ? <Confetti count={48} /> : null}
    </View>
  );
}

function ArrowBtn({ dir, onPress, disabled }: { dir: Dir; onPress: (d: Dir) => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={() => onPress(dir)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Seta ${dir}`}
      style={{
        width: 56,
        height: 56,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.10)',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text style={{ fontSize: 26 }}>{ARROW[dir]}</Text>
    </Pressable>
  );
}

function Board({
  level,
  dogPos,
  dogEmoji,
}: {
  level: Parsed;
  dogPos: [number, number];
  dogEmoji: string;
}) {
  // célula encolhe pra caber tabuleiros maiores (Difícil tem 6 colunas)
  const cell = level.cols >= 6 ? 44 : level.cols >= 5 ? 50 : 58;
  return (
    <View style={{ alignSelf: 'center', gap: 5 }}>
      {Array.from({ length: level.rows }).map((_, r) => (
        <View key={r} style={{ flexDirection: 'row', gap: 5 }}>
          {Array.from({ length: level.cols }).map((_, c) => {
            const isDog = dogPos[0] === r && dogPos[1] === c;
            const isTreat = level.treat[0] === r && level.treat[1] === c;
            const isWall = level.wall.has(cellKey(r, c));
            return (
              <View
                key={c}
                style={{
                  width: cell,
                  height: cell,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isWall ? 'rgba(124,58,237,0.20)' : 'rgba(255,255,255,0.06)',
                  borderWidth: isWall ? 1 : 0,
                  borderColor: 'rgba(167,139,250,0.4)',
                }}
              >
                <Text style={{ fontSize: cell * 0.5 }}>
                  {isDog ? dogEmoji : isWall ? '🌵' : isTreat ? '🦴' : ''}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
