import '../config/env.js';
import { connectDB } from '../config/db.js';
import StudyPlan from '../models/StudyPlan.js';
import { PLAN, PHASES } from './planData.js';

async function reseed() {
  await connectDB();

  await StudyPlan.findOneAndUpdate(
    { version: 1 },
    { version: 1, phases: PHASES, weeks: PLAN },
    { upsert: true, new: true }
  );

  console.log(`Study plan reseeded: ${PLAN.length} weeks, ${PLAN.reduce((n, w) => n + w.days.length, 0)} days`);
  process.exit(0);
}

reseed().catch((err) => {
  console.error('Reseed failed:', err);
  process.exit(1);
});
