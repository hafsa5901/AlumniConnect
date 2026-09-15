import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICollegeLocation {
  city?: string;
  state?: string;
  country?: string;
}

export interface ICollege extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  code: string;
  domains: string[];
  location?: ICollegeLocation;
  website?: string;
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CollegeLocationSchema = new Schema<ICollegeLocation>(
  {
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true, default: 'USA' },
  },
  { _id: false }
);

const CollegeSchema = new Schema<ICollege>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 200,
      index: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 30,
      index: true,
    },
    domains: {
      type: [{ type: String, lowercase: true, trim: true }],
      required: true,
      validate: [(val: string[]) => val.length > 0, 'At least one domain is required.'],
      index: true,
    },
    location: { type: CollegeLocationSchema, default: {} },
    website: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, any>) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Search index
CollegeSchema.index({ name: 'text', code: 'text' });

const College: Model<ICollege> = mongoose.models.College || mongoose.model<ICollege>('College', CollegeSchema);
export default College;
