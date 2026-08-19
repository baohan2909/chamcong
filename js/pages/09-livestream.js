/* ════════════════════════════════════════════════════════════════════════════
 *  Nón Sơn — PHÂN HỆ LIVESTREAM GĐ1 (19/08/2026)
 *
 *  Mục tiêu: NV xem live công ty NGAY TRONG APP, hệ tự đo GIÂY XEM THẬT,
 *  quy về cửa hàng, dashboard tuân thủ — tự vận hành, host không phải làm gì.
 *
 *  PLAYER 3 TẦNG (tự chọn tầng cao nhất khả dụng, tự rơi tầng khi trục trặc):
 *   B. YouTube đồng phát (ls.yt_channel_id) — nhúng "live đang chạy của kênh"
 *      (youtube.com/embed/live_stream?channel=...) → CHẠY MỌI MÁY kể cả iPhone,
 *      đo trạng thái phát chuẩn qua IFrame API. Nguồn: OBS phát song song.
 *   A. FLV TikTok trực tiếp (ls_live_now.flv_url, poller ghi) — mpegts.js self-host,
 *      CHỈ máy có MSE (Android/PC; iPhone iOS17.1+ thử ManagedMediaSource).
 *      PoC 19/08: CDN TikTok cho phép origin app (CORS pass) → phát thẳng, 0 byte server.
 *   C. Thẻ trạng thái (luôn có): ĐANG LIVE + ảnh bìa + mắt xem + nút mở TikTok.
 *
 *  ĐO GIÂY XEM (chống đối phó, không cần host):
 *   - Chỉ đếm khi: video ĐANG PHÁT + app ở TIỀN CẢNH + trang Livestream đang mở.
 *   - Flush 30s/lần → fn_ls_heartbeat (server cộng theo THỜI GIAN THẬT trôi qua
 *     → 2 thiết bị cùng tài khoản không thể x2 giờ).
 *   - "Chạm để tiếp tục xem": sau 10–15' không tương tác → dừng đếm tới khi chạm.
 *   - Bấm qua TikTok: log riêng (lượt tương tác kênh), không tính phút trong app.
 *
 *  Gate: app_settings ls.bat = off | ns00490 | all (router _lsOn — nếp face.v2).
 *  ──────────────────────────────────────────────────────────────────────── */

function _lsOn() {
  try {
    if (typeof SESSION === 'undefined' || !SESSION || !SESSION.ma) return false;
    var v = (typeof _getSetting === 'function') ? _getSetting('ls.bat', 'off') : 'off';
    if (v === true || v === 'true' || v === 'all') return true;
    if (v === 'ns00490' || v === 'test') return SESSION.ma === 'NS00490';
    return false;
  } catch (e) { return false; }
}
window._lsOn = _lsOn;

/* ─── State ─── */
let _lsData = null;          // fn_ls_trang_thai
let _lsTier = null;          // 'yt' | 'flv' | 'card'
let _lsYtPlayer = null, _lsYtApiLoading = false;
let _lsMpegtsPlayer = null;
let _lsPlaying = false;      // player đang phát thật
let _lsSecBuf = 0;           // giây chưa flush
let _lsTickIv = null, _lsFlushIv = null, _lsRefreshIv = null;
let _lsLastTouch = 0, _lsAttnDeadline = 0, _lsAttnPaused = false;
let _lsMuted = true;

function _lsPageActive() {
  var p = document.getElementById('page-livestream');
  return !!(p && p.classList.contains('active'));
}
function _lsAttnDelayMs() { return (10 + Math.random() * 5) * 60000; }  // 10–15 phút

/* ════════════════ VÀO TRANG ════════════════ */
function lsInitPage() {
  var root = document.getElementById('ls-root');
  if (!root) return;
  if (!_lsOn()) {
    root.innerHTML = '<div class="ls-empty">Phân hệ Livestream chưa được bật.</div>';
    return;
  }
  root.innerHTML = '<div class="ls-empty">⏳ Đang tải...</div>';
  _lsTeardownTimers();
  taiLivestream(true);
  // Làm mới trạng thái (mắt xem/tiêu đề/đang live) mỗi 60s khi còn ở trang
  _lsRefreshIv = setInterval(function () {
    if (!_lsPageActive()) { _lsTeardownAll(); return; }
    taiLivestream(false);
  }, 60000);
  // Đồng hồ đếm giây + kiểm tra chú ý
  _lsLastTouch = Date.now();
  _lsAttnDeadline = Date.now() + _lsAttnDelayMs();
  _lsTickIv = setInterval(_lsTick1s, 1000);
  _lsFlushIv = setInterval(_lsFlush, 30000);
}

async function taiLivestream(renderFull) {
  try {
    var res = await supa.rpc('fn_ls_trang_thai', { p_ma_nv: SESSION.ma });
    if (res.error) throw res.error;
    _lsData = res.data || {};
    if (renderFull) { _lsRender(); _lsChonPlayer(); }
    else _lsCapNhatNhe();
  } catch (e) {
    var root = document.getElementById('ls-root');
    if (root && renderFull) {
      root.innerHTML = '<div class="ls-empty">Chưa sẵn sàng — cần chạy SQL v18.57_livestream.sql.<br>' +
        '<span style="font-size:11px;color:#94A3B8">' + escHtml((e && e.message) || '') + '</span></div>';
    }
  }
}

/* ════════════════ RENDER ════════════════ */
function _lsRender() {
  var root = document.getElementById('ls-root');
  if (!root || !_lsData) return;
  var live = _lsData.live || {};
  var toi = _lsData.toi || {};
  var cfg = _lsData.cau_hinh || {};
  var isLive = !!live.is_live && !live.cu;
  var laQL = SESSION && (SESSION.vaiTro === 'ADMIN' || SESSION.vaiTro === 'QLNS');
  var laCH = typeof _laCuaHang === 'function' && _laCuaHang();

  root.innerHTML =
    '<div class="ls-hero' + (isLive ? ' live' : '') + '">' +
      '<div class="ls-hero-top">' +
        '<span class="ls-badge' + (isLive ? ' on' : '') + '">' + (isLive ? '<span class="ls-dot"></span>ĐANG LIVE' : 'CHƯA PHÁT') + '</span>' +
        '<span class="ls-viewers" id="ls-viewers">' + (isLive && live.viewers != null ? ('👁 ' + Number(live.viewers).toLocaleString('vi-VN') + ' đang xem TikTok') : '') + '</span>' +
      '</div>' +
      '<div class="ls-title" id="ls-title">' + escHtml(live.title || 'Livestream Nón Sơn') + '</div>' +
    '</div>' +

    '<div class="ls-player-wrap" id="ls-player-wrap">' +
      '<div id="ls-player"></div>' +
      '<div class="ls-attn" id="ls-attn" style="display:none">' +
        '<div class="ls-attn-box"><div>Bạn còn đang xem?</div>' +
        '<button class="ls-attn-btn" onclick="lsAttnResume()">Chạm để tiếp tục xem</button></div>' +
      '</div>' +
    '</div>' +
    '<div class="ls-player-bar" id="ls-player-bar"></div>' +

    '<div class="ls-me card">' +
      '<div class="ls-me-row">' +
        '<div class="ls-me-kpi"><div class="ls-me-num" id="ls-me-phut">' + _lsFmtPhut(toi.giay_xem || 0) + '</div><div class="ls-me-lbl">đã xem hôm nay</div></div>' +
        '<div class="ls-me-kpi"><div class="ls-me-num">' + (cfg.dinh_muc_phut || 15) + 'p</div><div class="ls-me-lbl">định mức ngày</div></div>' +
        '<div class="ls-me-kpi"><div class="ls-me-num" id="ls-me-dat">' + (toi.dat ? '✓' : '…') + '</div><div class="ls-me-lbl" id="ls-me-dat-lbl">' + (toi.dat ? 'ĐÃ ĐẠT' : 'chưa đạt') + '</div></div>' +
      '</div>' +
      '<div class="ls-progress"><div class="ls-progress-fill" id="ls-progress-fill"></div></div>' +
      (toi.khung ? ('<div class="ls-khung">🕐 Khung trực xem của bạn hôm nay: <b>' + escHtml(toi.khung.tu) + ' – ' + escHtml(toi.khung.den) + '</b></div>') : '') +
    '</div>' +

    '<button class="ls-tiktok-btn" onclick="lsMoTikTok()">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>' +
      'Mở TikTok để tương tác (tim · bình luận · mua)' +
    '</button>' +

    ((laQL || laCH) ? ('<div class="ls-dash card" id="ls-dash"><div class="ls-dash-head">' +
      '<b>' + (laCH ? 'Cửa hàng của bạn hôm nay' : 'Toàn hệ thống hôm nay') + '</b>' +
      '<span>' + (laQL ? '<button class="ls-mini-btn" onclick="lsChiaKhung()">⚡ Chia khung hôm nay</button>' : '') +
      '<button class="ls-mini-btn" onclick="lsTaiDash()">↻</button></span>' +
      '</div><div id="ls-dash-body" class="ls-dash-body">⏳</div></div>') : '');

  _lsCapNhatTienDo(toi.giay_xem || 0, cfg.dinh_muc_phut || 15);
  if (laQL || laCH) lsTaiDash();

  // theo dõi tương tác để reset đồng hồ "chạm xác nhận"
  ['click', 'touchstart', 'scroll'].forEach(function (ev) {
    root.addEventListener(ev, _lsTouched, { passive: true });
  });
}

function _lsCapNhatNhe() {
  if (!_lsData) return;
  var live = _lsData.live || {};
  var isLive = !!live.is_live && !live.cu;
  var v = document.getElementById('ls-viewers');
  if (v) v.textContent = isLive && live.viewers != null ? ('👁 ' + Number(live.viewers).toLocaleString('vi-VN') + ' đang xem TikTok') : '';
  var t = document.getElementById('ls-title');
  if (t && live.title) t.textContent = live.title;
  // live vừa bật/tắt → chọn lại player
  var needTier = _lsTinhTier();
  if (needTier !== _lsTier) _lsChonPlayer();
}

function _lsFmtPhut(giay) {
  var p = Math.floor((giay || 0) / 60);
  return p + 'p' + (p < 1 ? (Math.floor(giay % 60) + 's') : '');
}
function _lsCapNhatTienDo(giay, mucPhut) {
  var f = document.getElementById('ls-progress-fill');
  if (f) f.style.width = Math.min(100, Math.round(giay / (mucPhut * 60) * 100)) + '%';
  var el = document.getElementById('ls-me-phut');
  if (el) el.textContent = _lsFmtPhut(giay);
  var dat = giay >= mucPhut * 60;
  var d1 = document.getElementById('ls-me-dat'), d2 = document.getElementById('ls-me-dat-lbl');
  if (d1) d1.textContent = dat ? '✓' : '…';
  if (d2) d2.textContent = dat ? 'ĐÃ ĐẠT' : 'chưa đạt';
}

/* ════════════════ PLAYER 3 TẦNG ════════════════ */
function _lsTinhTier() {
  var live = _lsData && _lsData.live || {};
  var cfg = _lsData && _lsData.cau_hinh || {};
  var isLive = !!live.is_live && !live.cu;
  if (cfg.yt_channel_id) return 'yt';                          // B: mọi máy (kể cả chưa live — player tự chờ)
  if (isLive && live.flv_url && _lsMseOk()) return 'flv';      // A: máy có MSE
  return 'card';                                               // C
}
function _lsMseOk() {
  try {
    return !!(window.MediaSource || window.ManagedMediaSource);
  } catch (e) { return false; }
}

function _lsChonPlayer() {
  _lsHuyPlayer();
  _lsTier = _lsTinhTier();
  var holder = document.getElementById('ls-player');
  if (!holder) return;
  if (_lsTier === 'yt') _lsBatYT(holder);
  else if (_lsTier === 'flv') _lsBatFLV(holder);
  else _lsBatCard(holder);
}

function _lsHuyPlayer() {
  _lsPlaying = false;
  try { if (_lsYtPlayer && _lsYtPlayer.destroy) _lsYtPlayer.destroy(); } catch (e) {}
  _lsYtPlayer = null;
  try { if (_lsMpegtsPlayer) { _lsMpegtsPlayer.pause(); _lsMpegtsPlayer.unload(); _lsMpegtsPlayer.detachMediaElement(); _lsMpegtsPlayer.destroy(); } } catch (e) {}
  _lsMpegtsPlayer = null;
  var bar = document.getElementById('ls-player-bar');
  if (bar) bar.innerHTML = '';
}

/* ── Tầng B: YouTube đồng phát ── */
function _lsBatYT(holder) {
  var ch = (_lsData.cau_hinh || {}).yt_channel_id;
  // iframe "live_stream?channel=" = nhúng LIVE ĐANG CHẠY của kênh (không cần dán id từng buổi),
  // + enablejsapi → wrap bằng YT.Player để nghe trạng thái phát (đo giây chuẩn)
  holder.innerHTML = '<iframe id="ls-yt-frame" src="https://www.youtube.com/embed/live_stream?channel=' +
    encodeURIComponent(ch) + '&autoplay=1&mute=1&playsinline=1&enablejsapi=1&rel=0" ' +
    'allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen frameborder="0"></iframe>';
  _lsNapYTApi(function () {
    try {
      _lsYtPlayer = new YT.Player('ls-yt-frame', {
        events: { onStateChange: function (ev) { _lsPlaying = (ev.data === YT.PlayerState.PLAYING); } }
      });
    } catch (e) {}
  });
  var bar = document.getElementById('ls-player-bar');
  if (bar) bar.innerHTML = '<button class="ls-mini-btn" onclick="lsBatTieng()">🔊 Bật tiếng</button>' +
    '<span class="ls-src-note">Nguồn: kênh đồng phát công ty</span>';
}
function _lsNapYTApi(cb) {
  if (window.YT && window.YT.Player) { cb(); return; }
  window._lsYtCbs = window._lsYtCbs || [];
  window._lsYtCbs.push(cb);
  if (_lsYtApiLoading) return;
  _lsYtApiLoading = true;
  window.onYouTubeIframeAPIReady = function () {
    (window._lsYtCbs || []).forEach(function (f) { try { f(); } catch (e) {} });
    window._lsYtCbs = [];
  };
  var s = document.createElement('script');
  s.src = 'https://www.youtube.com/iframe_api';
  s.onerror = function () { _lsYtApiLoading = false; };
  document.head.appendChild(s);
}
function lsBatTieng() {
  _lsMuted = false;
  try { if (_lsYtPlayer && _lsYtPlayer.unMute) { _lsYtPlayer.unMute(); _lsYtPlayer.setVolume(100); } } catch (e) {}
  var vid = document.getElementById('ls-flv-video');
  if (vid) { vid.muted = false; vid.volume = 1; }
  _lsTouched();
}

/* ── Tầng A: FLV TikTok qua mpegts.js (self-host) ── */
function _lsBatFLV(holder) {
  var live = _lsData.live || {};
  holder.innerHTML = '<video id="ls-flv-video" muted playsinline webkit-playsinline autoplay></video>';
  var video = document.getElementById('ls-flv-video');
  var run = function () {
    try {
      if (!window.mpegts || !mpegts.isSupported()) { _lsTier = 'card'; _lsBatCard(holder); return; }
      _lsMpegtsPlayer = mpegts.createPlayer(
        { type: 'flv', isLive: true, url: live.flv_url },
        { enableWorker: false, liveBufferLatencyChasing: true, autoCleanupSourceBuffer: true });
      _lsMpegtsPlayer.attachMediaElement(video);
      _lsMpegtsPlayer.load();
      var p = _lsMpegtsPlayer.play();
      if (p && p.catch) p.catch(function () {});
      video.addEventListener('playing', function () { _lsPlaying = true; });
      video.addEventListener('pause', function () { _lsPlaying = false; });
      video.addEventListener('waiting', function () { _lsPlaying = false; });
      _lsMpegtsPlayer.on(mpegts.Events.ERROR, function () {
        // luồng đứt / CDN chặn → rơi về thẻ C, KHÔNG trắng màn
        _lsHuyPlayer(); _lsTier = 'card'; _lsBatCard(holder);
      });
    } catch (e) { _lsTier = 'card'; _lsBatCard(holder); }
  };
  if (window.mpegts) run();
  else {
    var s = document.createElement('script');
    s.src = 'js/vendor/mpegts.min.js?v=18.57';
    s.onload = run;
    s.onerror = function () { _lsTier = 'card'; _lsBatCard(holder); };
    document.head.appendChild(s);
  }
  var bar = document.getElementById('ls-player-bar');
  if (bar) bar.innerHTML = '<button class="ls-mini-btn" onclick="lsBatTieng()">🔊 Bật tiếng</button>' +
    '<span class="ls-src-note">Nguồn: luồng TikTok trực tiếp</span>';
}

/* ── Tầng C: thẻ trạng thái (luôn chạy được) ── */
function _lsBatCard(holder) {
  var live = _lsData.live || {};
  var isLive = !!live.is_live && !live.cu;
  _lsPlaying = false;
  holder.innerHTML =
    '<div class="ls-card-c" onclick="lsMoTikTok()">' +
      (live.cover_url ? ('<img class="ls-card-cover" src="' + escHtml(live.cover_url) + '" alt="">') : '<div class="ls-card-cover ph"></div>') +
      '<div class="ls-card-overlay">' +
        (isLive
          ? '<div class="ls-card-live"><span class="ls-dot"></span> ĐANG LIVE — chạm để xem trên TikTok</div>'
          : '<div class="ls-card-off">Hiện chưa phát sóng' + (live.cu ? ' (mất kết nối trạng thái)' : '') + '</div>') +
      '</div>' +
    '</div>';
  var bar = document.getElementById('ls-player-bar');
  if (bar) bar.innerHTML = '<span class="ls-src-note">' +
    (isLive ? 'Máy này xem trực tiếp qua TikTok — phút xem trong app tính khi kênh đồng phát được bật'
            : 'Khi phát sóng, thẻ này sẽ tự sáng ĐANG LIVE') + '</span>';
}

/* ════════════════ ĐO GIÂY XEM ════════════════ */
function _lsTick1s() {
  if (!_lsPageActive()) { _lsTeardownAll(); return; }
  // kiểm tra "chạm để tiếp tục"
  if (!_lsAttnPaused && _lsPlaying && Date.now() > _lsAttnDeadline) {
    _lsAttnPaused = true;
    var a = document.getElementById('ls-attn');
    if (a) a.style.display = 'flex';
  }
  if (_lsPlaying && !_lsAttnPaused && document.visibilityState === 'visible') {
    _lsSecBuf++;
    // cập nhật UI mượt (không chờ server)
    if (_lsData && _lsData.toi) {
      _lsData.toi.giay_xem = (_lsData.toi.giay_xem || 0) + 1;
      _lsCapNhatTienDo(_lsData.toi.giay_xem, (_lsData.cau_hinh || {}).dinh_muc_phut || 15);
    }
  }
}
function _lsTouched() {
  _lsLastTouch = Date.now();
  if (!_lsAttnPaused) _lsAttnDeadline = Date.now() + _lsAttnDelayMs();
}
function lsAttnResume() {
  _lsAttnPaused = false;
  _lsAttnDeadline = Date.now() + _lsAttnDelayMs();
  var a = document.getElementById('ls-attn');
  if (a) a.style.display = 'none';
}
async function _lsFlush() {
  if (_lsSecBuf < 5) return;
  var giay = Math.min(_lsSecBuf, 45);
  _lsSecBuf = 0;
  try {
    var res = await supa.rpc('fn_ls_heartbeat', { p_ma_nv: SESSION.ma, p_giay: giay, p_nguon: _lsTier });
    if (res.data && res.data.ok && _lsData && _lsData.toi) {
      _lsData.toi.giay_xem = res.data.giay_xem;   // đồng bộ số server (chống lệch)
      _lsCapNhatTienDo(res.data.giay_xem, res.data.dinh_muc_phut || 15);
    }
  } catch (e) {}
}
function _lsTeardownTimers() {
  [_lsTickIv, _lsFlushIv, _lsRefreshIv].forEach(function (iv) { if (iv) clearInterval(iv); });
  _lsTickIv = _lsFlushIv = _lsRefreshIv = null;
}
function _lsTeardownAll() {
  _lsFlush();
  _lsTeardownTimers();
  _lsHuyPlayer();
}
window.addEventListener('pagehide', function () { try { _lsFlush(); } catch (e) {} });

/* ════════════════ HÀNH ĐỘNG ════════════════ */
function lsMoTikTok() {
  var url = ((_lsData || {}).cau_hinh || {}).tiktok_url || 'https://www.tiktok.com/@thoitrangnonson/live';
  try { supa.rpc('fn_ls_click_tiktok', { p_ma_nv: SESSION.ma }); } catch (e) {}
  window.open(url, '_blank');
}

/* ════════════════ DASHBOARD (ADMIN/QLNS + Cửa hàng mini) ════════════════ */
async function lsTaiDash() {
  var body = document.getElementById('ls-dash-body');
  if (!body) return;
  body.innerHTML = '⏳';
  var laCH = typeof _laCuaHang === 'function' && _laCuaHang();
  try {
    var res = await supa.rpc('fn_ls_dashboard', { p_ma_ch: laCH ? (SESSION.cuaHangMa || null) : null });
    if (res.error) throw res.error;
    var d = res.data || {};
    var tq = d.tong_quan || {};
    var html =
      '<div class="ls-dash-kpis">' +
        '<div><b>' + (tq.so_nv_xem || 0) + '</b><span>NV đã xem</span></div>' +
        '<div><b>' + (tq.so_dat || 0) + '</b><span>đạt định mức</span></div>' +
        '<div><b>' + Number(tq.tong_phut || 0).toLocaleString('vi-VN') + '</b><span>tổng phút</span></div>' +
        '<div><b>' + (tq.tong_tiktok || 0) + '</b><span>lượt qua TikTok</span></div>' +
      '</div>';
    if (!laCH) {
      var chs = d.theo_ch || [];
      html += '<table class="ls-tbl"><thead><tr><th>Cửa hàng</th><th>NV xem</th><th>Đạt</th><th>Phút</th></tr></thead><tbody>';
      chs.slice(0, 30).forEach(function (c) {
        html += '<tr><td class="ls-td-ch">' + escHtml(c.ten_ch || c.ma_ch || '—') + '</td><td>' + (c.so_nv_xem || 0) + '</td><td>' + (c.so_dat || 0) + '</td><td>' + (c.tong_phut || 0) + '</td></tr>';
      });
      html += '</tbody></table>';
      if (!chs.length) html += '<div class="ls-empty-sm">Hôm nay chưa có lượt xem nào.</div>';
    } else {
      var nvs = d.ds_nv || [];
      html += '<table class="ls-tbl"><thead><tr><th>Nhân viên</th><th>Phút</th><th>TikTok</th><th>Đạt</th></tr></thead><tbody>';
      nvs.forEach(function (n) {
        html += '<tr><td class="ls-td-ch">' + escHtml(n.ten_nv || n.ma_nv) + '</td><td>' + Math.round((n.giay_xem || 0) / 60) + '</td><td>' + (n.lan_tiktok || 0) + '</td><td>' + (n.dat ? '✓' : '—') + '</td></tr>';
      });
      html += '</tbody></table>';
      if (!nvs.length) html += '<div class="ls-empty-sm">Cửa hàng chưa có lượt xem hôm nay.</div>';
    }
    body.innerHTML = html;
  } catch (e) {
    body.innerHTML = '<div class="ls-empty-sm">Lỗi tải: ' + escHtml((e && e.message) || '') + '</div>';
  }
}

async function lsChiaKhung() {
  if (!window.confirm('Chia lại khung trực xem HÔM NAY theo lịch ca?\n(Khung cũ hôm nay sẽ được xếp lại)')) return;
  try {
    var res = await supa.rpc('fn_ls_chia_khung', {});
    if (res.error) throw res.error;
    if (typeof showToast === 'function') showToast('✓ Đã chia ' + ((res.data || {}).so_khung || 0) + ' khung trực xem', 'ok');
    taiLivestream(true);
  } catch (e) {
    if (typeof showToast === 'function') showToast('Lỗi: ' + ((e && e.message) || ''), 'err');
  }
}

/* Globals */
window.lsInitPage = lsInitPage;
window.lsMoTikTok = lsMoTikTok;
window.lsBatTieng = lsBatTieng;
window.lsAttnResume = lsAttnResume;
window.lsTaiDash = lsTaiDash;
window.lsChiaKhung = lsChiaKhung;
