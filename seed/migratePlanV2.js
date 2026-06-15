import '../config/env.js';
import { connectDB } from '../config/db.js';
import UserProgress from '../models/UserProgress.js';
import { PLAN_START_DATE } from '../utils/schedule.js';

const SHIFT = 6;
const PLAN_VERSION = 2;

function shiftCheckedKey(key) {
  const m = key.match(/^(\d+)_(\d+)$/);
  if (!m) return key;
  return `${Number(m[1]) + SHIFT}_${m[2]}`;
}

function shiftDayKey(key) {
  const m = key.match(/^d(\d+)$/);
  if (!m) return key;
  return `d${Number(m[1]) + SHIFT}`;
}

function shiftNoteId(id) {
  let next = id.replace(/^day-(\d+)-task-(\d+)$/, (_, d, t) => `day-${Number(d) + SHIFT}-task-${t}`);
  if (next !== id) return next;
  next = id.replace(/^day-(\d+)$/, (_, d) => `day-${Number(d) + SHIFT}`);
  return next;
}

function mapEntries(obj, keyFn, valueFn = (v) => v) {
  if (!obj || typeof obj !== 'object') return {};
  const entries = obj instanceof Map ? [...obj.entries()] : Object.entries(obj);
  const sorted = entries.sort((a, b) => {
    const na = Number(String(a[0]).replace(/\D/g, '')) || 0;
    const nb = Number(String(b[0]).replace(/\D/g, '')) || 0;
    return nb - na;
  });
  const out = {};
  for (const [k, v] of sorted) {
    out[keyFn(k)] = valueFn(v, k);
  }
  return out;
}

function migrateProgressDoc(doc) {
  const settings = doc.settings?.toObject?.() || doc.settings || {};
  if (settings.planVersion >= PLAN_VERSION) {
    return false;
  }

  const checked = mapEntries(doc.checked, shiftCheckedKey);
  const dayDone = mapEntries(doc.dayDone, shiftDayKey);
  const dayActivity = mapEntries(doc.dayActivity, shiftDayKey);
  const dayNotes = mapEntries(doc.dayNotes, shiftDayKey);
  const revisionState = mapEntries(doc.revisionState, shiftDayKey);

  const knowledgeNotes = {};
  const noteEntries = doc.knowledgeNotes instanceof Map
    ? [...doc.knowledgeNotes.entries()]
    : Object.entries(doc.knowledgeNotes || {});

  for (const [oldId, note] of noteEntries) {
    const plain = note?.toObject?.() || note;
    const newId = shiftNoteId(oldId);
    const updated = { ...plain, id: newId };
    if (typeof updated.dayNum === 'number') {
      updated.dayNum += SHIFT;
    }
    if (Array.isArray(updated.relatedNoteIds)) {
      updated.relatedNoteIds = updated.relatedNoteIds.map(shiftNoteId);
    }
    knowledgeNotes[newId] = updated;
  }

  doc.checked = checked;
  doc.dayDone = dayDone;
  doc.dayActivity = dayActivity;
  doc.dayNotes = dayNotes;
  doc.revisionState = revisionState;
  doc.knowledgeNotes = knowledgeNotes;
  doc.bookmarks = (doc.bookmarks || []).map((n) => n + SHIFT);
  doc.settings = {
    ...settings,
    planStartDate: PLAN_START_DATE,
    planVersion: PLAN_VERSION,
  };
  doc.markModified('checked');
  doc.markModified('dayDone');
  doc.markModified('dayActivity');
  doc.markModified('dayNotes');
  doc.markModified('revisionState');
  doc.markModified('knowledgeNotes');
  doc.markModified('settings');
  return true;
}

async function migratePlan() {
  await connectDB();

  const users = await UserProgress.find({});
  let migrated = 0;
  let skipped = 0;

  for (const doc of users) {
    if (migrateProgressDoc(doc)) {
      await doc.save();
      migrated += 1;
    } else {
      skipped += 1;
    }
  }

  console.log(`Migration complete: ${migrated} updated, ${skipped} skipped (already v${PLAN_VERSION})`);
  process.exit(0);
}

migratePlan().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
