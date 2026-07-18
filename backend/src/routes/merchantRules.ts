/**
 * Merchant rule routes: /api/merchant-rules/*
 */
import { Router } from 'express';
import { createMerchantRule, listMerchantRules } from '../controllers/merchantRuleController.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const merchantRuleRoutes = Router();

merchantRuleRoutes.post('/', requireAuth, createMerchantRule);
merchantRuleRoutes.get('/', requireAuth, listMerchantRules);
