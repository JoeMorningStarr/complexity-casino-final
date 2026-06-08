const FLOOR_WIDTH = 1000;
const FLOOR_HEIGHT = 700;
const PLAYER_SIZE = 62;
const INTERACT_DISTANCE = 92;
const TABLE_PADDING = 3;
const ECONOMY_VERSION = 3;
const STARTING_CHIPS = 150;
const RUN_SECONDS = 10 * 60;
const LAB_SECONDS = 5 * 60;
const BALANCE_LAB_SECONDS = {
  easy: 60,
  medium: 90,
  hard: 150,
};
const MIN_BET = 50;
const DIFFICULTY_ENTRY_COSTS = {
  easy: 50,
  medium: 100,
  hard: 150,
};

const DIFFICULTY_MULTIPLIERS = {
  easy: 1.0,
  medium: 1.8,
  hard: 2.7,
};

const SERVICE_ITEMS = {
  time_freeze: {
    name: "Freeze Critical",
    price: 120,
    description: "Adds 6 seconds when a mini-game enters a critical danger timer.",
  },
  extra_time: {
    name: "Add Lab Time",
    price: 100,
    description: "Adds 15 seconds to the active mini-game lab timer.",
  },
  hint: {
    name: "Hint Token",
    price: 80,
    description: "Buys one educational hint inside a mini-game.",
  },
};

const games = {
  pathfinding: {
    title: "Route Roulette",
    type: "Search Algorithms",
    file: "games/pathfinding_lab.html",
    description:
      "Escape a hidden maze, bet on the most efficient search strategy, then compare BFS, DFS, and A*.",
  },
  divide: {
    title: "Merge the Vault",
    type: "Recursion and Merge Sort",
    file: "games/divide_conquer_temple.html",
    description:
      "Split vault relics by position, solve base cases, and merge sorted rooms by choosing the smaller pointer value.",
  },
  future: {
    title: "Balance the House",
    type: "AVL Trees and Rotations",
    file: "games/balance_the_house.html",
    description:
      "Build an AVL tree with casino chips, decide when it is balanced, and rotate under pressure when the house starts shaking.",
  },
};

const defaultInventory = Object.fromEntries(Object.keys(SERVICE_ITEMS).map((key) => [key, 0]));
const PROGRESS_GAME_KEYS = ["divide", "future"];
const DIFFICULTIES = ["easy", "medium", "hard"];

function createEmptyModeProgress() {
  return Object.fromEntries(PROGRESS_GAME_KEYS.map((key) => [key, {}]));
}

function normalizeModeProgress(savedCompletedModes = {}, savedCompleted = {}) {
  const progress = createEmptyModeProgress();
  PROGRESS_GAME_KEYS.forEach((gameKey) => {
    DIFFICULTIES.forEach((difficulty) => {
      progress[gameKey][difficulty] = Boolean(savedCompletedModes?.[gameKey]?.[difficulty]);
    });

    if (savedCompleted?.[gameKey] === true) {
      progress[gameKey].medium = true;
      progress[gameKey].hard = true;
    }
  });
  return progress;
}

function isTableComplete(gameKey) {
  if (!PROGRESS_GAME_KEYS.includes(gameKey)) return false;
  return DIFFICULTIES.every((difficulty) => Boolean(state.completedModes?.[gameKey]?.[difficulty]));
}

const state = {
  chips: STARTING_CHIPS,
  completed: {},
  completedModes: createEmptyModeProgress(),
  inventory: { ...defaultInventory },
  suspicion: 0,
  reputation: 100,
  debt: 0,
  loanActive: false,
  loanPrincipal: 0,
  loanStart: 0,
  loanDuration: 0,
  loanDeadline: 0,
  loanFailed: false,
  totalGamesPlayed: 0,
  totalGamesWon: 0,
  totalGamesLost: 0,
  xp: 0,
  streak: 0,
  logs: [],
  runStartedAt: Date.now(),
  player: { x: 419, y: 340, direction: "front" },
  target: null,
  selectedGame: null,
  currentRound: null,
  pendingBoosts: [],
};

const chipsValue = document.querySelector("#chipsValue");
const completedValue = document.querySelector("#completedValue");
const runTimerValue = document.querySelector("#runTimerValue");
const betValue = document.querySelector("#betValue");
const debtValue = document.querySelector("#debtValue");
const suspicionValue = document.querySelector("#suspicionValue");
const xpValue = document.querySelector("#xpValue");
const streakValue = document.querySelector("#streakValue");
const tableList = document.querySelector("#tableList");
const inventoryList = document.querySelector("#inventoryList");
const goalText = document.querySelector("#goalText");
const casinoFloor = document.querySelector("#casinoFloor");
const player = document.querySelector("#player");
const interactionPrompt = document.querySelector("#interactionPrompt");
const mainMenu = document.querySelector("#mainMenu");
const tableDialog = document.querySelector("#tableDialog");
const dialogType = document.querySelector("#dialogType");
const dialogTitle = document.querySelector("#dialogTitle");
const dialogDescription = document.querySelector("#dialogDescription");
const startGameBtn = document.querySelector("#startGameBtn");
const betDialog = document.querySelector("#betDialog");
const betTitle = document.querySelector("#betTitle");
const betDescription = document.querySelector("#betDescription");
const betInput = document.querySelector("#betInput");
const difficultySelect = document.querySelector("#difficultySelect");
const betMessage = document.querySelector("#betMessage");
const serviceDialog = document.querySelector("#serviceDialog");
const serviceGrid = document.querySelector("#serviceGrid");
const serviceMessage = document.querySelector("#serviceMessage");
const loanStatus = document.querySelector("#loanStatus");
const npcDialog = document.querySelector("#npcDialog");
const npcName = document.querySelector("#npcName");
const npcLine = document.querySelector("#npcLine");
const gameRunner = document.querySelector("#gameRunner");
const gameFrame = document.querySelector("#gameFrame");
const runnerTitle = document.querySelector("#runnerTitle");
const labTimerValue = document.querySelector("#labTimerValue");
const musicToggleBtn = document.querySelector("#musicToggleBtn");
const musicVolumeSlider = document.querySelector("#musicVolumeSlider");
const exportLogsBtn = document.querySelector("#exportLogsBtn");

const music = new Audio("assets/sounds/music/floor_1.mp3");
music.loop = true;
let musicVolume = Number(localStorage.getItem("complexityCasinoMusicVolume") || 32);
let musicEnabled = localStorage.getItem("complexityCasinoMusicEnabled") !== "false";
music.volume = Math.max(0, Math.min(1, musicVolume / 100));

const keys = new Set();
let lastFrame = performance.now();
let nearestInteraction = null;

function toX(value) {
  return `${(value / FLOOR_WIDTH) * 100}%`;
}

function toY(value) {
  return `${(value / FLOOR_HEIGHT) * 100}%`;
}

function formatTime(totalSeconds) {
  const safe = Math.max(0, Math.ceil(totalSeconds));
  const minutes = String(Math.floor(safe / 60)).padStart(2, "0");
  const seconds = String(safe % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function layoutAssets() {
  document.querySelectorAll(".floor-asset").forEach((asset) => {
    const x = Number(asset.dataset.x || 0);
    const y = Number(asset.dataset.y || 0);
    const w = Number(asset.dataset.w || 60);
    const h = Number(asset.dataset.h || 60);
    const rotation = Number(asset.dataset.rotation || 0);

    asset.style.left = toX(x);
    asset.style.top = toY(y);
    asset.style.width = toX(w);
    asset.style.height = toY(h);
    if (asset.classList.contains("game-table")) {
      asset.style.setProperty("--rotation", `${rotation}deg`);
    } else if (rotation) {
      asset.style.transform = `rotate(${rotation}deg)`;
    }
  });
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem("complexityCasinoWebState") || "{}");
    const migratedEconomy = saved.economyVersion !== ECONOMY_VERSION;
    Object.assign(state, {
      chips: migratedEconomy ? STARTING_CHIPS : Number.isFinite(saved.chips) ? saved.chips : STARTING_CHIPS,
      completed: migratedEconomy ? {} : saved.completed || {},
      completedModes: migratedEconomy ? createEmptyModeProgress() : normalizeModeProgress(saved.completedModes, saved.completed),
      inventory: { ...defaultInventory, ...(saved.inventory || {}) },
      suspicion: saved.suspicion || 0,
      reputation: saved.reputation || 100,
      debt: saved.debt || 0,
      loanActive: Boolean(saved.loanActive),
      loanPrincipal: saved.loanPrincipal || 0,
      loanStart: saved.loanStart || 0,
      loanDuration: saved.loanDuration || 0,
      loanDeadline: saved.loanDeadline || 0,
      loanFailed: Boolean(saved.loanFailed),
      totalGamesPlayed: saved.totalGamesPlayed || 0,
      totalGamesWon: saved.totalGamesWon || 0,
      totalGamesLost: saved.totalGamesLost || 0,
      xp: migratedEconomy ? 0 : saved.xp || 0,
      streak: saved.streak || 0,
      logs: migratedEconomy ? [] : Array.isArray(saved.logs) ? saved.logs : [],
      runStartedAt: saved.runStartedAt || Date.now(),
    });
    state.completed = Object.fromEntries(PROGRESS_GAME_KEYS.map((key) => [key, isTableComplete(key)]));
    if (migratedEconomy) saveState();
  } catch {
    state.inventory = { ...defaultInventory };
  }
}

function saveState() {
  localStorage.setItem(
    "complexityCasinoWebState",
    JSON.stringify({
      chips: state.chips,
      economyVersion: ECONOMY_VERSION,
      completed: state.completed,
      completedModes: state.completedModes,
      inventory: state.inventory,
      suspicion: state.suspicion,
      reputation: state.reputation,
      debt: state.debt,
      loanActive: state.loanActive,
      loanPrincipal: state.loanPrincipal,
      loanStart: state.loanStart,
      loanDuration: state.loanDuration,
      loanDeadline: state.loanDeadline,
      loanFailed: state.loanFailed,
      totalGamesPlayed: state.totalGamesPlayed,
      totalGamesWon: state.totalGamesWon,
      totalGamesLost: state.totalGamesLost,
      xp: state.xp,
      streak: state.streak,
      logs: state.logs,
      runStartedAt: state.runStartedAt,
    })
  );
}

function completedCount() {
  return PROGRESS_GAME_KEYS.filter((key) => isTableComplete(key)).length;
}

function completedModeCount(gameKey) {
  return DIFFICULTIES.filter((difficulty) => Boolean(state.completedModes?.[gameKey]?.[difficulty])).length;
}

function modeProgressText(gameKey) {
  return DIFFICULTIES
    .map((difficulty) => `${difficultyLabel(difficulty)} ${state.completedModes?.[gameKey]?.[difficulty] ? "✓" : "○"}`)
    .join(" | ");
}

function updateLoan() {
  if (!state.loanActive) return;
  const now = Date.now();
  if (now >= state.loanDeadline) {
    state.loanFailed = true;
    return;
  }
  const elapsed = Math.floor((now - state.loanStart) / 1000);
  state.debt = Math.floor(state.loanPrincipal * 1.3) + Math.floor(elapsed / 10) * 5;
}

function loanTimeLeft() {
  if (!state.loanActive) return 0;
  return Math.max(0, Math.ceil((state.loanDeadline - Date.now()) / 1000));
}

function renderStatus() {
  updateLoan();
  const runLeft = RUN_SECONDS - (Date.now() - state.runStartedAt) / 1000;
  chipsValue.textContent = String(state.chips);
  completedValue.textContent = `${completedCount()} / ${PROGRESS_GAME_KEYS.length}`;
  runTimerValue.textContent = formatTime(runLeft);
  betValue.textContent = state.currentRound ? String(state.currentRound.bet) : "0";
  debtValue.textContent = state.loanActive ? `${state.debt} (${formatTime(loanTimeLeft())})` : "None";
  if (suspicionValue) suspicionValue.textContent = String(state.suspicion);
  if (xpValue) xpValue.textContent = String(state.xp);
  if (streakValue) streakValue.textContent = `x${Math.max(1, state.streak || 0)}`;
  goalText.textContent =
    completedCount() >= PROGRESS_GAME_KEYS.length
      ? "Merge the Vault and Balance the House are complete. Route Roulette is demo-only and does not count."
      : "Clear Easy, Medium, and Hard on Merge the Vault and Balance the House. Route Roulette is demo-only.";
  if (state.loanFailed || runLeft <= 0) {
    goalText.textContent = state.loanFailed
      ? "Debt unpaid. Reset progress to start a clean run."
      : "Run timer ended. Reset progress to try again.";
  }
}

function renderTables() {
  tableList.replaceChildren();
  PROGRESS_GAME_KEYS.forEach((key) => {
    const game = games[key];
    const card = document.createElement("div");
    card.className = "table-card";
    const title = document.createElement("strong");
    title.textContent = game.title;
    const meta = document.createElement("span");
    const modeCount = completedModeCount(key);
    meta.textContent = isTableComplete(key)
      ? `Completed: ${modeProgressText(key)}`
      : `${modeCount} / 3 modes cleared: ${modeProgressText(key)}`;
    card.append(title, meta);
    tableList.appendChild(card);
  });

  document.querySelectorAll(".game-table").forEach((table) => {
    const key = table.dataset.game;
    table.classList.toggle("completed", PROGRESS_GAME_KEYS.includes(key) && isTableComplete(key));
  });
}

function renderInventory() {
  inventoryList.replaceChildren();
  Object.entries(SERVICE_ITEMS).forEach(([key, item]) => {
    const row = document.createElement("div");
    row.className = "inventory-row";
    row.innerHTML = `<strong>${item.name}: ${state.inventory[key] || 0}</strong><span>${item.description}</span>`;
    inventoryList.appendChild(row);
  });
}

function renderServiceShop() {
  serviceGrid.replaceChildren();
  Object.entries(SERVICE_ITEMS).forEach(([key, item]) => {
    const row = document.createElement("div");
    row.className = "service-item";
    row.innerHTML = `<h3>${item.name}</h3><p>${item.description}</p><strong>Price: ${item.price} chips</strong>`;
    const buy = document.createElement("button");
    buy.className = "primary-button";
    buy.type = "button";
    buy.textContent = "Buy";
    buy.onclick = () => buyService(key);
    row.appendChild(buy);
    serviceGrid.appendChild(row);
  });
  loanStatus.textContent = state.loanActive
    ? `Debt: ${state.debt} chips. Time left: ${formatTime(loanTimeLeft())}`
    : "No active loan.";
}

function setPlayerImage(direction) {
  const safeDirection = ["front", "back", "left", "right"].includes(direction) ? direction : "front";
  state.player.direction = safeDirection;
  player.src = `assets/images/player/player_${safeDirection}.png`;
}

function renderPlayer() {
  player.style.left = toX(state.player.x);
  player.style.top = toY(state.player.y);
}

function rectFromElement(element, padding = 0) {
  const x = Number(element.dataset.x || 0) - padding;
  const y = Number(element.dataset.y || 0) - padding;
  const w = Number(element.dataset.w || 0) + padding * 2;
  const h = Number(element.dataset.h || 0) + padding * 2;
  return { x, y, w, h };
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function collides(x, y) {
  const playerRect = { x, y, w: PLAYER_SIZE, h: PLAYER_SIZE };
  return Array.from(document.querySelectorAll(".blocker")).some((blocker) =>
    rectsOverlap(playerRect, rectFromElement(blocker, TABLE_PADDING))
  );
}

function distanceToRect(element) {
  const rect = rectFromElement(element, 0);
  const px = state.player.x + PLAYER_SIZE / 2;
  const py = state.player.y + PLAYER_SIZE / 2;
  const closestX = Math.max(rect.x, Math.min(px, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(py, rect.y + rect.h));
  return Math.hypot(px - closestX, py - closestY);
}

function movePlayer(dx, dy, direction) {
  if (!dx && !dy) return false;
  const nx = Math.max(0, Math.min(FLOOR_WIDTH - PLAYER_SIZE, state.player.x + dx));
  const ny = Math.max(0, Math.min(FLOOR_HEIGHT - PLAYER_SIZE, state.player.y + dy));
  setPlayerImage(direction);
  if (collides(nx, ny)) {
    state.target = null;
    return false;
  }
  state.player.x = nx;
  state.player.y = ny;
  renderPlayer();
  return true;
}

function distanceTo(element) {
  return distanceToRect(element);
}

function updateNearestInteraction() {
  let best = null;
  document.querySelectorAll(".interactable").forEach((item) => {
    const distance = distanceTo(item);
    item.classList.remove("near");
    if (!best || distance < best.distance) best = { item, distance };
  });

  nearestInteraction = best && best.distance < INTERACT_DISTANCE ? best.item : null;
  if (nearestInteraction) {
    nearestInteraction.classList.add("near");
    const title =
      nearestInteraction.dataset.title ||
      nearestInteraction.dataset.name ||
      games[nearestInteraction.dataset.game]?.title ||
      "Interact";
    interactionPrompt.textContent = `Press E or Enter: ${title}`;
    interactionPrompt.classList.remove("hidden");
  } else {
    interactionPrompt.classList.add("hidden");
  }
}

function interact() {
  updateNearestInteraction();
  if (!nearestInteraction) return;
  const kind = nearestInteraction.dataset.kind;
  if (kind === "game") {
    state.selectedGame = nearestInteraction.dataset.game;
    openBetDialog(state.selectedGame);
  } else if (kind === "service") {
    openServiceDialog();
  } else if (kind === "npc") {
    openNpcDialog(nearestInteraction);
  } else if (kind === "door") {
    mainMenu.classList.remove("hidden");
  } else if (kind === "elevator") {
    openInfoDialog("Coming Soon", "New Floor", "New floors with new games will be added later.");
  }
}

function openInfoDialog(type, title, description) {
  state.selectedGame = null;
  dialogType.textContent = type;
  dialogTitle.textContent = title;
  dialogDescription.textContent = description;
  startGameBtn.disabled = true;
  startGameBtn.classList.add("hidden");
  tableDialog.showModal();
}

function setBetDialogDemoMode(enabled) {
  betDialog.classList.toggle("demo-mode", enabled);
  betDialog.querySelectorAll(".field").forEach((field) => field.classList.toggle("hidden", enabled));
  const eyebrow = betDialog.querySelector(".eyebrow");
  if (eyebrow) eyebrow.textContent = enabled ? "Demo Table" : "Place Bet";
  document.querySelector("#confirmBetBtn").textContent = enabled ? "Try Demo" : "Start Lab";
}

function openBetDialog(key) {
  const game = games[key];
  if (!game || !game.file) {
    openInfoDialog(game?.type || "Reserved", game?.title || "Reserved Table", game?.description || "This table is not ready yet.");
    return;
  }
  startGameBtn.disabled = false;
  startGameBtn.classList.remove("hidden");
  betTitle.textContent = game.title;
  betDescription.textContent = game.description;
  if (key === "pathfinding") {
    setBetDialogDemoMode(true);
    betDescription.textContent =
      "This game is still under construction, so you can try the demo. The demo shows each maze and compares BFS, DFS, and A* without chips, XP, streaks, logs, or table progress.";
    betMessage.textContent = "Demo only. No bet is placed.";
    betDialog.showModal();
    return;
  }
  setBetDialogDemoMode(false);
  syncDifficultyBet();
  betDialog.showModal();
}

function closeBetDialog() {
  setBetDialogDemoMode(false);
  betDialog.close();
}

function validateBet() {
  const bet = Number(betInput.value);
  const difficulty = difficultySelect.value;
  const required = DIFFICULTY_ENTRY_COSTS[difficulty] || MIN_BET;
  if (!Number.isFinite(bet) || bet < required) return [false, `${difficultyLabel(difficulty)} requires at least ${required} chips.`];
  if (bet > state.chips) return [false, "You do not have enough chips."];
  return [true, "Bet accepted."];
}

function difficultyLabel(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function syncDifficultyBet() {
  const difficulty = difficultySelect.value;
  const required = DIFFICULTY_ENTRY_COSTS[difficulty] || MIN_BET;
  betInput.min = String(required);
  betInput.step = "10";
  betInput.value = String(Math.max(required, Math.min(state.chips, Number(betInput.value) || required)));
  const multiplier = DIFFICULTY_MULTIPLIERS[difficulty] || 1;
  betMessage.textContent =
    state.chips < required
      ? `${difficultyLabel(difficulty)} needs ${required} chips. Earn more chips on easier tables first.`
      : `${difficultyLabel(difficulty)} entry: ${required} chips. Reward multiplier: x${multiplier.toFixed(1)}.`;
}

function startLabFromBet() {
  if (state.selectedGame === "pathfinding") {
    state.currentRound = null;
    closeBetDialog();
    startSelectedGame();
    return;
  }
  const [ok, message] = validateBet();
  betMessage.textContent = message;
  if (!ok) return;
  const bet = Number(betInput.value);
  const difficulty = difficultySelect.value;
  const labDuration = state.selectedGame === "future" ? BALANCE_LAB_SECONDS[difficulty] || 90 : LAB_SECONDS;
  state.chips -= bet;
  state.currentRound = {
    gameKey: state.selectedGame,
    bet,
    difficulty,
    startedAt: Date.now(),
    duration:
      labDuration +
      (state.pendingBoosts.includes("extra_time") ? 30 : 0) +
      (state.pendingBoosts.includes("time_freeze") ? 8 : 0),
    usedBoosts: [...state.pendingBoosts],
    settled: false,
  };
  state.pendingBoosts = [];
  saveState();
  renderStatus();
  closeBetDialog();
  startSelectedGame();
}

function startSelectedGame() {
  const game = games[state.selectedGame];
  if (!game || !game.file) return;
  keys.clear();
  runnerTitle.textContent = game.title;
  const params = new URLSearchParams({
    v: String(Date.now()),
    difficulty: state.selectedGame === "pathfinding" ? "demo" : state.currentRound?.difficulty || "easy",
    boosts: (state.currentRound?.usedBoosts || []).join(","),
    bet: String(state.selectedGame === "pathfinding" ? 0 : state.currentRound?.bet || MIN_BET),
    hint_tokens: String(state.inventory.hint || 0),
    freeze_tokens: String(state.inventory.time_freeze || 0),
    extra_tokens: String(state.inventory.extra_time || 0),
  });
  gameFrame.src = `${game.file}?${params.toString()}`;
  gameRunner.classList.remove("hidden");
}

function consumeServiceToken(key) {
  if (!SERVICE_ITEMS[key] || !state.inventory[key]) return false;
  state.inventory[key] -= 1;
  if (state.currentRound && !state.currentRound.usedBoosts.includes(key)) {
    state.currentRound.usedBoosts.push(key);
  }
  saveState();
  renderInventory();
  renderServiceShop();
  return true;
}

function extendCurrentLabTime(seconds) {
  if (!state.currentRound) return;
  state.currentRound.duration += Math.max(0, Number(seconds) || 0);
  saveState();
  renderStatus();
}

function settleCurrentRound(won, reason, score = 100, completedOverride = false) {
  const round = state.currentRound;
  if (!round || round.settled) return;
  round.settled = true;
  const multiplier = DIFFICULTY_MULTIPLIERS[round.difficulty] || 1;
  const entryCost = DIFFICULTY_ENTRY_COSTS[round.difficulty] || MIN_BET;
  const alreadyClearedMode = Boolean(state.completedModes?.[round.gameKey]?.[round.difficulty]);
  const tableWasComplete = isTableComplete(round.gameKey);
  const completedThisMode = Boolean(completedOverride) || Boolean(won);
  const completesMode = completedThisMode && !alreadyClearedMode;
  const chipsBeforeSettle = state.chips;
  let change = 0;
  let xpGain = 0;
  if (won) {
    change = Math.floor(round.bet * multiplier * Math.max(0.25, score / 100));
    const streakMultiplier = 1 + Math.min(0.5, (state.streak || 0) * 0.1);
    change = Math.floor(change * streakMultiplier);
    if (round.usedBoosts.includes("double_reward")) change *= 2;
    state.chips += round.bet + change;
    state.totalGamesWon += 1;
    if (completedThisMode) {
      if (!state.completedModes[round.gameKey]) state.completedModes[round.gameKey] = {};
      state.completedModes[round.gameKey][round.difficulty] = true;
      state.completed[round.gameKey] = isTableComplete(round.gameKey);
    }
    state.streak = (state.streak || 0) + 1;
    xpGain = Math.floor(60 * multiplier + score * (1.6 + multiplier) + state.streak * 15);
    state.xp += xpGain;
  } else {
    let loss = round.bet;
    if (round.usedBoosts.includes("insurance")) loss = Math.floor(loss * 0.5);
    if (round.usedBoosts.includes("safe_bet")) loss = 0;
    if (round.usedBoosts.includes("double_reward")) loss *= 2;
    state.chips += Math.max(0, round.bet - loss);
    state.totalGamesLost += 1;
    state.streak = 0;
    xpGain = Math.max(10, Math.floor(score * 0.5));
    state.xp += xpGain;
  }
  state.logs.push({
    version: "gpaf-log-format-lite-v1",
    event_type: "session_result",
    game_id: round.gameKey,
    game_title: games[round.gameKey]?.title || round.gameKey,
    player_code: localStorage.getItem("complexityCasinoPlayerCode") || "local-player",
    difficulty: round.difficulty,
    started_at: new Date(round.startedAt).toISOString(),
    ended_at: new Date().toISOString(),
    duration_seconds: Math.max(0, Math.round((Date.now() - round.startedAt) / 1000)),
    bet: round.bet,
    entry_cost: entryCost,
    difficulty_multiplier: multiplier,
    score,
    won,
    completion_credited: completesMode,
    table_completed_after: isTableComplete(round.gameKey),
    table_completed_this_round: !tableWasComplete && isTableComplete(round.gameKey),
    chips_delta: state.chips - chipsBeforeSettle,
    session_chip_net: state.chips - chipsBeforeSettle - round.bet,
    chips_reward: won ? change : 0,
    xp_earned: xpGain,
    leaderboard_score: Math.floor(score * multiplier + (won ? change : 0) + xpGain),
    chips_after: state.chips,
    xp_after: state.xp,
    streak_after: state.streak,
    reason,
    boosts: round.usedBoosts,
  });
  state.totalGamesPlayed += 1;
  state.currentRound = null;
  saveState();
  renderStatus();
  renderTables();
  renderInventory();
  goalText.textContent = reason;
}

function completeSelectedGame() {
  if (state.currentRound) {
    settleCurrentRound(true, "Lab complete. Bet settled and reward paid.");
  } else if (state.selectedGame) {
    goalText.textContent = "Start and win Easy, Medium, and Hard to complete this table.";
  }
}

function exitRunner() {
  if (state.currentRound && !state.currentRound.settled) {
    settleCurrentRound(false, "Returned before the lab reported completion. Bet settled as a loss.", 0);
  }
  keys.clear();
  gameRunner.classList.add("hidden");
  gameFrame.src = "about:blank";
  focusCasinoControls();
}

function cancelRunnerFromLab(reason = "Lab cancelled before starting.") {
  if (state.currentRound && !state.currentRound.settled) {
    state.chips += state.currentRound.bet;
    state.currentRound = null;
    saveState();
    renderStatus();
    renderTables();
  }
  keys.clear();
  goalText.textContent = reason;
  gameRunner.classList.add("hidden");
  gameFrame.src = "about:blank";
  focusCasinoControls();
}

function focusCasinoControls() {
  requestAnimationFrame(() => {
    window.focus();
    document.body.focus();
  });
}

function buyService(key) {
  const item = SERVICE_ITEMS[key];
  if (!item) return;
  if (state.chips < item.price) {
    serviceMessage.textContent = "Not enough chips.";
    return;
  }
  state.chips -= item.price;
  state.inventory[key] = (state.inventory[key] || 0) + 1;
  serviceMessage.textContent = `Bought ${item.name}.`;
  saveState();
  renderStatus();
  renderInventory();
  renderServiceShop();
}

function useBoost(key) {
  const message = "Power-ups are disabled for this build.";
  if (betMessage) betMessage.textContent = message;
  goalText.textContent = message;
  return;
  if (!state.inventory[key]) {
    const message = `No ${SERVICE_ITEMS[key].name} available.`;
    betMessage.textContent = message;
    goalText.textContent = message;
    return;
  }
  if (!state.currentRound && state.pendingBoosts.includes(key)) {
    betMessage.textContent = `${SERVICE_ITEMS[key].name} is already selected.`;
    return;
  }
  state.inventory[key] -= 1;
  if (state.currentRound && !state.currentRound.usedBoosts.includes(key)) {
    state.currentRound.usedBoosts.push(key);
  }
  if (!state.currentRound && key !== "undo") {
    state.pendingBoosts.push(key);
    betMessage.textContent = `${SERVICE_ITEMS[key].name} selected for this lab.`;
  }
  if (key === "extra_time" && state.currentRound) state.currentRound.duration += 30;
  if (key === "time_freeze" && state.currentRound) state.currentRound.duration += 8;
  if (state.currentRound) goalText.textContent = `${SERVICE_ITEMS[key].name} used.`;
  saveState();
  renderInventory();
  renderStatus();
}

function openServiceDialog() {
  serviceMessage.textContent = "";
  renderServiceShop();
  serviceDialog.showModal();
}

function takeLoan(amount) {
  if (state.loanActive) {
    serviceMessage.textContent = "Loan already active.";
    return;
  }
  state.loanActive = true;
  state.loanPrincipal = amount;
  state.debt = Math.floor(amount * 1.3);
  state.loanDuration = 300;
  state.loanStart = Date.now();
  state.loanDeadline = state.loanStart + state.loanDuration * 1000;
  state.loanFailed = false;
  state.chips += amount;
  serviceMessage.textContent = `Loan taken. Debt is now ${state.debt} chips.`;
  saveState();
  renderStatus();
  renderServiceShop();
}

function repayLoan() {
  updateLoan();
  if (!state.loanActive) {
    serviceMessage.textContent = "No active loan.";
    return;
  }
  if (state.chips < state.debt) {
    serviceMessage.textContent = `You need ${state.debt} chips to repay.`;
    return;
  }
  state.chips -= state.debt;
  state.loanActive = false;
  state.loanPrincipal = 0;
  state.debt = 0;
  state.loanStart = 0;
  state.loanDuration = 0;
  state.loanDeadline = 0;
  state.loanFailed = false;
  serviceMessage.textContent = "Loan repaid.";
  saveState();
  renderStatus();
  renderServiceShop();
}

function openNpcDialog(npc) {
  const lines = (npc.dataset.lines || "Good luck.").split("|");
  const line = lines[Math.floor(Math.random() * lines.length)];
  npcName.textContent = npc.dataset.name || "Casino Guest";
  npcLine.textContent = line;
  npcDialog.showModal();
}

function resetProgress() {
  state.chips = STARTING_CHIPS;
  state.completed = {};
  state.completedModes = createEmptyModeProgress();
  state.inventory = { ...defaultInventory };
  state.suspicion = 0;
  state.reputation = 100;
  state.debt = 0;
  state.loanActive = false;
  state.loanPrincipal = 0;
  state.loanStart = 0;
  state.loanDuration = 0;
  state.loanDeadline = 0;
  state.loanFailed = false;
  state.totalGamesPlayed = 0;
  state.totalGamesWon = 0;
  state.totalGamesLost = 0;
  state.xp = 0;
  state.streak = 0;
  state.logs = [];
  state.runStartedAt = Date.now();
  state.currentRound = null;
  saveState();
  renderStatus();
  renderTables();
  renderInventory();
}

function updateMusicToggle() {
  musicToggleBtn.textContent = musicEnabled ? "Music On" : "Music Off";
  if (musicVolumeSlider) musicVolumeSlider.value = String(Math.round(musicVolume));
}

function toggleMusic() {
  musicEnabled = !musicEnabled;
  localStorage.setItem("complexityCasinoMusicEnabled", String(musicEnabled));
  updateMusicToggle();
  if (musicEnabled && mainMenu.classList.contains("hidden")) {
    music.play().catch(() => {});
  } else {
    music.pause();
  }
}

function setMusicEnabled(enabled) {
  musicEnabled = Boolean(enabled);
  localStorage.setItem("complexityCasinoMusicEnabled", String(musicEnabled));
  updateMusicToggle();
  if (musicEnabled && mainMenu.classList.contains("hidden") && musicVolume > 0) {
    music.play().catch(() => {});
  } else {
    music.pause();
  }
}

function updateMusicVolume(value) {
  musicVolume = Math.max(0, Math.min(100, Number(value) || 0));
  music.volume = musicVolume / 100;
  localStorage.setItem("complexityCasinoMusicVolume", String(Math.round(musicVolume)));
  if (musicEnabled && musicVolume > 0 && mainMenu.classList.contains("hidden")) {
    music.play().catch(() => {});
  }
}

function exportLogs() {
  const code =
    localStorage.getItem("complexityCasinoPlayerCode") ||
    prompt("Enter player code for the exported logs:", "local-player") ||
    "local-player";
  localStorage.setItem("complexityCasinoPlayerCode", code);
  const rows = state.logs.length
    ? state.logs.map((row) => ({ ...row, player_code: code }))
    : [
        {
          version: "gpaf-log-format-lite-v1",
          event_type: "export_empty",
          player_code: code,
          exported_at: new Date().toISOString(),
          note: "No completed lab sessions have been recorded yet.",
        },
      ];
  const blob = new Blob([rows.map((row) => JSON.stringify(row)).join("\n") + "\n"], {
    type: "application/jsonl",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `complexity_casino_logs_${code}_${Date.now()}.jsonl`;
  link.click();
  URL.revokeObjectURL(link.href);
  goalText.textContent = "Game logs exported as JSONL for the team submission.";
}

function updateLabTimer() {
  if (!state.currentRound) {
    labTimerValue.textContent = "00:00";
    return;
  }
  const now = Date.now();
  const elapsed = (now - state.currentRound.startedAt) / 1000;
  const left = state.currentRound.duration - elapsed;
  labTimerValue.textContent = formatTime(left);
  if (left <= 0 && !state.currentRound.settled) {
    settleCurrentRound(false, "Lab timer expired. Bet settled as a loss.");
    exitRunner();
  }
}

function updateMovement(deltaMs) {
  const speed = 190;
  const step = (speed * deltaMs) / 1000;
  let dx = 0;
  let dy = 0;
  let direction = state.player.direction;

  if (keys.has("arrowup") || keys.has("w")) {
    dy -= step;
    direction = "back";
  }
  if (keys.has("arrowdown") || keys.has("s")) {
    dy += step;
    direction = "front";
  }
  if (keys.has("arrowleft") || keys.has("a")) {
    dx -= step;
    direction = "left";
  }
  if (keys.has("arrowright") || keys.has("d")) {
    dx += step;
    direction = "right";
  }

  if (!dx && !dy && state.target) {
    const px = state.player.x + PLAYER_SIZE / 2;
    const py = state.player.y + PLAYER_SIZE / 2;
    const tx = state.target.x;
    const ty = state.target.y;
    const distance = Math.hypot(tx - px, ty - py);
    if (distance <= step) {
      state.target = null;
    } else {
      dx = ((tx - px) / distance) * step;
      dy = ((ty - py) / distance) * step;
      direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "front" : "back";
    }
  }

  const moving = Boolean(dx || dy);
  player.classList.toggle("walking", moving);
  if (moving) movePlayer(dx, dy, direction);
  updateNearestInteraction();
}

function frame(now) {
  const deltaMs = Math.min(40, now - lastFrame);
  lastFrame = now;
  updateMovement(deltaMs);
  renderStatus();
  updateLabTimer();
  requestAnimationFrame(frame);
}

function bindEvents() {
  document.body.tabIndex = -1;
  document.querySelector("#startCasinoBtn").addEventListener("click", () => {
    mainMenu.classList.add("hidden");
    if (musicEnabled && musicVolume > 0) music.play().catch(() => {});
    else music.pause();
    focusCasinoControls();
  });
  musicToggleBtn.addEventListener("click", toggleMusic);
  if (musicVolumeSlider) {
    musicVolumeSlider.addEventListener("input", () => updateMusicVolume(musicVolumeSlider.value));
  }
  document.querySelector("#interactBtn").addEventListener("click", interact);
  document.querySelector("#closeDialogBtn").addEventListener("click", () => tableDialog.close());
  document.querySelector("#startGameBtn").addEventListener("click", () => openBetDialog(state.selectedGame));
  document.querySelector("#closeBetBtn").addEventListener("click", closeBetDialog);
  document.querySelector("#confirmBetBtn").addEventListener("click", startLabFromBet);
  difficultySelect.addEventListener("change", syncDifficultyBet);
  document.querySelector("#closeServiceBtn").addEventListener("click", () => serviceDialog.close());
  document.querySelector("#closeNpcBtn").addEventListener("click", () => npcDialog.close());
  document.querySelector("#exitRunnerBtn").addEventListener("click", exitRunner);
  document.querySelector("#freezeTimerBtn").addEventListener("click", () => useBoost("time_freeze"));
  document.querySelectorAll(".runner-boost").forEach((button) => {
    button.addEventListener("click", () => useBoost(button.dataset.runnerBoost));
  });
  document.querySelector("#resetProgressBtn").addEventListener("click", resetProgress);
  if (exportLogsBtn) exportLogsBtn.addEventListener("click", exportLogs);
  document.querySelector("#repayLoanBtn").addEventListener("click", repayLoan);
  document.querySelectorAll(".loan-button").forEach((button) => {
    button.type = "button";
    button.addEventListener("click", () => takeLoan(Number(button.dataset.loan)));
  });
  document.querySelectorAll(".boost-actions [data-boost]").forEach((button) => {
    button.addEventListener("click", () => useBoost(button.dataset.boost));
  });
  document.querySelectorAll("[data-move]").forEach((button) => {
    button.addEventListener("click", () => {
      const direction = button.dataset.move;
      if (direction === "up") movePlayer(0, -28, "back");
      if (direction === "down") movePlayer(0, 28, "front");
      if (direction === "left") movePlayer(-28, 0, "left");
      if (direction === "right") movePlayer(28, 0, "right");
    });
  });

  casinoFloor.addEventListener("click", (event) => {
    focusCasinoControls();
    const rect = casinoFloor.getBoundingClientRect();
    state.target = {
      x: ((event.clientX - rect.left) / rect.width) * FLOOR_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * FLOOR_HEIGHT,
    };
  });

  const keyFromEvent = (event) => {
    const codeMap = {
      ArrowUp: "arrowup",
      ArrowDown: "arrowdown",
      ArrowLeft: "arrowleft",
      ArrowRight: "arrowright",
      KeyW: "w",
      KeyA: "a",
      KeyS: "s",
      KeyD: "d",
      KeyE: "e",
      Enter: "enter",
      Space: " ",
    };
    return codeMap[event.code] || event.key.toLowerCase();
  };

  window.addEventListener("keydown", (event) => {
    const key = keyFromEvent(event);
    const isTyping = ["INPUT", "SELECT", "TEXTAREA"].includes(event.target?.tagName);
    if (isTyping) return;
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d", " ", "e", "enter"].includes(key)) {
      event.preventDefault();
    }
    if (!gameRunner.classList.contains("hidden")) return;
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(key)) {
      keys.add(key);
      state.target = null;
    }
    if (key === "e" || key === "enter") {
      interact();
    }
  });

  window.addEventListener("keyup", (event) => {
    keys.delete(keyFromEvent(event));
  });

  window.addEventListener("message", (event) => {
    if (event.data && event.data.type === "casino-toggle-music") {
      toggleMusic();
      return;
    }
    if (event.data && event.data.type === "casino-set-music-enabled") {
      setMusicEnabled(event.data.enabled);
      return;
    }
    if (event.data && event.data.type === "casino-set-music-volume") {
      updateMusicVolume(event.data.volume);
      updateMusicToggle();
      return;
    }
    if (event.data && event.data.type === "casino-consume-service") {
      consumeServiceToken(event.data.service);
      return;
    }
    if (event.data && event.data.type === "casino-extend-lab-time") {
      extendCurrentLabTime(event.data.seconds);
      return;
    }
    if (event.data && event.data.type === "casino-cancel-lab") {
      cancelRunnerFromLab(event.data.reason);
      return;
    }
    if (!event.data || event.data.type !== "casino-lab-result") return;
    if (event.data.game === "pathfinding") return;
    const score = Number(event.data.score || 0);
    const completed = Boolean(event.data.completed);
    const won = Boolean(event.data.won) && score >= 50;
    settleCurrentRound(won, event.data.reason || "Lab result received.", score, completed);
  });
}

layoutAssets();
loadState();
bindEvents();
renderStatus();
renderTables();
renderInventory();
setPlayerImage("front");
renderPlayer();
updateMusicToggle();
requestAnimationFrame(frame);
