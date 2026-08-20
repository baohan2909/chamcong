/* ════════════════════════════════════════════════════════════════════════════
 *  Nón Sơn — PHÂN HỆ LIVESTREAM v2 (19/08/2026) · ĐA KÊNH + KPI LƯỢT TIKTOK
 *
 *  QUY ĐỊNH (Aroma): mỗi NV mỗi ngày vào phiên live ≥10 LƯỢT, mỗi lượt ≥5 PHÚT,
 *  tối thiểu 1 lượt có PHẢN HỒI (ưu/khuyết điểm/cải thiện, kèm ảnh nếu cần).
 *  2 kênh (Nón vải ưu tiên trên + Mũ bảo hiểm) — lượt/phút TÍNH CHUNG.
 *
 *  CƠ CHẾ ĐO LƯỢT TIKTOK (đi-về, chống lách, không cần host làm gì):
 *   bấm "VÀO TIKTOK" → app ghi mốc BẮT ĐẦU (fn_ls_tiktok_batdau) → nhảy TikTok
 *   → quay lại app → app chốt phiên (fn_ls_tiktok_ketthuc): phút = server tính,
 *   ≥5' = 1 lượt hợp lệ; KHÔNG quay lại app = KHÔNG tính; >90' = phiên treo bỏ;
 *   phút/phiên cap 60. Kết quả hiện ngay + mời gửi phản hồi nếu hôm nay chưa có.
 *
 *  XEM TRONG APP (đo giây thật như v1) vẫn chạy — là kênh "xem-giám sát";
 *  mắt xem/bình luận TikTok chỉ tăng khi NV thật sự ở TikTok → nút to đẩy sang.
 *
 *  Gate: app_settings ls.bat = off | ns00490 | all.
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
let _lsData = null;
let _lsKenh = null;                 // slug kênh đang chọn
let _lsTier = null;
let _lsMpegtsPlayer = null;
let _lsPlaying = false;
let _lsSecBuf = 0;
let _lsTickIv = null, _lsFlushIv = null, _lsRefreshIv = null;
let _lsLastTouch = 0, _lsAttnDeadline = 0, _lsAttnPaused = false;
let _lsInviteShown = false;         // bảng mời vào TikTok: 1 lần/lượt mở trang
let _lsPhLoai = 'UU_DIEM';
let _lsPhAnh = null;                // {blob, dataUrl}
let _lsDangChot = false;
let _lsKenhDirty = false;           // admin vừa đổi kênh → refresh tab khi đóng panel
let _lsChoSettings = false;         // [v18.61] đang chờ app_settings về để quyết định gate

function _lsPageActive() {
  var p = document.getElementById('page-livestream');
  return !!(p && p.classList.contains('active'));
}
function _lsAttnDelayMs() { return (10 + Math.random() * 5) * 60000; }
function _lsGetKenh(slug) {
  var arr = (_lsData && _lsData.kenhs) || [];
  for (var i = 0; i < arr.length; i++) if (arr[i].kenh === slug) return arr[i];
  return arr[0] || null;
}
function _lsPhienFlag(v) {
  try {
    if (v === undefined) return sessionStorage.getItem('ls_phien_mo') === '1';
    if (v) sessionStorage.setItem('ls_phien_mo', '1');
    else sessionStorage.removeItem('ls_phien_mo');
  } catch (e) {}
  return v;
}

/* ════════════════ VÀO TRANG ════════════════ */
function lsInitPage() {
  var root = document.getElementById('ls-root');
  if (!root) return;
  if (!_lsOn()) {
    // [v18.61 — FIX "trang lúc hiển thị lúc không"] Cold start: app_settings có thể CHƯA về
    //   → ĐỪNG vội kết luận "chưa được bật". Hiện Đang tải + chờ _settingsReady (resolve cả khi
    //   RPC lỗi) rồi chạy lại 1 lần; lúc đó vẫn off thật → mới báo "chưa được bật".
    if (!window._settingsLoaded && window._settingsReady) {
      root.innerHTML = '<div class="ls-empty">⏳ Đang tải...</div>';
      if (!_lsChoSettings) {
        _lsChoSettings = true;
        window._settingsReady.then(function () {
          _lsChoSettings = false;
          if (_lsPageActive()) lsInitPage();
        });
      }
      return;
    }
    root.innerHTML = '<div class="ls-empty">Phân hệ Livestream chưa được bật.</div>';
    return;
  }
  root.innerHTML = '<div class="ls-empty">⏳ Đang tải...</div>';
  _lsTeardownTimers();
  _lsInviteShown = false;
  taiLivestream(true);
  _lsRefreshIv = setInterval(function () {
    if (!_lsPageActive()) { _lsTeardownAll(); return; }
    taiLivestream(false);
  }, 60000);
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
    if (!_lsKenh || !_lsGetKenh(_lsKenh)) {
      var ks = _lsData.kenhs || [];
      _lsKenh = ks.length ? ks[0].kenh : null;   // mặc định kênh thứ tự 1 (Nón vải)
    }
    if (renderFull) {
      _lsRender();
      _lsChonPlayer();
      // App bị đóng giữa chừng khi đang ở TikTok → server còn phiên mở → chốt luôn
      if ((_lsData.toi || {}).phien_mo) { _lsPhienFlag(true); _lsChotPhien(true); }
      else _lsMoiVaoTikTok();   // bảng mời khéo (1 lần/lượt mở trang)
    } else {
      _lsCapNhatNhe();
    }
  } catch (e) {
    var root = document.getElementById('ls-root');
    if (root && renderFull) {
      root.innerHTML = '<div class="ls-empty">Chưa sẵn sàng — cần chạy SQL v18.58_livestream_v2.sql.<br>' +
        '<span style="font-size:11px;color:#94A3B8">' + escHtml((e && e.message) || '') + '</span></div>';
    }
  }
}

/* ════════════════ RENDER ════════════════ */
function _lsRender() {
  var root = document.getElementById('ls-root');
  if (!root || !_lsData) return;
  var kenhs = _lsData.kenhs || [];
  var k = _lsGetKenh(_lsKenh) || {};
  var toi = _lsData.toi || {};
  var cfg = _lsData.cau_hinh || {};
  var isLive = !!k.is_live && !k.cu;
  var laQL = SESSION && (SESSION.vaiTro === 'ADMIN' || SESSION.vaiTro === 'QLNS');
  var laCH = typeof _laCuaHang === 'function' && _laCuaHang();
  var laAdmin = SESSION && SESSION.vaiTro === 'ADMIN';
  var soLan = cfg.so_lan_ngay || 10;

  var tabsHtml = kenhs.map(function (x) {
    var on = x.kenh === _lsKenh;
    var liveDot = (x.is_live && !x.cu) ? '<span class="ls-dot-mini"></span>' : '';
    return '<button class="ls-tab' + (on ? ' on' : '') + '" onclick="lsChonKenh(\'' + x.kenh + '\')">' + liveDot + escHtml(x.ten) + '</button>';
  }).join('');

  root.innerHTML =
    '<div class="ls-tabs">' + tabsHtml + '</div>' +

    '<div class="ls-hero' + (isLive ? ' live' : '') + '">' +
      '<div class="ls-hero-top">' +
        '<span class="ls-badge' + (isLive ? ' on' : '') + '">' + (isLive ? '<span class="ls-dot"></span>ĐANG LIVE' : 'CHƯA PHÁT') + '</span>' +
        '<span class="ls-viewers" id="ls-viewers">' + (isLive && k.viewers != null ? ('👁 ' + Number(k.viewers).toLocaleString('vi-VN')) : '') + '</span>' +
      '</div>' +
      '<div class="ls-title" id="ls-title">' + escHtml(k.title || k.ten || 'Livestream Nón Sơn') + '</div>' +
    '</div>' +

    '<div class="ls-player-wrap" id="ls-player-wrap">' +
      '<div id="ls-player"></div>' +
      '<div class="ls-attn" id="ls-attn" style="display:none">' +
        '<div class="ls-attn-box"><div>Bạn còn đang xem?</div>' +
        '<button class="ls-attn-btn" onclick="lsAttnResume()">Chạm để tiếp tục xem</button></div>' +
      '</div>' +
    '</div>' +
    '<div class="ls-player-bar" id="ls-player-bar"></div>' +

    // NÚT TIKTOK LỚN — đưa LÊN TRÊN thẻ thời gian (Aroma), bỏ chữ trong ngoặc
    '<button class="ls-tiktok-big" onclick="lsMoTikTok()">' +
      '<span class="ls-tt-ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg></span>' +
      '<span class="ls-tt-txt"><b>VÀO PHIÊN LIVE TIKTOK</b>' +
      '<small id="ls-tt-sub">Lượt hôm nay ' + (toi.luot_hop_le || 0) + '/' + soLan + ' · mỗi lượt từ ' + (cfg.phut_toi_thieu || 5) + ' phút</small></span>' +
    '</button>' +

    '<div class="ls-me card">' +
      '<div class="ls-me-row">' +
        '<div class="ls-me-kpi"><div class="ls-me-num" id="ls-me-luot">' + (toi.luot_hop_le || 0) + '<span class="ls-me-of">/' + soLan + '</span></div><div class="ls-me-lbl">lượt hôm nay</div></div>' +
        '<div class="ls-me-kpi"><div class="ls-me-num" id="ls-me-phut-tt">' + Math.round(toi.phut_tiktok || 0) + 'p</div><div class="ls-me-lbl">phút TikTok</div></div>' +
        '<div class="ls-me-kpi"><div class="ls-me-num" id="ls-me-ph">' + ((toi.phan_hoi || 0) > 0 ? '✓' : '—') + '</div><div class="ls-me-lbl">phản hồi ngày</div></div>' +
      '</div>' +
      '<div class="ls-progress"><div class="ls-progress-fill" id="ls-progress-fill"></div></div>' +
      '<div class="ls-sub-line" id="ls-sub-line">Xem trong app: ' + _lsFmtPhut(toi.giay_xem || 0) +
        (toi.khung ? (' · Khung trực: <b>' + escHtml(toi.khung.tu) + '–' + escHtml(toi.khung.den) + '</b>') : '') + '</div>' +
    '</div>' +

    '<button class="ls-ph-btn" onclick="lsMoPhanHoi()">📝 Gửi phản hồi phiên live <span class="ls-ph-req">(bắt buộc ≥1 lần/ngày)</span></button>' +

    ((laQL || laCH) ? ('<div class="ls-dash card" id="ls-dash"><div class="ls-dash-head">' +
      '<b>' + (laCH ? 'Cửa hàng của bạn hôm nay' : 'Toàn hệ thống hôm nay') + '</b>' +
      '<span>' +
      (laAdmin ? '<button class="ls-mini-btn" onclick="lsOpenAdminKenh()">⚙ Kênh</button>' : '') +
      (laQL ? '<button class="ls-mini-btn" onclick="lsChiaKhung()">⚡ Chia khung</button>' : '') +
      '<button class="ls-mini-btn" onclick="lsTaiPhanHoiList()">💬 Phản hồi</button>' +
      '<button class="ls-mini-btn" onclick="lsTaiDash()">↻</button></span>' +
      '</div><div id="ls-dash-body" class="ls-dash-body">⏳</div>' +
      '<div id="ls-ph-list" style="display:none"></div></div>') : '');

  _lsCapNhatTienDo();
  if (laQL || laCH) lsTaiDash();
  ['click', 'touchstart', 'scroll'].forEach(function (ev) {
    root.addEventListener(ev, _lsTouched, { passive: true });
  });
}

function _lsCapNhatNhe() {
  if (!_lsData) return;
  var k = _lsGetKenh(_lsKenh) || {};
  var isLive = !!k.is_live && !k.cu;
  var v = document.getElementById('ls-viewers');
  if (v) v.textContent = isLive && k.viewers != null ? ('👁 ' + Number(k.viewers).toLocaleString('vi-VN')) : '';
  var t = document.getElementById('ls-title');
  if (t) t.textContent = k.title || k.ten || 'Livestream Nón Sơn';
  _lsCapNhatTienDo();
  if (_lsTinhTier() !== _lsTier) _lsChonPlayer();
}

function _lsFmtPhut(giay) {
  var p = Math.floor((giay || 0) / 60);
  return p >= 1 ? (p + 'p') : (Math.floor(giay || 0) + 's');
}
function _lsCapNhatTienDo() {
  var toi = (_lsData || {}).toi || {};
  var cfg = (_lsData || {}).cau_hinh || {};
  var soLan = cfg.so_lan_ngay || 10;
  var f = document.getElementById('ls-progress-fill');
  if (f) f.style.width = Math.min(100, Math.round((toi.luot_hop_le || 0) / soLan * 100)) + '%';
  var e1 = document.getElementById('ls-me-luot');
  if (e1) e1.innerHTML = (toi.luot_hop_le || 0) + '<span class="ls-me-of">/' + soLan + '</span>';
  var e2 = document.getElementById('ls-me-phut-tt');
  if (e2) e2.textContent = Math.round(toi.phut_tiktok || 0) + 'p';
  var e3 = document.getElementById('ls-me-ph');
  if (e3) e3.textContent = (toi.phan_hoi || 0) > 0 ? '✓' : '—';
  var sub = document.getElementById('ls-tt-sub');
  if (sub) sub.textContent = 'Lượt hôm nay ' + (toi.luot_hop_le || 0) + '/' + soLan + ' · mỗi lượt từ ' + (cfg.phut_toi_thieu || 5) + ' phút';
  var sl = document.getElementById('ls-sub-line');
  if (sl) sl.innerHTML = 'Xem trong app: ' + _lsFmtPhut(toi.giay_xem || 0) +
    (toi.khung ? (' · Khung trực: <b>' + escHtml(toi.khung.tu) + '–' + escHtml(toi.khung.den) + '</b>') : '');
}

function lsChonKenh(slug) {
  if (slug === _lsKenh) return;
  _lsKenh = slug;
  _lsHuyPlayer();
  _lsRender();
  _lsChonPlayer();
}

/* ════════════════ PLAYER (FLV trong app / thẻ C) ════════════════ */
function _lsTinhTier() {
  var k = _lsGetKenh(_lsKenh) || {};
  var isLive = !!k.is_live && !k.cu;
  if (isLive && k.flv_url && _lsMseOk()) return 'flv';
  return 'card';
}
function _lsMseOk() {
  try { return !!(window.MediaSource || window.ManagedMediaSource); } catch (e) { return false; }
}
function _lsChonPlayer() {
  _lsHuyPlayer();
  _lsTier = _lsTinhTier();
  var holder = document.getElementById('ls-player');
  if (!holder) return;
  if (_lsTier === 'flv') _lsBatFLV(holder);
  else _lsBatCard(holder);
}
function _lsHuyPlayer() {
  _lsPlaying = false;
  try { if (_lsMpegtsPlayer) { _lsMpegtsPlayer.pause(); _lsMpegtsPlayer.unload(); _lsMpegtsPlayer.detachMediaElement(); _lsMpegtsPlayer.destroy(); } } catch (e) {}
  _lsMpegtsPlayer = null;
  var bar = document.getElementById('ls-player-bar');
  if (bar) bar.innerHTML = '';
}

function _lsBatFLV(holder) {
  var k = _lsGetKenh(_lsKenh) || {};
  holder.innerHTML = '<video id="ls-flv-video" muted playsinline webkit-playsinline autoplay></video>';
  var video = document.getElementById('ls-flv-video');
  var run = function () {
    try {
      if (!window.mpegts || !mpegts.isSupported()) { _lsTier = 'card'; _lsBatCard(holder); return; }
      _lsMpegtsPlayer = mpegts.createPlayer(
        { type: 'flv', isLive: true, url: k.flv_url },
        { enableWorker: false, liveBufferLatencyChasing: true, autoCleanupSourceBuffer: true });
      _lsMpegtsPlayer.attachMediaElement(video);
      _lsMpegtsPlayer.load();
      var p = _lsMpegtsPlayer.play();
      if (p && p.catch) p.catch(function () {});
      video.addEventListener('playing', function () { _lsPlaying = true; });
      video.addEventListener('pause', function () { _lsPlaying = false; });
      video.addEventListener('waiting', function () { _lsPlaying = false; });
      _lsMpegtsPlayer.on(mpegts.Events.ERROR, function () {
        _lsHuyPlayer(); _lsTier = 'card'; _lsBatCard(holder);
      });
    } catch (e) { _lsTier = 'card'; _lsBatCard(holder); }
  };
  if (window.mpegts) run();
  else {
    var s = document.createElement('script');
    s.src = 'js/vendor/mpegts.min.js?v=18.58';
    s.onload = run;
    s.onerror = function () { _lsTier = 'card'; _lsBatCard(holder); };
    document.head.appendChild(s);
  }
  var bar = document.getElementById('ls-player-bar');
  if (bar) bar.innerHTML = '<button class="ls-mini-btn" onclick="lsBatTieng()">🔊 Bật tiếng</button>';
}
function lsBatTieng() {
  var vid = document.getElementById('ls-flv-video');
  if (vid) { vid.muted = false; vid.volume = 1; }
  _lsTouched();
}

function _lsBatCard(holder) {
  var k = _lsGetKenh(_lsKenh) || {};
  var isLive = !!k.is_live && !k.cu;
  _lsPlaying = false;
  holder.innerHTML =
    '<div class="ls-card-c" onclick="lsMoTikTok()">' +
      (k.cover_url ? ('<img class="ls-card-cover" src="' + escHtml(k.cover_url) + '" alt="">') : '<div class="ls-card-cover ph"></div>') +
      '<div class="ls-card-overlay">' +
        (isLive
          ? '<div class="ls-card-live"><span class="ls-dot"></span> ĐANG LIVE — chạm để vào TikTok</div>'
          : '<div class="ls-card-off">Hiện chưa phát sóng</div>') +
      '</div>' +
    '</div>';
}

/* ════════════════ LƯỢT TIKTOK: ĐI — VỀ ════════════════ */
function lsMoTikTok(slug) {
  var k = _lsGetKenh(slug || _lsKenh) || {};
  var url = k.tiktok_url || 'https://www.tiktok.com/@thoitrang.nonson/live';
  // Ghi mốc BẮT ĐẦU ngay (PostgrestBuilder lười — phải .then mới bắn request)
  try { Promise.resolve(supa.rpc('fn_ls_tiktok_batdau', { p_ma_nv: SESSION.ma, p_kenh: k.kenh || null })).catch(function () {}); } catch (e) {}
  _lsPhienFlag(true);
  _lsDongModal();
  // Mở TikTok ĐỒNG BỘ trong cử chỉ bấm (iOS chặn window.open sau await)
  window.open(url, '_blank');
}

// Quay lại app (mọi trang) → chốt phiên
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'visible' && _lsPhienFlag() && _lsOn()) {
    _lsChotPhien(_lsPageActive());
  }
});

async function _lsChotPhien(hienUI) {
  if (_lsDangChot) return;
  _lsDangChot = true;
  _lsPhienFlag(false);
  try {
    var res = await Promise.resolve(supa.rpc('fn_ls_tiktok_ketthuc', { p_ma_nv: SESSION.ma }));
    var d = res && res.data;
    if (d && d.ok) {
      if (_lsData && _lsData.toi) {
        _lsData.toi.luot_hop_le = d.luot_hop_le;
        _lsData.toi.phut_tiktok = (Number(_lsData.toi.phut_tiktok) || 0) + (Number(d.phut) || 0);
        _lsData.toi.phien_mo = null;
        _lsCapNhatTienDo();
      }
      if (hienUI) _lsHienKetQua(d);
    }
  } catch (e) {}
  _lsDangChot = false;
}

function _lsHienKetQua(d) {
  var cfg = (_lsData || {}).cau_hinh || {};
  var caption, cls;
  if (d.treo) { caption = 'Phiên quá lâu không quay lại — không tính lượt'; cls = 'err'; }
  else if (d.hop_le) { caption = 'HỢP LỆ — đã tính 1 lượt ✓'; cls = 'ok'; }
  else { caption = 'Chưa đủ ' + (d.phut_toi_thieu || cfg.phut_toi_thieu || 5) + ' phút — chưa tính lượt'; cls = 'warn'; }
  var canPh = (d.phan_hoi || 0) < 1;
  _lsModal(
    '<div class="ls-kq">' +
      '<div class="ls-kq-num">' + (Number(d.phut) || 0) + '<small> phút</small></div>' +
      '<div class="ls-kq-cap ' + cls + '">' + caption + '</div>' +
      '<div class="ls-kq-luot">Lượt hôm nay: <b>' + (d.luot_hop_le || 0) + '/' + (d.so_lan_ngay || 10) + '</b></div>' +
      (canPh ? '<div class="ls-kq-ph">Hôm nay bạn chưa gửi phản hồi nào (bắt buộc ≥1 lần/ngày)</div>' : '') +
    '</div>',
    canPh
      ? [{ txt: '📝 Gửi phản hồi ngay', cls: 'pri', fn: 'lsMoPhanHoi()' }, { txt: 'Để sau', cls: '', fn: '_lsDongModal()' }]
      : [{ txt: 'OK', cls: 'pri', fn: '_lsDongModal()' }]
  );
}

/* Bảng mời vào TikTok — khéo: chỉ 1 lần mỗi lượt mở trang, chỉ khi đang live + chưa đủ lượt */
function _lsMoiVaoTikTok() {
  if (_lsInviteShown || !_lsData) return;
  var toi = _lsData.toi || {};
  var cfg = _lsData.cau_hinh || {};
  if (toi.dat_luot) return;
  var liveKenh = null;
  (_lsData.kenhs || []).forEach(function (x) { if (!liveKenh && x.is_live && !x.cu) liveKenh = x; });
  if (!liveKenh) return;
  _lsInviteShown = true;
  _lsModal(
    '<div class="ls-moi">' +
      '<div class="ls-moi-live"><span class="ls-dot"></span> ' + escHtml(liveKenh.ten) + ' đang LIVE</div>' +
      '<div class="ls-moi-txt">Vào TikTok xem để được tính lượt<br><b>' + (toi.luot_hop_le || 0) + '/' + (cfg.so_lan_ngay || 10) + ' lượt hôm nay</b> · mỗi lượt từ ' + (cfg.phut_toi_thieu || 5) + ' phút</div>' +
    '</div>',
    [{ txt: '▶ Vào TikTok ngay', cls: 'pri', fn: 'lsMoTikTok(\'' + liveKenh.kenh + '\')' },
     { txt: 'Để sau', cls: '', fn: '_lsDongModal()' }]
  );
}

/* ════════════════ MODAL DÙNG CHUNG (BODY-LEVEL — sống sót khi trang vẽ lại) ════════════════ */
function _lsModalHolder() {
  var h = document.getElementById('ls-modal-holder');
  if (!h) { h = document.createElement('div'); h.id = 'ls-modal-holder'; document.body.appendChild(h); }
  return h;
}
function _lsModal(innerHtml, btns) {
  var holder = _lsModalHolder();
  holder.innerHTML =
    '<div class="ls-modal-ov" onclick="if(event.target===this)_lsDongModal()">' +
      '<div class="ls-modal-box">' + innerHtml +
        '<div class="ls-modal-btns">' +
          (btns || []).map(function (b) {
            return '<button class="ls-modal-btn ' + (b.cls || '') + '" onclick="' + b.fn + '">' + b.txt + '</button>';
          }).join('') +
        '</div>' +
      '</div>' +
    '</div>';
}
function _lsDongModal() {
  var holder = document.getElementById('ls-modal-holder');
  if (holder) holder.innerHTML = '';
  // Admin vừa đổi kênh/KPI → giờ mới refresh tab (không wipe modal lúc đang mở)
  if (_lsKenhDirty) { _lsKenhDirty = false; try { taiLivestream(true); } catch (e) {} }
}

/* ════════════════ PHẢN HỒI (ưu/khuyết/cải thiện + ảnh) ════════════════ */
function lsMoPhanHoi() {
  _lsPhLoai = 'UU_DIEM';
  _lsPhAnh = null;
  var chips = [
    ['UU_DIEM', 'Ưu điểm'], ['KHUYET_DIEM', 'Khuyết điểm'], ['CAI_THIEN', 'Cần cải thiện'], ['KHAC', 'Khác']
  ].map(function (c) {
    return '<button class="ls-chip' + (c[0] === _lsPhLoai ? ' on' : '') + '" data-loai="' + c[0] + '" onclick="lsPhChonLoai(this)">' + c[1] + '</button>';
  }).join('');
  _lsModal(
    '<div class="ls-ph-form">' +
      '<div class="ls-ph-title">📝 Phản hồi phiên live</div>' +
      '<div class="ls-chips" id="ls-ph-chips">' + chips + '</div>' +
      '<textarea id="ls-ph-text" rows="4" placeholder="Ví dụ: trưng sản phẩm quá ít, góc quay tối, nên giới thiệu thêm mẫu mới..."></textarea>' +
      '<div class="ls-ph-anh-row">' +
        '<label class="ls-ph-anh-btn">📷 Đính kèm ảnh màn hình' +
          '<input type="file" accept="image/*" style="display:none" onchange="lsPhChonAnh(this)"></label>' +
        '<span id="ls-ph-anh-ten" class="ls-ph-anh-ten"></span>' +
      '</div>' +
      '<img id="ls-ph-anh-preview" class="ls-ph-thumb" style="display:none">' +
      '<div id="ls-ph-loi" class="ls-ph-loi"></div>' +
    '</div>',
    [{ txt: 'Gửi phản hồi', cls: 'pri', fn: 'lsGuiPhanHoi()' }, { txt: 'Đóng', cls: '', fn: '_lsDongModal()' }]
  );
}
function lsPhChonLoai(btn) {
  _lsPhLoai = btn.getAttribute('data-loai') || 'KHAC';
  var chips = document.getElementById('ls-ph-chips');
  if (chips) chips.querySelectorAll('.ls-chip').forEach(function (c) {
    c.classList.toggle('on', c === btn);
  });
}
async function lsPhChonAnh(input) {
  var file = input.files && input.files[0];
  if (!file) return;
  if (file.size > 15 * 1024 * 1024) { _lsPhLoi('Ảnh quá lớn (>15MB)'); return; }
  try {
    if (typeof muanonCompressAnh === 'function') {
      _lsPhAnh = await muanonCompressAnh(file);   // {blob, dataUrl} — hàm nén sẵn có của app
    } else {
      _lsPhAnh = { blob: file, dataUrl: '' };
    }
    var ten = document.getElementById('ls-ph-anh-ten');
    if (ten) ten.textContent = '✓ đã chọn ảnh';
    var pv = document.getElementById('ls-ph-anh-preview');
    if (pv && _lsPhAnh.dataUrl) { pv.src = _lsPhAnh.dataUrl; pv.style.display = 'block'; }
    _lsPhLoi('');
  } catch (e) { _lsPhLoi('Không đọc được ảnh'); }
}
function _lsPhLoi(msg) {
  var el = document.getElementById('ls-ph-loi');
  if (el) el.textContent = msg || '';
}
async function lsGuiPhanHoi() {
  var ta = document.getElementById('ls-ph-text');
  var text = (ta && ta.value || '').trim();
  if (text.length < 5) { _lsPhLoi('Nội dung quá ngắn (tối thiểu 5 ký tự)'); return; }
  _lsPhLoi('Đang gửi...');
  var anhUrl = null;
  try {
    if (_lsPhAnh && _lsPhAnh.blob) {
      var d = new Date();
      var ngay = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      var path = SESSION.ma + '/' + ngay + '/' + Date.now() + '.jpg';
      var up = await supa.storage.from('ls-phan-hoi').upload(path, _lsPhAnh.blob, {
        contentType: 'image/jpeg', upsert: true, cacheControl: '3600'
      });
      if (up.error) throw up.error;
      var pu = supa.storage.from('ls-phan-hoi').getPublicUrl(path);
      anhUrl = pu && pu.data ? pu.data.publicUrl : null;
    }
    var res = await Promise.resolve(supa.rpc('fn_ls_gui_phan_hoi', {
      p_ma_nv: SESSION.ma, p_loai: _lsPhLoai, p_noi_dung: text,
      p_kenh: _lsKenh || null, p_anh_url: anhUrl
    }));
    if (res.error) throw res.error;
    if (!res.data || !res.data.ok) throw new Error((res.data || {}).message || 'Gửi không thành công');
    if (_lsData && _lsData.toi) { _lsData.toi.phan_hoi = res.data.phan_hoi; _lsCapNhatTienDo(); }
    _lsModal('<div class="ls-kq"><div class="ls-kq-num">✓</div><div class="ls-kq-cap ok">Đã gửi phản hồi — cảm ơn bạn!</div></div>',
      [{ txt: 'Đóng', cls: 'pri', fn: '_lsDongModal()' }]);
  } catch (e) {
    _lsPhLoi('Lỗi: ' + ((e && e.message) || 'không gửi được'));
  }
}

/* ════════════════ ĐO GIÂY XEM TRONG APP (giữ như v1) ════════════════ */
function _lsTick1s() {
  if (!_lsPageActive()) { _lsTeardownAll(); return; }
  if (!_lsAttnPaused && _lsPlaying && Date.now() > _lsAttnDeadline) {
    _lsAttnPaused = true;
    var a = document.getElementById('ls-attn');
    if (a) a.style.display = 'flex';
  }
  if (_lsPlaying && !_lsAttnPaused && document.visibilityState === 'visible') {
    _lsSecBuf++;
    if (_lsData && _lsData.toi) {
      _lsData.toi.giay_xem = (_lsData.toi.giay_xem || 0) + 1;
      if (_lsSecBuf % 10 === 0) _lsCapNhatTienDo();
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
    var res = await Promise.resolve(supa.rpc('fn_ls_heartbeat', { p_ma_nv: SESSION.ma, p_giay: giay, p_nguon: _lsTier }));
    if (res.data && res.data.ok && _lsData && _lsData.toi) {
      _lsData.toi.giay_xem = res.data.giay_xem;
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

/* ════════════════ DASHBOARD + PHẢN HỒI LIST ════════════════ */
async function lsTaiDash() {
  var body = document.getElementById('ls-dash-body');
  if (!body) return;
  body.style.display = '';
  var ph = document.getElementById('ls-ph-list');
  if (ph) ph.style.display = 'none';
  body.innerHTML = '⏳';
  var laCH = typeof _laCuaHang === 'function' && _laCuaHang();
  try {
    var res = await supa.rpc('fn_ls_dashboard', { p_ma_ch: laCH ? (SESSION.cuaHangMa || null) : null });
    if (res.error) throw res.error;
    var d = res.data || {};
    var tq = d.tong_quan || {};
    var html =
      '<div class="ls-dash-kpis">' +
        '<div><b>' + (tq.so_nv_xem || 0) + '</b><span>NV tham gia</span></div>' +
        '<div><b>' + (tq.so_dat || 0) + '</b><span>đạt ' + (tq.so_lan_ngay || 10) + ' lượt</span></div>' +
        '<div><b>' + Number(tq.tong_luot || 0).toLocaleString('vi-VN') + '</b><span>tổng lượt</span></div>' +
        '<div><b>' + (tq.so_co_phan_hoi || 0) + '</b><span>có phản hồi</span></div>' +
      '</div>';
    if (!laCH) {
      var chs = d.theo_ch || [];
      html += '<table class="ls-tbl"><thead><tr><th>Cửa hàng</th><th>NV</th><th>Lượt</th><th>Đạt</th><th>PH</th></tr></thead><tbody>';
      chs.slice(0, 30).forEach(function (c) {
        html += '<tr><td class="ls-td-ch">' + escHtml(c.ten_ch || c.ma_ch || '—') + '</td><td>' + (c.so_nv_xem || 0) + '</td><td>' + (c.tong_luot || 0) + '</td><td>' + (c.so_dat || 0) + '</td><td>' + (c.so_co_phan_hoi || 0) + '</td></tr>';
      });
      html += '</tbody></table>';
      if (!chs.length) html += '<div class="ls-empty-sm">Hôm nay chưa có hoạt động.</div>';
    } else {
      var nvs = d.ds_nv || [];
      html += '<table class="ls-tbl"><thead><tr><th>Nhân viên</th><th>Lượt</th><th>Phút TT</th><th>PH</th><th>Đạt</th></tr></thead><tbody>';
      nvs.forEach(function (n) {
        html += '<tr><td class="ls-td-ch">' + escHtml(n.ten_nv || n.ma_nv) + '</td><td>' + (n.luot_hop_le || 0) + '</td><td>' + (n.phut_tiktok || 0) + '</td><td>' + (n.phan_hoi || 0) + '</td><td>' + (n.dat ? '✓' : '—') + '</td></tr>';
      });
      html += '</tbody></table>';
      if (!nvs.length) html += '<div class="ls-empty-sm">Cửa hàng chưa có hoạt động hôm nay.</div>';
    }
    body.innerHTML = html;
  } catch (e) {
    body.innerHTML = '<div class="ls-empty-sm">Lỗi tải: ' + escHtml((e && e.message) || '') + '</div>';
  }
}

async function lsTaiPhanHoiList() {
  var body = document.getElementById('ls-dash-body');
  var ph = document.getElementById('ls-ph-list');
  if (!ph) return;
  if (body) body.style.display = 'none';
  ph.style.display = '';
  ph.innerHTML = '⏳';
  var laCH = typeof _laCuaHang === 'function' && _laCuaHang();
  try {
    var res = await supa.rpc('fn_ls_phan_hoi_list', { p_ma_ch: laCH ? (SESSION.cuaHangMa || null) : null });
    if (res.error) throw res.error;
    var ds = (res.data || {}).ds || [];
    var LOAI = { UU_DIEM: ['Ưu điểm', 'ok'], KHUYET_DIEM: ['Khuyết điểm', 'err'], CAI_THIEN: ['Cải thiện', 'warn'], KHAC: ['Khác', ''] };
    var html = '<div class="ls-ph-head">💬 Phản hồi hôm nay (' + ds.length + ') <button class="ls-mini-btn" onclick="lsTaiDash()">← Bảng số</button></div>';
    ds.forEach(function (p) {
      var lo = LOAI[p.loai] || LOAI.KHAC;
      html += '<div class="ls-ph-item">' +
        '<div class="ls-ph-item-top"><b>' + escHtml(p.ten_nv || p.ma_nv) + '</b>' +
        '<span class="ls-ph-tag ' + lo[1] + '">' + lo[0] + '</span>' +
        '<span class="ls-ph-gio">' + escHtml(p.gio || '') + (p.ten_ch ? (' · ' + escHtml(p.ten_ch)) : '') + '</span></div>' +
        '<div class="ls-ph-nd">' + escHtml(p.noi_dung || '') + '</div>' +
        (p.anh_url ? ('<a href="' + escHtml(p.anh_url) + '" target="_blank"><img class="ls-ph-thumb" src="' + escHtml(p.anh_url) + '"></a>') : '') +
        '</div>';
    });
    if (!ds.length) html += '<div class="ls-empty-sm">Chưa có phản hồi nào hôm nay.</div>';
    ph.innerHTML = html;
  } catch (e) {
    ph.innerHTML = '<div class="ls-empty-sm">Lỗi tải phản hồi: ' + escHtml((e && e.message) || '') + '</div>';
  }
}

async function lsChiaKhung() {
  if (!window.confirm('Chia lại khung trực xem HÔM NAY theo lịch ca?')) return;
  try {
    var res = await supa.rpc('fn_ls_chia_khung', {});
    if (res.error) throw res.error;
    if (typeof showToast === 'function') showToast('✓ Đã chia ' + ((res.data || {}).so_khung || 0) + ' khung', 'ok');
    taiLivestream(true);
  } catch (e) {
    if (typeof showToast === 'function') showToast('Lỗi: ' + ((e && e.message) || ''), 'err');
  }
}

/* ════════════════ ADMIN: QUẢN LÝ KÊNH + KPI (thêm kênh không cần sửa code) ════════════════ */
async function lsOpenAdminKenh() {
  _lsModal('<div class="ls-adm"><div class="ls-adm-title">⚙ Quản lý kênh Livestream</div><div id="ls-adm-body">⏳ Đang tải...</div></div>',
    [{ txt: 'Đóng', cls: 'pri', fn: '_lsDongModal()' }]);
  _lsRenderAdminKenh();
}
async function _lsRenderAdminKenh() {
  var body = document.getElementById('ls-adm-body');
  if (!body) return;
  try {
    var res = await supa.rpc('fn_ls_admin_kenh_list', { p_ma_admin: SESSION.ma });
    if (res.error) throw res.error;
    if (!res.data || !res.data.ok) throw new Error((res.data || {}).message || 'Không có quyền');
    var ks = res.data.kenhs || [];
    var cfg = res.data.cau_hinh || {};
    var rows = ks.map(function (k) {
      var liveTag = (k.is_live && !k.cu) ? '<span class="ls-adm-live">● LIVE</span>' : '';
      return '<div class="ls-adm-row">' +
        '<div class="ls-adm-info"><b>' + escHtml(k.ten) + '</b> ' + liveTag +
          '<small>@' + escHtml(k.unique_id) + '</small></div>' +
        '<div class="ls-adm-act">' +
          '<button class="ls-adm-tg ' + (k.bat ? 'on' : '') + '" onclick="lsKenhToggle(\'' + k.kenh + '\',' + (!k.bat) + ')">' + (k.bat ? 'BẬT' : 'TẮT') + '</button>' +
          '<button class="ls-adm-x" onclick="lsKenhXoa(\'' + k.kenh + '\',\'' + escHtml(k.ten).replace(/'/g, "\\'") + '\')">🗑</button>' +
        '</div></div>';
    }).join('');
    body.innerHTML =
      '<div class="ls-adm-list">' + (rows || '<div class="ls-empty-sm">Chưa có kênh nào.</div>') + '</div>' +
      '<div class="ls-adm-add">' +
        '<div class="ls-adm-sub">➕ Thêm kênh mới</div>' +
        '<input id="ls-adm-ten" placeholder="Tên hiển thị (VD: Nón vải thời trang)">' +
        '<input id="ls-adm-link" placeholder="Link hoặc @tài_khoản TikTok">' +
        '<button class="ls-modal-btn pri" style="margin-top:8px" onclick="lsKenhThem()">Thêm kênh</button>' +
      '</div>' +
      '<div class="ls-adm-cfg">' +
        '<div class="ls-adm-sub">🎯 Quy định KPI</div>' +
        '<div class="ls-adm-cfg-row">' +
          '<label>Số lượt/ngày<input id="ls-adm-solan" type="number" min="1" max="100" value="' + (cfg.so_lan_ngay || 10) + '"></label>' +
          '<label>Phút tối thiểu/lượt<input id="ls-adm-phut" type="number" min="1" max="120" value="' + (cfg.phut_toi_thieu || 5) + '"></label>' +
        '</div>' +
        '<button class="ls-modal-btn" style="margin-top:8px" onclick="lsLuuConfig()">Lưu KPI</button>' +
      '</div>' +
      '<div id="ls-adm-msg" class="ls-ph-loi"></div>';
  } catch (e) {
    body.innerHTML = '<div class="ls-empty-sm">Lỗi: ' + escHtml((e && e.message) || '') + '</div>';
  }
}
function _lsAdmMsg(m, ok) {
  var el = document.getElementById('ls-adm-msg');
  if (el) { el.textContent = m || ''; el.style.color = ok ? '#148A5C' : '#C6373C'; }
}
async function lsKenhThem() {
  var ten = (document.getElementById('ls-adm-ten') || {}).value || '';
  var link = (document.getElementById('ls-adm-link') || {}).value || '';
  if (ten.trim().length < 2) { _lsAdmMsg('Nhập tên kênh'); return; }
  if (!link.trim()) { _lsAdmMsg('Nhập link/@tài khoản TikTok'); return; }
  _lsAdmMsg('Đang thêm...', true);
  try {
    var res = await supa.rpc('fn_ls_admin_kenh_upsert', {
      p_ma_admin: SESSION.ma, p_kenh: null, p_ten: ten.trim(), p_link_or_handle: link.trim(), p_bat: true
    });
    if (res.error) throw res.error;
    if (!res.data || !res.data.ok) throw new Error((res.data || {}).message || 'Lỗi');
    _lsAdmMsg('✓ Đã thêm @' + res.data.handle, true);
    _lsKenhDirty = true;   // refresh tab khi đóng panel (không wipe modal đang mở)
    _lsRenderAdminKenh();
  } catch (e) { _lsAdmMsg('Lỗi: ' + ((e && e.message) || '')); }
}
async function lsKenhToggle(kenh, bat) {
  try {
    var res = await supa.rpc('fn_ls_admin_kenh_bat', { p_ma_admin: SESSION.ma, p_kenh: kenh, p_bat: bat });
    if (res.error) throw res.error;
    _lsKenhDirty = true;
    _lsRenderAdminKenh();
  } catch (e) { _lsAdmMsg('Lỗi: ' + ((e && e.message) || '')); }
}
async function lsKenhXoa(kenh, ten) {
  if (!window.confirm('Xóa kênh "' + ten + '"?\n(Lịch sử phiên/phản hồi vẫn giữ)')) return;
  try {
    var res = await supa.rpc('fn_ls_admin_kenh_xoa', { p_ma_admin: SESSION.ma, p_kenh: kenh });
    if (res.error) throw res.error;
    if (_lsKenh === kenh) _lsKenh = null;
    _lsKenhDirty = true;
    _lsRenderAdminKenh();
  } catch (e) { _lsAdmMsg('Lỗi: ' + ((e && e.message) || '')); }
}
async function lsLuuConfig() {
  var soLan = parseInt((document.getElementById('ls-adm-solan') || {}).value, 10);
  var phut = parseInt((document.getElementById('ls-adm-phut') || {}).value, 10);
  _lsAdmMsg('Đang lưu...', true);
  try {
    var res = await supa.rpc('fn_ls_admin_set_config', { p_ma_admin: SESSION.ma, p_so_lan: soLan || null, p_phut: phut || null });
    if (res.error) throw res.error;
    if (!res.data || !res.data.ok) throw new Error((res.data || {}).message || 'Lỗi');
    _lsAdmMsg('✓ Đã lưu: ' + res.data.so_lan_ngay + ' lượt × ' + res.data.phut_toi_thieu + ' phút', true);
    _lsKenhDirty = true;
  } catch (e) { _lsAdmMsg('Lỗi: ' + ((e && e.message) || '')); }
}

/* Globals */
window.lsInitPage = lsInitPage;
window.lsOpenAdminKenh = lsOpenAdminKenh;
window.lsKenhThem = lsKenhThem;
window.lsKenhToggle = lsKenhToggle;
window.lsKenhXoa = lsKenhXoa;
window.lsLuuConfig = lsLuuConfig;
window.lsChonKenh = lsChonKenh;
window.lsMoTikTok = lsMoTikTok;
window.lsBatTieng = lsBatTieng;
window.lsAttnResume = lsAttnResume;
window.lsMoPhanHoi = lsMoPhanHoi;
window.lsPhChonLoai = lsPhChonLoai;
window.lsPhChonAnh = lsPhChonAnh;
window.lsGuiPhanHoi = lsGuiPhanHoi;
window.lsTaiDash = lsTaiDash;
window.lsTaiPhanHoiList = lsTaiPhanHoiList;
window.lsChiaKhung = lsChiaKhung;
window._lsDongModal = _lsDongModal;
