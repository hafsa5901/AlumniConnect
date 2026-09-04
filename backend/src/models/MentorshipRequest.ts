import mongoose, { Document, Schema, Types } from 'mongoose';

export type MentorshipStatus = 'pending' | 'accepted' | 'rejected' | 'completed';

export interface IMentorshipRequest extends Document {
  _id: Types.ObjectId;
  student: Types.ObjectId;
  mentor: Types.ObjectId;
  status: MentorshipStatus;
  topic: string;
  message: string;
  scheduledDate?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MentorshipRequestSchema = new Schema<IMentorshipRequest>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student is required'],
    },
    mentor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Mentor is required'],
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'completed'],
      default: 'pending',
      required: true,
    },
    topic: {
      type: String,
      required: [true, 'Topic is required'],
      trim: true,
      maxlength: [200, 'Topic cannot exceed 200 characters'],
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
      maxlength: [3000, 'Message cannot exceed 3000 characters'],
    },
    scheduledDate: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [3000, 'Notes cannot exceed 3000 characters'],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
MentorshipRequestSchema.index({ student: 1 });
MentorshipRequestSchema.index({ mentor: 1 });
MentorshipRequestSchema.index({ status: 1 });
MentorshipRequestSchema.index({ student: 1, mentor: 1 });
MentorshipRequestSchema.index({ mentor: 1, status: 1 });

const MentorshipRequest = mongoose.model<IMentorshipRequest>(
  'MentorshipRequest',
  MentorshipRequestSchema
);

export default MentorshipRequest;
