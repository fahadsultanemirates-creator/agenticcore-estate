import { S_PK } from './strings-pk.mjs';

// Everything the AgenticCore Telegram bot says, in English, Urdu and Roman Urdu.
// {placeholders} are filled by t(). Numbers and links are only ever filled in
// from real account/listing data, never from AI output.

export const S = {
  welcome_new: {
    en: 'Assalam-o-Alaikum! I\'m Amaan, the AgenticCore assistant. With me you can open an AgenticCore Estate account and list your property — right here in Telegram, no website needed.\n\nWhat would you like to do?',
    ur: 'السلام علیکم! میں امان ہوں، AgenticCore کا اسسٹنٹ۔ میرے ساتھ آپ یہیں ٹیلیگرام میں AgenticCore Estate اکاؤنٹ کھول سکتے ہیں اور اپنی پراپرٹی لسٹ کر سکتے ہیں — ویب سائٹ کی ضرورت نہیں۔\n\nآپ کیا کرنا چاہیں گے؟',
    ro: 'Assalam-o-Alaikum! Main Amaan hoon, AgenticCore ka assistant. Mere saath aap yahin Telegram mein AgenticCore Estate account khol sakte hain aur apni property list kar sakte hain — website ki zaroorat nahin.\n\nAap kya karna chahenge?'
  },
  welcome_back: {
    en: 'Welcome back, {name} ({member}). What would you like to do?',
    ur: 'خوش آمدید، {name} ({member})۔ آپ کیا کرنا چاہیں گے؟',
    ro: 'Khush aamdeed, {name} ({member}). Aap kya karna chahenge?'
  },
  btn_signup: { en: 'Open an account', ur: 'اکاؤنٹ کھولیں', ro: 'Account kholein' },
  btn_have_account: { en: 'I already have an account', ur: 'میرا اکاؤنٹ پہلے سے ہے', ro: 'Mera account pehle se hai' },
  btn_list: { en: 'List a property', ur: 'پراپرٹی لسٹ کریں', ro: 'Property list karein' },
  btn_my_listings: { en: 'My listings', ur: 'میری لسٹنگز', ro: 'Meri listings' },
  btn_login: { en: 'Website sign-in link', ur: 'ویب سائٹ سائن اِن لنک', ro: 'Website sign-in link' },
  btn_services: { en: 'Marketing services', ur: 'مارکیٹنگ سروسز', ro: 'Marketing services' },
  btn_help: { en: 'Help', ur: 'مدد', ro: 'Madad' },

  have_account: {
    en: 'To connect your existing account: sign in at agenticcore.estate, open your Dashboard and tap "Connect Telegram". It brings you back here already connected.',
    ur: 'اپنا موجودہ اکاؤنٹ جوڑنے کے لیے: agenticcore.estate پر سائن اِن کریں، ڈیش بورڈ کھولیں اور "Connect Telegram" دبائیں۔ آپ جُڑ کر یہاں واپس آ جائیں گے۔',
    ro: 'Apna maujooda account jorne ke liye: agenticcore.estate par sign in karein, Dashboard kholein aur "Connect Telegram" dabayein. Aap jur kar yahan wapas aa jayenge.'
  },

  // ---- sign-up ----
  signup_contact: {
    en: 'Let\'s open your account. First, tap the button below to share your mobile number. Telegram confirms the number belongs to you.',
    ur: 'آئیں آپ کا اکاؤنٹ کھولیں۔ پہلے نیچے والا بٹن دبا کر اپنا موبائل نمبر شیئر کریں۔ ٹیلیگرام تصدیق کرتا ہے کہ نمبر آپ کا ہے۔',
    ro: 'Aayein aap ka account kholein. Pehle neeche wala button daba kar apna mobile number share karein. Telegram tasdeeq karta hai ke number aap ka hai.'
  },
  btn_share_phone: { en: 'Share my mobile number', ur: 'میرا موبائل نمبر شیئر کریں', ro: 'Mera mobile number share karein' },
  contact_not_yours: {
    en: 'Please share your own number with the button — not someone else\'s contact.',
    ur: 'براہِ کرم بٹن سے اپنا ہی نمبر شیئر کریں — کسی اور کا کانٹیکٹ نہیں۔',
    ro: 'Barah-e-karam button se apna hi number share karein — kisi aur ka contact nahin.'
  },
  phone_exists: {
    en: 'An AgenticCore account already uses this number. To use it here, sign in at agenticcore.estate → Dashboard → "Connect Telegram".',
    ur: 'یہ نمبر پہلے سے ایک AgenticCore اکاؤنٹ میں استعمال ہو رہا ہے۔ اسے یہاں استعمال کرنے کے لیے agenticcore.estate پر سائن اِن کریں ← ڈیش بورڈ ← "Connect Telegram"۔',
    ro: 'Yeh number pehle se ek AgenticCore account mein istemal ho raha hai. Isay yahan istemal karne ke liye agenticcore.estate par sign in karein → Dashboard → "Connect Telegram".'
  },
  signup_name: { en: 'Thanks. What is your full name?', ur: 'شکریہ۔ آپ کا پورا نام کیا ہے؟', ro: 'Shukriya. Aap ka poora naam kya hai?' },
  bad_name: { en: 'Please send your full name (2 to 60 letters).', ur: 'براہِ کرم اپنا پورا نام بھیجیں (2 سے 60 حروف)۔', ro: 'Barah-e-karam apna poora naam bhejein (2 se 60 huroof).' },
  signup_email: { en: 'And your email address?', ur: 'اور آپ کا ای میل ایڈریس؟', ro: 'Aur aap ka email address?' },
  bad_email: { en: 'That doesn\'t look like an email address. Please send it again, e.g. name@gmail.com.', ur: 'یہ ای میل ایڈریس نہیں لگتا۔ دوبارہ بھیجیں، مثلاً name@gmail.com', ro: 'Yeh email address nahin lagta. Dobara bhejein, maslan name@gmail.com.' },
  signup_confirm: {
    en: 'Please check your details:\n\nName: {name}\nMobile: {phone}\nEmail: {email}\n\nOpen the account with these details?',
    ur: 'براہِ کرم اپنی تفصیلات چیک کریں:\n\nنام: {name}\nموبائل: {phone}\nای میل: {email}\n\nکیا انہی تفصیلات سے اکاؤنٹ کھولیں؟',
    ro: 'Barah-e-karam apni tafseelat check karein:\n\nNaam: {name}\nMobile: {phone}\nEmail: {email}\n\nKya inhi tafseelat se account kholein?'
  },
  btn_yes_open: { en: 'Yes, open my account', ur: 'جی ہاں، اکاؤنٹ کھولیں', ro: 'Ji haan, account kholein' },
  btn_change: { en: 'Change something', ur: 'کچھ تبدیل کریں', ro: 'Kuch tabdeel karein' },
  email_exists: {
    en: 'An account already uses this email. Sign in at agenticcore.estate → Dashboard → "Connect Telegram" to use it here, or send a different email.',
    ur: 'یہ ای میل پہلے سے ایک اکاؤنٹ میں استعمال ہو رہی ہے۔ اسے یہاں استعمال کرنے کے لیے agenticcore.estate پر سائن اِن کریں ← ڈیش بورڈ ← "Connect Telegram"، یا کوئی دوسری ای میل بھیجیں۔',
    ro: 'Yeh email pehle se ek account mein istemal ho rahi hai. Isay yahan istemal karne ke liye agenticcore.estate par sign in karein → Dashboard → "Connect Telegram", ya koi doosri email bhejein.'
  },
  account_ready: {
    en: 'Your account is open. Your member number is {member} — keep it for anything you do with AgenticCore.\n\nYou can list a property right now. To use the website too, tap the one-time sign-in link below (it works once, for about an hour) and set a password. Please set it within 30 days — after that the account is paused until you do.',
    ur: 'آپ کا اکاؤنٹ کھل گیا ہے۔ آپ کا ممبر نمبر {member} ہے — AgenticCore کے ساتھ ہر کام کے لیے اسے محفوظ رکھیں۔\n\nآپ ابھی پراپرٹی لسٹ کر سکتے ہیں۔ ویب سائٹ استعمال کرنے کے لیے نیچے دیا گیا ایک بار کا سائن اِن لنک دبائیں (یہ ایک بار، تقریباً ایک گھنٹے کے لیے چلتا ہے) اور پاس ورڈ بنائیں۔ براہِ کرم 30 دن کے اندر پاس ورڈ بنا لیں — اس کے بعد پاس ورڈ بننے تک اکاؤنٹ رُک جاتا ہے۔',
    ro: 'Aap ka account khul gaya hai. Aap ka member number {member} hai — AgenticCore ke saath har kaam ke liye isay mehfooz rakhein.\n\nAap abhi property list kar sakte hain. Website istemal karne ke liye neeche diya gaya ek baar ka sign-in link dabayein (yeh ek baar, taqreeban ek ghante ke liye chalta hai) aur password banayein. Barah-e-karam 30 din ke andar password bana lein — us ke baad password banne tak account ruk jata hai.'
  },
  btn_open_link: { en: 'Sign in & set password', ur: 'سائن اِن کریں اور پاس ورڈ بنائیں', ro: 'Sign in karein aur password banayein' },
  btn_open_site: { en: 'Sign in to the website', ur: 'ویب سائٹ پر سائن اِن کریں', ro: 'Website par sign in karein' },
  login_link: {
    en: 'Here is your one-time sign-in link for agenticcore.estate. It works once, for about an hour. Don\'t share it — it opens your account.',
    ur: 'یہ رہا agenticcore.estate کے لیے آپ کا ایک بار کا سائن اِن لنک۔ یہ ایک بار، تقریباً ایک گھنٹے کے لیے چلتا ہے۔ اسے کسی کو نہ بھیجیں — یہ آپ کا اکاؤنٹ کھولتا ہے۔',
    ro: 'Yeh raha agenticcore.estate ke liye aap ka ek baar ka sign-in link. Yeh ek baar, taqreeban ek ghante ke liye chalta hai. Isay kisi ko na bhejein — yeh aap ka account kholta hai.'
  },
  login_limit: { en: 'You\'ve asked for several links recently. Please use the latest one, or try again in an hour.', ur: 'آپ نے حال ہی میں کئی لنک مانگے ہیں۔ براہِ کرم تازہ ترین لنک استعمال کریں، یا ایک گھنٹے بعد دوبارہ کوشش کریں۔', ro: 'Aap ne haal hi mein kai link mange hain. Barah-e-karam taaza tareen link istemal karein, ya ek ghante baad dobara koshish karein.' },
  linked: {
    en: 'Connected. This Telegram is now linked to your AgenticCore account {member}.',
    ur: 'جُڑ گیا۔ یہ ٹیلیگرام اب آپ کے AgenticCore اکاؤنٹ {member} سے منسلک ہے۔',
    ro: 'Jur gaya. Yeh Telegram ab aap ke AgenticCore account {member} se munsalik hai.'
  },
  link_invalid: {
    en: 'That connect link has expired or was already used. In your Dashboard, tap "Connect Telegram" again for a new one.',
    ur: 'یہ کنیکٹ لنک ختم ہو چکا ہے یا استعمال ہو چکا ہے۔ ڈیش بورڈ میں دوبارہ "Connect Telegram" دبا کر نیا لنک لیں۔',
    ro: 'Yeh connect link khatam ho chuka hai ya istemal ho chuka hai. Dashboard mein dobara "Connect Telegram" daba kar naya link lein.'
  },
  need_account: {
    en: 'For that you need an AgenticCore account first — it takes a minute, right here.',
    ur: 'اس کے لیے پہلے AgenticCore اکاؤنٹ چاہیے — یہیں ایک منٹ میں بن جاتا ہے۔',
    ro: 'Is ke liye pehle AgenticCore account chahiye — yahin ek minute mein ban jata hai.'
  },
  frozen: {
    en: 'Your account is paused because no password was set within 30 days. Tap below for a one-time sign-in link, set a password, and everything works again.',
    ur: 'آپ کا اکاؤنٹ رُکا ہوا ہے کیونکہ 30 دن کے اندر پاس ورڈ نہیں بنایا گیا۔ نیچے دبا کر ایک بار کا سائن اِن لنک لیں، پاس ورڈ بنائیں، اور سب کچھ دوبارہ چلنے لگے گا۔',
    ro: 'Aap ka account ruka hua hai kyunke 30 din ke andar password nahin banaya gaya. Neeche daba kar ek baar ka sign-in link lein, password banayein, aur sab kuch dobara chalne lagega.'
  },

  // ---- listing ----
  photos_ask: {
    en: 'Great — I have the details. Now send photos of the property (up to 8): front elevation first, then the rooms. When you\'ve sent them all, tap "Done".',
    ur: 'بہت خوب — تفصیلات مل گئیں۔ اب پراپرٹی کی تصاویر بھیجیں (زیادہ سے زیادہ 8): پہلے سامنے کا منظر، پھر کمرے۔ سب بھیجنے کے بعد "ہو گیا" دبائیں۔',
    ro: 'Bohat khoob — tafseelat mil gayin. Ab property ki tasveerein bhejein (zyada se zyada 8): pehle samne ka manzar, phir kamre. Sab bhejne ke baad "Ho gaya" dabayein.'
  },
  photo_got: { en: 'Photo {n} received.', ur: 'تصویر {n} مل گئی۔', ro: 'Tasveer {n} mil gayi.' },
  photo_max: { en: 'That\'s 8 photos — the maximum. Tap "Done" to continue.', ur: '8 تصاویر ہو گئیں — یہ زیادہ سے زیادہ ہیں۔ آگے بڑھنے کے لیے "ہو گیا" دبائیں۔', ro: '8 tasveerein ho gayin — yeh zyada se zyada hain. Aage barhne ke liye "Ho gaya" dabayein.' },
  photo_as_file: { en: 'Please send photos as normal photos (not as a file or document).', ur: 'براہِ کرم تصاویر عام تصویر کے طور پر بھیجیں (فائل یا ڈاکیومنٹ کے طور پر نہیں)۔', ro: 'Barah-e-karam tasveerein aam tasveer ke taur par bhejein (file ya document ke taur par nahin).' },
  need_photo: { en: 'Please send at least one photo first — buyers rarely open listings without photos.', ur: 'براہِ کرم پہلے کم از کم ایک تصویر بھیجیں — خریدار بغیر تصویر والی لسٹنگ کم ہی کھولتے ہیں۔', ro: 'Barah-e-karam pehle kam az kam ek tasveer bhejein — khareedar baghair tasveer wali listing kam hi kholte hain.' },
  btn_done_photos: { en: 'Done', ur: 'ہو گیا', ro: 'Ho gaya' },
  photo_not_now: { en: 'To list a property, tell me about it first — then I\'ll ask for photos.', ur: 'پراپرٹی لسٹ کرنے کے لیے پہلے اس کے بارے میں بتائیں — پھر میں تصاویر مانگوں گا۔', ro: 'Property list karne ke liye pehle us ke baare mein batayein — phir main tasveerein mangunga.' },
  review: {
    en: 'Please check your listing:\n\n{summary}\n\nIs everything correct?',
    ur: 'براہِ کرم اپنی لسٹنگ چیک کریں:\n\n{summary}\n\nکیا سب کچھ درست ہے؟',
    ro: 'Barah-e-karam apni listing check karein:\n\n{summary}\n\nKya sab kuch durust hai?'
  },
  btn_publish: { en: 'Yes, publish it', ur: 'جی ہاں، شائع کریں', ro: 'Ji haan, publish karein' },
  btn_cancel: { en: 'Cancel', ur: 'منسوخ کریں', ro: 'Mansookh karein' },
  what_change: { en: 'Tell me what to change, e.g. "price is 3.8 crore" or "4 bathrooms".', ur: 'بتائیں کیا تبدیل کرنا ہے، مثلاً "قیمت 3.8 کروڑ ہے" یا "4 باتھ روم"۔', ro: 'Batayein kya tabdeel karna hai, maslan "price 3.8 crore hai" ya "4 bathrooms".' },
  cancelled: { en: 'Cancelled. Nothing was published.', ur: 'منسوخ کر دیا۔ کچھ شائع نہیں ہوا۔', ro: 'Mansookh kar diya. Kuch publish nahin hua.' },
  publishing: { en: 'Publishing…', ur: 'شائع ہو رہی ہے…', ro: 'Publish ho rahi hai…' },
  published: {
    en: 'Your listing is live:\n{url}\n\nListing quality: {score}/100.{tips}\n\nShare the link on WhatsApp and Facebook to reach buyers.',
    ur: 'آپ کی لسٹنگ شائع ہو گئی:\n{url}\n\nلسٹنگ کوالٹی: {score}/100۔{tips}\n\nخریداروں تک پہنچنے کے لیے لنک واٹس ایپ اور فیس بک پر شیئر کریں۔',
    ro: 'Aap ki listing publish ho gayi:\n{url}\n\nListing quality: {score}/100.{tips}\n\nKhareedaron tak pohanchne ke liye link WhatsApp aur Facebook par share karein.'
  },
  photos_failed: { en: 'Note: {n} photo(s) could not be saved. You can add photos later from your Dashboard on the website.', ur: 'نوٹ: {n} تصویر محفوظ نہیں ہو سکی۔ آپ بعد میں ویب سائٹ کے ڈیش بورڈ سے تصاویر شامل کر سکتے ہیں۔', ro: 'Note: {n} tasveer mehfooz nahin ho saki. Aap baad mein website ke Dashboard se tasveerein shamil kar sakte hain.' },
  check_failed: { en: 'I can\'t publish this yet: {reason}', ur: 'میں ابھی یہ شائع نہیں کر سکتا: {reason}', ro: 'Main abhi yeh publish nahin kar sakta: {reason}' },
  why_city: { en: 'we currently list in {cities} only.', ur: 'ہم فی الحال صرف {cities} میں لسٹ کرتے ہیں۔', ro: 'hum filhaal sirf {cities} mein list karte hain.' },
  why_price: { en: 'the price doesn\'t look right — please send it again (e.g. 3.5 crore or 85,000 per month).', ur: 'قیمت درست نہیں لگتی — دوبارہ بھیجیں (مثلاً 3.5 کروڑ یا 85,000 ماہانہ)۔', ro: 'qeemat durust nahin lagti — dobara bhejein (maslan 3.5 crore ya 85,000 mahana).' },
  why_duplicate: { en: 'you already have a listing with the same area, size, type and price.', ur: 'آپ کی اسی علاقے، سائز، قسم اور قیمت کی لسٹنگ پہلے سے موجود ہے۔', ro: 'aap ki isi area, size, qisam aur qeemat ki listing pehle se maujood hai.' },
  why_daily: { en: 'you\'ve published {n} listings today, the daily limit. Please continue tomorrow.', ur: 'آپ آج {n} لسٹنگز شائع کر چکے ہیں جو روزانہ کی حد ہے۔ براہِ کرم کل جاری رکھیں۔', ro: 'aap aaj {n} listings publish kar chuke hain jo rozana ki had hai. Barah-e-karam kal jari rakhein.' },
  why_missing: { en: 'some details are still missing — {what}.', ur: 'کچھ تفصیلات ابھی باقی ہیں — {what}۔', ro: 'kuch tafseelat abhi baqi hain — {what}.' },
  publish_error: { en: 'Something went wrong while publishing. Nothing was published — please try again in a minute.', ur: 'شائع کرتے ہوئے کوئی مسئلہ آ گیا۔ کچھ شائع نہیں ہوا — براہِ کرم ایک منٹ بعد دوبارہ کوشش کریں۔', ro: 'Publish karte hue koi masla aa gaya. Kuch publish nahin hua — barah-e-karam ek minute baad dobara koshish karein.' },
  my_listings_none: { en: 'You have no listings yet. Tap "List a property" to add one.', ur: 'ابھی آپ کی کوئی لسٹنگ نہیں۔ نئی لسٹنگ کے لیے "پراپرٹی لسٹ کریں" دبائیں۔', ro: 'Abhi aap ki koi listing nahin. Nayi listing ke liye "Property list karein" dabayein.' },
  my_listings: { en: 'Your listings:', ur: 'آپ کی لسٹنگز:', ro: 'Aap ki listings:' },

  // ---- voice / misc ----
  heard: { en: '🎙️ I heard: "{text}"', ur: '🎙️ میں نے سنا: "{text}"', ro: '🎙️ Main ne suna: "{text}"' },
  voice_off: { en: 'Voice notes aren\'t available right now — please type your message.', ur: 'وائس نوٹ ابھی دستیاب نہیں — براہِ کرم پیغام لکھ کر بھیجیں۔', ro: 'Voice note abhi dastiyab nahin — barah-e-karam paigham likh kar bhejein.' },
  voice_failed: { en: 'I couldn\'t make out that voice note. Please try again or type it.', ur: 'میں وہ وائس نوٹ سمجھ نہیں سکا۔ دوبارہ کوشش کریں یا لکھ کر بھیجیں۔', ro: 'Main woh voice note samajh nahin saka. Dobara koshish karein ya likh kar bhejein.' },
  too_fast: { en: 'You\'re sending messages very quickly. Please wait a few minutes.', ur: 'آپ بہت تیزی سے پیغامات بھیج رہے ہیں۔ براہِ کرم چند منٹ انتظار کریں۔', ro: 'Aap bohat tezi se paighamat bhej rahe hain. Barah-e-karam chand minute intezar karein.' },
  pk_services: {
    en: 'AgenticCore Pakistan does property marketing — WhatsApp cards, social posts, flyers, reels, websites, ads and AI tools — at published prices: agenticcorepk.com/services.html\n\nOrdering here in Telegram is coming next. For now, order on the website or message us on WhatsApp.',
    ur: 'AgenticCore Pakistan پراپرٹی مارکیٹنگ کرتا ہے — واٹس ایپ کارڈز، سوشل پوسٹس، فلائرز، ریلز، ویب سائٹس، اشتہارات اور AI ٹولز — شائع شدہ قیمتوں پر: agenticcorepk.com/services.html\n\nیہاں ٹیلیگرام میں آرڈر کی سہولت جلد آ رہی ہے۔ فی الحال ویب سائٹ پر آرڈر کریں یا واٹس ایپ پر پیغام بھیجیں۔',
    ro: 'AgenticCore Pakistan property marketing karta hai — WhatsApp cards, social posts, flyers, reels, websites, ads aur AI tools — published prices par: agenticcorepk.com/services.html\n\nYahan Telegram mein order ki sahulat jald aa rahi hai. Filhaal website par order karein ya WhatsApp par paigham bhejein.'
  },
  avail_ask: {
    en: 'Is your listing "{title}" still available? Confirming shows buyers a "Confirmed available" badge for 30 days.',
    ur: 'کیا آپ کی لسٹنگ "{title}" ابھی دستیاب ہے؟ تصدیق کرنے سے خریداروں کو 30 دن کے لیے "Confirmed available" بیج نظر آتا ہے۔',
    ro: 'Kya aap ki listing "{title}" abhi dastiyab hai? Tasdeeq karne se khareedaron ko 30 din ke liye "Confirmed available" badge nazar aata hai.'
  },
  btn_still_available: { en: 'Yes, still available', ur: 'جی ہاں، دستیاب ہے', ro: 'Ji haan, dastiyab hai' },
  avail_done: { en: 'Thanks — marked as available for 30 days.', ur: 'شکریہ — 30 دن کے لیے دستیاب درج کر دیا۔', ro: 'Shukriya — 30 din ke liye dastiyab darj kar diya.' },
  enquiry: {
    en: 'New enquiry on "{title}" from {name}:\n\n"{message}"\n\nSee their contact details in your Dashboard: {url}',
    ur: '"{title}" پر {name} کی نئی انکوائری:\n\n"{message}"\n\nان کی رابطہ تفصیلات ڈیش بورڈ میں دیکھیں: {url}',
    ro: '"{title}" par {name} ki nayi enquiry:\n\n"{message}"\n\nUn ki contact tafseelat Dashboard mein dekhein: {url}'
  },
  listing_hidden: {
    en: 'Your listing "{title}" has been hidden by AgenticCore review. Reply here or message us on WhatsApp if you need help fixing it.',
    ur: 'آپ کی لسٹنگ "{title}" کو AgenticCore کے جائزے کے بعد چھپا دیا گیا ہے۔ ٹھیک کرنے میں مدد کے لیے یہیں جواب دیں یا واٹس ایپ پر پیغام بھیجیں۔',
    ro: 'Aap ki listing "{title}" ko AgenticCore ke jaize ke baad chupa diya gaya hai. Theek karne mein madad ke liye yahin jawab dein ya WhatsApp par paigham bhejein.'
  },
  freeze_warning: {
    en: 'Reminder: please set your website password within {days} day(s), or your account will be paused until you do. Tap below for your one-time sign-in link.',
    ur: 'یاد دہانی: براہِ کرم {days} دن کے اندر ویب سائٹ کا پاس ورڈ بنا لیں، ورنہ پاس ورڈ بننے تک آپ کا اکاؤنٹ رُک جائے گا۔ ایک بار کا سائن اِن لنک لینے کے لیے نیچے دبائیں۔',
    ro: 'Yaad dihani: barah-e-karam {days} din ke andar website ka password bana lein, warna password banne tak aap ka account ruk jayega. Ek baar ka sign-in link lene ke liye neeche dabayein.'
  },
  help: {
    en: 'I can:\n• open an AgenticCore Estate account\n• list your property (tell me about it, send photos, confirm)\n• show your listings\n• send you a one-time website sign-in link\n• order marketing from AgenticCore Pakistan (/order, /orders)\n\nYou can type or send a voice note, in English or Urdu. /menu shows the buttons again. Talk to a person: WhatsApp +1 808 998 5226.',
    ur: 'میں یہ کر سکتا ہوں:\n• AgenticCore Estate اکاؤنٹ کھولنا\n• آپ کی پراپرٹی لسٹ کرنا (بتائیں، تصاویر بھیجیں، تصدیق کریں)\n• آپ کی لسٹنگز دکھانا\n• ویب سائٹ کا ایک بار کا سائن اِن لنک بھیجنا\n• AgenticCore Pakistan سے مارکیٹنگ آرڈر کرنا (/order، /orders)\n\nآپ لکھ کر یا وائس نوٹ بھیج سکتے ہیں، انگریزی یا اردو میں۔ /menu سے بٹن دوبارہ آ جاتے ہیں۔ کسی انسان سے بات: واٹس ایپ +1 808 998 5226۔',
    ro: 'Main yeh kar sakta hoon:\n• AgenticCore Estate account kholna\n• aap ki property list karna (batayein, tasveerein bhejein, tasdeeq karein)\n• aap ki listings dikhana\n• website ka ek baar ka sign-in link bhejna\n• AgenticCore Pakistan se marketing order karna (/order, /orders)\n\nAap likh kar ya voice note bhej sakte hain, English ya Urdu mein. /menu se buttons dobara aa jate hain. Kisi insaan se baat: WhatsApp +1 808 998 5226.'
  },
  error: { en: 'Sorry, something went wrong on our side. Please try again in a minute.', ur: 'معذرت، ہماری طرف سے کوئی مسئلہ آ گیا۔ براہِ کرم ایک منٹ بعد دوبارہ کوشش کریں۔', ro: 'Maazrat, hamari taraf se koi masla aa gaya. Barah-e-karam ek minute baad dobara koshish karein.' }
};

Object.assign(S, S_PK);

export function t(key, lang, vars) {
  const entry = S[key];
  let s = entry ? (entry[lang] || entry.en) : key;
  Object.keys(vars || {}).forEach((k) => { s = s.split('{' + k + '}').join(String(vars[k])); });
  return s;
}
