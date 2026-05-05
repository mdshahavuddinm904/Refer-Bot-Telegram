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
🔗 Use /refer to earn coins
💸 Use /withdraw to cash out`
  );
});

// ================= JOIN CHECK =================
bot.action("check_join", async (ctx) => {
  const db = loadDB();
  const id = ctx.from.id;

  const joined = await checkJoin(ctx);

  if (!joined) {
    return ctx.reply("❌ You must join channel first!");
  }

  db.users[id].joined = true;

  // referral bonus
  const ref = db.users[id].referredBy;

  if (ref && db.users[ref]) {
    db.users[ref].balance += 5;
    db.users[ref].referrals += 1;
  }

  saveDB(db);

  return ctx.reply(
`✅ Successfully Joined!

💰 Referral system activated
Use /refer to get your link`
  );
});

// ================= CHECK JOIN FUNCTION =================
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

// ================= REF LINK =================
bot.command("refer", (ctx) => {
  const link = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;

  ctx.reply(
`🔗 Your Referral Link:
${link}

💰 Earn 5 coins per referral`
  );
});

// ================= BALANCE =================
bot.command("balance", (ctx) => {
  const db = loadDB();
  const user = db.users[ctx.from.id];

  ctx.reply(`💰 Balance: ${user?.balance || 0} coins`);
});

// ================= WITHDRAW =================
bot.command("withdraw", (ctx) => {
  const db = loadDB();
  const user = db.users[ctx.from.id];

  if (!user || user.balance < 10) {
    return ctx.reply("❌ Minimum withdraw 10 coins required");
  }

  bot.telegram.sendMessage(
    config.ADMIN_ID,
    `💸 Withdraw Request\n\nUser: ${ctx.from.id}\nBalance: ${user.balance}`
  );

  user.balance = 0;
  saveDB(db);

  ctx.reply("✅ Withdraw request sent!");
});

// ================= ERROR =================
bot.catch((err) => console.log("Error:", err));

bot.launch();

console.log("🚀 Referral Bot Running...");
