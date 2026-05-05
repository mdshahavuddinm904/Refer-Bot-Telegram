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

/* ================= CHECK JOIN ================= */
async function checkJoin(ctx) {
  try {
    const res = await bot.telegram.getChatMember(
      "@Global_Method_Channel",
      ctx.from.id
    );
    return ["creator", "administrator", "member"].includes(res.status);
  } catch {
    return false;
  }
}

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
      rewarded: false
    };
  }

  const joined = await checkJoin(ctx);

  if (!joined) {
    saveDB(db);
    return ctx.reply(
      "👋 Welcome!\n\nJoin required:",
      Markup.inlineKeyboard([
        [Markup.button.url("🌍 Join Channel", "https://t.me/Global_Method_Channel")],
        [Markup.button.callback("✅ I Joined", "check_join")]
      ])
    );
  }

  saveDB(db);

  return ctx.reply(
`✅ Welcome!

💰 Referral System Active
🔗 /refer - get link
💰 /balance - check balance
💸 /withdraw - cash out`
  );
});

/* ================= JOIN CHECK ================= */
bot.action("check_join", async (ctx) => {
  const db = loadDB();
  const id = ctx.from.id;

  const joined = await checkJoin(ctx);

  if (!joined) {
    return ctx.reply("❌ Please join channel first!");
  }

  db.users[id].joined = true;

  // referral bonus (ONLY ONCE)
  const ref = db.users[id].referredBy;

  if (ref && db.users[ref] && !db.users[id].rewarded) {
    db.users[ref].balance += 20;
    db.users[ref].referrals += 1;

    bot.telegram.sendMessage(
      ref,
      "🎉 You got 20 coins from referral!"
    );

    db.users[id].rewarded = true;
  }

  saveDB(db);

  return ctx.reply("✅ Joined Successfully!");
});

/* ================= REFER ================= */
bot.command("refer", (ctx) => {
  const link = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;

  ctx.reply(`🔗 Your Referral Link:\n${link}\n\n💰 Earn 20 coins per user`);
});

/* ================= BALANCE ================= */
bot.command("balance", (ctx) => {
  const db = loadDB();
  const user = db.users[ctx.from.id];

  ctx.reply(`💰 Balance: ${user?.balance || 0}`);
});

/* ================= WITHDRAW ================= */
bot.command("withdraw", (ctx) => {
  const db = loadDB();
  const user = db.users[ctx.from.id];

  if (!user || user.balance < 5) {
    return ctx.reply("❌ Minimum withdraw is 5 coins");
  }

  bot.telegram.sendMessage(
    config.ADMIN_ID,
    `💸 Withdraw Request\n\nUser: ${ctx.from.id}\nBalance: ${user.balance}`
  );

  user.balance = 0;
  saveDB(db);

  ctx.reply("✅ Withdraw request sent!");
});

/* ================= DELETE USER (ADMIN) ================= */
bot.command("delete", (ctx) => {
  const db = loadDB();

  if (ctx.from.id !== config.ADMIN_ID) {
    return ctx.reply("❌ Not allowed");
  }

  const parts = ctx.message.text.split(" ");
  const target = parts[1];

  if (!target) return ctx.reply("❌ Use /delete USER_ID");

  delete db.users[target];
  saveDB(db);

  ctx.reply(`✅ Deleted user ${target}`);
});

/* ================= ERROR ================= */
bot.catch(console.log);

bot.launch();

console.log("🚀 Referral Bot Running...");
