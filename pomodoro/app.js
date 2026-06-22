const STORAGE_KEY = "sudohidekiPomodoroState";
const DEFAULTS = {
  workMinutes: 25,
  breakMinutes: 5,
  lastTaskName: "",
  taskNames: [],
  dailyLogs: {},
  detailLogs: []
};

const elements = {
  dateTime: document.getElementById("dateTime"),
  modeLabel: document.getElementById("modeLabel"),
  moonProgress: document.getElementById("moonProgress"),
  moonCore: document.getElementById("moonCore"),
  timeDisplay: document.getElementById("timeDisplay"),
  taskInput: document.getElementById("taskInput"),
  taskNames: document.getElementById("taskNames"),
  workMinutes: document.getElementById("workMinutes"),
  breakMinutes: document.getElementById("breakMinutes"),
  applyButton: document.getElementById("applyButton"),
  startButton: document.getElementById("startButton"),
  pauseButton: document.getElementById("pauseButton"),
  resetButton: document.getElementById("resetButton"),
  workButton: document.getElementById("workButton"),
  workCount: document.getElementById("workCount"),
  totalMinutes: document.getElementById("totalMinutes"),
  soundFile: document.getElementById("soundFile"),
  testSoundButton: document.getElementById("testSoundButton"),
  stopSoundButton: document.getElementById("stopSoundButton"),
  importSettingsFile: document.getElementById("importSettingsFile"),
  importTaskNamesFile: document.getElementById("importTaskNamesFile"),
  importDailyFile: document.getElementById("importDailyFile"),
  importDetailFile: document.getElementById("importDetailFile"),
  importButton: document.getElementById("importButton"),
  importStatus: document.getElementById("importStatus"),
  downloadDailyButton: document.getElementById("downloadDailyButton"),
  downloadDetailButton: document.getElementById("downloadDetailButton")
};

let saved = loadState();
let mode = "work";
let totalSeconds = saved.workMinutes * 60;
let remainingSeconds = totalSeconds;
let running = false;
let lastTime = 0;
let currentWorkStartTime = null;
let animationCount = 0;
let audioElement = null;
let audioContext = null;

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function updateTaskOptions() {
  elements.taskNames.innerHTML = "";
  saved.taskNames.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    elements.taskNames.appendChild(option);
  });
}

function rememberTaskName(taskName) {
  const name = taskName.trim();
  if (!name) {
    return;
  }

  saved.taskNames = saved.taskNames.filter((item) => item !== name);
  saved.taskNames.unshift(name);
  saved.taskNames = saved.taskNames.slice(0, 30);
  saved.lastTaskName = name;
  updateTaskOptions();
  saveState();
}

function currentDailyLog() {
  const key = todayKey();
  if (!saved.dailyLogs[key]) {
    saved.dailyLogs[key] = {
      date: key,
      work_count: 0,
      total_seconds: 0,
      updated_at: ""
    };
  }
  return saved.dailyLogs[key];
}

function recordWorkSession(workedSeconds) {
  const end = new Date();
  const start = currentWorkStartTime || end;
  const taskName = elements.taskInput.value.trim();
  rememberTaskName(taskName);

  const daily = currentDailyLog();
  daily.work_count += 1;
  daily.total_seconds += workedSeconds;
  daily.updated_at = end.toISOString().replace("T", " ").slice(0, 19);

  saved.detailLogs.push({
    date: todayKey(start),
    task_name: taskName,
    start_time: start.toISOString().replace("T", " ").slice(0, 19),
    end_time: end.toISOString().replace("T", " ").slice(0, 19),
    work_minutes: Math.floor(workedSeconds / 60),
    work_seconds: workedSeconds
  });

  currentWorkStartTime = null;
  saveState();
}

function updateDisplay() {
  const percent = totalSeconds > 0 ? (totalSeconds - remainingSeconds) / totalSeconds : 0;
  const degrees = Math.max(0, Math.min(360, percent * 360));
  const phase = Math.round(percent * 130 - 65);
  const daily = currentDailyLog();

  elements.timeDisplay.textContent = formatTime(remainingSeconds);
  elements.moonProgress.style.setProperty("--progress", `${degrees}deg`);
  elements.moonCore.style.setProperty("--phase", `${phase}px`);
  elements.moonProgress.classList.toggle("break", mode === "break");
  elements.workCount.textContent = `${daily.work_count}回`;
  elements.totalMinutes.textContent = `${Math.floor(daily.total_seconds / 60)}分`;
}

function updateModeLabel() {
  const dots = ".".repeat(animationCount % 4);
  elements.modeLabel.textContent = mode === "work" ? `作業中${dots}` : `休憩中${dots}`;
  elements.modeLabel.style.color = mode === "work" ? "#e7fbff" : "#76f0d2";
  animationCount += 1;
}

function applyMinutes() {
  if (running) {
    return;
  }

  const work = Number.parseInt(elements.workMinutes.value, 10);
  const rest = Number.parseInt(elements.breakMinutes.value, 10);
  if (!Number.isFinite(work) || !Number.isFinite(rest) || work <= 0 || rest <= 0) {
    return;
  }

  saved.workMinutes = work;
  saved.breakMinutes = rest;
  rememberTaskName(elements.taskInput.value);
  resetTimer();
  saveState();
}

function startTimer() {
  stopSound();
  if (running) {
    return;
  }

  if (mode === "work" && currentWorkStartTime === null) {
    currentWorkStartTime = new Date();
  }

  rememberTaskName(elements.taskInput.value);
  running = true;
  lastTime = Date.now();
}

function pauseTimer() {
  stopSound();
  running = false;
}

function resetTimer() {
  stopSound();

  if (mode === "work") {
    const workedSeconds = totalSeconds - remainingSeconds;
    if (workedSeconds > 0) {
      recordWorkSession(workedSeconds);
    }
  }

  running = false;
  totalSeconds = (mode === "work" ? saved.workMinutes : saved.breakMinutes) * 60;
  remainingSeconds = totalSeconds;
  currentWorkStartTime = null;
  updateDisplay();
}

function resetToWork() {
  stopSound();
  running = false;
  mode = "work";
  totalSeconds = saved.workMinutes * 60;
  remainingSeconds = totalSeconds;
  currentWorkStartTime = null;
  updateDisplay();
}

function switchMode() {
  if (mode === "work") {
    recordWorkSession(saved.workMinutes * 60);
    mode = "break";
    totalSeconds = saved.breakMinutes * 60;
  } else {
    mode = "work";
    totalSeconds = saved.workMinutes * 60;
  }

  remainingSeconds = totalSeconds;
  updateDisplay();
}

function tick() {
  if (running) {
    const now = Date.now();
    const elapsed = Math.floor((now - lastTime) / 1000);
    if (elapsed >= 1) {
      remainingSeconds -= elapsed;
      lastTime = now;

      if (remainingSeconds <= 0) {
        remainingSeconds = 0;
        running = false;
        updateDisplay();
        playSound();
        switchMode();
      } else {
        updateDisplay();
      }
    }
  }

  requestAnimationFrame(tick);
}

function playSound() {
  if (audioElement) {
    audioElement.currentTime = 0;
    audioElement.play().catch(() => playBeep());
    return;
  }

  playBeep();
}

function playBeep() {
  audioContext = audioContext || new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = 880;
  gain.gain.setValueAtTime(0.001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.25, audioContext.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.7);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.72);
}

function stopSound() {
  if (audioElement) {
    audioElement.pause();
    audioElement.currentTime = 0;
  }
}

function setSoundFile(file) {
  stopSound();
  if (audioElement) {
    URL.revokeObjectURL(audioElement.src);
  }

  audioElement = file ? new Audio(URL.createObjectURL(file)) : null;
}

function readFileText(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, "utf-8");
  });
}

function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let quoted = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };

  const pushRow = () => {
    if (row.length > 0 || field) {
      pushField();
      rows.push(row);
      row = [];
    }
  };

  const source = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      pushField();
    } else if (char === "\n") {
      pushRow();
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field || row.length) {
    pushRow();
  }

  const headers = rows.shift() || [];
  return rows
    .filter((values) => values.some((value) => value.trim() !== ""))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
}

function mergeTaskNames(names) {
  const merged = [...names, ...saved.taskNames]
    .map((name) => String(name || "").trim())
    .filter(Boolean);
  saved.taskNames = [...new Set(merged)].slice(0, 30);
}

function importSettingsJson(text) {
  if (!text.trim()) {
    return 0;
  }

  const data = JSON.parse(text);
  if (Number.isFinite(Number(data.work_minutes)) && Number(data.work_minutes) > 0) {
    saved.workMinutes = Number(data.work_minutes);
  }
  if (Number.isFinite(Number(data.break_minutes)) && Number(data.break_minutes) > 0) {
    saved.breakMinutes = Number(data.break_minutes);
  }
  if (typeof data.last_task_name === "string") {
    saved.lastTaskName = data.last_task_name.trim();
    mergeTaskNames([saved.lastTaskName]);
  }

  return 1;
}

function importTaskNamesJson(text) {
  if (!text.trim()) {
    return 0;
  }

  const data = JSON.parse(text);
  if (Array.isArray(data)) {
    mergeTaskNames(data);
    return data.length;
  }
  return 0;
}

function importDailyCsv(text) {
  if (!text.trim()) {
    return 0;
  }

  const rows = parseCsv(text);
  rows.forEach((row) => {
    const date = String(row.date || "").trim();
    if (!date) {
      return;
    }

    saved.dailyLogs[date] = {
      date,
      work_count: Number.parseInt(row.work_count || "0", 10) || 0,
      total_seconds: Number.parseInt(row.total_seconds || "0", 10) || ((Number.parseInt(row.total_minutes || "0", 10) || 0) * 60),
      updated_at: row.updated_at || ""
    };
  });
  return rows.length;
}

function importDetailCsv(text) {
  if (!text.trim()) {
    return 0;
  }

  const rows = parseCsv(text);
  const existingKeys = new Set(saved.detailLogs.map((row) => JSON.stringify(row)));
  let added = 0;
  rows.forEach((row) => {
    const imported = {
      date: row.date || "",
      task_name: row.task_name || "",
      start_time: row.start_time || "",
      end_time: row.end_time || "",
      work_minutes: Number.parseInt(row.work_minutes || "0", 10) || 0,
      work_seconds: Number.parseInt(row.work_seconds || "0", 10) || 0
    };
    const key = JSON.stringify(imported);
    if (!existingKeys.has(key)) {
      saved.detailLogs.push(imported);
      existingKeys.add(key);
      added += 1;
    }
  });
  mergeTaskNames(rows.map((row) => row.task_name));
  return added;
}

async function importLegacyFiles() {
  if (running) {
    elements.importStatus.textContent = "タイマー停止中に読み込んでください。";
    return;
  }

  try {
    const settingsText = await readFileText(elements.importSettingsFile.files[0]);
    const taskNamesText = await readFileText(elements.importTaskNamesFile.files[0]);
    const dailyText = await readFileText(elements.importDailyFile.files[0]);
    const detailText = await readFileText(elements.importDetailFile.files[0]);

    const imported = {
      settings: importSettingsJson(settingsText),
      taskNames: importTaskNamesJson(taskNamesText),
      daily: importDailyCsv(dailyText),
      detail: importDetailCsv(detailText)
    };

    elements.workMinutes.value = saved.workMinutes;
    elements.breakMinutes.value = saved.breakMinutes;
    elements.taskInput.value = saved.lastTaskName;
    mode = "work";
    totalSeconds = saved.workMinutes * 60;
    remainingSeconds = totalSeconds;
    currentWorkStartTime = null;
    updateTaskOptions();
    updateDisplay();
    saveState();

    elements.importStatus.textContent = `読み込み完了: 設定${imported.settings}件、作業名${imported.taskNames}件、日別${imported.daily}件、詳細${imported.detail}件`;
  } catch (error) {
    elements.importStatus.textContent = "読み込みに失敗しました。ファイル形式を確認してください。";
    console.error(error);
  }
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(filename, headers, rows) {
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))
  ];
  const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function downloadDailyCsv() {
  const headers = ["date", "work_count", "total_minutes", "total_seconds", "updated_at"];
  const rows = Object.values(saved.dailyLogs)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => ({
      ...row,
      total_minutes: Math.floor(row.total_seconds / 60)
    }));
  downloadCsv("work_log.csv", headers, rows);
}

function downloadDetailCsv() {
  const headers = ["date", "task_name", "start_time", "end_time", "work_minutes", "work_seconds"];
  downloadCsv("work_detail_log.csv", headers, saved.detailLogs);
}

function updateClock() {
  elements.dateTime.textContent = formatDateTime(new Date());
}

function init() {
  elements.workMinutes.value = saved.workMinutes;
  elements.breakMinutes.value = saved.breakMinutes;
  elements.taskInput.value = saved.lastTaskName;
  updateTaskOptions();
  updateDisplay();
  updateClock();
  updateModeLabel();

  elements.applyButton.addEventListener("click", applyMinutes);
  elements.startButton.addEventListener("click", startTimer);
  elements.pauseButton.addEventListener("click", pauseTimer);
  elements.resetButton.addEventListener("click", resetTimer);
  elements.workButton.addEventListener("click", resetToWork);
  elements.soundFile.addEventListener("change", (event) => setSoundFile(event.target.files[0]));
  elements.testSoundButton.addEventListener("click", playSound);
  elements.stopSoundButton.addEventListener("click", stopSound);
  elements.importButton.addEventListener("click", importLegacyFiles);
  elements.downloadDailyButton.addEventListener("click", downloadDailyCsv);
  elements.downloadDetailButton.addEventListener("click", downloadDetailCsv);

  setInterval(updateClock, 1000);
  setInterval(updateModeLabel, 500);
  requestAnimationFrame(tick);
}

init();
