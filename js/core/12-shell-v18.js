/* ============================================================
   12-shell-v18.js — SHELL ĐIỀU HƯỚNG (ĐẠI TU v18)
   Dựng điều hướng từ HUB_GROUPS (lọc theo _hubItemVisible), bọc .ns18.
   - Laptop (>=900px): sidebar cố định trái.
   - Điện thoại (<900px): bottom-nav v18 (4 mục chính + "Thêm" mở drawer đầy đủ).
   Ẩn bottom-nav CŨ khi shell bật. KHÔNG sửa cấu trúc HTML — tạo bằng JS.
   Móc: ns18InitShell() sau login · ns18SyncSidebar(page) cuối goToPage ·
        ns18TearDownShell() trong doLogout.
   ============================================================ */
(function () {
  var SIDEBAR_ID = 'ns18-sidebar', BNAV_ID = 'ns18-bnav', DRAWER_ID = 'ns18-drawer', DRBG_ID = 'ns18-drawer-bg';

  // [v18] GIAI DOAN THU NGHIEM: giao dien v18 CHI bat cho NS00490 (admin toi thuong)
  // → 539 nguoi con lai giu giao dien cu. Duyet xong → mo cho tat ca (sua ns18Enabled).
  // NS18_PAGES: danh sach trang DA reskin v18 (them dan khi convert tung phan he).
  var NS18_PAGES = ['page-chamcong', 'page-taikhoan',
    'page-giocong', 'page-giocong-ql', 'page-bandochidung',
    'page-lichca', 'page-lichca-ql', 'page-lichhd-ch', 'page-lichhd-ql',
    'page-nhansu', 'page-donnghi-acc', 'page-duyetyc',
    'page-bangiao', 'page-bangiao-ql',
    'page-banhang', 'page-dashboard', 'page-chuongtrinh', 'page-checklist-ql',
    'page-donhang', 'page-donhang-nhan', 'page-donhang-ql',
    'page-muanon', 'page-muanon-admin',
    'page-home', 'page-admin', 'page-giaodien'];
  function ns18Enabled() {
    return typeof SESSION !== 'undefined' && SESSION && SESSION.ma === 'NS00490';
  }

  var _ic = {
    home:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>',
    acc:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.2"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/></svg>',
    admin:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>',
    dl:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 11l5 5 5-5M4 21h16"/></svg>',
    menu:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>'
  };

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function _roleLabel(r) {
    var m = { NV: 'Nhân viên', CTV: 'Cộng tác viên', CUA_HANG: 'Cửa hàng', QLNS: 'QL Nhân sự', QLBH: 'QL Bán hàng', ADMIN: 'Quản trị' };
    return m[r] || r || '';
  }
  function _labelPage(l) {
    var map = { 'Giờ công': 'giocong', 'Lịch ca của tôi': 'lichca', 'Lịch ca hệ thống': 'lichca-ql', 'Lịch hoạt động CH': 'lichhd-ql' };
    return map[l] || null;
  }
  // nhãn ngắn cho bottom-nav
  function _shortLabel(l) {
    var m = { 'Bản đồ chấm công': 'Bản đồ', 'Lịch ca của tôi': 'Lịch ca', 'Đăng ký khuôn mặt': 'Khuôn mặt',
      'Bàn giao ca': 'Bàn giao', 'Bàn giao (Quản lý)': 'Bàn giao', 'Phiên bán hàng': 'Bán hàng',
      'Dashboard bán hàng': 'Dashboard', 'Giám sát Trưởng ca': 'Trưởng ca', 'Điểm hệ thống': 'Điểm',
      'Lịch ca hệ thống': 'Lịch ca', 'Lịch hoạt động CH': 'Hoạt động', 'Mục kiểm tra bàn giao': 'Mục BG',
      'Mẫu nón sưu tầm': 'Mẫu nón', 'Khuôn mặt (AI)': 'Khuôn mặt', 'Duyệt yêu cầu': 'Duyệt' };
    return m[l] || l;
  }

  function ns18BuildItems() {
    var out = [];
    out.push({ label: 'Trang chủ', ic: _ic.home, page: 'home', act: function () { goToPage('home'); } });
    if (typeof HUB_GROUPS === 'object' && HUB_GROUPS) {
      Object.keys(HUB_GROUPS).forEach(function (gk) {
        var g = HUB_GROUPS[gk];
        if (!g || !Array.isArray(g.items)) return;
        var vis = g.items.filter(function (it) { try { return _hubItemVisible(it); } catch (e) { return false; } });
        if (!vis.length) return;
        out.push({ sec: g.title });
        vis.forEach(function (it) {
          var m = String(it.act).match(/goToPage\(['"]([^'"]+)['"]\)/);
          out.push({ label: it.label, ic: it.ic, page: m ? m[1] : _labelPage(it.label), act: it.act });
        });
      });
    }
    out.push({ sec: 'Hệ thống' });
    out.push({ label: 'Tài khoản', ic: _ic.acc, page: 'taikhoan', act: function () { goToPage('taikhoan'); } });
    if (typeof SESSION !== 'undefined' && SESSION && SESSION.vaiTro === 'ADMIN') {
      out.push({ label: 'Quản trị hệ thống', ic: _ic.admin, page: 'admin', act: function () { goToPage('admin'); } });
    }
    return out;
  }

  function _menuHTML(items) {
    var h = '';
    items.forEach(function (it, i) {
      if (it.label === undefined && it.sec !== undefined) { h += '<div class="nav-sec">' + _esc(it.sec) + '</div>'; return; }
      h += '<button type="button" class="side-item" data-idx="' + i + '"' + (it.page ? ' data-page="' + _esc(it.page) + '"' : '') +
        '>' + (it.ic || '') + '<span>' + _esc(it.label) + '</span></button>';
    });
    return h;
  }
  function _whoHTML() {
    var nm = SESSION.ten || SESSION.ma || '--';
    return '<div class="who"><b>' + _esc(nm) + '</b><small>' + _esc((SESSION.ma || '') + ' · ' + _roleLabel(SESSION.vaiTro)) + '</small>' +
      '<button type="button" class="side-btn sb-dl">' + _ic.dl + 'Tải ứng dụng</button>' +
      '<button type="button" class="side-btn sb-out">' + _ic.logout + 'Đăng xuất</button></div>';
  }

  // gắn click cho danh sách .side-item + nút dl/out trong 1 container
  function _wireMenu(container, items, closeAfter) {
    container.querySelectorAll('.side-item').forEach(function (btn) {
      var idx = +btn.getAttribute('data-idx');
      btn.addEventListener('click', function () {
        var it = items[idx];
        if (closeAfter) ns18CloseDrawer();
        if (it && typeof it.act === 'function') { try { it.act(); } catch (e) {} }
        ns18SyncSidebar(it ? it.page : null);
      });
    });
    var dl = container.querySelector('.sb-dl');
    if (dl) dl.addEventListener('click', function () { if (typeof window.pwaInstall === 'function') window.pwaInstall(); });
    var out = container.querySelector('.sb-out');
    if (out) out.addEventListener('click', function () { if (typeof doLogout === 'function') doLogout(); });
  }

  window.ns18InitShell = function () {
    if (typeof SESSION === 'undefined' || !SESSION) return;
    if (!ns18Enabled()) return;                 // chỉ NS00490 (giai đoạn thử)
    NS18_PAGES.forEach(function (id) { var p = document.getElementById(id); if (p) p.classList.add('ns18'); });
    var _mtc = document.getElementById('meta-theme-color'); if (_mtc) _mtc.setAttribute('content', '#17635B'); // thanh trên cùng → teal v18
    var items = ns18BuildItems();

    /* ---- Sidebar (laptop) ---- */
    var side = document.getElementById(SIDEBAR_ID);
    if (!side) { side = document.createElement('aside'); side.id = SIDEBAR_ID; side.className = 'ns18'; document.body.appendChild(side); }
    side.innerHTML = '<div class="brand"><div class="lg">NS</div><div style="flex:1;min-width:0"><b>CHẤM CÔNG</b><small>Nón Sơn</small></div>' +
      '<button type="button" class="ns18-bell" id="ns18-bell" title="Thông báo"><svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg><span class="ns18-bell-badge" id="ns18-bell-badge" style="display:none">0</span></button></div>' +
      '<div class="side-scroll ns18-nav">' + _menuHTML(items) + '</div>' +
      '<div class="spacer"></div>' + _whoHTML();
    _wireMenu(side, items, false);
    // Chuông sidebar → mở panel thông báo + đồng bộ badge từ chuông header cũ
    var bell = side.querySelector('#ns18-bell');
    if (bell) bell.addEventListener('click', function () { if (typeof toggleNotifPanel === 'function') toggleNotifPanel(); });
    ns18SyncBell();

    /* ---- Drawer (điện thoại — menu đầy đủ) ---- */
    var bg = document.getElementById(DRBG_ID);
    if (!bg) { bg = document.createElement('div'); bg.id = DRBG_ID; document.body.appendChild(bg); bg.addEventListener('click', ns18CloseDrawer); }
    var dr = document.getElementById(DRAWER_ID);
    if (!dr) { dr = document.createElement('div'); dr.id = DRAWER_ID; dr.className = 'ns18'; document.body.appendChild(dr); }
    dr.innerHTML = '<div class="grip"></div><div class="ns18-nav">' + _menuHTML(items) + '</div>' + _whoHTML();
    _wireMenu(dr, items, true);

    /* ---- Bottom-nav (điện thoại — 4 mục chính + Thêm) ---- */
    var bn = document.getElementById(BNAV_ID);
    if (!bn) { bn = document.createElement('nav'); bn.id = BNAV_ID; bn.className = 'ns18'; document.body.appendChild(bn); }
    var primary = [];
    items.forEach(function (it, i) { if (it.label !== undefined && it.page && primary.length < 4) primary.push(i); });
    var bh = '';
    primary.forEach(function (idx) {
      var it = items[idx];
      bh += '<button type="button" class="bi" data-idx="' + idx + '" data-page="' + _esc(it.page) + '">' +
        (it.ic || '') + '<span>' + _esc(_shortLabel(it.label)) + '</span></button>';
    });
    bh += '<button type="button" class="bi" data-menu="1">' + _ic.menu + '<span>Thêm</span></button>';
    bn.innerHTML = bh;
    bn.querySelectorAll('.bi').forEach(function (btn) {
      if (btn.getAttribute('data-menu')) { btn.addEventListener('click', ns18OpenDrawer); return; }
      var idx = +btn.getAttribute('data-idx');
      btn.addEventListener('click', function () {
        var it = items[idx];
        if (it && typeof it.act === 'function') { try { it.act(); } catch (e) {} }
        ns18SyncSidebar(it ? it.page : null);
      });
    });

    document.body.classList.add('ns18-shell');
    ns18SyncSidebar(typeof currentPage !== 'undefined' ? currentPage : 'chamcong');
  };

  window.ns18OpenDrawer = function () {
    var dr = document.getElementById(DRAWER_ID), bg = document.getElementById(DRBG_ID);
    if (bg) bg.classList.add('open');
    if (dr) dr.classList.add('open');
  };
  window.ns18CloseDrawer = function () {
    var dr = document.getElementById(DRAWER_ID), bg = document.getElementById(DRBG_ID);
    if (bg) bg.classList.remove('open');
    if (dr) dr.classList.remove('open');
  };

  window.ns18SyncSidebar = function (page) {
    ['#' + SIDEBAR_ID + ' .side-item', '#' + DRAWER_ID + ' .side-item', '#' + BNAV_ID + ' .bi'].forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (b) {
        b.classList.toggle('on', !!page && b.getAttribute('data-page') === page);
      });
    });
  };

  // Đồng bộ badge chuông sidebar từ badge chuông header cũ (theo dõi live)
  var _bellObs = null;
  window.ns18SyncBell = function () {
    var src = document.getElementById('cc-header-bell-badge');
    var dst = document.getElementById('ns18-bell-badge');
    if (!dst) return;
    var t = src ? (src.textContent || '').trim() : '';
    if (src && src.style.display !== 'none' && t && t !== '0') {
      dst.textContent = t; dst.style.display = 'flex';
    } else { dst.style.display = 'none'; }
    if (!_bellObs && src && typeof MutationObserver !== 'undefined') {
      _bellObs = new MutationObserver(function () { window.ns18SyncBell(); });
      _bellObs.observe(src, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['style'] });
    }
  };

  window.ns18TearDownShell = function () {
    document.body.classList.remove('ns18-shell');
    var _mtc = document.getElementById('meta-theme-color'); if (_mtc) _mtc.setAttribute('content', '#0F6E56'); // trả màu cũ khi đăng xuất
    NS18_PAGES.forEach(function (id) { var p = document.getElementById(id); if (p) p.classList.remove('ns18'); });
    [SIDEBAR_ID, BNAV_ID, DRAWER_ID, DRBG_ID].forEach(function (id) { var e = document.getElementById(id); if (e) e.remove(); });
  };
})();
