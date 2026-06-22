import { Router } from 'express';
import { z } from 'zod';
import { sendOk } from '../lib/http.js';
import { readSiteSettings, writeSiteSettings } from '../lib/siteSettings.js';
import { emitDataChanged } from '../lib/realtime.js';

const settingsPatchSchema = z.object({
  logoUrl: z.string().optional(),
  faviconUrl: z.string().optional(),
  restaurantName: z.string().optional(),
  restaurantNameAr: z.string().optional(),
  restaurantNameEn: z.string().optional(),
  phone: z.string().optional(),
  theme: z.enum(['light', 'dark']).optional(),
  buttonColor: z.string().optional(),
  headingColor: z.string().optional(),
  headingFont: z.string().optional(),
  bodyFont: z.string().optional(),
  heroSlides: z.array(z.string()).optional(),
  offerGroup: z.object({
    titleAr: z.string().optional(),
    titleEn: z.string().optional(),
    productIds: z.array(z.union([z.string(), z.number()])).optional(),
    price: z.string().optional(),
    isActive: z.coerce.boolean().optional()
  }).optional(),
  vipCampaigns: z.array(z.object({
    id: z.string().optional(),
    isActive: z.coerce.boolean().optional(),
    targetMode: z.enum(['visits', 'amount']).optional(),
    targetTrigger: z.coerce.number().int().min(1).optional(),
    targetAmount: z.coerce.number().min(0).optional(),
    rewardType: z.enum(['product', 'financial']).optional(),
    productRewardId: z.union([z.string(), z.number()]).transform((value) => String(value)).optional(),
    productRewardTitleAr: z.string().optional(),
    productRewardTitleEn: z.string().optional(),
    financialDiscountType: z.enum(['percent', 'fixed']).optional(),
    percentage: z.coerce.number().min(0).optional(),
    fixedAmount: z.coerce.number().min(0).optional(),
    popupTitleAr: z.string().optional(),
    popupTitleEn: z.string().optional(),
    popupBodyAr: z.string().optional(),
    popupBodyEn: z.string().optional()
  })).optional(),
  vipCampaign: z.object({
    isActive: z.coerce.boolean().optional(),
    targetMode: z.enum(['visits', 'amount']).optional(),
    targetTrigger: z.coerce.number().int().min(1).optional(),
    targetAmount: z.coerce.number().min(0).optional(),
    rewardType: z.enum(['product', 'financial']).optional(),
    productRewardId: z.union([z.string(), z.number()]).transform((value) => String(value)).optional(),
    productRewardTitleAr: z.string().optional(),
    productRewardTitleEn: z.string().optional(),
    financialDiscountType: z.enum(['percent', 'fixed']).optional(),
    percentage: z.coerce.number().min(0).optional(),
    fixedAmount: z.coerce.number().min(0).optional(),
    popupTitleAr: z.string().optional(),
    popupTitleEn: z.string().optional(),
    popupBodyAr: z.string().optional(),
    popupBodyEn: z.string().optional()
  }).optional(),
  socialLinks: z.object({
    facebook: z.string().optional(),
    instagram: z.string().optional(),
    snapchat: z.string().optional(),
    tiktok: z.string().optional(),
    youtube: z.string().optional()
  }).optional()
});

export const settingsRouter = Router();

settingsRouter.get('/', async (_req, res, next) => {
  try {
    const settings = await readSiteSettings();
    sendOk(res, settings);
  } catch (error) {
    next(error);
  }
});

settingsRouter.put('/', async (req, res, next) => {
  try {
    const payload = settingsPatchSchema.parse(req.body);
    const current = await readSiteSettings();
    const settings = await writeSiteSettings({
      ...current,
      ...payload,
      socialLinks: {
        ...(current.socialLinks ?? {}),
        ...(payload.socialLinks ?? {})
      },
      offerGroup: {
        ...(current.offerGroup ?? {}),
        ...(payload.offerGroup ?? {})
      },
      vipCampaigns: Array.isArray(payload.vipCampaigns) ? payload.vipCampaigns : current.vipCampaigns ?? [],
      vipCampaign: {
        ...(current.vipCampaign ?? {}),
        ...(payload.vipCampaign ?? {})
      }
    });
    emitDataChanged(req.app.get('io'), { entity: 'site-settings', action: 'update' });
    sendOk(res, settings);
  } catch (error) {
    next(error);
  }
});
