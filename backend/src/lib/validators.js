import { z } from 'zod';

const decimalString = z.union([z.string(), z.number()]).transform((value) => String(value));
export const productTagSchema = z.object({
  id: z.string().min(1),
  labelAr: z.string().min(1),
  labelEn: z.string().min(1),
  color: z.string().min(1)
});

export const productOptionSchema = z.object({
  id: z.string().min(1),
  labelAr: z.string().min(1),
  labelEn: z.string().min(1),
  price: decimalString,
  required: z.coerce.boolean().default(false)
});

export const productChoiceGroupSchema = z.object({
  id: z.string().min(1),
  titleAr: z.string().min(1),
  titleEn: z.string().min(1),
  items: z.array(productOptionSchema).default([])
});

export const selectedProductChoiceSchema = z.object({
  groupId: z.string().min(1),
  groupTitleAr: z.string().optional().nullable(),
  groupTitleEn: z.string().optional().nullable(),
  choiceId: z.string().min(1),
  choiceLabelAr: z.string().optional().nullable(),
  choiceLabelEn: z.string().optional().nullable(),
  choicePrice: decimalString.optional().nullable()
});

export const tableUuidSchema = z.object({
  uuid: z.string().uuid()
});

export const menuQuerySchema = z.object({
  table: z.string().uuid().optional(),
  session: z.string().uuid().optional(),
  lang: z.enum(['ar', 'en']).optional()
});

export const categoryUpsertSchema = z.object({
  nameAr: z.string().optional().default(''),
  nameEn: z.string().optional().default(''),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.coerce.boolean().default(true),
  scope: z.enum(['menu', 'studio']).default('menu')
});

export const productUpsertSchema = z.object({
  categoryId: z.coerce.number().int(),
  nameAr: z.string().optional().default(''),
  nameEn: z.string().optional().default(''),
  descriptionAr: z.string().nullable().optional().default(''),
  descriptionEn: z.string().nullable().optional().default(''),
  mediaType: z.enum(['image', 'video']),
  coverMediaUrl: z.string().optional().default(''),
  galleryUrls: z.array(z.string()).default([]),
  ingredients: z.array(z.string()).default([]),
  tags: z.array(productTagSchema).default([]),
  allergens: z.array(z.string()).default([]),
  sizeOptions: z.array(productOptionSchema).default([]),
  sideDishOptions: z.array(productOptionSchema).default([]),
  addonOptions: z.array(productOptionSchema).default([]),
  customChoiceGroups: z.array(productChoiceGroupSchema).default([]),
  price: decimalString,
  calories: z.coerce.number().int().nullable().optional(),
  averageWaitTime: z.coerce.number().int().nullable().optional(),
  isDiscounted: z.coerce.boolean().default(false),
  discountPrice: decimalString.nullable().optional(),
  isAvailable: z.coerce.boolean().default(true),
  isFeatured: z.coerce.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
  scope: z.enum(['menu', 'studio']).default('menu')
});

export const orderCreateSchema = z.object({
  tableUuid: z.string().uuid(),
  session: z.string().uuid().optional(),
  items: z.array(z.object({
    productId: z.coerce.number().int(),
    quantity: z.coerce.number().int().min(1),
    selectedOptions: z.object({
      sizeId: z.string().min(1).optional().nullable(),
      sideDishIds: z.array(z.string().min(1)).default([]),
      addonIds: z.array(z.string().min(1)).default([]),
      customChoiceSelections: z.array(z.object({
        groupId: z.string().min(1),
        groupTitleAr: z.string().min(1).optional().nullable(),
        groupTitleEn: z.string().min(1).optional().nullable(),
        choiceId: z.string().min(1),
        choiceLabelAr: z.string().min(1).optional().nullable(),
        choiceLabelEn: z.string().min(1).optional().nullable(),
        choicePrice: decimalString.optional().nullable()
      })).default([]),
      offerId: z.coerce.number().int().positive().optional().nullable(),
      itemType: z.string().optional().default(''),
      offerNameAr: z.string().optional().default(''),
      offerNameEn: z.string().optional().default(''),
      offerNoteAr: z.string().optional().default(''),
      offerNoteEn: z.string().optional().default(''),
      offerImageUrl: z.string().optional().default(''),
      displayNameAr: z.string().optional().default(''),
      displayNameEn: z.string().optional().default(''),
      displayImageUrl: z.string().optional().default(''),
      offerGroupSelections: z.array(z.object({
        groupId: z.union([z.string(), z.number()]).transform((value) => String(value)),
        groupTitleAr: z.string().optional().nullable(),
        groupTitleEn: z.string().optional().nullable(),
        selectionMode: z.enum(['radio', 'checkbox']).optional().default('checkbox'),
        extraPrice: decimalString.optional().default('0'),
        includeProductOptions: z.coerce.boolean().default(false),
        productId: z.coerce.number().int().positive().optional().nullable(),
        productNameAr: z.string().optional().default(''),
        productNameEn: z.string().optional().default(''),
        productDescriptionAr: z.string().optional().default(''),
        productDescriptionEn: z.string().optional().default(''),
        productIngredients: z.array(z.string()).default([]),
        productAllergens: z.array(z.string()).default([]),
        productCustomChoiceGroups: z.array(productChoiceGroupSchema).default([]),
        productCustomChoiceSelections: z.array(selectedProductChoiceSchema).default([]),
        productCalories: z.coerce.number().int().nullable().optional(),
        productAverageWaitTime: z.coerce.number().int().nullable().optional()
      })).default([]),
      note: z.string().optional().default('')
    }).optional(),
    unitPrice: decimalString.optional()
  })).min(1)
});

export const waiterCallCreateSchema = z.object({
  tableUuid: z.string().uuid(),
  session: z.string().uuid().optional()
});

export const invoiceRequestSchema = z.object({
  tableUuid: z.string().uuid(),
  session: z.string().uuid().optional()
});

export const customerReviewSchema = z.object({
  tableUuid: z.string().uuid(),
  session: z.string().uuid().optional(),
  customerName: z.string().min(1),
  ratingMode: z.enum(['stars', 'emoji']),
  ratingValue: z.coerce.number().int().min(1).max(5),
  comment: z.string().optional().default('')
});

export const waiterComplaintSchema = z.object({
  tableNumber: z.string().min(1),
  complaint: z.string().min(1)
});

export const productViewCreateSchema = z.object({
  tableUuid: z.string().uuid().optional(),
  session: z.string().uuid().optional(),
  productId: z.coerce.number().int(),
  customerId: z.coerce.number().int().optional().nullable()
});

export const qrCreateSchema = z.object({
  tableNumber: z.string().optional().default(''),
  name: z.string().min(1).optional().default(''),
  tableColor: z.string().min(1).optional().default('')
});

export const qrUpdateSchema = z.object({
  tableNumber: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  tableColor: z.string().min(1).optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional()
});

export const tablePhoneSchema = z.object({
  uuid: z.string().uuid(),
  phone: z.string().regex(/^01\d{9}$/u, 'Phone number must be 11 digits and start with 01'),
  session: z.string().uuid().optional()
});

export const tableCloseSchema = z.object({
  uuid: z.string().uuid(),
  phone: z.preprocess(
    (value) => {
      const normalized = String(value ?? '').trim();
      return normalized || undefined;
    },
    z.string().regex(/^01\d{9}$/u, 'Phone number must be 11 digits and start with 01').optional()
  ),
  session: z.string().uuid().optional()
});

export const uploadSchema = z.object({
  fileData: z.string().min(1),
  fileName: z.string().min(1).optional()
});

export const analyticsRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  bucket: z.enum(['day', 'week', 'month']).optional()
});

export const reportScheduleSchema = z.object({
  branchId: z.coerce.number().int().nullable().optional(),
  name: z.string().min(1),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  deliveryType: z.string().min(1),
  recipient: z.string().min(1),
  isActive: z.coerce.boolean().default(true),
  nextRunAt: z.string().datetime().nullable().optional(),
  lastRunAt: z.string().datetime().nullable().optional()
});

export const employeeCreateSchema = z.object({
  branchId: z.coerce.number().int().nullable().optional(),
  fullName: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().or(z.literal('')).optional().transform((value) => {
    if (value === undefined || value === '') return null;
    return value;
  }),
  password: z.string().min(6),
  confirmPassword: z.string().min(6),
  role: z.enum(['manager', 'waiter', 'cashier', 'seller', 'admin']),
  isActive: z.coerce.boolean().default(true)
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Password confirmation does not match',
  path: ['confirmPassword']
});

export const employeeUpdateSchema = z.object({
  branchId: z.coerce.number().int().nullable().optional(),
  fullName: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  email: z.string().email().or(z.literal('')).optional().transform((value) => {
    if (value === undefined || value === '') return undefined;
    return value;
  }),
  password: z.string().min(6).optional(),
  confirmPassword: z.string().min(6).optional(),
  role: z.enum(['manager', 'waiter', 'cashier', 'seller', 'admin']).optional(),
  isActive: z.coerce.boolean().optional()
}).refine((data) => {
  if (data.password || data.confirmPassword) {
    return data.password === data.confirmPassword;
  }
  return true;
}, {
  message: 'Password confirmation does not match',
  path: ['confirmPassword']
});
