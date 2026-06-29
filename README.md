# 🤖 AI Crypto Trading Bot (Diane) - Professional Edition

> **Fully Automated Cryptocurrency Trading Bot** with SMC/ICT Strategy, Confidence Scoring (0-100), and Real-Time Signal Generation

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![Status](https://img.shields.io/badge/status-Production%20Ready-success)

---

## 📋 Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Integration](#api-integration)
- [Trading Strategy](#trading-strategy)
- [Admin Commands](#admin-commands)
- [Troubleshooting](#troubleshooting)
- [Project Structure](#project-structure)

---

## ✨ Features

### 🎯 Core Trading
- ✅ **Unlimited Signal Generation** - Continuous market scanning (no artificial limits)
- ✅ **Sniper Entry Accuracy** - ALL 5 confirmations required before trading
- �� **Automatic Trade Execution** - Market orders placed instantly on Binance
- ✅ **Real-Time Monitoring** - Live PNL updates every 25 seconds
- ✅ **SMC/ICT Strategy** - Advanced market structure analysis
- ✅ **Confidence Scoring** - 0-100 score on every signal (PREMIUM/STRONG/LOW_CONF/IGNORE)

### 📱 Account Management
- ✅ **Dual Account Support** - Spot + Testnet simultaneously
- ✅ **Account Switching** - Switch between accounts without re-entering credentials
- ✅ **Multiple Market Types** - Spot & Futures trading support
- ✅ **Position Importing** - Auto-import live Binance positions
- ✅ **Balance Syncing** - Real-time wallet updates

### 📊 Trade Management
- ✅ **Manual Controls** - Close/adjust any trade at any time
- ✅ **Partial Closing** - Close 25%, 50%, or 75% of position
- ✅ **Dynamic SL/TP** - Move stops and targets on-the-fly
- ✅ **Break Even** - Move SL to entry with one click
- ✅ **Trailing Stop** - Automated trailing stops (Futures only)
- ✅ **Trade History** - Full audit trail of all trades

### 🔒 Risk Management
- ✅ **Daily Protection** - Max 2 losses/day before auto-pause
- ✅ **Adaptive Position Sizing** - Based on signal score & account balance
- ✅ **ATR Volatility Filter** - Validates entry conditions
- ✅ **Lot Size Filtering** - Respects Binance minimum/maximum
- ✅ **Risk Per Trade** - Configurable risk percentage

### 👥 User System
- ✅ **Tiered Subscriptions** - Daily/Weekly/Monthly/Lifetime plans
- ✅ **Referral Program** - Earn subscription days per referral
- ✅ **Admin Panel** - Full bot management dashboard
- ✅ **User Banning** - Ban/unban users from admin
- ✅ **Statistics Dashboard** - Win rate, PNL, streak tracking

### 📡 Broadcasting
- ✅ **Telegram Channel Integration** - Post signals to public channel
- ✅ **Bulk Broadcasting** - Send messages to all/premium/free users
- ✅ **Signal Pinning** - Pin important broadcasts
- ✅ **Rich Media Support** - Text, photo, video, audio, documents

---

## 🏗️ Architecture

### System Flow

```
┌─────────────────────────────────────────────────────┐
│           MARKET SCANNER (Every 60s)                │
│  Analyzes all Binance pairs with SMC/ICT strategy   │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│        SIGNAL GENERATION (Unlimited)                │
│  5 Confirmations Required:                          │
│  ✓ Trend (4H & 1H aligned)                         │
│  ✓ Volume (spike detected)                         │
│  ✓ Indicator (RSI confirmed)                       │
│  ✓ Structure (BOS satisfied)                       │
│  ✓ Volatility (ATR valid)                          │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│      SIGNAL BROADCAST                               │
│  Sent to Premium Users with Auto Trading ON        │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│      AUTOMATIC TRADE EXECUTION                      │
│  For Each User:                                    │
│  1. Check daily protection                         │
│  2. Calculate position size                        │
│  3. Place market order on Binance                  │
│  4. Set SL & TP                                    │
│  5. Notify user                                    │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│       TRADE MONITORING (Every 25s)                 │
│  Check each open trade:                            │
│  • Price hit SL? → Close as LOSS                  │
│  • Price hit TP? → Close as WIN                   │
│  • Still open? → Update live PNL                  │
└─────────────────────────────────────────────────────┘
```

### Module Structure

```
Diane/
├── index.js              ← Entry point
├── config.js             ← Trading constants & settings
├── bot.js                ← Telegram bot & command handlers
├── strategy.js           ← SMC/ICT analysis engine
├── trading.js            ← Trade execution & management
├── scheduler.js          ← Automated scan/monitor loops
├── binance.js            ← Binance API client
├── database.js           ← JSON persistence layer
├── dashboard.js          ← User dashboard UI
├── admin.js              ← Admin panel & controls
├── referral.js           ← Referral system
├── channel.js            ← Telegram channel integration
├── logger.js             ← Logging utility
├── package.json          ← Dependencies
└── data/                 ← JSON database files
    ├── users.json
    ├── trades.json
    ├── signals.json
    ├── settings.json
    ├── payment.json
    ├── help.json
    └── channel.json
```

---

## 🚀 Installation

### Prerequisites

- **Node.js** ≥ 18.0.0
- **Telegram Bot Token** (from @BotFather)
- **Binance API Keys** (spot & futures, trading enabled)
- **VPS/Server** (24/7 uptime recommended)

### Step 1: Clone & Install

```bash
# Clone repository
git clone https://github.com/tututechk2005-spec/Diane.git
cd Diane

# Install dependencies
npm install

# Or use yarn
yarn install
```

### Step 2: Environment Setup

Create a `.env` file in the project root:

```bash
# .env
BOT_TOKEN=your_telegram_bot_token_here
ADMIN_CHAT_ID=your_telegram_user_id_here
```

**How to get these:**

1. **BOT_TOKEN**: Message @BotFather on Telegram → `/newbot` → Follow prompts → Copy token
2. **ADMIN_CHAT_ID**: Message @userinfobot on Telegram → Your ID will be shown

### Step 3: Run Locally (Testing)

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

### Step 4: Deploy to VPS (Production)

Using PM2 for process management:

```bash
# Install PM2 globally
npm install -g pm2

# Start bot with PM2
pm2 start index.js --name trading-bot-pro --watch false

# View logs
pm2 logs trading-bot-pro

# Auto-start on reboot
pm2 startup
pm2 save
```

---

## ⚙️ Configuration

### Trading Settings (`config.js`)

```javascript
// Strategy thresholds
const SCORE_MIN_TRADE        = 90;   // Minimum score to trade
const SCORE_PREMIUM          = 95;   // Premium signal (1.0% risk)
const SCORE_STRONG           = 90;   // Strong signal (0.75% risk)
const SCORE_LOW_CONF         = 85;   // Low confidence (0.50% risk)

// Risk parameters
const RISK_LOW_CONF          = 0.50; // Risk % for low confidence
const RISK_STRONG            = 0.75; // Risk % for strong signals
const RISK_PREMIUM           = 1.00; // Risk % for premium signals

// Daily limits
const DAILY_WIN_TARGET       = 3;    // Pause after 3 wins
const DAILY_MAX_LOSSES       = 2;    // Pause after 2 losses

// Technical parameters
const SCAN_INTERVAL          = 60;   // Scan every 60 seconds
const MAX_ACTIVE_TRADES      = 5;    // Max open trades per user
const SL_ATR_MULT            = 1.5;  // SL = Entry - (ATR × 1.5)
const TP_ATR_MULT            = 3.0;  // TP = Entry + (ATR × 3.0)
const MIN_RR                 = 1.5;  // Minimum Risk:Reward ratio
const MONITOR_INTERVAL_MS    = 25000;// Monitor trades every 25s
```

### Admin Settings (via Telegram)

As admin, send commands:

```
set risk 1                    # Risk per trade (percent)
set interval 60               # Scan interval (seconds)
set max_trades 5              # Max open trades
set maintenance on/off        # Toggle maintenance mode
set channel @mychannel        # Set signal channel
```

---

## 💬 Usage

### For Users

#### Starting the Bot

```
/start → Welcome screen with main menu
```

#### Dashboard Commands

| Button | Action |
|--------|--------|
| 📊 Dashboard | View wallet & trading status |
| 💰 Balance | Fetch live balance from Binance |
| 📈 Active Trades | View all open positions |
| 📜 History | Last 12 closed trades |
| 📊 Statistics | Win rate, PNL, streaks |
| ⚙️ Settings | Manage account & API |
| 💳 Subscription | View plans & pricing |
| 🎁 Referral | Get referral link & earnings |
| ℹ️ Help | How to use guide |

#### Connecting Binance

```
1. Dashboard → ⚙️ Settings
2. 🔑 Change Binance API
3. Select account type:
   - 📈 Spot (live trading)
   - 📊 Futures (leveraged trading)
   - 🟡 Spot Testnet (practice)
   - 🟡 Futures Testnet (practice)
4. Enter API Key → Enter Secret Key
5. Bot verifies & syncs positions
```

#### Enabling Auto Trading

```
1. Dashboard → 🟢 Auto Trading ON
2. Bot starts trading on every signal
3. View live trades → 📈 Active Trades
4. Manual control → 📊 Manage Trade
```

#### Managing a Trade

```
Active Trades → 📊 Manage [SYMBOL]

Options:
  🔴 Close 100%   - Close entire position
  ⚡ Close 50%    - Sell half position
  🔸 Close 25%    - Sell quarter
  🔹 Close 75%    - Sell three-quarters
  🛡 Move SL      - New stop loss price
  🎯 Move TP      - New take profit price
  ⚖️ Break Even   - Move SL to entry
  🔄 Trailing     - Set trailing stop % (Futures)
```

### For Admins

#### Admin Panel Access

```
Send /admin (only your ID from .env works)
```

#### Admin Functions

| Button | Function |
|--------|----------|
| 👥 Users | List all users (30 shown) |
| 📈 Trades | Recent trades with PNL |
| 📊 Statistics | Win rate, daily/weekly/monthly stats |
| 💰 Revenue | Estimated revenue by subscription |
| ⚙️ Settings | Bot configuration |
| 📋 Logs | Last 50 log entries |
| 📢 Broadcast | Send message to all/premium/free users |
| 📡 Channel | Manage signal delivery channel |
| 💳 Payment | Edit subscription prices & admin contact |
| ℹ️ Help Settings | Configure user help text |
| 🔐 Ban User | Ban user from bot |
| ✅ Unban | Remove user ban |
| 🗑 Delete User | Remove user account |
| 💳 Grant Sub | Grant subscription to user |
| 📥 Export | Export all data as JSON |
| 🔄 Restart | Restart bot process |
| 📊 Status | Bot uptime, memory, active syncs |

---

## 🎯 Trading Strategy

### SMC/ICT Analysis

Every symbol analyzed on 5 timeframes:

```
4H Candles (100) ─┐
1H Candles (200) ─┼─→ Trend Detection
15m Candles (200) ┘

↓

Detect Market Structure:
  • Break of Structure (BOS)
  • Change of Character (CHOCH)
  • Order Blocks
  • Fair Value Gaps (FVG)
  • Liquidity Sweeps
  • Volume Spikes
  • RSI Confirmation
```

### Signal Grades

```
95-100  🚀 PREMIUM   → 1.00% risk, highest confidence
 90-94  💎 STRONG    → 0.75% risk, high confidence
 85-89  📊 LOW_CONF  → 0.50% risk, moderate confidence
 <85    ❌ IGNORE    → Not traded
```

### Entry Requirements (ALL 5 must pass)

```
✅ Trend Confirmation
   └─ 4H trend = 1H trend (both bullish OR both bearish)

✅ Volume Confirmation
   └─ Current candle volume > 1.3× average

✅ Indicator Confirmation
   └─ RSI 30-55 (bullish) OR RSI 45-75 (bearish)

✅ Market Structure Confirmation
   └─ Break of Structure (BOS) detected on 1H

✅ Volatility Confirmation
   └─ ATR 0.08% - 12% of price (valid range)
```

If **any** confirmation fails → **NO SIGNAL** ✋

### Position Sizing

```
Position Size = (Account Balance × Risk%) / Stop Loss Distance

Example:
  Account: $1,000
  Signal Score: 95 (PREMIUM) → 1% risk
  Entry: $42,500
  SL: $42,000
  Distance: $500
  
  Size = ($1,000 × 0.01) / $500 = 0.02 BTC
```

### Stop Loss & Take Profit

```
SL = Entry - (ATR × 1.5)
TP = Entry + (ATR × 3.0)
R:R = TP Distance / SL Distance (minimum 1.5:1)

Example:
  Entry: 42,500 (BTC)
  ATR: 300
  SL: 42,500 - 450 = 42,050
  TP: 42,500 + 900 = 43,400
  R:R: 900/450 = 2.0:1 ✓
```

---

## 🔐 API Integration

### Binance API Requirements

**For Live Trading:**
```
✅ Trading enabled
✅ Margin trading enabled (for risk management)
✅ Futures enabled (if using Futures)
✅ IP Whitelist disabled (or include your VPS IP)
✅ API key permissions:
   - Enable Spot Trading
   - Enable Margin Trading
   - Enable Futures Trading
```

**For Testing:**
```
Use Testnet credentials instead:
  Spot Testnet: https://testnet.binance.vision
  Futures Testnet: https://testnet.binancefuture.com
```

### Account Switching

```javascript
// Users can store both accounts:
User = {
  api_key_spot: "...",
  api_secret_spot: "...",
  api_key_testnet: "...",
  api_secret_testnet: "...",
  current_account: "spot"  // Active account
}

// All trades use current_account
// Switch instantly via dashboard
```

---

## 📊 Database Schema

### Users
```json
{
  "telegram_id": 123456789,
  "username": "trader_john",
  "api_key_spot": "...",
  "api_secret_spot": "...",
  "api_key_testnet": "...",
  "api_secret_testnet": "...",
  "current_account": "spot",
  "auto_trading": true,
  "subscription": "active",
  "plan": "monthly",
  "subscription_expiry": "2026-07-29T...",
  "balance": 1000.50,
  "daily_wins": 2,
  "daily_losses": 1,
  "total_trades": 45,
  "wins": 28,
  "losses": 17,
  "win_rate": 62.2,
  "net_pnl": 250.75,
  "referral_code": "REFABCD1234",
  "total_referrals": 3,
  "referral_earnings": 9,
  "banned": false
}
```

### Trades
```json
{
  "trade_id": "uuid",
  "user_id": 123456789,
  "symbol": "BTCUSDT",
  "side": "BUY",
  "market_type": "spot",
  "entry": 42500.50,
  "sl": 42000.00,
  "tp": 43500.00,
  "quantity": 0.01,
  "status": "open",
  "result": "WIN",
  "profit": 12.50,
  "profit_pct": 2.94,
  "open_time": "2026-06-29T10:30:00Z",
  "close_time": "2026-06-29T10:45:00Z"
}
```

### Signals
```json
{
  "signal_id": "uuid",
  "symbol": "BTCUSDT",
  "side": "BUY",
  "market_type": "spot",
  "entry": 42500.50,
  "sl": 42000.00,
  "tp": 43500.00,
  "score": 97,
  "grade": "PREMIUM",
  "status": "ACTIVE",
  "timestamp": "2026-06-29T10:30:00Z",
  "confirmations": {
    "trend_4h": true,
    "trend_1h": true,
    "bos": true,
    "volume_spike": true,
    "rsi": true
  }
}
```

---

## 🛠️ Troubleshooting

### Bot Won't Start

```bash
# Check Node version
node --version  # Must be ≥18.0.0

# Check .env file exists
ls -la .env

# Verify token & admin ID
echo $BOT_TOKEN
echo $ADMIN_CHAT_ID

# View error logs
cat logs/bot.log
```

### Signals Not Generating

```
✓ Check market scanner is running (logs show "Market scan started")
✓ Verify all 5 confirmations are met (see recent logs)
✓ Check daily signal count (Admin → Statistics)
✓ Restart scheduler: Admin Panel → Restart
```

### Trades Not Executing

```
✓ User has premium subscription (check Dashboard → Subscription)
✓ Binance API connected (Dashboard → ⚙️ Settings)
✓ Auto Trading is ON (Dashboard → 🟢 Auto Trading ON)
✓ Account has sufficient balance
✓ Not hit daily 2-loss limit
✓ Check API error logs (Admin → Logs)
```

### API Errors

```
❌ "Invalid API key"
  └─ Regenerate keys on Binance, save new ones

❌ "Insufficient balance"
  └─ Deposit USDT to Binance account

❌ "Invalid symbol"
  └─ Symbol might be delisted, restart bot

❌ "Order would trigger immediately"
  └─ ATR too tight, signal won't execute
```

### Performance Issues

```bash
# Monitor bot resource usage
pm2 monit

# Check active trades
Admin → Statistics → Open Trades

# Increase max_trades if needed
set max_trades 10  # Default is 5

# Reduce scan interval if too slow
set interval 120   # Increase from 60s to 120s
```

---

## 📁 Project Structure

```
Diane/
├── 📄 README.md                    (This file)
├── 📄 package.json                 (Dependencies)
├── 📄 .env                         (Configuration)
│
├── 🔧 Core Modules
│   ├── index.js                    (Entry point - starts bot & scheduler)
│   ├── config.js                   (Trading constants)
│   ├── logger.js                   (Logging with rotation)
│   └── database.js                 (JSON persistence)
│
├── 🤖 Bot & UI
│   ├── bot.js                      (Telegram bot & command handlers)
│   ├── dashboard.js                (User dashboard UI)
│   ├── admin.js                    (Admin panel & controls)
│   └── referral.js                 (Referral system)
│
├── 📊 Trading Engine
│   ├── strategy.js                 (SMC/ICT analysis)
│   ├── trading.js                  (Trade execution)
│   ├── scheduler.js                (Automated loops)
│   └── binance.js                  (Binance API client)
│
├── 📡 Integration
│   └── channel.js                  (Telegram channel posting)
│
└── 📂 data/
    ├── users.json                  (User database)
    ├── trades.json                 (Trade history)
    ├── signals.json                (Signal database)
    ├── settings.json               (Bot settings)
    ├── payment.json                (Subscription prices)
    ├── help.json                   (Help text)
    ├── channel.json                (Channel config)
    └── referrals.json              (Referral log)
```

---

## 🚀 Recent Changes (v2.0.0)

### ✅ Removed
- ❌ Recovery Mode (completely removed)
- ❌ Signal cooldowns (4-hour delays gone)
- ❌ Daily signal caps

### ✅ Added
- ✅ Unlimited signal generation
- ✅ Account switching (Spot ↔ Testnet)
- ✅ Dual API storage (Spot + Testnet simultaneously)
- ✅ Fixed referral system with proper tracking
- ✅ Strict 5-confirmation sniper entry requirement

### ✅ Improved
- ✅ Position sizing algorithm
- ✅ Trade monitoring loop
- ✅ Admin statistics & reporting
- ✅ Error handling & logging
- ✅ Database integrity checks

---

## 📞 Support

For issues or questions:

1. Check **Troubleshooting** section above
2. Review bot logs: `cat logs/bot.log`
3. Admin Panel → 📋 Logs (last 50 entries)
4. Check Binance API status
5. Verify `.env` configuration

---

## 📄 License

MIT License - See LICENSE file

---

## ⚠️ Disclaimer

**This bot is for educational purposes. Cryptocurrency trading carries risk of loss. Always:**

- ✅ Start with small amounts on testnet
- ✅ Use risk management (daily loss limits)
- ✅ Monitor trades regularly
- ✅ Keep API keys secure
- ✅ Never share your seed phrase
- ✅ Do your own research (DYOR)

**Not financial advice. Trade at your own risk.**

---

## 🙏 Credits

Built with:
- [Telegraf](https://telegraf.js.org/) - Telegram Bot Framework
- [Node.js](https://nodejs.org/) - Runtime
- [Binance API](https://binance-docs.github.io/apidocs/) - Exchange Integration

---

**Version:** 2.0.0 | **Last Updated:** June 29, 2026

🚀 **Ready for Production Deployment**
