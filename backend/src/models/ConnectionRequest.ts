import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export type ConnectionStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'removed';

export interface IConnectionRequest extends Document {
  _id: Types.ObjectId;
  requester: Types.ObjectId;
  recipient: Types.ObjectId;
  participantA: Types.ObjectId;
  participantB: Types.ObjectId;
  status: ConnectionStatus;
  message?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IConnectionRequestModel extends Model<IConnectionRequest> {
  getCanonicalParticipants(
    id1: string | Types.ObjectId,
    id2: string | Types.ObjectId
  ): { participantA: Types.ObjectId; participantB: Types.ObjectId };
}

const ConnectionRequestSchema = new Schema<IConnectionRequest, IConnectionRequestModel>(
  {
    requester: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Requester is required'],
      index: true,
    },
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient is required'],
      index: true,
    },
    participantA: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Canonical participantA is required'],
    },
    participantB: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Canonical participantB is required'],
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'accepted', 'rejected', 'withdrawn', 'removed'],
        message: 'Invalid connection status',
      },
      default: 'pending',
      required: true,
    },
    message: {
      type: String,
      trim: true,
      maxlength: [500, 'Connection message cannot exceed 500 characters'],
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Helper to determine direction-independent canonical participant ordering
 * (smaller ObjectId string -> participantA, larger -> participantB).
 */
ConnectionRequestSchema.statics.getCanonicalParticipants = function (
  id1: string | Types.ObjectId,
  id2: string | Types.ObjectId
) {
  const str1 = id1.toString();
  const str2 = id2.toString();

  if (str1 < str2) {
    return {
      participantA: new Types.ObjectId(str1),
      participantB: new Types.ObjectId(str2),
    };
  } else {
    return {
      participantA: new Types.ObjectId(str2),
      participantB: new Types.ObjectId(str1),
    };
  }
};

// Partial unique index on canonical participants for active relationships
ConnectionRequestSchema.index(
  { participantA: 1, participantB: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['pending', 'accepted'] } },
  }
);

// Indexes for inboxes and query performance
ConnectionRequestSchema.index({ recipient: 1, status: 1, createdAt: -1 });
ConnectionRequestSchema.index({ requester: 1, status: 1, createdAt: -1 });
ConnectionRequestSchema.index({ status: 1 });

const ConnectionRequest = mongoose.model<IConnectionRequest, IConnectionRequestModel>(
  'ConnectionRequest',
  ConnectionRequestSchema
);

export default ConnectionRequest;
