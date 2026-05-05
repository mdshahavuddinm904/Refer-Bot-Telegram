const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");
const config = require("./config");

const bot = new Telegraf(config.BOT_TOKEN);

// ===== DB =====
function loadDB() {
  return JSON.parse(fs.readFileSync("db.json"));
}

function saveDB(data) {
  fs.writeFileSync("db.json", JSON.stringify(data, null, 2));
}

// ===== MEMORY =====
const withdrawStep = new Map();

// ===== CHECK JOIN =====
async function isJoined(ctx) {
  const userId = ctx.from.id;

  for (let ch of config.CHANNELS) {
    try {
      const res = await ctx.telegram.getChatMember(ch, userId);
      const status = res.status;

      if (status === "left" || status === "kicked") {
        return false;
      }
    } catch {
      return false;
    }
  }

  return true;
}

// ===== FORCE JOIN MIDDLEWARE =====
bot.use(async (ctx, next) => {
  if (!ctx.from) return next();

  const ok = await isJoined(ctx);

  if (!ok) {
    return ctx.reply(
      "🚨 Please join channels first!",
      Markup.inlineKeyboard([
        [Markup.button.url("🌍 Global Channel", "https://t.me/Global_Method_Channel")],
        [Markup.button.url("🔒 Main Channel", "https://t.me/+75BQ2Qw9UZI4OTM1")],
        [Markup.button.callback("✅ Joined", "check_join")]
      ])
    );
  }

  return next();
});

// ===== START (REFERRAL) =====
bot.start(async (ctx) => {
  const db = loadDB();
  const id = String(ctx.from.id);
  const ref = ctx.startPayload;

  if (!db[id]) {
    db[id] = { balance: 0, ref: 0 };

    if (ref && ref !== id && db[ref]) {
      db[ref].balance += 5;
      db[ref].ref += 1;
    }

    saveDB(db);
  }

  return ctx.reply(
`✅ Welcome!

🇧🇩 বাংলায়:
আপনি এখন বট ব্যবহার করতে পারবেন।
TikTok ভিডিও ডাউনলোড করতে ভিডিও লিংক পাঠান 📥

🇬🇧 English:
You can now use the bot. Send a TikTok link to download video 📥`
  );
});

// ===== JOIN BUTTON =====
bot.action("check_join", async (ctx) => {
  const ok = await isJoined(ctx);

  if (!ok) {
    return ctx.answerCbQuery("❌ Join first!", { show_alert: true });
  }

  return ctx.reply("✅ Joined successfully! এখন ব্যবহার করতে পারো 🎉");
});

// ===== REFER =====
bot.command("refer", (ctx) => {
  const id = ctx.from.id;
  const link = `https://t.me/MegaUtilityBot?start=${id}`;

  ctx.reply(`👥 Your Referral Link:\n${link}\n\n💰 Earn 5৳ per user`);
});

// ===== BALANCE =====
bot.command("balance", (ctx) => {
  const db = loadDB();
  const id = String(ctx.from.id);

  const bal = db[id]?.balance || 0;
  const ref = db[id]?.ref || 0;

  ctx.reply(`💰 Balance: ${bal}৳\n👥 Referrals: ${ref}`);
});

// ===== WITHDRAW START =====
bot.command("withdraw", (ctx) => {
  const id = String(ctx.from.id);

  withdrawStep.set(id, "amount");

  ctx.reply("💸 Enter withdraw amount (minimum 50৳):");
});

// ===== TEXT HANDLER =====
bot.on("text", async (ctx) => {
  const id = String(ctx.from.id);
  const text = ctx.message.text;
  const db = loadDB();

  // ignore commands
  if (text.startsWith("/")) return;

  // ===== STEP 1: AMOUNT =====
  if (withdrawStep.get(id) === "amount") {
    const amount = parseInt(text);

    if (isNaN(amount)) {
      return ctx.reply("❌ Enter valid number!");
    }

    if (amount < 50) {
      return ctx.reply("❌ Minimum withdraw is 50৳");
    }

    if (!db[id] || db[id].balance < amount) {
      return ctx.reply("❌ Not enough balance!");
    }

    withdrawStep.set(id, { step: "method", amount });

    return ctx.reply(
      "💳 Select payment method:",
      Markup.inlineKeyboard([
        [Markup.button.callback("📱 Bkash", "bkash")],
        [Markup.button.callback("📱 Nagad", "nagad")]
      ])
    );
  }

  // ===== STEP 2: NUMBER =====
  if (withdrawStep.get(id)?.step === "number") {
    const info = withdrawStep.get(id);
    const number = text;

    db[id].balance -= info.amount;
    saveDB(db);

    withdrawStep.delete(id);

    ctx.telegram.sendMessage(
      config.ADMIN_ID,
`💸 New Withdraw Request

👤 User: ${id}
💰 Amount: ${info.amount}৳
💳 Method: ${info.method}
📲 Number: ${number}`
    );

    return ctx.reply("✅ Withdraw request sent!");
  }

  ctx.reply("📩 Send TikTok link or use commands");
});

// ===== PAYMENT METHOD =====
bot.action(["bkash", "nagad"], (ctx) => {
  const id = String(ctx.from.id);
  const data = withdrawStep.get(id);

  if (!data || data.step !== "method") {
    return ctx.reply("❌ Start withdraw again");
  }

  const method = ctx.match[0];

  withdrawStep.set(id, {
    step: "number",
    amount: data.amount,
    method
  });

  ctx.reply("📲 Enter your number:");
});

// ===== ERROR =====
bot.catch((err) => console.log(err));

bot.launch();
console.log("🚀 Bot running...");
