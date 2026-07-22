/**
 * Bank statement controller. Thin HTTP layer over StatementImportService.
 */
import type { NextFunction, Request, Response } from 'express';
import { statementImportService } from '../services/index.js';
import { ValidationError } from '@dollarmind/core/utils/errors.js';

export async function uploadStatement(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) throw new ValidationError('No file uploaded (expected multipart field "file")');
    const result = await statementImportService.uploadStatement({
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
    const statements = await statementImportService.getStatementHistory(req.auth!.tenantId);
    res.json({ statements });
  } catch (err) {
    next(err);
  }
}

export async function getStatementDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const detail = await statementImportService.getStatementDetail(req.auth!.tenantId, req.params.id);
    res.json(detail);
  } catch (err) {
    next(err);
  }
}
