// Approved knowledge for the two AgenticCore assistants (the AgenticCore AI
// Assistant and Amaan). Everything an assistant may state as fact lives here
// or comes from live site data for the turn (search results, listing facts).
// AgenticCore Pakistan prices and packages come from the published price
// list (services/pk-catalog.mjs) and are quoted word for word; approvals,
// legal status and availability are never stated unless in site data.

export const KNOWLEDGE = `
AGENTICCORE ESTATE (agenticcore.estate)
- A property marketplace for Islamabad, Rawalpindi, Lahore, Karachi, Sialkot and Faisalabad ("Serving 6 cities across Pakistan").
- Lahore, Karachi, Sialkot and Faisalabad open on Tuesday 6 October 2026. Before that date people in those cities can already sign up and list free; their listings show publicly from 6 October. Islamabad and Rawalpindi are live now.
- AgenticCore Pakistan marketing services are available in all six cities (from 6 October in Lahore, Karachi, Sialkot and Faisalabad).
- Five directories: Properties (to buy or rent), Projects, Property professionals, Agencies, Builders & developers.
- Listing a property is free during the launch period. Creating a professional, agency or builder/developer profile is free. Project listing is free during launch too (project accounts are reviewed first). There is nothing to buy on Estate yet.
- Estate marketplace packages are planned from 1 November 2026. They are not available yet and their prices have not been announced — never guess them.
- 30% early-participant benefit: people who join during the free launch period and create genuine marketplace content (a property, project or profile) before packages launch are eligible for 30% off their first two months of qualifying Estate marketplace packages once they launch. The date is recorded automatically and shown in the dashboard; sample content never qualifies.
- One AgenticCore account works on both AgenticCore Estate and AgenticCore Pakistan.
- Anyone can list a property after signing up. The owner reviews the form before publishing.
- Projects: any account can apply to publish projects; a project goes live only after the AgenticCore team reviews and approves the application.
- Some entries are marked "Sample". They are examples only — not real listings or businesses — and cannot be contacted.
- Contacting a seller: a visitor signs in, then either sees the owner's public contact number (only if the owner chose to publish one) or sends an enquiry. Login phone numbers are never shown.
- Badges: "Checked" means AgenticCore reviewed the listing information; it is not a title, ownership or legal verification. "Confirmed available" means the owner confirmed in the last 30 days that it is still available.
- AgenticCore does not verify property titles, NOCs or government approvals. Approvals shown on projects are as stated by the developer. Always check documents with your own lawyer before paying.
- Free tools for owners: listing quality score, Toolkit share cards (4:5, square, QR) with English and Roman Urdu WhatsApp captions, a printable A4 property sheet, and an owner dashboard with enquiries and next steps.
- Professionals can be "associated with" agencies, and agencies can represent projects. This does not mean employment or exclusivity.

AGENTICCORE PAKISTAN (agenticcorepk.com)
- A separate, paid marketing and technology service for property businesses. Its services are NOT included free with Estate.
- Four service areas: property marketing for agents and agencies (WhatsApp cards, social posts, flyers, photo enhancement, reels, branding kits, agency websites, Google Business Profile, paid ads); project marketing for builders and developers (project branding, brochures, landing pages, project websites, launch campaigns, videos, plot maps, buyer and dealer portals); AI and automation (WhatsApp enquiry bots, website AI assistants, auto-posting, CRM and lead routing); and specialist add-ons.
- Monthly plans for agents, agencies and projects, and one-off launch kits for new agencies and new projects. Delivery runs 7 days a week.
- Owners can send an Estate listing to AgenticCore Pakistan to order promotion for it.
- Prices are published on the AgenticCore Pakistan services page and in the PRICE LIST below. Quote them exactly; custom or larger work is quoted by the team.
- To order: on the website, Amaan can take the request with photos, videos, logos or documents (the 📎 button, after signing in) and send it to the AgenticCore team with "Send to AgenticCore team"; or order in the dashboard on agenticcorepk.com; or in Telegram with /order. Nothing starts until the client and the team confirm.

TELEGRAM
- The AgenticCore Telegram bot (@AgenticcoreEstatebot) opens an account, lists a property step by step (with photos), shows your listings, sends a one-time website sign-in link and takes AgenticCore Pakistan orders (/order). It understands typed messages and voice notes in Urdu and English.

WHO DOES WHAT
- The AgenticCore AI Assistant (small gold window) answers general questions: what AgenticCore is, prices, packages, profiles, how things work.
- Amaan (full-screen chat) finds genuine listings, helps owners list a property, and takes marketing or project orders with files and sends them to the team.

CONTACT
- WhatsApp chat with the AgenticCore team, business email, and the AgenticCore WhatsApp Channel (for updates). Also on YouTube, TikTok, Facebook and Instagram.
`.trim();

// Buttons an assistant may offer. The browser maps each key to a URL for the
// site it runs on, so a model can never inject a link.
export const ACTIONS = [
  'amaan_find', 'amaan_list', 'amaan_order', 'ask_guide',
  'estate_home', 'estate_properties', 'estate_buy', 'estate_rent', 'estate_projects', 'estate_professionals', 'estate_agencies', 'estate_builders',
  'estate_list', 'estate_pricing', 'estate_dashboard', 'estate_signup',
  'join_professional', 'join_agency', 'join_builder', 'join_developer',
  'pk_home', 'pk_services', 'pk_branding', 'pk_print', 'pk_websites', 'pk_video', 'pk_social', 'pk_campaigns', 'pk_leads', 'pk_local',
  'pk_logo', 'pk_agent_branding', 'pk_brochure', 'pk_website', 'pk_landing', 'pk_photos', 'pk_launch',
  'contact_whatsapp', 'contact_email', 'whatsapp_channel'
];

// Topic detection — English, Roman Urdu and Urdu keywords.
export const TOPICS = [
  { id: 'human', words: ['human', 'real person', 'talk to someone', 'customer care', 'support team', 'insaan', 'banday se', 'kisi se baat', 'انسان', 'نمائندہ'] },
  { id: 'contact', words: ['contact', 'whatsapp', 'email', 'phone number of agenticcore', 'call you', 'reach you', 'rabta', 'raabta', 'رابطہ', 'ای میل', 'واٹس ایپ'] },
  { id: 'pk_service', words: ['website', 'web site', 'brochure', 'logo', 'branding', 'marketing', 'market my', 'promote', 'promotion', 'advert', 'ads', 'campaign', 'social media', 'reel', 'video', 'photo enhancement', 'landing page', 'leads', 'tashheer', 'tashhir', 'ویب سائٹ', 'بروشر', 'لوگو', 'مارکیٹنگ', 'تشہیر', 'اشتہار', 'ویڈیو'] },
  { id: 'pricing', words: ['package', 'packages', 'fee', 'fees', 'charges', 'subscription', 'how much', 'cost', 'costs', 'price', 'prices', 'rate', 'rates', 'pricing', 'paid plan', 'kitne', 'kitne paise', 'kitna kharcha', 'kitne ka', 'kitne ki', 'qeemat', 'keemat', 'rate kya', 'fees kya', 'قیمت', 'کتنے', 'کتنا', 'ریٹ', 'فیس', 'چارجز', 'پیکج', 'خرچہ'] },
  { id: 'trust', words: ['verify', 'verified', 'verification', 'noc', 'title', 'fraud', 'scam', 'fake', 'genuine', 'safe', 'legal', 'dhoka', 'asli', 'jaali', 'تصدیق', 'دھوکہ', 'جعلی', 'قانونی'] },
  { id: 'samples', words: ['sample', 'example listing', 'examples', 'namoona', 'نمونہ'] },
  { id: 'project', words: ['project', 'projects', 'housing scheme', 'society', 'off plan', 'off-plan', 'publish project', 'پروجیکٹ', 'سوسائٹی'] },
  { id: 'builder', words: ['builder', 'construction company', 'contractor', 'developer company', 'thekedar', 'tameer', 'بلڈر', 'تعمیر', 'ٹھیکیدار', 'ڈویلپر'] },
  { id: 'agency', words: ['agency', 'agencies', 'real estate company', 'estate office', 'ایجنسی'] },
  { id: 'professional', words: ['agent', 'consultant', 'dealer', 'professional', 'realtor', 'broker', 'property advisor', 'ایجنٹ', 'ڈیلر', 'کنسلٹنٹ', 'پروفیشنل'] },
  { id: 'list', words: ['list my', 'list a', 'list property', 'post an ad', 'post my', 'sell my', 'want to sell', 'rent out', 'bechna', 'bechni', 'farokht', 'list karna', 'list karni', 'kiraye pe dena', 'kiraye par dena', 'لسٹ', 'بیچنا', 'فروخت', 'کرائے پر دینا'] },
  { id: 'find', words: ['find', 'search', 'looking for', 'show me', 'buy', 'for rent', 'house', 'flat', 'apartment', 'plot', 'kanal', 'marla', 'chahiye', 'dhoond', 'dikhao', 'ghar', 'makan', 'kiraye', 'خریدنا', 'گھر', 'مکان', 'فلیٹ', 'پلاٹ', 'مرلہ', 'کنال', 'چاہیے', 'کرایہ'] },
  { id: 'account', words: ['login', 'log in', 'sign up', 'signup', 'register', 'account', 'password', 'dashboard', 'اکاؤنٹ', 'لاگ ان'] },
  { id: 'pk', words: ['agenticcore pakistan', 'agenticcorepk', 'pk site', 'difference between'] },
  { id: 'about', words: ['what is agenticcore', 'what is this', 'about', 'who are you', 'kya hai', 'kya karta', 'کیا ہے', 'کون ہو'] },
  { id: 'greeting', words: ['hello', 'hi', 'salam', 'assalam', 'aoa', 'hey', 'سلام', 'السلام'] }
];

// Deterministic answers — used for quick-action buttons and whenever the AI
// is unavailable, times out, or returns something that fails a check.
// Keys: en (English), ur (Urdu script), ro (Roman Urdu).
export const ANSWERS = {
  greeting: {
    en: 'Hello! I can explain AgenticCore Estate and AgenticCore Pakistan, help you find your way around, or connect you with our team. What would you like to do?',
    ur: 'السلام علیکم! میں AgenticCore Estate اور AgenticCore Pakistan کے بارے میں بتا سکتا ہوں، ویب سائٹ پر رہنمائی کر سکتا ہوں، یا آپ کو ہماری ٹیم سے ملوا سکتا ہوں۔ آپ کیا کرنا چاہیں گے؟',
    ro: 'Assalam-o-Alaikum! Main AgenticCore Estate aur AgenticCore Pakistan ke baare mein bata sakta hoon, website par rehnumai kar sakta hoon, ya aap ko hamari team se milwa sakta hoon. Aap kya karna chahenge?',
    actions: ['amaan_find', 'amaan_list', 'pk_services']
  },
  about: {
    en: 'AgenticCore Estate is a property marketplace serving 6 cities across Pakistan — Islamabad, Rawalpindi, Lahore, Karachi, Sialkot and Faisalabad (the last four from 6 October 2026): properties to buy or rent, projects, property professionals, agencies and builders. AgenticCore Pakistan is our separate, paid marketing and technology service for property businesses.',
    ur: 'AgenticCore Estate پاکستان کے 6 شہروں — اسلام آباد، راولپنڈی، لاہور، کراچی، سیالکوٹ اور فیصل آباد (آخری چار 6 اکتوبر 2026 سے) — کی پراپرٹی مارکیٹ پلیس ہے: خریدنے یا کرائے کے لیے پراپرٹی، پروجیکٹس، پراپرٹی پروفیشنلز، ایجنسیاں اور بلڈرز۔ AgenticCore Pakistan ہماری الگ، معاوضے والی مارکیٹنگ اور ٹیکنالوجی سروس ہے۔',
    ro: 'AgenticCore Estate Pakistan ke 6 shehron — Islamabad, Rawalpindi, Lahore, Karachi, Sialkot aur Faisalabad (aakhri chaar 6 October 2026 se) — ki property marketplace hai: khareedne ya kiraye ke liye property, projects, property professionals, agencies aur builders. AgenticCore Pakistan hamari alag, paid marketing aur technology service hai.',
    actions: ['estate_properties', 'amaan_find', 'pk_services']
  },
  pk: {
    en: 'AgenticCore Estate is where property is listed and found. AgenticCore Pakistan is a separate, paid service that creates marketing — branding, brochures, websites, video, social media and campaigns. PK services are not included free with Estate.',
    ur: 'AgenticCore Estate پر پراپرٹی لسٹ کی جاتی اور تلاش کی جاتی ہے۔ AgenticCore Pakistan ایک الگ، معاوضے والی سروس ہے جو مارکیٹنگ تیار کرتی ہے — برانڈنگ، بروشر، ویب سائٹ، ویڈیو، سوشل میڈیا اور کیمپینز۔ یہ سروسز Estate کے ساتھ مفت شامل نہیں۔',
    ro: 'AgenticCore Estate par property list aur talaash hoti hai. AgenticCore Pakistan ek alag, paid service hai jo marketing banati hai — branding, brochure, website, video, social media aur campaigns. PK ki services Estate ke saath free shamil nahin.',
    actions: ['pk_services', 'estate_home']
  },
  find: {
    en: 'Amaan, our AI property assistant, can search genuine listings for you. Tell Amaan the area, budget, size or bedrooms — for example "10 marla house in Rawalpindi under 4 crore".',
    ur: 'ہمارا AI پراپرٹی اسسٹنٹ امان آپ کے لیے اصل لسٹنگز تلاش کر سکتا ہے۔ امان کو علاقہ، بجٹ، سائز یا کمرے بتائیں — مثلاً "راولپنڈی میں 4 کروڑ تک 10 مرلہ گھر"۔',
    ro: 'Hamara AI property assistant Amaan aap ke liye asli listings dhoond sakta hai. Amaan ko area, budget, size ya kamre batayein — maslan "Rawalpindi mein 4 crore tak 10 marla ghar".',
    actions: ['amaan_find', 'estate_properties']
  },
  list: {
    en: 'Listing a property is free during the launch period. Amaan can collect the details with you step by step, then you review everything in the listing form before publishing.',
    ur: 'لانچ کے دوران پراپرٹی لسٹ کرنا مفت ہے۔ امان آپ کے ساتھ مرحلہ وار تفصیلات جمع کر سکتا ہے، پھر شائع کرنے سے پہلے آپ لسٹنگ فارم میں سب کچھ خود دیکھ لیتے ہیں۔',
    ro: 'Launch ke dauran property list karna free hai. Amaan aap ke saath qadam ba qadam details jama kar sakta hai, phir publish karne se pehle aap listing form mein sab kuch khud check kar lete hain.',
    actions: ['amaan_list', 'estate_list']
  },
  professional: {
    en: 'Agents and consultants can create a free professional profile — with or without listings — so clients can find them by area and services. You can also be associated with an agency.',
    ur: 'ایجنٹس اور کنسلٹنٹس مفت پروفیشنل پروفائل بنا سکتے ہیں — لسٹنگ کے ساتھ یا بغیر — تاکہ کلائنٹس انہیں علاقے اور سروسز کے لحاظ سے ڈھونڈ سکیں۔ آپ کسی ایجنسی سے منسلک بھی ہو سکتے ہیں۔',
    ro: 'Agents aur consultants free professional profile bana sakte hain — listings ke saath ya baghair — taake clients unhein area aur services ke hisaab se dhoond sakein. Aap kisi agency se associated bhi ho sakte hain.',
    actions: ['join_professional', 'estate_professionals']
  },
  agency: {
    en: 'An agency profile is free. It shows your agency, its associated professionals and its listings in one place, and lets you list property under the agency.',
    ur: 'ایجنسی پروفائل مفت ہے۔ اس میں آپ کی ایجنسی، اس سے منسلک پروفیشنلز اور اس کی لسٹنگز ایک جگہ نظر آتی ہیں، اور آپ ایجنسی کے نام سے پراپرٹی لسٹ کر سکتے ہیں۔',
    ro: 'Agency profile free hai. Is mein aap ki agency, us se associated professionals aur us ki listings ek jagah nazar aati hain, aur aap agency ke naam se property list kar sakte hain.',
    actions: ['join_agency', 'estate_agencies']
  },
  builder: {
    en: 'Builders and developers can create a free company profile with their services, areas and any rates they choose to share. Publishing projects needs a short review by the AgenticCore team.',
    ur: 'بلڈرز اور ڈویلپرز اپنی سروسز، علاقوں اور اپنی مرضی کے ریٹس کے ساتھ مفت کمپنی پروفائل بنا سکتے ہیں۔ پروجیکٹس شائع کرنے کے لیے AgenticCore ٹیم کا مختصر جائزہ ضروری ہے۔',
    ro: 'Builders aur developers apni services, areas aur apni marzi ke rates ke saath free company profile bana sakte hain. Projects publish karne ke liye AgenticCore team ka mukhtasar review zaroori hai.',
    actions: ['join_builder', 'estate_builders']
  },
  project: {
    en: 'Any account can apply to publish projects. A project goes live only after the AgenticCore team reviews and approves the application. Approvals shown on a project are as stated by the developer.',
    ur: 'کوئی بھی اکاؤنٹ پروجیکٹس شائع کرنے کی درخواست دے سکتا ہے۔ پروجیکٹ AgenticCore ٹیم کے جائزے اور منظوری کے بعد ہی لائیو ہوتا ہے۔ پروجیکٹ پر دکھائی گئی منظوریاں ڈویلپر کے بیان کے مطابق ہوتی ہیں۔',
    ro: 'Koi bhi account projects publish karne ki darkhwast de sakta hai. Project AgenticCore team ke review aur approval ke baad hi live hota hai. Project par dikhayi gayi approvals developer ke bayan ke mutabiq hoti hain.',
    actions: ['join_developer', 'estate_projects']
  },
  pk_service: {
    en: 'Branding, brochures, websites, video, social media and campaigns are offered by AgenticCore Pakistan — a separate, paid service. You can see each service and its published price on the PK services page.',
    ur: 'برانڈنگ، بروشر، ویب سائٹ، ویڈیو، سوشل میڈیا اور کیمپینز AgenticCore Pakistan فراہم کرتا ہے — یہ الگ، معاوضے والی سروس ہے۔ ہر سروس اور اس کی شائع شدہ قیمت PK کے سروسز پیج پر دیکھیں۔',
    ro: 'Branding, brochure, website, video, social media aur campaigns AgenticCore Pakistan deta hai — yeh alag, paid service hai. Har service aur us ki published qeemat PK ke services page par dekhein.',
    actions: ['pk_services', 'contact_whatsapp']
  },
  pricing: {
    en: 'Everything on AgenticCore Estate is free during the launch period — listings, projects and profiles. Estate marketplace packages are planned from 1 November 2026 (prices not announced yet), and people who join now are eligible for 30% off their first two months. AgenticCore Pakistan marketing services have published prices — tell me what you need (for example a logo, a 3D floor plan or a website) and I\'ll give you the exact price.',
    ur: 'لانچ کے دوران AgenticCore Estate پر سب کچھ مفت ہے — لسٹنگز، پروجیکٹس اور پروفائلز۔ Estate مارکیٹ پلیس پیکجز 1 نومبر 2026 سے متوقع ہیں (قیمتوں کا اعلان ابھی نہیں ہوا)، اور ابھی شامل ہونے والے پہلے دو مہینوں پر 30% رعایت کے اہل ہوں گے۔ AgenticCore Pakistan کی مارکیٹنگ سروسز کی قیمتیں شائع شدہ ہیں — بتائیں آپ کو کیا چاہیے (مثلاً لوگو، تھری ڈی فلور پلان یا ویب سائٹ)، میں آپ کو درست قیمت بتا دوں گا۔',
    ro: 'Launch ke dauran AgenticCore Estate par sab kuch free hai — listings, projects aur profiles. Estate marketplace packages 1 November 2026 se mutawaqqe hain (qeematon ka elaan abhi nahin hua), aur abhi join karne wale pehle do mahinon par 30% discount ke ahal honge. AgenticCore Pakistan ki marketing services ki qeematein published hain — batayein aap ko kya chahiye (maslan logo, 3D floor plan ya website), main aap ko durust qeemat bata dunga.',
    actions: ['pk_services', 'estate_pricing', 'amaan_order']
  },
  trust: {
    en: 'AgenticCore does not verify property titles, NOCs or government approvals. "Checked" only means we reviewed the listing information. Always check documents with your own lawyer and the relevant authority before paying.',
    ur: 'AgenticCore پراپرٹی کے ملکیتی کاغذات، NOC یا سرکاری منظوری کی تصدیق نہیں کرتا۔ "Checked" کا مطلب صرف یہ ہے کہ ہم نے لسٹنگ کی معلومات دیکھی ہیں۔ ادائیگی سے پہلے ہمیشہ اپنے وکیل اور متعلقہ ادارے سے کاغذات چیک کروائیں۔',
    ro: 'AgenticCore property ke title, NOC ya sarkari approval ki tasdeeq nahin karta. "Checked" ka matlab sirf yeh hai ke humne listing ki maloomat dekhi hain. Payment se pehle hamesha apne wakeel aur mutaliqa idaray se kaghzaat check karwayein.',
    actions: ['estate_properties']
  },
  samples: {
    en: 'Entries marked "Sample" are examples that show how the marketplace works. They are not real listings or businesses and cannot be contacted.',
    ur: '"Sample" والی اندراجات صرف مثالیں ہیں جو دکھاتی ہیں کہ مارکیٹ پلیس کیسے کام کرتی ہے۔ یہ اصل لسٹنگز یا کاروبار نہیں اور ان سے رابطہ نہیں ہو سکتا۔',
    ro: '"Sample" wali entries sirf misalein hain jo dikhati hain ke marketplace kaise kaam karti hai. Yeh asli listings ya business nahin aur in se rabta nahin ho sakta.',
    actions: ['estate_properties']
  },
  account: {
    en: 'One AgenticCore account works on both sites. Sign up with your phone, email and a password; your dashboard then shows your listings, profiles, enquiries and next steps.',
    ur: 'ایک AgenticCore اکاؤنٹ دونوں ویب سائٹس پر چلتا ہے۔ فون، ای میل اور پاس ورڈ سے سائن اپ کریں؛ پھر ڈیش بورڈ میں آپ کی لسٹنگز، پروفائلز، پیغامات اور اگلے اقدامات نظر آتے ہیں۔',
    ro: 'Ek AgenticCore account dono websites par chalta hai. Phone, email aur password se sign up karein; phir dashboard mein aap ki listings, profiles, enquiries aur agle steps nazar aate hain.',
    actions: ['estate_signup', 'estate_dashboard']
  },
  contact: {
    en: 'You can chat with the AgenticCore team on WhatsApp or email us. To follow our updates, join the AgenticCore WhatsApp Channel.',
    ur: 'آپ AgenticCore ٹیم سے واٹس ایپ پر بات کر سکتے ہیں یا ای میل کر سکتے ہیں۔ ہماری اپ ڈیٹس کے لیے AgenticCore واٹس ایپ چینل جوائن کریں۔',
    ro: 'Aap AgenticCore team se WhatsApp par baat kar sakte hain ya email kar sakte hain. Hamari updates ke liye AgenticCore WhatsApp Channel join karein.',
    actions: ['contact_whatsapp', 'contact_email', 'whatsapp_channel']
  },
  human: {
    en: 'I\'m an AI assistant. For a person from the AgenticCore team, message us on WhatsApp or send an email — nothing is sent until you choose to.',
    ur: 'میں ایک AI اسسٹنٹ ہوں۔ AgenticCore ٹیم کے کسی فرد سے بات کے لیے واٹس ایپ پر پیغام بھیجیں یا ای میل کریں — آپ کے بھیجے بغیر کچھ نہیں جاتا۔',
    ro: 'Main ek AI assistant hoon. AgenticCore team ke kisi insaan se baat ke liye WhatsApp par message karein ya email bhejein — aap ke bheje baghair kuch nahin jata.',
    actions: ['contact_whatsapp', 'contact_email']
  },
  unknown: {
    en: 'I\'m not sure I have the right information for that. I can help with finding or listing property, profiles for professionals, agencies and builders, projects, or AgenticCore Pakistan services — or you can ask our team directly.',
    ur: 'مجھے یقین نہیں کہ میرے پاس اس کی درست معلومات ہیں۔ میں پراپرٹی تلاش یا لسٹ کرنے، پروفیشنلز، ایجنسیوں اور بلڈرز کی پروفائلز، پروجیکٹس، یا AgenticCore Pakistan کی سروسز میں مدد کر سکتا ہوں — یا آپ براہ راست ہماری ٹیم سے پوچھ لیں۔',
    ro: 'Mujhe yaqeen nahin ke mere paas is ki durust maloomat hai. Main property dhoondne ya list karne, professionals, agencies aur builders ki profiles, projects, ya AgenticCore Pakistan ki services mein madad kar sakta hoon — ya aap seedha hamari team se pooch lein.',
    actions: ['amaan_find', 'amaan_list', 'contact_whatsapp']
  }
};

// Amaan's fixed phrases (deterministic path and fallbacks).
export const AMAAN = {
  intro: {
    en: 'I\'m Amaan, AgenticCore\'s AI property assistant. I can search genuine listings or help you list a property. What are you looking for?',
    ur: 'میں امان ہوں، AgenticCore کا AI پراپرٹی اسسٹنٹ۔ میں اصل لسٹنگز تلاش کر سکتا ہوں یا پراپرٹی لسٹ کرنے میں مدد کر سکتا ہوں۔ آپ کیا ڈھونڈ رہے ہیں؟',
    ro: 'Main Amaan hoon, AgenticCore ka AI property assistant. Main asli listings dhoond sakta hoon ya property list karne mein madad kar sakta hoon. Aap kya dhoond rahe hain?'
  },
  find_ask: {
    en: 'Tell me what you\'re looking for — the area or city, your budget, and the size or number of bedrooms.',
    ur: 'بتائیں آپ کیا ڈھونڈ رہے ہیں — علاقہ یا شہر، بجٹ، اور سائز یا کمروں کی تعداد۔',
    ro: 'Batayein aap kya dhoond rahe hain — area ya shehar, budget, aur size ya kamron ki tadaad.'
  },
  found: {
    en: 'I found {n} genuine listings that match what you asked for.',
    ur: 'آپ کی تلاش کے مطابق {n} اصل لسٹنگز ملی ہیں۔',
    ro: 'Aap ki talaash ke mutabiq {n} asli listings mili hain.'
  },
  found_one: {
    en: 'I found 1 genuine listing that matches what you asked for.',
    ur: 'آپ کی تلاش کے مطابق ایک اصل لسٹنگ ملی ہے۔',
    ro: 'Aap ki talaash ke mutabiq 1 asli listing mili hai.'
  },
  closest: {
    en: 'Nothing matches everything yet. Here are the closest genuine listings, with how each one differs.',
    ur: 'ابھی کوئی لسٹنگ ہر شرط پر پوری نہیں اترتی۔ یہ قریب ترین اصل لسٹنگز ہیں، ہر ایک کا فرق ساتھ لکھا ہے۔',
    ro: 'Abhi koi listing har shart par poori nahin utarti. Yeh qareeb tareen asli listings hain, har ek ka farq saath likha hai.'
  },
  none: {
    en: 'There are no genuine listings like this on AgenticCore Estate yet. Try a wider area or budget, or browse all properties.',
    ur: 'ابھی AgenticCore Estate پر ایسی کوئی اصل لسٹنگ نہیں۔ علاقہ یا بجٹ تھوڑا بڑھا کر دیکھیں، یا تمام پراپرٹیز دیکھیں۔',
    ro: 'Abhi AgenticCore Estate par aisi koi asli listing nahin. Area ya budget thora barha kar dekhein, ya saari properties dekhein.'
  },
  list_start: {
    en: 'Happy to help you list it. Tell me about the property — type, area, size, price, and bedrooms if it\'s a house or flat.',
    ur: 'میں لسٹ کرنے میں ضرور مدد کروں گا۔ پراپرٹی کے بارے میں بتائیں — قسم، علاقہ، سائز، قیمت، اور اگر گھر یا فلیٹ ہے تو کمرے۔',
    ro: 'Main list karne mein zaroor madad karunga. Property ke baare mein batayein — qisam, area, size, qeemat, aur agar ghar ya flat hai to kamre.'
  },
  list_on_estate: {
    en: 'Listing happens on AgenticCore Estate, and it\'s free during the launch period. Open Estate and I\'ll collect the details with you there, step by step.',
    ur: 'لسٹنگ AgenticCore Estate پر ہوتی ہے، اور لانچ کے دوران مفت ہے۔ Estate کھولیں، میں وہاں آپ کے ساتھ مرحلہ وار تفصیلات جمع کروں گا۔',
    ro: 'Listing AgenticCore Estate par hoti hai, aur launch ke dauran free hai. Estate kholein, main wahan aap ke saath qadam ba qadam details jama karunga.'
  },
  list_ready: {
    en: 'Thanks — I have the main details. Next, log in — or create a free account if you don\'t have one. Your details stay on this device, and the listing form opens filled in for you to check, add photos and publish. Nothing is published until you submit it.',
    ur: 'شکریہ — بنیادی تفصیلات مل گئی ہیں۔ اب لاگ ان کریں — یا اگر اکاؤنٹ نہیں ہے تو مفت اکاؤنٹ بنائیں۔ آپ کی تفصیلات اسی ڈیوائس پر محفوظ رہیں گی، اور لسٹنگ فارم بھرا ہوا کھلے گا تاکہ آپ چیک کریں، تصاویر لگائیں اور شائع کریں۔ آپ کے جمع کرائے بغیر کچھ شائع نہیں ہوتا۔',
    ro: 'Shukriya — buniyadi details mil gayi hain. Ab log in karein — ya agar account nahin hai to free account banayein. Aap ki details isi device par mehfooz rahengi, aur listing form bhara hua khulega taake aap check karein, tasveerein lagayein aur publish karein. Aap ke submit kiye baghair kuch publish nahin hota.'
  },
  // the area is in more than one city (Bahria Town / DHA phases, Gulberg…)
  city_which: {
    en: '{area} — is that in {options}?', ur: '{area} — یہ {options} میں ہے؟', ro: '{area} — yeh {options} mein hai?'
  },
  // a city that opens on 6 October 2026 (shown only before that date)
  launching: {
    en: 'We launch in {city} on 6 October. You can create your account and list your property now; the listing will show from launch day.',
    ur: 'ہم 6 اکتوبر کو {city} میں لانچ کر رہے ہیں۔ آپ ابھی اکاؤنٹ بنا کر پراپرٹی لسٹ کر سکتے ہیں، لسٹنگ لانچ کے دن سے نظر آئے گی۔',
    ro: 'Hum 6 October ko {city} mein launch kar rahe hain. Aap abhi account bana kar property list kar sakte hain, listing launch ke din se show hogi.'
  },
  place: {
    en: '{area} is in {city}.', ur: '{area} {city} میں ہے۔', ro: '{area} {city} mein hai.'
  },
  place_both: {
    en: '{area} is listed under {options} — tell me which one yours is.', ur: '{area} {options} دونوں میں آتا ہے — بتائیں آپ کا کون سا ہے۔', ro: '{area} {options} dono mein aata hai — batayein aap ka kaunsa hai.'
  },
  ask: {
    purpose: { en: 'Is it for sale or for rent?', ur: 'یہ فروخت کے لیے ہے یا کرائے پر؟', ro: 'Yeh bechne ke liye hai ya kiraye par?' },
    property_type: { en: 'What type of property is it — house, flat, plot, shop or something else?', ur: 'پراپرٹی کس قسم کی ہے — گھر، فلیٹ، پلاٹ، دکان یا کچھ اور؟', ro: 'Property kis qisam ki hai — ghar, flat, plot, dukaan ya kuch aur?' },
    city: { en: 'Which city is it in — Islamabad, Rawalpindi, Lahore, Karachi, Sialkot or Faisalabad?', ur: 'یہ کس شہر میں ہے — اسلام آباد، راولپنڈی، لاہور، کراچی، سیالکوٹ یا فیصل آباد؟', ro: 'Yeh kis shehar mein hai — Islamabad, Rawalpindi, Lahore, Karachi, Sialkot ya Faisalabad?' },
    area: { en: 'Which area exactly — society, phase, block or sector?', ur: 'بالکل کون سا علاقہ — سوسائٹی، فیز، بلاک یا سیکٹر؟', ro: 'Bilkul kaunsa area — society, phase, block ya sector?' },
    price: { en: 'What is your asking price (or monthly rent)?', ur: 'آپ کی مانگی گئی قیمت (یا ماہانہ کرایہ) کیا ہے؟', ro: 'Aap ki demand (ya mahana kiraya) kya hai?' },
    size: { en: 'What is the size — in marla, kanal or square feet?', ur: 'سائز کیا ہے — مرلہ، کنال یا مربع فٹ میں؟', ro: 'Size kya hai — marla, kanal ya square feet mein?' },
    beds: { en: 'How many bedrooms does it have?', ur: 'اس میں کتنے بیڈ روم ہیں؟', ro: 'Is mein kitne bedroom hain?' },
    baths: { en: 'And how many bathrooms?', ur: 'اور کتنے باتھ روم؟', ro: 'Aur kitne bathroom?' }
  }
};
