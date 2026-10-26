/* Kindle Chat: one script for both pages.
   chat/kindle.html sets window.CHAT_MODE = 'kindle' (e-ink: slow polling, no animation, black and white).
   chat/index.html is the iPhone page (iMessage look, fast polling).
   ES5 only, XMLHttpRequest only, no inline onclick: the Kindle's browser is old, and inline handlers
   on buttons resolve names like "type" against the button itself. */
(function () {
  'use strict';
  var MODE = window.CHAT_MODE === 'kindle' ? 'kindle' : 'iphone';
  var POLL_MS = MODE === 'kindle' ? 15000 : 3000;
  var SHOW = MODE === 'kindle' ? 40 : 200;          /* messages shown before "Earlier messages" */
  var BASE_URL = window.CHAT_PAGE_URL || (location.href.split('#')[0].replace(/kindle\.html$/, '').replace(/index\.html$/, ''));

  /* ---------- Storage ---------- */
  function store(k, v) {
    try {
      if (v === undefined) { var s = window.localStorage.getItem(k); return s ? JSON.parse(s) : null; }
      if (v === null) window.localStorage.removeItem(k); else window.localStorage.setItem(k, JSON.stringify(v));
    } catch (e) { }
    return null;
  }
  function randId(n) { var a = 'abcdefghjkmnpqrstuvwxyz23456789', s = ''; for (var i = 0; i < n; i++) s += a.charAt(Math.floor(Math.random() * a.length)); return s; }
  var ME = store('kc.me'); if (!ME) { ME = randId(16); store('kc.me', ME); }
  var SERVER = store('kc.server') || window.CHAT_SERVER || '';

  /* ---------- Helpers ---------- */
  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function linkify(s) { return esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>'); }
  function rooms() { return store('kc.rooms') || []; }
  function saveRooms(r) { store('kc.rooms', r); }
  function findRoom(code) { var r = rooms(); for (var i = 0; i < r.length; i++) if (r[i].code === code) return r[i]; return null; }
  function upsertRoom(room) {
    var r = rooms(), i;
    for (i = 0; i < r.length; i++) if (r[i].code === room.code) { for (var k in room) r[i][k] = room[k]; saveRooms(r); return; }
    r.unshift(room); saveRooms(r);
  }
  function initials(name) { var p = String(name || '?').split(/\s+/), s = (p[0] || '?').charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : ''); return s.toUpperCase(); }
  /* The creator named the chat after the other person, so everyone else sees the names of the people they're talking to */
  function roomTitle(room) {
    if (!room) return 'Chat';
    if (room.mine || !room.others || !room.others.length) return room.name || 'Chat';
    return room.others.join(', ');
  }
  function cleanCode(s) { s = String(s || '').trim(); var m = s.match(/[#&?]c=([a-z0-9-]+)/i); if (m) s = m[1]; return s.toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function prettyCode(c) { return c.replace(/(.{6})(?=.)/g, '$1-'); }
  /* Until config.js names the helper, the link carries its address so a friend's phone needs no setup */
  function inviteUrl(code) { return BASE_URL + '#c=' + code + (window.CHAT_SERVER ? '' : '&s=' + encodeURIComponent(SERVER)); }

  /* ---------- Time ---------- */
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function clock(d) { var h = d.getHours(), m = d.getMinutes(); return (h % 12 || 12) + ':' + (m < 10 ? '0' : '') + m + ' ' + (h < 12 ? 'AM' : 'PM'); }
  function dayStart(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
  function stamp(ts) {
    var d = new Date(ts), today = dayStart(new Date()), dd = dayStart(d), diff = Math.round((today - dd) / 864e5);
    if (diff === 0) return 'Today ' + clock(d);
    if (diff === 1) return 'Yesterday ' + clock(d);
    if (diff < 7) return DAYS[d.getDay()] + ' ' + clock(d);
    return MON[d.getMonth()] + ' ' + d.getDate() + ', ' + clock(d);
  }
  function shortStamp(ts) {
    var d = new Date(ts), diff = Math.round((dayStart(new Date()) - dayStart(d)) / 864e5);
    if (diff === 0) return clock(d); if (diff === 1) return 'Yesterday'; if (diff < 7) return DAYS[d.getDay()];
    return (d.getMonth() + 1) + '/' + d.getDate() + '/' + String(d.getFullYear()).slice(2);
  }

  /* ---------- Server ---------- */
  function api(method, path, body, cb) {
    if (!SERVER) { cb('No chat server is set up yet'); return; }
    var x;
    try { x = new XMLHttpRequest(); } catch (e) { cb('This browser can\'t send requests'); return; }
    var done = false;
    x.open(method, SERVER.replace(/\/+$/, '') + path, true);
    if (body) x.setRequestHeader('Content-Type', 'text/plain');
    x.onreadystatechange = function () {
      if (x.readyState !== 4 || done) return; done = true;
      var data = null; try { data = JSON.parse(x.responseText); } catch (e) { }
      if (x.status >= 200 && x.status < 300 && data) cb(null, data);
      else cb((data && data.error) || (x.status ? 'Error ' + x.status : 'Can\'t reach the chat server'), data);
    };
    try { x.timeout = 20000; x.ontimeout = function () { if (!done) { done = true; cb('Timed out'); } }; } catch (e) { }
    x.send(body ? JSON.stringify(body) : null);
  }

  /* ---------- State ---------- */
  var S = { view: 'home', code: null, msgs: [], members: [], pending: [], err: '', showAll: false, polling: null, busy: false, roomName: '' };
  function myName() { return store('kc.name') || ''; }

  /* ---------- Rendering ---------- */
  function render() {
    var html;
    if (!SERVER) html = viewServer();
    else if (!myName()) html = viewName();
    else if (S.view === 'chat') html = viewChat();
    else if (S.view === 'new') html = viewNew();
    else if (S.view === 'invite') html = viewInvite();
    else if (S.view === 'join') html = viewJoin();
    else if (S.view === 'settings') html = viewSettings();
    else html = viewHome();
    el('app').innerHTML = html;
    document.body.className = 'v-' + (S.view === 'chat' && SERVER && myName() ? 'chat' : 'page');
    if (S.view === 'chat') { stickBottom(true); }
    var f = el('autofocus'); if (f && MODE === 'iphone') { try { f.focus(); } catch (e) { } }
  }
  function bar(left, title, right) {
    return '<div class="bar"><div class="bl">' + (left || '') + '</div><div class="bt">' + title + '</div><div class="br">' + (right || '') + '</div></div>';
  }
  function err() { return S.err ? '<p class="err">' + esc(S.err) + '</p>' : ''; }

  function viewServer() {
    return bar('', 'Chat setup') + '<div class="page"><p>Paste the address of your chat helper (it looks like <b>https://kindle-chat.yourname.workers.dev</b>).</p>' +
      '<form data-form="server"><input class="field" id="autofocus" name="server" type="url" autocapitalize="off" autocorrect="off" placeholder="https://kindle-chat....workers.dev"><button class="btn primary" type="submit">Save</button></form>' + err() + '</div>';
  }
  function viewName() {
    return bar('', 'Welcome') + '<div class="page"><p>What should people in your chats call you?</p>' +
      '<form data-form="name"><input class="field" id="autofocus" name="name" maxlength="40" autocomplete="given-name" placeholder="Your name"><button class="btn primary" type="submit">Continue</button></form>' + err() + '</div>';
  }
  function viewHome() {
    var r = rooms(), s = '';
    s += bar('<a data-act="settings">' + (MODE === 'kindle' ? 'Settings' : 'Edit') + '</a>', 'Messages', '<a data-act="new" class="compose" aria-label="New conversation">' + (MODE === 'kindle' ? 'New' : composeIcon()) + '</a>');
    s += '<div class="page list">';
    if (MODE === 'iphone') s += '<h1 class="large">Messages</h1>';
    if (!r.length) s += '<p class="empty">No conversations yet. Start one, or join with a code a friend gave you.</p>';
    for (var i = 0; i < r.length; i++) {
      var x = r[i];
      s += '<a class="row" data-act="open" data-code="' + esc(x.code) + '"><span class="av">' + esc(initials(roomTitle(x))) + '</span><span class="rt"><span class="rn">' + esc(roomTitle(x)) +
        '</span><span class="rw">' + (x.lastTs ? esc(shortStamp(x.lastTs)) : '') + (MODE === 'iphone' ? ' <span class="chev">›</span>' : '') + '</span><span class="rp">' + esc(x.last || 'No messages yet') + '</span></span></a>';
    }
    s += '<div class="acts"><button class="btn" data-act="new">New conversation</button><button class="btn" data-act="join">Join with a code</button></div></div>';
    return s;
  }
  function viewNew() {
    var needAdmin = !store('kc.admin');
    return bar('<a data-act="home">' + back('Messages') + '</a>', 'New conversation') + '<div class="page"><form data-form="new">' +
      '<label>Who\'s it with?</label><input class="field" id="autofocus" name="name" maxlength="60" placeholder="Name, or a group name">' +
      (needAdmin ? '<label>Your chat passcode</label><input class="field" name="admin" type="password" placeholder="Passcode"><p class="note">Asked once on this device. It\'s the ADMIN_CODE you set on the helper, and it stops strangers starting chats on it.</p>' : '') +
      '<button class="btn primary" type="submit">' + (S.busy ? 'Starting…' : 'Start') + '</button></form>' + err() + '</div>';
  }
  function viewInvite() {
    var room = findRoom(S.code) || { name: '' }, url = inviteUrl(S.code), qr = '';
    room = { name: roomTitle(room) };
    try { var q = window.qrcode(0, 'M'); q.addData(url); q.make(); qr = q.createSvgTag({ cellSize: MODE === 'kindle' ? 7 : 5, margin: 2, scalable: true }); } catch (e) { }
    return bar('<a data-act="open" data-code="' + esc(S.code) + '">' + back('Chat') + '</a>', 'Invite') + '<div class="page invite">' +
      '<p>Send this to ' + esc(room.name || 'your friend') + '. Anyone with it can read and post in this conversation, so only give it to the people in it.</p>' +
      (qr ? '<div class="qr">' + qr + '</div><p class="note center">Point an iPhone camera at the code to open the chat.</p>' : '') +
      '<p class="label">Link</p><p class="mono">' + esc(url) + '</p>' +
      '<p class="label">Or the code (for the Join screen)</p><p class="mono big">' + esc(prettyCode(S.code)) + '</p>' +
      '<div class="acts">' + (MODE === 'iphone' ? '<button class="btn" data-act="share">Share link</button>' : '') +
      '<button class="btn primary" data-act="open" data-code="' + esc(S.code) + '">Open conversation</button></div></div>';
  }
  function viewJoin() {
    return bar('<a data-act="home">' + back('Messages') + '</a>', 'Join') + '<div class="page"><form data-form="join">' +
      '<label>Code or link</label><input class="field" id="autofocus" name="code" autocapitalize="off" autocorrect="off" placeholder="abcdef-ghjkmn-pqrstu">' +
      '<button class="btn primary" type="submit">' + (S.busy ? 'Joining…' : 'Join') + '</button></form>' + err() + '</div>';
  }
  function viewSettings() {
    return bar('<a data-act="home">' + back('Messages') + '</a>', 'Settings') + '<div class="page"><form data-form="settings">' +
      '<label>Your name</label><input class="field" name="name" maxlength="40" value="' + esc(myName()) + '">' +
      '<label>Chat helper address</label><input class="field" name="server" type="url" autocapitalize="off" autocorrect="off" value="' + esc(SERVER) + '">' +
      '<button class="btn primary" type="submit">Save</button></form>' +
      (store('kc.admin') ? '<div class="acts"><button class="btn" data-act="forgetadmin">Forget the passcode on this device</button></div>' : '') + err() + '</div>';
  }

  /* The chat itself */
  function membersOther() { var out = []; for (var i = 0; i < S.members.length; i++) if (S.members[i].sender !== ME) out.push(S.members[i]); return out; }
  function isGroup() { var names = {}, n = 0; for (var i = 0; i < S.msgs.length; i++) if (S.msgs[i].sender !== ME && !names[S.msgs[i].sender]) { names[S.msgs[i].sender] = 1; n++; } return n > 1 || membersOther().length > 1; }
  function viewChat() {
    var room = findRoom(S.code) || { name: S.roomName || 'Chat' }, tname = roomTitle(room);
    var title = '<span class="ttl"><span class="av sm">' + esc(initials(tname)) + '</span><span class="tn">' + esc(tname) + (MODE === 'iphone' ? ' <span class="chev">›</span>' : '') + '</span></span>';
    var right = MODE === 'kindle' ? '<a data-act="refresh">Refresh</a> &nbsp; <a data-act="invite">Invite</a>' : '<a data-act="invite">Invite</a>';
    return bar('<a data-act="home">' + back(MODE === 'kindle' ? 'Chats' : '') + '</a>', title.replace('<span class="ttl">', '<span class="ttl" data-act="rename">'), right) +
      '<div class="thread" id="thread">' + threadHtml() + '</div>' +
      '<form class="composer" data-form="send"><input class="msgin" id="msgin" name="text" maxlength="2000" autocomplete="off" enterkeyhint="send" placeholder="' + (MODE === 'kindle' ? 'Message' : 'iMessage') + '">' +
      '<button class="send" type="submit" aria-label="Send">' + (MODE === 'kindle' ? 'Send' : '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>') + '</button></form>';
  }
  function threadHtml() {
    var all = S.msgs.concat(S.pending), start = 0, s = '', group = isGroup();
    if (!S.showAll && all.length > SHOW) { start = all.length - SHOW; s += '<div class="older"><a data-act="older">Earlier messages</a></div>'; }
    if (!all.length) s += '<p class="empty">No messages yet. Say hi.</p>';
    var myLast = -1, i;
    for (i = all.length - 1; i >= 0; i--) if (all[i].sender === ME) { myLast = i; break; }
    for (i = start; i < all.length; i++) {
      var m = all[i], prev = all[i - 1], next = all[i + 1], mine = m.sender === ME;
      if (!prev || m.ts - prev.ts > 15 * 60000) s += '<div class="when">' + esc(stamp(m.ts)) + '</div>';
      var firstOfRun = !prev || prev.sender !== m.sender || (m.ts - prev.ts > 15 * 60000);
      var lastOfRun = !next || next.sender !== m.sender || (next.ts - m.ts > 15 * 60000);
      if (!mine && group && firstOfRun) s += '<div class="who">' + esc(m.name) + '</div>';
      s += '<div class="msg ' + (mine ? 'me' : 'them') + (lastOfRun ? ' tail' : '') + (m.failed ? ' failed' : '') + '"' + (m.failed ? ' data-act="retry" data-tmp="' + m.tmp + '"' : '') + '><div class="b">' + linkify(m.text) + '</div></div>';
      if (i === myLast) s += '<div class="rcpt">' + receipt(m) + '</div>';
    }
    return s;
  }
  function receipt(m) {
    if (m.failed) return 'Not delivered. Tap the message to try again.';
    if (m.tmp) return 'Sending…';
    var others = membersOther(), read = false, seen = 0;
    for (var i = 0; i < others.length; i++) if (others[i].last_read >= m.id) { read = true; seen = Math.max(seen, others[i].seen); }
    return read ? 'Read' + (seen ? ' ' + esc(shortStamp(seen)) : '') : 'Delivered';
  }
  function back(label) { return MODE === 'kindle' ? '‹ ' + label : '<span class="back">‹</span>' + (label ? '<span class="backl">' + label + '</span>' : ''); }
  function composeIcon() { return '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'; }

  /* Repaint only the thread (and keep whatever is being typed) */
  function paintThread() {
    var t = el('thread'); if (!t) return;
    var nearBottom = atBottom();
    t.innerHTML = threadHtml();
    if (nearBottom) stickBottom(false);
  }
  function atBottom() { var y = window.pageYOffset || document.documentElement.scrollTop || 0, h = window.innerHeight || document.documentElement.clientHeight; return (document.body.scrollHeight - (y + h)) < 160; }
  function stickBottom() { window.scrollTo(0, document.body.scrollHeight + 1000); }

  /* ---------- Chat data ---------- */
  function cacheKey(code) { return 'kc.msgs.' + code; }
  function lastId() { return S.msgs.length ? S.msgs[S.msgs.length - 1].id : 0; }
  function openChat(code) {
    S.view = 'chat'; S.code = code; S.err = ''; S.showAll = false; S.pending = [];
    S.msgs = store(cacheKey(code)) || []; S.members = [];
    render(); poll(true); startPolling();
  }
  function poll(first) {
    if (S.view !== 'chat' || !S.code) return;
    var code = S.code, visible = !document.hidden;
    var q = '/c/' + code + '?after=' + (first ? 0 : lastId()) + '&me=' + encodeURIComponent(ME) + '&name=' + encodeURIComponent(myName()) + (visible ? '&read=' + lastId() : '');
    api('GET', q, null, function (e, d) {
      if (code !== S.code || S.view !== 'chat') return;
      if (e) { if (e.indexOf('No conversation') === 0) { S.err = e; } return; }
      var changed = false;
      if (first) { changed = JSON.stringify(S.msgs) !== JSON.stringify(d.messages); S.msgs = d.messages; }
      else if (d.messages.length) {
        var have = {}, i; for (i = 0; i < S.msgs.length; i++) have[S.msgs[i].id] = 1;
        for (i = 0; i < d.messages.length; i++) if (!have[d.messages[i].id]) { S.msgs.push(d.messages[i]); changed = true; }
      }
      var mem = JSON.stringify(d.members); if (mem !== JSON.stringify(S.members)) { S.members = d.members; changed = true; }
      S.roomName = d.name;
      var last = S.msgs[S.msgs.length - 1], room = findRoom(code);
      var others = []; for (var oi = 0; oi < d.members.length; oi++) if (d.members[oi].sender !== ME) others.push(d.members[oi].name);
      var beforeTitle = roomTitle(room);
      upsertRoom({ code: code, name: d.name, others: others, last: last ? (last.sender === ME ? 'You: ' : '') + last.text : '', lastTs: last ? last.ts : (room && room.lastTs) || 0 });
      if (roomTitle(findRoom(code)) !== beforeTitle) { store(cacheKey(code), S.msgs.slice(-200)); render(); return; }
      store(cacheKey(code), S.msgs.slice(-200));
      if (changed) paintThread();
      if (first) {
        /* the read receipt for what's now on screen */
        if (visible && S.msgs.length) api('GET', '/c/' + code + '?after=' + lastId() + '&me=' + encodeURIComponent(ME) + '&name=' + encodeURIComponent(myName()) + '&read=' + lastId(), null, function () { });
      }
    });
  }
  function startPolling() { stopPolling(); S.polling = setInterval(function () { if (!document.hidden) poll(false); }, POLL_MS); }
  function stopPolling() { if (S.polling) { clearInterval(S.polling); S.polling = null; } }
  function send(text) {
    text = String(text || '').replace(/^\s+|\s+$/g, ''); if (!text) return;
    var tmp = { tmp: randId(8), sender: ME, name: myName(), text: text, ts: new Date().getTime() };
    S.pending.push(tmp); paintThread(); stickBottom();
    deliver(tmp);
  }
  function deliver(tmp) {
    var code = S.code;
    api('POST', '/c/' + code + '/send', { me: ME, name: myName(), text: tmp.text }, function (e, d) {
      var i; for (i = 0; i < S.pending.length; i++) if (S.pending[i].tmp === tmp.tmp) break;
      if (e) { if (S.pending[i]) S.pending[i].failed = true; paintThread(); return; }
      S.pending.splice(i, 1);
      var have = false; for (i = 0; i < S.msgs.length; i++) if (S.msgs[i].id === d.message.id) have = true;
      if (!have) { S.msgs.push(d.message); S.msgs.sort(function (a, b) { return a.id - b.id; }); }
      store(cacheKey(code), S.msgs.slice(-200));
      upsertRoom({ code: code, last: 'You: ' + d.message.text, lastTs: d.message.ts });
      paintThread(); stickBottom();
    });
  }

  /* ---------- Actions ---------- */
  function go(view) { stopPolling(); S.view = view; S.err = ''; S.busy = false; render(); }
  function act(a, node) {
    if (a === 'home') go('home');
    else if (a === 'new') go('new');
    else if (a === 'join') go('join');
    else if (a === 'settings') go('settings');
    else if (a === 'open') openChat(node.getAttribute('data-code'));
    else if (a === 'invite') { stopPolling(); S.view = 'invite'; render(); }
    else if (a === 'refresh') poll(false);
    else if (a === 'older') { S.showAll = true; paintThread(); }
    else if (a === 'retry') { var t = node.getAttribute('data-tmp'); for (var i = 0; i < S.pending.length; i++) if (S.pending[i].tmp === t) { S.pending[i].failed = false; paintThread(); deliver(S.pending[i]); } }
    else if (a === 'forgetadmin') { store('kc.admin', null); go('settings'); }
    else if (a === 'share') {
      var url = inviteUrl(S.code);
      if (navigator.share) { try { navigator.share({ title: 'Chat with ' + myName(), url: url }); } catch (e) { } }
      else { try { navigator.clipboard.writeText(url); S.err = 'Link copied'; render(); } catch (e2) { } }
    }
    else if (a === 'rename') {
      var room = findRoom(S.code), name = window.prompt ? window.prompt('Name this conversation', room ? room.name : '') : null;
      if (name && name.replace(/\s/g, '')) api('POST', '/c/' + S.code + '/rename', { name: name }, function (e, d) { if (!e) { upsertRoom({ code: S.code, name: d.name }); render(); } });
    }
  }
  function submit(kind, form) {
    var v = function (n) { var f = form.elements[n]; return f ? String(f.value || '').replace(/^\s+|\s+$/g, '') : ''; };
    S.err = '';
    if (kind === 'server') {
      var u = v('server'); if (!/^https?:\/\//.test(u)) { S.err = 'That should start with https://'; render(); return; }
      SERVER = u.replace(/\/+$/, ''); store('kc.server', SERVER); render(); return;
    }
    if (kind === 'name') { if (!v('name')) return; store('kc.name', v('name')); afterName(); return; }
    if (kind === 'settings') {
      if (v('name')) store('kc.name', v('name'));
      if (/^https?:\/\//.test(v('server'))) { SERVER = v('server').replace(/\/+$/, ''); store('kc.server', SERVER); }
      go('home'); return;
    }
    if (kind === 'new') {
      var admin = v('admin') || store('kc.admin'), name = v('name');
      if (!name) { S.err = 'Give the conversation a name'; render(); return; }
      if (!admin) { S.err = 'Enter your chat passcode'; render(); return; }
      S.busy = true; render();
      api('POST', '/new', { admin: admin, name: name }, function (e, d) {
        S.busy = false;
        if (e) { S.err = e; render(); return; }
        store('kc.admin', admin); upsertRoom({ code: d.code, name: d.name, mine: true, last: '', lastTs: 0 });
        S.code = d.code; S.view = 'invite'; render();
      });
      return;
    }
    if (kind === 'join') { joinCode(cleanCode(v('code'))); return; }
    if (kind === 'send') { var inp = el('msgin'), text = inp.value; inp.value = ''; send(text); if (MODE === 'iphone') { try { inp.focus(); } catch (e3) { } } }
  }
  function joinCode(code) {
    if (!code || code.length < 10) { S.err = 'That code looks too short'; S.view = 'join'; render(); return; }
    if (findRoom(code)) { openChat(code); return; }
    S.busy = true; S.view = 'join'; render();
    api('GET', '/c/' + code + '?after=0&me=' + encodeURIComponent(ME) + '&name=' + encodeURIComponent(myName()), null, function (e, d) {
      S.busy = false;
      if (e) { S.err = e; render(); return; }
      var last = d.messages[d.messages.length - 1];
      upsertRoom({ code: code, name: d.name, last: last ? last.text : '', lastTs: last ? last.ts : 0 });
      openChat(code);
    });
  }

  /* Links look like .../chat/#c=CODE (an &s=SERVER part is optional) */
  var linkCode = null;
  function readHash() {
    var h = location.hash || '', m = h.match(/[#&]c=([a-z0-9-]+)/i), s = h.match(/[#&]s=([^&]+)/);
    if (s && !store('kc.server')) { SERVER = decodeURIComponent(s[1]); store('kc.server', SERVER); }
    if (m) { linkCode = cleanCode(m[1]); try { history.replaceState(null, '', location.href.split('#')[0]); } catch (e) { } }
  }
  function afterName() {
    if (linkCode) { var c = linkCode; linkCode = null; joinCode(c); return; }
    var r = rooms();
    if (r.length === 1 && MODE === 'iphone' && !store('kc.admin')) { openChat(r[0].code); return; }
    go('home');
  }

  /* ---------- Events (delegated, no inline handlers) ---------- */
  function closestAttr(n, attr) { while (n && n !== document) { if (n.getAttribute && n.getAttribute(attr)) return n; n = n.parentNode; } return null; }
  document.onclick = function (e) {
    e = e || window.event; var n = closestAttr(e.target || e.srcElement, 'data-act');
    if (!n) return;
    if (n.tagName === 'A' && n.getAttribute('href')) return;
    if (e.preventDefault) e.preventDefault();
    act(n.getAttribute('data-act'), n);
  };
  document.onsubmit = function (e) {
    e = e || window.event; var f = e.target || e.srcElement;
    if (e.preventDefault) e.preventDefault();
    if (f && f.getAttribute('data-form')) submit(f.getAttribute('data-form'), f);
    return false;
  };
  try { document.addEventListener('visibilitychange', function () { if (!document.hidden && S.view === 'chat') poll(false); }); } catch (e) { }
  window.onhashchange = function () { readHash(); if (linkCode && myName() && SERVER) afterName(); };

  readHash();
  if (SERVER && myName()) afterName(); else render();
})();
