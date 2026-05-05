const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");
const config = require("./config");

const bot = new Telegraf(config.BOT_TOKEN);
const DB_FILE = "./db.json";

/* ================= DB ================= */
function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

/* ================= JOIN CHECK ================= */
async function checkJoin(ctx) {
  try {
    const res = await bot.telegram.getChatMember("@Global_Method_Channel", ctx.from.id);
    return ["creator", "administrator", "member"].includes(res.status);
  } catch {
    return false;
  }
}

/* ================= STATES ================= */
const withdrawState = {};
const supportState = {};
const replyState = {};

/* ================= START ================= */
bot.start(async (ctx) => {
  const db = loadDB();
  const id = ctx.from.id;
  const ref = ctx.startPayload;

  if (!db.users[id]) {
    db.users[id] = {
      balance: 0,
      referrals: 0,
      joined: false,
      referredBy: ref || null,
      rewarded: false,
      lastBonus: 0
    };
  }

  const joined = await checkJoin(ctx);

  if (!joined) {
    saveDB(db);
    return ctx.reply(
      "👋 Welcome!\nJoin required:",
      Markup.inlineKeyboard([
        [Markup.button.url("🌍 Join Channel", "https://t.me/Global_Method_Channel")],
        [Markup.button.callback("✅ I Joined", "check_join")]
      ])
    );
  }

  db.users[id].joined = true;
  saveDB(db);

  return ctx.reply(`✅ Welcome!

💰 Referral System Active
🔗 /refer
💰 /balance
💸 /withdraw
🎁 /bonus
📩 /support`);
});

/* ================= JOIN ================= */
bot.action("check_join", async (ctx) => {
  const db = loadDB();
  const id = ctx.from.id;

  const joined = await checkJoin(ctx);
  if (!joined) return ctx.reply("❌ Join channel first!");

  db.users[id].joined = true;

  const ref = db.users[id].referredBy;

  if (ref && db.users[ref] && !db.users[id].rewarded) {
    db.users[ref].balance += 20;
    db.users[ref].referrals += 1;

    bot.telegram.sendMessage(ref, "🎉 You earned $20 from referral!");

    db.users[id].rewarded = true;
  }

  saveDB(db);
  return ctx.reply("✅ Joined Successfully!");
});

/* ================= REFER ================= */
bot.command("refer", (ctx) => {
  const link = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;
  ctx.reply(`🔗 Your Link:\n${link}\n\n💰 Earn $20 per referral`);
});

/* ================= BALANCE ================= */
bot.command("balance", (ctx) => {
  const db = loadDB();
  const user = db.users[ctx.from.id];
  ctx.reply(`💰 Balance: $${user?.balance || 0}`);
});

/* ================= BONUS ================= */
bot.command("bonus", (ctx) => {
  const db = loadDB();
  const user = db.users[ctx.from.id];

  const now = Date.now();
  if (now - user.lastBonus < 86400000) {
    return ctx.reply("⏳ Bonus available every 24 hours");
  }

  user.balance += 50;
  user.lastBonus = now;

  saveDB(db);
  ctx.reply("🎁 You received $50 bonus!");
});

/* ================= WITHDRAW ================= */
bot.command("withdraw", (ctx) => {
  ctx.reply(
    "💸 Select Method:",
    Markup.inlineKeyboard([
      [Markup.button.callback("📱 BKash", "wd_bkash")],
      [Markup.button.callback("📱 Nagad", "wd_nagad")],
      [Markup.button.callback("💰 Binance", "wd_binance")],
      [Markup.button.url("🟢 Support ID", "https://t.me/Smart_Method_Owner")]
    ])
  );
});

function askNumber(ctx, method) {
  withdrawState[ctx.from.id] = { method };
  ctx.reply(`Enter your ${method} number:`);
}

bot.action("wd_bkash", (ctx) => askNumber(ctx, "BKash"));
bot.action("wd_nagad", (ctx) => askNumber(ctx, "Nagad"));
bot.action("wd_binance", (ctx) => askNumber(ctx, "Binance"));

/* ================= MESSAGE HANDLER ================= */
bot.on("text", async (ctx) => {
  const db = loadDB();
  const id = ctx.from.id;

  // withdraw flow
  if (withdrawState[id]) {
    const user = db.users[id];

    if (!user || user.balance < 5) {
      delete withdrawState[id];
      return ctx.reply("❌ Minimum withdraw is $5");
    }

    const number = ctx.message.text;
    const method = withdrawState[id].method;

    const msg = `💸 Withdraw Request

User: ${id}
Username: @${ctx.from.username || "NoUsername"}
Amount: $${user.balance}
Method: ${method}
Number: ${number}`;

    await bot.telegram.sendMessage(
      config.ADMIN_ID,
      msg,
      Markup.inlineKeyboard([
        [Markup.button.callback(`✅ Approve ${id}`, `approve_${id}`)]
      ])
    );

    delete withdrawState[id];
    return ctx.reply("✅ Request sent!");
  }

  // support flow
  if (supportState[id]) {
    const msg = ctx.message.text;

    await bot.telegram.sendMessage(
      config.ADMIN_ID,
      `📩 Support Message\nUser: ${id}\n\n${msg}`,
      Markup.inlineKeyboard([
        [Markup.button.callback("Reply", `reply_${id}`)]
      ])
    );

    supportState[id] = false;
    return ctx.reply("✅ Sent to admin!");
  }

  // admin reply
  if (ctx.from.id === config.ADMIN_ID && replyState[id]) {
    await bot.telegram.sendMessage(replyState[id], `📩 Admin:\n${ctx.message.text}`);
    replyState[id] = null;
    return ctx.reply("✅ Reply sent");
  }
});

/* ================= APPROVE ================= */
bot.action(/approve_(.+)/, async (ctx) => {
  if (ctx.from.id !== config.ADMIN_ID) return;

  const userId = ctx.match[1];
  const db = loadDB();

  if (!db.users[userId]) return;

  db.users[userId].balance = 0;
  saveDB(db);

  await bot.telegram.sendMessage(
    userId,
    "✅ Your payment has been sent!\nPlease check your wallet."
  );

  ctx.reply("✅ Approved!");
});

/* ================= SUPPORT ================= */
bot.command("support", (ctx) => {
  supportState[ctx.from.id] = true;
  ctx.reply("✉️ Send your message:");
});

bot.action(/reply_(.+)/, (ctx) => {
  if (ctx.from.id !== config.ADMIN_ID) return;
  replyState[ctx.from.id] = ctx.match[1];
  ctx.reply("✉️ Send reply:");
});

/* ================= GLOBAL RESET ================= */
bot.command("delete", (ctx) => {
  if (ctx.from.id !== config.ADMIN_ID) return;

  ctx.reply(
    "⚠️ Reset all users?",
    Markup.inlineKeyboard([
      [Markup.button.callback("✅ Confirm", "reset_yes")],
      [Markup.button.callback("❌ Cancel", "reset_no")]
    ])
  );
});

bot.action("reset_no", (ctx) => ctx.reply("❌ Cancelled"));

bot.action("reset_yes", async (ctx) => {
  const db = loadDB();
  const users = Object.keys(db.users);

  users.forEach((u) => {
    db.users[u].balance = 0;
    db.users[u].referrals = 0;
    db.users[u].rewarded = false;
  });

  saveDB(db);

  ctx.reply("✅ All users reset");

  for (let u of users) {
    try {
      await bot.telegram.sendMessage(
        u,
        "⚠️ Due to server issue, all balances are reset.\nPlease continue using bot 🙏",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🟢 Support ID", url: "https://t.me/Smart_Method_Owner" }]
            ]
          }
        }
      );
    } catch {}
  }
});

/* ================= ERROR ================= */
bot.catch(console.log);

bot.launch();
console.log("🚀 Bot Running...");
