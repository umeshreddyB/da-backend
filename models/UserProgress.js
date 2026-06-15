import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema(
  {
    startedAt: { type: Date, required: true },
    endedAt: { type: Date },
    minutes: { type: Number, default: 0 },
  },
  { _id: false }
);

const dayActivitySchema = new mongoose.Schema(
  {
    lastStudiedAt: { type: Date },
    completedAt: { type: Date },
    studyMinutes: { type: Number, default: 0 },
    sessions: [sessionSchema],
  },
  { _id: false }
);

const dayNotesSchema = new mongoose.Schema(
  {
    learned: { type: String, default: '' },
    takeaways: { type: String, default: '' },
    doubts: { type: String, default: '' },
    revision: { type: String, default: '' },
    updatedAt: { type: Date },
  },
  { _id: false }
);

const attachmentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    filename: { type: String },
    url: { type: String },
    mimeType: { type: String },
    size: { type: Number },
  },
  { _id: false }
);

const knowledgeNoteSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: { type: String, default: 'daily' },
    dayNum: { type: Number },
    week: { type: Number },
    phase: { type: Number },
    topic: { type: String, default: '' },
    subtopic: { type: String, default: '' },
    taskIndex: { type: Number },
    title: { type: String, default: '' },
    summary: { type: String, default: '' },
    pinned: { type: Boolean, default: false },
    favorite: { type: Boolean, default: false },
    tags: { type: [String], default: [] },
    relatedNoteIds: { type: [String], default: [] },
    sections: { type: mongoose.Schema.Types.Mixed, default: {} },
    body: { type: mongoose.Schema.Types.Mixed, default: {} },
    attachments: { type: [attachmentSchema], default: [] },
    createdAt: { type: String },
    updatedAt: { type: String },
  },
  { _id: false }
);

const achievementSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    unlockedAt: { type: Date, required: true },
  },
  { _id: false }
);

const revisionStateSchema = new mongoose.Schema(
  {
    nextReviewAt: { type: Date },
    intervalDays: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    lastReviewedAt: { type: Date },
  },
  { _id: false }
);

const userProgressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    checked: { type: Map, of: Boolean, default: {} },
    dayDone: { type: Map, of: Boolean, default: {} },
    dayActivity: { type: Map, of: dayActivitySchema, default: {} },
    dayNotes: { type: Map, of: dayNotesSchema, default: {} },
    knowledgeNotes: { type: Map, of: knowledgeNoteSchema, default: {} },
    bookmarks: { type: [Number], default: [] },
    achievements: { type: [achievementSchema], default: [] },
    revisionState: { type: Map, of: revisionStateSchema, default: {} },
    settings: {
      darkMode: { type: Boolean, default: false },
      planStartDate: { type: String },
      planVersion: { type: Number, default: 1 },
    },
  },
  { timestamps: true }
);

export default mongoose.model('UserProgress', userProgressSchema);
