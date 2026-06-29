const db = require('./database');
const logger = require('./logger');
const { config } = require('./config');
const { createClient } = require('./binance');
const { calculatePositionSize, getRiskPct, analyzeSymbol } = require('./strategy');

const tradeLocks = {};

// ─── TRADE LOCKING ──────────────────────────────────────────────────────────[...]
async function withTradeLock(key, fn) {
  if (!tradeLocks[key]) tradeLocks[key] = Promise.resolve();
  tradeLocks[key] = tradeLocks[key].then(fn).catch((err) => {
    logger.error(`Trade lock error: ${key}`, { err: err.message });
  });
  return tradeLocks[key];
}

// ─── LOT SIZE FILTER ─────────────────────────────────────────────────────────[...]
async function applyLotSizeFilter(client, symbol, rawQty, entry) {
  try {
    const info = await client.getExchangeInfo();
    if (!info.symbols) return rawQty;

    const sym = info.symbols.find((s) => s.symbol === symbol);
    if (!sym) return rawQty;

    const filter = sym.filters.find((f) => f.filterType === 'LOT_SIZE');
    if (!filter) return rawQty;

    const { stepSize, minQty, maxQty } = filter;
    const step = parseFloat(stepSize);
    const minQ = parseFloat(minQty);
    const maxQ = parseFloat(maxQty);

    let qty = Math.floor(rawQty / step) * step;
    qty = Math.max(qty, minQ);
    qty = Math.min(qty, maxQ);

    return parseFloat(qty.toFixed(6));
  } catch (err) {
    logger.error(`Lot size filter error: ${symbol}`, { err: err.message });
    return rawQty;
  }
}

// ─── DAILY PROTECTION ────────────────────────────────────────────────────────[...]
async function checkDailyProtection(user) {
  const today = new Date().toISOString().split('T')[0];
  if (user.daily_reset_date !== today) {
    await db.users.update(user.telegram_id, { daily_wins: 0, daily_losses: 0, daily_reset_date: today });
    user.daily_wins = 0;
    user.daily_losses = 0;
  }

  const { DAILY_MAX_LOSSES, DAILY_WIN_TARGET } = require('./config');
  if (user.daily_losses >= DAILY_MAX_LOSSES) {
    return { blocked: true, reason: `Daily loss limit reached (${DAILY_MAX_LOSSES})` };
  }
  return { blocked: false };
}

// ─── OPEN TRADE ──────────────────────────────────────────────────────────[...]
async function openTrade(user, signal) {
  return withTradeLock(`${user.telegram_id}:${signal.symbol}`, async () => {
    try {
      // Daily protection
      const prot = await checkDailyProtection(user);
      if (prot.blocked) {
        return { ok: false, error: prot.reason };
      }

      // Get client for selected account
      const accountType = user.current_account || 'spot';
      const apiKey = accountType === 'testnet' ? user.api_key_testnet : user.api_key_spot;
      const apiSecret = accountType === 'testnet' ? user.api_secret_testnet : user.api_secret_spot;
      const testnet = accountType === 'testnet';

      if (!apiKey || !apiSecret) {
        return { ok: false, error: 'API credentials not configured for selected account' };
      }

      const client = createClient({ api_key: apiKey, api_secret: apiSecret, testnet, market_type: signal.market_type });

      // Balance check
      const balance = await client.getBalance();
      if (!balance || balance < 10) {
        return { ok: false, error: 'Insufficient balance' };
      }

      // Position size
      const { RISK_STRONG } = require('./config');
      const riskPct = getRiskPct(signal.score);
      const qty = calculatePositionSize(balance, riskPct, signal.entry, signal.sl);

      if (qty <= 0) {
        return { ok: false, error: 'Invalid position size' };
      }

      // Apply lot size filter
      const filteredQty = await applyLotSizeFilter(client, signal.symbol, qty, signal.entry);

      // Place order
      let order = null;
      if (signal.market_type === 'spot') {
        order = await client.placeMarketOrder(signal.symbol, signal.signal, filteredQty);
      } else {
        order = await client.placeMarketOrder(signal.symbol, signal.signal, filteredQty, 'BOTH');
      }

      if (!order) {
        return { ok: false, error: 'Order placement failed' };
      }

      // Create trade record
      const trade = await db.trades.create({
        user_id: user.telegram_id,
        symbol: signal.symbol,
        side: signal.signal,
        market_type: signal.market_type,
        entry: signal.entry,
        sl: signal.sl,
        tp: signal.tp,
        quantity: filteredQty,
      });

      logger.info(`Trade opened: ${user.telegram_id} ${signal.symbol} ${signal.signal} @ ${signal.entry}`);
      return { ok: true, trade };
    } catch (err) {
      logger.error(`openTrade error: ${user.telegram_id}`, { err: err.message });
      return { ok: false, error: err.message };
    }
  });
}

// ─── CLOSE TRADE ──────────────────────────────────────────────────────────[...]
async function closeTrade(user, trade, reason = 'MANUAL', overridePrice = null) {
  return withTradeLock(trade.trade_id, async () => {
    try {
      const accountType = user.current_account || 'spot';
      const apiKey = accountType === 'testnet' ? user.api_key_testnet : user.api_key_spot;
      const apiSecret = accountType === 'testnet' ? user.api_secret_testnet : user.api_secret_spot;
      const testnet = accountType === 'testnet';

      const client = createClient({ api_key: apiKey, api_secret: apiSecret, testnet, market_type: trade.market_type });

      const exitPrice = overridePrice || (await client.getPrice(trade.symbol));
      const profit = trade.side === 'BUY' ? (exitPrice - trade.entry) * trade.quantity : (trade.entry - exitPrice) * trade.quantity;
      const profitPct = ((profit / (trade.entry * trade.quantity)) * 100).toFixed(2);

      const result = reason === 'TP' ? 'WIN' : reason === 'SL' ? 'LOSS' : 'MANUAL';

      await db.trades.update(trade.trade_id, {
        status: 'closed',
        exit_price: exitPrice,
        profit: parseFloat(profit.toFixed(4)),
        profit_pct: parseFloat(profitPct),
        result,
        close_time: new Date().toISOString(),
      });

      // Update user stats
      if (result === 'WIN') {
        await db.users.update(user.telegram_id, { daily_wins: (user.daily_wins || 0) + 1, total_trades: (user.total_trades || 0) + 1 });
      } else if (result === 'LOSS') {
        await db.users.update(user.telegram_id, { daily_losses: (user.daily_losses || 0) + 1, total_trades: (user.total_trades || 0) + 1 });
      }

      logger.info(`Trade closed: ${trade.symbol} ${result} (${profitPct}%)`);
      return { ok: true, profit, profitPct };
    } catch (err) {
      logger.error(`closeTrade error: ${trade.trade_id}`, { err: err.message });
      return { ok: false, error: err.message };
    }
  });
}

// ─── PARTIAL CLOSE ─────────────────────────────────────────────────────────[...]
async function partialCloseTrade(user, trade, closePercent = 50) {
  return withTradeLock(trade.trade_id, async () => {
    try {
      const accountType = user.current_account || 'spot';
      const apiKey = accountType === 'testnet' ? user.api_key_testnet : user.api_key_spot;
      const apiSecret = accountType === 'testnet' ? user.api_secret_testnet : user.api_secret_spot;
      const testnet = accountType === 'testnet';

      const client = createClient({ api_key: apiKey, api_secret: apiSecret, testnet, market_type: trade.market_type });

      const closeQty = (trade.quantity * (closePercent / 100)).toFixed(6);
      const price = await client.getPrice(trade.symbol);

      await db.trades.update(trade.trade_id, {
        quantity: (trade.quantity - parseFloat(closeQty)).toFixed(6),
      });

      logger.info(`Partial close: ${trade.symbol} (${closePercent}% of ${trade.quantity})`);
      return { ok: true, closedQty: closeQty };
    } catch (err) {
      logger.error(`partialCloseTrade error: ${trade.trade_id}`, { err: err.message });
      return { ok: false, error: err.message };
    }
  });
}

// ─── MOVE SL ───────────────────────────────────────────────────────────[...]
async function moveStopLoss(user, trade, newSL) {
  try {
    await db.trades.update(trade.trade_id, { sl: newSL });
    logger.info(`SL moved: ${trade.symbol} → ${newSL}`);
    return { ok: true };
  } catch (err) {
    logger.error(`moveStopLoss error: ${trade.trade_id}`, { err: err.message });
    return { ok: false, error: err.message };
  }
}

// ─── MOVE TP ───────────────────────────────────────────────────────────[...]
async function moveTakeProfit(user, trade, newTP) {
  try {
    await db.trades.update(trade.trade_id, { tp: newTP });
    logger.info(`TP moved: ${trade.symbol} → ${newTP}`);
    return { ok: true };
  } catch (err) {
    logger.error(`moveTakeProfit error: ${trade.trade_id}`, { err: err.message });
    return { ok: false, error: err.message };
  }
}

async function setBreakEven(user, trade) {
  return moveStopLoss(user, trade, trade.entry);
}

// ─── TRAILING STOP ─────────────────────────────────────────────────────────[...]
async function setTrailingStop(user, trade, trailPercent = 1.0) {
  try {
    const accountType = user.current_account || 'spot';
    const apiKey = accountType === 'testnet' ? user.api_key_testnet : user.api_key_spot;
    const apiSecret = accountType === 'testnet' ? user.api_secret_testnet : user.api_secret_spot;
    const testnet = accountType === 'testnet';

    const client = createClient({ api_key: apiKey, api_secret: apiSecret, testnet, market_type: trade.market_type });
    const price = await client.getPrice(trade.symbol);
    const newSL = trade.side === 'BUY' ? price * (1 - trailPercent / 100) : price * (1 + trailPercent / 100);

    await db.trades.update(trade.trade_id, { sl: newSL });
    logger.info(`Trailing stop set: ${trade.symbol} @ ${newSL}`);
    return { ok: true };
  } catch (err) {
    logger.error(`setTrailingStop error: ${trade.trade_id}`, { err: err.message });
    return { ok: false, error: err.message };
  }
}

// ─── IMPORT BINANCE POSITIONS (upsert — never duplicates) ────────────────────[...]
async function importBinancePositions(user) {
  try {
    const accountType = user.current_account || 'spot';
    const apiKey = accountType === 'testnet' ? user.api_key_testnet : user.api_key_spot;
    const apiSecret = accountType === 'testnet' ? user.api_secret_testnet : user.api_secret_spot;
    const testnet = accountType === 'testnet';

    const client = createClient({ api_key: apiKey, api_secret: apiSecret, testnet, market_type: user.market_type });

    const positions = user.market_type === 'futures' ? await client.getOpenPositions() : [];
    if (!positions) return { ok: true, count: 0 };

    let imported = 0;
    for (const pos of positions) {
      const trade = await db.trades.create({
        user_id: user.telegram_id,
        symbol: pos.symbol,
        side: pos.positionAmt > 0 ? 'BUY' : 'SELL',
        market_type: user.market_type,
        entry: pos.entryPrice,
        sl: pos.entryPrice * 0.95,
        tp: pos.entryPrice * 1.05,
        quantity: Math.abs(pos.positionAmt),
        imported: true,
      });
      imported++;
    }

    logger.info(`Imported ${imported} positions for user ${user.telegram_id}`);
    return { ok: true, count: imported };
  } catch (err) {
    logger.error(`importBinancePositions error: ${user.telegram_id}`, { err: err.message });
    return { ok: false, error: err.message };
  }
}

// ─── DETECT MANUAL CHANGES ────────────────────────────────────────────────────[...]
async function detectAndSyncManualChanges(user, client, dbOpenTrades, livePositions, openOrders) {
  // TODO: Implement manual change detection if needed
}

// ─── FULL BINANCE SYNC ────────────────────────────────────────────────────────[...]
async function syncUserFromBinance(user) {
  try {
    if (!user.auto_trading || user.banned) return;

    const accountType = user.current_account || 'spot';
    const apiKey = accountType === 'testnet' ? user.api_key_testnet : user.api_key_spot;
    const apiSecret = accountType === 'testnet' ? user.api_secret_testnet : user.api_secret_spot;
    const testnet = accountType === 'testnet';

    if (!apiKey || !apiSecret) return;

    const client = createClient({ api_key: apiKey, api_secret: apiSecret, testnet, market_type: user.market_type });

    const livePositions = user.market_type === 'futures' ? await client.getOpenPositions() : [];
    const openOrders = await client.getAllOpenOrders();
    const dbTrades = db.trades.openForUser(user.telegram_id);

    // Sync balance
    const balance = await client.getBalance();
    await db.users.update(user.telegram_id, { balance: balance || 0, last_binance_sync: new Date().toISOString() });

    logger.debug(`Sync complete for user ${user.telegram_id}`);
  } catch (err) {
    logger.error(`syncUserFromBinance error: ${user.telegram_id}`, { err: err.message });
  }
}

// ─── ACCOUNT SWITCH — clear all cached data for previous account ──────────────[...]
async function clearUserAccountData(userId) {
  try {
    // Close all open trades for this user
    const trades = db.trades.openForUser(userId);
    for (const trade of trades) {
      await db.trades.update(trade.trade_id, { status: 'cancelled' });
    }
    logger.info(`Account switched for user ${userId} - closed ${trades.length} trades`);
  } catch (err) {
    logger.error(`clearUserAccountData error: ${userId}`, { err: err.message });
  }
}

// ─── MONITOR OPEN TRADES ──────────────────────────────────────────────────────[...]
async function monitorTrades() {
  try {
    const users = db.users.getAll().filter((u) => u.auto_trading && !u.banned);
    for (const user of users) {
      const trades = db.trades.openForUser(user.telegram_id);
      for (const trade of trades) {
        try {
          const accountType = user.current_account || 'spot';
          const apiKey = accountType === 'testnet' ? user.api_key_testnet : user.api_key_spot;
          const apiSecret = accountType === 'testnet' ? user.api_secret_testnet : user.api_secret_spot;
          const testnet = accountType === 'testnet';

          if (!apiKey || !apiSecret) continue;

          const client = createClient({ api_key: apiKey, api_secret: apiSecret, testnet, market_type: trade.market_type });
          const price = await client.getPrice(trade.symbol);

          if (price <= trade.sl) {
            await closeTrade(user, trade, 'SL', price);
          } else if (price >= trade.tp) {
            await closeTrade(user, trade, 'TP', price);
          }
        } catch (err) {
          logger.debug(`Monitor trade error: ${trade.trade_id}`, { err: err.message });
        }
      }
    }
  } catch (err) {
    logger.error('monitorTrades error', { err: err.message });
  }
}

// ─── UPDATE USER BALANCES ─────────────────────────────────────────────────────[...]
async function updateUserBalances() {
  try {
    const users = db.users.getAll().filter((u) => u.api_key_spot || u.api_key_testnet);
    for (const user of users) {
      try {
        const accountType = user.current_account || 'spot';
        const apiKey = accountType === 'testnet' ? user.api_key_testnet : user.api_key_spot;
        const apiSecret = accountType === 'testnet' ? user.api_secret_testnet : user.api_secret_spot;
        const testnet = accountType === 'testnet';

        if (!apiKey || !apiSecret) continue;

        const client = createClient({ api_key: apiKey, api_secret: apiSecret, testnet, market_type: user.market_type });
        const balance = await client.getBalance();
        await db.users.update(user.telegram_id, { balance: balance || 0 });
      } catch (err) {
        logger.debug(`Balance update error: ${user.telegram_id}`, { err: err.message });
      }
    }
  } catch (err) {
    logger.error('updateUserBalances error', { err: err.message });
  }
}

// ─── CLEAN DATABASE DUPLICATES ────────────────────────────────────────────────[...]
async function cleanDatabaseDuplicates() {
  return db.cleanOrphansAndDuplicates();
}

// ─── UPDATE USER STATS ON CLOSE ───────────────────────────────────────────────[...]
async function _updateUserStatsOnClose(user, profit, profitPct, result_label) {
  // Stats already updated in closeTrade
}

module.exports = {
  openTrade,
  closeTrade,
  partialCloseTrade,
  moveStopLoss,
  moveTakeProfit,
  setBreakEven,
  setTrailingStop,
  importBinancePositions,
  detectAndSyncManualChanges,
  syncUserFromBinance,
  clearUserAccountData,
  monitorTrades,
  updateUserBalances,
  cleanDatabaseDuplicates,
};
