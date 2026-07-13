const STORAGE = {
  apiUrl: 'moyo.webAdmin.apiUrl',
  token: 'moyo.webAdmin.token',
  admin: 'moyo.webAdmin.admin'
};

const STATUS_TEXT = {
  pending: '待确认',
  confirmed: '已确认',
  done: '已完成',
  canceled: '已取消'
};

let state = {
  apiUrl: localStorage.getItem(STORAGE.apiUrl) || '',
  token: localStorage.getItem(STORAGE.token) || '',
  admin: JSON.parse(localStorage.getItem(STORAGE.admin) || 'null'),
  currentView: 'overview',
  orders: [],
  services: [],
  staff: [],
  voiceTimer: null,
  lastVoiceId: ''
};

const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));

function setError(message) {
  $('#globalError').textContent = message || '';
}

function setLoginError(message) {
  $('#loginError').textContent = message || '';
}

async function apiCall(action, payload = {}, needsToken = true) {
  const apiUrl = state.apiUrl || $('#apiUrlInput').value.trim();
  if (!apiUrl) throw new Error('请先填写 webAdminApi 的 HTTP 地址');
  const body = Object.assign({ action }, payload);
  if (needsToken) body.token = state.token;
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.reason || '请求失败');
  return data;
}

function saveSession(data) {
  state.token = data.token;
  state.admin = data.admin;
  state.apiUrl = $('#apiUrlInput').value.trim();
  localStorage.setItem(STORAGE.apiUrl, state.apiUrl);
  localStorage.setItem(STORAGE.token, state.token);
  localStorage.setItem(STORAGE.admin, JSON.stringify(state.admin));
}

function clearSession() {
  state.token = '';
  state.admin = null;
  localStorage.removeItem(STORAGE.token);
  localStorage.removeItem(STORAGE.admin);
  stopVoicePolling();
}

function showApp() {
  $('#loginView').classList.add('hidden');
  $('#dashboardView').classList.remove('hidden');
  $('#adminName').textContent = state.admin ? `${state.admin.name || '管理员'} ${state.admin.phone || ''}` : '';
}

function showLogin() {
  $('#dashboardView').classList.add('hidden');
  $('#loginView').classList.remove('hidden');
}

function switchView(view) {
  state.currentView = view;
  const titles = { overview: '总览', orders: '订单', services: '项目', staff: '美容师', voice: '播报' };
  $('#viewTitle').textContent = titles[view] || '后台';
  $$('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
  $$('.panel').forEach(panel => panel.classList.remove('active-panel'));
  $(`#${view}Panel`).classList.add('active-panel');
  refreshCurrentView();
}

async function login() {
  setLoginError('');
  try {
    state.apiUrl = $('#apiUrlInput').value.trim();
    const data = await apiCall('login', {
      phone: $('#phoneInput').value.trim(),
      password: $('#passwordInput').value
    }, false);
    saveSession(data);
    showApp();
    await loadAll();
  } catch (e) {
    setLoginError(e.message);
  }
}

async function loadAll() {
  await Promise.all([loadStats(), loadOrders(), loadCatalog('services'), loadCatalog('staff')]);
}

async function refreshCurrentView() {
  try {
    setError('');
    if (state.currentView === 'overview') {
      await Promise.all([loadStats(), loadOrders('pending')]);
    } else if (state.currentView === 'orders') {
      await loadOrders($('#statusFilter').value);
    } else if (state.currentView === 'services') {
      await loadCatalog('services');
    } else if (state.currentView === 'staff') {
      await loadCatalog('staff');
    } else if (state.currentView === 'voice') {
      await loadVoiceQueue();
    }
  } catch (e) {
    setError(e.message);
  }
}

async function loadStats() {
  const data = await apiCall('stats');
  $('#statOrders').textContent = data.orderCount;
  $('#statCustomers').textContent = data.customerCount;
  $('#statIncome').textContent = `¥${Number(data.income || 0).toFixed(0)}`;
}

async function loadOrders(status) {
  const data = await apiCall('listOrders', { status: status || '' });
  state.orders = data.list || [];
  renderOrders('#ordersList', state.orders);
  renderOrders('#overviewOrders', state.orders.slice(0, 5));
}

function renderOrders(target, list) {
  const el = $(target);
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<article class="order-card">暂无预约</article>';
    return;
  }
  el.innerHTML = list.map(item => `
    <article class="order-card">
      <div class="card-head">
        <span class="card-title">${escapeHtml(item.serviceName || '预约项目')}</span>
        <span class="tag">${STATUS_TEXT[item.status] || item.status || '未知'}</span>
      </div>
      <div class="meta">
        <span>${escapeHtml(item.date || '')} ${escapeHtml(item.startTime || '')}</span>
        <span>${escapeHtml(item.staffName || '芬芬')}</span>
        <span>${escapeHtml(customerName(item))}</span>
        <span>${escapeHtml(customerPhone(item))}</span>
      </div>
      <div class="card-actions">
        <span>${escapeHtml(item.orderNo || '')}</span>
        <div>
          ${item.status === 'pending' ? `<button class="ghost-btn" data-order-action="confirmed" data-id="${item._id}">确认</button>` : ''}
          ${item.status === 'confirmed' ? `<button class="ghost-btn" data-order-action="done" data-id="${item._id}">完成</button>` : ''}
          ${['pending', 'confirmed'].includes(item.status) ? `<button class="ghost-btn danger" data-order-action="canceled" data-id="${item._id}">取消</button>` : ''}
          ${!item.adminRead ? `<button class="ghost-btn" data-mark-read="${item._id}">已读</button>` : ''}
        </div>
      </div>
    </article>
  `).join('');
}

function customerName(item) {
  return item.userSnapshot && item.userSnapshot.nickname ? item.userSnapshot.nickname : '顾客';
}

function customerPhone(item) {
  return item.userSnapshot && item.userSnapshot.phone ? item.userSnapshot.phone : '';
}

async function updateOrder(bookingId, payload) {
  await apiCall('updateOrder', Object.assign({ bookingId }, payload));
  await refreshCurrentView();
}

async function loadCatalog(collection) {
  const data = await apiCall('manageCatalog', { collection, op: 'list' });
  state[collection === 'services' ? 'services' : 'staff'] = data.list || [];
  renderCatalog(collection, data.list || []);
}

function renderCatalog(collection, list) {
  const target = collection === 'services' ? '#servicesList' : '#staffList';
  $(target).innerHTML = list.map(item => `
    <article class="catalog-card">
      <div class="card-head">
        <span class="card-title">${escapeHtml(item.name || '')}</span>
        <span class="tag">${item.enabled === false ? '已停用' : '启用'}</span>
      </div>
      <div class="meta">
        ${collection === 'services'
          ? `<span>${Number(item.durationMin || 0)} 分钟</span><span>¥${Number(item.price || 0)}</span><span>${escapeHtml(item.description || '')}</span>`
          : `<span>${escapeHtml(item.title || '美容师')}</span><span>${escapeHtml(item.avatar || '')}</span>`}
        <span>排序 ${Number(item.sortOrder || 0)}</span>
      </div>
      <div class="card-actions">
        <button class="ghost-btn" data-edit-${collection}="${item._id}">编辑</button>
        <button class="ghost-btn danger" data-disable-${collection}="${item._id}">停用</button>
      </div>
    </article>
  `).join('') || '<article class="catalog-card">暂无数据</article>';
}

function fillForm(formId, item) {
  const form = document.getElementById(formId);
  Object.keys(item).forEach(key => {
    const input = form.elements[key];
    if (!input) return;
    if (input.type === 'checkbox') input.checked = item[key] !== false;
    else input.value = item[key] == null ? '' : item[key];
  });
}

function resetForm(formId) {
  const form = document.getElementById(formId);
  form.reset();
  form.elements._id.value = '';
  if (form.elements.enabled) form.elements.enabled.checked = true;
}

function formData(form) {
  const data = {};
  Array.from(form.elements).forEach(input => {
    if (!input.name || input.name === '_id') return;
    if (input.type === 'checkbox') data[input.name] = input.checked;
    else if (input.type === 'number') data[input.name] = input.value === '' ? 0 : Number(input.value);
    else data[input.name] = input.value.trim();
  });
  return data;
}

async function saveCatalog(collection, form) {
  const id = form.elements._id.value;
  await apiCall('manageCatalog', {
    collection,
    op: id ? 'update' : 'create',
    id,
    data: formData(form)
  });
  resetForm(form.id);
  await loadCatalog(collection);
}

async function disableCatalog(collection, id) {
  await apiCall('manageCatalog', { collection, op: 'remove', id });
  await loadCatalog(collection);
}

async function loadVoiceQueue() {
  const data = await apiCall('getPendingVoiceNotices', { limit: 10 });
  renderVoiceQueue(data.list || []);
}

function renderVoiceQueue(list) {
  $('#voiceQueue').innerHTML = list.map(item => `
    <article class="order-card">
      <div class="card-head">
        <span class="card-title">${escapeHtml(item.voiceNoticeType === 'canceled' ? '取消预约' : '新预约')}</span>
        <span class="tag">${escapeHtml(item.date || '')} ${escapeHtml(item.startTime || '')}</span>
      </div>
      <p>${escapeHtml(buildNoticeText(item))}</p>
    </article>
  `).join('') || '<article class="order-card">暂无待播报预约</article>';
}

function startVoicePolling() {
  stopVoicePolling();
  $('#voiceStatus').textContent = '正在监听新预约，请保持本页打开并允许浏览器播放声音。';
  pollVoice();
  state.voiceTimer = setInterval(pollVoice, 6000);
}

function stopVoicePolling() {
  if (state.voiceTimer) clearInterval(state.voiceTimer);
  state.voiceTimer = null;
  const status = $('#voiceStatus');
  if (status) status.textContent = '已暂停监听。';
}

async function pollVoice() {
  try {
    const data = await apiCall('getPendingVoiceNotices', { limit: 10 });
    const list = data.list || [];
    renderVoiceQueue(list);
    if (!list.length) {
      $('#voiceStatus').textContent = '暂无新预约，正在监听中。';
      return;
    }
    const notice = list[0];
    if (notice._id === state.lastVoiceId) return;
    state.lastVoiceId = notice._id;
    const text = buildNoticeText(notice);
    $('#voiceStatus').textContent = text;
    await playNoticeSound(text, notice.voiceNoticeType);
    await apiCall('markVoiceNoticePlayed', { bookingId: notice._id, status: 'played' });
    await loadVoiceQueue();
  } catch (e) {
    $('#voiceStatus').textContent = e.message;
  }
}

function buildNoticeText(item) {
  if (item.voiceNoticeText) return item.voiceNoticeText;
  const customer = customerName(item);
  const phone = customerPhone(item) ? `，电话${customerPhone(item)}` : '';
  const remark = item.remark ? `，备注${item.remark}` : '';
  if (item.voiceNoticeType === 'canceled' || item.status === 'canceled') {
    return `取消预约提醒。${customer}${phone}。已取消${item.serviceName || '预约项目'}。原预约时间${item.date} ${item.startTime}。服务美容师${item.staffName || '未指定'}`;
  }
  return `新预约提醒。${customer}${phone}。预约${item.serviceName}。时间${item.date} ${item.startTime}。服务美容师${item.staffName}${remark}`;
}

function playNoticeSound(text, type) {
  return new Promise(resolve => {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = type === 'canceled' ? 360 : 640;
      gain.gain.value = 0.18;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.42);
      osc.onended = () => ctx.close();
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'zh-CN';
      utter.rate = 0.95;
      utter.onend = resolve;
      utter.onerror = resolve;
      window.speechSynthesis.speak(utter);
      setTimeout(resolve, 8000);
    } else {
      setTimeout(resolve, 600);
    }
  });
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function bindEvents() {
  $('#apiUrlInput').value = state.apiUrl;
  $('#loginButton').addEventListener('click', login);
  $('#passwordInput').addEventListener('keydown', event => {
    if (event.key === 'Enter') login();
  });
  $('#logoutButton').addEventListener('click', () => {
    clearSession();
    showLogin();
  });
  $('#refreshButton').addEventListener('click', refreshCurrentView);
  $$('.nav-item').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));
  $$('[data-view-jump]').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.viewJump)));
  $('#statusFilter').addEventListener('change', () => loadOrders($('#statusFilter').value));
  $('#markAllReadButton').addEventListener('click', async () => {
    await apiCall('updateOrder', { markAllRead: true });
    await loadOrders($('#statusFilter').value);
  });
  $('#serviceForm').addEventListener('submit', event => {
    event.preventDefault();
    saveCatalog('services', event.currentTarget).catch(e => setError(e.message));
  });
  $('#staffForm').addEventListener('submit', event => {
    event.preventDefault();
    saveCatalog('staff', event.currentTarget).catch(e => setError(e.message));
  });
  $$('[data-reset-form]').forEach(btn => btn.addEventListener('click', () => resetForm(btn.dataset.resetForm)));
  $('#startVoiceButton').addEventListener('click', startVoicePolling);
  $('#stopVoiceButton').addEventListener('click', stopVoicePolling);
  $('#testVoiceButton').addEventListener('click', () => playNoticeSound('新预约提醒。顾客，电话13800000000。预约面部护理。时间2026-07-13 10:00。服务美容师芬芬，备注到店后先咨询', 'new'));
  document.body.addEventListener('click', event => {
    const orderAction = event.target.dataset.orderAction;
    const orderId = event.target.dataset.id;
    const markReadId = event.target.dataset.markRead;
    if (orderAction && orderId) updateOrder(orderId, { status: orderAction, markRead: true }).catch(e => setError(e.message));
    if (markReadId) updateOrder(markReadId, { markRead: true }).catch(e => setError(e.message));
    const serviceId = event.target.dataset.editServices;
    const staffId = event.target.dataset.editStaff;
    const disableServiceId = event.target.dataset.disableServices;
    const disableStaffId = event.target.dataset.disableStaff;
    if (serviceId) fillForm('serviceForm', state.services.find(item => item._id === serviceId) || {});
    if (staffId) fillForm('staffForm', state.staff.find(item => item._id === staffId) || {});
    if (disableServiceId) disableCatalog('services', disableServiceId).catch(e => setError(e.message));
    if (disableStaffId) disableCatalog('staff', disableStaffId).catch(e => setError(e.message));
  });
}

bindEvents();

if (state.token) {
  showApp();
  loadAll().catch(e => {
    clearSession();
    showLogin();
    setLoginError(e.message);
  });
}
