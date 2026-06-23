import {
  addDays, parseISO, startOfDay, format, isSunday, isSameDay,
} from 'date-fns';

export const PLAN_START_DATE = '2026-06-15';

export function computePlanStartDate() {
  return startOfDay(parseISO(PLAN_START_DATE));
}

function parsePlanStart(planStart) {
  return startOfDay(planStart instanceof Date ? planStart : parseISO(String(planStart)));
}

/** Fixed mapping: plan day N → calendar date (legacy). */
export function dayNumToDate(dayNum, planStart) {
  const start = parsePlanStart(planStart);
  if (dayNum <= 1) return start;
  let date = start;
  let count = 1;
  while (count < dayNum) {
    date = addDays(date, 1);
    if (!isSunday(date)) count += 1;
  }
  return date;
}

/** Fixed mapping: calendar date → plan day N (legacy). */
export function dateToDayNum(date, planStart, maxDays = Infinity) {
  const start = parsePlanStart(planStart);
  const target = startOfDay(date);
  if (target < start || isSunday(target)) return null;

  let current = start;
  let num = 1;
  while (current < target) {
    current = addDays(current, 1);
    if (!isSunday(current)) num += 1;
    if (num > maxDays) return null;
  }
  return num;
}

/**
 * Rolling schedule: which plan day is assigned to a calendar date.
 * Past/today use actual dayDone; future dates (after refDate) project on-time completion.
 */
export function planDayForDate(targetDate, planStart, dayDone = {}, totalDays = Infinity, refDate = new Date()) {
  const start = parsePlanStart(planStart);
  const target = startOfDay(targetDate);
  const ref = startOfDay(refDate);
  if (target < start || isSunday(target)) return null;

  let planDay = 1;
  let current = start;

  while (current <= target && planDay <= totalDays) {
    if (!isSunday(current)) {
      if (isSameDay(current, target)) return planDay;

      if (current < ref) {
        if (dayDone[`d${planDay}`]) planDay = Math.min(planDay + 1, totalDays);
      } else if (isSameDay(current, ref)) {
        if (target > ref) {
          planDay = Math.min(planDay + 1, totalDays);
        } else if (dayDone[`d${planDay}`]) {
          planDay = Math.min(planDay + 1, totalDays);
        }
      } else {
        planDay = Math.min(planDay + 1, totalDays);
      }
    }
    current = addDays(current, 1);
  }
  return null;
}

/** Last calendar date (≤ refDate) where planDay was assigned. */
export function calendarDateForPlanDay(planDay, planStart, dayDone = {}, totalDays, refDate = new Date()) {
  const start = parsePlanStart(planStart);
  const ref = startOfDay(refDate);
  let currentPlanDay = 1;
  let current = start;
  let lastMatch = null;

  while (current <= ref && currentPlanDay <= totalDays) {
    if (!isSunday(current)) {
      if (currentPlanDay === planDay) lastMatch = current;
      if (dayDone[`d${currentPlanDay}`]) {
        currentPlanDay = Math.min(currentPlanDay + 1, totalDays);
      }
    }
    current = addDays(current, 1);
  }
  return lastMatch;
}

/** Last study calendar date needed (project future slots as on-time completion). */
export function projectedEndDate(planStart, totalDays, dayDone = {}, refDate = new Date()) {
  const start = parsePlanStart(planStart);
  const ref = startOfDay(refDate);
  let planDay = 1;
  let current = start;
  let lastStudyDate = start;

  while (planDay <= totalDays) {
    if (!isSunday(current)) {
      lastStudyDate = current;
      if (current <= ref) {
        if (dayDone[`d${planDay}`]) planDay += 1;
      } else {
        planDay += 1;
      }
    }
    current = addDays(current, 1);
    if (current > addDays(start, totalDays * 3)) break;
  }
  return lastStudyDate;
}

function progressForDay(day, checked, dayDone) {
  if (!day) return 0;
  if (dayDone[`d${day._n}`]) return 100;
  if (!day.tasks?.length) return 0;
  const checkedTasks = day.tasks.filter((_, i) => checked[`${day._n}_${i}`]).length;
  return Math.round((checkedTasks / day.tasks.length) * 100);
}

/**
 * Rolling calendar map: dateKey → { dayNum, topic, progress }.
 * Past/today uses actual dayDone; future dates project on-time completion.
 */
export function buildRollingScheduleMap(planStart, allDays, checked = {}, dayDone = {}, refDate = new Date()) {
  if (!planStart || !allDays?.length) return {};

  const totalDays = allDays.length;
  const dayByNum = Object.fromEntries(allDays.map((d) => [d._n, d]));
  const end = projectedEndDate(planStart, totalDays, dayDone, refDate);
  const map = {};

  let current = parsePlanStart(planStart);

  while (current <= end) {
    if (!isSunday(current)) {
      const assigned = planDayForDate(current, planStart, dayDone, totalDays, refDate);
      if (assigned) {
        const day = dayByNum[assigned];
        const key = format(current, 'yyyy-MM-dd');
        map[key] = {
          dayNum: assigned,
          topic: day?.topic || '',
          progress: progressForDay(day, checked, dayDone),
          studyMinutes: 0,
        };
      }
    }
    current = addDays(current, 1);
  }

  return map;
}

export function buildScheduleHeatmap(allDays, planStart, checked, dayDone) {
  return buildRollingScheduleMap(planStart, allDays, checked, dayDone, new Date());
}
