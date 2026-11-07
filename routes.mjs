// Every test cell: pages, scenes and gate states. Each says what must be true for
// the result to count, so a page that silently failed can't pass as "clean".
export const T = '/api/tenants/e2e-tenant';

const LOGIN = 'sel:.s-hero';
const ERROR = 'Алдаа гарлаа';
const TRIAL_GATE = 'Туршилт эхлүүлэх';
const PAGE_FORBID = [LOGIN, ERROR, TRIAL_GATE];

const route = (id, path, expectPath, requires = []) => ({
  id, path, expectPath, requires: requires.map((r) => r.replace('T/', '/api/tenants/e2e-tenant/')), forbid: PAGE_FORBID, kind: 'route',
});

export const ROUTES = [
  route('home', '/', '/', ['T/summary']),
  route('notifications', '/notifications', '/notifications', ['/api/notifications/inbox']),
  route('conversations', '/conversations', '/conversations', ['T/conversations']),
  route('comments', '/comments', '/comments', ['T/social-posts']),
  route('customers', '/customers', '/customers', ['T/customers']),
  route('customer-record', '/customers/cust-1', '/customers/cust-1', ['T/customers/cust-1']),
  route('products', '/products', '/products', ['T/products']),
  route('orders', '/orders', '/orders', ['T/orders']),
  route('order-detail', '/orders/order-1', '/orders/order-1', ['T/orders/order-1']),
  route('knowledge-base', '/knowledge-base', '/knowledge-base', ['T/documents']),
  route('ai-test', '/ai-test', '/ai-test', ['T/pages']),
  route('ai-rules', '/ai-rules', '/ai-rules', ['T/ai-rules']),
  route('analytics', '/analytics', '/analytics', ['T/analytics']),
  route('integrations', '/integrations', '/integrations'),
  route('plans', '/plans', '/plans', ['T/plans']),
  route('payments', '/payments', '/payments', ['/api/qpay/']),
  route('delivery-options', '/delivery-options', '/delivery-options', ['T/checkout-settings']),
  route('settings', '/settings', '/settings'),
  route('sms-notifications', '/sms-notifications', '/sms-notifications', ['T/sms']),
  route('copilot-redirect', '/copilot', '/', ['T/copilot/threads']),
  route('not-found', '/no-such-page', '/no-such-page'),
  route('settings-activity', '/settings?tab=activity', '/settings', ['T/activity']),
  route('plans-billing', '/plans?tab=billing', '/plans', ['T/invoices']),
  route('kb-unanswered', '/knowledge-base?tab=unanswered', '/knowledge-base', ['T/unanswered']),
  { id: 'login', path: '/login', expectPath: '/login', forbid: [ERROR], mock: { me401: true }, kind: 'route' },
];

const scene = (id, path, expectPath, steps) => ({ id, path, expectPath, forbid: PAGE_FORBID, scene: steps, stages: ['scene'], kind: 'scene' });

export const SCENES = [
  scene('scene-chat-composer', '/conversations?conversationId=conv-1', '/conversations', [{ wait: 800 }, { realTap: 'textarea' }]),
  scene('scene-more-panel', '/', '/', [{ click: '[data-tour="bottom-nav"] button' }]),
  scene('scene-manual-order', '/orders?create=1', '/orders', [{ wait: 800 }, { realTap: '[role="dialog"] input, form input' }]),
  scene('scene-copilot', '/copilot', '/', [{ wait: 800 }, { realTap: 'textarea' }]),
  scene('scene-product-editor', '/products?create=1', '/products', [{ wait: 800 }, { realTap: 'main input[type="text"], [role="dialog"] input[type="text"], main input:not([type])' }]),
  {
    ...scene('scene-qpay-terms', '/payments', '/payments', [{ wait: 500 }, { click: 'text:Бүртгэл эхлүүлэх' }]),
  },
  {
    ...scene('scene-qpay-wizard', '/payments', '/payments', [{ wait: 500 }, { click: 'text:Бүртгэл эхлүүлэх' }, { wait: 500 }, { realTap: 'main input[type="text"], main input:not([type]), [role="dialog"] input[type="text"], [role="dialog"] input:not([type])' }]),
    seed: { 'khaansoft-qpay-terms:e2e-tenant': JSON.stringify({ version: '2026-09-18', acceptedAt: '2026-10-01T00:00:00.000Z' }) },
  },
];

export const GATES = [
  { id: 'gate-logged-out', path: '/orders', expectPath: '/login', forbid: [ERROR], mock: { me401: true }, kind: 'gate' },
  { id: 'gate-no-subscription', path: '/products', expectPath: '/products', forbid: [LOGIN, ERROR], mock: { tenantState: 'noSubscription' }, kind: 'gate' },
  { id: 'gate-expired', path: '/', expectPath: '/', forbid: [LOGIN, ERROR], mock: { tenantState: 'expired' }, kind: 'gate' },
];

export const SEED = {
  khaansoft_dashboard_language: 'mn',
  'khaansoft-selected-tenant-id': 'e2e-tenant',
  'khaansoft-onboarding-e2e-tenant': 'done',
  'khaansoft-install-promo-hidden': '1',
  'khaansoft-setup-checklist-hidden-tenants': '["e2e-tenant"]',
};

const st = (id, expect) => ({ id: `selftest-${id}`, path: `/__e2e/selftest/${id}.html`, selftest: true, kind: 'selftest', expect, stages: ['top', 'end'] });

// Each defect must be caught; the "clean" page's lookalikes must not be.
export const SELFTEST = [
  st('clipped-overflow', { flag: ['offEdge'] }),
  st('small-controls', { flag: ['smallInput', 'tapFail'] }),
  st('under-nav', { flag: ['behindNav'] }),
  st('hover-only', { flag: ['hoverHidden'], onlyTouch: true }),
  st('thrown-error', { flag: ['errors'] }),
  st('double-scroll', { flag: ['doubleScroll'] }),
  st('wide-page', { flag: ['docOverflow'] }),
  st('clean', { noFlag: ['offEdge', 'clipped', 'docOverflow', 'tapFail', 'smallInput', 'behindNav', 'obscured', 'hoverHidden', 'errors', 'doubleScroll'] }),
  // The real app must also fail when something is really wrong.
  { id: 'negative-401', path: '/orders', expectPath: '/orders', forbid: PAGE_FORBID, mock: { me401: true }, kind: 'negative', expect: { invalid: true } },
  { id: 'negative-endpoint', path: '/orders', expectPath: '/orders', forbid: PAGE_FORBID, mock: { drop: '/orders$' }, kind: 'negative', expect: { invalid: true } },
  { id: 'negative-wide', path: '/settings', expectPath: '/settings', forbid: PAGE_FORBID, css: '#main-content{width:150vw!important;max-width:none!important}', kind: 'negative', expect: { flag: ['docOverflow'] } },
];
