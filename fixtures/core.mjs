// Boot-time data every page needs: session, tenant, pages, bell, copilot health.
import { TENANT_ID, T, daysAgo, daysAhead, hoursAgo } from './shared.mjs';

const escaped = T.replace(/\//g, '\\/');
const rx = (suffix) => new RegExp(`^${escaped}${suffix}$`);

export const pages = [
  {
    id: 'page-1', pageId: '100000000000001', pageName: 'Гоо сайхны онлайн дэлгүүр — Улаанбаатар', pagePictureUrl: null,
    instagramBusinessId: 'ig-1', instagramBusinessUsername: 'beauty_shop_test', instagramBusinessName: 'Гоо сайхны дэлгүүр', instagramBusinessProfilePictureUrl: null,
    status: 'CONNECTED', webhookSubscribed: true, instagramBusinessWebhookSubscribed: true, instagramBusinessWebhookError: null,
    messengerBotActive: true, instagramBusinessBotActive: true, defaultCommentReplyMode: 'AI', defaultCommentStaticReplyText: null,
    defaultCommentStaticReplyTexts: [], defaultCommentPrivateReplyEnabled: true, autoHideNegativeComments: true,
    chatbotActive: true, lastEventAt: hoursAgo(1), routing: null,
  },
  {
    id: 'page-2', pageId: '100000000000002', pageName: 'Хүүхдийн хувцасны дэлгүүр', pagePictureUrl: null,
    instagramBusinessId: null, instagramBusinessUsername: null, instagramBusinessName: null, instagramBusinessProfilePictureUrl: null,
    status: 'CONNECTED', webhookSubscribed: true, messengerBotActive: true, instagramBusinessBotActive: false,
    defaultCommentReplyMode: 'STATIC', defaultCommentStaticReplyText: 'Мессежээр холбогдоно уу', defaultCommentStaticReplyTexts: ['Мессежээр холбогдоно уу'],
    defaultCommentPrivateReplyEnabled: false, autoHideNegativeComments: false, chatbotActive: true, lastEventAt: daysAgo(1), routing: null,
  },
];

const PLAN = { id: 'plan-pro', tier: 'PRO', name: 'PRO', priceMnt: 69000, maxFacebookPages: 3, allowedModules: ['PAYMENTS', 'ANALYTICS', 'CHATBOT', 'COMMENTS', 'SMS'] };

function subscriptionFor(cell) {
  const state = cell?.mock?.tenantState;
  if (state === 'noSubscription') return null;
  if (state === 'expired') {
    return { id: 'sub-1', status: 'EXPIRED', startedAt: daysAgo(40), endsAt: daysAgo(10), renewedAt: null, cancelledAt: null };
  }
  return { id: 'sub-1', status: 'ACTIVE', startedAt: daysAgo(20), endsAt: daysAhead(200), renewedAt: null, cancelledAt: null };
}

function subscriptionState(cell) {
  const state = cell?.mock?.tenantState;
  if (state === 'noSubscription') return { state: 'none', endsAt: null, daysRemaining: null, chatbotStopped: true };
  if (state === 'expired') return { state: 'expired', endsAt: daysAgo(10), daysRemaining: 0, chatbotStopped: true };
  return { state: 'active', endsAt: daysAhead(200), daysRemaining: 200, chatbotStopped: false };
}

export function tenantDetail(cell) {
  const sub = subscriptionFor(cell);
  return {
    id: TENANT_ID, slug: 'e2e', name: 'Гоо сайхны онлайн дэлгүүр', status: 'ACTIVE',
    trialEndsAt: null, isPaymentValid: cell?.mock?.tenantState !== 'expired', createdAt: daysAgo(120),
    subscription: sub, subscriptionState: subscriptionState(cell), plan: sub ? PLAN : null,
    facebookPages: pages, merchantProfile: null, planTransition: null,
    members: [{
      role: 'OWNER', joinedAt: daysAgo(120),
      identity: { id: 'user-1', name: 'Туршилтын Хэрэглэгч', email: 'test@example.invalid', avatarUrl: null, status: 'ACTIVE', lastLoginAt: hoursAgo(2) },
    }],
  };
}

function me(cell) {
  const sub = subscriptionFor(cell);
  return {
    id: 'user-1', name: 'Туршилтын Хэрэглэгч', email: 'test@example.invalid', avatarUrl: null, status: 'ACTIVE', lastLoginAt: hoursAgo(2),
    ownedTenants: [{
      id: TENANT_ID, slug: 'e2e', name: 'Гоо сайхны онлайн дэлгүүр', status: 'ACTIVE', trialEndsAt: null,
      isPaymentValid: cell?.mock?.tenantState !== 'expired',
      subscription: sub && { status: sub.status, endsAt: sub.endsAt }, facebookPages: pages,
    }],
    tenantMemberships: [],
  };
}

const bell = [
  { id: 'n-1', tenantId: TENANT_ID, identityId: 'user-1', type: 'ORDER_PAYMENT_SUCCEEDED', severity: 'SUCCESS', title: 'Захиалгын төлбөр төлөгдлөө', body: 'Батбаярын Энхтуяа 149,000₮ төлсөн', data: { orderId: 'order-1' }, readAt: null, createdAt: hoursAgo(1), source: 'TENANT' },
  { id: 'n-2', tenantId: TENANT_ID, identityId: 'user-1', type: 'CUSTOMER_MESSAGE', severity: 'INFO', title: 'Шинэ мессеж', body: 'Сайн байна уу, энэ барааны үнэ хэд вэ?', data: { contactId: 'cust-1', platform: 'facebook' }, readAt: null, createdAt: hoursAgo(3), source: 'TENANT' },
];

export const routes = [
  ['GET', /^\/api\/me$/, (ctx) => {
    if (ctx.cell?.mock?.me401) return { __raw: true, status: 401, body: { success: false, error: 'unauthorized' } };
    return me(ctx.cell);
  }],
  ['GET', rx(''), (ctx) => tenantDetail(ctx.cell)],
  ['GET', /^\/api\/notifications$/, () => bell],
  ['POST', /^\/api\/notifications\/read$/, () => null],
  ['GET', rx('/copilot/health'), () => ({ generatedAt: new Date().toISOString(), findings: [] })],
  ['GET', rx('/pages'), () => pages],
];
