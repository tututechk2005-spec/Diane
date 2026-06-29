[...]
async function notify(telegramId, text, opts = {}) {
  try {
    const user = db.users.findById(telegramId);
    if (!user || user.banned) return null;
    return await bot.telegram.sendMessage(telegramId, text, { parse_mode: 'HTML', ...opts });
  } catch (err) {
    logger.error(`Notify failed: ${telegramId}`, { err: err.message });
    return null;
  }
}

async function editMessage(telegramId, messageId, text, opts = {}) {
  try {
    return await bot.telegram.editMessageText(telegramId, messageId, null, text, { parse_mode: 'HTML', ...opts });
  } catch (err) {
    logger.error(`Edit failed: ${telegramId}:${messageId}`, { err: err.message });
    return null;
  }
}

// ─── DURATION ───────────────────────────────────────────────────────────[...]
function duration(startIso, endIso) {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  const ms = end - start;
  const s = Math.floor(ms / 1000) % 60;
  const m = Math.floor(ms / 60000) % 60;
  const h = Math.floor(ms / 3600000);
  return `${h}h ${m}m ${s}s`;
}

// ─── SIGNAL TEXT ──────────────────────────────────────────────────────────[...]
function buildSignalText(sig, profitPct = null, status = 'ACTIVE') {
  const emoji = status === 'ACTIVE' ? '🟢' : status === 'WIN' ? '✅' : '❌';
  const row = (label, ok) => `${ok ? '✅' : '❌'} ${label}`;

  const text =
    `${emoji} <b>${status} SIGNAL</b>\n\n` +
    `<b>${sig.symbol}</b>  ${sig.signal}\n` +
    `Score: <b>${sig.score}</b> (${sig.grade})\n` +
    `Entry: <code>${sig.entry}</code>\n` +
    `SL: <code>${sig.sl}</code>\n` +
    `TP: <code>${sig.tp}</code>\n` +
    `R:R: <b>${sig.rr}</b>\n\n` +
    `<b>Confirmations:</b>\n` +
    `${row('Trend (4h)', sig.confirmations?.trend_4h)}\n` +
    `${row('Trend (1h)', sig.confirmations?.trend_1h)}\n` +
    `${row('Break of Structure', sig.confirmations?.bos)}\n` +
    `${row('Order Block', sig.confirmations?.order_block)}\n` +
    `${row('Fair Value Gap', sig.confirmations?.fvg)}\n` +
    `${row('Volume Spike', sig.confirmations?.volume_spike)}\n` +
    `${row('RSI Confirmed', sig.confirmations?.rsi)}\n\n` +
    (profitPct !== null ? `<b>Result: ${profitPct >= 0 ? '+' : ''}${profitPct.toFixed(2)}%</b>` : `⏳ Awaiting result...`);

  return text;
}

function buildTpNotification(trade, result) {
  return `✅ <b>TAKE PROFIT</b>\n\n` +
    `${trade.symbol}\n` +
    `Profit: <b>+${trade.profit.toFixed(4)} USDT (+${trade.profit_pct.toFixed(2)}%)</b>\n` +
    `Duration: ${duration(trade.open_time, trade.close_time)}`;
}

function buildSlNotification(trade, result) {
  return `❌ <b>STOP LOSS</b>\n\n` +
    `${trade.symbol}\n` +
    `Loss: <b>${trade.profit.toFixed(4)} USDT (${trade.profit_pct.toFixed(2)}%)</b>\n` +
    `Duration: ${duration(trade.open_time, trade.close_time)}`;
}

function buildCloseText(trade, result) {
  const icon = trade.profit >= 0 ? '✅' : '❌';
  return `${icon} <b>TRADE CLOSED</b>\n\n` +
    `${trade.symbol} ${trade.side}\n` +
    `Entry: ${trade.entry}\n` +
    `Exit: ${trade.exit_price}\n` +
    `Result: <b>${trade.profit >= 0 ? '+' : ''}${trade.profit.toFixed(4)} USDT (${trade.profit_pct.toFixed(2)}%)</b>\n` +
    `Duration: ${duration(trade.open_time, trade.close_time)}`;
}

function buildLiveTradeText(trade) {
  return `<b>📊 ${trade.symbol} (${trade.side})</b>\n\n` +
    `Entry: <code>${trade.entry}</code>\n` +
    `SL: <code>${trade.sl}</code>\n` +
    `TP: <code>${trade.tp}</code>\n` +
    `Qty: ${trade.quantity}\n` +
    `Status: LIVE`;
}

// ─── BROADCAST SIGNAL ────────────────────────────────────────────────────────[...]
async function broadcastSignal(signal) {
  if (!signal) return;
  const sigText = buildSignalText(signal, null, 'ACTIVE');
  const users = db.users.getAll().filter((u) => u.subscription === 'active' && u.auto_trading && !u.banned);
  let sent = 0, failed = 0;

  for (const user of users) {
    try {
      await bot.telegram.sendMessage(user.telegram_id, sigText, { parse_mode: 'HTML' });
      sent++;
    } catch (err) {
      logger.debug(`Broadcast failed for ${user.telegram_id}`, { err: err.message });
      failed++;
    }
  }
  logger.info(`Signal broadcast: ${sent} sent, ${failed} failed`);
}

// ─── SCAN ONE MARKET ─────────────────────────────────────────────────────────[...]
async function scanMarket(client, marketType, minVolume) {
  try {
    const pairs = await client.getActivePairs(minVolume);
    if (!pairs || pairs.length === 0) return [];

    const sigs = [];
    for (const symbol of pairs.slice(0, 50)) {
      try {
        const sig = await analyzeSymbol(client, symbol);
        if (!sig) continue;

        const dup = db.signals.findActiveDuplicate(sig.symbol, sig.signal, marketType, sig.entry);
        if (dup) {
          logger.debug(`Duplicate signal skipped: ${sig.symbol}`);
          continue;
        }

        const dbSig = await db.signals.create({
          symbol: sig.symbol,
          side: sig.signal,
          market_type: marketType,
          entry: sig.entry,
          sl: sig.sl,
          tp: sig.tp,
          score: sig.score,
          grade: sig.grade,
          confirmations: sig.confirmations,
        });
        sigs.push(dbSig);
        logger.info(`New signal: ${sig.symbol} ${sig.signal} (score: ${sig.score})`);
      } catch (err) {
        logger.debug(`Analysis error for ${symbol}`, { err: err.message });
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    return sigs;
  } catch (err) {
    logger.error('scanMarket error', { err: err.message });
    return [];
  }
}

// ─── MAIN MARKET SCAN (single global scanner) ─────────────────────────────────[...]
async function runMarketScan() {
  try {
    logger.info('Market scan started...');
    const { BINANCE_SPOT_URL, BINANCE_FUTURES_URL, MIN_SPOT_VOLUME, MIN_FUTURES_VOLUME } = require('./config');
    const { createClient } = require('./binance');

    const spotClient = createClient({ api_key: '', api_secret: '', testnet: false });
    const futuresClient = createClient({ api_key: '', api_secret: '', testnet: false });

    const [spotSigs, futuresSigs] = await Promise.all([
      scanMarket(spotClient, 'spot', MIN_SPOT_VOLUME),
      scanMarket(futuresClient, 'futures', MIN_FUTURES_VOLUME),
    ]);

    const allSigs = [...spotSigs, ...futuresSigs];
    for (const sig of allSigs) {
      await broadcastSignal(sig);
    }

    logger.info(`Market scan complete: ${spotSigs.length} spot + ${futuresSigs.length} futures signals`);
  } catch (err) {
    logger.error('runMarketScan error', { err: err.message });
  }
}

// ─── MONITOR CYCLE ─────────────────────────────────────────────────────────[...]
async function runMonitor() {
  try {
    await monitorTrades();
    await updateLivePnlMessages();
  } catch (err) {
    logger.error('Monitor cycle error', { err: err.message });
  }
}

// ─── LIVE PNL UPDATES ────────────────────────────────────────────────────────[...]
async function updateLivePnlMessages() {
  // TODO: Implement live PNL updates if needed
}

// ─── BINANCE SYNC FOR ALL USERS ───────────────────────────────────────────────[...]
async function runBinanceSync() {
  try {
    const users = db.users.getAll().filter((u) => u.auto_trading && !u.banned);
    for (const user of users) {
      try {
        const { syncUserFromBinance } = require('./trading');
        await syncUserFromBinance(user);
      } catch (err) {
        logger.debug(`Sync error for user ${user.telegram_id}`, { err: err.message });
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    logger.info(`Sync complete: ${users.length} users synced`);
  } catch (err) {
    logger.error('runBinanceSync error', { err: err.message });
  }
}

// ─── SUBSCRIPTION CHECKER ────────────────────────────────────────────────────[...]
async function checkSubscriptions() {
  try {
    const users = db.users.getAll().filter((u) => u.subscription === 'active');
    for (const user of users) {
      if (!user.subscription_expiry) continue;
      if (new Date() >= new Date(user.subscription_expiry)) {
        await db.users.update(user.telegram_id, { subscription: 'expired', auto_trading: false });
        try {
          await bot.telegram.sendMessage(user.telegram_id, '⏰ Your subscription has expired. Renew to continue trading.', { parse_mode: 'HTML' });
        } catch {}
        logger.info(`Subscription expired: ${user.telegram_id}`);
      }
    }
  } catch (err) {
    logger.error('checkSubscriptions error', { err: err.message });
  }
}

// ─── DAILY REPORT ──────────────────────────────────────────────────────────[...]
function msUntilNextReport() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return Math.max(1000, next - now);
}

async function runDailyReport() {
  try {
    logger.info('Daily report generating...');
    // TODO: Implement daily report if needed
  } catch (err) {
    logger.error('Daily report error', { err: err.message });
  }
}

// ─── START / STOP ──────────────────────────────────────────────────────────[...]
let scanTimer, monitorTimer, syncTimer, subTimer, reportTimer;
let bot;

async function start(botInstance) {
  bot = botInstance;
  const { SCAN_INTERVAL, MONITOR_INTERVAL_MS } = require('./config');

  scanTimer = setInterval(runMarketScan, SCAN_INTERVAL * 1000);
  monitorTimer = setInterval(runMonitor, MONITOR_INTERVAL_MS);
  syncTimer = setInterval(runBinanceSync, 5 * 60 * 1000);
  subTimer = setInterval(checkSubscriptions, 60 * 1000);
  reportTimer = setInterval(runDailyReport, msUntilNextReport());

  logger.info('Scheduler started: market scan, monitor, sync, subscriptions, reports');
}

function stop() {
  if (scanTimer) clearInterval(scanTimer);
  if (monitorTimer) clearInterval(monitorTimer);
  if (syncTimer) clearInterval(syncTimer);
  if (subTimer) clearInterval(subTimer);
  if (reportTimer) clearInterval(reportTimer);
  logger.info('Scheduler stopped');
}

function updateScanInterval(seconds) {
  if (scanTimer) clearInterval(scanTimer);
  scanTimer = setInterval(runMarketScan, seconds * 1000);
  logger.info(`Scan interval updated: ${seconds}s`);
}

module.exports = { start, stop, updateScanInterval, runMarketScan, runMonitor, runBinanceSync, checkSubscriptions };
