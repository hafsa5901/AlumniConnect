import mongoose, { Schema, Document, Model } from 'mongoose';

export type VerificationRequestStatus = 'pending' | 'approved' | 'rejected' | 'superseded';

export interface IVerificationDocument {
  originalName: string;
  storagePath?: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
}

export interface IVerificationRequest extends Document {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  college: mongoose.Types.ObjectId;
  role: 'student' | 'alumni';
  status: VerificationRequestStatus;
  collegeDomainVerified: boolean;
  document?: IVerificationDocument | null;
  note?: string;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VerificationDocumentSchema = new Schema<IVerificationDocument>(
  {
    originalName: { type: String, required: true, trim: true },
    storagePath: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const VerificationRequestSchema = new Schema<IVerificationRequest>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    college: { type: Schema.Types.ObjectId, ref: 'College', required: true, index: true },
    role: { type: String, enum: ['student', 'alumni'], required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'superseded'] satisfies VerificationRequestStatus[],
      default: 'pending',
      required: true,
      index: true,
    },
    collegeDomainVerified: { type: Boolean, default: false, index: true },
    document: { type: VerificationDocumentSchema, default: null },
    note: { type: String, trim: true, maxlength: 2000 },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    rejectionReason: { type: String, trim: true, maxlength: 1000 },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, any>) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        if (ret.document) {
          delete ret.document.storagePath;
        }
        return ret;
      },
    },
  }
);

// Partial unique index: only 1 pending verification request per user at a time
VerificationRequestSchema.index(
  { user: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);

// General compound query indexes
VerificationRequestSchema.index({ status: 1, college: 1, createdAt: -1 });
VerificationRequestSchema.index({ user: 1, createdAt: -1 });

const VerificationRequest: Model<IVerificationRequest> =
  mongoose.models.VerificationRequest ||
  mongoose.model<IVerificationRequest>('VerificationRequest', VerificationRequestSchema);

export default VerificationRequest;
