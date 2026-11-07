// Helpers and long Mongolian sample text. All names and numbers here are invented.
export const TENANT_ID = 'e2e-tenant';
export const T = '/api/tenants/e2e-tenant';

const DAY = 86400000;
export const daysAgo = (n) => new Date(Date.now() - n * DAY).toISOString();
export const daysAhead = (n) => new Date(Date.now() + n * DAY).toISOString();
export const hoursAgo = (n) => new Date(Date.now() - n * 3600000).toISOString();

export const LONG_NAME = 'Байгалийн гаралтай олон төрлийн ургамлын хандтай чийгшүүлэгч нүүрний тос, 50 мл багцтай';
export const LONG_SENTENCE = 'Сайн байна уу, энэ барааны үнэ, хүргэлтийн нөхцөл болон төлбөрийн хэрэгслийн талаар дэлгэрэнгүй мэдээлэл авмаар байна, баярлалаа.';
export const LONG_ADDRESS = 'Улаанбаатар хот, Баянзүрх дүүрэг, 26-р хороо, Их Монгол Улсын гудамж, Нарны хороолол, 45-р байр, 3-р орц, 12 давхар, 128 тоот';
export const NAMES = ['Батбаярын Энхтуяа', 'Дамдинсүрэнгийн Оюунчимэг', 'Ганбаатарын Мөнхжаргал', 'Цэрэндоржийн Сарангэрэл', 'Болдын Ариунаа', 'Сүхбатын Номинзаяа'];
export const MONEY_BIG = 12499000;

export const repeat = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));
