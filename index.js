const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");
const config = require("./config");

const bot = new Telegraf(config.BOT_TOKEN);

const DB_FILE = "./db.json";

// ================= DB =================
function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ================= CHECK JOIN =================
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

// ================= START =================
bot.start(async (ctx) => {
  const db = loadDB();
  const id = ctx.from.id;
  const ref = ctx.startPayload;

  if (!db.users[id]) {
    db.users[id] = {
      balance: 0,
      referrals: 0,
      joined: false,
      referredBy: ref || null
    };
  }

  saveDB(db);

  const joined = await checkJoin(ctx);

  if (!joined) {
    return ctx.reply(
      "👋 Welcome!\n\nJoin required to continue:",
      Markup.inlineKeyboard([
        [Markup.button.url("🌍 Join Channel", "https://t.me/Global_Method_Channel")],
        [Markup.button.callback("✅ I Joined", "check_join")]
      ])
    );
  }

  db.users[id].joined = true;
  saveDB(db);

  return ctx.reply(
`✅ Welcome!

💰 Referral System Active
💵 Bonus: $20 per referral
💸 Min Withdraw: $5

Use /refer to get link`
  );
});

// ================= JOIN CHECK (FIXED) =================
bot.action("check_join", async (ctx) => {
  const db = loadDB();
  const id = ctx.from.id;

  const joined = await checkJoin(ctx);

  if (!joined) {
    return ctx.reply("❌ You must join channel first!");
  }

  if (!db.users[id]) {
    db.users[id] = {
      balance: 0,
      referrals: 0,
      joined: true,
      referredBy: null
    };
  }

  // prevent duplicate execution
  if (!db.users[id].joined) {
    db.users[id].joined = true;
  }

  // ================= REFERRAL BONUS FIX =================
  const ref = db.users[id].referredBy;

  if (ref && db.users[ref]) {
    db.users[ref].balance += 20;
    db.users[ref].referrals += 1;

    // notify referrer
    bot.telegram.sendMessage(
      ref,
      `🎉 New Referral!

💰 You earned $20 bonus
👤 From user: ${id}`
    );
  }

  saveDB(db);

  return ctx.reply(
`✅ Successfully Joined!

💰 Referral system activated
💵 Earn $20 per referral`
  );
});

// ================= STRICT ACCESS MIDDLEWARE =================
bot.use(async (ctx, next) => {
  const db = loadDB();
  const id = ctx.from?.id;

  if (!id) return;

  const user = db.users[id];

  // block everything if not joined
  if (!user?.joined) {
    return ctx.reply("❌ Please join channel first!");
  }

  return next();
});

// ================= REF LINK =================
bot.command("refer", (ctx) => {
  const link = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;

  ctx.reply(
`🔗 Your Referral Link:
${link}

💰 Earn $20 per referral`
  );
});

// ================= BALANCE =================
bot.command("balance", (ctx) => {
  const db = loadDB();
  const user = db.users[ctx.from.id];

  ctx.reply(`💰 Balance: $${user?.balance || 0}`);
});

// ================= WITHDRAW (FIXED $5) =================
bot.command("withdraw", (ctx) => {
  const db = loadDB();
  const user = db.users[ctx.from.id];

  if (!user || user.balance < 5) {
    return ctx.reply("❌ Minimum withdraw is $5");
  }

  bot.telegram.sendMessage(
    config.ADMIN_ID,
    `💸 Withdraw Request

User: ${ctx.from.id}
Balance: $${user.balance}`
  );

  user.balance = 0;
  saveDB(db);

  ctx.reply("✅ Withdraw request sent!");
});

// ================= ERROR =================
bot.catch((err) => console.log("Error:", err));

bot.launch();

console.log("🚀 Referral Bot Running...");
