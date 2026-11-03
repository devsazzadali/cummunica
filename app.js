// Communica Phase 1 prototype — LOCAL DEMO ONLY.
// Data lives ONLY in this browser (localStorage). No server, no upload, no real calls,
// no Neon DB connection yet. See README.md for what Phase 2/3 will replace.
(function () {
  'use strict';
  var LS_KEY = 'communica-demo-v1';
  var GIRLFRIEND_PRESETS = ['Sadia', 'Maria', 'Tithi', 'Borsha', 'Anika', 'Tajmira', 'Mim', 'Mimi', 'Mumu', 'Ayra', 'Jannati', 'Mushfika'];

  // ---- Demo data (generic demo users; NOT real people, NOT contacts from any screenshot) ----
  var DEMO_USERS = [
    { id: 'u_sazmu', username: 'sazmuai', displayName: 'SAZMU AI', communicaId: '00000001', isAI: true },
    { id: 'u_ayesha', username: 'ayesha', displayName: 'Ayesha', communicaId: '48291357', isAI: false },
    { id: 'u_tanvir', username: 'tanvir', displayName: 'Tanvir', communicaId: '91736402', isAI: false },
    { id: 'u_nusrat', username: 'nusrat', displayName: 'Nusrat', communicaId: '20574891', isAI: false }
  ];

  function generateCommunicaId(existing) {
    var id;
    do { id = String(Math.floor(10000000 + Math.random() * 90000000)); }
    while (existing.indexOf(id) !== -1);
    return id;
  }
  function searchUsers(users, q) {
    q = (q || '').trim().toLowerCase().replace(/^@/, '');
    if (!q) return [];
    return users.filter(function (u) {
      return u.username.toLowerCase().indexOf(q) !== -1 ||
        u.displayName.toLowerCase().indexOf(q) !== -1 ||
        u.communicaId === q || u.communicaId.indexOf(q) === 0;
    });
  }
  function findUserById(users, id) {
    for (var i = 0; i < users.length; i++) if (users[i].id === id) return users[i];
    return null;
  }

  function seedState() {
    var users = DEMO_USERS.slice();
    return {
      currentUser: null,
      users: users,
      chats: [
        { id: 'c_sazmu', peerId: 'u_sazmu', isGroup: false, favorite: true, archived: false, unread: 0 },
        { id: 'c_ayesha', peerId: 'u_ayesha', isGroup: false, favorite: false, archived: false, unread: 1 },
        { id: 'c_tanvir', peerId: 'u_tanvir', isGroup: false, favorite: false, archived: false, unread: 0 },
        { id: 'c_nusrat', peerId: 'u_nusrat', isGroup: false, favorite: false, archived: true, unread: 0 }
      ],
      messages: {
        c_sazmu: [{ from: 'u_sazmu', type: 'text', text: 'হ্যালো! আমি SAZMU AI — একজন AI সঙ্গী, আসল মানুষ নই। আমি এখানে আছি সাপোর্ট, মোটিভেশন আর কবিতার জন্য।' }],
        c_ayesha: [{ from: 'u_ayesha', type: 'text', text: 'Hi! Communica te welcome.' }, { from: 'me', type: 'text', text: 'Thanks! Eta demo chat.' }],
        c_tanvir: [{ from: 'me', type: 'text', text: 'Kal kotha hobe.' }],
        c_nusrat: [{ from: 'u_nusrat', type: 'text', text: 'Archived demo chat.' }]
      },
      companion: { role: 'Girlfriend', callName: 'SAZMU', petName: '' }
    };
  }

  // Expose pure logic for testing (browser + Node vm harness).
  var testApi = { DEMO_USERS: DEMO_USERS, generateCommunicaId: generateCommunicaId, searchUsers: searchUsers, findUserById: findUserById, seedState: seedState, GIRLFRIEND_PRESETS: GIRLFRIEND_PRESETS };
  if (typeof window !== 'undefined') window.CommunicaTest = testApi;
  if (typeof module !== 'undefined' && module.exports) module.exports = testApi;

  // ---- Browser UI (only runs when a real document exists) ----
  if (typeof document === 'undefined' || !document.getElementById) return;
  var state = null;
  var currentChatId = null, currentTab = 'chats', currentFilter = 'all', searchQuery = '';
  var mediaRecorder = null, audioChunks = [];

  function $(id) { return document.getElementById(id); }
  function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {} }
  function load() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) { var s = JSON.parse(raw); if (s && s.users && s.chats) return s; }
    } catch (e) {}
    return seedState();
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function peerOf(chat) { return findUserById(state.users, chat.peerId); }
  function lastMsg(chat) {
    var m = state.messages[chat.id] || [];
    if (!m.length) return '';
    var x = m[m.length - 1];
    if (x.type === 'photo') return '📷 Photo';
    if (x.type === 'voice') return '🎤 Voice message';
    return x.text || '';
  }
  function initial(name) { return (name || '?').trim().charAt(0).toUpperCase(); }

  function show(screen) {
    ['screen-register', 'screen-main', 'screen-chat'].forEach(function (id) { $(id).style.display = (id === screen ? 'block' : 'none'); });
    $('tabs').style.display = (screen === 'screen-main' ? 'flex' : 'none');
  }
  function renderTop() {
    $('topTitle').textContent = state.currentUser ? 'Communica — ' + state.currentUser.displayName : 'Communica';
    $('topSub').textContent = state.currentUser
      ? 'ID ' + state.currentUser.communicaId + ' • @' + state.currentUser.username + ' • Social Communication'
      : 'Social Communication — WhatsApp-like demo (Phase 1)';
  }
  function renderList() {
    var q = searchQuery.trim();
    var list = $('chatList'); list.innerHTML = '';
    var resultsBox = $('searchResults');
    if (q) {
      var hits = searchUsers(state.users.filter(function (u) { return u.id !== (state.currentUser && state.currentUser.id); }), q);
      resultsBox.innerHTML = '<p class="small">Search results (by @username or Communica ID):</p>' +
        (hits.length ? hits.map(function (u) {
          return '<div class="chatrow" data-open="' + u.id + '"><div class="avatar' + (u.isAI ? ' ai' : '') + '">' + initial(u.displayName) + '</div><div class="meta"><b>' + esc(u.displayName) + (u.isAI ? '<span class="aibadge">AI</span>' : '') + '</b><span>@' + esc(u.username) + ' • ID ' + esc(u.communicaId) + '</span></div></div>';
        }).join('') : '<p class="small">No user found. Try a @username or an 8-digit Communica ID.</p>');
      resultsBox.querySelectorAll('[data-open]').forEach(function (el) {
        el.addEventListener('click', function () { openChatForUser(el.getAttribute('data-open')); });
      });
    } else { resultsBox.innerHTML = ''; }

    var meId = state.currentUser && state.currentUser.id;
    var chats = state.chats.filter(function (c) { return !c.archived && c.peerId !== meId; });
    if (currentFilter === 'unread') chats = chats.filter(function (c) { return c.unread > 0; });
    if (currentFilter === 'favorites') chats = chats.filter(function (c) { return c.favorite; });
    chats.forEach(function (c) {
      var p = peerOf(c); if (!p) return;
      var row = document.createElement('div'); row.className = 'chatrow';
      row.innerHTML = '<div class="avatar' + (p.isAI ? ' ai' : '') + '">' + initial(p.displayName) + '</div>' +
        '<div class="meta"><b>' + esc(p.displayName) + (p.isAI ? '<span class="aibadge">AI</span>' : '') + '</b><span>' + esc(lastMsg(c)) + '</span></div>' +
        '<span class="time">' + (c.favorite ? '★ ' : '') + (c.unread ? '<span class="badge">' + c.unread + '</span>' : '') + '</span>';
      row.addEventListener('click', function () { openChat(c.id); });
      list.appendChild(row);
    });
    if (!chats.length) { var e = document.createElement('p'); e.className = 'small'; e.textContent = 'No chats in this filter.'; list.appendChild(e); }
    var arch = state.chats.filter(function (c) { return c.archived && c.peerId !== meId; });
    $('archivedBox').innerHTML = arch.length ? '<p class="small">Archived (' + arch.length + ') — tap to open:</p>' + arch.map(function (c) {
      var p = peerOf(c); return '<div class="chatrow" data-arch="' + c.id + '"><div class="avatar">' + initial(p.displayName) + '</div><div class="meta"><b>' + esc(p.displayName) + '</b><span>' + esc(lastMsg(c)) + '</span></div></div>';
    }).join('') : '';
    $('archivedBox').querySelectorAll('[data-arch]').forEach(function (el) {
      el.addEventListener('click', function () { openChat(el.getAttribute('data-arch')); });
    });
  }
  function renderTabs() {
    document.querySelectorAll('#tabs button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === currentTab); });
    [['tab-chats', 'chats'], ['tab-updates', 'updates'], ['tab-communities', 'communities'], ['tab-calls', 'calls']].forEach(function (pair) {
      var el = $(pair[0]); if (el) el.style.display = currentTab === pair[1] ? 'block' : 'none';
    });
  }
  function renderMain() { renderTop(); renderTabs(); renderList(); }
  function openChatForUser(userId) {
    var existing = null;
    state.chats.forEach(function (c) { if (c.peerId === userId) existing = c; });
    if (!existing) {
      existing = { id: 'c_' + userId + '_' + Date.now(), peerId: userId, isGroup: false, favorite: false, archived: false, unread: 0 };
      state.chats.unshift(existing); state.messages[existing.id] = []; save();
    }
    openChat(existing.id);
  }
  function openChat(chatId) {
    currentChatId = chatId;
    var c = null; state.chats.forEach(function (x) { if (x.id === chatId) c = x; });
    if (!c) return;
    c.unread = 0; save();
    var p = peerOf(c);
    $('chatTitle').innerHTML = esc(p.displayName) + (p.isAI ? '<span class="aibadge">AI — not a human</span>' : '') + ' <span class="small">@' + esc(p.username) + ' • ID ' + esc(p.communicaId) + '</span>';
    $('sazmuSettings').style.display = p.isAI ? 'block' : 'none';
    if (p.isAI) renderSazmuSettings();
    renderMessages();
    show('screen-chat');
  }
  function renderMessages() {
    var box = $('chatbox'); box.innerHTML = '';
    (state.messages[currentChatId] || []).forEach(function (m) {
      var d = document.createElement('div');
      var who = m.from === 'me' ? 'me' : 'ai';
      d.className = 'msg ' + who;
      var label = m.from === 'me' ? 'You' : (function () { var c = null; state.chats.forEach(function (x) { if (x.id === currentChatId) c = x; }); return c ? peerOf(c).displayName : ''; })();
      var body = '';
      if (m.type === 'photo') body = '<img src="' + esc(m.media) + '" alt="Photo">';
      else if (m.type === 'voice') body = '<audio controls src="' + esc(m.media) + '"></audio>';
      else body = esc(m.text || '');
      d.innerHTML = '<span class="who">' + esc(label) + '</span>' + body;
      box.appendChild(d);
    });
    box.scrollTop = box.scrollHeight;
  }
  function addMessage(chatId, msg) {
    if (!state.messages[chatId]) state.messages[chatId] = [];
    state.messages[chatId].push(msg); save();
  }
  function sazmuReply(text) {
    var box = $('chatbox');
    var ty = document.createElement('div'); ty.className = 'msg ai typing'; ty.textContent = 'SAZMU AI লিখছে…';
    box.appendChild(ty); box.scrollTop = box.scrollHeight;
    setTimeout(function () {
      ty.remove();
      var comp = state.companion;
      var callName = comp.callName || (comp.role === 'Boyfriend' ? 'Sazzad' : 'SAZMU');
      var r = window.SAZMU_REPLY.reply(text, { petName: comp.petName || '', callName: callName });
      addMessage(currentChatId, { from: 'u_sazmu', type: 'text', text: r });
      renderMessages();
    }, 700);
  }
  function renderSazmuSettings() {
    var comp = state.companion;
    $('sazmuRole').value = comp.role;
    $('sazmuName').value = comp.callName;
    $('sazmuPet').value = comp.petName || '';
    var chips = $('sazmuChips'); chips.innerHTML = '';
    if (comp.role === 'Girlfriend') {
      GIRLFRIEND_PRESETS.forEach(function (p) {
        var s = document.createElement('span'); s.className = 'chip' + (comp.callName === p ? ' sel' : ''); s.textContent = p;
        s.addEventListener('click', function () { $('sazmuName').value = p; });
        chips.appendChild(s);
      });
    } else {
      chips.innerHTML = '<span class="small">Boyfriend default call name is Sazzad (change it if you like).</span>';
    }
  }

  async function hashPassword(pw) {
    try {
      var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('00' + b.toString(16)).slice(-2); }).join('');
    } catch (e) { return 'demo:' + pw.length; }
  }

  function init() {
    state = load();
    if (state.currentUser) { renderMain(); show('screen-main'); } else { renderTop(); show('screen-register'); }

    $('registerForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      var username = $('regUsername').value.trim().toLowerCase().replace(/^@/, '');
      var displayName = $('regDisplay').value.trim();
      var pw = $('regPassword').value;
      var err = $('regError');
      if (!/^[a-z0-9_]{3,20}$/.test(username)) { err.textContent = 'Username must be 3–20 letters, numbers or _ (no spaces).'; return; }
      if (!displayName) { err.textContent = 'Please enter a display name.'; return; }
      if (pw.length < 4) { err.textContent = 'Password must be at least 4 characters (demo only).'; return; }
      if (state.users.some(function (u) { return u.username === username; })) { err.textContent = 'That username is already taken in this demo. Pick another.'; return; }
      var id = generateCommunicaId(state.users.map(function (u) { return u.communicaId; }));
      var user = { id: 'u_' + username, username: username, displayName: displayName, communicaId: id, isAI: false, passwordHash: await hashPassword(pw) };
      state.users.push(user); state.currentUser = user; save();
      renderMain(); show('screen-main');
    });
    $('demoLogin').addEventListener('click', function () {
      state.currentUser = findUserById(state.users, 'u_ayesha'); save(); renderMain(); show('screen-main');
    });
    $('logoutBtn').addEventListener('click', function () {
      state.currentUser = null; save(); renderTop(); show('screen-register');
    });
    $('searchInput').addEventListener('input', function (e) { searchQuery = e.target.value; if (currentTab === 'chats') renderList(); });
    document.querySelectorAll('#tabs button').forEach(function (b) {
      b.addEventListener('click', function () { currentTab = b.getAttribute('data-tab'); renderTabs(); if (currentTab === 'chats') renderList(); });
    });
    document.querySelectorAll('[data-filter]').forEach(function (b) {
      b.addEventListener('click', function () {
        currentFilter = b.getAttribute('data-filter');
        document.querySelectorAll('[data-filter]').forEach(function (x) { x.classList.toggle('sel', x === b); });
        renderList();
      });
    });
    $('backBtn').addEventListener('click', function () { currentChatId = null; renderMain(); show('screen-main'); });
    $('sendBtn').addEventListener('click', sendChat);
    $('chatInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') sendChat(); });
    $('photoInput').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0]; if (!f || !currentChatId) return;
      var r = new FileReader();
      r.onload = function () { addMessage(currentChatId, { from: 'me', type: 'photo', media: r.result }); renderMessages(); };
      r.readAsDataURL(f); e.target.value = '';
    });
    $('voiceBtn').addEventListener('click', async function () {
      if (mediaRecorder && mediaRecorder.state === 'recording') { mediaRecorder.stop(); $('voiceBtn').textContent = '🎤 Voice'; $('status').textContent = ''; return; }
      try {
        var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunks = []; mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = function (ev) { if (ev.data.size) audioChunks.push(ev.data); };
        mediaRecorder.onstop = function () {
          var blob = new Blob(audioChunks, { type: 'audio/webm' });
          var url = URL.createObjectURL(blob);
          if (currentChatId) { addMessage(currentChatId, { from: 'me', type: 'voice', media: url }); renderMessages(); }
          stream.getTracks().forEach(function (t) { t.stop(); });
        };
        mediaRecorder.start(); $('voiceBtn').textContent = '⏹ Stop'; $('status').textContent = 'Recording… tap again to stop. Demo only — no upload.';
      } catch (err) { $('status').textContent = 'Mic not available or permission denied. Type your message instead.'; }
    });
    $('speakBtn').addEventListener('click', function () {
      var msgs = state.messages[currentChatId] || [];
      var last = null; for (var i = msgs.length - 1; i >= 0; i--) if (msgs[i].from !== 'me' && msgs[i].type === 'text') { last = msgs[i]; break; }
      if (!last || !('speechSynthesis' in window)) return;
      var u = new SpeechSynthesisUtterance(last.text); u.lang = 'bn-BD'; speechSynthesis.speak(u);
    });
    $('saveSazmu').addEventListener('click', function () {
      var role = $('sazmuRole').value;
      var name = $('sazmuName').value.trim() || (role === 'Boyfriend' ? 'Sazzad' : 'SAZMU');
      state.companion = { role: role, callName: name, petName: $('sazmuPet').value.trim() };
      save(); renderSazmuSettings(); $('status').textContent = 'SAZMU settings saved (demo only, this browser).';
    });
    $('sazmuRole').addEventListener('change', function () {
      if ($('sazmuRole').value === 'Boyfriend' && (!$('sazmuName').value || $('sazmuName').value === 'SAZMU')) $('sazmuName').value = 'Sazzad';
      renderSazmuSettings();
    });
    $('archiveBtn').addEventListener('click', function () {
      state.chats.forEach(function (c) { if (c.id === currentChatId) c.archived = true; });
      save(); currentChatId = null; renderMain(); show('screen-main');
    });
  }
  function sendChat() {
    var inp = $('chatInput'); var t = inp.value.trim(); if (!t || !currentChatId) return;
    inp.value = ''; addMessage(currentChatId, { from: 'me', type: 'text', text: t }); renderMessages();
    var c = null; state.chats.forEach(function (x) { if (x.id === currentChatId) c = x; });
    if (c) { var p = peerOf(c); if (p && p.isAI) sazmuReply(t); }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
