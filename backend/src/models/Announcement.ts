import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export const ANNOUNCEMENT_CATEGORIES = [
  'General',
  'Events',
  'Placements',
  'Internships',
  'Workshops',
  'Academic',
  'Important',
] as const;

export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number];

export interface IAnnouncement extends Document {
  _id: Types.ObjectId;
  title: string;
  summary: string;
  content: string;
  category: AnnouncementCategory;
  coverImage?: string;
  author: Types.ObjectId;
  published: boolean;
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const AnnouncementSchema = new Schema<IAnnouncement>(
  {
    title: {
      type: String,
      required: [true, 'Announcement title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    summary: {
      type: String,
      required: [true, 'Announcement summary is required'],
      trim: true,
      maxlength: [300, 'Summary cannot exceed 300 characters'],
    },
    content: {
      type: String,
      required: [true, 'Announcement content is required'],
      trim: true,
      maxlength: [10000, 'Content cannot exceed 10,000 characters'],
    },
    category: {
      type: String,
      required: [true, 'Announcement category is required'],
      enum: {
        values: ANNOUNCEMENT_CATEGORIES,
        message: 'Invalid category: {VALUE}',
      },
      index: true,
    },
    coverImage: {
      type: String,
      trim: true,
      maxlength: [2048, 'Cover image URL cannot exceed 2048 characters'],
      default: undefined,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author is required'],
      index: true,
    },
    published: {
      type: Boolean,
      default: false,
      index: true,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
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

// ── Compound Indexes ─────────────────────────────────────────────────────────
// 1. Public feed sort index: published filter + descending publishedAt and tie-breaker _id
AnnouncementSchema.index({ published: 1, publishedAt: -1, _id: -1 });

// 2. Category filtered public feed: category + published + publishedAt
AnnouncementSchema.index({ category: 1, published: 1, publishedAt: -1 });

// 3. Admin manage sort index: updatedAt descending + tie-breaker _id
AnnouncementSchema.index({ updatedAt: -1, _id: -1 });

const Announcement: Model<IAnnouncement> =
  mongoose.models.Announcement ||
  mongoose.model<IAnnouncement>('Announcement', AnnouncementSchema);

export default Announcement;
