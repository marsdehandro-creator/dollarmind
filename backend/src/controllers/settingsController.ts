/**
 * Settings controller: profile, password, and preferences.
 */
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { userSettingsService } from '../services/index.js';
import { ValidationError } from '../utils/errors.js';

const profileSchema = z.object({ displayName: z.string().nullable().optional() });
const preferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  currency: z.string().optional(),
  chartType: z.enum(['bar', 'line']).optional(),
  defaultMonth: z.string().optional(),
  layout: z.enum(['auto', 'sidebar', 'bottomnav']).optional(),
});
const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
});

export async function getPreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const settings = await userSettingsService.getPreferences(req.auth!.sub, req.auth!.tenantId);
    res.json({ settings });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid profile payload');
    const settings = await userSettingsService.updateProfile(req.auth!.sub, req.auth!.tenantId, parsed.data);
    res.json({ settings });
  } catch (err) {
    next(err);
  }
}

export async function updatePreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = preferencesSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid preferences payload');
    const settings = await userSettingsService.updatePreferences(req.auth!.sub, req.auth!.tenantId, parsed.data);
    res.json({ settings });
  } catch (err) {
    next(err);
  }
}

export async function updatePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = passwordSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('currentPassword and newPassword are required');
    await userSettingsService.updatePassword(req.auth!.sub, parsed.data);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
