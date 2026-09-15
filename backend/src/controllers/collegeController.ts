import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { asyncHandler, createError } from '../middleware/errorHandler';
import College from '../models/College';
import AdminAuditLog from '../models/AdminAuditLog';
import { paginate, paginatedResponse } from '../utils/helpers';

// ── GET /api/v1/colleges ──────────────────────────────────────────────────────
export const listColleges = asyncHandler(async (req: Request, res: Response) => {
  const { search, isActive, page = '1', limit = '50' } = req.query as Record<string, string>;
  const { skip, limit: lim, page: pg } = paginate(+page, +limit);

  const filter: Record<string, any> = {};

  // Standard callers only see active colleges
  if (isActive !== undefined) {
    filter.isActive = isActive === 'true';
  } else {
    filter.isActive = true;
  }

  if (search && search.trim()) {
    const term = search.trim();
    filter.$or = [
      { name: { $regex: term, $options: 'i' } },
      { code: { $regex: term, $options: 'i' } },
      { domains: { $regex: term, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    College.find(filter)
      .sort({ name: 1 })
      .skip(skip)
      .limit(lim),
    College.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: paginatedResponse(items, total, pg, lim),
  });
});

// ── GET /api/v1/colleges/:id ──────────────────────────────────────────────────
export const getCollegeById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw createError('College not found.', 404, 'NOT_FOUND');
  }

  const college = await College.findById(id);
  if (!college) {
    throw createError('College not found.', 404, 'NOT_FOUND');
  }

  res.json({
    success: true,
    data: { college },
  });
});

// ── POST /api/v1/colleges (Admin Only) ────────────────────────────────────────
export const createCollege = asyncHandler(async (req: Request, res: Response) => {
  const { name, code, domains, location, website, isActive } = req.body;

  const normalizedCode = code.trim().toUpperCase();
  const normalizedName = name.trim();
  const normalizedDomains = Array.from(
    new Set((domains as string[]).map((d) => d.trim().toLowerCase()))
  );

  // Check unique name / code
  const existing = await College.findOne({
    $or: [{ code: normalizedCode }, { name: { $regex: `^${normalizedName}$`, $options: 'i' } }],
  });

  if (existing) {
    throw createError(
      'A college with this name or code already exists in master data.',
      409,
      'COLLEGE_ALREADY_EXISTS'
    );
  }

  const college = await College.create({
    name: normalizedName,
    code: normalizedCode,
    domains: normalizedDomains,
    location,
    website,
    isActive: isActive ?? true,
    createdBy: req.user!._id,
  });

  await AdminAuditLog.create({
    admin: req.user!._id,
    action: 'college.create' as any,
    targetType: 'college' as any,
    targetId: college._id,
    metadata: { name: college.name, code: college.code, domains: college.domains },
  }).catch(() => {});

  res.status(201).json({
    success: true,
    data: { college },
  });
});

// ── PATCH /api/v1/colleges/:id (Admin Only) ───────────────────────────────────
export const updateCollege = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw createError('College not found.', 404, 'NOT_FOUND');
  }

  const { name, code, domains, location, website, isActive } = req.body;

  const college = await College.findById(id);
  if (!college) {
    throw createError('College not found.', 404, 'NOT_FOUND');
  }

  if (name && name.trim()) {
    const normalizedName = name.trim();
    const duplicate = await College.findOne({
      _id: { $ne: college._id },
      name: { $regex: `^${normalizedName}$`, $options: 'i' },
    });
    if (duplicate) {
      throw createError('Another college already has this name.', 409, 'DUPLICATE_NAME');
    }
    college.name = normalizedName;
  }

  if (code && code.trim()) {
    const normalizedCode = code.trim().toUpperCase();
    const duplicate = await College.findOne({
      _id: { $ne: college._id },
      code: normalizedCode,
    });
    if (duplicate) {
      throw createError('Another college already has this code.', 409, 'DUPLICATE_CODE');
    }
    college.code = normalizedCode;
  }

  if (domains && Array.isArray(domains)) {
    college.domains = Array.from(new Set(domains.map((d: string) => d.trim().toLowerCase())));
  }

  if (location !== undefined) college.location = location;
  if (website !== undefined) college.website = website;
  if (isActive !== undefined) college.isActive = isActive;

  await college.save();

  await AdminAuditLog.create({
    admin: req.user!._id,
    action: 'college.update' as any,
    targetType: 'college' as any,
    targetId: college._id,
    metadata: { name: college.name, code: college.code },
  }).catch(() => {});

  res.json({
    success: true,
    data: { college },
  });
});
