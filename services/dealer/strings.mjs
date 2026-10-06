// AgenticCore Dealer AI — every message the bot sends, in English, Urdu and
// Roman Urdu. Replies are always text (never voice).

const S = {
  choose_lang: {
    en: 'Welcome to AgenticCore Dealer AI 👋\nPlease choose your language:',
    ur: 'AgenticCore Dealer AI میں خوش آمدید 👋\nاپنی زبان منتخب کریں:',
    ro: 'AgenticCore Dealer AI mein khush aamdeed 👋\nApni zabaan chunein:'
  },
  intro: {
    en: 'Here dealers and owners post properties as text (no photos), and buyers search them by just typing what they need.\n\nLet\'s register you first. What is your name?',
    ur: 'یہاں ڈیلر اور مالکان پراپرٹی تحریری طور پر (بغیر تصویر) پوسٹ کرتے ہیں، اور خریدار صرف اپنی ضرورت لکھ کر تلاش کرتے ہیں۔\n\nپہلے آپ کی رجسٹریشن کر لیتے ہیں۔ آپ کا نام کیا ہے؟',
    ro: 'Yahan dealers aur owners property text mein (baghair photo) post karte hain, aur buyers sirf apni zaroorat likh kar dhoondte hain.\n\nPehle aap ki registration kar lete hain. Aap ka naam kya hai?'
  },
  bad_name: {
    en: 'Please type your name (2 to 80 letters).',
    ur: 'براہ کرم اپنا نام لکھیں (2 سے 80 حروف)۔',
    ro: 'Meharbani kar ke apna naam likhein (2 se 80 huroof).'
  },
  ask_contact: {
    en: 'Thanks {name}. Now tap the button below to share your phone number (Telegram confirms it is yours).',
    ur: 'شکریہ {name}۔ اب نیچے والا بٹن دبا کر اپنا فون نمبر شیئر کریں (ٹیلیگرام تصدیق کرتا ہے کہ نمبر آپ کا ہے)۔',
    ro: 'Shukriya {name}. Ab neeche wala button daba kar apna phone number share karein (Telegram confirm karta hai ke number aap ka hai).'
  },
  contact_btn: { en: '📱 Share my phone number', ur: '📱 اپنا نمبر شیئر کریں', ro: '📱 Apna number share karein' },
  contact_not_own: {
    en: 'Please share your own number with the button below.',
    ur: 'براہ کرم نیچے والے بٹن سے اپنا ہی نمبر شیئر کریں۔',
    ro: 'Meharbani kar ke neeche wale button se apna hi number share karein.'
  },
  ask_role: {
    en: 'Last step: which describes you?',
    ur: 'آخری مرحلہ: آپ کون ہیں؟',
    ro: 'Aakhri step: aap kaun hain?'
  },
  role_owner: { en: '🏠 Owner', ur: '🏠 مالک', ro: '🏠 Owner (malik)' },
  role_dealer: { en: '🤝 Dealer', ur: '🤝 ڈیلر', ro: '🤝 Dealer' },
  role_buyer: { en: '🔎 Buyer', ur: '🔎 خریدار', ro: '🔎 Buyer (khareedar)' },
  phone_taken: {
    en: 'This number is already registered with another Telegram account. Please contact the AgenticCore team.',
    ur: 'یہ نمبر پہلے ہی کسی دوسرے ٹیلیگرام اکاؤنٹ سے رجسٹرڈ ہے۔ براہ کرم AgenticCore ٹیم سے رابطہ کریں۔',
    ro: 'Yeh number pehle hi kisi aur Telegram account se registered hai. Meharbani kar ke AgenticCore team se raabta karein.'
  },
  registered: {
    en: '✅ You are registered, {name}.',
    ur: '✅ {name}، آپ کی رجسٹریشن ہو گئی۔',
    ro: '✅ {name}, aap ki registration ho gayi.'
  },
  menu: {
    en: 'What would you like to do?\n\nTip: just type, e.g. "5 marla house G-13 under 2.5 crore" to search, or "House for sale G-13/2, 5 marla, demand 2.4 crore" to post. Voice notes work too.',
    ur: 'آپ کیا کرنا چاہیں گے؟\n\nمشورہ: بس لکھیں، جیسے "جی 13 میں 5 مرلہ گھر چاہیے ڈھائی کروڑ تک" تلاش کے لیے، یا "جی 13/2 میں 5 مرلہ گھر برائے فروخت، ڈیمانڈ 2.4 کروڑ" پوسٹ کے لیے۔ وائس نوٹ بھی بھیج سکتے ہیں۔',
    ro: 'Aap kya karna chahenge?\n\nTip: bas likhein, jaise "G-13 mein 5 marla ghar chahiye 2.5 crore tak" search ke liye, ya "G-13/2 mein 5 marla ghar for sale, demand 2.4 crore" post ke liye. Voice note bhi bhej sakte hain.'
  },
  btn_add: { en: '➕ Post a property', ur: '➕ پراپرٹی پوسٹ کریں', ro: '➕ Property post karein' },
  btn_search: { en: '🔎 Search', ur: '🔎 تلاش', ro: '🔎 Search' },
  btn_mine: { en: '📋 My entries', ur: '📋 میری پوسٹس', ro: '📋 Meri entries' },
  btn_reqs: { en: '🔔 My requests', ur: '🔔 میری درخواستیں', ro: '🔔 Meri requests' },
  btn_help: { en: '❓ Help', ur: '❓ مدد', ro: '❓ Madad' },
  btn_lang: { en: '🌐 Language', ur: '🌐 زبان', ro: '🌐 Zabaan' },
  help: {
    en: 'AgenticCore Dealer AI\n• Post: sale or rent, text only, live for 30 days (renew any time).\n• Search: type what you need; if nothing matches we look for 24 hours and send you results.\n• Contact numbers: tap "Contact" on a result ({limit} per day).\n• Everything here is user-submitted and not verified. Always check ownership papers, NOC and approvals yourself before paying anything.\n• Report wrong or fake entries with 🚩.\n\nCommands: /post /search /mine /requests /name /language /cancel',
    ur: 'AgenticCore Dealer AI\n• پوسٹ: فروخت یا کرایہ، صرف تحریر، 30 دن کے لیے (کسی بھی وقت رینیو کریں)۔\n• تلاش: اپنی ضرورت لکھیں؛ اگر کچھ نہ ملے تو ہم 24 گھنٹے تلاش کر کے نتائج بھیجتے ہیں۔\n• رابطہ نمبر: نتیجے پر "رابطہ" دبائیں (روزانہ {limit})۔\n• یہاں ہر چیز صارفین کی دی ہوئی ہے اور تصدیق شدہ نہیں۔ کوئی بھی رقم دینے سے پہلے ملکیت کے کاغذات، NOC اور منظوری خود چیک کریں۔\n• غلط یا جعلی پوسٹ کی 🚩 سے رپورٹ کریں۔\n\nکمانڈز: /post /search /mine /requests /name /language /cancel',
    ro: 'AgenticCore Dealer AI\n• Post: sale ya rent, sirf text, 30 din ke liye (kabhi bhi renew karein).\n• Search: apni zaroorat likhein; agar kuch na mile to hum 24 ghante dhoond kar results bhejte hain.\n• Contact number: result par "Contact" dabayein (rozana {limit}).\n• Yahan sab kuch users ka diya hua hai aur verified nahi. Koi bhi raqam dene se pehle ownership papers, NOC aur approvals khud check karein.\n• Ghalat ya fake entry ki 🚩 se report karein.\n\nCommands: /post /search /mine /requests /name /language /cancel'
  },
  ask_new_name: {
    en: 'Your name is now "{name}". Type the new name:',
    ur: 'آپ کا نام ابھی "{name}" ہے۔ نیا نام لکھیں:',
    ro: 'Aap ka naam abhi "{name}" hai. Naya naam likhein:'
  },
  name_changed: { en: '✅ Name changed to {name}.', ur: '✅ نام بدل کر {name} کر دیا گیا۔', ro: '✅ Naam badal kar {name} kar diya.' },
  cancelled: { en: 'Stopped. Nothing was saved.', ur: 'روک دیا گیا۔ کچھ محفوظ نہیں ہوا۔', ro: 'Rok diya. Kuch save nahi hua.' },
  blocked_account: {
    en: 'This account is paused. Please contact the AgenticCore team.',
    ur: 'یہ اکاؤنٹ روکا ہوا ہے۔ براہ کرم AgenticCore ٹیم سے رابطہ کریں۔',
    ro: 'Yeh account roka hua hai. Meharbani kar ke AgenticCore team se raabta karein.'
  },
  slow_down: {
    en: 'Too many messages. Please wait a few minutes.',
    ur: 'بہت زیادہ پیغامات۔ براہ کرم چند منٹ انتظار کریں۔',
    ro: 'Bohat zyada messages. Meharbani kar ke kuch minute intezar karein.'
  },
  which_intent: {
    en: 'Do you want to post this property, or search for one like it?',
    ur: 'کیا آپ یہ پراپرٹی پوسٹ کرنا چاہتے ہیں، یا ایسی پراپرٹی تلاش کرنا چاہتے ہیں؟',
    ro: 'Kya aap yeh property post karna chahte hain, ya aisi property dhoondna chahte hain?'
  },
  // voice
  heard: { en: '🎙 I heard: "{text}"', ur: '🎙 میں نے سنا: "{text}"', ro: '🎙 Main ne suna: "{text}"' },
  voice_off: {
    en: 'Voice notes are not available right now. Please type your message.',
    ur: 'ابھی وائس نوٹ دستیاب نہیں۔ براہ کرم اپنا پیغام لکھ کر بھیجیں۔',
    ro: 'Abhi voice note available nahi. Meharbani kar ke apna message likh kar bhejein.'
  },
  voice_fail: {
    en: 'Sorry, I could not understand that voice note. Please try again or type it.',
    ur: 'معذرت، وائس نوٹ سمجھ نہیں آیا۔ دوبارہ کوشش کریں یا لکھ کر بھیجیں۔',
    ro: 'Maazrat, voice note samajh nahi aaya. Dobara koshish karein ya likh kar bhejein.'
  },
  no_photos: {
    en: 'This bot takes text only (no photos or videos). Please type the details.',
    ur: 'یہ بوٹ صرف تحریر لیتا ہے (تصویر یا ویڈیو نہیں)۔ براہ کرم تفصیل لکھیں۔',
    ro: 'Yeh bot sirf text leta hai (photo ya video nahi). Meharbani kar ke details likhein.'
  },
  // listing
  l_start: {
    en: 'Let\'s post your property. You can send all details in one message (e.g. "House for sale, G-13/2 Islamabad, 5 marla, 3 bed, demand 2.4 crore") or answer step by step.\n\nSale or rent?',
    ur: 'آئیں آپ کی پراپرٹی پوسٹ کریں۔ ساری تفصیل ایک پیغام میں بھیج سکتے ہیں (جیسے "گھر برائے فروخت، جی 13/2 اسلام آباد، 5 مرلہ، 3 بیڈ، ڈیمانڈ 2.4 کروڑ") یا ایک ایک کر کے جواب دیں۔\n\nفروخت یا کرایہ؟',
    ro: 'Aayein aap ki property post karein. Saari details ek message mein bhej sakte hain (jaise "Ghar for sale, G-13/2 Islamabad, 5 marla, 3 bed, demand 2.4 crore") ya step by step jawab dein.\n\nSale ya rent?'
  },
  q_purpose: { en: 'Sale or rent?', ur: 'فروخت یا کرایہ؟', ro: 'Sale ya rent?' },
  sale: { en: 'For sale', ur: 'برائے فروخت', ro: 'Sale' },
  rent: { en: 'For rent', ur: 'کرائے کے لیے', ro: 'Rent' },
  q_type: { en: 'Property type?', ur: 'پراپرٹی کی قسم؟', ro: 'Property ki qisam?' },
  q_city: {
    en: 'Which city? (tap one or type the name)',
    ur: 'کون سا شہر؟ (بٹن دبائیں یا نام لکھیں)',
    ro: 'Kaunsa shehar? (button dabayein ya naam likhein)'
  },
  bad_city: {
    en: 'I don\'t know that city yet. Please pick one or type another name.',
    ur: 'یہ شہر ابھی فہرست میں نہیں۔ براہ کرم کوئی اور منتخب کریں یا نام دوبارہ لکھیں۔',
    ro: 'Yeh shehar abhi list mein nahi. Meharbani kar ke koi aur chunein ya naam dobara likhein.'
  },
  q_area: {
    en: 'Area / sector / society? (e.g. G-13/2, Bahria Phase 7, DHA Phase 2)',
    ur: 'علاقہ / سیکٹر / سوسائٹی؟ (جیسے جی 13/2، بحریہ فیز 7، ڈی ایچ اے فیز 2)',
    ro: 'Area / sector / society? (jaise G-13/2, Bahria Phase 7, DHA Phase 2)'
  },
  q_size: {
    en: 'Size? (e.g. 5 marla, 1 kanal, 1800 sq ft)',
    ur: 'رقبہ؟ (جیسے 5 مرلہ، 1 کنال، 1800 مربع فٹ)',
    ro: 'Size? (jaise 5 marla, 1 kanal, 1800 sq ft)'
  },
  bad_size: {
    en: 'Please write the size with its unit, e.g. 5 marla, 1 kanal or 1800 sq ft.',
    ur: 'براہ کرم رقبہ اکائی کے ساتھ لکھیں، جیسے 5 مرلہ، 1 کنال یا 1800 مربع فٹ۔',
    ro: 'Meharbani kar ke size unit ke saath likhein, jaise 5 marla, 1 kanal ya 1800 sq ft.'
  },
  q_price_sale: {
    en: 'Demand price? (e.g. 2.4 crore, 85 lakh) — or tap "Ask the seller" to not show a price.',
    ur: 'ڈیمانڈ؟ (جیسے 2.4 کروڑ، 85 لاکھ) — یا قیمت نہ دکھانے کے لیے "مالک سے پوچھیں" دبائیں۔',
    ro: 'Demand kitni hai? (jaise 2.4 crore, 85 lakh) — ya qeemat na dikhane ke liye "Seller se poochein" dabayein.'
  },
  q_price_rent: {
    en: 'Monthly rent? (e.g. 60 thousand, 1.2 lakh) — or tap "Ask the seller".',
    ur: 'ماہانہ کرایہ؟ (جیسے 60 ہزار، 1.2 لاکھ) — یا "مالک سے پوچھیں" دبائیں۔',
    ro: 'Mahana kiraya? (jaise 60 hazar, 1.2 lakh) — ya "Seller se poochein" dabayein.'
  },
  bad_price: {
    en: 'Please write the amount, e.g. 2.4 crore, 85 lakh or 60 thousand.',
    ur: 'براہ کرم رقم لکھیں، جیسے 2.4 کروڑ، 85 لاکھ یا 60 ہزار۔',
    ro: 'Meharbani kar ke raqam likhein, jaise 2.4 crore, 85 lakh ya 60 hazar.'
  },
  ask_seller_btn: { en: 'Ask the seller', ur: 'مالک سے پوچھیں', ro: 'Seller se poochein' },
  q_beds: { en: 'Bedrooms?', ur: 'بیڈ رومز؟', ro: 'Bedrooms kitne?' },
  q_baths: { en: 'Bathrooms?', ur: 'باتھ رومز؟', ro: 'Bathrooms kitne?' },
  q_address: {
    en: 'Street / block / house number? (optional — shown only to people who tap "Contact")',
    ur: 'گلی / بلاک / مکان نمبر؟ (اختیاری — صرف "رابطہ" دبانے والوں کو دکھایا جائے گا)',
    ro: 'Street / block / house number? (optional — sirf "Contact" dabane walon ko dikhaya jayega)'
  },
  q_notes: {
    en: 'Any short notes? (optional, e.g. corner, park facing, possession ready). No phone numbers or links please.',
    ur: 'کوئی مختصر تفصیل؟ (اختیاری، جیسے کارنر، پارک فیسنگ، قبضہ تیار)۔ فون نمبر یا لنک نہ لکھیں۔',
    ro: 'Koi mukhtasar notes? (optional, jaise corner, park facing, possession ready). Phone number ya link na likhein.'
  },
  no_contact_in_text: {
    en: 'Please don\'t put phone numbers, links or e-mails here — buyers get your number through the "Contact" button.',
    ur: 'براہ کرم یہاں فون نمبر، لنک یا ای میل نہ لکھیں — خریدار "رابطہ" بٹن سے آپ کا نمبر حاصل کرتے ہیں۔',
    ro: 'Meharbani kar ke yahan phone number, link ya email na likhein — buyers "Contact" button se aap ka number lete hain.'
  },
  skip: { en: 'Skip', ur: 'چھوڑیں', ro: 'Skip' },
  summary_head: { en: 'Please check your entry:', ur: 'براہ کرم اپنی پوسٹ چیک کریں:', ro: 'Meharbani kar ke apni entry check karein:' },
  summary_addr: { en: 'Address (private): {v}', ur: 'پتہ (نجی): {v}', ro: 'Address (private): {v}' },
  confirm: { en: '✅ Post it', ur: '✅ پوسٹ کریں', ro: '✅ Post karein' },
  edit: { en: '✏️ Change', ur: '✏️ تبدیل کریں', ro: '✏️ Tabdeel karein' },
  cancel: { en: '✖️ Cancel', ur: '✖️ منسوخ', ro: '✖️ Cancel' },
  which_field: { en: 'What do you want to change?', ur: 'آپ کیا تبدیل کرنا چاہتے ہیں؟', ro: 'Aap kya tabdeel karna chahte hain?' },
  f_purpose: { en: 'Sale/rent', ur: 'فروخت/کرایہ', ro: 'Sale/rent' },
  f_type: { en: 'Type', ur: 'قسم', ro: 'Qisam' },
  f_city: { en: 'City', ur: 'شہر', ro: 'Shehar' },
  f_area: { en: 'Area', ur: 'علاقہ', ro: 'Area' },
  f_size: { en: 'Size', ur: 'رقبہ', ro: 'Size' },
  f_price: { en: 'Price', ur: 'قیمت', ro: 'Qeemat' },
  f_beds: { en: 'Bedrooms', ur: 'بیڈ رومز', ro: 'Bedrooms' },
  f_baths: { en: 'Bathrooms', ur: 'باتھ رومز', ro: 'Bathrooms' },
  f_address: { en: 'Address', ur: 'پتہ', ro: 'Address' },
  f_notes: { en: 'Notes', ur: 'تفصیل', ro: 'Notes' },
  posted: {
    en: '✅ Posted as {ref}. It stays live for 30 days; renew it from "My entries".\nIt is shown only inside this bot, marked "User-submitted, not verified".',
    ur: '✅ {ref} کے نام سے پوسٹ ہو گئی۔ یہ 30 دن تک رہے گی؛ "میری پوسٹس" سے رینیو کریں۔\nیہ صرف اسی بوٹ میں دکھائی جاتی ہے، "صارف کی دی ہوئی، تصدیق شدہ نہیں" کے ساتھ۔',
    ro: '✅ {ref} ke naam se post ho gayi. Yeh 30 din tak rahegi; "Meri entries" se renew karein.\nYeh sirf isi bot mein dikhai jati hai, "User-submitted, verified nahi" ke saath.'
  },
  posted_alerts: {
    en: '🔔 {n} buyer(s) looking for this were alerted.',
    ur: '🔔 اس کی تلاش میں {n} خریداروں کو اطلاع دی گئی۔',
    ro: '🔔 Is ki talaash mein {n} buyers ko alert bheja gaya.'
  },
  listing_cap: {
    en: 'You have reached today\'s limit of {n} entries. Please try again tomorrow.',
    ur: 'آج کی {n} پوسٹس کی حد پوری ہو گئی۔ کل دوبارہ کوشش کریں۔',
    ro: 'Aaj ki {n} entries ki limit poori ho gayi. Kal dobara koshish karein.'
  },
  duplicate: {
    en: 'You already have this property live as {ref}.',
    ur: 'یہ پراپرٹی پہلے ہی {ref} کے نام سے لائیو ہے۔',
    ro: 'Yeh property pehle hi {ref} ke naam se live hai.'
  },
  save_failed: {
    en: 'Sorry, something went wrong while saving. Please try again.',
    ur: 'معذرت، محفوظ کرتے وقت مسئلہ ہوا۔ دوبارہ کوشش کریں۔',
    ro: 'Maazrat, save karte waqt masla hua. Dobara koshish karein.'
  },
  // search
  s_start: {
    en: 'Tell me what you are looking for, e.g. "5 marla house G-13 under 2.5 crore" or "flat for rent Bahria Phase 7 up to 80 thousand".',
    ur: 'بتائیں آپ کیا تلاش کر رہے ہیں، جیسے "جی 13 میں 5 مرلہ گھر ڈھائی کروڑ تک" یا "بحریہ فیز 7 میں فلیٹ کرائے پر 80 ہزار تک"۔',
    ro: 'Batayein aap kya dhoond rahe hain, jaise "G-13 mein 5 marla ghar 2.5 crore tak" ya "Bahria Phase 7 mein flat kiraye par 80 hazar tak".'
  },
  s_need_area: {
    en: 'Which area or city? Please add it, e.g. "5 marla house G-13 Islamabad under 2.5 crore".',
    ur: 'کون سا علاقہ یا شہر؟ براہ کرم شامل کریں، جیسے "جی 13 اسلام آباد میں 5 مرلہ گھر ڈھائی کروڑ تک"۔',
    ro: 'Kaunsa area ya shehar? Meharbani kar ke shamil karein, jaise "G-13 Islamabad mein 5 marla ghar 2.5 crore tak".'
  },
  s_understood: { en: '🔎 Searching: {q}', ur: '🔎 تلاش: {q}', ro: '🔎 Search: {q}' },
  s_found: {
    en: 'Found {n} match(es). Tap "Contact" to see the number ({left} left today).',
    ur: '{n} نتائج ملے۔ نمبر دیکھنے کے لیے "رابطہ" دبائیں (آج {left} باقی)۔',
    ro: '{n} results mile. Number dekhne ke liye "Contact" dabayein (aaj {left} baqi).'
  },
  s_alert_offer: {
    en: 'Want an alert when new matching entries are posted? (for 7 days)',
    ur: 'کیا نئی ملتی جلتی پوسٹس آنے پر اطلاع چاہیے؟ (7 دن کے لیے)',
    ro: 'Kya nayi milti julti entries aane par alert chahiye? (7 din ke liye)'
  },
  s_alert_btn: { en: '🔔 Alert me', ur: '🔔 مجھے اطلاع دیں', ro: '🔔 Mujhe alert karein' },
  s_alert_on: {
    en: '🔔 Done ({ref}). I will message you when a new matching entry is posted, for 7 days.',
    ur: '🔔 ہو گیا ({ref})۔ اگلے 7 دن کوئی نئی ملتی جلتی پوسٹ آئی تو آپ کو پیغام بھیجوں گا۔',
    ro: '🔔 Ho gaya ({ref}). Agle 7 din koi nayi milti julti entry aayi to aap ko message karunga.'
  },
  s_none: {
    en: 'No match yet. We will search for you over the next 24 hours and send you the results. ({ref})',
    ur: 'ابھی کوئی میچ نہیں ملا۔ ہم 24 گھنٹے میں آپ کے لیے ڈھونڈ کر نتائج بھیجیں گے۔ ({ref})',
    ro: 'Abhi match nahi mila. Hum 24 ghante mein aapke liye dhoond kar results bhejenge. ({ref})'
  },
  s_request_cap: {
    en: 'You already have {n} active requests. Close one from "My requests" first.',
    ur: 'آپ کی پہلے ہی {n} فعال درخواستیں ہیں۔ پہلے "میری درخواستیں" سے کوئی بند کریں۔',
    ro: 'Aap ki pehle hi {n} active requests hain. Pehle "Meri requests" se koi band karein.'
  },
  src_feed: { en: 'Source: Dealer AI', ur: 'ذریعہ: Dealer AI', ro: 'Source: Dealer AI' },
  src_site: {
    en: 'Source: AgenticCore Estate website (contact number for signed-in visitors)',
    ur: 'ذریعہ: AgenticCore Estate ویب سائٹ (رابطہ نمبر سائن اِن صارفین کے لیے)',
    ro: 'Source: AgenticCore Estate website (contact number sign-in walon ke liye)'
  },
  src_partner: { en: 'Source: {name}', ur: 'ذریعہ: {name}', ro: 'Source: {name}' },
  btn_view_site: { en: '🌐 View on AgenticCore Estate', ur: '🌐 AgenticCore Estate پر دیکھیں', ro: '🌐 AgenticCore Estate par dekhein' },
  btn_view_partner: { en: '🌐 View on {name}', ur: '🌐 {name} پر دیکھیں', ro: '🌐 {name} par dekhein' },
  btn_contact: { en: '📞 Contact', ur: '📞 رابطہ', ro: '📞 Contact' },
  btn_report: { en: '🚩 Report', ur: '🚩 رپورٹ', ro: '🚩 Report' },
  btn_block: { en: '⛔ Block this poster', ur: '⛔ اس پوسٹر کو بلاک کریں', ro: '⛔ Is poster ko block karein' },
  // reveal
  reveal: {
    en: '📞 {ref} — {name} ({role})\n{phone}{addr}\n\n⚠️ User-submitted, not verified. Check ownership papers, NOC and approvals yourself before paying anything.\nContacts left today: {left}',
    ur: '📞 {ref} — {name} ({role})\n{phone}{addr}\n\n⚠️ صارف کی دی ہوئی معلومات، تصدیق شدہ نہیں۔ کوئی بھی رقم دینے سے پہلے ملکیت کے کاغذات، NOC اور منظوری خود چیک کریں۔\nآج باقی رابطے: {left}',
    ro: '📞 {ref} — {name} ({role})\n{phone}{addr}\n\n⚠️ User ki di hui maloomat, verified nahi. Koi bhi raqam dene se pehle ownership papers, NOC aur approvals khud check karein.\nAaj baqi contacts: {left}'
  },
  reveal_addr: { en: '\nAddress: {v}', ur: '\nپتہ: {v}', ro: '\nAddress: {v}' },
  viewed_notice: {
    en: '👀 {name} ({role}) has taken your number for {ref}. They may call or message you.',
    ur: '👀 {name} ({role}) نے {ref} کے لیے آپ کا نمبر لیا ہے۔ وہ آپ کو کال یا میسج کر سکتے ہیں۔',
    ro: '👀 {name} ({role}) ne {ref} ke liye aap ka number liya hai. Woh aap ko call ya message kar sakte hain.'
  },
  reveal_limit: {
    en: 'You have used today\'s {n} contacts. More tomorrow.',
    ur: 'آج کے {n} رابطے استعمال ہو چکے۔ کل مزید۔',
    ro: 'Aaj ke {n} contacts istemal ho chuke. Kal aur.'
  },
  not_available: {
    en: 'This entry is no longer available.',
    ur: 'یہ پوسٹ اب دستیاب نہیں۔',
    ro: 'Yeh entry ab available nahi.'
  },
  own_entry: { en: 'This is your own entry.', ur: 'یہ آپ کی اپنی پوسٹ ہے۔', ro: 'Yeh aap ki apni entry hai.' },
  role_name_owner: { en: 'owner', ur: 'مالک', ro: 'owner' },
  role_name_dealer: { en: 'dealer', ur: 'ڈیلر', ro: 'dealer' },
  role_name_buyer: { en: 'buyer', ur: 'خریدار', ro: 'buyer' },
  // report / block
  report_why: { en: 'What is wrong with {ref}?', ur: '{ref} میں کیا مسئلہ ہے؟', ro: '{ref} mein kya masla hai?' },
  rr_gone: { en: 'Sold / not available', ur: 'بک چکی / دستیاب نہیں', ro: 'Bik chuki / available nahi' },
  rr_wrong: { en: 'Wrong price or details', ur: 'غلط قیمت یا تفصیل', ro: 'Ghalat qeemat ya details' },
  rr_fake: { en: 'Fake / scam', ur: 'جعلی / فراڈ', ro: 'Fake / fraud' },
  rr_other: { en: 'Something else', ur: 'کچھ اور', ro: 'Kuch aur' },
  reported: {
    en: 'Thanks, reported. The team will look at it.',
    ur: 'شکریہ، رپورٹ ہو گئی۔ ٹیم اسے دیکھے گی۔',
    ro: 'Shukriya, report ho gayi. Team isay dekhegi.'
  },
  already_reported: { en: 'You already reported this entry.', ur: 'آپ یہ پوسٹ پہلے ہی رپورٹ کر چکے ہیں۔', ro: 'Aap yeh entry pehle hi report kar chuke hain.' },
  blocked_done: {
    en: 'Blocked. You won\'t see this poster\'s entries, and they can\'t get your number.',
    ur: 'بلاک کر دیا۔ آپ کو اس پوسٹر کی پوسٹس نظر نہیں آئیں گی، اور وہ آپ کا نمبر حاصل نہیں کر سکیں گے۔',
    ro: 'Block kar diya. Aap ko is poster ki entries nazar nahi aayengi, aur woh aap ka number nahi le sakenge.'
  },
  // manage
  mine_none: {
    en: 'You have no entries yet. Tap "Post a property" to add one.',
    ur: 'ابھی آپ کی کوئی پوسٹ نہیں۔ "پراپرٹی پوسٹ کریں" دبائیں۔',
    ro: 'Abhi aap ki koi entry nahi. "Property post karein" dabayein.'
  },
  mine_head: { en: 'Your entries (latest {n}):', ur: 'آپ کی پوسٹس (تازہ ترین {n}):', ro: 'Aap ki entries (latest {n}):' },
  st_active: { en: '🟢 Live until {d}', ur: '🟢 {d} تک لائیو', ro: '🟢 {d} tak live' },
  st_sold: { en: '✅ Sold', ur: '✅ فروخت شدہ', ro: '✅ Bik gayi' },
  st_rented: { en: '✅ Rented', ur: '✅ کرائے پر چلی گئی', ro: '✅ Kiraye par chali gayi' },
  st_expired: { en: '⏳ Expired', ur: '⏳ مدت ختم', ro: '⏳ Expire ho gayi' },
  st_hidden: { en: '🚩 Hidden for review', ur: '🚩 جائزے کے لیے چھپائی گئی', ro: '🚩 Review ke liye chhupa di gayi' },
  btn_sold: { en: '✅ Mark sold', ur: '✅ فروخت ہو گئی', ro: '✅ Bik gayi' },
  btn_rented: { en: '✅ Mark rented', ur: '✅ کرائے پر چلی گئی', ro: '✅ Kiraye par chali gayi' },
  btn_renew: { en: '🔁 Renew 30 days', ur: '🔁 30 دن رینیو', ro: '🔁 30 din renew' },
  btn_remove: { en: '🗑 Remove', ur: '🗑 ہٹائیں', ro: '🗑 Hatayein' },
  done_sold: { en: '✅ {ref} marked as done. Buyers will no longer see it.', ur: '✅ {ref} مکمل کر دی گئی۔ خریداروں کو اب نظر نہیں آئے گی۔', ro: '✅ {ref} mukammal kar di. Buyers ko ab nazar nahi aayegi.' },
  done_renew: { en: '🔁 {ref} renewed until {d}.', ur: '🔁 {ref} کو {d} تک رینیو کر دیا۔', ro: '🔁 {ref} ko {d} tak renew kar diya.' },
  done_remove: { en: '🗑 {ref} removed.', ur: '🗑 {ref} ہٹا دی گئی۔', ro: '🗑 {ref} hata di gayi.' },
  reqs_none: {
    en: 'You have no active requests. Type what you are looking for to search.',
    ur: 'آپ کی کوئی فعال درخواست نہیں۔ تلاش کے لیے اپنی ضرورت لکھیں۔',
    ro: 'Aap ki koi active request nahi. Search ke liye apni zaroorat likhein.'
  },
  req_line: { en: '🔔 {ref}: {q}\n{st}', ur: '🔔 {ref}: {q}\n{st}', ro: '🔔 {ref}: {q}\n{st}' },
  rs_open: { en: 'Searching until {d}', ur: '{d} تک تلاش جاری', ro: '{d} tak search jari' },
  rs_answered: { en: 'Alerts on until {d}', ur: '{d} تک اطلاعات جاری', ro: '{d} tak alerts on' },
  rs_waiting: { en: 'Waiting for your choice', ur: 'آپ کے فیصلے کا انتظار', ro: 'Aap ke faisle ka intezar' },
  btn_keep7: { en: '🔁 Keep active 7 days', ur: '🔁 مزید 7 دن جاری رکھیں', ro: '🔁 7 din aur active rakhein' },
  btn_change: { en: '✏️ Change search', ur: '✏️ تلاش تبدیل کریں', ro: '✏️ Search tabdeel karein' },
  btn_close: { en: '✖️ Close', ur: '✖️ بند کریں', ro: '✖️ Band karein' },
  req_kept: { en: '🔁 {ref} stays active until {d}.', ur: '🔁 {ref} {d} تک جاری رہے گی۔', ro: '🔁 {ref} {d} tak active rahegi.' },
  req_closed: { en: '✖️ {ref} closed.', ur: '✖️ {ref} بند کر دی گئی۔', ro: '✖️ {ref} band kar di.' },
  req_change: {
    en: 'Type your new search (e.g. a different area or budget). {ref} is closed.',
    ur: 'اپنی نئی تلاش لکھیں (جیسے کوئی اور علاقہ یا بجٹ)۔ {ref} بند کر دی گئی۔',
    ro: 'Apni nayi search likhein (jaise koi aur area ya budget). {ref} band kar di.'
  },
  // alerts & 24h
  alert_new: {
    en: '🔔 New match for your request {ref} ({q}):',
    ur: '🔔 آپ کی درخواست {ref} ({q}) کے لیے نیا میچ:',
    ro: '🔔 Aap ki request {ref} ({q}) ke liye naya match:'
  },
  deadline_found: {
    en: '⏰ 24-hour update for {ref} ({q}): we sent you {n} match(es) above. Keep the alerts on for 7 more days?',
    ur: '⏰ {ref} ({q}) کی 24 گھنٹے کی رپورٹ: ہم نے اوپر {n} نتائج بھیجے۔ کیا مزید 7 دن اطلاعات جاری رکھیں؟',
    ro: '⏰ {ref} ({q}) ki 24 ghante ki update: hum ne upar {n} results bheje. Kya 7 din aur alerts jari rakhein?'
  },
  deadline_none: {
    en: '⏰ 24-hour update for {ref} ({q}): honestly, no match yet. You can keep the request active for 7 more days (we\'ll alert you the moment one is posted), or change the area or budget.',
    ur: '⏰ {ref} ({q}) کی 24 گھنٹے کی رپورٹ: سچ یہ ہے کہ ابھی کوئی میچ نہیں ملا۔ آپ درخواست مزید 7 دن جاری رکھ سکتے ہیں (پوسٹ آتے ہی اطلاع دیں گے)، یا علاقہ یا بجٹ تبدیل کر سکتے ہیں۔',
    ro: '⏰ {ref} ({q}) ki 24 ghante ki update: sach yeh hai ke abhi match nahi mila. Aap request 7 din aur active rakh sakte hain (entry aate hi alert karenge), ya area ya budget tabdeel kar sakte hain.'
  },
  week_over: {
    en: '⏰ Your request {ref} ({q}) has finished its 7 days. Keep it for 7 more?',
    ur: '⏰ آپ کی درخواست {ref} ({q}) کے 7 دن پورے ہو گئے۔ کیا مزید 7 دن جاری رکھیں؟',
    ro: '⏰ Aap ki request {ref} ({q}) ke 7 din poore ho gaye. Kya 7 din aur rakhein?'
  },
  expiry_soon: {
    en: '⏳ Your entry {ref} expires on {d}. Renew it to keep it live.',
    ur: '⏳ آپ کی پوسٹ {ref} کی مدت {d} کو ختم ہو رہی ہے۔ لائیو رکھنے کے لیے رینیو کریں۔',
    ro: '⏳ Aap ki entry {ref} {d} ko expire ho rahi hai. Live rakhne ke liye renew karein.'
  },
  expired_now: {
    en: '⏳ Your entry {ref} has expired after 30 days. Still available? Renew it.',
    ur: '⏳ آپ کی پوسٹ {ref} کی 30 دن کی مدت ختم ہو گئی۔ ابھی دستیاب ہے؟ رینیو کریں۔',
    ro: '⏳ Aap ki entry {ref} ke 30 din poore ho gaye. Abhi available hai? Renew karein.'
  },
  unknown: {
    en: 'Sorry, I didn\'t get that. Type what you need, or use the menu.',
    ur: 'معذرت، سمجھ نہیں آیا۔ اپنی ضرورت لکھیں یا مینو استعمال کریں۔',
    ro: 'Maazrat, samajh nahi aaya. Apni zaroorat likhein ya menu istemal karein.'
  }
};

export function t(lang, key, vars) {
  const e = S[key];
  if (!e) return key;
  let s = e[lang] || e.en;
  if (vars) Object.keys(vars).forEach((k) => { s = s.split('{' + k + '}').join(vars[k] == null ? '' : String(vars[k])); });
  return s;
}
export const LANGS = ['en', 'ur', 'ro'];
