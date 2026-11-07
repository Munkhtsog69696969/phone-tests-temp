// Messaging and account pages: inbox, comments, notifications, knowledge base, AI rules,
// plans, QPay reference data, SMS, activity log, copilot. Everything here is invented.
import { TENANT_ID, T, daysAgo, daysAhead, hoursAgo, LONG_NAME, LONG_SENTENCE, LONG_ADDRESS, NAMES, MONEY_BIG, repeat } from './shared.mjs';
import { pages } from './core.mjs';

const escaped = T.replace(/\//g, '\\/');
const rx = (suffix) => new RegExp(`^${escaped}${suffix}$`);
const minutesAgo = (n) => new Date(Date.now() - n * 60000).toISOString();
const hoursAhead = (n) => new Date(Date.now() + n * 3600000).toISOString();

// The inbox only renders attachments with an absolute URL, so point at this harness's own server.
function harnessPort() {
  const argv = process.argv;
  const at = argv.indexOf('--port');
  if (at >= 0 && argv[at + 1]) return argv[at + 1];
  const inline = argv.find((a) => a.startsWith('--port='));
  return inline ? inline.slice('--port='.length) : '4173';
}
const local = (path) => `http://localhost:${harnessPort()}${path}`;
const IMG = { profile: '/khaansoft-fb-profile.png', logo: '/khaansoft-logo-transparent.png', qpay: '/qpay_logo.jpg', messenger: '/messenger_logo.webp' };

const GIVEN = ['Энхтуяа', 'Оюунчимэг', 'Мөнхжаргал', 'Сарангэрэл', 'Ариунаа', 'Номинзаяа', 'Тэмүүлэн', 'Билгүүн', 'Хулан', 'Анударь', 'Золбоо', 'Баярмаа'];
const FAMILY = ['Батбаярын', 'Дамдинсүрэнгийн', 'Ганбаатарын', 'Цэрэндоржийн', 'Болдын', 'Сүхбатын', 'Лхагвасүрэнгийн', 'Жамьянсүрэнгийн'];
const personName = (i) => (i < NAMES.length ? NAMES[i] : `${FAMILY[i % FAMILY.length]} ${GIVEN[i % GIVEN.length]}`);

const SHORT_TEXTS = [
  'Сайн байна уу',
  'Энэ бараа байгаа юу?',
  'Хэд вэ?',
  'Хүргэлт хэд хоног болох вэ?',
  LONG_SENTENCE,
  'Хэмжээ нь тохирохгүй бол солиулж болох уу? Өнгөрсөн удаа авсан бараа маань арай томдсон.',
  'Баярлалаа, маш сайн байна',
  'Захиалга өгмөөр байна, яаж төлөх вэ?',
  `Хаяг: ${LONG_ADDRESS}`,
  'Дансаар шилжүүлж болох уу?',
];
const BOT_TEXTS = [
  'Сайн байна уу! Танд юугаар туслах вэ?',
  `Тийм ээ, “${LONG_NAME}” одоогоор бэлэн байгаа. Үнэ нь 149,000₮ бөгөөд Улаанбаатар хотод 1-2 хоногт хүргэнэ.`,
  'Хүргэлт Улаанбаатар хот дотор 5,000₮, 200,000₮-с дээш захиалгад үнэгүй. Орон нутагт унааны компаниар илгээнэ.',
  'QPay-ээр эсвэл дансаар шилжүүлж төлөх боломжтой.',
];

/* ── Paging helpers ── */

function cursorPage(ctx, rows, defaultLimit = 20) {
  const limit = Number(ctx.url.searchParams.get('limit')) || defaultLimit;
  const start = Number(ctx.url.searchParams.get('cursor')) || 0;
  const items = rows.slice(start, start + limit);
  const end = start + items.length;
  const hasMore = end < rows.length;
  return { items, nextCursor: hasMore ? String(end) : null, hasMore };
}

function offsetPage(ctx, rows, defaultLimit = 20) {
  const limit = Number(ctx.url.searchParams.get('limit')) || defaultLimit;
  const offset = Number(ctx.url.searchParams.get('offset')) || 0;
  return { items: rows.slice(offset, offset + limit), total: rows.length, limit, offset };
}

const hasText = (value, q) => String(value ?? '').toLowerCase().includes(q.toLowerCase());

/* ── Inbox: conversations ── */

const WAITING_HANDOFF = () => ({ state: 'waiting', requestedAt: minutesAgo(25), expiresAt: hoursAhead(3) });
const REASONS = ['handoff', 'no_answer', 'unanswered', 'window_closing'];

function conversation(i) {
  const id = `conv-${i + 1}`;
  const instagram = i % 4 === 3;
  const inboundMinutes = i === 0 ? 6 : i < 8 ? 40 * i : i < 16 ? 22 * 60 + i : 60 * 24 * (i - 13);
  const windowOpen = inboundMinutes < 24 * 60;
  const base = {
    id,
    platform: instagram ? 'instagram' : 'messenger',
    status: i % 11 === 9 ? 'CLOSED' : i % 11 === 10 ? 'ARCHIVED' : 'OPEN',
    lastMessageAt: minutesAgo(inboundMinutes),
    createdAt: daysAgo(40 - (i % 30)),
    contact: {
      id: i === 0 ? 'cust-1' : `cust-${i + 1}`,
      name: i === 5 ? '' : i % 7 === 2 ? `${personName(i)} ${LONG_NAME}` : personName(i),
      platform: instagram ? 'instagram' : 'messenger',
      avatarUrl: i % 6 === 4 ? IMG.profile : null,
    },
    _count: { messages: i === 0 ? 60 : 3 + i * 137 },
    lastMessage: {
      text: i % 5 === 4 ? '' : SHORT_TEXTS[i % SHORT_TEXTS.length],
      direction: i % 3 === 1 ? 'OUTBOUND' : 'INBOUND',
      ai: i % 6 === 1,
      type: i % 5 === 4 ? 'IMAGE' : 'TEXT',
      ...(i % 9 === 7 ? { origin: 'comment' } : i % 9 === 8 ? { origin: 'comment_reply' } : {}),
    },
    windowExpiresAt: new Date(Date.now() - inboundMinutes * 60000 + 86400000).toISOString(),
    handoff: null, takeover: null, botPause: null, needsYouReason: null,
  };
  if (i === 0) return { ...base, handoff: WAITING_HANDOFF(), needsYouReason: 'handoff' };
  if (i === 1) return { ...base, handoff: { state: 'expired', requestedAt: hoursAgo(5), expiresAt: hoursAgo(1) }, needsYouReason: 'handoff' };
  if (i === 2) return { ...base, handoff: { state: 'waiting', requestedAt: minutesAgo(2), expiresAt: hoursAhead(0.5) }, needsYouReason: 'handoff' };
  // Paused by staff, and the short automatic pauses that follow a reply.
  if (i % 8 === 3) return { ...base, botPause: { until: hoursAhead(2), source: 'staff_takeover' }, takeover: { until: hoursAhead(2) }, needsYouReason: 'paused_by_you' };
  if (i % 8 === 4) return { ...base, botPause: { until: daysAhead(30), source: 'staff_bot_off' }, needsYouReason: 'paused_by_you' };
  if (i % 8 === 5) return { ...base, botPause: { until: hoursAhead(0.03), source: i % 16 === 5 ? 'dashboard' : 'meta_echo' } };
  if (i < 16 && i % 2 === 0) return { ...base, needsYouReason: windowOpen ? REASONS[i % REASONS.length] : 'no_answer' };
  return base;
}

const CONVERSATIONS = repeat(32, conversation);

function inView(row, view) {
  const staffPaused = row.botPause && ['staff_takeover', 'staff_bot_off'].includes(row.botPause.source);
  if (view === 'needs_you') return !!row.needsYouReason;
  if (view === 'paused') return !!staffPaused;
  if (view === 'bot') return !row.needsYouReason && !staffPaused;
  return true;
}

function listConversations(ctx) {
  const sp = ctx.url.searchParams;
  const platform = sp.get('platform');
  const search = sp.get('search');
  const scoped = CONVERSATIONS.filter((row) => (!platform || row.platform === platform) && (!search || hasText(row.contact.name, search)));
  const view = sp.get('view') || 'all';
  const viewCounts = {
    needs_you: scoped.filter((row) => inView(row, 'needs_you')).length,
    bot: scoped.filter((row) => inView(row, 'bot')).length,
    paused: scoped.filter((row) => inView(row, 'paused')).length,
    all: scoped.length,
  };
  return { ...cursorPage(ctx, scoped.filter((row) => inView(row, view))), viewCounts };
}

/* ── Inbox: one thread ── */

const msg = (id, direction, minutes, content, extra = {}) => ({
  id, direction, messageType: 'TEXT', content, aiGenerated: false, createdAt: minutesAgo(minutes), ...extra,
});

const productCards = () => ([
  { title: LONG_NAME, subtitle: '149,000₮ · Нөөцөд байгаа · Улаанбаатар хотод 1-2 хоногт хүргэнэ', imageUrl: local(IMG.profile), buttons: [{ title: 'Худалдаж авах' }, { title: 'Дэлгэрэнгүй мэдээлэл авах' }] },
  { title: 'Нүүрний чийгшүүлэгч', subtitle: '89,000₮', imageUrl: local(IMG.logo), buttons: [{ title: 'Худалдаж авах' }] },
  { title: 'Зураггүй бараа, урт нэртэй хувилбар', subtitle: `${MONEY_BIG.toLocaleString('en-US')}₮`, buttons: [{ title: 'Сагсанд нэмэх' }, { title: 'Холбогдох' }] },
]);

/** Newest first, as the server sends it. conv-1 is the thread the composer scene opens. */
function featuredThread() {
  const newest = [
    msg('m-in-latest', 'INBOUND', 6, `${LONG_SENTENCE}\n\nМөн нэг юм асууя: ${LONG_NAME} бараанаас хоёрыг авбал хямдрал байгаа юу? Хариу өгөхөөр над руу 99000001 дугаарт залгаарай.`),
    msg('m-out-noanswer', 'OUTBOUND', 12, 'Уучлаарай, энэ талаар надад мэдээлэл алга байна. Ажилтан удахгүй холбогдоно.', { aiGenerated: true, sources: [], outcome: 'no_answer', feedback: null }),
    msg('m-in-longword', 'INBOUND', 14, 'Энэ холбоос дээрх бараа мөн үү? https://example.invalid/delgvvr/baraa/nvvrnii-chiigshvvlegch-tos-50ml-bagts-2026-namar-ontslog-sanal-negtgel?utm=turshilt&ref=99000001'),
    msg('m-in-button', 'INBOUND', 18, 'Худалдаж авах', { messageType: 'POSTBACK', reactable: false }),
    msg('m-out-file', 'OUTBOUND', 22, null, { messageType: 'FILE', richContent: { cards: [], attachments: [{ type: 'file', url: local(IMG.qpay), title: 'Үнийн-санал-болон-хүргэлтийн-нөхцөл-2026-оны-намрын-улирал-дэлгэрэнгүй.pdf' }] } }),
    msg('m-out-video', 'OUTBOUND', 24, 'Хэрэглэх заавар бичлэг болон аудио тайлбар:', { richContent: { cards: [], attachments: [{ type: 'video', url: local(IMG.qpay), title: 'Хэрэглэх заавар' }, { type: 'audio', url: local(IMG.messenger), title: 'Аудио тайлбар' }] } }),
    msg('m-in-image', 'INBOUND', 30, null, { messageType: 'IMAGE', reaction: 'wow', richContent: { cards: [], attachments: [{ type: 'image', url: local(IMG.profile), title: 'Хэрэглэгчийн илгээсэн зураг' }] } }),
    msg('m-out-staff', 'OUTBOUND', 42, 'Сайн байна уу, би дэлгүүрийн ажилтан байна. Таны захиалгыг шалгаад удахгүй хариу өгье.'),
    msg('m-in-short', 'INBOUND', 55, 'За', { reaction: 'like' }),
    msg('m-out-cards', 'OUTBOUND', 70, 'Танд тохирох бараанууд:', { aiGenerated: true, messageType: 'CARDS', sources: [{ kind: 'product', id: 'prod-1', title: LONG_NAME }], outcome: 'answered', feedback: null, richContent: { cards: productCards(), attachments: [], quickReplies: ['Үнэ асуух', 'Хүргэлтийн нөхцөл', 'Ажилтантай холбогдох', 'Бусад бараа үзэх'] } }),
    msg('m-out-sources', 'OUTBOUND', 75, BOT_TEXTS[2], { aiGenerated: true, outcome: 'answered', feedback: { vote: 'up', fixText: null, appliedDocumentId: null }, sources: [{ kind: 'document', id: 'doc-1', title: 'Хүргэлт, буцаалт болон төлбөрийн нөхцөлийн дэлгэрэнгүй заавар' }, { kind: 'product', id: 'prod-1', title: LONG_NAME }, { kind: 'category', id: 'cat-1', title: 'Нүүр арчилгаа' }] }),
    msg('m-in-love', 'INBOUND', 80, LONG_SENTENCE, { reaction: 'love' }),
    msg('m-out-comment-reply', 'OUTBOUND', 180, 'Сайн байна уу! Мессежээр дэлгэрэнгүй мэдээлэл илгээлээ.', { aiGenerated: true, origin: 'comment_reply', sources: [], feedback: { vote: 'down', fixText: 'Хүргэлтийн үнийг бичих хэрэгтэй.', appliedDocumentId: 'doc-1' } }),
    msg('m-in-comment', 'INBOUND', 182, 'Энэ постон дээрх барааны үнэ хэд вэ?', { origin: 'comment', reactable: false }),
  ];
  const filler = repeat(46, (i) => {
    const minutes = 60 * 26 + i * 170;
    const inbound = i % 2 === 1;
    return inbound
      ? msg(`m-old-${i}`, 'INBOUND', minutes, SHORT_TEXTS[i % SHORT_TEXTS.length])
      : msg(`m-old-${i}`, 'OUTBOUND', minutes, BOT_TEXTS[i % BOT_TEXTS.length], { aiGenerated: i % 8 !== 0, sources: i % 3 ? [{ kind: 'document', id: 'doc-2', title: 'Түгээмэл асуулт, хариулт' }] : [], outcome: 'answered', feedback: null });
  });
  return [...newest, ...filler];
}

function genericThread(id) {
  const row = CONVERSATIONS.find((c) => c.id === id);
  const latest = row ? Math.max(1, Math.round((Date.now() - Date.parse(row.lastMessageAt)) / 60000)) : 30;
  return repeat(12, (i) => (i % 2 === 0
    ? msg(`${id}-m${i}`, 'INBOUND', latest + i * 7, SHORT_TEXTS[i % SHORT_TEXTS.length])
    : msg(`${id}-m${i}`, 'OUTBOUND', latest + i * 7, BOT_TEXTS[i % BOT_TEXTS.length], { aiGenerated: true, sources: [], outcome: 'answered' })));
}

const note = (id, subjectType, subjectId, minutes, body, authorName, mine) => ({ id, subjectType, subjectId, authorName, body, createdAt: minutesAgo(minutes), mine });
const CONV_NOTES = () => ([
  note('note-1', 'conversation', 'conv-1', 200, 'Энэ хэрэглэгч өмнө нь буцаалт хийсэн, анхааралтай харилцаарай.', personName(1), false),
  note('note-2', 'conversation', 'conv-1', 35, `Хаягаа шинэчилсэн: ${LONG_ADDRESS}. Маргааш өглөө 10 цагаас өмнө хүргэж өгөхийг хүссэн, жолоочид мэдэгдэх хэрэгтэй.`, 'Туршилтын Хэрэглэгч', true),
]);

function notesFor(subjectType, subjectId) {
  if (subjectType === 'conversation' && subjectId === 'conv-1') return CONV_NOTES();
  if (subjectType === 'order') return [note('note-o1', 'order', subjectId, 90, 'Хүргэлтийн жолоочтой холбогдсон, маргааш хүргэнэ.', 'Туршилтын Хэрэглэгч', true)];
  return [];
}

function threadMessages(ctx, match) {
  const id = match[1];
  const rows = id === 'conv-1' ? featuredThread() : genericThread(id);
  return { ...cursorPage(ctx, rows, 50), notes: notesFor('conversation', id) };
}

const SAVED_REPLIES = repeat(12, (i) => ({
  id: `saved-${i + 1}`,
  shortcut: ['сайн', 'хүргэлт', 'төлбөр', 'данс', 'буцаалт', 'баярлалаа', 'салбар', 'цагийн-хуваарь', 'хямдрал', 'нөөц', 'хаяг', 'урт-богино-товчлол-хадгалсан-хариулт'][i],
  body: i % 3 === 0 ? `${LONG_SENTENCE} ${LONG_SENTENCE}` : BOT_TEXTS[i % BOT_TEXTS.length],
  updatedAt: daysAgo(i + 1),
}));

/* ── Notifications inbox ── */

const NOTICE_KINDS = [
  { type: 'CUSTOMER_MESSAGE', severity: 'INFO', source: 'TENANT', title: 'Шинэ мессеж', body: LONG_SENTENCE, data: { contactId: 'cust-1', platform: 'messenger' } },
  { type: 'ORDER_PAYMENT_SUCCEEDED', severity: 'SUCCESS', source: 'TENANT', title: 'Захиалгын төлбөр төлөгдлөө', body: `${NAMES[0]} ${MONEY_BIG.toLocaleString('en-US')}₮ төлсөн`, data: { orderId: 'order-1' } },
  { type: 'SOCIAL_COMMENT', severity: 'INFO', source: 'TENANT', title: 'Постод шинэ сэтгэгдэл ирлээ', body: 'Энэ барааны үнэ хэд вэ, хүргэлттэй юу?', data: { platform: 'facebook', socialCommentId: 'cmt-1-0', commentId: 'platform-cmt-1-0' } },
  { type: 'ORDER_PAYMENT_FAILED', severity: 'ERROR', source: 'TENANT', title: 'Захиалгын төлбөр амжилтгүй', body: `${NAMES[1]}-ийн төлбөр QPay дээр амжилтгүй боллоо. Дахин оролдохыг хэрэглэгчид мэдэгдэнэ үү.`, data: { orderId: 'order-1' } },
  { type: 'PAYMENT_SUCCEEDED', severity: 'SUCCESS', source: 'SYSTEM', title: 'Багцын төлбөр амжилттай', body: 'PRO багц 200 хоногоор сунгагдлаа.', data: {} },
  { type: 'PAYMENT_FAILED', severity: 'ERROR', source: 'SYSTEM', title: 'Багцын төлбөр амжилтгүй', body: 'Нэхэмжлэлийн хугацаа дууссан байна. Дахин үүсгэнэ үү.', data: {} },
  { type: 'SYSTEM', severity: 'WARNING', source: 'SYSTEM', title: 'AI эрхийн 75% хэрэглэгдлээ', body: 'Энэ хурдаар үргэлжилбэл сарын эрх 6 хоногийн дараа дуусна. Нэмэлт эрх худалдан авах боломжтой.', data: { kind: 'ai_allowance', threshold: 75 } },
  { type: 'SYSTEM', severity: 'WARNING', source: 'SYSTEM', title: 'Өөр чатбот апп таны хуудсан дээр ажиллаж байна', body: 'Facebook хуудасны үндсэн апп өөр байна. Тохиргоог шалгана уу.', data: { kind: 'page_routing' } },
  { type: 'TRIAL_ACTIVATION_REQUESTED', severity: 'INFO', source: 'SYSTEM', title: 'Туршилт эхлүүлэх хүсэлт хүлээн авлаа', body: null, data: {} },
  { type: 'TRIAL_ACTIVATION_SUCCEEDED', severity: 'SUCCESS', source: 'SYSTEM', title: 'Туршилт идэвхжлээ', body: 'Таны туршилтын хугацаа эхэллээ.', data: {} },
  { type: 'TRIAL_ACTIVATION_FAILED', severity: 'ERROR', source: 'SYSTEM', title: 'Туршилт идэвхжээгүй', body: 'Түр зуурын саатал гарсан. Дахин оролдоно уу.', data: {} },
  { type: 'TENANT_ARCHIVED', severity: 'WARNING', source: 'SYSTEM', title: 'Хуудас архивлагдлаа', body: LONG_SENTENCE, data: {} },
  { type: 'TENANT_RESTORE_SUCCEEDED', severity: 'SUCCESS', source: 'SYSTEM', title: 'Хуудас сэргээгдлээ', body: 'Таны өгөгдөл бүрэн сэргээгдсэн.', data: {} },
  { type: 'TENANT_RESTORE_FAILED', severity: 'ERROR', source: 'SYSTEM', title: 'Хуудас сэргээгдээгүй', body: 'Манай баг шалгаж байна.', data: {} },
  { type: 'SYSTEM', severity: 'INFO', source: 'SYSTEM', title: 'Системийн шинэчлэлт: тайлангийн хуудсанд шинэ боломжууд нэмэгдэж, ачаалах хурд сайжирлаа', body: `${LONG_SENTENCE} ${LONG_SENTENCE}`, data: {} },
];

const NOTIFICATIONS = repeat(48, (i) => {
  const kind = NOTICE_KINDS[i % NOTICE_KINDS.length];
  return {
    id: `inbox-${i + 1}`, tenantId: TENANT_ID, identityId: 'user-1', ...kind, data: { ...kind.data },
    readAt: i % 3 === 0 ? null : hoursAgo(i),
    archivedAt: i >= 40 ? daysAgo(1) : null,
    createdAt: i < 6 ? hoursAgo(i * 2 + 1) : daysAgo(i - 4),
  };
});

function notificationInbox(ctx) {
  const sp = ctx.url.searchParams;
  const archived = sp.get('archived') || 'active';
  const read = sp.get('read');
  const source = sp.get('source');
  const type = sp.get('type');
  const severity = sp.get('severity');
  const q = sp.get('q');
  const rows = NOTIFICATIONS.filter((row) => {
    if (archived === 'active' && row.archivedAt) return false;
    if (archived === 'archived' && !row.archivedAt) return false;
    if (read === 'unread' && row.readAt) return false;
    if (read === 'read' && !row.readAt) return false;
    if (source && row.source !== source) return false;
    if (type && row.type !== type) return false;
    if (severity && row.severity !== severity) return false;
    if (q && !hasText(row.title, q) && !hasText(row.body, q)) return false;
    return true;
  });
  const { items, nextCursor } = cursorPage(ctx, rows, 30);
  return {
    items, nextCursor,
    unreadCount: NOTIFICATIONS.filter((row) => !row.readAt && !row.archivedAt).length,
    archivedCount: NOTIFICATIONS.filter((row) => row.archivedAt).length,
  };
}

/* ── Comments ── */

const pinned = (i) => ({
  productId: `prod-${i}`,
  product: { id: `prod-${i}`, name: i === 1 ? LONG_NAME : `Туршилтын бараа ${i}`, description: LONG_SENTENCE, price: String(149000 * i), currency: 'MNT', sku: `SKU-${1000 + i}`, isActive: true, images: [] },
});

const COMMENT_SHAPES = [
  { sentiment: 'neutral', intent: 'question', hasProductQuestion: true, action: 'replied_and_dmd', publicReplyStatus: 'succeeded', privateReplyStatus: 'succeeded', message: 'Энэ барааны үнэ хэд вэ? Хүргэлттэй юу?' },
  { sentiment: 'positive', intent: 'praise', hasProductQuestion: false, action: 'replied_only', publicReplyStatus: 'succeeded', privateReplyStatus: 'skipped_disabled', message: 'Маш сайхан бараа байна, баярлалаа!' },
  { sentiment: 'negative', intent: 'complaint', hasProductQuestion: false, action: 'hidden', publicReplyStatus: null, privateReplyStatus: null, hideStatus: 'succeeded', message: `Захиалга маань 2 долоо хоног ирэхгүй байна. ${LONG_SENTENCE}` },
  { sentiment: 'neutral', intent: 'question', hasProductQuestion: true, action: 'reply_failed', publicReplyStatus: 'failed', privateReplyStatus: 'failed', message: LONG_SENTENCE },
  { sentiment: 'neutral', intent: 'other', hasProductQuestion: false, action: 'pending', publicReplyStatus: null, privateReplyStatus: null, message: '👍' },
  { sentiment: 'negative', intent: 'complaint', hasProductQuestion: false, action: 'hide_failed', publicReplyStatus: null, privateReplyStatus: null, hideStatus: 'failed', message: 'Энэ чинь луйвар юм биш үү, мөнгөө буцааж өгөөч' },
  { sentiment: 'neutral', intent: 'spam', hasProductQuestion: false, action: 'static_replied', publicReplyStatus: 'succeeded', privateReplyStatus: 'skipped_disabled', message: 'Манай хуудсаар зочилно уу https://example.invalid/urt-holboos-spam-sanal-negtgel-2026' },
  { sentiment: 'neutral', intent: 'question', hasProductQuestion: true, action: 'dmd_only', publicReplyStatus: 'skipped_no_public', privateReplyStatus: 'succeeded', message: 'Дансаар шилжүүлж болох уу? Утас 99000002' },
  { sentiment: 'positive', intent: 'other', hasProductQuestion: false, action: 'automation_disabled', publicReplyStatus: null, privateReplyStatus: null, message: null, attachmentUrl: IMG.profile },
  { sentiment: 'neutral', intent: 'question', hasProductQuestion: false, action: 'token_limit_exceeded', publicReplyStatus: 'attempted', privateReplyStatus: 'unconfirmed', publicReplyFailure: 'permission_denied', message: 'Хэзээ шинэ бараа ирэх вэ?' },
];

function commentFields(postIndex, j, platform, platformPostId) {
  const shape = COMMENT_SHAPES[(postIndex + j) % COMMENT_SHAPES.length];
  const at = postIndex === 0 ? hoursAgo(j + 1) : daysAgo(postIndex + j / 10);
  const replied = shape.publicReplyStatus === 'succeeded';
  return {
    commentPermalink: null,
    commentLocation: platform === 'instagram' ? 'unknown' : j % 4 === 3 ? 'group' : 'page',
    publicReplyFailure: shape.publicReplyFailure ?? null,
    id: `cmt-${postIndex + 1}-${j}`,
    platform,
    platformCommentId: `platform-cmt-${postIndex + 1}-${j}`,
    platformPostId,
    senderName: j % 9 === 8 ? null : j % 5 === 2 ? `${personName(j)} ${LONG_NAME}` : personName(j + postIndex),
    message: shape.message,
    attachmentUrl: shape.attachmentUrl ?? null,
    sentiment: shape.sentiment,
    intent: shape.intent,
    hasProductQuestion: shape.hasProductQuestion,
    verb: 'add',
    action: shape.action,
    publicReplyStatus: shape.publicReplyStatus,
    publicReplyText: replied ? `${BOT_TEXTS[(j + 1) % BOT_TEXTS.length]} ${j % 3 === 0 ? LONG_SENTENCE : ''}`.trim() : null,
    publicReplyAt: replied ? at : null,
    manualReplyText: j === 7 ? 'Ажилтнаас: мессежээр хариу илгээлээ, шалгаарай.' : null,
    manualReplyAt: j === 7 ? at : null,
    reviewedAt: j === 6 ? at : null,
    privateReplyStatus: shape.privateReplyStatus,
    privateReplyText: shape.privateReplyStatus === 'succeeded' ? BOT_TEXTS[1] : null,
    privateReplyAt: shape.privateReplyStatus === 'succeeded' ? at : null,
    likeStatus: j % 3 === 0 ? 'succeeded' : null,
    likeReactionType: j % 3 === 0 ? 'LOVE' : null,
    likedAt: j % 3 === 0 ? at : null,
    hideStatus: shape.hideStatus ?? null,
    hiddenAt: shape.hideStatus === 'succeeded' ? at : null,
    classifiedAt: at,
    respondedAt: replied ? at : null,
    createdAt: at,
  };
}

const POST_CAPTIONS = [
  `🔥 Намрын онцгой хямдрал! ${LONG_NAME} бүтээгдэхүүн зөвхөн энэ долоо хоногт 30% хямдралтай. ${LONG_SENTENCE} Захиалга өгөх бол мессеж бичээрэй. #хямдрал #гоо_сайхан #нүүрний_тос #намар2026`,
  'Шинэ бараа ирлээ',
  null,
  `Манай дэлгүүрийн хаяг: ${LONG_ADDRESS}. Цагийн хуваарь: Даваа-Баасан 09:00-20:00, Бямба-Ням 10:00-18:00.`,
  'Хэрэглэгчдийн сэтгэгдэл: “Арьс маань маш зөөлөн болсон, баярлалаа!”',
];

const POSTS = repeat(28, (i) => {
  const platform = i % 3 === 2 ? 'instagram' : 'facebook';
  const platformPostId = `platform-post-${i + 1}`;
  const needsReply = [12, 0, 3, 1248, 7][i % 5];
  const mediaType = ['IMAGE', 'VIDEO', 'CAROUSEL_ALBUM', null][i % 4];
  const image = i % 2 === 0 ? (i % 4 === 0 ? IMG.profile : IMG.logo) : null;
  const comments = repeat(i === 0 ? 10 : (i % 6) * 2, (j) => commentFields(i, j, platform, platformPostId));
  return {
    id: `post-${i + 1}`,
    platform,
    platformPostId,
    pageId: platform === 'instagram' ? 'ig-1' : i % 6 === 4 ? '100000000000002' : '100000000000001',
    caption: POST_CAPTIONS[i % POST_CAPTIONS.length],
    permalink: null,
    mediaType,
    mediaUrl: mediaType ? image : null,
    thumbnailUrl: mediaType ? image : null,
    likeCount: i === 0 ? 124800 : i * 37,
    commentCount: i === 0 ? 8421 : comments.length * 12,
    shareCount: i === 0 ? 3120 : i,
    reactionCounts: i % 4 === 3 ? null : { LIKE: 120 + i, LOVE: 44 + i, WOW: i, HAHA: 2, SAD: 0, ANGRY: i % 2 },
    engagementFetchedAt: hoursAgo(1),
    firstSeenAt: daysAgo(i + 1),
    lastSeenAt: hoursAgo(i + 1),
    commentReplyMode: [null, 'AI', 'STATIC', 'OFF'][i % 4],
    commentStaticReplyText: i % 4 === 2 ? 'Мессежээр дэлгэрэнгүй мэдээлэл илгээлээ, шалгаарай.' : null,
    commentStaticReplyTexts: i % 4 === 2 ? ['Мессежээр дэлгэрэнгүй мэдээлэл илгээлээ, шалгаарай.', LONG_SENTENCE] : [],
    commentPrivateReplyEnabled: i % 3 === 0 ? true : i % 3 === 1 ? false : null,
    commentRagText: i % 5 === 0 ? `Энэ постын бараа: ${LONG_NAME}. Үнэ 149,000₮.` : null,
    commentAiInstructions: i % 5 === 1 ? 'Үнийг нийтэд бичихгүй, зөвхөн мессежээр хэлнэ.' : null,
    pinnedProducts: i % 4 === 0 ? [pinned(1), pinned(2)] : [],
    comments,
    commentTotals: { autoReplied: i === 0 ? 7420 : i * 3, dmSent: i === 0 ? 5120 : i * 2, needsReply },
  };
});

const postSummary = ({ comments, commentTotals, platform, platformPostId, pageId, firstSeenAt, lastSeenAt, ...rest }) => rest;
const ALL_COMMENTS = POSTS.flatMap((post) => post.comments.map((comment) => ({ ...comment, socialPost: postSummary(post) })));

function platformIdsFor(pageRowId) {
  const page = pages.find((row) => row.id === pageRowId);
  return page ? [page.pageId, page.instagramBusinessId].filter(Boolean) : null;
}

function listPosts(ctx) {
  const sp = ctx.url.searchParams;
  const platform = sp.get('platform');
  const ids = sp.get('pageId') ? platformIdsFor(sp.get('pageId')) : null;
  return cursorPage(ctx, POSTS.filter((post) => (!platform || post.platform === platform) && (!ids || ids.includes(post.pageId))), 5);
}

const isHidden = (c) => c.action === 'hidden' || c.hideStatus === 'succeeded' || !!c.hiddenAt;

function listComments(ctx) {
  const sp = ctx.url.searchParams;
  const platform = sp.get('platform');
  const moderation = sp.get('moderation') || 'all';
  const rows = ALL_COMMENTS.filter((c) => {
    if (platform && c.platform !== platform) return false;
    if (moderation === 'hidden') return isHidden(c);
    if (moderation === 'negative') return c.sentiment === 'negative';
    if (moderation === 'questions') return c.intent === 'question' || c.hasProductQuestion;
    if (moderation === 'needs_review') return !c.reviewedAt && (isHidden(c) || c.sentiment === 'negative' || c.action === 'hide_failed' || c.intent === 'question');
    return true;
  });
  return cursorPage(ctx, rows, 50);
}

const SYNC_RESULT = () => ({
  facebookSynced: 0, instagramSynced: 0, totalSynced: 0, skipped: [], failed: [],
  cursors: [{ pageId: '100000000000001', platform: 'facebook', nextCursor: null }],
});

/* ── Knowledge base ── */

const DOC_CATEGORIES = [
  ['Хүргэлт болон төлбөрийн нөхцөл', 'Хүргэлт, буцаалт, төлбөрийн бүх мэдээлэл'],
  ['Түгээмэл асуулт', null],
  ['Дэлгүүрийн тухай мэдээлэл, салбарын хаяг, цагийн хуваарь', 'Хаяг, утас, цагийн хуваарь'],
  ['Бүтээгдэхүүний заавар', 'Хэрэглэх заавар, найрлага'],
  ['Урамшуулал', null],
  ['Идэвхгүй ангилал', 'Хуучин мэдээлэл'],
].map(([name, description], i) => ({
  id: `doc-cat-${i + 1}`, name, description, sortOrder: i, isActive: i !== 5, createdAt: daysAgo(100 - i), documentCount: 0,
}));

const ARTICLE_PARAGRAPH = 'Манай дэлгүүр Улаанбаатар хот дотор ажлын 1-2 хоногт, орон нутагт унааны компаниар дамжуулан 3-5 хоногт хүргэлт хийдэг. Хот доторх хүргэлтийн үнэ 5,000₮ бөгөөд 200,000₮-с дээш худалдан авалтад үнэгүй. Захиалга баталгаажсаны дараа хэрэглэгчид мессежээр мэдэгдэл очих ба жолооч хүргэхийн өмнө утсаар холбогдоно. Бараа гэмтэлтэй, эсвэл захиалсан бараанаас өөр байвал 48 цагийн дотор буцаах боломжтой; хэрэглэсэн, сав баглаа нь задарсан гоо сайхны бүтээгдэхүүнийг эрүүл ахуйн шаардлагын дагуу буцааж авахгүй.';
const LONG_ARTICLE = repeat(8, (i) => `${i + 1}. ${ARTICLE_PARAGRAPH}`).join('\n\n');

const DOC_TITLES = [
  'Хүргэлт, буцаалт болон төлбөрийн нөхцөлийн дэлгэрэнгүй заавар',
  'Түгээмэл асуулт, хариулт',
  'Цагийн хуваарь',
  'Салбарын хаяг, байршил, утасны дугаар болон ажиллах цагийн мэдээлэл бүх салбараар',
  'QPay-ээр төлөх заавар',
];
const DOC_STATUSES = ['READY', 'COMPLETED', 'READY', 'PENDING', 'READY', 'PROCESSING', 'READY', 'FAILED'];

// 86 matches the catalog usage group A's /analytics reports for this shop.
const DOCUMENTS = repeat(86, (i) => {
  const category = DOC_CATEGORIES[i % DOC_CATEGORIES.length];
  return {
    id: `doc-${i + 1}`,
    title: i < DOC_TITLES.length ? DOC_TITLES[i] : `Мэдлэгийн нийтлэл №${i + 1}: ${i % 3 === 0 ? LONG_NAME : 'богино тайлбар'}`,
    content: i === 0 ? LONG_ARTICLE : `${ARTICLE_PARAGRAPH.slice(0, 120 + i * 12)}`,
    category: category.name,
    categoryId: category.id,
    images: i === 0 ? [{ id: 'doc-img-1', url: IMG.profile, sizeBytes: '482133', sortOrder: 0 }, { id: 'doc-img-2', url: IMG.logo, sizeBytes: 90211, sortOrder: 1 }] : [],
    videos: [],
    links: i === 0 ? [{ id: 'doc-link-1', label: 'Хүргэлтийн бүсийн дэлгэрэнгүй газрын зураг', url: 'https://example.invalid/hvrgelt', sortOrder: 0 }] : [],
    isActive: i % 9 !== 8,
    embeddingStatus: DOC_STATUSES[i % DOC_STATUSES.length],
    usedInRepliesLast30d: i === 0 ? 12480 : (86 - i) * 7,
    createdAt: daysAgo(90 - i),
    updatedAt: i < 3 ? hoursAgo(i + 2) : daysAgo(i),
  };
});
for (const category of DOC_CATEGORIES) category.documentCount = DOCUMENTS.filter((doc) => doc.categoryId === category.id).length;

function listDocuments(ctx) {
  const sp = ctx.url.searchParams;
  const search = sp.get('search');
  const category = sp.get('category');
  const categoryId = sp.get('categoryId');
  const status = sp.get('status');
  const rows = DOCUMENTS.filter((doc) => {
    if (search && !hasText(doc.title, search) && !hasText(doc.content, search)) return false;
    if (category && doc.category !== category) return false;
    if (categoryId && doc.categoryId !== categoryId) return false;
    if (status === 'READY') return doc.embeddingStatus === 'READY' || doc.embeddingStatus === 'COMPLETED';
    if (status === 'PENDING') return doc.embeddingStatus === 'PENDING' || doc.embeddingStatus === 'PROCESSING';
    if (status) return doc.embeddingStatus === status;
    return true;
  });
  const { items, total } = offsetPage(ctx, rows, 20);
  return { items, total };
}

const UNANSWERED_LABELS = ['Хөдөө орон нутагт хүргэлт хийх үү', 'Бөөний үнэ', 'Эрэгтэй хүнд тохирох уу, хэдэн настайгаас хэрэглэж болох вэ, найрлагад нь харшил үүсгэх зүйл байгаа юу', 'Хуваан төлөлт', 'Гадаад руу илгээх', 'Хугацаа нь хэзээ дуусах вэ'];

const TOPICS = repeat(14, (i) => ({
  id: `topic-${i + 1}`,
  label: UNANSWERED_LABELS[i % UNANSWERED_LABELS.length],
  status: 'open',
  count: i === 0 ? 1248 : 40 - i,
  previousCount: i % 3 === 0 ? 40 : 40 - i,
  handoffs: i % 4,
  lastAskedAt: hoursAgo(i * 3 + 1),
  samples: repeat(3, (j) => ({
    text: j === 0 ? LONG_SENTENCE : SHORT_TEXTS[(i + j) % SHORT_TEXTS.length],
    conversationId: `conv-${(i + j) % 30 + 1}`,
    platform: j === 2 ? 'instagram' : 'messenger',
    askedAt: hoursAgo(i + j + 1),
  })),
  answeredDocumentId: null,
}));

/* ── AI rules ── */

const RULE_CONTENTS = [
  'Үнийг нийтийн сэтгэгдэл дээр бичихгүй, зөвхөн мессежээр хэлнэ.',
  `Хэрэглэгч буцаалт асуувал дараах журмыг тайлбарла: ${ARTICLE_PARAGRAPH.slice(0, 380)}`,
  'Эмчилгээний үр дүн амлахгүй. Жирэмсэн хүмүүст зөвлөгөө өгөхгүй, эмчтэй зөвлөлдөхийг сануул.',
  'Өрсөлдөгч дэлгүүрийн тухай асуувал дурдахгүй, манай барааны давуу талыг хэл.',
  'Эелдэг, товч хариул. Эмоджи хамгийн ихдээ нэгийг хэрэглэ.',
];
const AI_RULES = repeat(16, (i) => ({
  id: `rule-${i + 1}`,
  title: i === 1 ? 'Буцаалт, солилт болон төлбөр буцаан олгох нөхцөлийн талаар хэрэглэгчид тайлбарлах журам' : `Дүрэм ${i + 1}: ${['Үнэ', 'Буцаалт', 'Эрүүл мэнд', 'Өрсөлдөгч', 'Хэлбэр'][i % 5]}`,
  content: RULE_CONTENTS[i % RULE_CONTENTS.length],
  isActive: i % 4 !== 3,
  sortOrder: i,
  createdAt: daysAgo(40 - i),
  updatedAt: daysAgo(i),
}));
const aiRuleActive = AI_RULES.filter((rule) => rule.isActive);
const AI_RULES_USAGE = {
  total: AI_RULES.length, maxTotal: 30,
  activeCount: aiRuleActive.length, maxActive: 20,
  activeChars: aiRuleActive.reduce((sum, rule) => sum + rule.content.length, 0), maxActiveChars: 4000,
};

/* ── Plans and usage ── */

function plan(id, tier, name, price, pages_, modules, limits, credits, sale) {
  const term = (months, discount) => {
    const regular = price * months;
    const total = Math.round(regular * (1 - discount));
    const live = sale && months === 1;
    return {
      months,
      priceMnt: live ? sale : total,
      pricePerMonthMnt: Math.round((live ? sale : total) / months),
      aiCreditsPerMonth: credits,
      aiCreditsAreTermOverride: false,
      savingsMnt: regular - total,
      savingsPct: Math.round(discount * 100),
      ...(live ? { regularPriceMnt: price, saleEndsAt: daysAhead(4) } : {}),
    };
  };
  return {
    id, tier, name, priceMnt: price,
    terms: tier === 'FREE' ? [] : [term(1, 0), term(3, 0.05), term(6, 0.1), term(12, 0.2)],
    monthlyMessageLimit: limits.messages, monthlyTokenLimit: String(limits.messages * 500),
    maxFacebookPages: pages_, storageLimitBytes: String(limits.storageGb * 1073741824),
    allowedModules: modules,
    catalogLimits: limits.catalog,
  };
}
// PRO's limits and the allowance below are the figures group A's /analytics reports, so pages agree.
const catalogLimits = (documents, products) => ({ documents, documentCategories: 20, categories: 50, products, branches: 10 });
const PLANS = [
  plan('plan-free', 'FREE', 'FREE', 0, 1, ['CHATBOT'], { messages: 100, storageGb: 1, catalog: catalogLimits(5, 5) }, 1000),
  plan('plan-basic', 'BASIC', 'BASIC', 29000, 1, ['CHATBOT'], { messages: 2000, storageGb: 2, catalog: catalogLimits(20, 10) }, 150000),
  plan('plan-starter', 'STARTER', 'STARTER', 49000, 2, ['CHATBOT', 'PAYMENTS', 'AUTOMATION'], { messages: 10000, storageGb: 5, catalog: catalogLimits(50, 25) }, 500000, 39200),
  plan('plan-pro', 'PRO', 'PRO', 69000, 3, ['CHATBOT', 'PAYMENTS', 'AUTOMATION', 'ANALYTICS'], { messages: 100000, storageGb: 1024, catalog: catalogLimits(100, 40) }, 1500000),
  plan('plan-business', 'BUSINESS', 'BUSINESS', 249000, 10, ['CHATBOT', 'PAYMENTS', 'AUTOMATION', 'ANALYTICS', 'WEBSITE', 'SMS'], { messages: 250000, storageGb: 2048, catalog: catalogLimits(5000, 50000) }, 5000000),
];

const allowance = () => ({
  period: daysAhead(20).slice(0, 10), periodEndsAt: daysAhead(20), unlimited: false,
  planCredits: 1500000, planRemainingCredits: 758000, topUpCredits: 250000, topUpPurchasedCredits: 500000,
  effectiveCredits: 1750000, usedCredits: 742000, remainingCredits: 1008000,
});

const TOKEN_TOPUPS = () => ({
  packages: [
    { id: 'topup-1', name: 'Жижиг багц', description: 'Богино хугацаанд нэмэлт AI эрх авах хамгийн хямд сонголт', credits: 25000, priceMnt: 19000 },
    { id: 'topup-2', name: 'Дунд багц', description: null, credits: 100000, priceMnt: 59000, regularPriceMnt: 69000, saleEndsAt: daysAhead(4) },
    { id: 'topup-3', name: 'Том багц', description: 'Олон хуудастай, өдөрт мянга мянган мессеж хүлээн авдаг дэлгүүрт зориулсан том хэмжээний багц', credits: 500000, priceMnt: 249000 },
    { id: 'topup-4', name: 'Маш том багц', description: null, credits: 5000000, priceMnt: MONEY_BIG },
  ],
  usage: allowance(),
});

function usageDaily() {
  // The app keys days by Ulaanbaatar date (UTC+8).
  const key = (ms) => new Date(ms + 8 * 3600000).toISOString().slice(0, 10);
  // Ten days into the 30-day period that ends in 20 days; the days add up to about 742,000 used.
  const start = Date.now() - 10 * 86400000;
  const days = repeat(30, (i) => {
    const past = i <= 10;
    return { date: key(start + i * 86400000), chatbot: past ? 50000 + ((i * 3170) % 24000) : 0, copilot: past ? (i * 530) % 4000 : 0 };
  });
  return { periodStart: days[0].date, periodEnd: days[days.length - 1].date, days };
}

const INVOICE_KINDS = [
  { purpose: 'PLAN_RENEWAL', planTier: 'PRO', amount: '69000', status: 'PAID', description: 'PRO багц, 1 сар' },
  { purpose: 'TOKEN_TOP_UP', planTier: null, amount: '59000', status: 'PAID', tokenTopUpCredits: 100000, description: 'Нэмэлт AI эрх' },
  { purpose: 'PLAN_UPGRADE', planTier: 'BUSINESS', amount: String(MONEY_BIG), status: 'PENDING', description: 'BUSINESS багц руу шилжих, 12 сар, онцгой нөхцөлтэй урт тайлбар' },
  { purpose: 'PLAN_UPGRADE', planTier: 'STARTER', amount: 49000, status: 'FAILED', description: 'STARTER багц' },
  { purpose: 'PLAN_REACTIVATION', planTier: 'PRO', amount: '207000', status: 'PROCESSING', description: 'PRO багц сэргээх, 3 сар' },
  { purpose: 'SMS_TOP_UP', planTier: null, amount: '25000', status: 'CANCELLED', description: 'SMS багц' },
  { purpose: 'PLAN_RENEWAL', planTier: 'PRO', amount: '69000', status: 'EXPIRED', description: null },
  { purpose: 'TOKEN_TOP_UP', planTier: null, amount: '19000', status: 'CREATING', tokenTopUpCredits: 25000, description: null },
];
const INVOICES = repeat(28, (i) => {
  const kind = INVOICE_KINDS[i % INVOICE_KINDS.length];
  return {
    id: `invoice-${i + 1}`,
    senderInvoiceNo: `INV-20261107-${String(100000 + i)}-E2ETENANT`,
    currency: 'MNT',
    tokenTopUpCredits: null,
    tokenTopUpPeriod: null,
    ...kind,
    qrCode: '', qrImageUrl: null, urls: [],
    paidAt: kind.status === 'PAID' ? daysAgo(i * 3) : null,
    createdAt: daysAgo(i * 3),
  };
});

/* ── QPay reference data ── */

const QPAY_CITIES = [['11', 'Улаанбаатар'], ['21', 'Архангай'], ['22', 'Баян-Өлгий'], ['23', 'Баянхонгор'], ['24', 'Булган'], ['25', 'Говь-Алтай'], ['26', 'Дорноговь'], ['27', 'Дорнод'], ['28', 'Дундговь'], ['29', 'Завхан'], ['30', 'Өвөрхангай'], ['31', 'Өмнөговь'], ['32', 'Сүхбаатар'], ['33', 'Сэлэнгэ'], ['34', 'Төв'], ['35', 'Увс']].map(([code, name]) => ({ code, name }));
const QPAY_DISTRICTS = ['Баянзүрх', 'Баянгол', 'Сонгинохайрхан', 'Сүхбаатар', 'Чингэлтэй', 'Хан-Уул', 'Налайх', 'Багануур', 'Багахангай'];
const QPAY_MCC = [
  ['5311', 'Их дэлгүүр'], ['5411', 'Хүнсний дэлгүүр, супермаркет'], ['5499', 'Төрөл бүрийн хүнсний дэлгүүр'], ['5691', 'Эрэгтэй, эмэгтэй хувцасны дэлгүүр'],
  ['5641', 'Хүүхдийн хувцасны дэлгүүр'], ['5977', 'Гоо сайхны бүтээгдэхүүний дэлгүүр'], ['5941', 'Спортын бараа'], ['5732', 'Цахилгаан бараа, электрон хэрэгсэл'],
  ['5812', 'Ресторан, хоолны газар'], ['5814', 'Түргэн хоол'], ['7230', 'Гоо сайхны салон'], ['8299', 'Сургалт, боловсролын үйлчилгээ'],
  ['7399', 'Бизнесийн бусад үйлчилгээ, ангилагдаагүй төрөл бүрийн мэргэжлийн зөвлөх үйлчилгээ'], ['5399', 'Бусад ерөнхий бараа'], ['5999', 'Төрөл бүрийн тусгай бараа'],
].map(([code, name_mn]) => ({ code, name_mn }));
// Codes follow QPay's list so the app's logo table resolves; the names are placeholders.
const QPAY_BANKS = ['010000', '020000', '040000', '050000', '150000', '190000', '210000', '220000', '290000', '300000', '320000', '330000', '340000', '360000', '380000', '390000', '500000', '100000']
  .map((code, i) => ({ code, name_mn: `Туршилтын банк ${i + 1}`, name_en: `Test bank ${i + 1}` }));

/* ── SMS ── */

const SMS_STATUSES = ['SENT', 'SENT', 'FAILED', 'SKIPPED_NO_CREDIT', 'PENDING'];
const smsOverview = () => ({
  enabled: true,
  maxRecipients: 5,
  recipients: [
    { phone: '99000001', verified: true, verifiedAt: daysAgo(30), codeSentAt: null },
    { phone: '99000002', verified: true, verifiedAt: daysAgo(12), codeSentAt: null },
    { phone: '99000003', verified: false, verifiedAt: null, codeSentAt: hoursAgo(1) },
  ],
  events: { order_paid: true },
  balance: 12840,
  packages: [
    { id: 'sms-1', name: '100 SMS', description: 'Жижиг дэлгүүрт зориулсан эхлэлийн багц', smsCount: 100, priceMnt: 9000 },
    { id: 'sms-2', name: '500 SMS', description: null, smsCount: 500, priceMnt: 39000, regularPriceMnt: 45000, saleEndsAt: daysAhead(4) },
    { id: 'sms-3', name: '2,000 SMS', description: 'Өдөрт олон захиалга авдаг дэлгүүрт зориулсан том хэмжээний хэмнэлттэй багц', smsCount: 2000, priceMnt: 139000 },
    { id: 'sms-4', name: '100,000 SMS', description: null, smsCount: 100000, priceMnt: MONEY_BIG },
  ],
  recent: repeat(28, (i) => {
    const status = SMS_STATUSES[i % SMS_STATUSES.length];
    return {
      id: `sms-msg-${i + 1}`, event: i % 7 === 6 ? 'test' : 'order_paid', phone: `9900000${(i % 3) + 1}`, status,
      charged: status === 'SENT' ? 1 : 0, createdAt: hoursAgo(i * 5 + 1), sentAt: status === 'SENT' ? hoursAgo(i * 5 + 1) : null,
    };
  }),
});

/* ── Settings: activity log ── */

const ACTIVITY_KINDS = [
  { action: 'order.status', resource: 'order', label: '#E2E-1001', before: 'PENDING', after: 'SHIPPED' },
  { action: 'order.mark_paid', resource: 'order', label: '#E2E-1002', before: null, after: 'PAID' },
  { action: 'product.update', resource: 'product', label: LONG_NAME, before: '149000', after: '129000' },
  { action: 'document.create', resource: 'document', label: DOC_TITLES[0], before: null, after: null },
  { action: 'ai_rule.update', resource: 'ai_rule', label: 'Үнэ', before: 'off', after: 'on' },
  { action: 'page.chatbot_toggle', resource: 'page', label: pages[0].pageName, before: 'true', after: 'false' },
  { action: 'conversation.bot_pause', resource: 'conversation', label: NAMES[0], before: 'on', after: 'takeover' },
  { action: 'saved_reply.create', resource: 'saved_reply', label: '/хүргэлт', before: null, after: null },
  { action: 'social_posts.synced', resource: 'social_post', label: null, before: null, after: null },
  { action: 'unanswered.answer', resource: 'unanswered', label: UNANSWERED_LABELS[2], before: null, after: null },
];
const ACTIVITY = repeat(34, (i) => {
  const system = i % 8 === 7;
  return {
    id: `act-${i + 1}`,
    at: i < 5 ? hoursAgo(i + 1) : daysAgo(i - 3),
    actor: system
      ? { identityId: null, name: null, role: null, kind: 'system' }
      : { identityId: 'user-1', name: i % 3 === 0 ? 'Туршилтын Хэрэглэгч' : personName(i), role: i % 2 ? 'ADMIN' : 'OWNER', kind: 'staff' },
    resourceId: `res-${i + 1}`,
    ...ACTIVITY_KINDS[i % ACTIVITY_KINDS.length],
  };
});

/* ── Copilot ── */

const COPILOT_TITLES = ['Өнөөдрийн борлуулалт', 'Хамгийн их зарагдсан бараа сүүлийн 30 хоногт, ангилал бүрээр нь харьцуулаад тайлбар бичиж өгөөч', 'Нөөц дуусаж буй бараа', 'Хариулаагүй асуултууд', 'Төлбөр хүлээж буй захиалга'];
const COPILOT_THREADS = repeat(26, (i) => ({
  id: `thread-${i + 1}`,
  title: `${COPILOT_TITLES[i % COPILOT_TITLES.length]}${i >= COPILOT_TITLES.length ? ` ${i + 1}` : ''}`,
  updatedAt: i < 4 ? hoursAgo(i + 1) : daysAgo(i - 2),
}));

const copilotThread = (id) => {
  const summary = COPILOT_THREADS.find((row) => row.id === id) ?? COPILOT_THREADS[0];
  return {
    id, title: summary.title,
    messages: [
      { id: `${id}-q`, role: 'user', content: summary.title, citations: [], createdAt: hoursAgo(2) },
      {
        id: `${id}-a`, role: 'assistant',
        content: `Сүүлийн 30 хоногт ${MONEY_BIG.toLocaleString('en-US')}₮ борлуулалт хийсэн байна.\n\n- ${LONG_NAME}: 148 ширхэг\n- Нүүрний чийгшүүлэгч: 92 ширхэг\n\nДэлгэрэнгүйг захиалгын жагсаалтаас харна уу.`,
        citations: [{ toolName: 'orders_summary', window: 'Сүүлийн 30 хоног', rowCount: 248, source: 'Захиалгын жагсаалт', deepLink: '/orders?status=PAID' }],
        createdAt: hoursAgo(2),
      },
    ],
  };
};

/* ── Routes ── */

export const routes = [
  // Inbox
  ['GET', rx('/conversations'), listConversations],
  ['GET', rx('/conversations/([^/]+)/messages'), threadMessages],
  ['GET', rx('/saved-replies'), () => SAVED_REPLIES],
  ['GET', rx('/notes'), (ctx) => notesFor(ctx.url.searchParams.get('subjectType'), ctx.url.searchParams.get('subjectId'))],

  // Notifications
  ['GET', /^\/api\/notifications\/inbox$/, notificationInbox],

  // Comments. The page syncs posts from Meta as it loads.
  ['GET', rx('/social-posts'), listPosts],
  ['POST', rx('/social-posts/sync'), SYNC_RESULT],
  ['GET', rx('/social-comments'), listComments],

  // Knowledge base
  ['GET', rx('/documents'), listDocuments],
  ['GET', rx('/documents/([^/]+)'), (ctx, match) => DOCUMENTS.find((doc) => doc.id === match[1]) ?? { __raw: true, status: 404, body: { success: false, error: 'not_found' } }],
  ['GET', rx('/documents/([^/]+)/links'), (ctx, match) => DOCUMENTS.find((doc) => doc.id === match[1])?.links ?? []],
  ['GET', rx('/document-categories'), () => ({ items: DOC_CATEGORIES, total: DOC_CATEGORIES.length })],
  ['GET', rx('/unanswered'), (ctx) => {
    const status = ctx.url.searchParams.get('status') || 'open';
    const topics = TOPICS.filter((topic) => topic.status === status);
    return { topics, totals: { open: TOPICS.length, questions: TOPICS.reduce((sum, topic) => sum + topic.count, 0) }, since: daysAgo(60) };
  }],

  // AI rules
  ['GET', rx('/ai-rules'), () => ({ items: AI_RULES, usage: AI_RULES_USAGE })],

  // Plans, usage, billing history
  ['GET', rx('/plans'), () => PLANS],
  ['GET', rx('/token-topups'), TOKEN_TOPUPS],
  ['GET', rx('/usage/daily'), usageDaily],
  ['GET', rx('/usage-alerts'), () => ({ thresholds: [50, 75] })],
  // The one endpoint with its fields at the top level of the envelope.
  ['GET', rx('/invoices'), (ctx) => ({ __raw: true, status: 200, body: { success: true, ...offsetPage(ctx, INVOICES, 10) } })],
  ['GET', rx('/invoices/([^/]+)/status'), (ctx, match) => {
    const row = INVOICES.find((invoice) => invoice.id === match[1]) ?? INVOICES[0];
    return { id: match[1], status: row.status, paidAt: row.paidAt, qpayInvoiceStatus: row.status, purpose: row.purpose };
  }],

  // QPay reference data
  ['GET', /^\/api\/qpay\/cities$/, () => QPAY_CITIES],
  ['GET', /^\/api\/qpay\/districts\/([^/]+)$/, (ctx, match) => QPAY_DISTRICTS.map((name, i) => ({ code: `${match[1]}${String(i + 1).padStart(2, '0')}`, name }))],
  ['GET', /^\/api\/qpay\/mcc-codes$/, () => QPAY_MCC],
  ['GET', /^\/api\/qpay\/banks$/, () => QPAY_BANKS],
  ['GET', rx('/qpay-merchant/linkable'), () => ({ merchants: [] })],

  // SMS
  ['GET', rx('/sms'), smsOverview],

  // Settings
  ['GET', rx('/activity'), (ctx) => {
    const { items, nextCursor } = cursorPage(ctx, ACTIVITY, 50);
    return { items, nextCursor };
  }],

  // Copilot
  ['GET', rx('/copilot/threads'), () => COPILOT_THREADS],
  ['GET', rx('/copilot/threads/([^/]+)'), (ctx, match) => copilotThread(match[1])],
];
