# ⚔️ Clash of Clans Discord Bot

A full-featured Discord bot for your Clash of Clans clan — slash commands for all CoC API endpoints plus automated event notifications.

---

## 📋 Features

### Slash Commands

#### 🏰 Clan Commands
| Command | Description |
|---|---|
| `/clan [tag]` | Full clan info (badge, level, war record, description) |
| `/members [tag]` | List all 50 members with TH level & trophies |
| `/donations [tag]` | Donation leaderboard |
| `/trophies [tag]` | Trophy leaderboard |
| `/clanleaderboard [tag]`| Combined clan leaderboard (trophies + donations + war stars) |
| `/searchclans <name>` | Search for clans by name |

#### ⚔️ War & CWL Commands
| Command | Description |
|---|---|
| `/war [tag]` | Current war status with live scores |
| `/warlog [tag]` | Last 10 wars with W/L/Tie results |
| `/warattacks [tag]` | Show who hasn't attacked yet (live data) |
| `/warstats [tag]` | Show a player's attack details in the current war |
| `/warmap` | Visual war map showing all positions and attack results |
| `/warrefresh` | Live war status with a 🔄 Refresh button |
| `/cwl [tag]` | CWL group info & season |

#### 🏰 Capital Raids
| Command | Description |
|---|---|
| `/raids [tag]` | Capital Raid Weekend stats |
| `/raidsrefresh` | Raid Weekend stats with a 🔄 Refresh button |

#### 👤 Player Commands
| Command | Description |
|---|---|
| `/player [tag]` | Full player profile (heroes, leagues, donations, etc.) |
| `/link <tag>` | Link your Discord account to your Clash of Clans profile |
| `/unlink` | Unlink your Discord account from your CoC profile |
| `/compare <tag1> <tag2>`| Compare two players side by side |
| `/upgrades [tag]` | Show a player's currently upgrading buildings/troops |

#### 🛠️ Utility & Info Commands
| Command | Description |
|---|---|
| `/whois <user>` | Look up a Discord member's linked CoC profile |
| `/townhall <level>` | Show what unlocks at a given Town Hall level |
| `/season` | Show current Legend League season info |
| `/leagues` | List all trophy leagues |
| `/warleagues` | List all war leagues |
| `/locations` | List all location IDs for rankings |
| `/rankings <location_id> <type>` | Top clan/player rankings by location |
| `/goldpass` | Current Gold Pass season dates |
| `/remind <time> <msg>` | Set a reminder — bot will DM you (survives restarts) |
| `/poll <question>` | Create a yes/no poll |

#### 🚨 Admin Commands
| Command | Description |
|---|---|
| `/setchannel <event> <channel>`| Set notification channel for an event |
| `/setrole <event> <role>` | Set a role to ping for event notifications |
| `/channels` | Show all configured channels and ping roles |
| `/announce <message> [ping]` | Send a clan announcement |
| `/cachestatus` | Show bot cache status |
| `/stats` | Show bot statistics |
| `/forcepurgecache` | Manually purge stale cache and old logs |

#### Discord Webhook Integration
| Command | Description |
|---|---|
| `/webhooktest` | Send a test webhook message to all enabled webhook URLs |

### Automated Notifications
| Event | Triggers |
|---|---|
| ⚔️ **War** | War declared (prep day) → Battle day starts → Ending in 1 hour → War ended (with W/L result) |
| 🏆 **CWL** | New CWL season detected |
| 🏰 **Raid Weekend** | Raids start → Ending in 1 hour → Raids ended (with loot summary) |
| 🎮 **Clan Games** | Games start (22nd) → Warning day before end (27th) → Games ended (28th) |

### Bot Status Rotation (every 30s)
- 👥 `X/50 Members | ClanName`
- 🏆 `X Clan Trophies`
- ⚔️ `X War Wins`
- 🏰 `Capital League: LeagueName`
- 🎮 `LvX ClanName`

### Update(latest v1.1.1)
- Added config.js for easy configuration
- Added discord webhook integration for console logs

This is the live usage of the bot from my pterodactyl panel,runs pretty good on low resources as well.
<img width="1567" height="908" alt="panel" src="https://github.com/user-attachments/assets/917ca16a-fd60-4b9e-bd21-75e27917b9b7" />

---

## 🚀 Setup Guide

### Step 1: Get Your API Keys

**Discord Bot Token:**
1. Go to https://discord.com/developers/applications
2. Click **New Application** → name it
3. Go to **Bot** tab → click **Reset Token** → copy it
4. Enable **Message Content Intent** under Privileged Gateway Intents
5. Go to **OAuth2 → URL Generator** → check `bot` + `applications.commands`
6. Under Bot Permissions check: `Send Messages`, `Embed Links`, `Read Message History`
7. Copy the generated URL and invite the bot to your server

**Client ID:** Copy from **General Information** tab (Application ID)

**Guild ID:** Right-click your server in Discord → **Copy Server ID** (enable Developer Mode in Discord settings first)

**Clash of Clans API Token:**
1. Go to https://developer.clashofclans.com/
2. Create an account and log in
3. Go to **My Account** → **Create New Key**
4. ⚠️ **Important:** Enter your server's IP address (the machine running the bot)
5. Copy the token

**Your Clan Tag:** Your clan tag from in-game (e.g., `#ABC1234`)

---

### Step 2: Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```env
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_application_client_id
GUILD_ID=your_discord_server_id
COC_API_TOKEN=your_clash_of_clans_api_token
CLAN_TAG=#YOURCLAN
POLL_INTERVAL=5
```

---

### Step 3: Install & Run

```bash
npm install

# Deploy slash commands to your server (run once, or after adding new commands)
npm run deploy

# Start the bot
npm start
```

---

### Step 4: Set Notification Channels (in Discord)

Use the `/setchannel` command in Discord (requires Administrator permission):

```
/setchannel event:⚔️ War Notifications        channel:#war-updates
/setchannel event:🏆 CWL Notifications        channel:#cwl-updates
/setchannel event:🏰 Raid Weekend Notifications channel:#raid-updates
/setchannel event:🎮 Clan Games Notifications  channel:#clan-games
/setchannel event:🌟 General Notifications     channel:#general
/setchannel event:🚨 Admin Alerts              channel:#admin
```

You can also set roles to ping with `/setrole`.
Channel and role settings are saved to `data/settings.json` and persist across restarts.

Discord Webhook Integration:
1.Create a logs channel
2.Channel Settings > Integration > Webhooks > New Webhook
3.Copy the Webhook URL and paste it in the config.js file

Note-
- If webhook dosent work or /webhooktest dosent work give necessary permissions to your bot for that specific channels.
- You can send all logs to one channel or can create multiple log channels for each event.

---

## 📁 File Structure

```text
coc-bot/
├── index.js                 # Main bot entry point
├── deploy-commands.js       # Register slash commands with Discord
├── ecosystem.config.cjs     # PM2 configuration for process management
├── .env                     # Your secrets (never commit this!)
├── .env.example             # Template
├── package.json             # NPM dependencies and scripts
├── data/
│   └── settings.json        # Auto-created; stores channel config + state
├── logs/                    # Auto-created; stores application logs
└── src/
    ├── commands/            # Slash command definitions
    │   ├── admin.js
    │   ├── clan.js
    │   ├── help.js
    │   ├── index.js         # Exports all commands
    │   ├── info.js
    │   ├── player.js
    │   ├── utility.js
    │   └── war.js
    ├── events/
    │   ├── monitor.js       # Automated event polling
    │   └── status.js        # Bot status rotation
    └── utils/               # Helpers, Cache, API wrappers, etc.
        ├── apiQueue.js      # Queueing for API calls
        ├── cache.js         # In-memory and disk caching
        ├── cachePurge.js    # Automatic cache cleanup scheduler
        ├── cocApi.js        # Clash of Clans API wrapper
        ├── cooldown.js      # Command cooldown management
        ├── embeds.js        # Discord embed builders
        ├── logger.js        # Winston logging configuration
        ├── rateLimiter.js   # API and command rate limiting
        ├── reminders.js     # User reminder management
        ├── store.js         # Settings persistence (DB abstraction)
        └── validate.js      # Environment variable validation
```

---

## 🔧 Notes

- The CoC API **requires your server's IP** to be whitelisted in the developer portal. If you change hosting, update your API key's allowed IPs.
- The bot uses the official REST API — no unofficial scraping.
- Clan Games notifications are date-based (22nd–28th of each month) since there's no dedicated API endpoint.

