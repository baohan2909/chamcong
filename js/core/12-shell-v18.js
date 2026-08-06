/* ============================================================
   12-shell-v18.js — SHELL SIDEBAR (ĐẠI TU v18)
   Dựng sidebar desktop bằng JS từ HUB_GROUPS (lọc theo _hubItemVisible).
   - Desktop (>=900px): hiện sidebar cố định trái, dời nội dung sang phải,
     ẩn bottom-nav cũ.
   - Mobile (<900px): sidebar ẩn, giữ bottom-nav cũ (không đổi).
   Bọc trong .ns18. KHÔNG sửa cấu trúc HTML — sidebar tạo bằng JS.
   Móc: ns18InitShell() sau login · ns18SyncSidebar(page) trong goToPage ·
        dọn class .ns18-shell trong doLogout.
   ============================================================ */
(function () {
  var SIDEBAR_ID = 'ns18-sidebar';

  var _ic = {
    home:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>',
    acc:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.2"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/></svg>',
    admin:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>',
    dl:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 11l5 5 5-5M4 21h16"/></svg>'
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
  // Suy trang đích cho các mục không dùng goToPage trực tiếp (để tô sáng mục đang mở)
  function _labelPage(l) {
    var map = {
      'Giờ công': 'giocong',
      'Lịch ca của tôi': 'lichca',
      'Lịch ca hệ thống': 'lichca-ql',
      'Lịch hoạt động CH': 'lichhd-ql'
    };
    return map[l] || null;
  }

  function ns18BuildItems() {
    var out = [];
    out.push({ label: 'Trang chủ', ic: _ic.home, page: 'home', act: function () { goToPage('home'); } });
    if (typeof HUB_GROUPS === 'object' && HUB_GROUPS) {
      Object.keys(HUB_GROUPS).forEach(function (gk) {
        var g = HUB_GROUPS[gk];
        if (!g || !Array.isArray(g.items)) return;
        var vis = g.items.filter(function (it) {
          try { return _hubItemVisible(it); } catch (e) { return false; }
        });
        if (!vis.length) return;
        out.push({ sec: g.title });
        vis.forEach(function (it) {
          var m = String(it.act).match(/goToPage\(['"]([^'"]+)['"]\)/);
          var pg = m ? m[1] : _labelPage(it.label);
          out.push({ label: it.label, ic: it.ic, page: pg, act: it.act });
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

  window.ns18InitShell = function () {
    if (typeof SESSION === 'undefined' || !SESSION) return;
    var side = document.getElementById(SIDEBAR_ID);
    if (!side) {
      side = document.createElement('aside');
      side.id = SIDEBAR_ID;
      side.className = 'ns18';
      document.body.appendChild(side);
    }
    var items = ns18BuildItems();
    var nm = SESSION.ten || SESSION.ma || '--';
    var html = '';
    html += '<div class="brand"><div class="lg">NS</div><div><b>CHẤM CÔNG</b><small>Nón Sơn</small></div></div>';
    html += '<div class="side-scroll">';
    items.forEach(function (it, i) {
      if (it.label === undefined && it.sec !== undefined) {
        html += '<div class="nav-sec">' + _esc(it.sec) + '</div>';
        return;
      }
      html += '<button type="button" class="side-item" data-idx="' + i + '"' +
        (it.page ? ' data-page="' + _esc(it.page) + '"' : '') + '>' +
        (it.ic || '') + '<span>' + _esc(it.label) + '</span></button>';
    });
    html += '</div>';
    html += '<div class="spacer"></div>';
    html += '<div class="who"><b>' + _esc(nm) + '</b><small>' +
      _esc((SESSION.ma || '') + ' · ' + _roleLabel(SESSION.vaiTro)) + '</small>' +
      '<button type="button" class="side-btn sb-dl" id="ns18-dl">' + _ic.dl + 'Tải ứng dụng</button>' +
      '<button type="button" class="side-btn sb-out" id="ns18-out">' + _ic.logout + 'Đăng xuất</button>' +
      '</div>';
    side.innerHTML = html;

    side.querySelectorAll('.side-item').forEach(function (btn) {
      var idx = +btn.getAttribute('data-idx');
      btn.addEventListener('click', function () {
        var it = items[idx];
        if (it && typeof it.act === 'function') { try { it.act(); } catch (e) {} }
        ns18SyncSidebar(it ? it.page : null);
      });
    });
    var dl = side.querySelector('#ns18-dl');
    if (dl) dl.addEventListener('click', function () { if (typeof window.pwaInstall === 'function') window.pwaInstall(); });
    var out = side.querySelector('#ns18-out');
    if (out) out.addEventListener('click', function () { if (typeof doLogout === 'function') doLogout(); });

    document.body.classList.add('ns18-shell');
    ns18SyncSidebar(typeof currentPage !== 'undefined' ? currentPage : 'chamcong');
  };

  window.ns18SyncSidebar = function (page) {
    var side = document.getElementById(SIDEBAR_ID);
    if (!side) return;
    side.querySelectorAll('.side-item').forEach(function (b) {
      b.classList.toggle('on', !!page && b.getAttribute('data-page') === page);
    });
  };

  // Dọn shell khi đăng xuất (gọi từ doLogout)
  window.ns18TearDownShell = function () {
    document.body.classList.remove('ns18-shell');
    var side = document.getElementById(SIDEBAR_ID);
    if (side) side.remove();
  };
})();
