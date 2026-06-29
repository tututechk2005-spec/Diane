const fs = require('fs');
const path = require('path');
const { config } = require('./config');
const logger = require('./logger');
const { v4: uuidv4 } = require('uuid');

const locks = {};

function withLock(file, fn) {
  if (!locks[file]) locks[file] = Promise.resolve();
  locks[file] = locks[file].then(() => fn()).catch((err) => {
    logger.error(`Lock error on ${file}`, { err: err.message });
  });
  return locks[file];
}

// ─── JSON I/O ───────────────────────────────────────────────────────────[...]
function readJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch { return null; }
}
function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) { logger.error(`Write failed ${filePath}`, { err: err.message }); }
}

function todayUTC() { return new Date().toISOString().split('T')[0]; }

const db = {
  settings: {
    _path: config.paths.settings,
    get() {
      return readJSON(db.settings._path) || { risk_percent: 1, scan_interval: 60, max_trades: 5, maintenance: false, welcome_message: '', channel_id: '', channel_enabled: false };
    },
    async update(patch) {
      return withLock(db.settings._path, () => {
        const curr = db.settings.get();
        writeJSON(db.settings._path, { ...curr, ...patch });
      });
    },
  },
  stats: {
    _path: config.paths.stats,
    get() {
      return readJSON(db.stats._path) || { total_trades: 0, total_wins: 0, total_losses: 0, total_profit: 0, daily_reset_date: todayUTC() };
    },
    async update(patch) {
      return withLock(db.stats._path, () => {
        const curr = db.stats.get();
        writeJSON(db.stats._path, { ...curr, ...patch });
      });
    },
  },
  cooldown: {
    _path: config.paths.cooldown,
    _key(symbol, market, side) {
      return `${symbol}:${market}:${side}`;
    },

    getAll() {
      return readJSON(db.cooldown._path) || {};
    },

    isActive(symbol, market, side) {
      const key = db.cooldown._key(symbol, market, side);
      const cd = db.cooldown.getAll();
      if (!cd[key]) return false;
      return Date.now() < cd[key];
    },

    set(symbol, market, side) {
      return withLock(db.cooldown._path, () => {
        const cd = db.cooldown.getAll();
        cd[db.cooldown._key(symbol, market, side)] = Date.now() + 4 * 60 * 60 * 1000;
        writeJSON(db.cooldown._path, cd);
      });
    },

    clear(symbol, market, side) {
      return withLock(db.cooldown._path, () => {
        const cd = db.cooldown.getAll();
        delete cd[db.cooldown._key(symbol, market, side)];
        writeJSON(db.cooldown._path, cd);
      });
    },

    clearAll() {
      writeJSON(db.cooldown._path, {});
    },

    cleanup() {
      return withLock(db.cooldown._path, () => {
        const cd = db.cooldown.getAll();
        const now = Date.now();
        const clean = {};
        for (const [k, v] of Object.entries(cd)) {
          if (v > now) clean[k] = v;
        }
        writeJSON(db.cooldown._path, clean);
      });
    },
  },
  channel: {
    _path: config.paths.channel,
    get() {
      return readJSON(config.paths.channel) || { channel_id: '', enabled: false, messages: {} };
    },
    async update(patch) {
      return withLock(db.channel._path, () => {
        const curr = db.channel.get();
        writeJSON(db.channel._path, { ...curr, ...patch });
      });
    },
    async saveMessageId(signalId, messageId) {
      return withLock(db.channel._path, () => {
        const curr = db.channel.get();
        if (!curr.messages) curr.messages = {};
        curr.messages[signalId] = { message_id: messageId, saved_at: new Date().toISOString() };
        writeJSON(db.channel._path, curr);
      });
    },
    getMessageId(signalId) {
      return db.channel.get().messages?.[signalId]?.message_id || null;
    },
  },
  users: {
    getAll()      { return readJSON(config.paths.users) || []; },
    findById(id)  { return db.users.getAll().find((u) => String(u.telegram_id) === String(id)) || null; },
    findByUsername(u) { return db.users.getAll().find((x) => x.username === u) || null; },

    async create(data) {
      return withLock(config.paths.users, () => {
        const users = db.users.getAll();
        const user = {
          telegram_id: data.telegram_id,
          username: data.username || '',
          market_type: data.market_type || 'spot',
          testnet: data.testnet || false,
          api_key_spot: data.api_key_spot || '',
          api_secret_spot: data.api_secret_spot || '',
          api_key_testnet: data.api_key_testnet || '',
          api_secret_testnet: data.api_secret_testnet || '',
          current_account: data.current_account || 'spot',
          auto_trading: false,
          subscription: 'free',
          subscription_expiry: null,
          plan: 'free',
          daily_wins: 0,
          daily_losses: 0,
          daily_reset_date: todayUTC(),
          total_referrals: 0,
          referral_earnings: 0,
          referred_by: null,
          referred_by_code: null,
          referral_code: null,
          banned: false,
          created_at: new Date().toISOString(),
        };
        users.push(user);
        writeJSON(config.paths.users, users);
        return user;
      });
    },

    async update(id, patch) {
      return withLock(config.paths.users, () => {
        const users = db.users.getAll();
        const user = users.find((u) => String(u.telegram_id) === String(id));
        if (!user) return null;
        Object.assign(user, patch);
        writeJSON(config.paths.users, users);
        return user;
      });
    },

    async delete(id) {
      return withLock(config.paths.users, () => {
        const users = db.users.getAll();
        const idx = users.findIndex((u) => String(u.telegram_id) === String(id));
        if (idx >= 0) users.splice(idx, 1);
        writeJSON(config.paths.users, users);
      });
    },

    count()           { return db.users.getAll().length; },
    countPremium()    { return db.users.getAll().filter((u) => u.subscription === 'active').length; },
    countFree()       { return db.users.getAll().filter((u) => u.subscription !== 'active').length; },
    countActive()     { return db.users.getAll().filter((u) => u.auto_trading).length; },
    countBanned()     { return db.users.getAll().filter((u) => u.banned).length; },
    countSpot()       { return db.users.getAll().filter((u) => u.market_type === 'spot').length; },
    countFutures()    { return db.users.getAll().filter((u) => u.market_type === 'futures').length; },
    countActiveToday() {
      const today = todayUTC();
      return db.users.getAll().filter((u) => u.daily_reset_date === today && (u.daily_wins > 0 || u.daily_losses > 0)).length;
    },

    async resetDailyIfNeeded(id) {
      return withLock(config.paths.users, () => {
        const users = db.users.getAll();
        const user = users.find((u) => String(u.telegram_id) === String(id));
        if (!user) return;
        const today = todayUTC();
        if (user.daily_reset_date !== today) {
          user.daily_wins = 0;
          user.daily_losses = 0;
          user.daily_reset_date = today;
          writeJSON(config.paths.users, users);
        }
      });
    },
  },
  trades: {
    getAll()         { return readJSON(config.paths.trades) || []; },
    findById(id)     { return db.trades.getAll().find((t) => t.trade_id === id) || null; },
    forUser(uid)     { return db.trades.getAll().filter((t) => String(t.user_id) === String(uid)); },
    openForUser(uid) { return db.trades.forUser(uid).filter((t) => t.status === 'open'); },

    findOpenImported(userId, symbol, marketType, side) {
      return db.trades.forUser(userId).find((t) => t.status === 'open' && t.symbol === symbol && t.market_type === marketType && t.side === side && t.imported);
    },

    findOpenBySymbolSide(userId, symbol, side, marketType) {
      return db.trades.forUser(userId).find((t) => t.status === 'open' && t.symbol === symbol && t.side === side && t.market_type === marketType);
    },

    findOpenBySymbol(userId, symbol, marketType) {
      return db.trades.forUser(userId).filter((t) => t.status === 'open' && t.symbol === symbol && t.market_type === marketType);
    },

    findDuplicates() {
      const trades = db.trades.getAll();
      const seen = {};
      const dups = [];
      for (const t of trades) {
        if (t.status === 'open') {
          const key = `${t.user_id}:${t.symbol}:${t.market_type}:${t.side}`;
          if (seen[key]) dups.push(t.trade_id);
          else seen[key] = t.trade_id;
        }
      }
      return dups;
    },

    countBreakeven(uid) {
      const trades = uid ? db.trades.forUser(uid) : db.trades.getAll();
      return trades.filter((t) => t.status === 'closed' && t.result === 'BREAKEVEN').length;
    },

    async create(data) {
      return withLock(config.paths.trades, () => {
        const trades = db.trades.getAll();
        const trade = {
          trade_id: uuidv4(),
          user_id: data.user_id,
          symbol: data.symbol,
          side: data.side,
          market_type: data.market_type,
          entry: data.entry,
          sl: data.sl,
          tp: data.tp,
          quantity: data.quantity,
          status: 'open',
          result: null,
          profit: 0,
          profit_pct: 0,
          exit_price: null,
          open_time: new Date().toISOString(),
          close_time: null,
          imported: data.imported || false,
        };
        trades.push(trade);
        writeJSON(config.paths.trades, trades);
        return trade;
      });
    },

    async upsertImported(data) {
      return withLock(config.paths.trades, () => {
        const trades = db.trades.getAll();
        const idx = trades.findIndex((t) => t.user_id === data.user_id && t.symbol === data.symbol && t.market_type === data.market_type && t.side === data.side && t.imported && t.status === 'open');
        if (idx >= 0) {
          Object.assign(trades[idx], data);
        } else {
          trades.push(data);
        }
        writeJSON(config.paths.trades, trades);
      });
    },

    async update(id, patch) {
      return withLock(config.paths.trades, () => {
        const trades = db.trades.getAll();
        const t = trades.find((x) => x.trade_id === id);
        if (!t) return null;
        Object.assign(t, patch);
        writeJSON(config.paths.trades, trades);
        return t;
      });
    },

    count()       { return db.trades.getAll().length; },
    countOpen()   { return db.trades.getAll().filter((t) => t.status === 'open').length; },

    todayStats() {
      const today = todayUTC();
      const closed = db.trades.getAll().filter((t) => t.status === 'closed' && t.close_time && new Date(t.close_time) >= new Date(today));
      return { wins: closed.filter((t) => t.result === 'WIN').length, losses: closed.filter((t) => t.result === 'LOSS').length, profit: closed.reduce((s, t) => s + (t.profit || 0), 0) };
    },
    weekStats() {
      const from = new Date(Date.now() - 7 * 86400000);
      const closed = db.trades.getAll().filter((t) => t.status === 'closed' && t.close_time && new Date(t.close_time) >= from);
      return { wins: closed.filter((t) => t.result === 'WIN').length, losses: closed.filter((t) => t.result === 'LOSS').length, profit: closed.reduce((s, t) => s + (t.profit || 0), 0) };
    },
    monthStats() {
      const from = new Date(Date.now() - 30 * 86400000);
      const closed = db.trades.getAll().filter((t) => t.status === 'closed' && t.close_time && new Date(t.close_time) >= from);
      return { wins: closed.filter((t) => t.result === 'WIN').length, losses: closed.filter((t) => t.result === 'LOSS').length, profit: closed.reduce((s, t) => s + (t.profit || 0), 0) };
    },
    totalProfit() {
      return db.trades.getAll().reduce((s, t) => s + (t.profit || 0), 0).toFixed(4);
    },
  },
  signals: {
    getAll()    { return readJSON(config.paths.signals) || []; },
    findById(id){ return db.signals.getAll().find((s) => s.signal_id === id) || null; },
    recent(n = 20) {
      return db.signals.getAll().slice(-n);
    },
    todayCount() {
      return db.signals.getAll().filter((s) => s.timestamp?.startsWith(todayUTC())).length;
    },
    findActiveDuplicate(symbol, side, marketType, entryPrice) {
      const tolerance = 0.001;
      return db.signals.getAll().find((s) => s.status === 'ACTIVE' && s.symbol === symbol && s.side === side && s.market_type === marketType && Math.abs(s.entry - entryPrice) < tolerance);
    },

    async create(data) {
      return withLock(config.paths.signals, () => {
        const signals = db.signals.getAll();
        const signal = {
          signal_id: uuidv4(),
          symbol: data.symbol,
          side: data.side,
          market_type: data.market_type,
          entry: data.entry,
          sl: data.sl,
          tp: data.tp,
          score: data.score,
          grade: data.grade,
          status: 'ACTIVE',
          created_by: 'SYSTEM',
          timestamp: new Date().toISOString(),
          confirmations: data.confirmations || {},
        };
        signals.push(signal);
        writeJSON(config.paths.signals, signals);
        return signal;
      });
    },

    count() { return db.signals.getAll().length; },
  },
  referrals: {
    _path: './data/referrals.json',
    getAll() { return readJSON(db.referrals._path) || []; },
    forReferrer(refId) { return db.referrals.getAll().filter((r) => r.referrer_id === refId); },
    forReferee(refId) { return db.referrals.getAll().filter((r) => r.referee_id === refId); },
    async log(data) {
      return withLock(db.referrals._path, () => {
        const refs = db.referrals.getAll();
        refs.push({ ...data, created_at: new Date().toISOString() });
        writeJSON(db.referrals._path, refs);
      });
    },
  },
  apiErrors: {
    _path: './data/api_errors.json',
    getAll() { return readJSON(db.apiErrors._path) || []; },
    async log(data) {
      return withLock(db.apiErrors._path, () => {
        const logs = db.apiErrors.getAll();
        logs.push({ ...data, timestamp: new Date().toISOString() });
        writeJSON(db.apiErrors._path, logs.slice(-1000));
      });
    },
  },
  async cleanOrphansAndDuplicates() {
    return withLock(config.paths.trades, () => {
      const trades = db.trades.getAll();
      const signals = db.signals.getAll();
      const users = db.users.getAll();
      const userIds = new Set(users.map((u) => u.telegram_id));
      const sigIds = new Set(signals.map((s) => s.signal_id));

      const clean = trades.filter((t) => userIds.has(t.user_id));
      const dups = {};
      const result = [];
      for (const t of clean) {
        const key = `${t.user_id}:${t.symbol}:${t.market_type}:${t.side}`;
        if (t.status === 'open' && dups[key]) continue;
        if (t.status === 'open') dups[key] = true;
        result.push(t);
      }
      writeJSON(config.paths.trades, result);
    });
  },
};

module.exports = db;
