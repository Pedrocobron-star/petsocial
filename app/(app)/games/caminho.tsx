import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Confetti } from '@/components/confetti';
import { GameDifficultyPicker } from '@/components/game-difficulty-picker';
import { GameGradeBadge } from '@/components/game-grade-badge';
import { GameLeaderboard } from '@/components/game-leaderboard';
import { GameResultShareButton } from '@/components/game-result-share-button';
import { TournamentGameBanner } from '@/components/tournament-game-banner';
import { Button } from '@/components/ui/button';
import { FONTS } from '@/lib/fonts';
import { beginGameSession, invalidateGameQueries, submitGameScore, type GameDifficulty } from '@/lib/games';
import { haptic } from '@/lib/haptics';
import { useActivePet } from '@/providers/active-pet-provider';
import { useSession } from '@/providers/session-provider';
import { useToast } from '@/providers/toast-provider';

const BG = '#140E22';
const DIFF_KEY = 'petsocial:game-diff:caminho';
const STEP_MS = 170; // antes 300 — execução mais ágil
const ADVANCE_MS = 750; // antes 1100
const MAX_CMDS = 32;
const LEVELS_PER_RUN = 8;

// fases GERADAS (nunca acabam, sempre diferentes). Parâmetros por tier:
const GRID_SIZE: Record<GameDifficulty, number> = { 1: 4, 2: 5, 3: 6 };
const WALL_DENSITY: Record<GameDifficulty, number> = { 1: 0.12, 2: 0.18, 3: 0.24 };
const NUM_COLLECTIBLES: Record<GameDifficulty, number> = { 1: 1, 2: 2, 3: 2 };

type Dir = 'up' | 'down' | 'left' | 'right';
const DIRS: Record<Dir, [number, number]> = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
const ARROW: Record<Dir, string> = { up: '⬆️', down: '⬇️', left: '⬅️', right: '➡️' };

interface Level {
  rows: number;
  cols: number;
  start: [number, number];
  treat: [number, number];
  walls: Set<string>;
  collectibles: Set<string>;
}
const cellKey = (r: number, c: number) => `${r},${c}`;

/** Menor número de passos até o petisco (BFS). 99 se não houver caminho. */
function bfsPar(p: Level): number {
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
      if (p.walls.has(k) || seen.has(k)) continue;
      seen.add(k);
      q.push([nr, nc, d + 1]);
    }
  }
  return 99;
}

/** Conjunto de células alcançáveis a partir do início (ignora coletáveis). */
function bfsReachable(p: Level): Set<string> {
  const seen = new Set<string>([cellKey(p.start[0], p.start[1])]);
  const q: [number, number][] = [[p.start[0], p.start[1]]];
  while (q.length) {
    const [r, c] = q.shift()!;
    for (const [dr, dc] of Object.values(DIRS)) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= p.rows || nc >= p.cols) continue;
      const k = cellKey(nr, nc);
      if (p.walls.has(k) || seen.has(k)) continue;
      seen.add(k);
      q.push([nr, nc]);
    }
  }
  return seen;
}

/** Gera uma fase resolvível (validada por BFS), com coletáveis em células alcançáveis. */
function genLevel(diff: GameDifficulty, idx: number): Level {
  let n = GRID_SIZE[diff] + (idx >= 4 ? 1 : 0);
  n = Math.min(n, 6);
  const rows = n;
  const cols = n;
  const density = WALL_DENSITY[diff];
  const numColl = NUM_COLLECTIBLES[diff];
  const leftMax = Math.max(1, Math.floor(cols / 2));
  const rightStart = Math.ceil(cols / 2);
  for (let attempt = 0; attempt < 90; attempt++) {
    const start: [number, number] = [Math.floor(Math.random() * rows), Math.floor(Math.random() * leftMax)];
    const treat: [number, number] = [
      Math.floor(Math.random() * rows),
      Math.min(cols - 1, rightStart + Math.floor(Math.random() * Math.max(1, cols - rightStart))),
    ];
    if (start[0] === treat[0] && start[1] === treat[1]) continue;
    const walls = new Set<string>();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const k = cellKey(r, c);
        if (k === cellKey(start[0], start[1]) || k === cellKey(treat[0], treat[1])) continue;
        if (Math.random() < density) walls.add(k);
      }
    }
    const level: Level = { rows, cols, start, treat, walls, collectibles: new Set() };
    const par = bfsPar(level);
    if (par >= 99 || par < 2) continue; // precisa ter caminho e não ser trivial
    const reach = bfsReachable(level);
    const cands = [...reach].filter((k) => k !== cellKey(start[0], start[1]) && k !== cellKey(treat[0], treat[1]));
    if (cands.length < numColl) continue;
    for (let i = cands.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cands[i], cands[j]] = [cands[j], cands[i]];
    }
    level.collectibles = new Set(cands.slice(0, numColl));
    return level;
  }
  // fallback garantido (sem paredes) — só chega aqui se 90 tentativas falharem (raro)
  console.warn(`[caminho] genLevel usou fallback (diff=${diff}, idx=${idx})`);
  return { rows, cols, start: [0, 0], treat: [rows - 1, cols - 1], walls: new Set(), collectibles: new Set([cellKey(0, cols - 1)]) };
}

type Phase = 'idle' | 'playing' | 'over';

export default function CaminhoGameScreen() {
  const { activePet } = useActivePet();
  const { session } = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const userId = session?.user.id;
  const dogEmoji = activePet?.species === 'cat' ? '🐈' : '🐕';

  const [difficulty, setDifficulty] = useState<GameDifficulty>(2);
  const [phase, setPhase] = useState<Phase>('idle');
  const [levelIdx, setLevelIdx] = useState(0);
  const [level, setLevel] = useState<Level>(() => genLevel(2, 0));
  const [score, setScore] = useState(0);
  const [stars, setStars] = useState(0);
  const [commands, setCommands] = useState<Dir[]>([]);
  const [dogPos, setDogPos] = useState<[number, number]>([0, 0]);
  const [collected, setCollected] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean; stars?: number } | null>(null);

  const aliveRef = useRef(true);
  const scoreRef = useRef(0);
  const starsRef = useRef(0);
  const levelRef = useRef<Level>(level);
  const collectedRef = useRef<Set<string>>(new Set());
  const sessionRef = useRef<string | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  scoreRef.current = score;
  levelRef.current = level;
  // par (menor caminho) memoizado: roda só quando a fase muda, não a cada passo do cão
  const par = useMemo(() => bfsPar(level), [level]);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (tickTimerRef.current) clearTimeout(tickTimerRef.current);
      if (advTimerRef.current) clearTimeout(advTimerRef.current);
    };
  }, []);

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

  const loadLevel = (idx: number, diff: GameDifficulty) => {
    const lv = genLevel(diff, idx);
    levelRef.current = lv;
    collectedRef.current = new Set();
    setLevel(lv);
    setLevelIdx(idx);
    setDogPos(lv.start);
    setCommands([]);
    setCollected(new Set());
    setMessage(null);
    setRunning(false);
  };

  const start = () => {
    sessionRef.current = null;
    beginGameSession('caminho', difficulty)
      .then((id) => {
        sessionRef.current = id;
      })
      .catch(() => {});
    scoreRef.current = 0;
    starsRef.current = 0;
    setScore(0);
    setStars(0);
    loadLevel(0, difficulty);
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
    setDogPos(levelRef.current.start);
    setCollected(new Set());
    collectedRef.current = new Set();
    setMessage(null);
  };

  const finishOrAdvance = (gainedTotal: number) => {
    if (levelIdx + 1 < LEVELS_PER_RUN) {
      loadLevel(levelIdx + 1, difficulty);
    } else {
      setPhase('over');
      if (userId && gainedTotal > 0) {
        submitGameScore({ game: 'caminho', score: gainedTotal, petId: activePet?.id ?? null, userId, sessionId: sessionRef.current })
          .then(() => invalidateGameQueries(qc, 'caminho'))
          .catch(() => toast.error('Não consegui salvar seu score', 'Tenta de novo daqui a pouco.'));
      }
    }
  };

  const run = () => {
    if (running || commands.length === 0) return;
    const lv = levelRef.current;
    setRunning(true);
    setMessage(null);
    collectedRef.current = new Set();
    setCollected(new Set());
    let pos: [number, number] = [lv.start[0], lv.start[1]];
    setDogPos(pos);
    let i = 0;

    const tick = () => {
      if (!aliveRef.current) return;
      if (i >= commands.length) {
        setRunning(false);
        setDogPos(lv.start);
        collectedRef.current = new Set();
        setCollected(new Set());
        setMessage({ text: `Quase! O ${dogEmoji === '🐈' ? 'gato' : 'Au-Au'} parou no meio do caminho.`, ok: false });
        haptic.warning();
        return;
      }
      const [dr, dc] = DIRS[commands[i]];
      const nr = pos[0] + dr;
      const nc = pos[1] + dc;
      i++;
      if (nr < 0 || nc < 0 || nr >= lv.rows || nc >= lv.cols || lv.walls.has(cellKey(nr, nc))) {
        setRunning(false);
        setDogPos(lv.start);
        collectedRef.current = new Set();
        setCollected(new Set());
        setMessage({ text: 'Ops! Bateu num obstáculo. Ajusta as setas e tenta de novo.', ok: false });
        haptic.error();
        return;
      }
      pos = [nr, nc];
      setDogPos(pos);
      const k = cellKey(nr, nc);
      if (lv.collectibles.has(k) && !collectedRef.current.has(k)) {
        collectedRef.current.add(k);
        setCollected(new Set(collectedRef.current));
        haptic.light();
      }
      if (pos[0] === lv.treat[0] && pos[1] === lv.treat[1]) {
        const used = i;
        const effBonus = Math.max(0, 40 - Math.max(0, used - par) * 8);
        const collBonus = collectedRef.current.size * 15;
        const gained = 60 + effBonus + collBonus;
        const total = scoreRef.current + gained;
        const allColl = lv.collectibles.size === 0 || collectedRef.current.size === lv.collectibles.size;
        const efficient = used <= par + 1;
        const got = 1 + (efficient ? 1 : 0) + (allColl ? 1 : 0);
        scoreRef.current = total;
        starsRef.current += got;
        setScore(total);
        setStars(starsRef.current);
        setRunning(false);
        setMessage({ text: `+${gained}${collBonus ? `  ·  ${collectedRef.current.size} ⭐ coletado${collectedRef.current.size > 1 ? 's' : ''}` : ''}`, ok: true, stars: got });
        haptic.success();
        advTimerRef.current = setTimeout(() => {
          if (aliveRef.current) finishOrAdvance(total);
        }, ADVANCE_MS);
        return;
      }
      tickTimerRef.current = setTimeout(tick, STEP_MS);
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
          <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 20, alignItems: 'center', gap: 12 }}>
            <Text style={{ fontSize: 44 }}>🐕</Text>
            <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: '#fff', textAlign: 'center' }}>Caminho do Au-Au</Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 19 }}>
              Monte a sequência de setas e toque em ▶️: o pet anda sozinho até o petisco 🦴, desviando dos obstáculos 🌵. As fases são sempre novas! Pegue as estrelas ⭐ no caminho e resolva com o mínimo de setas pra ganhar mais pontos. {LEVELS_PER_RUN} fases por partida.
            </Text>
            <GameGradeBadge game="caminho" variant="idle" />
            <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>Dificuldade</Text>
            <GameDifficultyPicker value={difficulty} onChange={changeDifficulty} disabled={false} />
            <TournamentGameBanner game="caminho" difficulty={difficulty} onRaiseDifficulty={changeDifficulty} />
            <Button title="Jogar" onPress={start} fullWidth />
          </View>
        ) : null}

        {phase === 'playing' ? (
          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#fff' }}>
                Fase {levelIdx + 1}/{LEVELS_PER_RUN}
              </Text>
              <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: '#FBBF24' }}>{score} pts</Text>
            </View>

            <Board level={level} dogPos={dogPos} dogEmoji={dogEmoji} collected={collected} />

            {message ? (
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13.5, color: message.ok ? '#34D399' : '#FCA5A5', textAlign: 'center' }}>
                {message.ok && message.stars ? `${'⭐'.repeat(message.stars)}  ` : ''}
                {message.text}
              </Text>
            ) : (
              <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
                Melhor caminho: {par} passos{level.collectibles.size > 0 ? `  ·  ⭐ x${level.collectibles.size} no caminho` : ''}
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
                <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Toque nas setas pra montar o caminho</Text>
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
                style={{ paddingVertical: 11, paddingHorizontal: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', opacity: running || commands.length === 0 ? 0.4 : 1 }}
              >
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#fff' }}>↶ Desfazer</Text>
              </Pressable>
              <Pressable
                onPress={clearCmds}
                disabled={running || commands.length === 0}
                style={{ paddingVertical: 11, paddingHorizontal: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', opacity: running || commands.length === 0 ? 0.4 : 1 }}
              >
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#fff' }}>🗑 Limpar</Text>
              </Pressable>
              <Pressable
                onPress={run}
                disabled={running || commands.length === 0}
                style={{ flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center', backgroundColor: '#F97316', opacity: running || commands.length === 0 ? 0.5 : 1 }}
              >
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#fff' }}>{running ? '🐾 Andando…' : '▶️ Executar'}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {phase === 'over' ? (
          <View style={{ gap: 14 }}>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 22, alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 44 }}>🏆</Text>
              <Text style={{ fontFamily: FONTS.display, fontSize: 28, color: '#FBBF24' }}>{score} pts</Text>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: '#FCD34D' }}>⭐ {stars} estrelas</Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: 'rgba(255,255,255,0.75)', textAlign: 'center' }}>
                Você guiou o {dogEmoji} por {LEVELS_PER_RUN} fases! Tente um nível mais difícil pra fases maiores e mais pontos.
              </Text>
              <Button title="Jogar de novo" onPress={start} fullWidth />
              {score > 0 ? <GameResultShareButton game="caminho" score={score} difficulty={difficulty} petName={activePet?.name} /> : null}
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
      style={{ width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.10)', opacity: disabled ? 0.4 : 1 }}
    >
      <Text style={{ fontSize: 26 }}>{ARROW[dir]}</Text>
    </Pressable>
  );
}

function Board({ level, dogPos, dogEmoji, collected }: { level: Level; dogPos: [number, number]; dogEmoji: string; collected: Set<string> }) {
  const cell = level.cols >= 6 ? 44 : level.cols >= 5 ? 50 : 58;
  return (
    <View style={{ alignSelf: 'center', gap: 5 }}>
      {Array.from({ length: level.rows }).map((_, r) => (
        <View key={r} style={{ flexDirection: 'row', gap: 5 }}>
          {Array.from({ length: level.cols }).map((_, c) => {
            const k = cellKey(r, c);
            const isDog = dogPos[0] === r && dogPos[1] === c;
            const isTreat = level.treat[0] === r && level.treat[1] === c;
            const isWall = level.walls.has(k);
            const isColl = level.collectibles.has(k) && !collected.has(k);
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
                <Text style={{ fontSize: cell * 0.5 }}>{isDog ? dogEmoji : isWall ? '🌵' : isTreat ? '🦴' : isColl ? '⭐' : ''}</Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
