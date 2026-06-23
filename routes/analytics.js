import express from 'express';
import StudyPlan from '../models/StudyPlan.js';
import UserProgress from '../models/UserProgress.js';
import { authMiddleware } from '../middleware/auth.js';
import { serializeProgress } from '../utils/progressHelpers.js';
import {
  flattenPlan,
  computeStreaks,
  computeOverallProgress,
  computePhaseProgress,
  computeWeekProgress,
  getCurrentDayNum,
  getOverdueDays,
  getUpcomingDays,
  getRecentlyStudied,
  getTotalStudyMinutes,
  getStudyMinutesForPeriod,
  computeWeeklyConsistency,
  getWeakAndStrongTopics,
  buildHeatmapData,
  getWeeklyReport,
  getPendingRevisions,
  getDayCompletionPercent,
} from '../utils/analytics.js';
import { ACHIEVEMENTS } from '../utils/achievements.js';
import { getTotalPlanDays } from '../utils/planHelpers.js';
import { computePlanStartDate, buildScheduleHeatmap, planDayForDate } from '../utils/schedule.js';

const router = express.Router();

async function ensurePlanStartDate(progress, serialized) {
  if (serialized.settings?.planStartDate) return serialized.settings.planStartDate;
  const planStartDate = computePlanStartDate().toISOString();
  if (progress) {
    progress.settings = { ...(progress.settings?.toObject?.() || progress.settings || {}), planStartDate };
    await progress.save();
  }
  return planStartDate;
}

router.get('/', authMiddleware, async (req, res) => {
  try {
    const [plan, progress] = await Promise.all([
      StudyPlan.findOne({ version: 1 }).lean(),
      UserProgress.findOne({ userId: req.userId }),
    ]);

    if (!plan) return res.status(404).json({ message: 'Plan not found' });

    const serialized = serializeProgress(progress);
    const planStartDate = await ensurePlanStartDate(progress, serialized);
    const allDaysRaw = flattenPlan(plan.weeks);
    const totalPlanDays = getTotalPlanDays(plan.weeks);
    const currentDayNum = getCurrentDayNum(allDaysRaw, serialized.dayDone);

    const allDays = allDaysRaw.map((d) => ({
      _n: d._n,
      lbl: d.lbl,
      topic: d.topic,
      week: d.week,
      phase: d.phase,
      weekTitle: d.weekTitle,
      practice: d.practice,
      tasks: d.tasks,
      status: serialized.dayDone[`d${d._n}`]
        ? 'completed'
        : getDayCompletionPercent(d._n, serialized.checked, d.tasks.length) > 0
          ? 'partial'
          : 'not_started',
      completionPct: getDayCompletionPercent(d._n, serialized.checked, d.tasks.length),
      studyMinutes: serialized.dayActivity[`d${d._n}`]?.studyMinutes || 0,
      isBookmarked: (serialized.bookmarks || []).includes(d._n),
    }));

    const currentDay = allDays.find((d) => d._n === currentDayNum) || allDays[allDays.length - 1];
    const streaks = computeStreaks(serialized.dayActivity);
    const doneCount = allDays.filter((d) => serialized.dayDone[`d${d._n}`]).length;
    let tasksChecked = 0;
    allDays.forEach((day) => {
      day.tasks.forEach((_, i) => {
        if (serialized.checked[`${day._n}_${i}`]) tasksChecked += 1;
      });
    });

    const phaseProgress = plan.phases.map((p) => ({
      id: p.id,
      label: p.label,
      progress: computePhaseProgress(allDays, serialized.dayDone, p.id),
    }));

    const heatmap = buildScheduleHeatmap(allDaysRaw, planStartDate, serialized.checked, serialized.dayDone);
    Object.values(heatmap).forEach((entry) => {
      entry.studyMinutes = serialized.dayActivity[`d${entry.dayNum}`]?.studyMinutes || 0;
    });

    res.json({
      planStartDate,
      scheduledToday: planDayForDate(new Date(), planStartDate, serialized.dayDone, totalPlanDays),
      currentDayNum,
      currentDay,
      currentWeek: currentDay.week,
      currentPhase: currentDay.phase,
      totalPlanDays,
      daysRemaining: totalPlanDays - doneCount,
      daysCompleted: doneCount,
      overallProgress: computeOverallProgress(allDays, serialized.dayDone),
      weekProgress: computeWeekProgress(allDays, serialized.dayDone, currentDay.week),
      phaseProgress,
      tasksChecked,
      streaks,
      weeklyConsistency: computeWeeklyConsistency(serialized.dayActivity),
      totalStudyMinutes: getTotalStudyMinutes(serialized.dayActivity),
      todayStudyMinutes: serialized.dayActivity[`d${currentDayNum}`]?.studyMinutes || 0,
      weeklyStudyMinutes: getStudyMinutesForPeriod(serialized.dayActivity, 7),
      monthlyStudyMinutes: getStudyMinutesForPeriod(serialized.dayActivity, 30),
      avgStudyMinutes: doneCount
        ? Math.round(getTotalStudyMinutes(serialized.dayActivity) / doneCount)
        : 0,
      overdue: getOverdueDays(allDaysRaw, serialized.dayDone, currentDayNum),
      upcoming: getUpcomingDays(allDaysRaw, currentDayNum, 7),
      recentlyStudied: getRecentlyStudied(allDaysRaw, serialized.dayActivity),
      heatmap,
      weeklyReport: getWeeklyReport(allDaysRaw, serialized.checked, serialized.dayDone, serialized.dayActivity, currentDay.week),
      pendingRevisions: getPendingRevisions(serialized.revisionState),
      weakStrong: getWeakAndStrongTopics(allDaysRaw, serialized.checked, serialized.dayDone),
      achievements: ACHIEVEMENTS.map((a) => ({
        ...a,
        unlocked: (serialized.achievements || []).some((u) => u.id === a.id),
        unlockedAt: (serialized.achievements || []).find((u) => u.id === a.id)?.unlockedAt,
      })),
      allDays,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to compute analytics' });
  }
});

router.get('/export', authMiddleware, async (req, res) => {
  try {
    const [plan, progress] = await Promise.all([
      StudyPlan.findOne({ version: 1 }).lean(),
      UserProgress.findOne({ userId: req.userId }),
    ]);
    const serialized = serializeProgress(progress);
    const allDays = flattenPlan(plan.weeks);
    const totalPlanDays = getTotalPlanDays(plan.weeks);
    const streaks = computeStreaks(serialized.dayActivity);
    const doneCount = allDays.filter((d) => serialized.dayDone[`d${d._n}`]).length;

    res.json({
      generatedAt: new Date().toISOString(),
      overallProgress: computeOverallProgress(allDays, serialized.dayDone),
      daysCompleted: doneCount,
      daysRemaining: totalPlanDays - doneCount,
      totalPlanDays,
      streaks,
      totalStudyMinutes: getTotalStudyMinutes(serialized.dayActivity),
      weeklyReport: getWeeklyReport(
        allDays,
        serialized.checked,
        serialized.dayDone,
        serialized.dayActivity,
        getCurrentDayNum(allDays, serialized.dayDone) > 0
          ? allDays.find((d) => d._n === getCurrentDayNum(allDays, serialized.dayDone))?.week || 1
          : 1
      ),
      achievements: serialized.achievements,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to export report' });
  }
});

export default router;
