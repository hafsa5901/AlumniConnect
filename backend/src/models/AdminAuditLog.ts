import mongoose, { Schema, Document, Model } from 'mongoose';

export type AuditAction =
  | 'user.approve'
  | 'user.reject'
  | 'user.suspend'
  | 'user.reactivate'
  | 'user.delete'
  | 'user.create_admin'
  | 'event.approve'
  | 'event.reject'
  | 'event.cancel'
  | 'job.remove';

export interface IAdminAuditLog extends Document {
  admin: mongoose.Types.ObjectId;
  action: AuditAction;
  targetType: 'user' | 'event' | 'job';
  targetId: mongoose.Types.ObjectId;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

const AdminAuditLogSchema = new Schema<IAdminAuditLog>(
  {
    admin: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: {
      type: String,
      enum: [
        'user.approve', 'user.reject', 'user.suspend', 'user.reactivate',
        'user.delete', 'user.create_admin', 'event.approve', 'event.reject',
        'event.cancel', 'job.remove',
      ] satisfies AuditAction[],
      required: true,
    },
    targetType: { type: String, enum: ['user', 'event', 'job'], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, any>) => { ret.id = ret._id; delete ret._id; delete ret.__v; return ret; },
    },
  }
);

const AdminAuditLog: Model<IAdminAuditLog> =
  mongoose.models.AdminAuditLog ||
  mongoose.model<IAdminAuditLog>('AdminAuditLog', AdminAuditLogSchema);

export default AdminAuditLog;
