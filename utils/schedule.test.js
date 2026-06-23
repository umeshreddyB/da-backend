import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseISO, format } from 'date-fns';
import {
  PLAN_START_DATE,
  planDayForDate,
  calendarDateForPlanDay,
  dateToDayNum,
  dayNumToDate,
  buildRollingScheduleMap,
} from './schedule.js';

const PLAN_START = PLAN_START_DATE;
const TOTAL = 126;

function dayDone(...nums) {
  return Object.fromEntries(nums.map((n) => [`d${n}`, true]));
}

function d(iso) {
  return parseISO(iso);
}

function dateKey(date) {
  return format(date, 'yyyy-MM-dd');
}

describe('planDayForDate', () => {
  it('matches fixed mapping when all prior days are marked complete', () => {
    const done = dayDone(1, 2, 3);
    const jun18 = d('2026-06-18');
    const ref = d('2026-06-18');
    assert.equal(planDayForDate(jun18, PLAN_START, done, TOTAL, ref), 4);
    assert.equal(planDayForDate(jun18, PLAN_START, done, TOTAL, ref), dateToDayNum(jun18, PLAN_START, TOTAL));
  });

  it('repeats incomplete plan day on the next study slot (same day or past)', () => {
    const done = dayDone(1, 2, 3);
    const jun18 = d('2026-06-18');
    const jun19 = d('2026-06-19');
    const ref = d('2026-06-19');
    assert.equal(planDayForDate(jun18, PLAN_START, done, TOTAL, ref), 4);
    assert.equal(planDayForDate(jun19, PLAN_START, done, TOTAL, ref), 4);
    assert.notEqual(planDayForDate(jun19, PLAN_START, done, TOTAL, ref), dateToDayNum(jun19, PLAN_START, TOTAL));
  });

  it('projects the next plan day for future calendar dates', () => {
    const done = dayDone(1, 2, 3);
    const jun23 = d('2026-06-23');
    const jun24 = d('2026-06-24');
    assert.equal(planDayForDate(jun23, PLAN_START, done, TOTAL, jun23), 4);
    assert.equal(planDayForDate(jun24, PLAN_START, done, TOTAL, jun23), 5);
  });

  it('advances on the next study slot after marking the day complete', () => {
    const done = dayDone(1, 2, 3, 4);
    const jun19 = d('2026-06-19');
    assert.equal(planDayForDate(jun19, PLAN_START, done, TOTAL, jun19), 5);
  });

  it('returns null on Sundays and before plan start', () => {
    const ref = d('2026-06-23');
    assert.equal(planDayForDate(d('2026-06-21'), PLAN_START, {}, TOTAL, ref), null);
    assert.equal(planDayForDate(d('2026-06-14'), PLAN_START, {}, TOTAL, ref), null);
  });
});

describe('calendarDateForPlanDay', () => {
  it('returns the last assigned calendar date for a plan day when days rolled forward', () => {
    const done = dayDone(1, 2, 3);
    const ref = d('2026-06-19');
    const cal = calendarDateForPlanDay(4, PLAN_START, done, TOTAL, ref);
    assert.equal(dateKey(cal), '2026-06-19');
  });

  it('returns fixed date when plan is on schedule', () => {
    const done = dayDone(1, 2, 3);
    const ref = d('2026-06-18');
    const cal = calendarDateForPlanDay(4, PLAN_START, done, TOTAL, ref);
    assert.equal(dateKey(cal), '2026-06-18');
    assert.equal(dateKey(cal), dateKey(dayNumToDate(4, PLAN_START)));
  });
});

describe('buildRollingScheduleMap', () => {
  it('assigns the same plan day across consecutive past/today slots when incomplete', () => {
    const allDays = Array.from({ length: 10 }, (_, i) => ({
      _n: i + 1,
      topic: `Topic ${i + 1}`,
      tasks: ['a'],
    }));
    const done = dayDone(1, 2, 3);
    const map = buildRollingScheduleMap(PLAN_START, allDays, {}, done, d('2026-06-19'));
    assert.equal(map['2026-06-18'].dayNum, 4);
    assert.equal(map['2026-06-19'].dayNum, 4);
    assert.equal(map['2026-06-20'].dayNum, 5);
  });
});
