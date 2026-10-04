import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import UserProgress from '../models/UserProgress.js';
import { authMiddleware } from '../middleware/auth.js';
import { serializeProgress, mapToObject } from '../utils/progressHelpers.js';
import { initRevisionOnComplete } from '../utils/revision.js';
import { checkAchievements } from '../utils/achievements.js';
import StudyPlan from '../models/StudyPlan.js';
import { flattenPlan } from '../utils/analytics.js';
import { getTotalPlanDays } from '../utils/planHelpers.js';
import { ensureKnowledgeNotesMigrated } from '../utils/notesMigration.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.join(__dirname, '../uploads');

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = path.join(uploadsRoot, String(req.userId));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^(image\/|application\/pdf)/.test(file.mimetype);
    cb(ok ? null : new Error('Only images and PDFs allowed'), ok);
  },
});

const router = express.Router();

const PATCH_FIELDS = ['checked', 'dayDone', 'dayActivity', 'dayNotes', 'knowledgeNotes', 'bookmarks', 'settings', 'revisionState', 'achievements', 'skillMap'];
const MERGED_FIELDS = ['checked', 'dayDone', 'dayActivity', 'dayNotes', 'knowledgeNotes', 'revisionState'];

function collectUpdate(body) {
  const update = {};
  for (const key of PATCH_FIELDS) {
    if (body[key] !== undefined) update[key] = body[key];
  }
  return update;
}

function applyProgressUpdate(progress, update) {
  for (const [key, val] of Object.entries(update)) {
    if (key === 'settings') {
      progress.settings = { ...progress.settings?.toObject?.() || progress.settings || {}, ...val };
    } else if (key === 'skillMap') {
      const existing = progress.skillMap?.toObject?.() || progress.skillMap || {};
      progress.skillMap = {
        topics: val.topics ?? existing.topics ?? {},
        phases: val.phases ?? existing.phases ?? {},
        gates: val.gates ?? existing.gates ?? {},
        activity: Array.isArray(val.activity) ? val.activity : (existing.activity || []),
      };
      progress.markModified('skillMap');
    } else if (MERGED_FIELDS.includes(key)) {
      const existing = mapToObject(progress[key]);
      progress[key] = { ...existing, ...val };
      progress.markModified(key);
    } else {
      progress[key] = val;
    }
  }
}

router.get('/', authMiddleware, async (req, res) => {
  try {
    let progress = await UserProgress.findOne({ userId: req.userId });
    if (!progress) {
      return res.json(serializeProgress(null));
    }

    const plan = await StudyPlan.findOne({ version: 1 }).lean();
    const allDays = plan ? flattenPlan(plan.weeks) : [];
    const migrated = ensureKnowledgeNotesMigrated(progress, allDays);
    if (migrated) await progress.save();

    res.json(serializeProgress(progress));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch progress' });
  }
});

async function saveProgressUpdate(userId, update) {
  let progress = await UserProgress.findOne({ userId });
  if (!progress) {
    progress = await UserProgress.create({ userId, ...update });
  } else {
    applyProgressUpdate(progress, update);
    await progress.save();
  }
  return progress;
}

router.put('/', authMiddleware, async (req, res) => {
  try {
    const progress = await saveProgressUpdate(req.userId, collectUpdate(req.body));
    res.json(serializeProgress(progress));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to save progress' });
  }
});

router.patch('/', authMiddleware, async (req, res) => {
  try {
    const progress = await saveProgressUpdate(req.userId, collectUpdate(req.body));
    res.json(serializeProgress(progress));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update progress' });
  }
});

router.post('/timer', authMiddleware, async (req, res) => {
  try {
    const { dayNum, action, minutes = 0 } = req.body;
    if (!dayNum) return res.status(400).json({ message: 'dayNum is required' });

    const key = `d${dayNum}`;
    let progress = await UserProgress.findOne({ userId: req.userId });
    if (!progress) {
      progress = await UserProgress.create({ userId: req.userId });
    }

    const activity = mapToObject(progress.dayActivity);
    const current = activity[key] || { studyMinutes: 0, sessions: [] };
    const now = new Date();

    if (action === 'start') {
      current.sessions = [...(current.sessions || []), { startedAt: now, minutes: 0 }];
      current.lastStudiedAt = now;
    } else if (action === 'stop') {
      const sessions = [...(current.sessions || [])];
      const last = sessions[sessions.length - 1];
      if (last && !last.endedAt) {
        last.endedAt = now;
        last.minutes = minutes;
        current.studyMinutes = (current.studyMinutes || 0) + minutes;
      }
      current.lastStudiedAt = now;
    } else if (action === 'tick') {
      current.studyMinutes = (current.studyMinutes || 0) + minutes;
      current.lastStudiedAt = now;
    }

    activity[key] = current;
    progress.dayActivity = activity;
    await progress.save();

    res.json(serializeProgress(progress));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update timer' });
  }
});

router.post('/complete-day', authMiddleware, async (req, res) => {
  try {
    const { dayNum } = req.body;
    if (!dayNum) return res.status(400).json({ message: 'dayNum is required' });

    const plan = await StudyPlan.findOne({ version: 1 }).lean();
    if (!plan) return res.status(404).json({ message: 'Study plan not found' });
    const allDays = flattenPlan(plan.weeks);
    const phases = plan.phases;

    let progress = await UserProgress.findOne({ userId: req.userId });
    if (!progress) progress = await UserProgress.create({ userId: req.userId });

    const dayDone = mapToObject(progress.dayDone);
    const dayActivity = mapToObject(progress.dayActivity);
    const revisionState = mapToObject(progress.revisionState);
    const key = `d${dayNum}`;

    dayDone[key] = true;
    dayActivity[key] = {
      ...(dayActivity[key] || {}),
      completedAt: new Date(),
      lastStudiedAt: new Date(),
      studyMinutes: dayActivity[key]?.studyMinutes || 0,
      sessions: dayActivity[key]?.sessions || [],
    };
    revisionState[String(dayNum)] = initRevisionOnComplete(dayNum);

    progress.set('dayDone', dayDone);
    progress.set('dayActivity', dayActivity);
    progress.set('revisionState', revisionState);
    progress.markModified('dayDone');
    progress.markModified('dayActivity');
    progress.markModified('revisionState');

    const existingAchievements = progress.achievements || [];
    const newAchievements = checkAchievements({
      allDays,
      dayDone,
      dayActivity,
      achievements: existingAchievements,
      phases,
      totalPlanDays: getTotalPlanDays(plan.weeks),
    });
    if (newAchievements.length) {
      progress.achievements = [...existingAchievements, ...newAchievements];
    }

    await progress.save();
    res.json({ ...serializeProgress(progress), newAchievements });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to complete day' });
  }
});

router.post('/notes/upload', authMiddleware, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message || 'Upload failed' });
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const publicBase = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
    const url = `${publicBase}/uploads/${req.userId}/${req.file.filename}`;
    res.json({
      id: `att-${Date.now()}`,
      filename: req.file.originalname,
      url,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Upload failed' });
  }
});

export default router;
