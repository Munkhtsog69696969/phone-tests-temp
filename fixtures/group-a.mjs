// Commerce pages: home, products, orders, customers, analytics, delivery options.
// Shapes follow src/lib/auth.ts and the pages reading them. Everything here is invented.
import { T, daysAgo, daysAhead, hoursAgo, repeat, LONG_NAME, LONG_SENTENCE, LONG_ADDRESS, NAMES, MONEY_BIG } from './shared.mjs';

const escaped = T.replace(/\//g, '\\/');
const rx = (suffix) => new RegExp(`^${escaped}${suffix}$`);

const DAY = 86400000;
// Dates the server keys by are Ulaanbaatar calendar days (UTC+8).
const ubDateKey = (ms = Date.now()) => new Date(ms + 8 * 3600000).toISOString().slice(0, 10);
const addDays = (key, n) => new Date(Date.parse(`${key}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const dayRange = (from, to) => {
  const out = [];
  for (let key = from; key <= to && out.length < 400; key = addDays(key, 1)) out.push(key);
  return out;
};
const pick = (list, i) => list[i % list.length];
// A wavy but repeatable number, so two runs look the same.
const wave = (i, base, swing) => Math.round(base + swing * (1 + Math.sin(i * 0.9) * Math.cos(i * 0.37)));

function offsetPage(rows, q, defaultLimit) {
  const search = (q.get('search') || '').trim().toLowerCase();
  const found = search ? rows.filter((r) => JSON.stringify(r).toLowerCase().includes(search)) : rows;
  const offset = Number(q.get('offset') || 0);
  const limit = Number(q.get('limit') || defaultLimit);
  return { items: found.slice(offset, offset + limit), total: found.length };
}

/* ── Categories ── */

const CATEGORY_NAMES = [
  'Нүүр арчилгаа', 'Биеийн тос, чийгшүүлэгч', 'Үс арчилгааны бүтээгдэхүүн', 'Нүүр будалт', 'Сүрчиг, үнэртэн',
  'Эрэгтэй хүний арчилгааны цуврал бүтээгдэхүүн', 'Хүүхдийн зөөлөн арчилгаа', 'Байгалийн гаралтай ургамлын хандтай бүтээгдэхүүн', 'Бэлгийн багц', 'Хумс арчилгаа',
  'Нарнаас хамгаалах тос', 'Амны хөндий',
];
const categories = CATEGORY_NAMES.map((name, i) => ({
  id: `cat-${i + 1}`, name, slug: `category-${i + 1}`,
  description: i % 3 === 0 ? 'Өдөр тутмын арчилгаанд зориулсан бүтээгдэхүүний ангилал, үнэ болон хүргэлтийн нөхцөлийн хамт.' : null,
  imageUrl: i === 0 ? '/khaansoft-fb-profile.png' : null,
  images: i === 0 ? [{ id: 'cat-img-1', url: '/khaansoft-fb-profile.png', sizeBytes: 48211, sortOrder: 0 }] : [],
  sortOrder: i, isActive: i !== 11, embeddingStatus: i === 9 ? 'PENDING' : 'READY',
  _count: { productCategories: wave(i, 4, 6) },
}));

/* ── Products ── */

const PRODUCT_NAMES = [
  LONG_NAME,
  'Чийгшүүлэгч нүүрний тос', 'Витамин С агуулсан гэрэлтүүлэгч серум, 30 мл', 'Үс бэхжүүлэгч шампунь', 'Гүн цэвэрлэгч нүүрний маск, нүүрс агуулсан, 10 ширхэгтэй багц',
  'Гарын тос', 'Ягаан өнгийн уруулын будаг', 'Нарнаас хамгаалах өдрийн тос SPF50+, бүх төрлийн арьсанд тохиромжтой, усанд тэсвэртэй 75 мл',
  'Эрэгтэй сахлын дараах лосьон', 'Хүүхдийн зөөлөн биеийн тос, үнэргүй', 'Сүрчиг 50 мл', 'Хумсны будаг, 12 өнгийн багц',
  'Шүдний зөөлөн сойз', 'Хөгшрөлтөөс хамгаалах шөнийн тос, ретинол болон пептид агуулсан, 50 мл шилэн саванд',
  'Нүдний доорх гель', 'Нүүрний тоник', 'Бие угаагч гель, лаванда', 'Хуурай шампунь', 'Үсний тос', 'Хөмсөгний харандаа',
  'Шинэ жилийн бэлгийн багц: нүүрний тос, серум, уруулын будаг, гоёмсог хайрцагтай', 'Хөлийн тос', 'Гар ариутгагч', 'Бие чийгшүүлэгч лосьон', 'Нүүрний угаалгын хөөс',
  'Тональ тос', 'Сормуусны будаг, ус нэвтрэхгүй', 'Үнэртэй лаа', 'Хумсны тос', 'Амны хөндий зайлагч', 'Хүүхдийн шампунь', 'Эрэгтэй сүрчиг 100 мл', 'Уруулын ангижруулагч', 'Хөвөн арчуур',
];

function makeProduct(name, i) {
  const price = i === 0 ? MONEY_BIG : Math.round(wave(i, 18000, 60000) / 100) * 100;
  const onSale = i % 4 === 1 || i === 0;
  const tracked = i % 3 !== 2;
  const stock = !tracked ? 0 : i % 6 === 0 && i > 0 ? 0 : i % 6 === 3 ? 2 : wave(i, 10, 300);
  const held = tracked && i % 6 === 3 ? 2 : tracked && i % 5 === 1 ? 1 : 0;
  const cats = [pick(categories, i), pick(categories, i + 5)].slice(0, i % 2 ? 1 : 2);
  return {
    id: `prod-${i + 1}`, name,
    description: i % 5 === 0 ? `${LONG_SENTENCE} ${LONG_SENTENCE}` : i % 5 === 2 ? null : 'Өдөр бүр хэрэглэхэд тохиромжтой, арьсанд зөөлөн.',
    price: String(price), currency: 'MNT',
    images: i % 4 === 3 ? [] : [
      { id: `img-${i + 1}-1`, url: i % 2 ? '/khaansoft-fb-profile.png' : '/khaansoft-logo-transparent.png', sizeBytes: 182400, sortOrder: 0 },
      ...(i === 0 ? [{ id: 'img-1-2', url: '/favicon.png', sizeBytes: 9200, sortOrder: 1 }, { id: 'img-1-3', url: '/khaansoft-fb-profile.png', sizeBytes: 48211, sortOrder: 2 }] : []),
    ],
    videoUrl: null, videoSizeBytes: 0,
    sku: i % 3 === 1 ? null : `SKU-${100000 + i * 137}-MN-BEAUTY`,
    isActive: i % 9 !== 7,
    salePrice: onSale ? String(Math.round(price * 0.8)) : null, saleActive: onSale, isOnSale: onSale,
    featured: i % 7 === 0, featuredActive: i % 7 === 0, featuredSortOrder: i % 7 === 0 ? i : null,
    warehouseStocked: i % 8 === 0,
    embeddingStatus: i % 11 === 4 ? 'PENDING' : i % 13 === 6 ? 'FAILED' : 'READY',
    categories: cats.map((c) => ({ category: { id: c.id, name: c.name, slug: c.slug } })),
    trackStock: tracked, stockQuantity: stock, heldQuantity: held,
    availableQuantity: tracked ? Math.max(0, stock - held) : null,
  };
}
const products = PRODUCT_NAMES.map(makeProduct);

function productPage(url) {
  const q = url.searchParams;
  let rows = products;
  if (q.get('categoryId')) rows = rows.filter((p) => p.categories.some((c) => c.category.id === q.get('categoryId')));
  if (q.get('active')) rows = rows.filter((p) => p.isActive === (q.get('active') === 'true'));
  if (q.get('onSale') === 'true') rows = rows.filter((p) => p.isOnSale);
  if (q.get('featured') === 'true') rows = rows.filter((p) => p.featured);
  return offsetPage(rows, q, 20);
}

/* ── Customers ── */

const CUSTOMER_NAMES = [
  ...NAMES,
  'Сайнбилэгийн Цэцэгмаа-Оюунгэрэл Батмөнхийн', 'Отгонбаярын Төгөлдөр', 'Жаргалсайханы Хулан', 'Энхболдын Анударь', 'Мөнхбатын Тэмүүлэн', 'Пүрэвсүрэнгийн Баярмаа',
];
const PLATFORMS = ['messenger', 'instagram', 'messenger', 'manual', 'whatsapp'];
const phoneOf = (i) => `9900${String(i + 1).padStart(4, '0')}`;

function makeCustomer(i) {
  const unnamed = i % 11 === 10;
  return {
    id: `cust-${i + 1}`, platform: pick(PLATFORMS, i),
    name: unnamed ? null : pick(CUSTOMER_NAMES, i),
    phone: i % 4 === 3 ? null : phoneOf(i),
    email: i % 5 === 0 ? `customer${i + 1}@example.invalid` : null,
    avatarUrl: null,
    deliveryAddress: i % 3 === 0 ? LONG_ADDRESS : i % 3 === 1 ? 'Сүхбаатар дүүрэг, 3-р хороо' : null,
    createdAt: daysAgo(3 + i * 4), updatedAt: hoursAgo(5 + i * 9),
    _count: { conversations: wave(i, 1, 5), messages: i === 0 ? 12840 : wave(i, 3, 90) },
    orderCount: i === 0 ? 148 : i % 4 === 2 ? 0 : wave(i, 1, 7),
    totalSpent: i === 0 ? `${MONEY_BIG * 14}.00` : i % 4 === 2 ? '0.00' : `${wave(i, 40000, 900000)}.00`,
  };
}
const customers = repeat(34, makeCustomer);

function customerPage(url) {
  const q = url.searchParams;
  let rows = customers;
  if (q.get('platform')) rows = rows.filter((c) => c.platform === q.get('platform'));
  const search = (q.get('search') || '').trim().toLowerCase();
  if (search) rows = rows.filter((c) => JSON.stringify(c).toLowerCase().includes(search));
  const start = Number(q.get('cursor') || 0);
  const end = start + Number(q.get('limit') || 50);
  return { items: rows.slice(start, end), nextCursor: end < rows.length ? String(end) : null, hasMore: end < rows.length };
}

function customerDetail(id) {
  const base = customers.find((c) => c.id === id) || { ...makeCustomer(0), id };
  return {
    id: base.id, platform: base.platform, name: base.name, phone: base.phone, email: base.email, avatarUrl: base.avatarUrl,
    deliveryAddress: base.deliveryAddress, createdAt: base.createdAt, updatedAt: base.updatedAt,
    conversationCount: base._count.conversations, messageCount: base._count.messages, inboundMessageCount: Math.round(base._count.messages * 0.6),
    commentCount: 14, lastMessageAt: hoursAgo(2), lastCommentAt: daysAgo(2), lastCommentText: LONG_SENTENCE,
  };
}

/* ── Orders ── */

const qpayInvoice = (i, status, extra = {}) => ({
  id: `inv-${i + 1}`, status, publicRef: `INV-20260000-${String(i + 1).padStart(5, '0')}`,
  paidAt: status === 'PAID' ? hoursAgo(3 + i) : null,
  qpayInvoiceStatus: status === 'PAID' ? 'PAID' : status === 'PENDING' ? 'OPEN' : status,
  lastError: status === 'FAILED' ? 'qpay_invoice_failed' : null,
  payUrls: null, qrImageUrl: null, ...extra,
});

// One row per payment/fulfilment combination the order list can show; the rest cycle through them.
const ORDER_KINDS = [
  { status: 'PAID', provider: 'QPAY', invoice: 'PAID' },
  { status: 'PENDING', provider: null, invoice: 'PENDING' },
  { status: 'PENDING', provider: null, invoice: 'EXPIRED' },
  { status: 'CONFIRMED', provider: 'BANK_TRANSFER', invoice: null, manual: 'BANK_TRANSFER' },
  { status: 'SHIPPED', provider: 'QPAY', invoice: 'PAID' },
  { status: 'DELIVERED', provider: 'CASH', invoice: null, manual: 'CASH', source: 'manual' },
  { status: 'DELIVERED', provider: 'QPAY', invoice: 'PAID', pickup: true },
  { status: 'CANCELLED', provider: null, invoice: 'CANCELLED' },
  { status: 'REFUNDED', provider: 'QPAY', invoice: 'PAID' },
  { status: 'PENDING', provider: 'CASH', invoice: null, source: 'manual' },
  { status: 'PENDING', provider: null, invoice: 'FAILED' },
  { status: 'PAID', provider: 'BANK_TRANSFER', invoice: null, manual: 'BANK_TRANSFER', source: 'manual' },
];

function makeOrder(i) {
  const kind = pick(ORDER_KINDS, i);
  // Every fifth order is cust-1's, so the customer record's order tab has rows across the status range.
  const customer = i % 5 === 0 ? customers[0] : pick(customers, i * 3);
  const pickup = !!kind.pickup;
  const subtotal = i === 0 ? MONEY_BIG : i % 7 === 3 ? MONEY_BIG - 250000 : wave(i, 25000, 180000);
  const fee = pickup ? 0 : i % 5 === 0 ? 8000 : 5000;
  return {
    id: `order-${i + 1}`, status: kind.status, totalAmount: String(subtotal + fee),
    paymentProvider: kind.provider, paymentRef: kind.provider === 'QPAY' ? `QP-${700000 + i}` : null,
    contact: { id: customer.id, name: customer.name ?? '', phone: customer.phone ?? undefined, updatedAt: customer.updatedAt },
    invoice: kind.invoice ? qpayInvoice(i, kind.invoice) : null,
    metadata: {
      ...(kind.source ? { source: kind.source } : {}),
      ...(kind.manual ? { manualPayment: { method: kind.manual, reference: kind.manual === 'BANK_TRANSFER' ? `Гүйлгээний утга ${phoneOf(i)}` : undefined, at: hoursAgo(1 + i) } } : {}),
      checkout: pickup ? {} : {
        delivery: {
          label: 'Баянзүрх дүүрэг, 26-р хороо', zoneName: i % 2 ? 'Улаанбаатар төв бүс' : 'Алслагдсан дүүргийн хүргэлтийн бүс',
          channel: i % 3 ? 'OFFICE_COURIER' : 'WAREHOUSE', baseFee: fee, discount: 0, tierMinSubtotal: null,
          note: i % 4 === 0 ? 'Хүргэлт 2-3 хоногийн дотор очно' : undefined, addressMismatch: i % 12 === 4,
        },
      },
    },
    fulfilmentMethod: i % 11 === 9 ? null : pickup ? 'PICKUP' : 'DELIVERY',
    pickupBranchId: pickup ? 'branch-1' : null,
    pickupBranchName: pickup ? 'Төв салбар — Сансар худалдааны төв, 3 давхар' : null,
    pickupBranchAddress: pickup ? LONG_ADDRESS : null,
    customerPhone: customer.phone,
    deliveryAddress: pickup ? null : i % 3 === 0 ? LONG_ADDRESS : 'Хан-Уул дүүрэг, 15-р хороо, 12-р байр',
    subtotalAmount: String(subtotal), deliveryFeeAmount: String(fee),
    _count: { items: i === 0 ? 4 : (i % 4) + 1 },
    createdAt: i === 0 ? hoursAgo(3) : hoursAgo(2 + i * 11),
  };
}
const orders = repeat(34, makeOrder);

function orderPage(url) {
  const q = url.searchParams;
  let rows = orders;
  if (q.get('status')) {
    const wanted = q.get('status').split(',');
    rows = rows.filter((o) => wanted.includes(o.status));
  }
  if (q.get('contactId')) rows = rows.filter((o) => o.contact.id === q.get('contactId'));
  return offsetPage(rows, q, 20);
}

function orderDetail(id) {
  const base = orders.find((o) => o.id === id) || { ...orders[0], id };
  const start = Math.max(0, orders.indexOf(base));
  const items = repeat(base._count.items, (n) => {
    const product = products[(start + n * 4) % products.length];
    const quantity = n === 0 ? 2 : 1;
    const unit = id === 'order-1' && n === 0 ? MONEY_BIG / 2 : Number(product.price);
    return {
      metadata: { productName: product.name },
      product: { id: product.id, name: product.name, images: product.images?.map((img) => ({ url: img.url })) },
      quantity, unitPrice: String(unit), totalPrice: String(unit * quantity),
    };
  });
  const detail = {
    ...base, items, updatedAt: hoursAgo(1),
    paidAt: base.invoice?.paidAt ?? base.metadata?.manualPayment?.at ?? null,
    timeline: [
      { at: base.createdAt, kind: 'created', actor: { kind: base.metadata?.source === 'manual' ? 'staff' : 'bot', name: base.metadata?.source === 'manual' ? 'Туршилтын Хэрэглэгч' : null }, text: '' },
      { at: hoursAgo(2.8), kind: 'invoice', actor: { kind: 'system', name: null }, text: 'QPay нэхэмжлэх үүсгэсэн', invoiceStatus: 'OPEN' },
      { at: hoursAgo(2.5), kind: 'payment', actor: { kind: 'customer', name: base.contact.name }, text: 'Төлбөр төлөгдсөн', paymentMethod: base.paymentProvider },
      { at: hoursAgo(2.4), kind: 'status', actor: { kind: 'system', name: null }, text: '', from: 'PENDING', to: base.status },
      { at: hoursAgo(2.3), kind: 'stock', actor: { kind: 'system', name: null }, text: 'Үлдэгдлээс 3 ширхэг хасагдсан' },
      { at: hoursAgo(1), kind: 'note', actor: { kind: 'staff', name: 'Туршилтын Хэрэглэгч' }, text: LONG_SENTENCE, noteId: 'note-1' },
    ],
  };
  if (id === 'order-1') {
    detail.invoice = qpayInvoice(0, 'PAID', {
      settlementBankCode: '050000', settlementBankName: 'Туршилтын худалдааны банк', settlementAccountNumber: '5000000001',
      settlementAccountName: 'Гоо сайхны онлайн дэлгүүр ХХК', settlementSource: 'qpay',
    });
    detail.metadata = {
      ...detail.metadata,
      paymentConfirmation: { sentAt: hoursAgo(2.2) },
      stock: { oversold: [{ productId: products[0].id, name: products[0].name, quantity: 2, shortBy: 1 }] },
    };
  }
  return detail;
}

/* ── Customer activity ── */

function customerActivity(id) {
  const own = orders.filter((o) => o.contact.id === id);
  const events = [
    ...own.slice(0, 8).map((o) => ({
      type: 'order', at: o.createdAt, orderId: o.id, status: o.status, totalAmount: String(o.totalAmount),
      paymentProvider: o.paymentProvider, fulfilmentMethod: o.fulfilmentMethod, itemCount: o._count.items,
    })),
    ...repeat(6, (i) => ({ type: 'conversation', at: hoursAgo(6 + i * 30), conversationId: i === 0 ? 'conv-1' : `conv-a${i}`, platform: i % 2 ? 'instagram' : 'messenger', messageCount: wave(i, 4, 60) })),
    ...repeat(6, (i) => ({
      type: 'comment', at: daysAgo(1 + i * 3), commentId: `comment-a${i}`,
      message: i === 4 ? null : i % 2 ? 'Үнэ хэд вэ?' : LONG_SENTENCE,
      sentiment: ['NEGATIVE', 'POSITIVE', 'NEUTRAL'][i % 3], publicReplied: i % 2 === 0, privateReplied: i % 3 === 0,
    })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const paid = own.filter((o) => ['PAID', 'CONFIRMED', 'SHIPPED', 'DELIVERED'].includes(o.status));
  const spent = paid.reduce((sum, o) => sum + Number(o.totalAmount), 0);
  return { events, orderCount: id === 'cust-1' ? 148 : paid.length, totalSpent: id === 'cust-1' ? `${MONEY_BIG * 14}.00` : `${spent}.00` };
}

/* ── Summary ── */

const ordersByStatus = orders.reduce((acc, o) => ({ ...acc, [o.status]: (acc[o.status] || 0) + 1 }), {});

const summary = () => ({
  pendingOrders: ordersByStatus.PENDING || 0, ordersByStatus,
  todayOrders: 27, todayPaidOrders: 19, todayPendingOrders: 6,
  todayRevenue: String(MONEY_BIG),
  commentsToReview: 14, waitingHandoffs: 5,
  noAnswerThisWeek: 23,
  topUnansweredTopic: { id: 'topic-1', label: 'Хөдөө орон нутаг руу хүргэлт хийх үнэ болон хугацааны талаарх асуулт', count: 9 },
  outOfStockShownToBot: { count: 4, names: [LONG_NAME, products[6].name, products[12].name] },
});

/* ── Analytics ── */

const delta = (current, previous) => ({
  current, previous,
  changePct: Number(previous) > 0 ? Math.round(((Number(current) - Number(previous)) / Number(previous)) * 1000) / 10 : null,
});

function seriesPoint(date, i, scale = 1) {
  const orderCount = Math.round(wave(i, 6, 22) * scale);
  return {
    date, orders: orderCount, paidOrders: Math.round(orderCount * 0.7), revenue: `${Math.round(wave(i, 400000, 2200000) * scale)}.00`,
    newCustomers: Math.round(wave(i + 3, 2, 10) * scale), conversations: Math.round(wave(i + 1, 10, 45) * scale),
    inboundMessages: Math.round(wave(i + 2, 40, 210) * scale), comments: Math.round(wave(i + 4, 3, 26) * scale),
    respondedComments: Math.round(wave(i + 4, 2, 20) * scale),
  };
}

function analyticsReport(from, to) {
  const dates = dayRange(from, to);
  const days = dates.length;
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(days - 1));
  const series = dates.map((date, i) => seriesPoint(date, i));
  const sum = (key) => series.reduce((total, row) => total + Number(row[key]), 0);
  const revenue = sum('revenue');
  const ordersCount = sum('orders');
  const paidOrders = sum('paidOrders');
  const average = paidOrders ? Math.round(revenue / paidOrders) : 0;
  const inbound = sum('inboundMessages');
  const productRevenue = products.slice(0, 8).map((p, i) => ({
    productId: p.id, name: p.name, quantity: wave(i, 20, 140), orders: wave(i, 12, 80),
    revenue: `${i === 0 ? MONEY_BIG * 3 : wave(i, 400000, 4000000)}.00`, sharePct: [32.5, 18.1, 12, 9.4, 8, 7.5, 7, 5.5][i],
    series: dates.map((date, n) => ({ date, revenue: `${wave(n + i * 2, 20000, 300000)}.00`, quantity: wave(n + i, 1, 5) })),
  }));
  const funnel = [
    ['active_customers', 'Идэвхтэй харилцагч', 1842, 100, 1600],
    ['product_interest', 'Бараа асуусан', 960, 52.1, 900],
    ['orders', 'Захиалгатай харилцагч', 412, 42.9, 390],
    ['paid_orders', 'Төлөгдсөн', 228, 55.3, 260],
    ['fulfilled_orders', 'Хүргэсэн', 196, 86, 170],
  ].map(([key, label, count, conversionPct, previousCount]) => ({
    key, label, count, conversionPct, previousCount, changePct: Math.round(((count - previousCount) / previousCount) * 1000) / 10,
  }));
  const cohorts = repeat(6, (i) => {
    const size = wave(i, 80, 220);
    return {
      cohort: addDays(from, i * 7), customers: size, ordered: Math.round(size * 0.3), retained7d: Math.round(size * 0.2), retained30d: Math.round(size * 0.12),
      eligible7d: size, eligible30d: i < 2 ? size : 0, orderRatePct: 30, retained7dPct: 20, retained30dPct: i < 2 ? 12 : null,
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    range: { from, to, days }, previousRange: { from: prevFrom, to: prevTo, days },
    summary: {
      orders: ordersCount, paidOrders, revenue: `${revenue}.00`, averageOrderValue: `${average}.00`,
      activeOrders: 42, cancelledOrders: 18, fulfilledOrders: Math.round(paidOrders * 0.8),
      newCustomers: sum('newCustomers'), activeCustomers: 1842, conversations: sum('conversations'), openConversations: 37,
      messages: inbound * 2, inboundMessages: inbound, outboundMessages: inbound, aiReplies: Math.round(inbound * 0.8),
      comments: sum('comments'), respondedComments: sum('respondedComments'), productQuestionComments: 96, positiveComments: 214, neutralComments: 120, negativeComments: 31,
      repeatCustomers: 188, conversionRatePct: 12.4, repeatCustomerRatePct: 31.6, commentResponseRatePct: 87.5,
      delta: {
        orders: delta(ordersCount, Math.round(ordersCount * 0.8)), paidOrders: delta(paidOrders, Math.round(paidOrders * 1.1)),
        revenue: delta(`${revenue}.00`, `${Math.round(revenue * 0.7)}.00`), averageOrderValue: delta(`${average}.00`, `${Math.round(average * 1.05)}.00`),
        newCustomers: delta(sum('newCustomers'), 6), activeCustomers: delta(1842, 1600), comments: delta(sum('comments'), 0), conversionRatePct: delta(12.4, 10.9),
      },
    },
    series,
    previousSeries: dayRange(prevFrom, prevTo).map((date, i) => seriesPoint(date, i + 5, 0.8)),
    productRevenue, funnel, cohorts,
    statusBreakdown: ['PENDING', 'PAID', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'].map((status, i) => ({
      status, count: [42, 86, 54, 31, 196, 18, 7][i], revenue: ['PENDING', 'CANCELLED', 'REFUNDED'].includes(status) ? '0.00' : `${wave(i, 3000000, MONEY_BIG)}.00`,
    })),
    channelBreakdown: [
      { channel: 'messenger', customers: 1320, conversations: 2410, messages: 18420, comments: 0 },
      { channel: 'instagram', customers: 410, conversations: 690, messages: 5210, comments: 148 },
      { channel: 'facebook', customers: 980, conversations: 0, messages: 0, comments: 642 },
      { channel: 'manual', customers: 52, conversations: 0, messages: 0, comments: 0 },
      { channel: 'unknown', customers: 3, conversations: 0, messages: 0, comments: 0 },
    ],
    commentQuality: { total: 365, positive: 214, neutral: 120, negative: 31, productQuestions: 96, responded: 319, responseRatePct: 87.4 },
  };
}

function analytics(ctx) {
  const today = ubDateKey();
  const to = ctx.url.searchParams.get('to') || today;
  const from = ctx.url.searchParams.get('from') || addDays(to, -29);
  return {
    currentMonth: { aiCreditsUsed: 742000 }, previousMonth: { aiCreditsUsed: 1180000 },
    aiAllowance: {
      period: addDays(today, 20), periodEndsAt: daysAhead(20), unlimited: false,
      planCredits: 1500000, planRemainingCredits: 758000, topUpCredits: 250000, topUpPurchasedCredits: 500000,
      effectiveCredits: 1750000, usedCredits: 742000, remainingCredits: 1008000,
    },
    catalog: {
      effectiveTier: 'PRO',
      documents: { used: 86, limit: 100 }, categories: { used: categories.length, limit: 50 }, products: { used: products.length, limit: 40 },
      documentCategories: { used: 6, limit: 20 }, branches: { used: 4, limit: 10 },
    },
    report: analyticsReport(from, to),
    storageUsedBytes: '824633720832', quota: { monthlyMessageLimit: 100000, storageLimitBytes: '1099511627776' },
  };
}

function chatbotAnalytics(ctx) {
  const days = Number(ctx.url.searchParams.get('days') || 30);
  const to = ubDateKey();
  const from = addDays(to, -(days - 1));
  const series = dayRange(from, to).map((date, i) => ({ date, bot: wave(i, 20, 180), team: wave(i + 2, 2, 30), noAnswer: wave(i + 5, 0, 8) }));
  const sum = (key) => series.reduce((total, row) => total + row[key], 0);
  const totals = { inbound: sum('bot') + sum('team') + sum('noAnswer') + 480, bot: sum('bot'), team: sum('team'), noAnswer: sum('noAnswer'), handoffs: 64, ordersFromChat: 187 };
  return {
    days, from, to, trackedSince: addDays(from, -30), series, totals,
    previous: { inbound: Math.round(totals.inbound * 0.9), bot: Math.round(totals.bot * 0.85), team: Math.round(totals.team * 1.2), noAnswer: Math.round(totals.noAnswer * 1.4), handoffs: 80, ordersFromChat: 160 },
    handoffReasons: [{ reason: 'customer_asked', count: 38 }, { reason: 'no_answer', count: 15 }, { reason: 'ai_failure', count: 4 }, { reason: 'other', count: 7 }],
  };
}

/* ── Delivery options ── */

const checkoutSettings = {
  warehouseDeliveryAvailable: true, warehouseDeliveryEnabled: true, warehouseDeliveryFeeAmount: 4500,
  warehouseDeliveryDiscountsEnabled: true,
  warehouseDeliveryTiers: [{ minSubtotal: 100000, fee: 2500 }, { minSubtotal: 500000, fee: 0 }],
  warehouseDeliveryZoneIds: ['central'],
  warehouseDeliveryLabel: 'Агуулахаас шууд хүргэх, төв бүс', // 40 characters at most
  deliveryEnabled: true, deliveryFeeEnabled: true, deliveryFeeAmount: 5000, deliveryFeeWhenOn: 5000,
  paymentConfirmationTemplate: `Таны захиалгын төлбөр амжилттай төлөгдлөө. ${LONG_SENTENCE}`,
  // Must pass validateDeliveryPricing (zone name <= 40, note <= 120) or the page silently falls back to the flat fee.
  deliveryPricing: {
    version: 1,
    zones: [
      { id: 'central', name: 'Улаанбаатар төв бүс', fee: 5000, discounts: true, note: 'Ажлын 1-2 өдөрт хүргэнэ' },
      { id: 'remote', name: 'Алслагдсан дүүрэг: Налайх, Багануур', fee: 15000, discounts: true, note: 'Унааны хөлсийг жолоочид төлнө' },
      { id: 'countryside', name: 'Хөдөө орон нутаг, унаанд тавьж өгөх', fee: 25000, discounts: false, note: 'Унааны хөлсийг жолоочид төлнө. Хугацаа нь аймгаас хамаарч 3-7 хоног, унааны цагаас шалтгаалан өөрчлөгдөж болно.' },
    ],
    areas: { ub: 'central', 'ub:13000:26': 'remote', cs: 'countryside', 'cs:65000': 'off' },
    tiers: [{ minSubtotal: 100000, off: 2000 }, { minSubtotal: 300000, off: 'all' }],
  },
};

const branches = repeat(5, (i) => ({
  id: `branch-${i + 1}`,
  name: ['Төв салбар — Сансар худалдааны төв, 3 давхар', 'Зайсан салбар', 'Баруун 4 зам салбар, их дэлгүүрийн ард', 'Яармаг салбар', 'Түр хаалттай салбар'][i],
  address: i % 2 ? 'Хан-Уул дүүрэг, 15-р хороо' : LONG_ADDRESS,
  phone: i === 3 ? null : `9901000${i + 1}`,
  note: i === 0 ? 'Өдөр бүр 10:00-20:00 цагт ажиллана, бямба гарагт 18:00 хүртэл, бүтэн сайн гарагт амарна.' : null,
  sortOrder: i, isActive: i !== 4, createdAt: daysAgo(90 - i), updatedAt: daysAgo(10 + i),
}));

/* ── Routes ── */

export const routes = [
  ['GET', rx('/summary'), () => summary()],
  ['GET', rx('/analytics'), (ctx) => analytics(ctx)],
  ['GET', rx('/analytics/chatbot'), (ctx) => chatbotAnalytics(ctx)],
  ['GET', rx('/checkout-settings'), () => checkoutSettings],
  ['GET', rx('/branches'), () => branches],
  ['GET', rx('/categories'), (ctx) => offsetPage(categories, ctx.url.searchParams, 100)],
  ['GET', rx('/products'), (ctx) => productPage(ctx.url)],
  ['GET', rx('/products/([^/]+)'), (_ctx, m) => products.find((p) => p.id === m[1]) || { ...products[0], id: m[1] }],
  ['GET', rx('/orders'), (ctx) => orderPage(ctx.url)],
  ['GET', rx('/orders/([^/]+)'), (_ctx, m) => orderDetail(m[1])],
  ['GET', rx('/customers'), (ctx) => customerPage(ctx.url)],
  ['GET', rx('/customers/([^/]+)/activity'), (_ctx, m) => customerActivity(m[1])],
  ['GET', rx('/customers/([^/]+)'), (_ctx, m) => customerDetail(m[1])],
];
