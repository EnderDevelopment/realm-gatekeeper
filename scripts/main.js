import { system, world } from "@minecraft/server";

const RULES_KEY = "acg:rules";
const SAFE_POSITION_KEY = "acg:safe_position";
const OWNER_TAG = "acg_owner";
const ADMIN_TAG = "acg_admin";
const CHECK_INTERVAL_TICKS = 10;

const DEFAULT_RULES = {
  dimensions: {
    "minecraft:overworld": { open: true, pvp: true },
    "minecraft:nether": { open: true, pvp: true },
    "minecraft:the_end": { open: true, pvp: true },
  },
  zones: [],
};

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function loadRules() {
  const raw = world.getDynamicProperty(RULES_KEY);
  if (typeof raw !== "string") return clone(DEFAULT_RULES);
  try {
    const parsed = JSON.parse(raw);
    return { dimensions: { ...clone(DEFAULT_RULES.dimensions), ...(parsed.dimensions ?? {}) }, zones: Array.isArray(parsed.zones) ? parsed.zones : [] };
  } catch { return clone(DEFAULT_RULES); }
}

function saveRules(rules) { world.setDynamicProperty(RULES_KEY, JSON.stringify(rules)); }
function canManage(player) { return player.hasTag(OWNER_TAG) || player.hasTag(ADMIN_TAG); }
function message(player, text) { player.sendMessage(`§b[ACG]§r ${text}`); }

function dimensionId(value) {
  const aliases = { overworld: "minecraft:overworld", nether: "minecraft:nether", end: "minecraft:the_end", "minecraft:overworld": "minecraft:overworld", "minecraft:nether": "minecraft:nether", "minecraft:the_end": "minecraft:the_end" };
  return aliases[value.toLowerCase()] ?? value;
}

function parseNumber(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a number.`);
  return parsed;
}

function parseBoolean(value, label) {
  if (["open", "true", "on"].includes(value.toLowerCase())) return true;
  if (["closed", "false", "off"].includes(value.toLowerCase())) return false;
  throw new Error(`${label} must be open or closed.`);
}

function parsePvp(value) {
  if (["pvp", "true", "on"].includes(value.toLowerCase())) return true;
  if (["nopvp", "false", "off"].includes(value.toLowerCase())) return false;
  throw new Error("PvP must be pvp or nopvp.");
}

function orderedBounds(a, b) { return { min: Math.min(a, b), max: Math.max(a, b) }; }

function zoneContains(zone, player) {
  if (zone.dimension !== player.dimension.id) return false;
  const location = player.location;
  return location.x >= zone.min.x && location.x <= zone.max.x && location.y >= zone.min.y && location.y <= zone.max.y && location.z >= zone.min.z && location.z <= zone.max.z;
}

function getEffectiveRule(rules, player) {
  const dimensionRule = rules.dimensions[player.dimension.id] ?? { open: true, pvp: true };
  const matchingZones = rules.zones.filter((zone) => zoneContains(zone, player));
  return matchingZones.length === 0 ? dimensionRule : matchingZones[matchingZones.length - 1];
}

function readSafePosition(player) {
  const raw = player.getDynamicProperty(SAFE_POSITION_KEY);
  if (typeof raw !== "string") return undefined;
  try { return JSON.parse(raw); } catch { return undefined; }
}

function rememberSafePosition(player, rule) {
  if (rule.open) player.setDynamicProperty(SAFE_POSITION_KEY, JSON.stringify({ dimension: player.dimension.id, location: player.location }));
}

function getDimension(id) {
  try { return world.getDimension(id); } catch { return world.getDimension("minecraft:overworld"); }
}

function enforceAccess(player) {
  const rule = getEffectiveRule(loadRules(), player);
  if (rule.open) { rememberSafePosition(player, rule); return; }
  const previous = readSafePosition(player);
  if (previous) player.teleport(previous.location, { dimension: getDimension(previous.dimension) });
  else player.teleport({ x: 0, y: 100, z: 0 }, { dimension: getDimension("minecraft:overworld") });
  message(player, "This dimension or structure is closed to entry.");
}

function listRules(player, rules) {
  message(player, "Dimension rules:");
  for (const [id, rule] of Object.entries(rules.dimensions)) message(player, `- ${id}: ${rule.open ? "open" : "closed"}, ${rule.pvp ? "pvp" : "nopvp"}`);
  message(player, `Structure zones: ${rules.zones.length}`);
  for (const zone of rules.zones) message(player, `- ${zone.name}: ${zone.dimension}, ${zone.open ? "open" : "closed"}, ${zone.pvp ? "pvp" : "nopvp"}`);
}

function handleCommand(player, messageText) {
  if (!canManage(player)) { message(player, "You need the acg_owner or acg_admin tag to manage rules."); return; }
  const args = messageText.trim().split(/\s+/).filter(Boolean);
  if (args.length === 0 || args[0] === "help") {
    message(player, "Use: dimension <id> <open|closed> <pvp|nopvp>");
    message(player, "Use: zone add <name> <dimension> <x1> <y1> <z1> <x2> <y2> <z2> <open|closed> <pvp|nopvp>");
    message(player, "Use: zone remove <name> | zone list | list");
    return;
  }

  const rules = loadRules();
  if (args[0].toLowerCase() === "list") { listRules(player, rules); return; }
  if (args[0].toLowerCase() === "dimension") {
    if (args.length !== 4) throw new Error("Use: dimension <id> <open|closed> <pvp|nopvp>");
    const id = dimensionId(args[1]);
    rules.dimensions[id] = { open: parseBoolean(args[2], "Access"), pvp: parsePvp(args[3]) };
    saveRules(rules); message(player, `Updated ${id}.`); return;
  }
  if (args[0].toLowerCase() !== "zone") throw new Error("Unknown command. Use help.");
  if (args[1] === "list") { listRules(player, rules); return; }
  if (args[1] === "remove") {
    if (args.length !== 3) throw new Error("Use: zone remove <name>");
    const before = rules.zones.length;
    rules.zones = rules.zones.filter((zone) => zone.name !== args[2]);
    if (rules.zones.length === before) throw new Error("No zone with that name exists.");
    saveRules(rules); message(player, `Removed zone ${args[2]}.`); return;
  }
  if (args[1] !== "add" || args.length !== 12) throw new Error("Use: zone add <name> <dimension> <x1> <y1> <z1> <x2> <y2> <z2> <open|closed> <pvp|nopvp>");
  const xBounds = orderedBounds(parseNumber(args[4], "x1"), parseNumber(args[7], "x2"));
  const yBounds = orderedBounds(parseNumber(args[5], "y1"), parseNumber(args[8], "y2"));
  const zBounds = orderedBounds(parseNumber(args[6], "z1"), parseNumber(args[9], "z2"));
  const zone = { name: args[2], dimension: dimensionId(args[3]), min: { x: xBounds.min, y: yBounds.min, z: zBounds.min }, max: { x: xBounds.max, y: yBounds.max, z: zBounds.max }, open: parseBoolean(args[10], "Access"), pvp: parsePvp(args[11]) };
  rules.zones = rules.zones.filter((entry) => entry.name !== zone.name);
  rules.zones.push(zone); saveRules(rules); message(player, `Saved zone ${zone.name}.`);
}

world.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "acg:manage") return;
  const source = event.sourceEntity;
  if (!source || source.typeId !== "minecraft:player") return;
  try { handleCommand(source, event.message); } catch (error) { message(source, error instanceof Error ? error.message : "Invalid command."); }
});

world.beforeEvents.entityHurt.subscribe((event) => {
  if (event.damageSource.cause !== "entity_attack") return;
  const attacker = event.damageSource.damagingEntity;
  const victim = event.hurtEntity;
  if (!attacker || !victim || attacker.typeId !== "minecraft:player" || victim.typeId !== "minecraft:player") return;
  if (!getEffectiveRule(loadRules(), victim).pvp) event.cancel = true;
});

system.runInterval(() => { for (const player of world.getAllPlayers()) enforceAccess(player); }, CHECK_INTERVAL_TICKS);
system.run(() => { if (typeof world.getDynamicProperty(RULES_KEY) !== "string") saveRules(clone(DEFAULT_RULES)); });
