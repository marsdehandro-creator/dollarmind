/**
 * Salary slip controller. Thin HTTP layer over SalarySlipService.
 */
import type { NextFunction, Request, Response } from 'express';
import { salarySlipService } from '../services/index.js';
import { ValidationError } from '@dollarmind/core/utils/errors.js';

export async function uploadSlip(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) throw new ValidationError('No file uploaded (expected multipart field "file")');
    const result = await salarySlipService.uploadSlip({
      tenantId: req.auth!.tenantId,
      file: {
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const slips = await salarySlipService.getSlipHistory(req.auth!.tenantId);
    res.json({ slips });
  } catch (err) {
    next(err);
  }
}
