import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import StudyPlan from '../models/StudyPlan.js';

const daysPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../data-science-study/src/data/dsDays.json',
);

export const DS_PHASES = [
  { id: 1, label: 'Foundation', sub: 'Environment, terminal, and Git', skillPhaseId: 0 },
  { id: 2, label: 'Python', sub: 'Language fundamentals through testing', skillPhaseId: 1 },
  { id: 3, label: 'NumPy & pandas', sub: 'Arrays, tables, and a first project', skillPhaseId: 2 },
  { id: 4, label: 'SQL', sub: 'Queries through modelling', skillPhaseId: 3 },
  { id: 5, label: 'Statistics & mathematics', sub: 'Inference, experiments, and the maths ML needs', skillPhaseId: 4 },
  { id: 6, label: 'EDA & visualisation', sub: 'Analysis workflow and a second project', skillPhaseId: 5 },
  { id: 7, label: 'Machine learning', sub: 'Classical ML, evaluation, and two projects', skillPhaseId: 6 },
  { id: 8, label: 'Advanced ML', sub: 'Boosting, a fifth project, and portfolio', skillPhaseId: 7 },
];

export function buildDsPlanDocument() {
  const days = JSON.parse(fs.readFileSync(daysPath, 'utf8'));
  const weeks = [];
  let bucket = [];

  function pushWeek() {
    if (!bucket.length) return;
    const counts = {};
    bucket.forEach((day) => {
      counts[day.phase] = (counts[day.phase] || 0) + 1;
    });
    const phaseId = Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]);
    const phaseName = bucket.find((day) => day.phase === phaseId)?.phaseName || 'Data Science';
    weeks.push({
      w: weeks.length + 1,
      phase: phaseId,
      title: phaseName,
      days: bucket.map((day) => ({
        topic: day.topic,
        tasks: day.tasks,
        minutes: day.minutes,
        practice: !!day.practice,
        phaseName: day.phaseName,
      })),
    });
    bucket = [];
  }

  days.forEach((day) => {
    const phase = bucket[0]?.phase;
    if (bucket.length && (day.phase !== phase || bucket.length === 6)) pushWeek();
    bucket.push(day);
  });
  pushWeek();

  return { version: 1, phases: DS_PHASES, weeks };
}

export async function ensureStudyPlan() {
  const doc = buildDsPlanDocument();
  const existing = await StudyPlan.findOne({ version: 1 });
  if (!existing) {
    await StudyPlan.create(doc);
    console.log(`Seeded data science plan (${doc.weeks.length} weeks)`);
    return;
  }

  const isDataScience = (existing.phases || []).some((phase) => phase.skillPhaseId === 0);
  if (!isDataScience || existing.weeks?.length !== doc.weeks.length) {
    existing.phases = doc.phases;
    existing.weeks = doc.weeks;
    existing.markModified('phases');
    existing.markModified('weeks');
    await existing.save();
    console.log(`Updated study plan to the data science curriculum (${doc.weeks.length} weeks)`);
  }
}
