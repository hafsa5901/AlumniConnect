import mongoose, { Document, Schema, Types } from 'mongoose';

export type ReferralStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';

export interface IReferralRequest extends Document {
  _id: Types.ObjectId;
  job: Types.ObjectId;
  jobPoster: Types.ObjectId;
  applicant: Types.ObjectId;
  status: ReferralStatus;
  message: string;
  responseNote?: string;
  resumeIncluded: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ReferralRequestSchema = new Schema<IReferralRequest>(
  {
    job: {
      type: Schema.Types.ObjectId,
      ref: 'Job',
      required: [true, 'Job reference is required'],
      index: true,
    },
    jobPoster: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Job poster reference is required'],
      index: true,
    },
    applicant: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Applicant reference is required'],
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'accepted', 'rejected', 'withdrawn'],
        message: 'Invalid referral status',
      },
      default: 'pending',
      required: true,
    },
    message: {
      type: String,
      required: [true, 'Referral request message is required'],
      trim: true,
      maxlength: [2000, 'Message cannot exceed 2000 characters'],
    },
    responseNote: {
      type: String,
      trim: true,
      maxlength: [2000, 'Response note cannot exceed 2000 characters'],
    },
    resumeIncluded: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Partial unique index: at most one active (pending or accepted) referral request per job+applicant pair
ReferralRequestSchema.index(
  { job: 1, applicant: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['pending', 'accepted'] } },
  }
);

// Indexes for inboxes and queries
ReferralRequestSchema.index({ jobPoster: 1, status: 1, createdAt: -1 });
ReferralRequestSchema.index({ applicant: 1, status: 1, createdAt: -1 });

const ReferralRequest = mongoose.model<IReferralRequest>(
  'ReferralRequest',
  ReferralRequestSchema
);

export default ReferralRequest;
