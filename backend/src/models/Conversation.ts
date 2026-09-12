import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IConversation extends Document {
  _id: Types.ObjectId;
  participantA: Types.ObjectId;
  participantB: Types.ObjectId;
  lastMessage?: string;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IConversationModel extends Model<IConversation> {
  getCanonicalParticipants(
    user1: string | Types.ObjectId,
    user2: string | Types.ObjectId
  ): { participantA: Types.ObjectId; participantB: Types.ObjectId };
}

const ConversationSchema = new Schema<IConversation>(
  {
    participantA: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Participant A is required'],
    },
    participantB: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Participant B is required'],
    },
    lastMessage: {
      type: String,
      trim: true,
      maxlength: [2000, 'Last message preview cannot exceed 2000 characters'],
    },
    lastMessageAt: {
      type: Date,
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

// Compound UNIQUE index on the canonically sorted pair
ConversationSchema.index({ participantA: 1, participantB: 1 }, { unique: true });
ConversationSchema.index({ participantA: 1, lastMessageAt: -1 });
ConversationSchema.index({ participantB: 1, lastMessageAt: -1 });

// Helper to determine canonical participant ordering
ConversationSchema.statics.getCanonicalParticipants = function (
  user1: string | Types.ObjectId,
  user2: string | Types.ObjectId
): { participantA: Types.ObjectId; participantB: Types.ObjectId } {
  const str1 = user1.toString();
  const str2 = user2.toString();

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

const Conversation: IConversationModel =
  (mongoose.models.Conversation as IConversationModel) ||
  mongoose.model<IConversation, IConversationModel>('Conversation', ConversationSchema);

export default Conversation;
