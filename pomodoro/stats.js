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
  dateTime: document.getElementById("statsDateTime"),
  summaryDays: document.getElementById("summaryDays"),
  summaryMinutes: document.getElementById("summaryMinutes"),
  summaryCount: document.getElementById("summaryCount"),
  emptyMessage: document.getElementById("emptyMessage"),
  recent7Chart: document.getElementById("recent7Chart"),
  dailyMinutesChart: document.getElementById("dailyMinutesChart"),
  dailyCountChart: document.getElementById("dailyCountChart"),
  taskChart: document.getElementById("taskChart"),
  weeklyChart: document.getElementById("weeklyChart"),
  monthlyChart: document.getElementById("monthlyChart")
};

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Object.assign({}, DEFAULTS, parsed || {});
  } catch (error) {
    return Object.assign({}, DEFAULTS);
  }
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function parseLocalDate(dateText) {
  const parts = String(dateText || "").split("-");
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shortDate(dateText) {
  const parts = String(dateText || "").split("-");
  if (parts.length !== 3) {
    return dateText;
  }
  return `${Number(parts[1])}/${Number(parts[2])}`;
}

function minutesLabel(minutes) {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours}時間${rest}分` : `${hours}時間`;
  }
  return `${minutes}分`;
}

function getDailyRows(state) {
  return Object.keys(state.dailyLogs || {})
    .sort()
    .map((date) => {
      const log = state.dailyLogs[date] || {};
      const seconds = Number(log.total_seconds || 0);
      return {
        date,
        minutes: Math.floor(seconds / 60),
        count: Number(log.work_count || 0)
      };
    });
}

function getRecentDays(days) {
  const rows = [];
  const today = new Date();
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    date.setDate(date.getDate() - index);
    rows.push(formatDateKey(date));
  }
  return rows;
}

function getTaskRows(state) {
  const totals = {};
  (state.detailLogs || []).forEach((log) => {
    const name = String(log.task_name || "無題").trim() || "無題";
    const seconds = Number(log.work_seconds || 0);
    totals[name] = (totals[name] || 0) + seconds;
  });

  return Object.keys(totals)
    .map((name) => ({
      label: name,
      minutes: Math.floor(totals[name] / 60)
    }))
    .filter((row) => row.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 12);
}

function getMonday(date) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function getWeeklyRows(dailyRows) {
  const totals = {};
  dailyRows.forEach((row) => {
    const monday = formatDateKey(getMonday(parseLocalDate(row.date)));
    totals[monday] = (totals[monday] || 0) + row.minutes;
  });
  return Object.keys(totals).sort().map((week) => ({
    label: `${shortDate(week)}週`,
    minutes: totals[week]
  }));
}

function getMonthlyRows(dailyRows) {
  const totals = {};
  dailyRows.forEach((row) => {
    const month = row.date.slice(0, 7);
    totals[month] = (totals[month] || 0) + row.minutes;
  });
  return Object.keys(totals).sort().map((month) => ({
    label: month,
    minutes: totals[month]
  }));
}

function clearElement(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function renderBarChart(element, rows, options) {
  clearElement(element);
  const maxValue = Math.max.apply(null, rows.map((row) => row.value).concat([1]));

  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "chart-empty";
    empty.textContent = "データがありません。";
    element.appendChild(empty);
    return;
  }

  rows.forEach((row) => {
    const item = document.createElement("div");
    item.className = "chart-row";

    const label = document.createElement("span");
    label.className = "chart-label";
    label.textContent = row.label;

    const track = document.createElement("span");
    track.className = "chart-track";

    const bar = document.createElement("span");
    bar.className = "chart-bar";
    bar.style.width = `${Math.max(4, (row.value / maxValue) * 100)}%`;

    const value = document.createElement("span");
    value.className = "chart-value";
    value.textContent = options.formatValue(row.value);

    track.appendChild(bar);
    item.appendChild(label);
    item.appendChild(track);
    item.appendChild(value);
    element.appendChild(item);
  });
}

function updateClock() {
  elements.dateTime.textContent = formatDateTime(new Date());
}

function init() {
  const state = loadState();
  const dailyRows = getDailyRows(state);
  const totalMinutes = dailyRows.reduce((sum, row) => sum + row.minutes, 0);
  const totalCount = dailyRows.reduce((sum, row) => sum + row.count, 0);

  elements.summaryDays.textContent = `${dailyRows.length}日`;
  elements.summaryMinutes.textContent = minutesLabel(totalMinutes);
  elements.summaryCount.textContent = `${totalCount}回`;
  elements.emptyMessage.hidden = dailyRows.length > 0 || (state.detailLogs || []).length > 0;

  const dailyMap = {};
  dailyRows.forEach((row) => {
    dailyMap[row.date] = row;
  });

  const recentRows = getRecentDays(7).map((date) => ({
    label: shortDate(date),
    value: dailyMap[date] ? dailyMap[date].minutes : 0
  }));

  renderBarChart(elements.recent7Chart, recentRows, {
    formatValue: minutesLabel
  });

  renderBarChart(elements.dailyMinutesChart, dailyRows.slice(-30).map((row) => ({
    label: shortDate(row.date),
    value: row.minutes
  })), {
    formatValue: minutesLabel
  });

  renderBarChart(elements.dailyCountChart, dailyRows.slice(-30).map((row) => ({
    label: shortDate(row.date),
    value: row.count
  })), {
    formatValue: (value) => `${value}回`
  });

  renderBarChart(elements.taskChart, getTaskRows(state).map((row) => ({
    label: row.label,
    value: row.minutes
  })), {
    formatValue: minutesLabel
  });

  renderBarChart(elements.weeklyChart, getWeeklyRows(dailyRows).slice(-16).map((row) => ({
    label: row.label,
    value: row.minutes
  })), {
    formatValue: minutesLabel
  });

  renderBarChart(elements.monthlyChart, getMonthlyRows(dailyRows).slice(-12).map((row) => ({
    label: row.label,
    value: row.minutes
  })), {
    formatValue: minutesLabel
  });

  updateClock();
  setInterval(updateClock, 1000);
}

init();
