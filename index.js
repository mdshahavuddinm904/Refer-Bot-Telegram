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
      config.CHANNEL,
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
      "👋 Welcome!\n\nPlease join channel:",
      Markup.inlineKeyboard([
        [Markup.button.url("🌍 Join Channel", `https://t.me/${config.CHANNEL.replace("@","")}`)],
        [Markup.button.callback("✅ I Joined", "check_join")]
      ])
    );
  }

  return ctx.reply(
`✅ Welcome!

💰 Earn system active
Invite friends & earn bonus`
  );
});

// ================= JOIN CHECK =================
bot.action("check_join", async (ctx) => {
  const db = loadDB();
  const id = ctx.from.id;

  const joined = await checkJoin(ctx);

  if (!joined) {
    return ctx.reply("❌ Please join channel first!");
  }

  db.users[id].joined = true;

  // referral bonus system
  const ref = db.users[id].referredBy;

  if (ref && db.users[ref]) {
    db.users[ref].balance += 5;
    db.users[ref].referrals += 1;
  }

  saveDB(db);

  return ctx.reply("✅ Joined Successfully!");
});

// ================= REF LINK =================
bot.command("refer", (ctx) => {
  const link = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;

  ctx.reply(`🔗 Your Referral Link:\n${link}\n\n💰 Earn 5 coins per referral`);
});

// ================= BALANCE =================
bot.command("balance", (ctx) => {
  const db = loadDB();
  const user = db.users[ctx.from.id];

  ctx.reply(`💰 Your Balance: ${user?.balance || 0}`);
});

// ================= WITHDRAW =================
bot.command("withdraw", (ctx) => {
  const db = loadDB();
  const user = db.users[ctx.from.id];

  if (!user || user.balance < 10) {
    return ctx.reply("❌ Minimum withdraw is 10 coins");
  }

  const msg = `
💸 Withdraw Request

User: ${ctx.from.id}
Balance: ${user.balance}
`;

  bot.telegram.sendMessage(config.ADMIN_ID, msg);

  user.balance = 0;
  saveDB(db);

  ctx.reply("✅ Withdraw request sent!");
});

// ================= ERROR =================
bot.catch(console.log);

bot.launch();

console.log("🚀 Referral Bot Running...");
