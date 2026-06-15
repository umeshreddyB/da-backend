export const ACHIEVEMENTS = [
  { id: 'first_day', title: 'First Day Completed', description: 'Complete your first study day' },
  { id: 'first_week', title: 'First Week Completed', description: 'Complete an entire week' },
  { id: 'streak_7', title: '7-Day Streak', description: 'Study 7 days in a row' },
  { id: 'streak_30', title: '30-Day Streak', description: 'Study 30 days in a row' },
  { id: 'streak_50', title: '50-Day Streak', description: 'Study 50 days in a row' },
  { id: 'halfway', title: 'Halfway Through', description: 'Complete half the study plan' },
  { id: 'phase_master', title: 'Phase Master', description: 'Complete an entire phase' },
  { id: 'days_100', title: '100 Days Completed', description: 'Complete 100 study days' },
  { id: 'champion', title: 'System Design Champion', description: 'Complete the full study plan' },
];

export function checkAchievements({ allDays, dayDone, dayActivity, achievements, phases, totalPlanDays }) {
  const unlocked = new Set((achievements || []).map((a) => a.id));
  const newlyUnlocked = [];
  const now = new Date();

  const doneCount = allDays.filter((d) => dayDone[`d${d._n}`]).length;
  const totalDays = totalPlanDays || allDays.length;
  const halfway = Math.floor(totalDays / 2);
  const streaks = computeStreakFromActivity(dayActivity);

  const checks = [
    { id: 'first_day', condition: doneCount >= 1 },
    { id: 'first_week', condition: allDays.filter((d) => d.week === 1).every((d) => dayDone[`d${d._n}`]) },
    { id: 'streak_7', condition: streaks.current >= 7 || streaks.longest >= 7 },
    { id: 'streak_30', condition: streaks.current >= 30 || streaks.longest >= 30 },
    { id: 'streak_50', condition: streaks.current >= 50 || streaks.longest >= 50 },
    { id: 'halfway', condition: doneCount >= halfway },
    { id: 'days_100', condition: doneCount >= 100 },
    { id: 'champion', condition: doneCount >= totalDays },
  ];

  for (const phase of phases || []) {
    const phaseDays = allDays.filter((d) => d.phase === phase.id);
    if (phaseDays.length && phaseDays.every((d) => dayDone[`d${d._n}`])) {
      checks.push({ id: 'phase_master', condition: true });
      break;
    }
  }

  for (const check of checks) {
    if (check.condition && !unlocked.has(check.id)) {
      newlyUnlocked.push({ id: check.id, unlockedAt: now });
      unlocked.add(check.id);
    }
  }

  return newlyUnlocked;
}

function computeStreakFromActivity(dayActivity) {
  const dates = new Set();
  Object.values(dayActivity || {}).forEach((a) => {
    if (a?.lastStudiedAt) {
      const d = new Date(a.lastStudiedAt);
      dates.add(d.toISOString().slice(0, 10));
    }
  });
  const sorted = [...dates].sort();
  if (!sorted.length) return { current: 0, longest: 0 };

  let longest = 1;
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = Math.round((curr - prev) / 86400000);
    if (diff === 1) streak += 1;
    else {
      longest = Math.max(longest, streak);
      streak = 1;
    }
  }
  longest = Math.max(longest, streak);

  let current = 0;
  let check = new Date();
  check.setHours(0, 0, 0, 0);
  while (true) {
    const key = check.toISOString().slice(0, 10);
    if (dates.has(key)) {
      current += 1;
      check.setDate(check.getDate() - 1);
    } else break;
  }

  return { current, longest };
}
