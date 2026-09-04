import mongoose, { Document, Schema, Types } from 'mongoose';

export type JobType = 'full_time' | 'part_time' | 'internship' | 'contract';
export type WorkplaceType = 'remote' | 'hybrid' | 'onsite';
export type ExperienceLevel = 'entry' | 'mid' | 'senior' | 'lead';
export type JobStatus = 'open' | 'closed';

export interface IJob extends Document {
  _id: Types.ObjectId;
  title: string;
  company: string;
  location: string;
  jobType: JobType;
  workplaceType: WorkplaceType;
  experienceLevel: ExperienceLevel;
  description: string;
  requirements: string[];
  applicationUrl: string;
  applicationDeadline?: Date;
  status: JobStatus;
  postedBy: Types.ObjectId;
  referralAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const JobSchema = new Schema<IJob>(
  {
    title: {
      type: String,
      required: [true, 'Job title is required'],
      trim: true,
      maxlength: [200, 'Job title cannot exceed 200 characters'],
    },
    company: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      maxlength: [200, 'Company name cannot exceed 200 characters'],
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
      maxlength: [200, 'Location cannot exceed 200 characters'],
    },
    jobType: {
      type: String,
      enum: {
        values: ['full_time', 'part_time', 'internship', 'contract'],
        message: 'Invalid job type',
      },
      required: [true, 'Job type is required'],
    },
    workplaceType: {
      type: String,
      enum: {
        values: ['remote', 'hybrid', 'onsite'],
        message: 'Invalid workplace type',
      },
      required: [true, 'Workplace type is required'],
    },
    experienceLevel: {
      type: String,
      enum: {
        values: ['entry', 'mid', 'senior', 'lead'],
        message: 'Invalid experience level',
      },
      required: [true, 'Experience level is required'],
    },
    description: {
      type: String,
      required: [true, 'Job description is required'],
      trim: true,
      maxlength: [10000, 'Job description cannot exceed 10,000 characters'],
    },
    requirements: {
      type: [String],
      required: [true, 'Requirements are required'],
      validate: {
        validator: function (v: string[]) {
          return Array.isArray(v) && v.length > 0 && v.every((req) => typeof req === 'string' && req.trim().length > 0);
        },
        message: 'At least one requirement is required',
      },
    },
    applicationUrl: {
      type: String,
      required: [true, 'Application URL is required'],
      trim: true,
      validate: {
        validator: function (v: string) {
          try {
            const url = new URL(v);
            return url.protocol === 'http:' || url.protocol === 'https:';
          } catch {
            return false;
          }
        },
        message: 'Application URL must be a valid http or https URL',
      },
    },
    applicationDeadline: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['open', 'closed'],
      default: 'open',
    },
    postedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'postedBy is required'],
    },
    referralAvailable: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
JobSchema.index({ title: 'text', company: 'text', description: 'text' });
JobSchema.index({ status: 1, jobType: 1, workplaceType: 1, experienceLevel: 1, createdAt: -1 });
JobSchema.index({ postedBy: 1 });

const Job = mongoose.model<IJob>('Job', JobSchema);

export default Job;
