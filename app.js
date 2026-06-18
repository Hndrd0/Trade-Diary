// ============================================================
//  Trade Diary — app.js
//  Fully functional trading journal SPA.
//  All data persisted in localStorage under key 'tradeDiary_trades'.
// ============================================================

(function () {
  'use strict';

  // ----------------------------------------------------------
  //  GLOBAL CHART INSTANCES (destroy before re-create)
  // ----------------------------------------------------------
  const charts = {
    equity: null,
    winloss: null,
    cumulativePnl: null,
    strategyPnl: null,
    dayPnl: null,
    emotion: null,
    monthly: null,
  };

  // ----------------------------------------------------------
  //  SORT STATE for Trade Log
  // ----------------------------------------------------------
  let sortField = 'date';
  let sortDir = 'desc'; // 'asc' | 'desc'

  // ----------------------------------------------------------
  //  CHART.JS DEFAULTS
  // ----------------------------------------------------------
  Chart.defaults.color = '#ffffff';
  Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
  Chart.defaults.scale = Chart.defaults.scale || {};
  // We'll set grid colours per-chart for cleaner control.

  // ============================================================
  //  DATA LAYER
  // ============================================================

  /** Return parsed trades array from localStorage, or [] */
  function getTrades() {
    try {
      return JSON.parse(localStorage.getItem('tradeDiary_trades')) || [];
    } catch {
      return [];
    }
  }

  /** Persist trades array into localStorage */
  function saveTrades(trades) {
    localStorage.setItem('tradeDiary_trades', JSON.stringify(trades));
  }

  /** Generate a short unique ID */
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /**
   * Calculate P&L for a trade.
   * LONG  → (exit − entry) × qty
   * SHORT → (entry − exit) × qty
   */
  function calculatePnl(type, entry, exit, qty) {
    if (type === 'LONG') return (exit - entry) * qty;
    return (entry - exit) * qty;
  }

  /** Format a number as ₹ with Indian-style commas and proper sign */
  function formatCurrency(num) {
    if (num == null || isNaN(num)) return '₹0.00';
    const sign = num < 0 ? '-' : num > 0 ? '+' : '';
    const abs = Math.abs(num);
    // Use Intl for Indian locale grouping
    const formatted = new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(abs);
    return sign + '₹' + formatted;
  }

  // ============================================================
  //  VIEW SWITCHING
  // ============================================================

  function switchView(viewName) {
    // Hide all views
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    // Show target
    const target = document.getElementById('view-' + viewName);
    if (target) target.classList.add('active');

    // Update nav active state
    document.querySelectorAll('.nav-item[data-view]').forEach((item) => {
      item.classList.toggle('active', item.dataset.view === viewName);
    });

    // Refresh the target view's data
    switch (viewName) {
      case 'dashboard':
        refreshDashboard();
        break;
      case 'add-trade':
        // If not in edit mode, reset form
        if (!document.getElementById('trade-id').value) {
          resetTradeForm();
        }
        break;
      case 'trade-log':
        refreshTradeLog();
        break;
      case 'analytics':
        refreshAnalytics();
        break;
    }

    // Close mobile sidebar if open
    document.body.classList.remove('sidebar-open');
  }

  // ============================================================
  //  TOAST SYSTEM
  // ============================================================

  /**
   * Show a small notification toast.
   * @param {string} message
   * @param {'success'|'error'|'info'} type
   */
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = message;
    container.appendChild(toast);

    // Trigger entrance (allow the browser one frame to apply initial styles)
    requestAnimationFrame(() => toast.classList.add('show'));

    // Auto-remove after 3 s
    setTimeout(() => {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => toast.remove());
      // Fallback removal in case transitionend never fires
      setTimeout(() => { if (toast.parentNode) toast.remove(); }, 500);
    }, 3000);
  }

  // ============================================================
  //  MODAL SYSTEM
  // ============================================================

  let _modalConfirmCb = null;

  function showModal(title, message, onConfirm) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').textContent = message;
    _modalConfirmCb = onConfirm;
    document.getElementById('confirm-modal').classList.add('open');
  }

  function closeModal() {
    document.getElementById('confirm-modal').classList.remove('open');
    _modalConfirmCb = null;
  }

  // ============================================================
  //  DASHBOARD
  // ============================================================

  function refreshDashboard() {
    const trades = getTrades();

    // --- Metric calculations ---
    const totalPnl = trades.reduce((s, t) => s + (t.pnl || 0), 0);
    const wins = trades.filter((t) => t.pnl > 0);
    const losses = trades.filter((t) => t.pnl < 0);
    const winRate = trades.length ? ((wins.length / trades.length) * 100).toFixed(1) : 0;
    const sumWins = wins.reduce((s, t) => s + t.pnl, 0);
    const sumLosses = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
    const profitFactor = sumLosses > 0 ? (sumWins / sumLosses).toFixed(2) : sumWins > 0 ? '∞' : '0.00';

    // --- Update DOM ---
    const pnlEl = document.getElementById('dash-total-pnl');
    pnlEl.textContent = formatCurrency(totalPnl);
    pnlEl.style.color = totalPnl >= 0 ? '#34d399' : '#fb7185';

    document.getElementById('dash-win-rate').textContent = winRate + '%';
    document.getElementById('dash-total-trades').textContent = trades.length;
    document.getElementById('dash-profit-factor').textContent = profitFactor;

    // --- Equity chart (cumulative PnL sorted by date) ---
    const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));
    let cumulative = 0;
    const equityLabels = sorted.map((t) => t.date);
    const equityData = sorted.map((t) => {
      cumulative += t.pnl || 0;
      return cumulative;
    });

    if (charts.equity) charts.equity.destroy();
    const eqCtx = document.getElementById('equity-chart').getContext('2d');
    const eqGradient = eqCtx.createLinearGradient(0, 0, 0, eqCtx.canvas.clientHeight || 300);
    eqGradient.addColorStop(0, 'rgba(129,140,248,0.2)');
    eqGradient.addColorStop(1, 'transparent');
    charts.equity = new Chart(eqCtx, {
      type: 'line',
      data: {
        labels: equityLabels,
        datasets: [{
          label: 'Equity',
          data: equityData,
          borderColor: '#818cf8',
          backgroundColor: eqGradient,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { maxTicksLimit: 8 } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' } },
        },
      },
    });

    // --- Win / Loss doughnut ---
    if (charts.winloss) charts.winloss.destroy();
    const wlCtx = document.getElementById('winloss-chart').getContext('2d');
    charts.winloss = new Chart(wlCtx, {
      type: 'doughnut',
      data: {
        labels: ['Wins', 'Losses'],
        datasets: [{
          data: [wins.length, losses.length],
          backgroundColor: ['#34d399', '#fb7185'],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { position: 'bottom', labels: { padding: 16 } },
        },
      },
    });

    // --- Recent trades (last 5 by date desc) ---
    const recent = [...trades].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    const tbody = document.getElementById('recent-trades-body');
    const emptyEl = document.getElementById('recent-empty');
    if (recent.length === 0) {
      tbody.innerHTML = '';
      emptyEl.style.display = 'flex';
      document.getElementById('recent-trades-table').style.display = 'none';
    } else {
      emptyEl.style.display = 'none';
      document.getElementById('recent-trades-table').style.display = '';
      tbody.innerHTML = recent.map((t) => `
        <tr>
          <td>${formatDate(t.date)}</td>
          <td><strong>${escHtml(t.symbol)}</strong></td>
          <td><span class="trade-type-badge type-${t.type.toLowerCase()}">${t.type}</span></td>
          <td>${t.entry}</td>
          <td>${t.exit}</td>
          <td>${t.qty}</td>
          <td style="color:${t.pnl >= 0 ? '#34d399' : '#fb7185'}">${formatCurrency(t.pnl)}</td>
        </tr>`).join('');
    }

    lucide.createIcons();
  }

  // ============================================================
  //  ADD / EDIT TRADE FORM
  // ============================================================

  function resetTradeForm() {
    const form = document.getElementById('trade-form');
    form.reset();
    document.getElementById('trade-id').value = '';
    document.getElementById('trade-date').value = todayISO();
    document.getElementById('form-title').textContent = 'Add New Trade';
    // Reset radio to LONG
    const longRadio = document.querySelector('input[name="trade-type"][value="LONG"]');
    if (longRadio) longRadio.checked = true;
    updatePnlPreview();
  }

  /** Set the live PnL preview based on current form values */
  function updatePnlPreview() {
    const type = (document.querySelector('input[name="trade-type"]:checked') || {}).value || 'LONG';
    const entry = parseFloat(document.getElementById('trade-entry').value) || 0;
    const exit = parseFloat(document.getElementById('trade-exit').value) || 0;
    const qty = parseFloat(document.getElementById('trade-qty').value) || 0;
    const pnl = calculatePnl(type, entry, exit, qty);
    const el = document.getElementById('pnl-preview');
    el.textContent = formatCurrency(pnl);
    el.style.color = pnl >= 0 ? '#34d399' : '#fb7185';
  }

  /** Populate the form for editing an existing trade */
  function editTrade(id) {
    const trades = getTrades();
    const trade = trades.find((t) => t.id === id);
    if (!trade) return;

    document.getElementById('trade-id').value = trade.id;
    document.getElementById('trade-date').value = trade.date;
    document.getElementById('trade-symbol').value = trade.symbol;
    document.getElementById('trade-entry').value = trade.entry;
    document.getElementById('trade-exit').value = trade.exit;
    document.getElementById('trade-qty').value = trade.qty;
    document.getElementById('trade-strategy').value = trade.strategy || '';
    document.getElementById('trade-emotion').value = trade.emotion || '';
    document.getElementById('trade-tags').value = trade.tags || '';
    document.getElementById('trade-notes').value = trade.notes || '';

    // Set radio
    const radio = document.querySelector(`input[name="trade-type"][value="${trade.type}"]`);
    if (radio) radio.checked = true;

    document.getElementById('form-title').textContent = 'Edit Trade';
    updatePnlPreview();
    switchView('add-trade');
  }

  /** Delete a trade after confirmation */
  function deleteTrade(id) {
    showModal('Delete Trade', 'Are you sure you want to delete this trade? This cannot be undone.', () => {
      let trades = getTrades();
      trades = trades.filter((t) => t.id !== id);
      saveTrades(trades);
      closeModal();
      showToast('Trade deleted successfully.', 'success');
      refreshTradeLog();
      refreshDashboard();
    });
  }

  function handleTradeFormSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('trade-id').value;
    const date = document.getElementById('trade-date').value;
    const symbol = document.getElementById('trade-symbol').value.trim().toUpperCase();
    const type = (document.querySelector('input[name="trade-type"]:checked') || {}).value || 'LONG';
    const entry = parseFloat(document.getElementById('trade-entry').value);
    const exit = parseFloat(document.getElementById('trade-exit').value);
    const qty = parseFloat(document.getElementById('trade-qty').value);
    const strategy = document.getElementById('trade-strategy').value;
    const emotion = document.getElementById('trade-emotion').value;
    const tags = document.getElementById('trade-tags').value.trim();
    const notes = document.getElementById('trade-notes').value.trim();

    // Validate required fields
    if (!date || !symbol || isNaN(entry) || isNaN(exit) || isNaN(qty) || qty <= 0) {
      showToast('Please fill in all required fields with valid values.', 'error');
      return;
    }

    const pnl = calculatePnl(type, entry, exit, qty);
    const trades = getTrades();

    if (id) {
      // EDIT mode — update existing
      const idx = trades.findIndex((t) => t.id === id);
      if (idx !== -1) {
        trades[idx] = { ...trades[idx], date, symbol, type, entry, exit, qty, strategy, emotion, tags, notes, pnl };
      }
      showToast('Trade updated successfully!', 'success');
    } else {
      // ADD mode
      trades.push({
        id: generateId(),
        date,
        symbol,
        type,
        entry,
        exit,
        qty,
        strategy,
        emotion,
        tags,
        notes,
        pnl,
        createdAt: new Date().toISOString(),
      });
      showToast('Trade saved successfully!', 'success');
    }

    saveTrades(trades);
    resetTradeForm();
    switchView('trade-log');
  }

  // ============================================================
  //  TRADE LOG
  // ============================================================

  function refreshTradeLog() {
    let trades = getTrades();

    // --- Apply filters ---
    const search = (document.getElementById('filter-search').value || '').trim().toUpperCase();
    const strategy = document.getElementById('filter-strategy').value;
    const outcome = document.getElementById('filter-outcome').value;
    const from = document.getElementById('filter-from').value;
    const to = document.getElementById('filter-to').value;

    if (search) trades = trades.filter((t) => t.symbol.toUpperCase().includes(search));
    if (strategy) trades = trades.filter((t) => t.strategy === strategy);
    if (outcome === 'win') trades = trades.filter((t) => t.pnl > 0);
    if (outcome === 'loss') trades = trades.filter((t) => t.pnl < 0);
    if (from) trades = trades.filter((t) => t.date >= from);
    if (to) trades = trades.filter((t) => t.date <= to);

    // --- Sort ---
    trades.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') cmp = a.date.localeCompare(b.date);
      else if (sortField === 'pnl') cmp = (a.pnl || 0) - (b.pnl || 0);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    const tbody = document.getElementById('trades-body');
    const emptyEl = document.getElementById('log-empty');

    if (trades.length === 0) {
      tbody.innerHTML = '';
      emptyEl.style.display = 'flex';
      document.getElementById('trades-table').style.display = 'none';
    } else {
      emptyEl.style.display = 'none';
      document.getElementById('trades-table').style.display = '';
      tbody.innerHTML = trades.map((t) => `
        <tr>
          <td>${formatDate(t.date)}</td>
          <td><strong>${escHtml(t.symbol)}</strong></td>
          <td><span class="trade-type-badge type-${t.type.toLowerCase()}">${t.type}</span></td>
          <td>${t.entry}</td>
          <td>${t.exit}</td>
          <td>${t.qty}</td>
          <td style="color:${t.pnl >= 0 ? '#34d399' : '#fb7185'}">${formatCurrency(t.pnl)}</td>
          <td>${escHtml(t.strategy || '—')}</td>
          <td>${escHtml(t.emotion || '—')}</td>
          <td class="actions-cell">
            <button class="btn-icon" title="Edit" onclick="window._editTrade('${t.id}')"><i data-lucide="pencil"></i></button>
            <button class="btn-icon btn-icon-danger" title="Delete" onclick="window._deleteTrade('${t.id}')"><i data-lucide="trash-2"></i></button>
          </td>
        </tr>`).join('');
    }

    lucide.createIcons();
  }

  // ============================================================
  //  ANALYTICS
  // ============================================================

  function refreshAnalytics() {
    const trades = getTrades();
    const wins = trades.filter((t) => t.pnl > 0);
    const losses = trades.filter((t) => t.pnl < 0);

    // --- Summary stats ---
    const avgWin = wins.length ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
    const avgLoss = losses.length ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0;
    const largestWin = wins.length ? Math.max(...wins.map((t) => t.pnl)) : 0;
    const largestLoss = losses.length ? Math.min(...losses.map((t) => t.pnl)) : 0;

    // Streaks (sorted by date)
    const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));
    let maxWinStreak = 0, maxLossStreak = 0, curWin = 0, curLoss = 0;
    sorted.forEach((t) => {
      if (t.pnl > 0) { curWin++; curLoss = 0; }
      else if (t.pnl < 0) { curLoss++; curWin = 0; }
      else { curWin = 0; curLoss = 0; }
      if (curWin > maxWinStreak) maxWinStreak = curWin;
      if (curLoss > maxLossStreak) maxLossStreak = curLoss;
    });

    document.getElementById('a-avg-win').textContent = formatCurrency(avgWin);
    document.getElementById('a-avg-loss').textContent = formatCurrency(avgLoss);
    document.getElementById('a-largest-win').textContent = formatCurrency(largestWin);
    document.getElementById('a-largest-loss').textContent = formatCurrency(largestLoss);
    document.getElementById('a-win-streak').textContent = maxWinStreak;
    document.getElementById('a-loss-streak').textContent = maxLossStreak;

    // ----------------------------------------------------------
    //  1. Cumulative P&L Chart
    // ----------------------------------------------------------
    let cumPnl = 0;
    const cumLabels = sorted.map((t) => t.date);
    const cumData = sorted.map((t) => { cumPnl += t.pnl || 0; return cumPnl; });

    if (charts.cumulativePnl) charts.cumulativePnl.destroy();
    const cumCtx = document.getElementById('cumulative-pnl-chart').getContext('2d');
    const cumGrad = cumCtx.createLinearGradient(0, 0, 0, cumCtx.canvas.clientHeight || 300);
    cumGrad.addColorStop(0, 'rgba(129,140,248,0.2)');
    cumGrad.addColorStop(1, 'transparent');
    charts.cumulativePnl = new Chart(cumCtx, {
      type: 'line',
      data: {
        labels: cumLabels,
        datasets: [{
          label: 'Cumulative P&L',
          data: cumData,
          borderColor: '#818cf8',
          backgroundColor: cumGrad,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { maxTicksLimit: 8 } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' } },
        },
      },
    });

    // ----------------------------------------------------------
    //  2. Strategy P&L — horizontal bar
    // ----------------------------------------------------------
    const stratMap = {};
    trades.forEach((t) => {
      const key = t.strategy || 'Unknown';
      stratMap[key] = (stratMap[key] || 0) + (t.pnl || 0);
    });
    const stratLabels = Object.keys(stratMap);
    const stratData = Object.values(stratMap);
    const stratColors = stratData.map((v) => (v >= 0 ? '#34d399' : '#fb7185'));

    if (charts.strategyPnl) charts.strategyPnl.destroy();
    charts.strategyPnl = new Chart(document.getElementById('strategy-pnl-chart'), {
      type: 'bar',
      data: {
        labels: stratLabels,
        datasets: [{
          label: 'P&L',
          data: stratData,
          backgroundColor: stratColors,
          borderWidth: 0,
          borderRadius: 4,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' } },
        },
      },
    });

    // ----------------------------------------------------------
    //  3. Day of Week P&L
    // ----------------------------------------------------------
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayPnl = [0, 0, 0, 0, 0, 0, 0];
    trades.forEach((t) => {
      const d = new Date(t.date);
      // JS getDay: 0=Sun … 6=Sat → remap to Mon=0 … Sun=6
      let idx = d.getDay() - 1;
      if (idx < 0) idx = 6;
      dayPnl[idx] += t.pnl || 0;
    });
    const dayColors = dayPnl.map((v) => (v >= 0 ? '#34d399' : '#fb7185'));

    if (charts.dayPnl) charts.dayPnl.destroy();
    charts.dayPnl = new Chart(document.getElementById('day-pnl-chart'), {
      type: 'bar',
      data: {
        labels: dayNames,
        datasets: [{
          label: 'P&L',
          data: dayPnl,
          backgroundColor: dayColors,
          borderWidth: 0,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' } },
        },
      },
    });

    // ----------------------------------------------------------
    //  4. Emotion vs Outcome (avg P&L per emotion)
    // ----------------------------------------------------------
    const emotionMap = {};
    const emotionCount = {};
    trades.forEach((t) => {
      const key = t.emotion || 'Unknown';
      emotionMap[key] = (emotionMap[key] || 0) + (t.pnl || 0);
      emotionCount[key] = (emotionCount[key] || 0) + 1;
    });
    const emotionLabels = Object.keys(emotionMap);
    const emotionData = emotionLabels.map((k) => emotionMap[k] / emotionCount[k]);
    const emotionColors = emotionData.map((v) => (v >= 0 ? '#34d399' : '#fb7185'));

    if (charts.emotion) charts.emotion.destroy();
    charts.emotion = new Chart(document.getElementById('emotion-chart'), {
      type: 'bar',
      data: {
        labels: emotionLabels,
        datasets: [{
          label: 'Avg P&L',
          data: emotionData,
          backgroundColor: emotionColors,
          borderWidth: 0,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' } },
        },
      },
    });

    // ----------------------------------------------------------
    //  5. Monthly Performance
    // ----------------------------------------------------------
    const monthMap = {};
    trades.forEach((t) => {
      const key = t.date.slice(0, 7); // YYYY-MM
      monthMap[key] = (monthMap[key] || 0) + (t.pnl || 0);
    });
    const monthLabels = Object.keys(monthMap).sort();
    const monthData = monthLabels.map((k) => monthMap[k]);
    const monthColors = monthData.map((v) => (v >= 0 ? '#34d399' : '#fb7185'));

    if (charts.monthly) charts.monthly.destroy();
    charts.monthly = new Chart(document.getElementById('monthly-chart'), {
      type: 'bar',
      data: {
        labels: monthLabels,
        datasets: [{
          label: 'P&L',
          data: monthData,
          backgroundColor: monthColors,
          borderWidth: 0,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' } },
        },
      },
    });

    lucide.createIcons();
  }

  // ============================================================
  //  SETTINGS ACTIONS
  // ============================================================

  function handleExportJSON() {
    const trades = getTrades();
    const blob = new Blob([JSON.stringify(trades, null, 2)], { type: 'application/json' });
    downloadBlob(blob, 'trade-diary-export.json');
    showToast('Trades exported as JSON.', 'success');
  }

  function handleImportJSON() {
    document.getElementById('import-file').click();
  }

  function handleImportFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
      try {
        const data = JSON.parse(ev.target.result);
        if (!Array.isArray(data)) {
          showToast('Invalid file format. Expected a JSON array.', 'error');
          return;
        }
        // Merge: replace trades with imported data
        saveTrades(data);
        refreshDashboard();
        refreshTradeLog();
        showToast(`Imported ${data.length} trades successfully!`, 'success');
      } catch {
        showToast('Failed to parse JSON file.', 'error');
      }
    };
    reader.readAsText(file);
    // Reset so same file can be imported again
    e.target.value = '';
  }

  function handleExportCSV() {
    const trades = getTrades();
    if (trades.length === 0) {
      showToast('No trades to export.', 'info');
      return;
    }
    const headers = ['Date', 'Symbol', 'Type', 'Entry', 'Exit', 'Qty', 'P&L', 'Strategy', 'Emotion', 'Tags', 'Notes'];
    const rows = trades.map((t) => [
      t.date, t.symbol, t.type, t.entry, t.exit, t.qty,
      (t.pnl || 0).toFixed(2), t.strategy || '', t.emotion || '',
      `"${(t.tags || '').replace(/"/g, '""')}"`,
      `"${(t.notes || '').replace(/"/g, '""')}"`,
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    downloadBlob(blob, 'trade-diary-export.csv');
    showToast('Trades exported as CSV.', 'success');
  }

  function handleClearData() {
    showModal('Clear All Data', 'This will permanently delete ALL your trade records. Are you sure?', () => {
      saveTrades([]);
      closeModal();
      refreshDashboard();
      refreshTradeLog();
      showToast('All trades have been deleted.', 'success');
    });
  }

  // ============================================================
  //  SAMPLE DATA
  // ============================================================

  function loadSampleData() {
    const symbols = [
      { name: 'NIFTY', range: [24000, 25000] },
      { name: 'BANKNIFTY', range: [51000, 53000] },
      { name: 'RELIANCE', range: [2900, 3100] },
      { name: 'TATAMOTORS', range: [650, 750] },
      { name: 'HDFCBANK', range: [1750, 1900] },
      { name: 'INFY', range: [1550, 1650] },
      { name: 'TCS', range: [3700, 3900] },
      { name: 'ICICIBANK', range: [1250, 1350] },
      { name: 'SBIN', range: [820, 900] },
      { name: 'WIPRO', range: [420, 480] },
    ];
    const strategies = ['Breakout', 'Pullback', 'Scalping', 'Momentum', 'Mean Reversion', 'VWAP', 'ORB', 'Other'];
    const emotions = ['Confident', 'Calm', 'Fearful', 'Greedy', 'Revenge', 'FOMO', 'Neutral'];
    const trades = [];

    for (let i = 0; i < 28; i++) {
      const sym = symbols[Math.floor(Math.random() * symbols.length)];
      const type = Math.random() > 0.45 ? 'LONG' : 'SHORT';
      const base = sym.range[0] + Math.random() * (sym.range[1] - sym.range[0]);
      const entry = Math.round(base * 100) / 100;
      // ~60% winners
      const isWin = Math.random() < 0.6;
      let delta = (Math.random() * 0.03 + 0.002) * entry; // 0.2% – 3.2% move
      delta = Math.round(delta * 100) / 100;

      let exit;
      if (type === 'LONG') {
        exit = isWin ? entry + delta : entry - delta;
      } else {
        exit = isWin ? entry - delta : entry + delta;
      }
      exit = Math.round(exit * 100) / 100;

      const qty = [1, 5, 10, 15, 25, 50, 75, 100][Math.floor(Math.random() * 8)];
      const pnl = calculatePnl(type, entry, exit, qty);
      const daysAgo = Math.floor(Math.random() * 30);
      const tradeDate = new Date();
      tradeDate.setDate(tradeDate.getDate() - daysAgo);
      const dateStr = tradeDate.toISOString().slice(0, 10);

      trades.push({
        id: generateId() + i,
        date: dateStr,
        symbol: sym.name,
        type,
        entry,
        exit,
        qty,
        strategy: strategies[Math.floor(Math.random() * strategies.length)],
        emotion: emotions[Math.floor(Math.random() * emotions.length)],
        tags: '',
        notes: '',
        pnl: Math.round(pnl * 100) / 100,
        createdAt: new Date().toISOString(),
      });
    }

    saveTrades(trades);
    refreshDashboard();
    showToast(`Loaded ${trades.length} sample trades!`, 'success');
  }

  // ============================================================
  //  HELPERS
  // ============================================================

  /** Today in YYYY-MM-DD */
  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  /** Format YYYY-MM-DD → DD Mon YYYY */
  function formatDate(iso) {
    if (!iso) return '—';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const [y, m, d] = iso.split('-');
    return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
  }

  /** Basic HTML escape to prevent injection in dynamic content */
  function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /** Trigger download of a Blob */
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  // ============================================================
  //  CLERK AUTH GUARD
  // ============================================================
  function initClerkAuth() {
    window.addEventListener('load', async () => {
      if (!window.Clerk) {
        console.error("Clerk SDK failed to load on app.html.");
        return;
      }

      try {
        await window.Clerk.load();

        if (!window.Clerk.user) {
          // Not authenticated, redirect to index.html (landing page / login)
          window.location.href = window.location.origin + '/index.html';
          return;
        }

        // User is authenticated, mount UserButton in sidebar and mobile header
        const userBtnContainer = document.getElementById('clerk-user-button-container');
        const userBtnContainerMobile = document.getElementById('clerk-user-button-container-mobile');

        if (userBtnContainer) {
          window.Clerk.mountUserButton(userBtnContainer, {
            afterSignOutUrl: window.location.origin + '/index.html'
          });
        }

        if (userBtnContainerMobile) {
          window.Clerk.mountUserButton(userBtnContainerMobile, {
            afterSignOutUrl: window.location.origin + '/index.html'
          });
        }

      } catch (err) {
        console.error("Clerk error during app.html authentication:", err);
      }
    });
  }

  // ============================================================
  //  INITIALIZATION
  // ============================================================

  document.addEventListener('DOMContentLoaded', function () {
    // Run auth check
    initClerkAuth();

    // Lucide icons
    lucide.createIcons();

    // Set default date to today
    document.getElementById('trade-date').value = todayISO();

    // ----- Sidebar nav -----
    document.querySelectorAll('.nav-item[data-view]').forEach((item) => {
      item.addEventListener('click', function (e) {
        e.preventDefault();
        switchView(this.dataset.view);
      });
    });

    // ----- Mobile sidebar -----
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
      document.body.classList.toggle('sidebar-open');
    });
    document.getElementById('sidebar-overlay').addEventListener('click', () => {
      document.body.classList.remove('sidebar-open');
    });

    // ----- Trade form: live P&L preview -----
    ['trade-entry', 'trade-exit', 'trade-qty'].forEach((id) => {
      document.getElementById(id).addEventListener('input', updatePnlPreview);
    });
    document.querySelectorAll('input[name="trade-type"]').forEach((r) => {
      r.addEventListener('change', updatePnlPreview);
    });

    // ----- Trade form submit -----
    document.getElementById('trade-form').addEventListener('submit', handleTradeFormSubmit);

    // ----- Trade log filters -----
    document.getElementById('filter-search').addEventListener('input', refreshTradeLog);
    document.getElementById('filter-strategy').addEventListener('change', refreshTradeLog);
    document.getElementById('filter-outcome').addEventListener('change', refreshTradeLog);
    document.getElementById('filter-from').addEventListener('change', refreshTradeLog);
    document.getElementById('filter-to').addEventListener('change', refreshTradeLog);

    // ----- Sortable columns -----
    document.querySelectorAll('.sortable').forEach((th) => {
      th.addEventListener('click', function () {
        const field = this.dataset.sort;
        if (sortField === field) {
          sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          sortField = field;
          sortDir = 'desc';
        }
        refreshTradeLog();
      });
    });

    // ----- Settings buttons -----
    document.getElementById('btn-export').addEventListener('click', handleExportJSON);
    document.getElementById('btn-import').addEventListener('click', handleImportJSON);
    document.getElementById('import-file').addEventListener('change', handleImportFileChange);
    document.getElementById('btn-export-csv').addEventListener('click', handleExportCSV);
    document.getElementById('btn-clear').addEventListener('click', handleClearData);
    document.getElementById('btn-sample').addEventListener('click', loadSampleData);

    // ----- Modal confirm button -----
    document.getElementById('modal-confirm-btn').addEventListener('click', () => {
      if (typeof _modalConfirmCb === 'function') _modalConfirmCb();
    });

    // ----- Initial dashboard render -----
    refreshDashboard();
  });

  // ============================================================
  //  GLOBAL EXPORTS (used by inline onclick handlers in HTML)
  // ============================================================
  window.switchView = switchView;
  window.resetTradeForm = resetTradeForm;
  window.closeModal = closeModal;
  window._editTrade = editTrade;
  window._deleteTrade = deleteTrade;
})();
