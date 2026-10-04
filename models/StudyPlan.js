import mongoose from 'mongoose';

const studyPlanSchema = new mongoose.Schema(
  {
    version: { type: Number, required: true, default: 1 },
    phases: [
      {
        id: Number,
        label: String,
        sub: String,
        cls: String,
        skillPhaseId: Number,
      },
    ],
    weeks: [
      {
        w: Number,
        phase: Number,
        title: String,
        note: String,
        days: [
          {
            lbl: String,
            topic: String,
            practice: Boolean,
            minutes: Number,
            phaseName: String,
            tasks: [String],
          },
        ],
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model('StudyPlan', studyPlanSchema);
