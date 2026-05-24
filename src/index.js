const { TwitterApi } = require("twitter-api-v2");
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

const niches = [
  {
    name: "تطوير الذات",
    examples: [
      "النجاح ليس وجهة بل رحلة",
      "كل يوم فرصة جديدة لتبدأ من جديد",
    ],
  },
  {
    name: "ريادة الأعمال",
    examples: [
      "أفشل بسرعة وتعلم أسرع",
      "السوق لا ينتظر المترددين",
    ],
  },
  {
    name: "اقتباسات تحفيزية",
    examples: [
      "لا تنتظر الفرصة بل اصنعها",
      "الإصرار أقوى من الظروف",
    ],
  },
  {
    name: "التسويق الرقمي",
    examples: [
      "المحتوى هو الملك",
      "ثقتهم أغلى من مشاهداتهم",
    ],
  },
];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

async function generateTweets(count) {
  const niche = pick(niches);
  const prompt = `أنت مؤثر عربي على تويتر/X. اكتب ${count} تغريدة عن "${niche.name}".

كل تغريدة:
- قصيرة ومؤثرة (30-100 حرف)
- أسلوب جذاب وتحفيزي
- بدون هاشتاقات

أمثلة:
${niche.examples.map((e) => `- "${e}"`).join("\n")}

أجب فقط بالتغريدات، كل واحدة في سطر منفصل.`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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

  if (!res.ok) throw new Error(`AI error ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content
    .split("\n")
    .map((l) => l.replace(/^["'\d\s\-\.]+/, "").trim())
    .filter((l) => l.length > 10 && l.length < 280);
}

async function run() {
  console.log("🐦 وكيل تويتر/X يعمل...");
  const tweets = await generateTweets(3);
  console.log(`✅ تم إنشاء ${tweets.length} تغريدة`);

  for (const text of tweets) {
    try {
      const { data } = await twitterClient.v2.tweet(text.substring(0, 279));
      console.log(`✅ تم النشر: https://x.com/user/status/${data.id}`);
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
