const crypto = require("crypto");

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const TWITTER_API_KEY = process.env.TWITTER_API_KEY;
const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET;
const TWITTER_ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN;
const TWITTER_ACCESS_SECRET = process.env.TWITTER_ACCESS_SECRET;

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const niches = [
  {
    name: "تطوير الذات",
    examples: [
      "النجاح ليس وجهة بل رحلة",
      "كل يوم فرصة جديدة لتبدأ من جديد",
      "العادات الصغيرة تصنع الفرق الكبير",
    ],
  },
  {
    name: "ريادة الأعمال",
    examples: [
      "أفشل بسرعة وتعلم أسرع",
      "السوق لا ينتظر المترددين",
      "العميل أولاً ثم الباقي يأتي",
    ],
  },
  {
    name: "اقتباسات تحفيزية",
    examples: [
      "لا تنتظر الفرصة بل اصنعها",
      "الطريق إلى القمة يبدأ بخطوة",
      "الإصرار أقوى من الظروف",
    ],
  },
  {
    name: "التسويق الرقمي",
    examples: [
      "المحتوى هو الملك",
      "ثقتهم أغلى من مشاهداتهم",
      "المحتوى القيم يبني جمهوراً وفيّاً",
    ],
  },
];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function oauth1Signature(method, url, params, consumerSecret, tokenSecret) {
  const paramString = Object.keys(params)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join("&");

  const signatureBase = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret || "")}`;

  return crypto.createHmac("sha1", signingKey).update(signatureBase).digest("base64");
}

function generateOAuthHeader(method, url, body, apiKey, apiSecret, token, tokenSecret) {
  const oauth = {
    oauth_consumer_key: apiKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000),
    oauth_token: token,
    oauth_version: "1.0",
  };

  const params = { ...oauth };
  if (body) params.status = body;

  oauth.oauth_signature = oauth1Signature(method, url, params, apiSecret, tokenSecret);

  return (
    "OAuth " +
    Object.entries(oauth)
      .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
      .join(", ")
  );
}

async function askAI(tweetCount) {
  const niche = pick(niches);
  const prompt = `أنت مؤثر عربي على تويتر/X. اكتب ${tweetCount} تغريدة منفصلة عن "${niche.name}".

كل تغريدة:
- قصيرة ومؤثرة (30-100 حرف)
- أسلوب جذاب وتحفيزي
- بدون هاشتاقات
- مناسبة للنشر العام

أمثلة على التغريدات في هذا المجال:
${niche.examples.map((e) => `- "${e}"`).join("\n")}

أجب فقط بالتغريدات، كل تغريدة في سطر منفصل، بدون أرقام أو علامات`;

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices[0].message.content
    .split("\n")
    .map((l) => l.replace(/^["'\d\s\-\.]+/, "").trim())
    .filter((l) => l.length > 10);
}

async function postTweet(text) {
  const url = "https://api.twitter.com/2/tweets";
  const body = JSON.stringify({ text });

  const authHeader = generateOAuthHeader(
    "POST",
    url,
    { text },
    TWITTER_API_KEY,
    TWITTER_API_SECRET,
    TWITTER_ACCESS_TOKEN,
    TWITTER_ACCESS_SECRET
  );

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Twitter error ${res.status}: ${err}`);
  }

  return res.json();
}

async function run() {
  console.log("🐦 وكيل تويتر/X يعمل...");
  console.log("🤖 جاري إنشاء تغريدات بالذكاء الاصطناعي...");

  const tweets = await askAI(3);
  console.log(`✅ تم إنشاء ${tweets.length} تغريدة`);

  for (const tweet of tweets) {
    try {
      console.log(`📤 جاري النشر: "${tweet.substring(0, 50)}..."`);
      const result = await postTweet(tweet);
      console.log(`✅ تم النشر: https://x.com/user/status/${result.data.id}`);
    } catch (err) {
      console.error(`❌ فشل نشر تغريدة:`, err.message);
    }
  }

  console.log("🏁 انتهى");
}

run().catch((err) => {
  console.error("❌ فشل:", err.message);
  process.exit(1);
});
