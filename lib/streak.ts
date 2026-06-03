/**
 * Calcula streak de dias consecutivos com pelo menos 1 post.
 * Considera "hoje" e "ontem" — se o usuário postou ontem mas não hoje, ainda conta o streak.
 * Quebra apenas se passar mais de 1 dia sem postar.
 */
export function calculateStreak(isoTimestamps: string[]): {
  current: number;
  longest: number;
  postedToday: boolean;
} {
  if (isoTimestamps.length === 0) return { current: 0, longest: 0, postedToday: false };

  // Pega só YYYY-MM-DD de cada timestamp (timezone local)
  const days = new Set<string>();
  for (const ts of isoTimestamps) {
    const d = new Date(ts);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    days.add(key);
  }
  const sortedDays = [...days].sort().reverse();

  const today = new Date();
  const todayKey = dateKey(today);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayKey = dateKey(yesterday);

  const postedToday = days.has(todayKey);

  // Streak atual: começa em hoje ou ontem (graça de 24h)
  let current = 0;
  if (postedToday || days.has(yesterdayKey)) {
    const cursor = new Date(postedToday ? today : yesterday);
    while (days.has(dateKey(cursor))) {
      current++;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  // Longest streak histórico
  let longest = sortedDays.length > 0 ? 1 : 0;
  let temp = 1;
  for (let i = 1; i < sortedDays.length; i++) {
    const prev = new Date(sortedDays[i - 1]);
    const curr = new Date(sortedDays[i]);
    const diff = Math.round((prev.getTime() - curr.getTime()) / 86400000);
    if (diff === 1) {
      temp++;
      if (temp > longest) longest = temp;
    } else {
      temp = 1;
    }
  }

  return { current, longest: Math.max(longest, current), postedToday };
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
