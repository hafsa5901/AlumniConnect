import mongoose, { Document, Schema, Types } from 'mongoose';

export type EventCategory = 'webinar' | 'reunion' | 'workshop' | 'career' | 'networking';
export type EventLocationType = 'virtual' | 'in_person' | 'hybrid';
export type EventApprovalStatus = 'pending' | 'approved' | 'rejected';
export type RSVPStatus = 'attending' | 'cancelled';

export interface IRSVP {
  user: Types.ObjectId;
  status: RSVPStatus;
  registeredAt: Date;
}

export interface IEvent extends Document {
  _id: Types.ObjectId;
  title: string;
  description: string;
  category: EventCategory;
  startDate: Date;
  endDate: Date;
  locationType: EventLocationType;
  venueOrLink: string;
  organizer: Types.ObjectId;
  capacity?: number;
  approvalStatus: EventApprovalStatus;
  rejectionReason?: string;
  rsvps: IRSVP[];
  bannerUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RSVPSchema = new Schema<IRSVP>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['attending', 'cancelled'],
      required: true,
      default: 'attending',
    },
    registeredAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const EventSchema = new Schema<IEvent>(
  {
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Event description is required'],
      trim: true,
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },
    category: {
      type: String,
      enum: {
        values: ['webinar', 'reunion', 'workshop', 'career', 'networking'],
        message: 'Invalid event category',
      },
      required: [true, 'Category is required'],
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
      validate: {
        validator: function (this: IEvent, value: Date) {
          return !this.startDate || value >= this.startDate;
        },
        message: 'End date must be greater than or equal to start date',
      },
    },
    locationType: {
      type: String,
      enum: {
        values: ['virtual', 'in_person', 'hybrid'],
        message: 'Invalid location type',
      },
      required: [true, 'Location type is required'],
    },
    venueOrLink: {
      type: String,
      required: [true, 'Venue address or meeting link is required'],
      trim: true,
    },
    organizer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Event organizer is required'],
    },
    capacity: {
      type: Number,
      min: [1, 'Capacity must be at least 1'],
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    rsvps: {
      type: [RSVPSchema],
      default: [],
    },
    bannerUrl: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
EventSchema.index({ approvalStatus: 1, startDate: 1 });
EventSchema.index({ category: 1 });
EventSchema.index({ organizer: 1 });

const Event = mongoose.model<IEvent>('Event', EventSchema);

export default Event;
