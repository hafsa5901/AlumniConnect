import mongoose, { Schema, Document, Model } from 'mongoose';

// ── Enums (canonical — lowercase strings per spec §1) ────────────────────────
export type Role = 'student' | 'alumni' | 'admin';
export type VerificationStatus = 'pending' | 'email_verified' | 'admin_approved' | 'rejected';
export type AccountStatus = 'active' | 'suspended' | 'deactivated';

export interface IEducation {
  institution: string;
  degree: string;
  field: string;
  startYear: number;
  endYear?: number;
}

export interface IExperience {
  company: string;
  title: string;
  startDate: string;
  endDate?: string;
  description?: string;
}

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  accountStatus: AccountStatus;
  verificationStatus: VerificationStatus;
  // Alumni non-institutional proof
  verificationNote?: string;
  verificationDocUrl?: string;
  rejectionReason?: string;
  // Institution info
  institution?: string;
  department?: string;
  batch?: string;
  studentId?: string;
  alumniId?: string;
  // Profile
  profilePhotoUrl?: string;
  bio?: string;
  skills: string[];
  education: IEducation[];
  experience: IExperience[];
  company?: string;
  designation?: string;
  location?: string;
  links: Record<string, string>;
  mentorshipEnabled: boolean;
  // Tokens (hashed — never raw)
  verificationTokenHash?: string;
  verificationTokenExpires?: Date;
  resetTokenHash?: string;
  resetTokenExpires?: Date;
  refreshTokenHash?: string;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EducationSchema = new Schema<IEducation>(
  {
    institution: { type: String, required: true, trim: true },
    degree: { type: String, required: true, trim: true },
    field: { type: String, required: true, trim: true },
    startYear: { type: Number, required: true },
    endYear: { type: Number },
  },
  { _id: false }
);

const ExperienceSchema = new Schema<IExperience>(
  {
    company: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    startDate: { type: String, required: true },
    endDate: { type: String },
    description: { type: String, trim: true },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    // select: false → never included in query results unless explicitly requested
    passwordHash: { type: String, required: true, select: false },

    role: {
      type: String,
      enum: ['student', 'alumni', 'admin'] satisfies Role[],
      required: true,
      index: true,
    },

    accountStatus: {
      type: String,
      enum: ['active', 'suspended', 'deactivated'] satisfies AccountStatus[],
      default: 'active',
      required: true,
      index: true,
    },

    verificationStatus: {
      type: String,
      enum: ['pending', 'email_verified', 'admin_approved', 'rejected'] satisfies VerificationStatus[],
      default: 'pending',
      required: true,
      index: true,
    },

    verificationNote: { type: String, trim: true, select: false },   // alumni proof text
    verificationDocUrl: { type: String, trim: true, select: false },  // alumni proof doc
    rejectionReason: { type: String, trim: true },

    institution: { type: String, trim: true },
    department: { type: String, trim: true, index: true },
    batch: { type: String, trim: true, index: true },
    studentId: { type: String, trim: true },
    alumniId: { type: String, trim: true },

    profilePhotoUrl: { type: String, trim: true },
    bio: { type: String, trim: true, maxlength: 1000 },
    skills: [{ type: String, trim: true }],
    education: [EducationSchema],
    experience: [ExperienceSchema],
    company: { type: String, trim: true },
    designation: { type: String, trim: true },
    location: { type: String, trim: true },
    links: { type: Map, of: String, default: {} },

    mentorshipEnabled: { type: Boolean, default: false },

    // Token storage — hashed only, never raw
    verificationTokenHash: { type: String, select: false },
    verificationTokenExpires: { type: Date, select: false },
    resetTokenHash: { type: String, select: false },
    resetTokenExpires: { type: Date, select: false },
    refreshTokenHash: { type: String, select: false },

    lastLogin: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, any>) => {
        ret.id = ret._id;
        // These must never appear in any API response
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        delete ret.verificationTokenHash;
        delete ret.verificationTokenExpires;
        delete ret.resetTokenHash;
        delete ret.resetTokenExpires;
        delete ret.refreshTokenHash;
        return ret;
      },
    },
  }
);

// ── Safe projection: fields returned to clients by default ───────────────────
export const SAFE_USER_FIELDS =
  '-passwordHash -verificationTokenHash -verificationTokenExpires -resetTokenHash -resetTokenExpires -refreshTokenHash -verificationNote -verificationDocUrl';

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
export default User;
