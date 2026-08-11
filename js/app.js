// storage keys
const STORAGE = {
  USERS: "warnet_users_v1",
  PCS: "warnet_pcs_v1",
  SESSIONS: "warnet_sessions_v1",
  TXNS: "warnet_txns_v1",
  RATE: "warnet_rate_v1",
};

// basic load / save helpers
function load(key, fallback) {
  return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
}
function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// default data
function ensureInitialData() {
  // Hanya admin yang ada secara default, user ditambahkan oleh admin
  if (!load(STORAGE.USERS, null)) {
    const defaultUsers = {
      paktocek: {
        password: "admin123",
        role: "admin",
        display: "Pak Tocek",
      },
    };
    save(STORAGE.USERS, defaultUsers);
  }

  if (!load(STORAGE.PCS, null)) {
    save(
      STORAGE.PCS,
      Array.from({ length: 11 }, (_, i) => ({
        id: "KOM_" + (i + 1),
        status: "idle",
      }))
    );
  }

  if (!localStorage.getItem(STORAGE.SESSIONS)) save(STORAGE.SESSIONS, {});
  if (!localStorage.getItem(STORAGE.TXNS)) save(STORAGE.TXNS, []);
  if (!localStorage.getItem(STORAGE.RATE)) save(STORAGE.RATE, 5000);
}
ensureInitialData();

// auth
function handleLogin() {
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const loginModeToggle = document.getElementById("loginModeToggle");
  
  let u = usernameInput.value.toLowerCase().trim();
  let p = passwordInput ? passwordInput.value : "";
  let isAdminMode = loginModeToggle ? loginModeToggle.checked : false;
  let users = load(STORAGE.USERS, {});

  if (!u) {
    return showValidation("Username harus diisi!");
  }

  if (isAdminMode) {
    // Login sebagai Admin - validasi username & password
    if (!p) {
      return showValidation("Password harus diisi untuk login admin!");
    }
    
    if (!users[u]) {
      return showValidation("Username admin tidak ditemukan!");
    }
    
    if (users[u].role !== "admin") {
      return showValidation("Akun ini bukan admin!");
    }
    
    if (users[u].password !== p) {
      return showValidation("Password salah!");
    }

    localStorage.setItem(
      "warnet_current_user",
      JSON.stringify({
        username: u,
        role: "admin",
        display: users[u].display,
      })
    );

    location.href = "admin.html";
  } else {
    // Login sebagai User - hanya validasi username
    // Jika user tidak ada ATAU user adalah admin, tampilkan pesan yang sama
    // (tidak perlu kasih info bahwa itu akun admin)
    if (!users[u] || users[u].role === "admin") {
      return showValidation("Username tidak ditemukan!\n\nSilakan hubungi admin untuk memulai sesi.");
    }

    localStorage.setItem(
      "warnet_current_user",
      JSON.stringify({
        username: u,
        role: "client",
        display: users[u].display,
      })
    );

    location.href = "user.html";
  }
}

// Toggle login mode (admin/user)
function toggleLoginMode() {
  const loginModeToggle = document.getElementById("loginModeToggle");
  const passwordGroup = document.getElementById("passwordGroup");
  const loginModeLabel = document.getElementById("loginModeLabel");
  const loginBtn = document.getElementById("loginBtn");
  
  if (loginModeToggle && loginModeToggle.checked) {
    // Mode Admin
    if (passwordGroup) passwordGroup.classList.remove("hidden");
    if (loginModeLabel) loginModeLabel.textContent = "Login sebagai Admin";
    if (loginBtn) loginBtn.textContent = "Login Admin";
  } else {
    // Mode User
    if (passwordGroup) passwordGroup.classList.add("hidden");
    if (loginModeLabel) loginModeLabel.textContent = "Login sebagai User";
    if (loginBtn) loginBtn.textContent = "Login User";
  }
}

function logout() {
  localStorage.removeItem("warnet_current_user");
  location.href = "index.html";
}

function createDemoAccounts() {
  showConfirm("Buat ulang akun demo? (Hanya admin)", function () {
    localStorage.removeItem(STORAGE.USERS);
    ensureInitialData();
    showSuccess("Akun admin berhasil dibuat!\nUsername: paktocek\nPassword: admin123");
  });
}

function clearAllData() {
  showConfirm("Yakin ingin menghapus semua data?", function () {
    localStorage.clear();
    ensureInitialData();
    showSuccess("Semua data berhasil direset!");
  });
}

function getCurrentUser() {
  return JSON.parse(localStorage.getItem("warnet_current_user") || "null");
}

// utils
function formatHHMMSS(sec) {
  sec = Math.floor(sec);
  const h = String(Math.floor(sec / 3600)).padStart(2, "0");
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function currencyRp(n) {
  return Math.round(n).toLocaleString("id-ID");
}

// modal helpers
function showModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
}

function showValidation(msg) {
  const msgEl = document.getElementById("modalValidationMsg");
  if (msgEl) msgEl.textContent = msg;
  showModal("modalValidation");
}

function showSuccess(msg) {
  const msgEl = document.getElementById("modalSuccessMsg");
  if (msgEl) msgEl.textContent = msg;
  showModal("modalSuccess");
}

function showInfo(msg) {
  const msgEl = document.getElementById("modalInfoMsg");
  if (msgEl) msgEl.innerHTML = msg;
  showModal("modalInfo");
}

let confirmCallback = null;
function showConfirm(msg, onConfirm) {
  const msgEl = document.getElementById("modalConfirmMsg");
  if (msgEl) msgEl.textContent = msg;
  confirmCallback = onConfirm;
  const yesBtn = document.getElementById("modalConfirmYes");
  if (yesBtn) {
    yesBtn.onclick = function () {
      closeModal("modalConfirm");
      if (typeof confirmCallback === "function") confirmCallback();
    };
  }
  showModal("modalConfirm");
}

// user page logic
let userTimer = null;

function userPageInit() {
  const cur = getCurrentUser();
  if (!cur) return (location.href = "index.html");

  document.getElementById("navUser").innerText = cur.display;

  // Cek apakah user punya sesi aktif
  const sessions = load(STORAGE.SESSIONS, {});
  let activeSession = null;
  let activePcId = null;

  for (let [pc, s] of Object.entries(sessions)) {
    if (s.user === cur.username && !s.ended) {
      activeSession = s;
      activePcId = pc;
      break;
    }
  }

  const pcInfoEl = document.getElementById("userPcInfo");
  const timerEl = document.getElementById("timerDisplay");
  const costEl = document.getElementById("costDisplay");
  const statusEl = document.getElementById("sessionStatus");
  const rate = load(STORAGE.RATE, 5000);

  document.getElementById("rateDisplay").innerText = "Rp " + currencyRp(rate);

  if (activeSession && activePcId) {
    if (pcInfoEl) pcInfoEl.innerText = activePcId;
    if (statusEl) {
      statusEl.innerHTML = `<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-500/20 text-green-400 border border-green-500/30">● Sesi Aktif</span>`;
    }

    if (userTimer) clearInterval(userTimer);
    userTimer = setInterval(() => {
      const elapsed = (Date.now() - activeSession.start) / 1000;
      const cost = rate * (elapsed / 3600);
      if (timerEl) timerEl.innerText = formatHHMMSS(elapsed);
      if (costEl) costEl.innerText = "Rp " + currencyRp(cost);
    }, 500);
  } else {
    if (pcInfoEl) pcInfoEl.innerText = "-";
    if (timerEl) timerEl.innerText = "00:00:00";
    if (costEl) costEl.innerText = "Rp 0";
    if (statusEl) {
      statusEl.innerHTML = `<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-slate-500/20 text-slate-400 border border-slate-500/30">○ Tidak Ada Sesi</span>`;
    }
    if (userTimer) {
      clearInterval(userTimer);
      userTimer = null;
    }
  }
}

// admin page
function adminPageInit() {
  const cur = getCurrentUser();
  if (!cur || cur.role !== "admin") return (location.href = "index.html");

  navAdmin.innerText = cur.display;
  rateInput.value = load(STORAGE.RATE, 5000);

  renderPCs();
  renderTransactions();
  renderStats();
  renderUsers();
  populatePCSelect();

  if (window._adminPCInterval) clearInterval(window._adminPCInterval);
  window._adminPCInterval = setInterval(() => {
    renderPCs();
  }, 1000);
}

// Populate dropdown PC yang idle untuk memulai sesi
function populatePCSelect() {
  const pcs = load(STORAGE.PCS, []);
  const select = document.getElementById("pcSelectAdmin");
  if (!select) return;

  select.innerHTML = '<option value="">-- Pilih PC --</option>';

  pcs.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.id;
    if (p.status !== "idle") {
      opt.disabled = true;
      opt.textContent += " (Busy)";
    }
    select.appendChild(opt);
  });
}

// Admin memulai sesi untuk user - dengan input nama
function adminStartSession() {
  const userNameInput = document.getElementById("userNameInput");
  const pcSelect = document.getElementById("pcSelectAdmin");

  const inputName = userNameInput ? userNameInput.value.trim() : "";
  const selectedPc = pcSelect ? pcSelect.value : "";

  if (!inputName) {
    return showValidation("Masukkan nama user terlebih dahulu!");
  }
  if (!selectedPc) {
    return showValidation("Pilih PC terlebih dahulu!");
  }

  // Cek apakah PC masih idle
  const pcs = load(STORAGE.PCS, []);
  const pcData = pcs.find(p => p.id === selectedPc);
  if (!pcData || pcData.status !== "idle") {
    return showValidation("PC sudah tidak tersedia!");
  }

  // Generate username dari nama (lowercase, tanpa spasi)
  const username = inputName.toLowerCase().replace(/\s+/g, "");

  // Cek apakah user ini sudah punya sesi aktif
  const sessions = load(STORAGE.SESSIONS, {});
  for (let [pc, s] of Object.entries(sessions)) {
    if (s.user === username && !s.ended) {
      return showValidation(`User "${inputName}" sudah memiliki sesi aktif di ${pc}!`);
    }
  }

  showConfirm(`Mulai sesi untuk "${inputName}" di ${selectedPc}?`, function () {
    // Tambahkan user ke daftar jika belum ada
    let users = load(STORAGE.USERS, {});
    if (!users[username]) {
      users[username] = {
        role: "client",
        display: inputName,
      };
      save(STORAGE.USERS, users);
    }

    // Update status PC ke busy
    let pcsUpdated = load(STORAGE.PCS, []).map((p) =>
      p.id === selectedPc ? { ...p, status: "busy" } : p
    );
    save(STORAGE.PCS, pcsUpdated);

    // Simpan sesi
    let sessionsUpdated = load(STORAGE.SESSIONS, {});
    sessionsUpdated[selectedPc] = {
      user: username,
      start: Date.now(),
      ended: false,
    };
    save(STORAGE.SESSIONS, sessionsUpdated);

    // Refresh UI
    renderPCs();
    renderStats();
    renderUsers();
    populatePCSelect();

    // Reset form
    if (userNameInput) userNameInput.value = "";
    if (pcSelect) pcSelect.value = "";

    showSuccess(`Sesi dimulai untuk "${inputName}" di ${selectedPc}`);
  });
}

// Render daftar user (client)
function renderUsers() {
  const users = load(STORAGE.USERS, {});
  const sessions = load(STORAGE.SESSIONS, {});
  const tbody = document.querySelector("#userTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  // Cari user yang sedang aktif
  const userSessionMap = {};
  Object.entries(sessions).forEach(([pc, s]) => {
    if (!s.ended) {
      userSessionMap[s.user] = pc;
    }
  });

  // Filter hanya client (bukan admin)
  const clientUsers = Object.entries(users).filter(([_, data]) => data.role !== "admin");

  if (clientUsers.length === 0) {
    let tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="2" class="text-center py-4 opacity-50">Belum ada user terdaftar</td>`;
    tbody.appendChild(tr);
    return;
  }

  clientUsers.forEach(([username, data]) => {
    const tr = document.createElement("tr");
    const activePc = userSessionMap[username];
    const statusBadge = activePc
      ? `<span class="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">● ${activePc}</span>`
      : `<span class="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-slate-500/20 text-slate-400 border border-slate-500/30">○ Idle</span>`;
    tr.innerHTML = `
      <td class="px-4 py-3">${data.display}</td>
      <td class="px-4 py-3 text-center">${statusBadge}</td>
    `;
    tbody.appendChild(tr);
  });
}

function saveRate() {
  const rate = Number(rateInput.value);
  if (!rate || rate <= 0) {
    return showValidation("Tarif harus lebih dari 0!");
  }
  save(STORAGE.RATE, rate);
  showSuccess("Tarif berhasil disimpan!");
}

// Render tabel status semua PC
function renderPCs() {
  let pcs = load(STORAGE.PCS, []);
  let tbody = document.querySelector("#pcTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const sessions = load(STORAGE.SESSIONS, {});
  const users = load(STORAGE.USERS, {});

  pcs.forEach((p) => {
    let statusLabel = "";
    let timeLabel = "";
    let userLabel = "";
    let actionBtn = "";

    if (p.status === "idle") {
      statusLabel = `<span class='inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-200/80 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 backdrop-blur-sm border border-slate-300/50 dark:border-slate-600/50'>Idle</span>`;
      actionBtn = `<span class="text-slate-500 text-sm">-</span>`;
    } else {
      const session = sessions[p.id];
      let elapsed = "";
      let userName = "-";

      if (session && !session.ended) {
        elapsed = formatHHMMSS((Date.now() - session.start) / 1000);
        userName = users[session.user] ? users[session.user].display : session.user;
      }

      statusLabel = `<span class='inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 dark:bg-green-500/30 text-green-700 dark:text-green-400 backdrop-blur-sm border border-green-500/40 dark:border-green-500/50'>Busy</span>`;
      timeLabel = `<div class='text-xs text-green-600 dark:text-green-400 mt-1 font-mono'>${elapsed ? "⏱ " + elapsed : ""}</div>`;
      userLabel = `<div class='text-xs text-cyan-500 mt-1'>👤 ${userName}</div>`;
      actionBtn = `<button onclick="stopSession('${p.id}')" class="btn-neon px-4 py-1 rounded-lg bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30">Stop</button>`;
    }

    let tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="px-4 py-3">${p.id}</td>
      <td class='px-4 py-3 text-center'>${statusLabel}${timeLabel}${userLabel}</td>
      <td class='px-4 py-3 text-center'>${actionBtn}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Admin menghentikan sesi
function stopSession(pcId) {
  const sessions = load(STORAGE.SESSIONS, {});
  const session = sessions[pcId];

  if (!session || session.ended) {
    return showValidation("Tidak ada sesi aktif di PC ini!");
  }

  const users = load(STORAGE.USERS, {});
  const userName = users[session.user] ? users[session.user].display : session.user;
  const elapsed = (Date.now() - session.start) / 1000;
  const rate = load(STORAGE.RATE, 5000);
  const amount = rate * (elapsed / 3600);

  showConfirm(
    `Stop sesi ${userName} di ${pcId}?\nDurasi: ${formatHHMMSS(elapsed)}\nBiaya: Rp ${currencyRp(amount)}`,
    function () {
      let tx = load(STORAGE.TXNS, []);
      tx.push({
        id: "TXN" + Date.now(),
        pc: pcId,
        user: session.user,
        seconds: elapsed,
        amount: amount,
        paid: false,
      });
      save(STORAGE.TXNS, tx);

      sessions[pcId].ended = true;
      save(STORAGE.SESSIONS, sessions);

      // Hapus user dari daftar agar tidak bisa login lagi
      // User harus didaftarkan ulang oleh admin untuk sesi berikutnya
      let usersData = load(STORAGE.USERS, {});
      if (usersData[session.user] && usersData[session.user].role !== "admin") {
        delete usersData[session.user];
        save(STORAGE.USERS, usersData);
      }

      let pcs = load(STORAGE.PCS, []).map((p) =>
        p.id === pcId ? { ...p, status: "idle" } : p
      );
      save(STORAGE.PCS, pcs);

      renderPCs();
      renderTransactions();
      renderStats();
      renderUsers();
      populatePCSelect();

      showSuccess(`Sesi dihentikan! Transaksi Rp ${currencyRp(amount)} masuk ke pending.`);
    }
  );
}

// Render tabel semua transaksi (pending + lunas)
function renderTransactions() {
  let allTx = load(STORAGE.TXNS, []);
  let tbody = document.querySelector("#txnTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  const users = load(STORAGE.USERS, {});

  // Urutkan: pending dulu, lalu lunas (terbaru di atas)
  allTx.sort((a, b) => {
    if (a.paid === b.paid) return b.id.localeCompare(a.id); // terbaru dulu
    return a.paid ? 1 : -1; // pending dulu
  });

  if (allTx.length === 0) {
    let tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="6" class="text-center py-4 opacity-50">Belum ada transaksi</td>`;
    tbody.appendChild(tr);
  } else {
    allTx.forEach((t) => {
      const userName = users[t.user] ? users[t.user].display : t.user;
      const statusBadge = t.paid
        ? `<span class="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">Lunas</span>`
        : `<span class="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">Pending</span>`;
      const actionBtn = t.paid
        ? `<span class="text-slate-500 text-sm">-</span>`
        : `<button onclick="validatePayment('${t.id}')" class="btn-neon px-3 py-1 rounded-lg text-sm">Validasi</button>`;
      
      let tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="px-4 py-3 text-center">${t.pc}</td>
        <td class="px-4 py-3 text-center">${userName}</td>
        <td class="px-4 py-3 text-center">${formatHHMMSS(t.seconds)}</td>
        <td class="px-4 py-3 text-center">Rp ${currencyRp(t.amount)}</td>
        <td class="px-4 py-3 text-center">${statusBadge}</td>
        <td class="px-4 py-3 text-center">${actionBtn}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Update statistik
  const pendingCount = allTx.filter(x => !x.paid).length;
  const lunasCount = allTx.filter(x => x.paid).length;
  const totalRevenue = allTx.filter(x => x.paid).reduce((a, b) => a + b.amount, 0);
  
  document.getElementById("totalRevenue").innerText = currencyRp(totalRevenue);
  document.getElementById("countTxn").innerText = allTx.length;
  
  const countPendingEl = document.getElementById("countPending");
  const countLunasEl = document.getElementById("countLunas");
  if (countPendingEl) countPendingEl.innerText = pendingCount;
  if (countLunasEl) countLunasEl.innerText = lunasCount;
}

// Validasi pembayaran
function validatePayment(id) {
  let tx = load(STORAGE.TXNS, []);
  let t = tx.find((x) => x.id === id);

  if (!t) return;

  const users = load(STORAGE.USERS, {});
  const userName = users[t.user] ? users[t.user].display : t.user;

  showConfirm(
    `Validasi pembayaran Rp ${currencyRp(t.amount)} dari ${userName}?`,
    function () {
      t.paid = true;
      save(STORAGE.TXNS, tx);

      renderTransactions();
      renderStats();
      showSuccess("Pembayaran berhasil divalidasi! Status: Lunas");
    }
  );
}

// Statistik
function renderStats() {
  let pcs = load(STORAGE.PCS, []);
  const idleCount = pcs.filter((p) => p.status === "idle").length;
  const busyCount = pcs.filter((p) => p.status !== "idle").length;
  const total = pcs.length;

  const countIdleEl = document.getElementById("countIdle");
  const countBusyEl = document.getElementById("countBusy");
  
  if (countIdleEl) countIdleEl.innerText = idleCount;
  if (countBusyEl) countBusyEl.innerText = busyCount;

  const idleBar = document.getElementById("barIdle");
  const busyBar = document.getElementById("barBusy");

  if (idleBar && busyBar) {
    const idlePercent = total > 0 ? (idleCount / total) * 100 : 0;
    const busyPercent = total > 0 ? (busyCount / total) * 100 : 0;

    idleBar.style.width = `${idlePercent}%`;
    busyBar.style.width = `${busyPercent}%`;
  }
}

// theme
const THEME_KEY = "warnet_theme";

function applyTheme(theme) {
  const html = document.documentElement;
  if (theme === "light") {
    html.classList.add("light");
    html.classList.remove("dark");
    document.body.classList.add("light");
  } else {
    html.classList.add("dark");
    html.classList.remove("light");
    document.body.classList.remove("light");
  }
  localStorage.setItem(THEME_KEY, theme);

  const btn = document.getElementById("themeToggle");
  if (btn) btn.innerText = theme === "dark" ? "Dark" : "Light";
}

function toggleTheme() {
  const cur = localStorage.getItem(THEME_KEY) || "dark";
  const next = cur === "dark" ? "light" : "dark";
  applyTheme(next);
}

(function () {
  const saved = localStorage.getItem(THEME_KEY) || "dark";
  applyTheme(saved);
})();
