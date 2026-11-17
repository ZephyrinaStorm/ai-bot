const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'guild-config.json');
let configs = {};

function load() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    configs = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Could not load guild settings:', error.message);
    configs = {};
  }
}

function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(configs, null, 2));
}

function get(guildId) { return configs[guildId] || null; }
function set(guildId, value) { configs[guildId] = value; save(); }

load();
module.exports = { get, set };
