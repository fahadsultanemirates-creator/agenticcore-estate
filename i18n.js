/* ============================================
   AgenticCore Estate — one-click EN / UR toggle
   Elements opt in with data-i18n="key" (textContent)
   or data-i18n-ph="key" (placeholder attribute).
   Language + direction persist in localStorage.
   ============================================ */

const AC_I18N = {
  en: {
    nav_buy: 'Buy', nav_rent: 'Rent', nav_sell: 'Sell', nav_developer: 'Developer Corner',
    nav_business_pool: 'Business Pool', nav_referrals: 'Referrals', nav_pricing: 'Pricing',
    nav_login: 'Log in', nav_signup: 'Get started', nav_dashboard: 'Dashboard', nav_logout: 'Log out',
    nav_admin: 'Admin',

    hero_eyebrow: 'Real estate, run by agents and verified by people',
    hero_title_pre: 'Find, list, and sell property across ',
    hero_title_accent: 'Pakistan',
    hero_sub: 'Search verified buy and rent listings, or list your own property in minutes — with a Developer Corner built for builders and agencies.',
    hero_cta_browse: 'Browse listings',
    hero_cta_sell: 'List your property',

    search_buy: 'Buy', search_rent: 'Rent', search_sell: 'Sell',
    search_city: 'City', search_any_city: 'Any city',
    search_type: 'Property type', search_any_type: 'Any type',
    search_price: 'Max price (PKR)', search_go: 'Search',
    search_keyword_ph: 'Search by area, society, or project name',

    section_featured_eyebrow: 'Fresh on the market',
    section_featured_title: 'Featured listings',
    section_featured_sub: 'A mix of verified developer listings and individual sellers, updated daily.',
    view_all: 'View all listings',
    listing_view: 'View details',
    listing_beds: 'beds', listing_baths: 'baths', listing_marla: 'marla',
    listing_month: '/mo',

    section_devcorner_eyebrow: 'For builders & agencies',
    section_devcorner_title: 'The Developer Corner',
    section_devcorner_sub: 'A dedicated space for verified developers — document-checked, tiered, and built for volume.',
    devcorner_cta: 'Explore Developer Corner',

    section_ai_eyebrow: 'Coming to your dashboard',
    section_ai_title: 'AI tools already reserved a spot',
    section_ai_sub: 'Three agent-powered features are wired into the UI now, and will connect to the AgenticCore agent backend as it ships.',
    ai_growth_title: 'Growth Score', ai_growth_desc: 'A single score estimating how fast a listing or developer profile is likely to convert, based on pricing, completeness, and market demand.',
    ai_doccheck_title: 'AI Document Check', ai_doccheck_desc: 'Automated first-pass review of CNIC and company documents before a human verifier signs off — flags mismatches and low-quality scans.',
    ai_advisor_title: 'Property Advisor', ai_advisor_desc: 'A conversational assistant that helps buyers narrow down listings and answers questions about a specific property.',
    coming_soon: 'Coming soon',

    section_membership_eyebrow: 'Developer Corner pricing',
    section_membership_title: 'Three tiers, one dashboard',
    section_membership_sub: 'Starter, Growth, and Elite — priced monthly, document-verified either way.',

    section_why_eyebrow: 'Built differently',
    section_why_title: "What sets AgenticCore Estate apart",
    section_why_sub: "We looked at Pakistan's established property portals closely before building this — here's what we do differently.",

    section_referral_eyebrow: 'Earn by referring',
    section_referral_title: 'Five levels, starting at 25%',
    section_referral_sub: 'Refer someone, and when they — or the four levels below them — transact, you earn AgenticCore Points up the whole chain.',

    section_family_eyebrow: 'One family, several companies',
    section_family_title: 'Part of the AgenticCore family',
    section_family_sub: 'AgenticCore Estate shares its team with sister companies — developers get more than a listing here.',

    quick_links_pool: 'Explore Business Pool →', quick_links_referral: 'Refer & Earn →',
    quick_links_pricing: 'See Developer Pricing →',

    final_cta_title: 'Ready to find your next property?',
    final_cta_sub: 'Browse verified listings or list your own — free to get started.',
    final_cta_btn: 'Get started free',

    footer_tagline: 'AI-run real estate marketplace for Pakistan. Part of the AgenticCore family, alongside AgenticCore Agency and AgenticCore Biz.',
    footer_explore: 'Explore', footer_developers: 'Developers', footer_company: 'Company', footer_legal: 'Legal',
    footer_terms: 'Terms of Service', footer_privacy: 'Privacy Policy', footer_referral_policy: 'Referral Points Policy',
    footer_rights: 'All rights reserved.',

    auth_signup_title: 'Create your account', auth_signup_sub: 'Buyers, sellers, and developers all start here.',
    auth_login_title: 'Welcome back', auth_login_sub: 'Log in with your phone number or email.',
    field_full_name: 'Full name', field_phone: 'Phone number', field_cnic: 'Government ID / CNIC number',
    field_email: 'Email', field_password: 'Password', field_account_type: 'I am a...',
    role_buyer: 'Buyer / Seller (individual)', role_developer: 'Developer / Agency',
    field_referral_code: 'Referral code (optional)',
    auth_signup_btn: 'Create account', auth_login_btn: 'Log in',
    auth_has_account: 'Already have an account?', auth_no_account: "Don't have an account?",
    auth_create_one: 'Create one', auth_login_link: 'Log in',
    auth_id_note: 'Required for every account — used to verify real listings and prevent fraud. Never shown publicly.',

    pricing_eyebrow: 'Developer Corner pricing', pricing_title: 'Three tiers, one verified marketplace',
    pricing_sub: 'Every developer account is document-verified before it goes live. Pricing is monthly, per active listing slot.',
    tier_starter: 'Starter', tier_growth: 'Growth', tier_elite: 'Elite',
    tier_per_month: '/month',

    bp_eyebrow: 'For high-volume partners', bp_title: 'Business Pool',
    bp_sub: 'A dedicated tier for developers and agencies who list with us regularly — a real manager, not just a support queue.',
    bp_manager_title: 'Talk to your dedicated manager',
    bp_telegram: 'Message on Telegram', bp_whatsapp: 'Message on WhatsApp',
    bp_cross_title: 'Cross-platform support', bp_cross_sub: 'Business Pool access extends across the AgenticCore family.',

    ref_eyebrow: 'Earn by referring', ref_title: 'The Referral Program',
    ref_sub: 'Five levels deep — the whole chain gets rewarded when a referred account transacts.',
    ref_dashboard_cta: 'Open referral dashboard',

    admin_login_title: 'Admin sign in', admin_login_sub: 'Restricted to AgenticCore Estate reviewers.',

    dev_pending_title: 'Your application is under review',
    dev_pending_sub: 'Our team verifies every CNIC and company document before a developer account goes live. This normally takes up to 72 hours.',

    ai_chat_title: 'Property Advisor', ai_chat_sub: 'This assistant is not connected yet — the chat panel is ready for the agent backend.',
    ai_chat_placeholder: 'Ask about this property… (coming soon)'
  },

  ur: {
    nav_buy: 'خریدیں', nav_rent: 'کرایہ', nav_sell: 'فروخت کریں', nav_developer: 'ڈویلپر کارنر',
    nav_business_pool: 'بزنس پول', nav_referrals: 'ریفرل', nav_pricing: 'قیمتیں',
    nav_login: 'لاگ ان', nav_signup: 'شروع کریں', nav_dashboard: 'ڈیش بورڈ', nav_logout: 'لاگ آؤٹ',
    nav_admin: 'ایڈمن',

    hero_eyebrow: 'رئیل اسٹیٹ، ایجنٹس کے ذریعے چلائی گئی اور انسانوں سے تصدیق شدہ',
    hero_title_pre: 'پورے ',
    hero_title_accent: 'پاکستان',
    hero_sub: 'تصدیق شدہ خرید و کرایہ کی جائیدادیں تلاش کریں، یا چند منٹوں میں اپنی جائیداد کی فہرست بنائیں — ڈویلپرز اور ایجنسیوں کے لیے مخصوص ڈویلپر کارنر کے ساتھ۔',
    hero_cta_browse: 'فہرستیں دیکھیں',
    hero_cta_sell: 'اپنی جائیداد درج کریں',

    search_buy: 'خریدیں', search_rent: 'کرایہ', search_sell: 'فروخت',
    search_city: 'شہر', search_any_city: 'کوئی بھی شہر',
    search_type: 'جائیداد کی قسم', search_any_type: 'کوئی بھی قسم',
    search_price: 'زیادہ سے زیادہ قیمت (روپے)', search_go: 'تلاش کریں',
    search_keyword_ph: 'علاقے، سوسائٹی یا پراجیکٹ کا نام لکھیں',

    section_featured_eyebrow: 'مارکیٹ میں نئی',
    section_featured_title: 'نمایاں فہرستیں',
    section_featured_sub: 'تصدیق شدہ ڈویلپر فہرستوں اور انفرادی فروخت کنندگان کا مجموعہ، روزانہ اپ ڈیٹ ہوتا ہے۔',
    view_all: 'تمام فہرستیں دیکھیں',
    listing_view: 'تفصیل دیکھیں',
    listing_beds: 'بیڈ', listing_baths: 'باتھ', listing_marla: 'مرلہ',
    listing_month: '/ماہ',

    section_devcorner_eyebrow: 'بلڈرز اور ایجنسیوں کے لیے',
    section_devcorner_title: 'ڈویلپر کارنر',
    section_devcorner_sub: 'تصدیق شدہ ڈویلپرز کے لیے مخصوص جگہ — دستاویزات کی جانچ، درجہ بندی، اور بڑے پیمانے کے لیے تیار۔',
    devcorner_cta: 'ڈویلپر کارنر دیکھیں',

    section_ai_eyebrow: 'آپ کے ڈیش بورڈ میں جلد آ رہا ہے',
    section_ai_title: 'AI ٹولز کے لیے جگہ پہلے سے موجود ہے',
    section_ai_sub: 'تین ایجنٹ سے چلنے والی خصوصیات ابھی UI میں شامل کر دی گئی ہیں، اور AgenticCore ایجنٹ بیک اینڈ کے تیار ہوتے ہی فعال ہو جائیں گی۔',
    ai_growth_title: 'گروتھ اسکور', ai_growth_desc: 'قیمت، مکمل معلومات اور مارکیٹ ڈیمانڈ کی بنیاد پر ایک اسکور جو بتاتا ہے کہ فہرست یا ڈویلپر پروفائل کتنی جلدی نتیجہ دے سکتا ہے۔',
    ai_doccheck_title: 'AI دستاویز چیک', ai_doccheck_desc: 'انسانی تصدیق سے پہلے CNIC اور کمپنی دستاویزات کا خودکار ابتدائی جائزہ — بے میل اور ناقص اسکینز کی نشاندہی کرتا ہے۔',
    ai_advisor_title: 'پراپرٹی ایڈوائزر', ai_advisor_desc: 'ایک گفتگو کرنے والا معاون جو خریداروں کو فہرستیں منتخب کرنے اور کسی خاص جائیداد کے بارے میں سوالات کے جواب دینے میں مدد دیتا ہے۔',
    coming_soon: 'جلد آ رہا ہے',

    section_membership_eyebrow: 'ڈویلپر کارنر قیمتیں',
    section_membership_title: 'تین درجے، ایک ڈیش بورڈ',
    section_membership_sub: 'اسٹارٹر، گروتھ، اور ایلیٹ — ماہانہ قیمت، ہر صورت میں دستاویز تصدیق شدہ۔',

    section_why_eyebrow: 'مختلف انداز میں بنایا گیا',
    section_why_title: 'AgenticCore Estate کو دوسروں سے کیا ممتاز کرتا ہے',
    section_why_sub: 'یہ بنانے سے پہلے ہم نے پاکستان کے قائم شدہ پراپرٹی پورٹلز کو غور سے دیکھا — یہاں وہ چیزیں ہیں جو ہم مختلف طریقے سے کرتے ہیں۔',

    section_referral_eyebrow: 'ریفر کرکے کمائیں',
    section_referral_title: 'پانچ درجے، 25% سے شروع',
    section_referral_sub: 'کسی کو ریفر کریں، اور جب وہ — یا ان کے نیچے کے چار درجے — لین دین کریں تو آپ پوری زنجیر میں AgenticCore پوائنٹس کماتے ہیں۔',

    section_family_eyebrow: 'ایک خاندان، کئی کمپنیاں',
    section_family_title: 'AgenticCore خاندان کا حصہ',
    section_family_sub: 'AgenticCore Estate اپنی ٹیم بہن کمپنیوں کے ساتھ شریک کرتا ہے — ڈویلپرز کو یہاں محض ایک فہرست سے زیادہ ملتا ہے۔',

    quick_links_pool: 'بزنس پول دیکھیں ←', quick_links_referral: 'ریفر کریں اور کمائیں ←',
    quick_links_pricing: 'ڈویلپر قیمتیں دیکھیں ←',

    final_cta_title: 'اپنی اگلی جائیداد تلاش کرنے کے لیے تیار ہیں؟',
    final_cta_sub: 'تصدیق شدہ فہرستیں دیکھیں یا اپنی جائیداد درج کریں — شروع کرنا مفت ہے۔',
    final_cta_btn: 'مفت شروع کریں',

    footer_tagline: 'پاکستان کے لیے AI سے چلنے والا رئیل اسٹیٹ مارکیٹ پلیس۔ AgenticCore ایجنسی اور AgenticCore بز کے ساتھ AgenticCore خاندان کا حصہ۔',
    footer_explore: 'دریافت کریں', footer_developers: 'ڈویلپرز', footer_company: 'کمپنی', footer_legal: 'قانونی',
    footer_terms: 'شرائط و ضوابط', footer_privacy: 'رازداری کی پالیسی', footer_referral_policy: 'ریفرل پوائنٹس پالیسی',
    footer_rights: 'جملہ حقوق محفوظ ہیں۔',

    auth_signup_title: 'اپنا اکاؤنٹ بنائیں', auth_signup_sub: 'خریدار، فروخت کنندہ اور ڈویلپرز سب یہاں سے شروع کرتے ہیں۔',
    auth_login_title: 'خوش آمدید', auth_login_sub: 'اپنے فون نمبر یا ای میل سے لاگ ان کریں۔',
    field_full_name: 'پورا نام', field_phone: 'فون نمبر', field_cnic: 'سرکاری شناختی کارڈ / CNIC نمبر',
    field_email: 'ای میل', field_password: 'پاس ورڈ', field_account_type: 'میں ہوں...',
    role_buyer: 'خریدار / فروخت کنندہ (انفرادی)', role_developer: 'ڈویلپر / ایجنسی',
    field_referral_code: 'ریفرل کوڈ (اختیاری)',
    auth_signup_btn: 'اکاؤنٹ بنائیں', auth_login_btn: 'لاگ ان',
    auth_has_account: 'پہلے سے اکاؤنٹ ہے؟', auth_no_account: 'اکاؤنٹ نہیں ہے؟',
    auth_create_one: 'ایک بنائیں', auth_login_link: 'لاگ ان کریں',
    auth_id_note: 'ہر اکاؤنٹ کے لیے لازمی — اصل فہرستوں کی تصدیق اور دھوکہ دہی روکنے کے لیے استعمال ہوتا ہے۔ کبھی عوامی طور پر ظاہر نہیں ہوتا۔',

    pricing_eyebrow: 'ڈویلپر کارنر کی قیمتیں', pricing_title: 'تین درجے، ایک تصدیق شدہ مارکیٹ پلیس',
    pricing_sub: 'ہر ڈویلپر اکاؤنٹ فعال ہونے سے پہلے دستاویزات کی تصدیق سے گزرتا ہے۔ قیمت ماہانہ اور فی فعال لسٹنگ سلاٹ ہے۔',
    tier_starter: 'اسٹارٹر', tier_growth: 'گروتھ', tier_elite: 'ایلیٹ',
    tier_per_month: '/ماہانہ',

    bp_eyebrow: 'زیادہ حجم رکھنے والے شراکت داروں کے لیے', bp_title: 'بزنس پول',
    bp_sub: 'ان ڈویلپرز اور ایجنسیوں کے لیے مخصوص درجہ جو باقاعدگی سے ہمارے ساتھ فہرستیں لگاتے ہیں — ایک حقیقی منیجر، صرف سپورٹ قطار نہیں۔',
    bp_manager_title: 'اپنے مخصوص منیجر سے بات کریں',
    bp_telegram: 'ٹیلیگرام پر پیغام بھیجیں', bp_whatsapp: 'واٹس ایپ پر پیغام بھیجیں',
    bp_cross_title: 'کراس پلیٹ فارم سپورٹ', bp_cross_sub: 'بزنس پول تک رسائی پورے AgenticCore خاندان میں پھیلی ہوئی ہے۔',

    ref_eyebrow: 'ریفر کرکے کمائیں', ref_title: 'ریفرل پروگرام',
    ref_sub: 'پانچ درجے گہرائی میں — جب ریفر شدہ اکاؤنٹ لین دین کرتا ہے تو پوری زنجیر کو انعام ملتا ہے۔',
    ref_dashboard_cta: 'ریفرل ڈیش بورڈ کھولیں',

    admin_login_title: 'ایڈمن سائن ان', admin_login_sub: 'صرف AgenticCore Estate جائزہ لینے والوں کے لیے مخصوص۔',

    dev_pending_title: 'آپ کی درخواست زیر جائزہ ہے',
    dev_pending_sub: 'ہماری ٹیم ڈویلپر اکاؤنٹ فعال کرنے سے پہلے ہر CNIC اور کمپنی دستاویز کی تصدیق کرتی ہے۔ اس میں عام طور پر 72 گھنٹے تک لگتے ہیں۔',

    ai_chat_title: 'پراپرٹی ایڈوائزر', ai_chat_sub: 'یہ معاون ابھی جڑا نہیں ہے — چیٹ پینل ایجنٹ بیک اینڈ کے لیے تیار ہے۔',
    ai_chat_placeholder: 'اس جائیداد کے بارے میں پوچھیں… (جلد آ رہا ہے)'
  }
};

function acApplyLanguage(lang) {
  lang = (lang === 'ur') ? 'ur' : 'en';
  document.documentElement.setAttribute('lang', lang);
  document.documentElement.setAttribute('dir', lang === 'ur' ? 'rtl' : 'ltr');
  localStorage.setItem('acLang', lang);

  const dict = AC_I18N[lang];
  document.querySelectorAll('[data-i18n]').forEach(function (el) {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) el.textContent = dict[key];
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
    const key = el.getAttribute('data-i18n-ph');
    if (dict[key]) el.setAttribute('placeholder', dict[key]);
  });
  document.querySelectorAll('.lang-toggle .lang-toggle-label').forEach(function (el) {
    el.textContent = lang === 'ur' ? 'EN' : 'اردو';
  });

  if (typeof window.acOnLanguageChange === 'function') window.acOnLanguageChange();
}

function acToggleLanguage() {
  const current = localStorage.getItem('acLang') === 'ur' ? 'ur' : 'en';
  acApplyLanguage(current === 'ur' ? 'en' : 'ur');
}

function acInitLanguage() {
  const saved = localStorage.getItem('acLang') === 'ur' ? 'ur' : 'en';
  acApplyLanguage(saved);
}

document.addEventListener('DOMContentLoaded', acInitLanguage);
