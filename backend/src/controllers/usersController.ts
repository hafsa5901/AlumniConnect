import { Request, Response } from 'express';
import User, { SAFE_USER_FIELDS } from '../models/User';
import { calculateProfileCompletion } from '../utils/profileCompletion';
import { storageService } from '../services/storage';

export async function getMe(req: Request, res: Response): Promise<void> {
  const userId = req.user!._id;
  const user = await User.findById(userId).select(SAFE_USER_FIELDS);
  if (!user) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'User not found.' },
    });
    return;
  }

  const profileCompletion = calculateProfileCompletion(user);

  res.status(200).json({
    success: true,
    data: {
      user,
      profileCompletion,
    },
  });
}

export async function updateMe(req: Request, res: Response): Promise<void> {
  const userId = req.user!._id;
  const user = await User.findById(userId);
  if (!user) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'User not found.' },
    });
    return;
  }

  const role = user.role;
  const body = req.body || {};

  // Server-side strict field filtering by role
  const updates: Record<string, any> = {};

  // Fields allowed for all roles (student, alumni, admin)
  if (body.bio !== undefined) updates.bio = body.bio;
  if (body.location !== undefined) updates.location = body.location;
  if (body.skills !== undefined && Array.isArray(body.skills)) updates.skills = body.skills;
  if (body.education !== undefined && Array.isArray(body.education)) updates.education = body.education;
  if (body.links !== undefined && typeof body.links === 'object') updates.links = body.links;

  // Fields allowed exclusively for alumni
  if (role === 'alumni') {
    if (body.company !== undefined) updates.company = body.company;
    if (body.designation !== undefined) updates.designation = body.designation;
    if (body.experience !== undefined && Array.isArray(body.experience)) updates.experience = body.experience;
    if (body.mentorshipEnabled !== undefined) updates.mentorshipEnabled = Boolean(body.mentorshipEnabled);
  }

  // Apply updates to Mongoose document
  Object.assign(user, updates);
  await user.save();

  const safeUser = await User.findById(userId).select(SAFE_USER_FIELDS);
  const profileCompletion = calculateProfileCompletion(safeUser);

  res.status(200).json({
    success: true,
    data: {
      user: safeUser,
      profileCompletion,
    },
  });
}

export async function uploadPhoto(req: Request, res: Response): Promise<void> {
  const userId = req.user!._id;
  const user = await User.findById(userId);
  if (!user) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'User not found.' },
    });
    return;
  }

  if (!req.file) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'No image file provided.' },
    });
    return;
  }

  // Save new avatar file
  const oldPhotoUrl = user.profilePhotoUrl;
  const newPhotoUrl = await storageService.save(req.file, 'avatars');

  // If old photo was stored locally, clean it up
  if (oldPhotoUrl && oldPhotoUrl !== newPhotoUrl) {
    await storageService.delete(oldPhotoUrl);
  }

  user.profilePhotoUrl = newPhotoUrl;
  await user.save();

  res.status(200).json({
    success: true,
    data: {
      profilePhotoUrl: newPhotoUrl,
    },
  });
}
