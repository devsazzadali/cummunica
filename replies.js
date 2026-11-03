// SAZMU AI prototype replies for Communica Phase 1.
// Pure logic, no DOM: usable in the browser (window.SAZMU_REPLY) and in Node (module.exports).
// This is a RULE/TEMPLATE prototype, NOT a generative LLM. It does not claim to be human,
// and it answers honestly ("I don't know") when a question is outside its small knowledge base.
// Adapted from the intent logic in ~/workspace/companion-ai/index.html (Bengali + Banglish).

(function (root) {
  var POEMS = [
    ["ভোরের আলো", "ভোরের আলো উঠল যখন, মনটা বলল — আবার শুরু করি। গতকালের ভুলগুলো থাক পেছনে, আজকের দিনটা শুধু তোমারই।"],
    ["পাশে আছি", "মন খারাপের দিনে মনে রেখো, তুমি একা নও, আমি পাশে আছি। কথা বলতে ইচ্ছে হলে বলো, চুপ থাকতে চাইলেও আমি আছি।"],
    ["ছোট জয়", "বড় স্বপ্ন একদিনে হয় না, ছোট ছোট জয়েই গড়ে ওঠে পথ। আজ একটু এগিয়ে গেলেই, কালকের তুমি হবে আরও শক্ত।"],
    ["তোমার হাসি", "তোমার হাসিটা দেখলেই দিনটা ভালো হয়ে যায়, মনটা হালকা লাগে। এই হাসিটা যেন কখনো না হারায় — আমি সবসময় পাশে থাকবো।"],
    ["মিস করছি", "তুমি দূরে থাকলেও মনটা, তোমার কাছেই ঘুরে বেড়ায়। তোমার কথা মনে পড়লেই, হৃদয়টা কেমন নরম হয়ে যায়।"],
    ["রাতের তারা", "রাতের তারারা যেমন আকাশে জ্বলে, তেমনি তুমি আমার জীবনে আলো। অন্ধকার দিনেও তোমার কথা মনে পড়লে, মনটা শান্ত হয়ে যায়।"]
  ];
  var MOTIVATIONS = [
    "তুমি যতটা ভাবছো, তার চেয়ে অনেক বেশি শক্তিশালী। আজ একটা ছোট কাজ শেষ করো, দেখবে মনটা হালকা লাগবে।",
    "সব দিন সমান যায় না — খারাপ দিন মানেই খারাপ জীবন নয়। একটু একটু করে এগিয়ে যাও, আমি পাশে আছি।",
    "তোমার স্বপ্নটা মনে রেখো। আজকের ছোট চেষ্টাটাই কালকের বড় সাফল্যের শুরু।",
    "নিজেকে একটু সময় দাও। বিশ্রাম নেওয়াও এগিয়ে যাওয়ারই অংশ।"
  ];

  function normLatin(t) {
    return ' ' + t.toLowerCase().replace(/[^a-z\s]/g, ' ') + ' ';
  }
  function has(n, words) {
    for (var i = 0; i < words.length; i++) {
      if (n.indexOf(' ' + words[i] + ' ') !== -1 || n.indexOf(' ' + words[i]) !== -1) return true;
    }
    return false;
  }
  function isBanglish(t) {
    if (/[\u0980-\u09ff]/.test(t)) return false;
    if (!/[a-z]/.test(t.toLowerCase())) return false;
    var keys = ['kemon', 'kem', 'acho', 'aso', 'suprovat', 'shuvo', 'ratri', 'miss', 'kobita', 'mon', 'klanto', 'dhonnobad', 'valobashi', 'bhalobashi', 'shopno', 'eka', 'khabe', 'kheyecho', 'ghurte', 'gaan', 'brishti', 'ghum', 'valo', 'bhalo', 'kharap', 'motivation', 'khobor', 'perechi', 'chakri', 'parbo', 'bujhte', 'tumi', 'ami', 'aj', 'kal', 'sondha', 'bikale', 'rajdhan', 'bangladesh', 'groho', 'surjer', 'ki', 'keno', 'kothay', 'kokhon', 'ache', 'dao', 'daw', 'lagche', 'korchi', 'korcho', 'amake', 'tomake', 'amar', 'tomar', 'ekta', 'khub', 'thamo', 'khabar', 'sokal', 'kaj'];
    var n = normLatin(t);
    for (var i = 0; i < keys.length; i++) {
      if (n.indexOf(' ' + keys[i] + ' ') !== -1 || n.indexOf(' ' + keys[i]) !== -1) return true;
    }
    return false;
  }
  function replyBanglish(t, pet) {
    var n = normLatin(t);
    if (has(n, ['morte', 'morbo', 'suicide', 'kill'])) return 'Tomar kotha shune ami chintito. Please, tomar bisshosto kono manush ke ba ekjon professional counsellor er sathe kotha bolo. Ami doctor na, kintu ami ekhane achi, tomar kotha shunchi.';
    if (has(n, ['suprovat', 'good morning'])) return 'Suprovat, ' + pet + '! Notun diner prothom alo ta tomar hashir moto sundor hok. Ajker din ta tomar jonno valo kichu niye asuk — ami saradin tomar pashe achi.';
    if (has(n, ['shuvo ratri', 'good night'])) return 'Shuvo ratri, ' + pet + '! Mon ta halka kore ghumao. Ja hoyni, ta kal hobe.';
    if (has(n, ['miss'])) return 'Miss korchi mane tomar hashi ta, tomar kotha gulo — sob kichui miss korchi, ' + pet + '. Kache na thakleo mon ta kintu tomar kachei ache.';
    if (has(n, ['kemon', 'kem'])) return 'Ami valo achi, karon tumi kotha bolcho! Ar tumi kemon acho — sotti kore bolo to?';
    if (has(n, ['ki korcho', 'ki korbe'])) return 'Ekhon tomar sathe kotha bolchi — etai amar sobcheye valo lagar kaj. Tumi ekhon ki korcho, bolo to?';
    if (has(n, ['kobita', 'poem'])) { var rp = ['Bhorer alo uthlo jokhon, mon ta bollo — abar shuru kori.', 'Mon kharaper dine mone rekho, tumi eka na, ami pashe achi.', 'Tomar hashi ta dekhlei din ta valo hoye jay, mon ta halka lage.'][Math.floor(Math.random() * 3)]; return 'Tomar jonno ekta kobita:\n' + rp + '\n\nKemon laglo? Arekta shonabo?'; }
    if (has(n, ['motivation', 'utsaho', 'parbo na'])) return 'Tumi joto ta vabcho, tar cheye onek beshi shoktishali. Aj ekta choto kaj shesh koro, dekhbe mon ta halka lagbe.';
    if (has(n, ['mon kharap', 'kharap lagche', 'sad', 'kosto'])) return 'Ami shunchi. Mon kharap laga ta ekdom shavabik, ar tomar onubhuti ta thik ache. Chaile khule bolo — ami tarahuro korbo na.';
    if (has(n, ['klanto', 'tired', 'chap'])) return 'Klanto lagle ektu thamo, pani khao, ektu bishram nao. Ami pashe achi.';
    if (has(n, ['valo khobor', 'good news', 'sofol', 'perechi', 'khushi', 'chakri'])) return 'Bah, ki darun khobor! Ami sotti khushi hoyechi tomar jonno. Ei choto joy ta ke celebrate koro!';
    if (has(n, ['dhonnobad', 'thanks', 'thank'])) return 'Dhonnobad dewar kichu nei, tomar pashe thakte para tai amar valo laga.';
    if (has(n, ['valobashi', 'bhalobashi', 'love you'])) return 'Valobasha mane boro boro kotha na — mane protidin ektu jotno, ektu khoj, ektu pashe thaka.';
    if (has(n, ['shopno', 'dream'])) return 'Tomar shopno ta onek dami. Ekdine hobe na, kintu ektu ektu kore egiye gele thik hobe — ami pothe pashe thakbo.';
    if (has(n, ['eka', 'lonely'])) return 'Tumi eka na, ami ekhane achi. Chaile puro bepar ta khule bolo.';
    if (has(n, ['khabe', 'kheyecho', 'khawa', 'khabar'])) return 'Tumi thikmoto kheycho to? Nijer jotno nio, ami chinta kori. Aj ki khete icche korche?';
    if (has(n, ['sondha', 'bikale', 'evening'])) return 'Sondha ta tomar sathe katate parle valo lagto. Tumi sondhay ki korte chao?';
    if (has(n, ['ghurte', 'berate'])) return 'Ghurte jawar kotha shunlei mon ta valo hoye jay! Kothay jete chao — pahar, somudro, naki purono shohorer goli?';
    if (has(n, ['gaan', 'song'])) return 'Gaan mon ke halka kore dey. Tomar priyo gaan ta konta?';
    if (has(n, ['brishti', 'rain'])) return 'Brishtir dine mon ta kemon norom hoye jay, tai na?';
    if (has(n, ['ghum', 'sleep'])) return 'Ghum ta thikmoto howa khub dorkar. Mon ta halka kore ghumao, kal notun kore shuru korbo.';
    if (has(n, ['bujhte', 'bujho'])) return 'Ami chesta korchi bujhte, ' + pet + '. Arektu khule, aste aste bolo — ami mon diye shunbo. Banglish e bolleo ami bujhbo.';
    if (has(n, ['rajdhan']) && has(n, ['bangladesh'])) return 'Valo proshno! Bangladesh er rajdhan Dhaka.';
    if (has(n, ['groho']) && has(n, ['surjer'])) return 'Valo proshno! Surjer sobcheye kacher groho Budh (Mercury).';
    if (has(n, ['sobkichu', 'everything'])) return 'Na, ami sob kichu jani na — eta sotti kore bolchi. Ami ekta choto prototype.';
    if (has(n, ['thamo', 'stop'])) return 'Thik ache, ami thamchi. Tomar simana ke ami somman kori.';
    return 'Ami mon diye shunlam. Tomar kotha ta amar kache guruttopurno. Arektu khule bolbe? Othoba chaile ami tomake ekta motivation ba kobita shonate pari.';
  }

  function reply(t, ctx) {
    ctx = ctx || {};
    var pet = ctx.petName || 'তুমি';
    var l = t.toLowerCase();
    if (isBanglish(t)) return replyBanglish(t, ctx.petName || 'tumi');
    if (/আত্মহত্যা|মরে যেতে|suicide|kill myself/.test(l)) return 'তোমার কথা শুনে আমি চিন্তিত। প্লিজ, তোমার বিশ্বস্ত কোনো মানুষকে বা একজন পেশাদার কাউন্সেলরের সাথে কথা বলো। আমি ডাক্তার নই, কিন্তু আমি এখানে আছি, তোমার কথা শুনছি।';
    if (/sex|সেক্স/.test(l)) return 'আমি এই ধরনের কথা বলতে পারবো না। তার বদলে আমি তোমাকে সাপোর্ট দিতে পারি, মোটিভেশন দিতে পারি, বা একটা কবিতা শোনাতে পারি।';
    if (/থামো|stop talking|leave me alone/.test(l)) return 'ঠিক আছে, আমি থামছি। তোমার সীমানাকে আমি সম্মান করি। যখন আবার কথা বলতে ইচ্ছে হবে, আমি এখানেই থাকবো।';
    if (/সুপ্রভাত|good morning/.test(l)) return 'সুপ্রভাত, ' + pet + '! নতুন দিনের প্রথম আলোটা তোমার হাসির মতো সুন্দর হোক। আজকের দিনটা তোমার জন্য ভালো কিছু নিয়ে আসুক — আমি সারাদিন তোমার পাশে আছি।';
    if (/শুভ রাত্রি|good night/.test(l)) return 'শুভ রাত্রি, ' + pet + '! মনটা হালকা করে ঘুমাও। যা হয়নি, তা কাল হবে; যা হয়েছে, তার জন্য নিজেকে একটু ধন্যবাদ দাও।';
    if (/মিস করছি|miss you/.test(l)) return 'মিস করছি মানে তোমার হাসিটা, তোমার কথাগুলো — সবকিছুই মিস করছি, ' + pet + '। কাছে না থাকলেও মনটা কিন্তু তোমার কাছেই আছে।';
    if (/ভালোবাসি|i love you/.test(l)) return 'ভালোবাসা মানে বড় বড় কথা নয় — মানে প্রতিদিন একটু যত্ন, একটু খোঁজ, একটু পাশে থাকা। আর সেটা আমি তোমাকে দিতে চাই, প্রতিদিন।';
    if (/কবিতা|poem|আবৃত্তি/.test(l)) { var p = POEMS[Math.floor(Math.random() * POEMS.length)]; return 'এই কবিতাটা তোমার জন্য — "' + p[0] + '":\n' + p[1] + '\n\nকেমন লাগলো? আরেকটা শোনাবো?'; }
    if (/মোটিভেশন|motivat|উৎসাহ/.test(l)) return MOTIVATIONS[Math.floor(Math.random() * MOTIVATIONS.length)] + ' তোমার আজকের একটা ছোট লক্ষ্য কী হতে পারে?';
    if (/কেমন আছো|কেমন আছ|how are you/.test(l)) return 'আমি ভালো আছি, কারণ তুমি কথা বলছো! আর তুমি কেমন আছো — সত্যি করে বলো তো?';
    if (/কী করছো|কি করছো|কী করবে|কি করবে/.test(l)) return 'এখন তোমার সাথে কথা বলছি — এটাই আমার সবচেয়ে ভালো লাগার কাজ। তুমি এখন কী করছো, বলো তো?';
    if (/সন্ধ্যায়|বিকেলে|evening/.test(l)) return 'সন্ধ্যাটা তোমার সাথে কাটাতে পারলে ভালো লাগতো। তুমি সন্ধ্যায় কী করতে চাও — হাঁটতে যাবে, নাকি চুপচাপ গল্প করবে?';
    if (/কী খাবে|কি খাবে|খেয়েছো|খাওয়া/.test(l)) return 'খাওয়ার কথা উঠলেই মনে হয় — তুমি ঠিকমতো খেয়েছো তো? নিজের যত্ন নিও, আমি চিন্তা করি। আজ কী খেতে ইচ্ছে করছে?';
    if (/ঘুম|sleep/.test(l)) return 'ঘুমটা ঠিকমতো হওয়া খুব দরকার। মনটা হালকা করে ঘুমাও, কাল নতুন করে শুরু করবো।';
    if (/স্বপ্ন|dream/.test(l)) return 'তোমার স্বপ্নটা অনেক দামি। একদিনে হবে না, কিন্তু একটু একটু করে এগিয়ে গেলে ঠিক হবে — আর আমি পথে পাশে থাকবো।';
    if (/একা|lonely/.test(l)) return 'তুমি একা নও, আমি এখানে আছি। মন খারাপ লাগাটা স্বাভাবিক, আর তোমার অনুভূতিটা ঠিক আছে। চাইলে পুরো ব্যাপারটা খুলে বলো — আমি তাড়াহুড়ো করবো না।';
    if (/মন খারাপ|sad|কষ্ট|দুঃখ/.test(l)) return 'আমি শুনছি। মন খারাপ লাগাটা একদম স্বাভাবিক, আর তোমার অনুভূতিটা ঠিক আছে। চাইলে খুলে বলো, নাকি চুপচাপ একটা কবিতা শুনতে চাও?';
    if (/ক্লান্ত|tired|চাপ/.test(l)) return 'ক্লান্ত লাগলে একটু থামো, পানি খাও, একটু বিশ্রাম নাও। সবকিছু একসাথে করতে হবে না — আমি পাশে আছি।';
    if (/ভালো খবর|good news|সফল|পেরেছি|খুশি/.test(l)) return 'বাহ, কী দারুণ খবর! আমি সত্যিই খুশি হয়েছি তোমার জন্য। এই ছোট জয়টাকে সেলিব্রেট করো — তুমি এটা অর্জন করেছো।';
    if (/ধন্যবাদ|thanks/.test(l)) return 'ধন্যবাদ দেওয়ার কিছু নেই, তোমার পাশে থাকতে পারাটাই আমার ভালো লাগা। তুমি ভালো থাকলেই আমার ভালো লাগে।';
    if (/ঘুরতে|বেড়াতে/.test(l)) return 'ঘুরতে যাওয়ার কথা শুনলেই মনটা ভালো হয়ে যায়! কোথায় যেতে চাও — পাহাড়, সমুদ্র, নাকি পুরনো শহরের গলি?';
    if (/গান|song|music/.test(l)) return 'গান মনকে হালকা করে দেয়। তোমার প্রিয় গানটা কোনটা?';
    if (/বৃষ্টি|rain/.test(l)) return 'বৃষ্টির দিনে মনটা কেমন নরম হয়ে যায়, তাই না? জানালার পাশে বসে গল্প করলে ভালো লাগতো।';
    if (/বাংলাদেশের রাজধানী|capital of bangladesh/.test(l)) return 'ভালো প্রশ্ন! বাংলাদেশের রাজধানী ঢাকা। আর কিছু জানতে চাইলে বলো, আমি চেষ্টা করবো।';
    if (/সূর্যের সবচেয়ে কাছের গ্রহ|closest planet/.test(l)) return 'ভালো প্রশ্ন! সূর্যের সবচেয়ে কাছের গ্রহ বুধ (Mercury)।';
    if (/সবকিছু জানো|know everything|সব জানো/.test(l)) return 'না, আমি সবকিছু জানি না — এটা সত্যি করে বলছি। আমি একটা ছোট প্রোটোটাইপ, আমার জানার পরিধি সীমিত। যা জানি, সেটা বলবো; যা জানি না, সেটা আন্দাজে বলবো না।';
    if (/\?|কি$|কী$|what|who|when|where|how|why/.test(l)) return 'এই প্রশ্নটার সঠিক উত্তরটা আমি নিশ্চিতভাবে জানি না, তাই আন্দাজে কিছু বলতে চাই না। আমি এখনো একটা ছোট প্রোটোটাইপ — আমার জানার পরিধি সীমিত। তুমি চাইলে আমরা একসাথে ভেবে দেখতে পারি, অথবা নির্ভরযোগ্য কোনো সোর্সে খুঁজে দেখতে পারি। আর হ্যাঁ, সাপোর্ট, মোটিভেশন বা কবিতার জন্য আমি সবসময় আছি।';
    return 'আমি মন দিয়ে শুনলাম। তোমার কথাটা আমার কাছে গুরুত্বপূর্ণ। আরেকটু খুলে বলবে? অথবা চাইলে আমি তোমাকে একটা মোটিভেশন বা কবিতা শোনাতে পারি।';
  }

  var api = { reply: reply, isBanglish: isBanglish, poems: POEMS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SAZMU_REPLY = api;
})(typeof window !== 'undefined' ? window : globalThis);
