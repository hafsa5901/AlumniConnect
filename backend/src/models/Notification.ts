import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type NotificationType =
  | 'mentorship_request'
  | 'mentorship_accepted'
  | 'mentorship_rejected'
  | 'mentorship_completed'
  | 'new_message'
  | 'event_approved'
  | 'event_rejected'
  | 'job_removed_by_admin';

export type RelatedEntityType = 'mentorship' | 'message' | 'conversation' | 'event' | 'job' | 'user';

export interface INotification extends Document {
  _id: Types.ObjectId;
  recipient: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  readAt?: Date | null;
  relatedEntityType?: RelatedEntityType;
  relatedEntityId?: Types.ObjectId;
  actor?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient is required'],
      index: true,
    },
    type: {
      type: String,
      enum: [
        'mentorship_request',
        'mentorship_accepted',
        'mentorship_rejected',
        'mentorship_completed',
        'new_message',
        'event_approved',
        'event_rejected',
        'job_removed_by_admin',
      ],
      required: [true, 'Notification type is required'],
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
      maxlength: [2000, 'Message cannot exceed 2000 characters'],
    },
    readAt: {
      type: Date,
      default: null,
    },
    relatedEntityType: {
      type: String,
      enum: ['mentorship', 'message', 'conversation', 'event', 'job', 'user'],
    },
    relatedEntityId: {
      type: Schema.Types.ObjectId,
    },
    actor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
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

// Performance compound indexes
NotificationSchema.index({ recipient: 1, createdAt: -1 });
NotificationSchema.index({ recipient: 1, readAt: 1, createdAt: -1 });

const Notification: Model<INotification> =
  mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema);

export default Notification;
