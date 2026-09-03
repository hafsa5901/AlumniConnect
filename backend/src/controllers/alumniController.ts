import { Request, Response } from 'express';
import mongoose from 'mongoose';
import User from '../models/User';

export async function listAlumni(req: Request, res: Response): Promise<void> {
  const {
    search,
    department,
    batch,
    company,
    skills,
    location,
    page = '1',
    limit = '12',
  } = req.query;

  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 12));
  const skip = (pageNum - 1) * limitNum;

  // Base scope: verified and active alumni only
  const filter: Record<string, any> = {
    role: 'alumni',
    verificationStatus: 'admin_approved',
    accountStatus: 'active',
  };

  if (department && typeof department === 'string' && department.trim()) {
    filter.department = new RegExp(`^${department.trim()}$`, 'i');
  }

  if (batch && typeof batch === 'string' && batch.trim()) {
    filter.batch = batch.trim();
  }

  if (company && typeof company === 'string' && company.trim()) {
    filter.company = new RegExp(company.trim(), 'i');
  }

  if (location && typeof location === 'string' && location.trim()) {
    filter.location = new RegExp(location.trim(), 'i');
  }

  if (skills && typeof skills === 'string' && skills.trim()) {
    const skillList = skills.split(',').map((s) => s.trim()).filter(Boolean);
    if (skillList.length > 0) {
      filter.skills = { $in: skillList.map((s) => new RegExp(s, 'i')) };
    }
  }

  if (search && typeof search === 'string' && search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    filter.$or = [
      { name: searchRegex },
      { company: searchRegex },
      { designation: searchRegex },
      { department: searchRegex },
      { skills: { $in: [searchRegex] } },
    ];
  }

  const [total, alumni] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .select('name profilePhotoUrl designation company department batch skills location mentorshipEnabled')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
  ]);

  const sanitizedAlumni = alumni.map((doc: any) => ({
    id: doc._id.toString(),
    name: doc.name,
    profilePhotoUrl: doc.profilePhotoUrl,
    designation: doc.designation,
    company: doc.company,
    department: doc.department,
    batch: doc.batch,
    skills: doc.skills || [],
    location: doc.location,
    mentorshipEnabled: Boolean(doc.mentorshipEnabled),
  }));

  res.status(200).json({
    success: true,
    data: {
      alumni: sanitizedAlumni,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    },
  });
}

export async function getAlumniById(req: Request, res: Response): Promise<void> {
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  // Handle malformed ObjectId cleanly before querying to avoid 500 cast errors
  if (!id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Alumni profile not found.' },
    });
    return;
  }

  const alumni = await User.findOne({
    _id: id,
    role: 'alumni',
    verificationStatus: 'admin_approved',
    accountStatus: 'active',
  })
    .select(
      'name profilePhotoUrl designation company department batch skills location mentorshipEnabled bio education experience links createdAt'
    )
    .lean();

  if (!alumni) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Alumni profile not found.' },
    });
    return;
  }

  const detailPayload = {
    id: alumni._id.toString(),
    name: alumni.name,
    profilePhotoUrl: alumni.profilePhotoUrl,
    designation: alumni.designation,
    company: alumni.company,
    department: alumni.department,
    batch: alumni.batch,
    skills: alumni.skills || [],
    location: alumni.location,
    mentorshipEnabled: Boolean(alumni.mentorshipEnabled),
    bio: alumni.bio,
    education: alumni.education || [],
    experience: alumni.experience || [],
    links: alumni.links || {},
    joinedDate: alumni.createdAt,
  };

  res.status(200).json({
    success: true,
    data: {
      alumni: detailPayload,
    },
  });
}
