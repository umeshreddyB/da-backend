import '../config/env.js';
import { connectDB } from '../config/db.js';
import { ensureStudyPlan } from './dsPlan.js';

async function seed() {
  await connectDB();
  await ensureStudyPlan();
  console.log('Study plan ready');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
