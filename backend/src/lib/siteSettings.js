import { prisma } from './prisma.js';

const defaultSettings = {
  logoUrl: '',
  faviconUrl: '',
  restaurantName: '',
  restaurantNameAr: '',
  restaurantNameEn: '',
  phone: '',
  theme: 'light',
  buttonColor: '#d7a439',
  headingColor: '#10172a',
  headingFont: 'Tajawal',
  bodyFont: 'Tajawal',
  heroSlides: [],
  offerGroup: {
    titleAr: '',
    titleEn: '',
    productIds: [],
    price: '',
    isActive: false
  },
  vipCampaigns: [],
  vipCampaign: {
    isActive: false,
    targetMode: 'visits',
    targetTrigger: 10,
    targetAmount: 0,
    rewardType: 'product',
    productRewardId: '',
    productRewardTitleAr: '',
    productRewardTitleEn: '',
    financialDiscountType: 'percent',
    percentage: 10,
    fixedAmount: 50,
    popupTitleAr: 'شكراً لزيارتك المتكررة!',
    popupTitleEn: 'Thank you for returning!',
    popupBodyAr: 'في مرتك القادمة ستحصل على هدية خاصة للعملاء المميزين.',
    popupBodyEn: 'On your next visit, you will receive a special VIP reward.'
  },
  socialLinks: {
    facebook: '',
    instagram: '',
    snapchat: '',
    tiktok: '',
    youtube: ''
  }
};

function mergeSettings(base, patch) {
  const current = normalizeSettings(base ?? defaultSettings);
  const incoming = patch && typeof patch === 'object' ? patch : {};
  const socialLinks = incoming.socialLinks && typeof incoming.socialLinks === 'object' ? incoming.socialLinks : {};
  const offerGroup = incoming.offerGroup && typeof incoming.offerGroup === 'object' ? incoming.offerGroup : {};
  const vipCampaign = incoming.vipCampaign && typeof incoming.vipCampaign === 'object' ? incoming.vipCampaign : {};
  const vipCampaigns = Array.isArray(incoming.vipCampaigns) ? incoming.vipCampaigns : current.vipCampaigns ?? [];
  return normalizeSettings({
    ...current,
    ...incoming,
    socialLinks: {
      ...current.socialLinks,
      ...socialLinks
    },
    offerGroup: {
      ...current.offerGroup,
      ...offerGroup
    },
    vipCampaigns,
    vipCampaign: {
      ...current.vipCampaign,
      ...vipCampaign
    }
  });
}

function normalizeSettings(value) {
  if (!value || typeof value !== 'object') return { ...defaultSettings };
  const data = value.value ?? value;
  const socialLinks = data.socialLinks && typeof data.socialLinks === 'object' ? data.socialLinks : {};
  const vipCampaign = data.vipCampaign && typeof data.vipCampaign === 'object' ? data.vipCampaign : {};
  const theme = data.theme === 'dark' ? 'dark' : data.theme === 'light' ? 'light' : 'light';
  return {
    logoUrl: typeof data.logoUrl === 'string' ? data.logoUrl : '',
    restaurantName: typeof data.restaurantName === 'string' ? data.restaurantName : '',
    restaurantNameAr: typeof data.restaurantNameAr === 'string' ? data.restaurantNameAr : '',
    restaurantNameEn: typeof data.restaurantNameEn === 'string' ? data.restaurantNameEn : '',
    faviconUrl: typeof data.faviconUrl === 'string' ? data.faviconUrl : '',
    phone: typeof data.phone === 'string' ? data.phone : '',
    theme,
    buttonColor: typeof data.buttonColor === 'string' ? data.buttonColor : defaultSettings.buttonColor,
    headingColor: typeof data.headingColor === 'string' ? data.headingColor : defaultSettings.headingColor,
    headingFont: typeof data.headingFont === 'string' ? data.headingFont : defaultSettings.headingFont,
    bodyFont: typeof data.bodyFont === 'string' ? data.bodyFont : defaultSettings.bodyFont,
    heroSlides: Array.isArray(data.heroSlides) ? data.heroSlides.filter(Boolean) : [],
    offerGroup: {
      titleAr: typeof data.offerGroup?.titleAr === 'string' ? data.offerGroup.titleAr : '',
      titleEn: typeof data.offerGroup?.titleEn === 'string' ? data.offerGroup.titleEn : '',
      productIds: Array.isArray(data.offerGroup?.productIds)
        ? data.offerGroup.productIds.map((value) => String(value)).filter(Boolean)
      : [],
      price: typeof data.offerGroup?.price === 'string' ? data.offerGroup.price : '',
      isActive: Boolean(data.offerGroup?.isActive)
    },
    vipCampaigns: Array.isArray(data.vipCampaigns)
      ? data.vipCampaigns.map((campaign) => ({
        id: typeof campaign?.id === 'string' ? campaign.id : String(campaign?.id ?? ''),
        isActive: Boolean(campaign?.isActive),
        targetMode: 'visits',
        targetTrigger: Number.isFinite(Number(campaign?.targetTrigger)) ? Number(campaign.targetTrigger) : defaultSettings.vipCampaign.targetTrigger,
        targetAmount: 0,
        rewardType: campaign?.rewardType === 'financial' ? 'financial' : 'product',
        productRewardId: typeof campaign?.productRewardId === 'string' ? campaign.productRewardId : '',
        productRewardTitleAr: typeof campaign?.productRewardTitleAr === 'string' ? campaign.productRewardTitleAr : '',
        productRewardTitleEn: typeof campaign?.productRewardTitleEn === 'string' ? campaign.productRewardTitleEn : '',
        financialDiscountType: campaign?.financialDiscountType === 'fixed' ? 'fixed' : 'percent',
        percentage: Number.isFinite(Number(campaign?.percentage)) ? Number(campaign.percentage) : defaultSettings.vipCampaign.percentage,
        fixedAmount: Number.isFinite(Number(campaign?.fixedAmount)) ? Number(campaign.fixedAmount) : defaultSettings.vipCampaign.fixedAmount,
        popupTitleAr: typeof campaign?.popupTitleAr === 'string' ? campaign.popupTitleAr : defaultSettings.vipCampaign.popupTitleAr,
        popupTitleEn: typeof campaign?.popupTitleEn === 'string' ? campaign.popupTitleEn : defaultSettings.vipCampaign.popupTitleEn,
        popupBodyAr: typeof campaign?.popupBodyAr === 'string' ? campaign.popupBodyAr : defaultSettings.vipCampaign.popupBodyAr,
        popupBodyEn: typeof campaign?.popupBodyEn === 'string' ? campaign.popupBodyEn : defaultSettings.vipCampaign.popupBodyEn
      }))
      : [],
    vipCampaign: {
      isActive: Boolean(vipCampaign.isActive),
      targetMode: 'visits',
      targetTrigger: Number.isFinite(Number(vipCampaign.targetTrigger)) ? Number(vipCampaign.targetTrigger) : defaultSettings.vipCampaign.targetTrigger,
      targetAmount: 0,
      rewardType: vipCampaign.rewardType === 'financial' ? 'financial' : 'product',
      productRewardId: typeof vipCampaign.productRewardId === 'string' ? vipCampaign.productRewardId : '',
      productRewardTitleAr: typeof vipCampaign.productRewardTitleAr === 'string' ? vipCampaign.productRewardTitleAr : '',
      productRewardTitleEn: typeof vipCampaign.productRewardTitleEn === 'string' ? vipCampaign.productRewardTitleEn : '',
      financialDiscountType: vipCampaign.financialDiscountType === 'fixed' ? 'fixed' : 'percent',
      percentage: Number.isFinite(Number(vipCampaign.percentage)) ? Number(vipCampaign.percentage) : defaultSettings.vipCampaign.percentage,
      fixedAmount: Number.isFinite(Number(vipCampaign.fixedAmount)) ? Number(vipCampaign.fixedAmount) : defaultSettings.vipCampaign.fixedAmount,
      popupTitleAr: typeof vipCampaign.popupTitleAr === 'string' ? vipCampaign.popupTitleAr : defaultSettings.vipCampaign.popupTitleAr,
      popupTitleEn: typeof vipCampaign.popupTitleEn === 'string' ? vipCampaign.popupTitleEn : defaultSettings.vipCampaign.popupTitleEn,
      popupBodyAr: typeof vipCampaign.popupBodyAr === 'string' ? vipCampaign.popupBodyAr : defaultSettings.vipCampaign.popupBodyAr,
      popupBodyEn: typeof vipCampaign.popupBodyEn === 'string' ? vipCampaign.popupBodyEn : defaultSettings.vipCampaign.popupBodyEn
    },
    socialLinks: {
      facebook: typeof socialLinks.facebook === 'string' ? socialLinks.facebook : '',
      instagram: typeof socialLinks.instagram === 'string' ? socialLinks.instagram : '',
      snapchat: typeof socialLinks.snapchat === 'string' ? socialLinks.snapchat : '',
      tiktok: typeof socialLinks.tiktok === 'string' ? socialLinks.tiktok : '',
      youtube: typeof socialLinks.youtube === 'string' ? socialLinks.youtube : ''
    }
  };
}

export async function readSiteSettings() {
  const record = await prisma.siteSetting.findUnique({ where: { key: 'global' } });
  if (!record) {
    const created = await prisma.siteSetting.create({
      data: { key: 'global', value: defaultSettings }
    });
    return normalizeSettings(created.value);
  }
  return normalizeSettings(record.value);
}

export async function writeSiteSettings(settings) {
  const record = await prisma.siteSetting.findUnique({ where: { key: 'global' } });
  const current = record ? normalizeSettings(record.value) : { ...defaultSettings };
  const next = mergeSettings(current, settings);
  await prisma.siteSetting.upsert({
    where: { key: 'global' },
    create: { key: 'global', value: next },
    update: { value: next }
  });
  return next;
}
