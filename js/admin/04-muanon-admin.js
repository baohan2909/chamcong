// ════════════════════════════════════════════════════════════════════════════
//  MODULE: MẪU NÓN HÀNG TUẦN — ADMIN side (Phase 4)
//  Path: js/admin/04-muanon-admin.js
//  4 tabs: Tổng quan · Gallery · Chưa gửi · Compliance
// ════════════════════════════════════════════════════════════════════════════

const MUANON_ADMIN = {
  tuanId: null,
  tuanList: [],
  currentTab: 'tongquan',
  filters: { kv: null, ch: null, nv: null, tag: null, trang_thai: null },
  timeRange: { mode: 'all', from: null, to: null, from_date: null, to_date: null },
  // [v11.5] Tổng quan: drill-down + sort 2-cấp
  tqGroup: localStorage.getItem('muanon_tq_group') || 'kv',
  tqExpand: null,  // null | 'dagui' | 'chuagui' | 'bai' | 'anh'
  tqSortStack: (function() {
    try { return JSON.parse(localStorage.getItem('muanon_tq_sortstack') || '[]') || []; }
    catch (e) { return []; }
  })(),
  // [v11.5] Tuân thủ filter
  cplFilter: 'all',  // 'all' | 'good' | 'mid' | 'low' | 'never'
  cplData: [],
  gridCols: parseInt(localStorage.getItem('muanon_grid_cols') || '3', 10),
  selectedNV: new Set(),
  galleryData: [],
  galleryTotal: 0,
  galleryOffset: 0,
  galleryLimit: 60,
  galleryOnlyFav: false,
  // [v11.9] Album + multi-select
  albums: [],
  currentAlbumId: null,
  currentAlbumName: null,
  selectMode: false,
  selectedAnh: new Set(),
  timelineData: [],
  timelineTotal: 0,
  timelineOffset: 0,
  timelineLimit: 20,
  lightboxIdx: -1,
  lightboxSource: 'gallery',
  lightboxTimelineRef: null,
  filterSheetOpen: false,
  _loaded: false
};

// Default sort stack nếu chưa có
if (!MUANON_ADMIN.tqSortStack || MUANON_ADMIN.tqSortStack.length === 0) {
  MUANON_ADMIN.tqSortStack = [
    { field: 'count', dir: 'desc' },
    { field: 'name',  dir: 'asc'  }
  ];
}

const MUANON_TAGS_ADMIN = [
  { code: 'MUBAOHIEM',    label: 'Mũ bảo hiểm',   color: '#185FA5' },
  { code: 'NONKETTHUONG', label: 'Nón kết',       color: '#0F6E56' },
  { code: 'NONSNAPBACK',  label: 'Snapback',      color: '#7C3AED' },
  { code: 'NONVANH',      label: 'Nón vành',      color: '#BA7517' },
  { code: 'NONDACBIET',   label: 'Đặc biệt',      color: '#DB2777' },
  { code: 'NONTREEM',     label: 'Trẻ em',        color: '#0891B2' },
  { code: 'KHAC',         label: 'Khác',          color: '#6b7280' }
];

function mnaTagLabel(code) {
  const t = MUANON_TAGS_ADMIN.find(x => x.code === code);
  return t ? t.label : code;
}
function mnaTagColor(code) {
  const t = MUANON_TAGS_ADMIN.find(x => x.code === code);
  return t ? t.color : '#6b7280';
}

function _mnaEscAttr(s) { return String(s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

// [v11.2] Render strip các filter đang active (dismissible)
function _mnaRenderActiveFilters() {
  const f = MUANON_ADMIN.filters || {};
  const parts = [];
  if (f.kv) parts.push({ key: 'kv', label: 'Khu vực: ' + f.kv });
  if (f.ch) parts.push({ key: 'ch', label: 'Cửa hàng: ' + f.ch });
  if (f.nv) parts.push({ key: 'nv', label: 'NV: ' + f.nv });
  if (f.tag) parts.push({ key: 'tag', label: 'Loại: ' + mnaTagLabel(f.tag) });
  if (parts.length === 0) return '';
  let html = '<div class="mna-active-filters">';
  for (const p of parts) {
    html += `
      <button class="mna-filter-chip" onclick="mnaSetFilter('${p.key}', '')">
        <span>${escHtml(p.label)}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="11" height="11"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;
  }
  html += `<button class="mna-filter-chip-clear" onclick="mnaClearAllFilters()">Xóa tất cả</button>`;
  html += '</div>';
  return html;
}

// ─── ENTRY ──────────────────────────────────────────────────────────────────
async function moPageMuanonAdmin() {
  goToPage('muanon-admin');
  if (!MUANON_ADMIN._loaded) {
    await mnaLoadTuanList();
    MUANON_ADMIN._loaded = true;
  }
  mnaSwitchTab(MUANON_ADMIN.currentTab);
}

// ─── LOAD TUẦN LIST ─────────────────────────────────────────────────────────
async function mnaLoadTuanList() {
  try {
    const { data, error } = await supa
      .from('muanon_tuan')
      .select('id, tuan_code, tuan_so, nam, ngay_bat_dau, ngay_ket_thuc, trang_thai, tong_nv_da_gui, tong_anh, ti_le_tuan_thu')
      .order('id', { ascending: false })
      .limit(20);

    if (error) throw error;
    MUANON_ADMIN.tuanList = data || [];

    const openTuan = MUANON_ADMIN.tuanList.find(t => t.trang_thai === 'OPEN');
    MUANON_ADMIN.tuanId = openTuan ? openTuan.id : (MUANON_ADMIN.tuanList[0] && MUANON_ADMIN.tuanList[0].id);

    mnaRenderHeader();
  } catch (err) {
    const el = document.getElementById('muanon-admin-content');
    if (el) el.innerHTML = '<div class="mna-empty">Lỗi tải tuần: ' + (err.message || 'network') + '</div>';
  }
}

function mnaRenderHeader() {
  const headerEl = document.getElementById('muanon-admin-header');
  if (!headerEl) return;

  const tuanOptions = MUANON_ADMIN.tuanList.map(t => {
    const label = t.tuan_code + (t.trang_thai === 'OPEN' ? ' · Đang mở' : '');
    return '<option value="' + t.id + '"' + (t.id === MUANON_ADMIN.tuanId ? ' selected' : '') + '>' + label + '</option>';
  }).join('');

  const tabs = [
    { id: 'tongquan',   label: 'Tổng quan' },
    { id: 'timeline',   label: 'Timeline' },
    { id: 'gallery',    label: 'Gallery' },
    { id: 'nhom',       label: 'Nhóm AI' },
    { id: 'chuagui',    label: 'Chưa gửi' },
    { id: 'compliance', label: 'Tuân thủ' }
  ];
  const tabsHtml = tabs.map(t =>
    '<button class="mna-tab' + (MUANON_ADMIN.currentTab === t.id ? ' active' : '') + '" onclick="mnaSwitchTab(\'' + t.id + '\')">' + t.label + '</button>'
  ).join('');

  headerEl.innerHTML = `
    <div class="mna-header-row">
      <select class="mna-tuan-select" onchange="mnaChangeTuan(this.value)">${tuanOptions}</select>
      <button class="mna-refresh-btn" onclick="mnaReload()" title="Tải lại">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3.51-7.13"/><polyline points="21 4 21 10 15 10"/></svg>
      </button>
    </div>
    <div class="mna-tabs">${tabsHtml}</div>
  `;
}

function mnaChangeTuan(tuanId) {
  MUANON_ADMIN.tuanId = parseInt(tuanId, 10);
  MUANON_ADMIN.filters = { kv: null, ch: null, nv: null, tag: null };
  MUANON_ADMIN.selectedNV.clear();
  MUANON_ADMIN.galleryOffset = 0;
  mnaSwitchTab(MUANON_ADMIN.currentTab);
}

async function mnaReload() {
  MUANON_ADMIN._loaded = false;
  await mnaLoadTuanList();
  mnaSwitchTab(MUANON_ADMIN.currentTab);
}

function mnaSwitchTab(tab) {
  MUANON_ADMIN.currentTab = tab;
  mnaRenderHeader();
  const el = document.getElementById('muanon-admin-content');
  if (!el) return;
  el.innerHTML = '<div class="mna-loading">Đang tải...</div>';

  if (tab === 'tongquan') mnaLoadTongQuan();
  else if (tab === 'timeline') mnaLoadTimeline();
  else if (tab === 'gallery') mnaLoadGallery();
  else if (tab === 'nhom') mnaLoadCluster();
  else if (tab === 'chuagui') mnaLoadChuaGui();
  else if (tab === 'compliance') mnaLoadCompliance();
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 1: TỔNG QUAN
// ════════════════════════════════════════════════════════════════════════════
async function mnaLoadTongQuan() {
  try {
    // 1. Metrics
    const dashP = supa.rpc('fn_muanon_admin_dashboard', {
      p_ma_admin: SESSION.ma, p_tuan_id: MUANON_ADMIN.tuanId
    });

    // 2. Drill-down data hoặc group data
    const exp = MUANON_ADMIN.tqExpand;
    let drillP;
    if (exp === 'dagui') {
      drillP = supa.rpc('fn_muanon_admin_groupby', {
        p_ma_admin: SESSION.ma, p_tuan_id: MUANON_ADMIN.tuanId,
        p_group: 'nv', p_sort: 'count_desc'
      });
    } else if (exp === 'chuagui') {
      drillP = supa.rpc('fn_muanon_admin_chua_gui', {
        p_ma_admin: SESSION.ma, p_tuan_id: MUANON_ADMIN.tuanId
      });
    } else if (exp === 'bai') {
      drillP = supa.rpc('fn_muanon_admin_timeline', {
        p_ma_admin: SESSION.ma, p_tuan_id: MUANON_ADMIN.tuanId,
        p_limit: 30, p_offset: 0
      });
    } else if (exp === 'anh') {
      drillP = supa.rpc('fn_muanon_admin_list_anh', {
        p_ma_admin: SESSION.ma, p_tuan_id: MUANON_ADMIN.tuanId,
        p_limit: 30, p_offset: 0
      });
    } else {
      drillP = supa.rpc('fn_muanon_admin_groupby', {
        p_ma_admin: SESSION.ma, p_tuan_id: MUANON_ADMIN.tuanId,
        p_group: MUANON_ADMIN.tqGroup, p_sort: 'count_desc'
      });
    }

    const [dashRes, drillRes] = await Promise.all([dashP, drillP]);
    if (dashRes.error) throw dashRes.error;
    if (drillRes.error) throw drillRes.error;

    const metrics = (dashRes.data && dashRes.data.metrics) || {};
    const drillData = drillRes.data || {};
    mnaRenderTongQuan(metrics, drillData);
  } catch (err) {
    document.getElementById('muanon-admin-content').innerHTML =
      '<div class="mna-empty">Lỗi: ' + (err.message || 'network') + '</div>';
  }
}

// Client-side multi-level sort
function _mnaApplySort(arr, sortStack) {
  return [...arr].sort((a, b) => {
    for (const s of sortStack) {
      let av, bv;
      if (s.field === 'count') { av = a.so_anh || 0; bv = b.so_anh || 0; }
      else { av = String(a.label || a.ten_nv || a.key || '').toLowerCase();
             bv = String(b.label || b.ten_nv || b.key || '').toLowerCase(); }
      let cmp = av < bv ? -1 : (av > bv ? 1 : 0);
      if (s.dir === 'desc') cmp = -cmp;
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
}

function mnaRenderTongQuan(m, drillRes) {
  const tongNv = m.tong_nv || 0;
  const daGui  = m.so_nv_da_gui || 0;
  const chuaGui = m.so_nv_chua_gui || 0;
  const soBai = m.so_bai || 0;
  const soAnh = m.so_anh || 0;
  const dungHan = m.so_dung_han || 0;
  const tre = m.so_tre || 0;
  const avg = m.avg_anh_per_bai || 0;
  const exp = MUANON_ADMIN.tqExpand;

  let html = '<div class="mna-tq-wrap">';

  // ─── 4 HERO CARDS (đồng nhất phong cách card trắng accent nhẹ) ───
  const cardCfg = [
    { id: 'dagui',   label: 'Đã gửi',  big: daGui,  sub: '/ ' + tongNv + ' NV', accent: 'green',
      icon: '<polyline points="20 6 9 17 4 12"/>' },
    { id: 'chuagui', label: 'Chưa gửi', big: chuaGui, sub: 'NV', accent: 'amber',
      icon: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>' },
    { id: 'bai',     label: 'Tổng bài', big: soBai, sub: dungHan + ' đúng · ' + tre + ' trễ', accent: 'blue',
      icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>' },
    { id: 'anh',     label: 'Tổng ảnh', big: soAnh, sub: 'TB ' + avg + '/bài', accent: 'violet',
      icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>' }
  ];

  html += '<div class="mna-tq-hero">';
  for (const c of cardCfg) {
    const active = exp === c.id;
    html += `
      <button class="mna-tq-card a-${c.accent} ${active ? 'expanded' : ''}" onclick="mnaTqExpand('${c.id}')" aria-pressed="${active}">
        <div class="mna-tq-card-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">${c.icon}</svg>
        </div>
        <div class="mna-tq-card-label">${c.label}</div>
        <div class="mna-tq-card-value"><b>${c.big}</b><span class="mna-tq-card-sub">${c.sub}</span></div>
        ${active ? '<div class="mna-tq-card-chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><polyline points="18 15 12 9 6 15"/></svg></div>' : ''}
      </button>
    `;
  }
  html += '</div>';

  // ─── DRILL-DOWN PANEL ───
  if (exp) {
    html += '<div class="mna-tq-drill">';
    html += `<div class="mna-tq-drill-head">
      <div class="mna-tq-drill-title">${({
        dagui: 'Nhân viên đã gửi',
        chuagui: 'Nhân viên chưa gửi',
        bai: 'Bài gửi gần nhất',
        anh: 'Ảnh gửi gần nhất'
      })[exp]}</div>
      <button class="mna-tq-drill-close" onclick="mnaTqExpand(null)">Đóng</button>
    </div>`;
    html += mnaRenderDrillContent(exp, drillRes);
    html += '</div></div>';
    document.getElementById('muanon-admin-content').innerHTML = html;
    return;
  }

  // ─── GROUP SELECTOR + SORT 2-CẤP (default view) ───
  const groupLabels = { kv: 'Khu vực', ch: 'Cửa hàng', nv: 'Nhân viên', tag: 'Loại nón' };
  html += `
    <div class="mna-tq-section">
      <div class="mna-tq-grp-bar">
        <div class="mna-tq-grp-label">Xem theo</div>
        <div class="mna-tq-grp-chips">
          ${['kv','ch','nv','tag'].map(g =>
            `<button class="mna-tq-grp-chip ${MUANON_ADMIN.tqGroup === g ? 'active' : ''}" onclick="mnaSetGroup('${g}')">${groupLabels[g]}</button>`
          ).join('')}
        </div>
      </div>
      <div class="mna-tq-sort-stack">
        ${MUANON_ADMIN.tqSortStack.map((s, i) => {
          const isCount = s.field === 'count';
          const fldLbl = isCount ? 'Số lượng' : 'Tên';
          const dirLbl = isCount
            ? (s.dir === 'desc' ? 'nhiều → ít' : 'ít → nhiều')
            : (s.dir === 'asc'  ? 'A → Z' : 'Z → A');
          const arrow = (s.dir === 'asc') ? '↑' : '↓';
          return `
            <div class="mna-tq-sort-chip ${i === 0 ? 'primary' : 'secondary'}">
              <button class="mna-tq-sort-rank" onclick="mnaTqSortPromote(${i})" title="Đổi thứ tự ưu tiên">${i + 1}°</button>
              <button class="mna-tq-sort-field" onclick="mnaTqSortToggleField(${i})">${fldLbl}</button>
              <button class="mna-tq-sort-dir" onclick="mnaTqSortToggleDir(${i})">${dirLbl} <span class="mna-tq-sort-arrow">${arrow}</span></button>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  // ─── GROUP LIST ───
  const groupData = (drillRes && drillRes.data) || [];
  const sorted = _mnaApplySort(groupData, MUANON_ADMIN.tqSortStack);

  if (sorted.length === 0) {
    html += '<div class="mna-tq-empty">Chưa có dữ liệu</div>';
  } else {
    const maxAnh = Math.max(...sorted.map(g => g.so_anh || 0), 1);
    html += '<div class="mna-tq-list">';
    const grp = MUANON_ADMIN.tqGroup;
    for (const item of sorted) {
      const w = Math.round(100 * (item.so_anh || 0) / maxAnh);
      let sub;
      if (grp === 'kv')      sub = (item.so_nv || 0) + ' NV · ' + (item.so_bai || 0) + ' bài';
      else if (grp === 'ch') sub = (item.khu_vuc ? item.khu_vuc + ' · ' : '') + (item.so_nv || 0) + ' NV';
      else if (grp === 'nv') sub = (item.ten_ch || item.ma_ch || '') + (item.khu_vuc ? ' · ' + item.khu_vuc : '');
      else                   sub = (item.so_nv || 0) + ' NV';

      const label = grp === 'tag' ? mnaTagLabel(item.label) : (item.label || item.key);
      const filterKey = grp === 'tag' ? 'tag' : (grp === 'nv' ? 'nv' : (grp === 'ch' ? 'ch' : 'kv'));
      const filterVal = String(item.key || '').replace(/'/g, "\\'");

      // Accent dot color cho tag mode
      const dotColor = grp === 'tag' ? mnaTagColor(item.key) : '#0F6E56';

      html += `
        <button class="mna-tq-item" onclick="mnaTqDrillDown('${filterKey}', '${filterVal}')">
          <span class="mna-tq-item-dot" style="background:${dotColor}"></span>
          <div class="mna-tq-item-info">
            <div class="mna-tq-item-name">${escHtml(label)}</div>
            <div class="mna-tq-item-sub">${escHtml(sub)}</div>
          </div>
          <div class="mna-tq-item-count">${item.so_anh || 0}</div>
          <div class="mna-tq-item-bar"><div class="mna-tq-item-bar-fill" style="width:${w}%"></div></div>
        </button>
      `;
    }
    html += '</div>';
  }

  html += '</div>';
  document.getElementById('muanon-admin-content').innerHTML = html;
}

// Render drill-down content (4 modes)
function mnaRenderDrillContent(mode, drillRes) {
  const arr = (drillRes && drillRes.data) || [];

  if (mode === 'dagui') {
    if (arr.length === 0) return '<div class="mna-tq-empty">Chưa có nhân viên nào gửi</div>';
    let html = '<div class="mna-tq-nv-list">';
    for (const nv of arr) {
      const initials = String(nv.label || nv.key || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();
      html += `
        <div class="mna-tq-nv-row" onclick="mnaTqDrillDown('nv', '${(nv.key || '').replace(/'/g, "\\'")}')">
          <div class="mna-tq-nv-avatar">${escHtml(initials)}</div>
          <div class="mna-tq-nv-info">
            <div class="mna-tq-nv-name">${escHtml(nv.label || nv.key)} <span class="mna-tq-nv-ma">${escHtml(nv.key || '')}</span></div>
            <div class="mna-tq-nv-meta">${escHtml(nv.ten_ch || nv.ma_ch || '')}${nv.khu_vuc ? ' · ' + escHtml(nv.khu_vuc) : ''}</div>
          </div>
          <div class="mna-tq-nv-stats">
            <span class="mna-tq-nv-stat"><b>${nv.so_bai || 0}</b> bài</span>
            <span class="mna-tq-nv-stat"><b>${nv.so_anh || 0}</b> ảnh</span>
          </div>
        </div>
      `;
    }
    html += '</div>';
    return html;
  }

  if (mode === 'chuagui') {
    if (arr.length === 0) return '<div class="mna-tq-empty">Tất cả nhân viên đều đã gửi! 🎉</div>';
    let html = '<div class="mna-tq-nv-list">';
    for (const nv of arr) {
      const initials = String(nv.ten_nv || nv.ma_nv || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();
      html += `
        <div class="mna-tq-nv-row warn">
          <div class="mna-tq-nv-avatar warn">${escHtml(initials)}</div>
          <div class="mna-tq-nv-info">
            <div class="mna-tq-nv-name">${escHtml(nv.ten_nv || '')} <span class="mna-tq-nv-ma">${escHtml(nv.ma_nv || '')}</span></div>
            <div class="mna-tq-nv-meta">${escHtml(nv.ten_ch || nv.ma_ch || '')}${nv.khu_vuc ? ' · ' + escHtml(nv.khu_vuc) : ''}</div>
          </div>
          <div class="mna-tq-nv-stats">
            ${nv.so_lan_nhac > 0 ? '<span class="mna-tq-nv-stat warn">Đã nhắc ' + nv.so_lan_nhac + 'x</span>' : ''}
          </div>
        </div>
      `;
    }
    html += '</div>';
    return html;
  }

  if (mode === 'bai') {
    if (arr.length === 0) return '<div class="mna-tq-empty">Chưa có bài gửi</div>';
    let html = '<div class="mna-tq-bai-list">';
    for (const bg of arr) {
      const ts = bg.ngay_gui ? _mnaRelativeTime(bg.ngay_gui) : '';
      const initials = String(bg.ten_nv || bg.ma_nv || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();
      const anhList = bg.anh_list || [];
      const showMax = 4;
      const overflow = anhList.length - showMax;
      const grid = anhList.slice(0, showMax).map((a, ai) =>
        `<div class="mna-tq-bai-img" style="background-image:url('${_mnaEscAttr(a.url)}')">
          ${ai === showMax - 1 && overflow > 0 ? '<div class="mna-tl-img-overlay">+' + overflow + '</div>' : ''}
        </div>`).join('');
      const badge = bg.dung_han ? '<span class="mna-tq-badge ok">Đúng hạn</span>' : '<span class="mna-tq-badge late">Trễ</span>';
      html += `
        <div class="mna-tq-bai-card">
          <div class="mna-tq-bai-head">
            <div class="mna-tq-nv-avatar small">${escHtml(initials)}</div>
            <div class="mna-tq-bai-info">
              <div class="mna-tq-nv-name">${escHtml(bg.ten_nv || '')}</div>
              <div class="mna-tq-nv-meta">${escHtml(bg.ten_ch || bg.ma_ch || '')} · ${ts}</div>
            </div>
            ${badge}
          </div>
          <div class="mna-tq-bai-grid">${grid}</div>
        </div>
      `;
    }
    html += '</div>';
    return html;
  }

  if (mode === 'anh') {
    if (arr.length === 0) return '<div class="mna-tq-empty">Chưa có ảnh</div>';
    let html = '<div class="mna-tq-anh-grid">';
    for (const a of arr) {
      const tagColor = a.tag ? mnaTagColor(a.tag) : null;
      html += `
        <div class="mna-tq-anh-item">
          <img src="${_mnaEscAttr(a.url || '')}" loading="lazy"/>
          ${a.tag ? `<span class="mna-tq-anh-tag" style="background:${tagColor}">${escHtml(mnaTagLabel(a.tag))}</span>` : ''}
          <div class="mna-tq-anh-info">
            <div class="mna-tq-anh-nv">${escHtml(a.ten_nv || a.ma_nv || '')}</div>
            <div class="mna-tq-anh-ch">${escHtml(a.ten_ch || a.ma_ch || '')}</div>
          </div>
        </div>
      `;
    }
    html += '</div>';
    return html;
  }

  return '<div class="mna-tq-empty">Không có dữ liệu</div>';
}

// Toggle drill-down
function mnaTqExpand(type) {
  MUANON_ADMIN.tqExpand = (MUANON_ADMIN.tqExpand === type) ? null : type;
  mnaLoadTongQuan();
}

function mnaSetGroup(g) {
  MUANON_ADMIN.tqGroup = g;
  localStorage.setItem('muanon_tq_group', g);
  mnaLoadTongQuan();
}

// Sort stack manipulations
function mnaTqSortPromote(idx) {
  // Đưa item idx lên primary (swap với item 0)
  const stack = MUANON_ADMIN.tqSortStack;
  if (idx === 0 || idx >= stack.length) return;
  const tmp = stack[0]; stack[0] = stack[idx]; stack[idx] = tmp;
  localStorage.setItem('muanon_tq_sortstack', JSON.stringify(stack));
  mnaLoadTongQuan();
}
function mnaTqSortToggleField(idx) {
  // Đổi field count <-> name
  const stack = MUANON_ADMIN.tqSortStack;
  if (idx >= stack.length) return;
  const cur = stack[idx];
  cur.field = (cur.field === 'count') ? 'name' : 'count';
  cur.dir = (cur.field === 'count') ? 'desc' : 'asc';
  // Đảm bảo secondary có field khác primary
  if (idx === 0 && stack.length > 1) {
    if (stack[1].field === cur.field) {
      stack[1].field = (cur.field === 'count') ? 'name' : 'count';
      stack[1].dir = (stack[1].field === 'count') ? 'desc' : 'asc';
    }
  }
  localStorage.setItem('muanon_tq_sortstack', JSON.stringify(stack));
  mnaLoadTongQuan();
}
function mnaTqSortToggleDir(idx) {
  const stack = MUANON_ADMIN.tqSortStack;
  if (idx >= stack.length) return;
  stack[idx].dir = (stack[idx].dir === 'asc') ? 'desc' : 'asc';
  localStorage.setItem('muanon_tq_sortstack', JSON.stringify(stack));
  mnaLoadTongQuan();
}

// Tap item → set filter + chuyển Gallery
function mnaTqDrillDown(key, val) {
  MUANON_ADMIN.filters[key] = val;
  MUANON_ADMIN.galleryOffset = 0;
  mnaSwitchTab('gallery');
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 2: GALLERY
// ════════════════════════════════════════════════════════════════════════════
async function mnaLoadGallery() {
  const el = document.getElementById('muanon-admin-content');
  if (el) el.classList.add('mna-fading');

  try {
    let res;
    // [v11.9] Ưu tiên 1: đang xem album cụ thể
    if (MUANON_ADMIN.currentAlbumId) {
      res = await supa.rpc('fn_muanon_admin_album_anh_list', {
        p_ma_admin: SESSION.ma,
        p_album_id: MUANON_ADMIN.currentAlbumId,
        p_limit: MUANON_ADMIN.galleryLimit,
        p_offset: MUANON_ADMIN.galleryOffset
      });
    }
    // [v11.8] Ưu tiên 2: chỉ yêu thích
    else if (MUANON_ADMIN.galleryOnlyFav) {
      res = await supa.rpc('fn_muanon_admin_list_fav', {
        p_ma_admin: SESSION.ma,
        p_limit: MUANON_ADMIN.galleryLimit,
        p_offset: MUANON_ADMIN.galleryOffset
      });
      if (res.data && res.data.data) {
        res.data.data.forEach(x => { x.is_fav = true; });
      }
    }
    // Mặc định: gallery thường theo tuần
    else {
      res = await supa.rpc('fn_muanon_admin_list_anh', {
        p_ma_admin: SESSION.ma,
        p_tuan_id: MUANON_ADMIN.tuanId,
        p_kv: MUANON_ADMIN.filters.kv,
        p_ch: MUANON_ADMIN.filters.ch,
        p_nv: MUANON_ADMIN.filters.nv,
        p_tag: MUANON_ADMIN.filters.tag,
        p_limit: MUANON_ADMIN.galleryLimit,
        p_offset: MUANON_ADMIN.galleryOffset
      });
    }
    const { data, error } = res;
    if (error) throw error;
    if (!data || !data.ok) throw new Error((data && data.message) || 'Lỗi');

    MUANON_ADMIN.galleryData = data.data || [];
    MUANON_ADMIN.galleryTotal = data.total || 0;
    mnaRenderGallery();
    if (el) requestAnimationFrame(() => el.classList.remove('mna-fading'));
  } catch (err) {
    if (el) el.classList.remove('mna-fading');
    document.getElementById('muanon-admin-content').innerHTML =
      '<div class="mna-empty">Lỗi: ' + (err.message || 'network') + '</div>';
  }
}

function mnaToggleOnlyFav() {
  MUANON_ADMIN.galleryOnlyFav = !MUANON_ADMIN.galleryOnlyFav;
  MUANON_ADMIN.galleryOffset = 0;
  // Exit album if any
  if (MUANON_ADMIN.galleryOnlyFav && MUANON_ADMIN.currentAlbumId) {
    MUANON_ADMIN.currentAlbumId = null;
    MUANON_ADMIN.currentAlbumName = null;
  }
  mnaLoadGallery();
}

function mnaRenderGallery() {
  const data = MUANON_ADMIN.galleryData;
  const onlyFav = !!MUANON_ADMIN.galleryOnlyFav;
  const inAlbum = !!MUANON_ADMIN.currentAlbumId;
  const albumName = MUANON_ADMIN.currentAlbumName || '';
  const selMode = MUANON_ADMIN.selectMode;
  const selCount = MUANON_ADMIN.selectedAnh.size;

  let html = _mnaRenderActiveFilters();

  // [v11.9] Album header (khi đang xem album)
  if (inAlbum) {
    html += `
      <div class="mna-album-header">
        <button class="mna-album-back" onclick="mnaExitAlbum()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="mna-album-h-info">
          <div class="mna-album-h-name">${escHtml(albumName)}</div>
          <div class="mna-album-h-meta">${MUANON_ADMIN.galleryTotal} ảnh</div>
        </div>
        <button class="mna-album-h-act" onclick="mnaRenameCurrentAlbum()" title="Đổi tên">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="mna-album-h-act danger" onclick="mnaDeleteCurrentAlbum()" title="Xóa">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    `;
  }

  html += `
    <div class="mna-filter-sticky">
      <div class="mna-toolbar">`;

  if (selMode) {
    // Select mode toolbar
    html += `
        <button class="mna-sel-cancel" onclick="mnaToggleSelectMode()">Hủy chọn</button>
        <div class="mna-sel-count">Đã chọn <b>${selCount}</b></div>
        <button class="mna-sel-all" onclick="mnaSelectAllGallery()">Chọn tất cả</button>`;
  } else {
    html += `
        <input type="search" class="mna-search-input"
          placeholder="${onlyFav ? 'Đang xem ảnh yêu thích' : (inAlbum ? 'Đang xem bộ sưu tập: ' + escHtml(albumName) : 'Tìm tên NV, mã NV, cửa hàng, khu vực...')}"
          value="${_mnaEscAttr(MUANON_ADMIN.filters.nv || '')}"
          oninput="mnaDebounceSearch(this.value)"
          ${(onlyFav || inAlbum) ? 'disabled' : ''}/>
        <button class="mna-filter-btn ${onlyFav ? 'on-fav' : ''}" onclick="mnaToggleOnlyFav()" title="${onlyFav ? 'Xem tất cả' : 'Chỉ yêu thích'}" ${inAlbum ? 'disabled' : ''}>
          <svg viewBox="0 0 24 24" fill="${onlyFav ? '#EF4444' : 'none'}" stroke="${onlyFav ? '#EF4444' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
        <button class="mna-filter-btn" onclick="mnaOpenAlbumSheet()" title="Bộ sưu tập">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        </button>
        <button class="mna-filter-btn" onclick="mnaToggleSelectMode()" title="Chọn nhiều">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="9 11 12 14 22 4"/></svg>
        </button>`;
    if (!inAlbum && !onlyFav) {
      html += `
        <button class="mna-filter-btn" onclick="mnaOpenFilterSheet()" title="Bộ lọc">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          ${_mnaFilterBadge()}
        </button>`;
    }
  }

  html += `
      </div>
      <div class="mna-zoom-row">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.55"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
        <input type="range" min="2" max="5" step="1" value="${MUANON_ADMIN.gridCols}" class="mna-zoom-slider" oninput="mnaSetZoom(this.value)"/>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.55"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
        <span class="mna-zoom-label">${MUANON_ADMIN.gridCols} cột</span>
      </div>
      <div class="mna-gallery-info">${MUANON_ADMIN.galleryTotal} ảnh</div>
    </div>
  `;

  if (data.length === 0) {
    html += '<div class="mna-empty">' + (inAlbum ? 'Bộ sưu tập trống. Vào Gallery chọn ảnh và "Thêm vào bộ sưu tập".' : 'Chưa có ảnh nào') + '</div>';
    document.getElementById('muanon-admin-content').innerHTML = html;
    return;
  }

  html += `<div class="mna-gallery-grid ${selMode ? 'sel-mode' : ''}" style="--mna-cols:${MUANON_ADMIN.gridCols}">`;
  data.forEach((a, idx) => {
    const tagColor = a.tag ? mnaTagColor(a.tag) : null;
    const isSel = MUANON_ADMIN.selectedAnh.has(a.anh_id);
    // [v11.10] Render BOTH heart và checkbox — CSS sẽ hide tùy mode
    // → toggle select mode chỉ cần đổi class .sel-mode trên grid, không re-render
    html += `
      <div class="mna-gallery-item ${isSel ? 'selected' : ''}" data-anh-id="${a.anh_id}" data-idx="${idx}" onclick="mnaItemClick(${idx}, ${a.anh_id}, event)">
        <img src="${_mnaEscAttr(a.url || '')}" alt="${_mnaEscAttr(a.ten_nv || '')}" loading="lazy"/>
        ${a.tag ? `<span class="mna-gallery-tag" style="background:${tagColor}">${escHtml(mnaTagLabel(a.tag))}</span>` : ''}
        <button class="mna-fav-btn ${a.is_fav ? 'on' : ''}" onclick="mnaToggleFav(${a.anh_id}, event)" aria-label="Yêu thích">
          <svg viewBox="0 0 24 24" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
        <div class="mna-sel-cb ${isSel ? 'on' : ''}">${isSel ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}</div>
        <div class="mna-gallery-overlay">
          <div class="mna-gallery-nv">${escHtml(a.ten_nv || a.ma_nv || '')}</div>
          <div class="mna-gallery-ch">${escHtml(a.ten_ch || a.ma_ch || '')}${a.khu_vuc ? ' · ' + escHtml(a.khu_vuc) : ''}</div>
        </div>
      </div>`;
  });
  html += '</div>';

  // [v11.10] Multi-bar được tạo riêng (DOM ngoài grid) → toggle mượt
  document.getElementById('muanon-admin-content').innerHTML = html;
  _mnaSyncMultiBar();
  // [v11.11] Setup drag-to-select touch handlers (iPhone Photos style)
  _mnaSetupDragSelect();
}

// [v11.11] Drag-to-select state (iPhone Photos style)
const _MNA_DRAG = {
  startId: null,
  startX: 0,
  startY: 0,
  active: false,       // chỉ true sau khi di chuyển >10px
  action: null,        // 'add' | 'remove'
  lastId: null
};
const _MNA_DRAG_THRESHOLD = 10;

function _mnaSetupDragSelect() {
  const grid = document.querySelector('.mna-gallery-grid');
  if (!grid || grid.dataset.dragBound === '1') return;
  grid.dataset.dragBound = '1';

  grid.addEventListener('touchstart', e => {
    if (!MUANON_ADMIN.selectMode) return;
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const item = (e.target.closest && e.target.closest('.mna-gallery-item'));
    if (!item) return;
    const anhId = parseInt(item.dataset.anhId, 10);
    if (!anhId) return;
    _MNA_DRAG.startId = anhId;
    _MNA_DRAG.startX = t.clientX;
    _MNA_DRAG.startY = t.clientY;
    _MNA_DRAG.active = false;       // chỉ active sau khi di chuyển
    _MNA_DRAG.action = null;
    _MNA_DRAG.lastId = null;
  }, { passive: true });

  grid.addEventListener('touchmove', e => {
    if (!_MNA_DRAG.startId || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - _MNA_DRAG.startX);
    const dy = Math.abs(t.clientY - _MNA_DRAG.startY);

    // Chưa di chuyển đủ → không drag (giữ scroll bình thường)
    if (!_MNA_DRAG.active) {
      if (Math.max(dx, dy) < _MNA_DRAG_THRESHOLD) return;
      // Bắt đầu drag-select
      _MNA_DRAG.active = true;
      _MNA_DRAG.lastId = _MNA_DRAG.startId;
      _MNA_DRAG.action = MUANON_ADMIN.selectedAnh.has(_MNA_DRAG.startId)
        ? 'remove' : 'add';
      _mnaApplyDragSel(_MNA_DRAG.startId);  // toggle item đầu vì click sẽ suppress
    }

    // Đang drag — check item dưới ngón
    const el = document.elementFromPoint(t.clientX, t.clientY);
    if (!el) return;
    const item = el.closest('.mna-gallery-item');
    if (!item) return;
    const anhId = parseInt(item.dataset.anhId, 10);
    if (!anhId || anhId === _MNA_DRAG.lastId) return;
    _MNA_DRAG.lastId = anhId;
    _mnaApplyDragSel(anhId);
    e.preventDefault();  // KHÔNG scroll khi drag-select
  }, { passive: false });

  const endHandler = e => {
    if (_MNA_DRAG.active && e && e.cancelable) {
      e.preventDefault();  // suppress click sau touchend
    }
    // Reset (giữ active 1 frame để click handler biết)
    const wasActive = _MNA_DRAG.active;
    _MNA_DRAG.startId = null;
    _MNA_DRAG.lastId = null;
    _MNA_DRAG.action = null;
    if (wasActive) {
      // Giữ active flag thêm 1 chút để click bị suppress
      setTimeout(() => { _MNA_DRAG.active = false; }, 50);
    } else {
      _MNA_DRAG.active = false;
    }
  };
  grid.addEventListener('touchend', endHandler, { passive: false });
  grid.addEventListener('touchcancel', endHandler, { passive: false });
}

function _mnaApplyDragSel(anhId) {
  const set = MUANON_ADMIN.selectedAnh;
  const wasSel = set.has(anhId);
  if (_MNA_DRAG.action === 'add') {
    if (wasSel) return;
    set.add(anhId);
  } else {
    if (!wasSel) return;
    set.delete(anhId);
  }
  const el = document.querySelector('.mna-gallery-item[data-anh-id="' + anhId + '"]');
  if (el) {
    el.classList.toggle('selected', set.has(anhId));
    const cb = el.querySelector('.mna-sel-cb');
    if (cb) {
      cb.classList.toggle('on', set.has(anhId));
      cb.innerHTML = set.has(anhId)
        ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
        : '';
    }
  }
  _mnaSyncMultiBar();
}

// Click handler thống nhất cho gallery item
function mnaItemClick(idx, anhId, ev) {
  // Nếu vừa drag xong → suppress click (touchend.preventDefault chưa đủ trên 1 số browser)
  if (_MNA_DRAG.active) {
    if (ev && ev.preventDefault) ev.preventDefault();
    return;
  }
  if (MUANON_ADMIN.selectMode) {
    mnaToggleAnhSelect(anhId, ev);
  } else {
    mnaOpenLightbox(idx);
  }
}

function mnaSetFilter(key, val) {
  MUANON_ADMIN.filters[key] = val || null;
  MUANON_ADMIN.galleryOffset = 0;
  MUANON_ADMIN.timelineOffset = 0;
  if (MUANON_ADMIN.currentTab === 'gallery') mnaLoadGallery();
  else if (MUANON_ADMIN.currentTab === 'chuagui') mnaLoadChuaGui();
  else if (MUANON_ADMIN.currentTab === 'timeline') mnaLoadTimeline();
}

// [v11.2] Debounce search NV
let _mnaSearchTimer = null;
function mnaDebounceSearch(val) {
  clearTimeout(_mnaSearchTimer);
  _mnaSearchTimer = setTimeout(() => {
    mnaSetFilter('nv', val.trim() || null);
  }, 350);
}

function mnaSetZoom(val) {
  MUANON_ADMIN.gridCols = parseInt(val, 10);
  localStorage.setItem('muanon_grid_cols', val);
  const grid = document.querySelector('.mna-gallery-grid');
  if (grid) grid.style.setProperty('--mna-cols', val);
  const lbl = document.querySelector('.mna-zoom-label');
  if (lbl) lbl.textContent = val + ' cột';
}

function mnaOpenLightbox(idx) {
  MUANON_ADMIN.lightboxIdx = idx;
  // [v11.8] Lưu scroll position
  MUANON_ADMIN._scrollY = window.scrollY;
  // [v11.12] Lock body scroll khi lightbox mở → grid sau lưng không giật
  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.top = '-' + MUANON_ADMIN._scrollY + 'px';
  document.body.style.left = '0';
  document.body.style.right = '0';
  mnaRenderLightbox();
}

function mnaCloseLightbox() {
  const idx = MUANON_ADMIN.lightboxIdx;
  MUANON_ADMIN.lightboxIdx = -1;
  const lb = document.getElementById('mna-lightbox');
  if (lb) { lb.classList.remove('open'); setTimeout(() => lb.remove(), 250); }

  // [v11.12] Unlock body scroll
  const sy = MUANON_ADMIN._scrollY || 0;
  document.body.style.overflow = '';
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  window.scrollTo(0, sy);

  // Restore scroll target item into view
  const items = MUANON_ADMIN.galleryData;
  if (idx >= 0 && items && items[idx]) {
    const anhId = items[idx].anh_id;
    requestAnimationFrame(() => {
      const targetEl = document.querySelector('[data-anh-id="' + anhId + '"]');
      if (targetEl) {
        targetEl.scrollIntoView({ block: 'center', behavior: 'instant' });
      }
    });
  }
}

function mnaLightboxNav(dir) {
  const len = MUANON_ADMIN.galleryData.length;
  if (len === 0) return;
  let next = MUANON_ADMIN.lightboxIdx + dir;
  if (next < 0) next = len - 1;
  if (next >= len) next = 0;
  MUANON_ADMIN.lightboxIdx = next;
  mnaRenderLightbox();
}

// [v11.8] Toggle yêu thích cho ảnh đang xem trong lightbox
async function mnaLightboxToggleFav() {
  const idx = MUANON_ADMIN.lightboxIdx;
  if (idx < 0) return;
  const a = MUANON_ADMIN.galleryData[idx];
  if (!a || !a.anh_id) return;
  try {
    const { data, error } = await supa.rpc('fn_muanon_admin_toggle_fav', {
      p_ma_admin: SESSION.ma, p_anh_id: a.anh_id
    });
    if (error) throw error;
    if (!data || !data.ok) throw new Error(data && data.message || 'Lỗi');
    a.is_fav = data.is_fav;
    // Update tất cả item cùng anh_id trong data hiện tại (Gallery + Timeline)
    MUANON_ADMIN.galleryData.forEach(x => { if (x.anh_id === a.anh_id) x.is_fav = data.is_fav; });
    if (Array.isArray(MUANON_ADMIN.timelineData)) {
      MUANON_ADMIN.timelineData.forEach(bg => {
        (bg.anh_list || []).forEach(x => { if (x.anh_id === a.anh_id) x.is_fav = data.is_fav; });
      });
    }
    mnaRenderLightbox();
    // Cập nhật heart icon ngoài grid (Gallery)
    document.querySelectorAll('[data-anh-id="' + a.anh_id + '"] .mna-fav-btn').forEach(btn => {
      btn.classList.toggle('on', data.is_fav);
    });
  } catch (err) {
    showToast('Lỗi: ' + (err.message || 'network'), 'err');
  }
}

// [v11.8] Toggle fav từ grid (không cần mở lightbox)
async function mnaToggleFav(anhId, ev) {
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  if (!anhId) return;
  try {
    const { data, error } = await supa.rpc('fn_muanon_admin_toggle_fav', {
      p_ma_admin: SESSION.ma, p_anh_id: anhId
    });
    if (error) throw error;
    if (!data || !data.ok) throw new Error(data && data.message || 'Lỗi');

    // Cập nhật trạng thái ở mọi nơi (gallery, timeline, fav data)
    const update = (arr) => { if (Array.isArray(arr)) arr.forEach(x => { if (x.anh_id === anhId) x.is_fav = data.is_fav; }); };
    update(MUANON_ADMIN.galleryData);
    if (Array.isArray(MUANON_ADMIN.timelineData)) {
      MUANON_ADMIN.timelineData.forEach(bg => update(bg.anh_list));
    }
    // Update heart icon DOM
    document.querySelectorAll('[data-anh-id="' + anhId + '"] .mna-fav-btn').forEach(btn => {
      btn.classList.toggle('on', data.is_fav);
    });

    // Nếu đang xem mode "Chỉ yêu thích" và unfav → remove item khỏi grid
    if (MUANON_ADMIN.galleryOnlyFav && !data.is_fav) {
      mnaLoadGallery();
    }
  } catch (err) {
    showToast('Lỗi: ' + (err.message || 'network'), 'err');
  }
}

function mnaRenderLightbox() {
  const idx = MUANON_ADMIN.lightboxIdx;
  if (idx < 0) return;
  const a = MUANON_ADMIN.galleryData[idx];
  if (!a) return;

  let lb = document.getElementById('mna-lightbox');
  if (!lb) {
    lb = document.createElement('div');
    lb.id = 'mna-lightbox';
    lb.className = 'mna-lightbox';
    lb.onclick = e => { if (e.target === lb) mnaCloseLightbox(); };
    document.body.appendChild(lb);
    requestAnimationFrame(() => lb.classList.add('open'));

    // [v11.12] Smooth swipe: transform translateX follow finger
    let startX = 0, startY = 0, dragX = 0, dragging = false, swiping = false;
    const SWIPE_THRESHOLD = 60;

    lb.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dragX = 0;
      dragging = true;
      swiping = false;
    }, { passive: true });

    lb.addEventListener('touchmove', e => {
      if (!dragging || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (!swiping) {
        // Decide horizontal swipe (vs vertical = close)
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.3) {
          swiping = true;
        } else if (Math.abs(dy) > 30 && Math.abs(dy) > Math.abs(dx) * 1.5) {
          // Vertical: stop drag (cho phép vuốt lên close ở touchend)
          dragging = false;
          return;
        }
      }
      if (swiping) {
        dragX = dx;
        const img = lb.querySelector('.mna-lb-img');
        if (img) {
          img.style.transition = 'none';
          img.style.transform = 'translateX(' + dx + 'px)';
        }
        e.preventDefault();
      }
    }, { passive: false });

    lb.addEventListener('touchend', e => {
      if (!dragging) {
        // Có thể là vuốt lên (vertical) → close
        const dy = e.changedTouches[0].clientY - startY;
        if (dy < -80) mnaCloseLightbox();
        return;
      }
      dragging = false;
      const img = lb.querySelector('.mna-lb-img');
      if (!swiping) { dragX = 0; return; }
      swiping = false;
      const w = (img && img.clientWidth) || window.innerWidth;
      if (Math.abs(dragX) > Math.min(SWIPE_THRESHOLD, w / 4)) {
        // Đủ ngưỡng → slide ra → next/prev
        const targetX = dragX < 0 ? -w : w;
        if (img) {
          img.style.transition = 'transform .22s cubic-bezier(.2,.7,.3,1), opacity .22s';
          img.style.transform = 'translateX(' + targetX + 'px)';
          img.style.opacity = '0';
        }
        setTimeout(() => mnaLightboxNav(dragX < 0 ? 1 : -1), 200);
      } else {
        // Bounce back
        if (img) {
          img.style.transition = 'transform .22s cubic-bezier(.2,.7,.3,1)';
          img.style.transform = 'translateX(0)';
        }
      }
      dragX = 0;
    });
  }

  const isFav = !!a.is_fav;
  lb.innerHTML = `
    <button class="mna-lb-close" onclick="mnaCloseLightbox()">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
    <div class="mna-lb-actions">
      <button class="mna-lb-act" onclick="mnaLightboxDownload()" title="Tải về máy">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </button>
      <button class="mna-lb-act danger" onclick="mnaLightboxDelete()" title="Xóa ảnh">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
      </button>
    </div>
    <button class="mna-lb-fav ${isFav ? 'on' : ''}" onclick="mnaLightboxToggleFav()" title="Yêu thích">
      <svg width="22" height="22" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
    </button>
    <button class="mna-lb-prev" onclick="mnaLightboxNav(-1)">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    </button>
    <button class="mna-lb-next" onclick="mnaLightboxNav(1)">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
    </button>
    <img src="${_mnaEscAttr(a.url || '')}" class="mna-lb-img" alt="" style="transform: translateX(0); opacity: 0; transition: opacity .2s"/>
    <div class="mna-lb-info">
      <div class="mna-lb-nv">${escHtml(a.ten_nv || '')} <span style="opacity:0.7">· ${escHtml(a.ma_nv || '')}</span></div>
      <div class="mna-lb-meta">${escHtml(a.ten_ch || a.ma_ch || '')}${a.khu_vuc ? ' · ' + escHtml(a.khu_vuc) : ''} ${a.tag ? '· <b style="color:' + mnaTagColor(a.tag) + '">' + escHtml(mnaTagLabel(a.tag)) + '</b>' : ''}</div>
      <div class="mna-lb-counter">${idx + 1} / ${MUANON_ADMIN.galleryData.length}</div>
    </div>
  `;
  // [v11.12] Fade in ảnh mới sau khi đã set src
  requestAnimationFrame(() => {
    const img = lb.querySelector('.mna-lb-img');
    if (img) { img.style.opacity = '1'; }
  });
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 3: CHƯA GỬI
// ════════════════════════════════════════════════════════════════════════════
async function mnaLoadChuaGui() {
  try {
    const { data, error } = await supa.rpc('fn_muanon_admin_chua_gui', {
      p_ma_admin: SESSION.ma,
      p_tuan_id: MUANON_ADMIN.tuanId,
      p_kv: MUANON_ADMIN.filters.kv,
      p_ch: MUANON_ADMIN.filters.ch
    });
    if (error) throw error;
    if (!data || !data.ok) throw new Error((data && data.message) || 'Lỗi');

    mnaRenderChuaGui(data.data || [], data.total || 0);
  } catch (err) {
    document.getElementById('muanon-admin-content').innerHTML =
      '<div class="mna-empty">Lỗi: ' + (err.message || 'network') + '</div>';
  }
}

function mnaRenderChuaGui(list, total) {
  const selected = MUANON_ADMIN.selectedNV;

  let html = _mnaRenderActiveFilters();
  html += `
    <div class="mna-filter-sticky">
      <div class="mna-toolbar">
        <input type="search" class="mna-search-input"
          placeholder="Tìm tên NV, mã NV, cửa hàng, khu vực..."
          value="${_mnaEscAttr(MUANON_ADMIN.filters.nv || '')}"
          oninput="mnaDebounceSearch(this.value)"/>
        <button class="mna-filter-btn" onclick="mnaOpenFilterSheet()" title="Bộ lọc">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          ${_mnaFilterBadge()}
        </button>
      </div>
      <div class="mna-cg-info">
        <span>${total} người chưa gửi · Đã chọn <b id="mna-cg-count">${selected.size}</b></span>
        <span class="mna-cg-actions">
          <button class="mna-bulk-btn" onclick="mnaSelectAll()">Chọn tất cả</button>
          <button class="mna-bulk-btn mna-bulk-btn-clear" onclick="mnaClearSelect()">Bỏ chọn</button>
        </span>
      </div>
    </div>
  `;

  if (list.length === 0) {
    html += '<div class="mna-empty">Tất cả NV đã gửi! 🎉</div>';
    document.getElementById('muanon-admin-content').innerHTML = html;
    return;
  }

  html += '<div class="mna-cg-list">';
  for (const nv of list) {
    const isSelected = selected.has(nv.ma_nv);
    const checkSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    html += `
      <div class="mna-cg-item ${isSelected ? 'selected' : ''}" data-ma-nv="${_mnaEscAttr(nv.ma_nv)}" onclick="mnaToggleSelect('${_mnaEscAttr(nv.ma_nv)}')">
        <div class="mna-cg-checkbox">${isSelected ? checkSvg : ''}</div>
        <div class="mna-cg-info-block">
          <div class="mna-cg-name">${escHtml(nv.ten_nv || '')}</div>
          <div class="mna-cg-meta">${escHtml(nv.ma_nv)} · ${escHtml(nv.ma_ch || '')} · ${escHtml(nv.khu_vuc || '')}</div>
        </div>
        ${nv.so_lan_nhac_admin > 0
          ? `<span class="mna-cg-reminded admin-${Math.min(nv.so_lan_nhac_admin, 3)}">BQL cảnh báo lần ${nv.so_lan_nhac_admin}</span>`
          : (nv.so_lan_nhac_auto > 0
              ? `<span class="mna-cg-reminded auto">Tự động nhắc ${nv.so_lan_nhac_auto}x</span>`
              : '')}
      </div>`;
  }
  html += '</div>';

  html += `
    <button class="mna-cg-fab" id="mna-cg-fab" onclick="mnaNhacBulk()" style="display:${selected.size > 0 ? 'flex' : 'none'}">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      <span>Gửi cảnh báo cho <b id="mna-cg-fab-count">${selected.size}</b> người</span>
    </button>
  `;

  document.getElementById('muanon-admin-content').innerHTML = html;
}

const _MNA_CHECK_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

function _mnaUpdateItemVisual(el, isSel) {
  if (!el) return;
  el.classList.toggle('selected', isSel);
  const cb = el.querySelector('.mna-cg-checkbox');
  if (cb) cb.innerHTML = isSel ? _MNA_CHECK_SVG : '';
}

function mnaToggleSelect(maNv) {
  const set = MUANON_ADMIN.selectedNV;
  if (set.has(maNv)) set.delete(maNv); else set.add(maNv);
  // Update DOM của item này (không reload)
  const el = document.querySelector('.mna-cg-item[data-ma-nv="' + CSS.escape(maNv) + '"]');
  _mnaUpdateItemVisual(el, set.has(maNv));
  mnaUpdateSelectUI();
}

function mnaSelectAll() {
  document.querySelectorAll('.mna-cg-item[data-ma-nv]').forEach(el => {
    const ma = el.getAttribute('data-ma-nv');
    MUANON_ADMIN.selectedNV.add(ma);
    _mnaUpdateItemVisual(el, true);
  });
  mnaUpdateSelectUI();
}

function mnaClearSelect() {
  MUANON_ADMIN.selectedNV.clear();
  document.querySelectorAll('.mna-cg-item').forEach(el => _mnaUpdateItemVisual(el, false));
  mnaUpdateSelectUI();
}

function mnaUpdateSelectUI() {
  const n = MUANON_ADMIN.selectedNV.size;
  const c1 = document.getElementById('mna-cg-count');
  if (c1) c1.textContent = n;
  const c2 = document.getElementById('mna-cg-fab-count');
  if (c2) c2.textContent = n;
  const fab = document.getElementById('mna-cg-fab');
  if (fab) fab.style.display = n > 0 ? 'flex' : 'none';
}

async function mnaNhacBulk() {
  const list = [...MUANON_ADMIN.selectedNV];
  if (list.length === 0) return;
  if (!confirm('Gửi cảnh báo cho ' + list.length + ' nhân viên chưa gửi mẫu nón tuần này?\n\nMỗi nhân viên sẽ nhận thông báo trong app + tăng số lần BQL cảnh báo.')) return;

  const fab = document.getElementById('mna-cg-fab');
  if (fab) { fab.disabled = true; fab.innerHTML = '<span>Đang gửi...</span>'; }

  try {
    const { data, error } = await supa.rpc('fn_muanon_admin_nhac_hangloat', {
      p_ma_admin: SESSION.ma,
      p_tuan_id: MUANON_ADMIN.tuanId,
      p_ma_nv_list: list
    });
    if (error) throw error;
    if (!data || !data.ok) throw new Error(data.message || 'Lỗi');

    showToast('✓ Đã nhắc ' + data.so_nguoi_nhac + ' người', 'ok');
    MUANON_ADMIN.selectedNV.clear();
    mnaLoadChuaGui();
  } catch (err) {
    showToast('Lỗi: ' + err.message, 'err');
    if (fab) { fab.disabled = false; mnaUpdateSelectUI(); }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 4: COMPLIANCE
// ════════════════════════════════════════════════════════════════════════════
async function mnaLoadCompliance() {
  try {
    const { data, error } = await supa.rpc('fn_muanon_admin_compliance', {
      p_ma_admin: SESSION.ma, p_so_tuan: 12
    });
    if (error) throw error;
    if (!data || !data.ok) throw new Error((data && data.message) || 'Lỗi');

    MUANON_ADMIN.cplData = data.data || [];
    mnaRenderCompliance();
  } catch (err) {
    document.getElementById('muanon-admin-content').innerHTML =
      '<div class="mna-empty">Lỗi: ' + (err.message || 'network') + '</div>';
  }
}

function mnaRenderCompliance() {
  const all = MUANON_ADMIN.cplData || [];
  const filterMode = MUANON_ADMIN.cplFilter || 'all';

  // Tính counts cho 4 cards
  const stats = { good: 0, mid: 0, low: 0, never: 0 };
  for (const c of all) {
    const pct = c.ti_le_co_gui_pct || 0;
    if (c.so_tuan_khong_gui === c.tong_tuan) stats.never++;
    else if (pct >= 80) stats.good++;
    else if (pct >= 40) stats.mid++;
    else stats.low++;
  }

  // Filter list theo card đang chọn
  let list = all;
  if (filterMode !== 'all') {
    list = all.filter(c => {
      const pct = c.ti_le_co_gui_pct || 0;
      if (filterMode === 'never') return c.so_tuan_khong_gui === c.tong_tuan;
      if (filterMode === 'good')  return c.so_tuan_khong_gui !== c.tong_tuan && pct >= 80;
      if (filterMode === 'mid')   return c.so_tuan_khong_gui !== c.tong_tuan && pct >= 40 && pct < 80;
      if (filterMode === 'low')   return c.so_tuan_khong_gui !== c.tong_tuan && pct < 40;
      return true;
    });
  }

  const cards = [
    { id: 'all',   label: 'Tất cả',     value: all.length, accent: 'neutral' },
    { id: 'good',  label: 'Tuân thủ tốt',  value: stats.good,  accent: 'green',  sub: '≥ 80%' },
    { id: 'mid',   label: 'Trung bình', value: stats.mid,   accent: 'amber',  sub: '40–79%' },
    { id: 'low',   label: 'Kém',        value: stats.low,   accent: 'red',    sub: '< 40%' },
    { id: 'never', label: 'Chưa từng gửi', value: stats.never, accent: 'gray', sub: '0 tuần' }
  ];

  let html = '<div class="mna-cpl-wrap">';
  html += '<div class="mna-cpl-cards">';
  for (const c of cards) {
    const active = filterMode === c.id;
    html += `
      <button class="mna-cpl-card a-${c.accent} ${active ? 'active' : ''}" onclick="mnaSetCplFilter('${c.id}')">
        <div class="mna-cpl-card-label">${c.label}</div>
        <div class="mna-cpl-card-value">${c.value}</div>
        ${c.sub ? '<div class="mna-cpl-card-sub">' + c.sub + '</div>' : ''}
      </button>
    `;
  }
  html += '</div>';

  html += `
    <div class="mna-cpl-search-row">
      <input type="text" class="mna-filter-search" placeholder="Tìm theo tên, mã NV, cửa hàng..." oninput="mnaFilterCompliance(this.value)"/>
      <div class="mna-cpl-info">${list.length} nhân viên</div>
    </div>
  `;

  if (list.length === 0) {
    html += '<div class="mna-empty">Không có nhân viên phù hợp</div></div>';
    document.getElementById('muanon-admin-content').innerHTML = html;
    return;
  }

  html += '<div class="mna-comp-list" id="mna-comp-list">';
  for (const c of list) {
    const pct = c.ti_le_dung_han_pct || 0;
    const pctGui = c.ti_le_co_gui_pct || 0;
    const cls = pctGui >= 80 ? 'good' : (pctGui >= 40 ? 'medium' : 'low');
    const search = _mnaEscAttr((c.ma_nv + ' ' + (c.ten_nv || '') + ' ' + (c.ma_ch || '')).toLowerCase());
    html += `
      <div class="mna-comp-item" data-search="${search}">
        <div class="mna-comp-row1">
          <div class="mna-comp-name">${escHtml(c.ten_nv || '')}<span style="opacity:0.6;font-weight:500"> · ${escHtml(c.ma_nv)}</span></div>
          <div class="mna-comp-pct mna-comp-${cls}">${pctGui}%</div>
        </div>
        <div class="mna-comp-meta">${escHtml(c.ma_ch || '')}${c.khu_vuc ? ' · ' + escHtml(c.khu_vuc) : ''}</div>
        <div class="mna-comp-bar"><div class="mna-comp-bar-fill mna-comp-bg-${cls}" style="width:${pctGui}%"></div></div>
        <div class="mna-comp-stats">
          <span>${c.tong_tuan} tuần</span>
          <span style="color:#0F6E56"><b>${c.so_tuan_dung_han}</b> đúng hạn</span>
          <span style="color:#BA7517"><b>${c.so_tuan_tre}</b> trễ</span>
          <span style="color:#B91C1C"><b>${c.so_tuan_khong_gui}</b> không gửi</span>
        </div>
      </div>`;
  }
  html += '</div></div>';
  document.getElementById('muanon-admin-content').innerHTML = html;
}

function mnaSetCplFilter(mode) {
  MUANON_ADMIN.cplFilter = mode;
  mnaRenderCompliance();
}

function mnaFilterCompliance(q) {
  q = (q || '').trim().toLowerCase();
  document.querySelectorAll('#mna-comp-list .mna-comp-item').forEach(el => {
    const m = el.getAttribute('data-search') || '';
    el.style.display = (!q || m.includes(q)) ? '' : 'none';
  });
}

// ════════════════════════════════════════════════════════════════════════════
// [v11.3] TAB TIMELINE — sort theo thời gian DESC, filter phong phú
// ════════════════════════════════════════════════════════════════════════════
async function mnaLoadTimeline() {
  if (!SESSION || !SESSION.ma) return;
  const tr = _mnaGetTimeRange();

  try {
    const { data, error } = await supa.rpc('fn_muanon_admin_timeline', {
      p_ma_admin: SESSION.ma,
      p_tuan_id: MUANON_ADMIN.tuanId || null,
      p_search: MUANON_ADMIN.filters.nv || null,
      p_tag: MUANON_ADMIN.filters.tag || null,
      p_trang_thai: MUANON_ADMIN.filters.trang_thai || null,
      p_kv: MUANON_ADMIN.filters.kv || null,
      p_tu_ngay: tr.from,
      p_den_ngay: tr.to,
      p_limit: MUANON_ADMIN.timelineLimit,
      p_offset: MUANON_ADMIN.timelineOffset
    });

    if (error) throw error;
    if (!data || !data.ok) throw new Error((data && data.message) || 'Lỗi tải timeline');

    MUANON_ADMIN.timelineData = data.data || [];
    MUANON_ADMIN.timelineTotal = data.total || 0;
    mnaRenderTimeline();
  } catch (err) {
    document.getElementById('muanon-admin-content').innerHTML =
      '<div class="mna-empty">Lỗi: ' + (err.message || 'network') + '</div>';
  }
}

function mnaRenderTimeline() {
  const data = MUANON_ADMIN.timelineData;
  const total = MUANON_ADMIN.timelineTotal;

  let html = _mnaRenderActiveFilters();
  html += `
    <div class="mna-filter-sticky">
      <div class="mna-toolbar">
        <input type="search" class="mna-search-input"
          placeholder="Tìm tên NV, mã NV, cửa hàng, khu vực..."
          value="${_mnaEscAttr(MUANON_ADMIN.filters.nv || '')}"
          oninput="mnaDebounceSearch(this.value)"/>
        <button class="mna-filter-btn" onclick="mnaOpenFilterSheet()" title="Bộ lọc">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          ${_mnaFilterBadge()}
        </button>
      </div>
      ${_mnaRenderTimeRangeChips()}
      <div class="mna-tl-info">${total} bài gửi</div>
    </div>
  `;

  if (data.length === 0) {
    html += '<div class="mna-empty">Không có bài gửi nào phù hợp</div>';
    document.getElementById('muanon-admin-content').innerHTML = html;
    return;
  }

  html += '<div class="mna-tl-list">';
  data.forEach((bg, idx) => {
    const ts = bg.ngay_gui ? _mnaRelativeTime(bg.ngay_gui) : '';
    const tsAbs = bg.ngay_gui ? _mnaFmtDateTime(bg.ngay_gui) : '';
    const badgeCls = bg.dung_han ? 'ok' : 'late';
    const badgeText = bg.dung_han ? 'Đúng hạn' : 'Trễ';

    const anhList = bg.anh_list || [];
    const showMax = 4;
    const overflow = anhList.length - showMax;
    const grid = anhList.slice(0, showMax).map((a, ai) => {
      const tagColor = a.tag ? mnaTagColor(a.tag) : null;
      const tagBadge = a.tag ? `<span class="mna-tl-img-tag" style="background:${tagColor}">${escHtml(mnaTagLabel(a.tag))}</span>` : '';
      const overlayN = ai === showMax - 1 && overflow > 0
        ? '<div class="mna-tl-img-overlay">+' + overflow + '</div>' : '';
      return `<div class="mna-tl-img-wrap" data-anh-id="${a.anh_id}" onclick="mnaOpenTimelineLightbox(${idx}, ${ai})">
        <img src="${_mnaEscAttr(a.url)}" loading="lazy"/>
        ${overlayN}${tagBadge}
        ${a.is_fav ? '<div class="mna-tl-fav-dot"></div>' : ''}
      </div>`;
    }).join('');

    // Tag stats with brand color
    const tagCount = {};
    anhList.forEach(a => { if (a.tag) tagCount[a.tag] = (tagCount[a.tag] || 0) + 1; });
    const tagChips = Object.keys(tagCount).map(c =>
      `<span class="mna-tl-chip" style="background:${mnaTagColor(c)};color:#fff">${escHtml(mnaTagLabel(c))} · ${tagCount[c]}</span>`
    ).join('');

    const initials = (bg.ten_nv || bg.ma_nv || '?').trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase();

    html += `
      <div class="mna-tl-card">
        <div class="mna-tl-head">
          <div class="mna-tl-avatar">${escHtml(initials)}</div>
          <div class="mna-tl-head-info">
            <div class="mna-tl-name">${escHtml(bg.ten_nv || bg.ma_nv || '')}
              <span class="mna-tl-ma">· ${escHtml(bg.ma_nv || '')}</span>
            </div>
            <div class="mna-tl-meta">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="11" height="11" style="vertical-align:-1px"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              ${escHtml(bg.ten_ch || bg.ma_ch || '?')}${bg.khu_vuc ? ' · ' + escHtml(bg.khu_vuc) : ''}
            </div>
            <div class="mna-tl-time" title="${escHtml(tsAbs)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="11" height="11" style="vertical-align:-1px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ${ts} · ${escHtml(bg.tuan_code || '')}
            </div>
          </div>
          <div class="mna-tl-badge ${badgeCls}">${badgeText}</div>
        </div>
        ${bg.mo_ta ? '<div class="mna-tl-mota">' + escHtml(bg.mo_ta) + '</div>' : ''}
        <div class="mna-tl-grid count-${Math.min(anhList.length, showMax)}">${grid}</div>
        ${tagChips ? '<div class="mna-tl-chips">' + tagChips + '</div>' : ''}
      </div>
    `;
  });
  html += '</div>';

  // Pagination
  if (total > MUANON_ADMIN.timelineLimit) {
    const cur = Math.floor(MUANON_ADMIN.timelineOffset / MUANON_ADMIN.timelineLimit) + 1;
    const maxP = Math.ceil(total / MUANON_ADMIN.timelineLimit);
    html += `
      <div class="mna-tl-pager">
        <button class="mna-pager-btn" ${MUANON_ADMIN.timelineOffset === 0 ? 'disabled' : ''} onclick="mnaTimelinePage(-1)">Trước</button>
        <span>Trang ${cur} / ${maxP}</span>
        <button class="mna-pager-btn" ${cur >= maxP ? 'disabled' : ''} onclick="mnaTimelinePage(1)">Tiếp</button>
      </div>
    `;
  }

  document.getElementById('muanon-admin-content').innerHTML = html;
}

function mnaTimelinePage(dir) {
  MUANON_ADMIN.timelineOffset = Math.max(0, MUANON_ADMIN.timelineOffset + dir * MUANON_ADMIN.timelineLimit);
  mnaLoadTimeline();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function mnaOpenTimelineLightbox(bgIdx, anhIdx) {
  // [v11.8] Flatten TOÀN BỘ ảnh trong timeline (giữ thứ tự) để swipe liên tục
  // qua bài đăng kế tiếp (cross-baigui swipe)
  const items = [];
  let startIdx = 0;
  MUANON_ADMIN.timelineData.forEach((bg, bi) => {
    (bg.anh_list || []).forEach((a, ai) => {
      if (bi === bgIdx && ai === anhIdx) startIdx = items.length;
      items.push({
        anh_id: a.anh_id,
        baigui_id: bg.baigui_id,
        url: a.url, url_full: a.url_full || a.url,
        tag: a.tag,
        is_fav: !!a.is_fav,
        ten_nv: bg.ten_nv, ma_nv: bg.ma_nv,
        ma_ch: bg.ma_ch, ten_ch: bg.ten_ch, khu_vuc: bg.khu_vuc,
        ngay_gui: bg.ngay_gui, tuan_code: bg.tuan_code
      });
    });
  });
  MUANON_ADMIN.lightboxSource = 'timeline';
  MUANON_ADMIN.galleryData = items;  // reuse lightbox renderer
  // [v11.8] Lưu scroll position của Timeline để restore
  MUANON_ADMIN._scrollY = window.scrollY;
  MUANON_ADMIN.lightboxIdx = startIdx;
  mnaRenderLightbox();
}

// ════════════════════════════════════════════════════════════════════════════
// [v11.3] FILTER SHEET (bottom sheet) — bộ lọc đầy đủ
// ════════════════════════════════════════════════════════════════════════════
function mnaOpenFilterSheet() {
  const old = document.getElementById('mna-filter-sheet');
  if (old) old.remove();

  const f = MUANON_ADMIN.filters;
  const tr = MUANON_ADMIN.timeRange;
  const tagsHtml = MUANON_TAGS_ADMIN.map(t =>
    `<button class="mna-fs-chip ${f.tag === t.code ? 'active' : ''}" data-fs-key="tag" data-fs-val="${t.code}" onclick="mnaFilterSheetSet('tag', '${t.code}')">${t.label}</button>`
  ).join('');

  // KV options từ data hiện có (không hardcoded)
  const kvSet = new Set();
  (MUANON_ADMIN.galleryData || []).forEach(d => { if (d.khu_vuc) kvSet.add(d.khu_vuc); });
  (MUANON_ADMIN.timelineData || []).forEach(d => { if (d.khu_vuc) kvSet.add(d.khu_vuc); });
  const kvHtml = [...kvSet].sort().map(kv =>
    `<button class="mna-fs-chip ${f.kv === kv ? 'active' : ''}" data-fs-key="kv" data-fs-val="${_mnaEscAttr(kv)}" onclick="mnaFilterSheetSet('kv', ${JSON.stringify(kv)})">${escHtml(kv)}</button>`
  ).join('');

  const overlay = document.createElement('div');
  overlay.id = 'mna-filter-sheet';
  overlay.className = 'mna-fs-overlay';
  overlay.onclick = e => { if (e.target === overlay) mnaCloseFilterSheet(); };
  overlay.innerHTML = `
    <div class="mna-fs-sheet" onclick="event.stopPropagation()">
      <div class="mna-fs-handle"></div>
      <div class="mna-fs-header">
        <div class="mna-fs-title">Bộ lọc</div>
        <button class="mna-fs-clear" onclick="mnaClearAllFilters();">Xóa tất cả</button>
      </div>

      <div class="mna-fs-group">
        <div class="mna-fs-label">Trạng thái gửi</div>
        <div class="mna-fs-chips">
          <button class="mna-fs-chip ${!f.trang_thai ? 'active' : ''}" data-fs-key="trang_thai" data-fs-val="__null__" onclick="mnaFilterSheetSet('trang_thai', null)">Tất cả</button>
          <button class="mna-fs-chip ${f.trang_thai === 'DUNG_HAN' ? 'active' : ''}" data-fs-key="trang_thai" data-fs-val="DUNG_HAN" onclick="mnaFilterSheetSet('trang_thai', 'DUNG_HAN')">Đúng hạn</button>
          <button class="mna-fs-chip ${f.trang_thai === 'TRE' ? 'active' : ''}" data-fs-key="trang_thai" data-fs-val="TRE" onclick="mnaFilterSheetSet('trang_thai', 'TRE')">Trễ</button>
        </div>
      </div>

      <div class="mna-fs-group">
        <div class="mna-fs-label">Khoảng thời gian gửi</div>
        <div class="mna-fs-chips">
          <button class="mna-fs-chip ${tr.mode === 'all' ? 'active' : ''}" onclick="mnaSetTimeRange('all')">Tất cả</button>
          <button class="mna-fs-chip ${tr.mode === 'today' ? 'active' : ''}" onclick="mnaSetTimeRange('today')">Hôm nay</button>
          <button class="mna-fs-chip ${tr.mode === 'week' ? 'active' : ''}" onclick="mnaSetTimeRange('week')">Tuần này</button>
          <button class="mna-fs-chip ${tr.mode === 'month' ? 'active' : ''}" onclick="mnaSetTimeRange('month')">Tháng này</button>
          <button class="mna-fs-chip ${tr.mode === 'custom' ? 'active' : ''}" onclick="mnaSetTimeRange('custom')">Tuỳ chọn</button>
        </div>
        <div class="mna-fs-date-row" id="mna-fs-date-row" style="${tr.mode === 'custom' ? '' : 'display:none'}">
          <div class="mna-fs-date-col">
            <div class="mna-fs-date-lbl">Từ ngày</div>
            <input type="date" class="mna-fs-date-input" value="${tr.from_date || ''}" onchange="mnaSetCustomDate('from', this.value)"/>
          </div>
          <div class="mna-fs-date-col">
            <div class="mna-fs-date-lbl">Đến ngày</div>
            <input type="date" class="mna-fs-date-input" value="${tr.to_date || ''}" onchange="mnaSetCustomDate('to', this.value)"/>
          </div>
        </div>
      </div>

      ${kvHtml ? `
      <div class="mna-fs-group">
        <div class="mna-fs-label">Khu vực</div>
        <div class="mna-fs-chips">
          <button class="mna-fs-chip ${!f.kv ? 'active' : ''}" data-fs-key="kv" data-fs-val="__null__" onclick="mnaFilterSheetSet('kv', null)">Tất cả</button>
          ${kvHtml}
        </div>
      </div>
      ` : ''}

      <div class="mna-fs-group">
        <div class="mna-fs-label">Loại nón</div>
        <div class="mna-fs-chips">
          <button class="mna-fs-chip ${!f.tag ? 'active' : ''}" data-fs-key="tag" data-fs-val="__null__" onclick="mnaFilterSheetSet('tag', null)">Tất cả</button>
          ${tagsHtml}
        </div>
      </div>

      <button class="mna-fs-apply" onclick="mnaCloseFilterSheet()">Đóng</button>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
}

function mnaCloseFilterSheet() {
  const ov = document.getElementById('mna-filter-sheet');
  if (ov) { ov.classList.remove('open'); setTimeout(() => ov.remove(), 220); }
}

function mnaFilterSheetSet(key, val) {
  // Click chip lần 2 trên giá trị đang active = bỏ
  if (MUANON_ADMIN.filters[key] === val) val = null;
  MUANON_ADMIN.filters[key] = val;
  MUANON_ADMIN.galleryOffset = 0;
  MUANON_ADMIN.timelineOffset = 0;
  // Update active state trong sheet (KHÔNG destroy+rebuild → tránh giật)
  _mnaUpdateFilterSheetActive();
  // Reload underlying tab data (sheet vẫn open)
  if (MUANON_ADMIN.currentTab === 'gallery') mnaLoadGallery();
  else if (MUANON_ADMIN.currentTab === 'chuagui') mnaLoadChuaGui();
  else if (MUANON_ADMIN.currentTab === 'timeline') mnaLoadTimeline();
}

function _mnaUpdateFilterSheetActive() {
  const sheet = document.getElementById('mna-filter-sheet');
  if (!sheet) return;
  // Tất cả chip có data-fs-key + data-fs-val
  sheet.querySelectorAll('[data-fs-key]').forEach(btn => {
    const k = btn.getAttribute('data-fs-key');
    const v = btn.getAttribute('data-fs-val');
    const realV = v === '__null__' ? null : v;
    btn.classList.toggle('active', MUANON_ADMIN.filters[k] === realV);
  });
}

function mnaSetTimeRange(mode) {
  if (MUANON_ADMIN.timeRange.mode === mode) mode = 'all';
  MUANON_ADMIN.timeRange.mode = mode;
  MUANON_ADMIN.galleryOffset = 0;
  MUANON_ADMIN.timelineOffset = 0;
  // Update sheet UI in-place if open
  const dateRow = document.getElementById('mna-fs-date-row');
  if (dateRow) dateRow.style.display = (mode === 'custom') ? '' : 'none';
  // Update time chip active state
  const sheet = document.getElementById('mna-filter-sheet');
  if (sheet) {
    sheet.querySelectorAll('.mna-fs-chips button').forEach(b => {
      const txt = b.textContent.trim();
      const map = { 'Tất cả': 'all', 'Hôm nay': 'today', 'Tuần này': 'week', 'Tháng này': 'month', 'Tuỳ chọn': 'custom' };
      if (b.parentElement && b.parentElement.previousElementSibling &&
          /thời gian/i.test(b.parentElement.previousElementSibling.textContent || '')) {
        b.classList.toggle('active', map[txt] === mode);
      }
    });
  }
  // Also update time chips strip (above content)
  document.querySelectorAll('.mna-time-chip').forEach(c => {
    c.classList.toggle('active', c.textContent.trim().toLowerCase() ===
      ({ all: 'tất cả', today: 'hôm nay', week: 'tuần này', month: 'tháng này', custom: 'tuỳ chọn' })[mode]);
  });
  if (MUANON_ADMIN.currentTab === 'timeline') mnaLoadTimeline();
  else if (MUANON_ADMIN.currentTab === 'gallery') mnaLoadGallery();
}

function mnaClearAllFilters() {
  MUANON_ADMIN.filters = { kv: null, ch: null, nv: null, tag: null, trang_thai: null };
  MUANON_ADMIN.timeRange = { mode: 'all', from: null, to: null, from_date: null, to_date: null };
  MUANON_ADMIN.galleryOffset = 0;
  MUANON_ADMIN.timelineOffset = 0;
  // Update sheet in-place
  _mnaUpdateFilterSheetActive();
  const dateRow = document.getElementById('mna-fs-date-row');
  if (dateRow) dateRow.style.display = 'none';
  if (MUANON_ADMIN.currentTab === 'gallery') mnaLoadGallery();
  else if (MUANON_ADMIN.currentTab === 'chuagui') mnaLoadChuaGui();
  else if (MUANON_ADMIN.currentTab === 'timeline') mnaLoadTimeline();
  else if (MUANON_ADMIN.currentTab === 'tongquan') mnaLoadTongQuan();
}

function _mnaGetTimeRange() {
  const tr = MUANON_ADMIN.timeRange;
  const m = tr.mode;
  if (m === 'all') return { from: null, to: null };
  if (m === 'custom') {
    return {
      from: tr.from_date ? new Date(tr.from_date + 'T00:00:00+07:00').toISOString() : null,
      to:   tr.to_date   ? new Date(tr.to_date   + 'T23:59:59+07:00').toISOString() : null
    };
  }
  const now = new Date();
  let from;
  if (m === 'today') {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (m === 'week') {
    const dow = (now.getDay() + 6) % 7; // T2=0...CN=6
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow);
  } else if (m === 'month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return { from: from ? from.toISOString() : null, to: null };
}

function mnaSetCustomDate(which, val) {
  if (which === 'from') MUANON_ADMIN.timeRange.from_date = val || null;
  else MUANON_ADMIN.timeRange.to_date = val || null;
  // Auto reload
  MUANON_ADMIN.galleryOffset = 0;
  MUANON_ADMIN.timelineOffset = 0;
  if (MUANON_ADMIN.currentTab === 'timeline') mnaLoadTimeline();
  else if (MUANON_ADMIN.currentTab === 'gallery') mnaLoadGallery();
}

function _mnaRenderTimeRangeChips() {
  const m = MUANON_ADMIN.timeRange.mode;
  const opts = [
    { id: 'all', label: 'Tất cả' },
    { id: 'today', label: 'Hôm nay' },
    { id: 'week', label: 'Tuần này' },
    { id: 'month', label: 'Tháng này' }
  ];
  return '<div class="mna-time-chips">' + opts.map(o =>
    `<button class="mna-time-chip ${m === o.id ? 'active' : ''}" onclick="mnaSetTimeRange('${o.id}')">${o.label}</button>`
  ).join('') + '</div>';
}

function _mnaFilterBadge() {
  const f = MUANON_ADMIN.filters;
  let n = 0;
  if (f.kv) n++;
  if (f.tag) n++;
  if (f.trang_thai) n++;
  if (MUANON_ADMIN.timeRange.mode !== 'all') n++;
  return n > 0 ? '<span class="mna-filter-badge">' + n + '</span>' : '';
}

function _mnaRelativeTime(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'Vừa xong';
  if (diff < 3600) return Math.floor(diff / 60) + ' phút trước';
  if (diff < 86400) return Math.floor(diff / 3600) + ' giờ trước';
  if (diff < 604800) return Math.floor(diff / 86400) + ' ngày trước';
  // Trên 1 tuần: hiện date
  const pad = n => String(n).padStart(2, '0');
  return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
}

function _mnaFmtDateTime(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' +
         pad(d.getHours()) + ':' + pad(d.getMinutes());
}

// ════════════════════════════════════════════════════════════════════════════
// [v11.9] MULTI-SELECT + BỘ SƯU TẬP (ALBUM)
// ════════════════════════════════════════════════════════════════════════════

// [v11.10] Toggle select mode CHỈ TOGGLE CSS CLASS — không re-render → mượt 100%
function mnaToggleSelectMode() {
  MUANON_ADMIN.selectMode = !MUANON_ADMIN.selectMode;
  if (!MUANON_ADMIN.selectMode) MUANON_ADMIN.selectedAnh.clear();

  // Toggle class trên container Gallery
  const grid = document.querySelector('.mna-gallery-grid');
  if (grid) grid.classList.toggle('sel-mode', MUANON_ADMIN.selectMode);

  // Toggle toolbar UI (in-place, không re-render)
  _mnaRenderToolbarOnly();
  // Toggle multi-bar
  _mnaSyncMultiBar();
}

// Re-render CHỈ toolbar (không động đến grid)
function _mnaRenderToolbarOnly() {
  const sticky = document.querySelector('.mna-filter-sticky');
  if (!sticky) return;
  const selMode = MUANON_ADMIN.selectMode;
  const selCount = MUANON_ADMIN.selectedAnh.size;
  const onlyFav = !!MUANON_ADMIN.galleryOnlyFav;
  const inAlbum = !!MUANON_ADMIN.currentAlbumId;
  const albumName = MUANON_ADMIN.currentAlbumName || '';

  let html = '<div class="mna-toolbar">';
  if (selMode) {
    html += `
      <button class="mna-sel-cancel" onclick="mnaToggleSelectMode()">Hủy chọn</button>
      <div class="mna-sel-count">Đã chọn <b>${selCount}</b></div>
      <button class="mna-sel-all" onclick="mnaSelectAllGallery()">Chọn tất cả</button>`;
  } else {
    html += `
      <input type="search" class="mna-search-input"
        placeholder="${onlyFav ? 'Đang xem ảnh yêu thích' : (inAlbum ? 'Đang xem bộ sưu tập: ' + escHtml(albumName) : 'Tìm tên NV, mã NV, cửa hàng, khu vực...')}"
        value="${_mnaEscAttr(MUANON_ADMIN.filters.nv || '')}"
        oninput="mnaDebounceSearch(this.value)"
        ${(onlyFav || inAlbum) ? 'disabled' : ''}/>
      <button class="mna-filter-btn ${onlyFav ? 'on-fav' : ''}" onclick="mnaToggleOnlyFav()" title="${onlyFav ? 'Xem tất cả' : 'Chỉ yêu thích'}" ${inAlbum ? 'disabled' : ''}>
        <svg viewBox="0 0 24 24" fill="${onlyFav ? '#EF4444' : 'none'}" stroke="${onlyFav ? '#EF4444' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      </button>
      <button class="mna-filter-btn" onclick="mnaOpenAlbumSheet()" title="Bộ sưu tập">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      </button>
      <button class="mna-filter-btn" onclick="mnaToggleSelectMode()" title="Chọn nhiều">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="9 11 12 14 22 4"/></svg>
      </button>`;
    if (!inAlbum && !onlyFav) {
      html += `
        <button class="mna-filter-btn" onclick="mnaOpenFilterSheet()" title="Bộ lọc">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          ${_mnaFilterBadge()}
        </button>`;
    }
  }
  html += '</div>';
  // Replace toolbar trong sticky (giữ phần khác như zoom-row)
  const oldTb = sticky.querySelector('.mna-toolbar');
  if (oldTb) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    oldTb.replaceWith(tmp.firstElementChild);
  }
}

// Hiện/ẩn multi-bar bottom + update count
function _mnaSyncMultiBar() {
  let bar = document.getElementById('mna-multi-bar');
  const selMode = MUANON_ADMIN.selectMode;
  const selCount = MUANON_ADMIN.selectedAnh.size;
  const inAlbum = !!MUANON_ADMIN.currentAlbumId;

  if (!selMode || selCount === 0) {
    if (bar) bar.style.display = 'none';
    return;
  }
  if (!bar) {
    // Tạo mới (1 lần)
    bar = document.createElement('div');
    bar.id = 'mna-multi-bar';
    bar.className = 'mna-multi-bar';
    document.body.appendChild(bar);
  }
  bar.style.display = 'flex';
  bar.innerHTML = `
    <div class="mna-multi-info">Đã chọn <b id="mna-multi-count">${selCount}</b></div>
    <div class="mna-multi-actions">
      <button class="mna-multi-act" onclick="mnaBulkFav()" title="Yêu thích">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      </button>
      <button class="mna-multi-act" onclick="mnaOpenAlbumSheet()" title="Thêm vào bộ sưu tập">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      </button>
      <button class="mna-multi-act" onclick="mnaBulkDownload()" title="Tải xuống">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </button>
      <button class="mna-multi-act" onclick="mnaBulkShare()" title="Chia sẻ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
      </button>
      ${inAlbum ? `
        <button class="mna-multi-act danger" onclick="mnaBulkRemoveFromAlbum()" title="Xóa khỏi bộ sưu tập">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>` : ''}
      <button class="mna-multi-act danger" onclick="mnaBulkDelete()" title="Xóa vĩnh viễn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
      </button>
    </div>
  `;
}

function mnaToggleAnhSelect(anhId, ev) {
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  if (!MUANON_ADMIN.selectMode) return;
  const set = MUANON_ADMIN.selectedAnh;
  if (set.has(anhId)) set.delete(anhId); else set.add(anhId);
  // Update DOM của item này (NO re-render)
  const el = document.querySelector('.mna-gallery-item[data-anh-id="' + anhId + '"]');
  if (el) {
    el.classList.toggle('selected', set.has(anhId));
    const cb = el.querySelector('.mna-sel-cb');
    if (cb) cb.classList.toggle('on', set.has(anhId));
    if (cb) cb.innerHTML = set.has(anhId)
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
      : '';
  }
  _mnaSyncMultiBar();
}

function _mnaUpdateMultiBar() { _mnaSyncMultiBar(); }

function mnaSelectAllGallery() {
  MUANON_ADMIN.galleryData.forEach(a => MUANON_ADMIN.selectedAnh.add(a.anh_id));
  document.querySelectorAll('.mna-gallery-item').forEach(el => {
    el.classList.add('selected');
    const cb = el.querySelector('.mna-sel-cb');
    if (cb) {
      cb.classList.add('on');
      cb.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    }
  });
  _mnaRenderToolbarOnly();
  _mnaSyncMultiBar();
}

function mnaClearSelectAnh() {
  MUANON_ADMIN.selectedAnh.clear();
  document.querySelectorAll('.mna-gallery-item').forEach(el => {
    el.classList.remove('selected');
    const cb = el.querySelector('.mna-sel-cb');
    if (cb) { cb.classList.remove('on'); cb.innerHTML = ''; }
  });
  _mnaSyncMultiBar();
  _mnaRenderToolbarOnly();
}

// ─── Bulk actions ───────────────────────────────────────────────────────────
async function mnaBulkFav() {
  const ids = [...MUANON_ADMIN.selectedAnh];
  if (ids.length === 0) return;
  if (!confirm('Đánh dấu yêu thích ' + ids.length + ' ảnh đã chọn?')) return;
  let ok = 0;
  for (const id of ids) {
    try {
      const { data } = await supa.rpc('fn_muanon_admin_toggle_fav', {
        p_ma_admin: SESSION.ma, p_anh_id: id
      });
      if (data && data.ok && data.is_fav) ok++;
    } catch (e) {}
  }
  showToast('✓ Đã yêu thích ' + ok + ' ảnh', 'ok');
  MUANON_ADMIN.selectMode = false;
  MUANON_ADMIN.selectedAnh.clear();
  mnaLoadGallery();
}

// [v11.10] Force download file qua blob (KHÔNG mở link Supabase)
async function _mnaDownloadFile(url, filename) {
  try {
    const r = await fetch(url, { mode: 'cors' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const blob = await r.blob();
    const objUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
    return true;
  } catch (e) {
    // Fallback: mở link mới (CORS fail)
    window.open(url, '_blank');
    return false;
  }
}

async function mnaBulkDownload() {
  const ids = [...MUANON_ADMIN.selectedAnh];
  if (ids.length === 0) return;
  const items = MUANON_ADMIN.galleryData.filter(a => ids.includes(a.anh_id));
  if (items.length === 0) return;

  // Toast progress
  showToast('Đang tải ' + items.length + ' ảnh...', 'ok');
  let ok = 0;
  for (const a of items) {
    const url = a.url_full || a.url;
    if (!url) continue;
    const filename = 'NS_' + (a.ma_nv || '') + '_' + (a.anh_id || '') + '.jpg';
    const success = await _mnaDownloadFile(url, filename);
    if (success) ok++;
    await new Promise(r => setTimeout(r, 180));
  }
  showToast('✓ Đã tải ' + ok + '/' + items.length + ' ảnh', 'ok');
}

// Tải 1 ảnh trong lightbox
async function mnaLightboxDownload() {
  const idx = MUANON_ADMIN.lightboxIdx;
  if (idx < 0) return;
  const a = MUANON_ADMIN.galleryData[idx];
  if (!a) return;
  const url = a.url_full || a.url;
  if (!url) return;
  const filename = 'NS_' + (a.ma_nv || '') + '_' + (a.anh_id || '') + '.jpg';
  const ok = await _mnaDownloadFile(url, filename);
  showToast(ok ? '✓ Đã tải về máy' : 'Mở link mới (CORS)', ok ? 'ok' : 'err');
}

// [v11.10] Xóa nhiều ảnh
async function mnaBulkDelete() {
  const ids = [...MUANON_ADMIN.selectedAnh];
  if (ids.length === 0) return;
  if (!confirm('Xóa ' + ids.length + ' ảnh đã chọn?\n\n⚠️ Ảnh sẽ bị xóa VĨNH VIỄN khỏi hệ thống (cả tài khoản NV gửi cũng không còn).\nKhông thể hoàn tác.')) return;
  try {
    const { data, error } = await supa.rpc('fn_muanon_admin_xoa_anh', {
      p_ma_admin: SESSION.ma, p_anh_ids: ids
    });
    if (error) throw error;
    if (!data || !data.ok) throw new Error(data && data.message || 'Lỗi');
    showToast('✓ Đã xóa ' + (data.so_xoa || 0) + ' ảnh', 'ok');
    MUANON_ADMIN.selectMode = false;
    MUANON_ADMIN.selectedAnh.clear();
    mnaLoadGallery();
  } catch (err) {
    showToast('Lỗi: ' + (err.message || 'network'), 'err');
  }
}

// [v11.10] Xóa 1 ảnh trong lightbox
async function mnaLightboxDelete() {
  const idx = MUANON_ADMIN.lightboxIdx;
  if (idx < 0) return;
  const a = MUANON_ADMIN.galleryData[idx];
  if (!a || !a.anh_id) return;
  if (!confirm('Xóa ảnh này?\n\n⚠️ Ảnh sẽ bị xóa VĨNH VIỄN khỏi hệ thống.')) return;
  try {
    const { data, error } = await supa.rpc('fn_muanon_admin_xoa_anh', {
      p_ma_admin: SESSION.ma, p_anh_ids: [a.anh_id]
    });
    if (error) throw error;
    if (!data || !data.ok) throw new Error(data && data.message || 'Lỗi');
    showToast('✓ Đã xóa', 'ok');
    // Remove khỏi galleryData + đóng/chuyển ảnh
    MUANON_ADMIN.galleryData.splice(idx, 1);
    if (MUANON_ADMIN.galleryData.length === 0) {
      mnaCloseLightbox();
    } else {
      MUANON_ADMIN.lightboxIdx = Math.min(idx, MUANON_ADMIN.galleryData.length - 1);
      mnaRenderLightbox();
    }
  } catch (err) {
    showToast('Lỗi: ' + (err.message || 'network'), 'err');
  }
}

async function mnaBulkShare() {
  const ids = [...MUANON_ADMIN.selectedAnh];
  if (ids.length === 0) return;
  const items = MUANON_ADMIN.galleryData.filter(a => ids.includes(a.anh_id));
  const urls = items.map(a => a.url_full || a.url).filter(Boolean);
  if (urls.length === 0) return;

  // Web Share API nếu hỗ trợ (mobile)
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Ảnh mẫu nón Nón Sơn',
        text: 'Chia sẻ ' + items.length + ' ảnh mẫu nón',
        url: urls[0]
      });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }

  // Fallback: copy URLs vào clipboard
  try {
    await navigator.clipboard.writeText(urls.join('\n'));
    showToast('✓ Đã copy ' + urls.length + ' URL vào clipboard', 'ok');
  } catch (e) {
    showToast('Trình duyệt không hỗ trợ chia sẻ', 'err');
  }
}

// ─── Album sheet ────────────────────────────────────────────────────────────
async function mnaOpenAlbumSheet() {
  // Load albums
  try {
    const { data, error } = await supa.rpc('fn_muanon_admin_album_list', { p_ma_admin: SESSION.ma });
    if (error) throw error;
    if (!data || !data.ok) throw new Error(data && data.message || 'Lỗi');
    MUANON_ADMIN.albums = data.data || [];
  } catch (err) {
    showToast('Lỗi tải bộ sưu tập: ' + err.message, 'err');
    return;
  }

  const old = document.getElementById('mna-album-sheet');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = 'mna-album-sheet';
  overlay.className = 'mna-fs-overlay';
  overlay.onclick = e => { if (e.target === overlay) mnaCloseAlbumSheet(); };

  const isMulti = MUANON_ADMIN.selectMode && MUANON_ADMIN.selectedAnh.size > 0;
  const albumsHtml = MUANON_ADMIN.albums.length > 0
    ? MUANON_ADMIN.albums.map(al => `
        <div class="mna-album-card" onclick="${isMulti ? 'mnaAddSelToAlbum(' + al.id + ')' : 'mnaOpenAlbum(' + al.id + ', ' + JSON.stringify(al.ten).replace(/"/g, '&quot;') + ')'}">
          <div class="mna-album-cover">
            ${al.cover_url ? '<img src="' + _mnaEscAttr(al.cover_url) + '" loading="lazy"/>' : '<div class="mna-album-empty">📁</div>'}
            <span class="mna-album-count">${al.so_anh}</span>
          </div>
          <div class="mna-album-name">${escHtml(al.ten)}</div>
        </div>
      `).join('')
    : '<div class="mna-album-empty-state">Chưa có bộ sưu tập nào</div>';

  overlay.innerHTML = `
    <div class="mna-fs-sheet" onclick="event.stopPropagation()">
      <div class="mna-fs-handle"></div>
      <div class="mna-fs-header">
        <div class="mna-fs-title">${isMulti ? 'Thêm ' + MUANON_ADMIN.selectedAnh.size + ' ảnh vào...' : 'Bộ sưu tập'}</div>
        <button class="mna-fs-clear" onclick="mnaCloseAlbumSheet()">Đóng</button>
      </div>
      <button class="mna-album-create-btn" onclick="mnaPromptCreateAlbum(${isMulti ? 'true' : 'false'})">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Tạo bộ sưu tập mới
      </button>
      <div class="mna-album-grid">${albumsHtml}</div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
}

function mnaCloseAlbumSheet() {
  const ov = document.getElementById('mna-album-sheet');
  if (ov) { ov.classList.remove('open'); setTimeout(() => ov.remove(), 220); }
}

async function mnaPromptCreateAlbum(addAfter) {
  const ten = prompt('Tên bộ sưu tập:');
  if (!ten || !ten.trim()) return;
  try {
    const { data, error } = await supa.rpc('fn_muanon_admin_album_create', {
      p_ma_admin: SESSION.ma, p_ten: ten.trim()
    });
    if (error) throw error;
    if (!data || !data.ok) throw new Error(data && data.message || 'Lỗi');
    showToast('✓ Đã tạo "' + ten + '"', 'ok');
    if (addAfter && MUANON_ADMIN.selectedAnh.size > 0) {
      await mnaAddSelToAlbum(data.album_id);
    } else {
      mnaOpenAlbumSheet();
    }
  } catch (err) {
    showToast('Lỗi: ' + err.message, 'err');
  }
}

async function mnaAddSelToAlbum(albumId) {
  const ids = [...MUANON_ADMIN.selectedAnh];
  if (ids.length === 0) return;
  try {
    const { data, error } = await supa.rpc('fn_muanon_admin_album_add', {
      p_ma_admin: SESSION.ma, p_album_id: albumId, p_anh_ids: ids
    });
    if (error) throw error;
    if (!data || !data.ok) throw new Error(data && data.message || 'Lỗi');
    showToast('✓ Đã thêm ' + (data.so_anh_them || ids.length) + ' ảnh', 'ok');
    mnaCloseAlbumSheet();
    MUANON_ADMIN.selectMode = false;
    MUANON_ADMIN.selectedAnh.clear();
    mnaRenderGallery();
  } catch (err) {
    showToast('Lỗi: ' + err.message, 'err');
  }
}

async function mnaOpenAlbum(albumId, albumName) {
  MUANON_ADMIN.currentAlbumId = albumId;
  MUANON_ADMIN.currentAlbumName = albumName;
  MUANON_ADMIN.galleryOnlyFav = false;
  MUANON_ADMIN.galleryOffset = 0;
  mnaCloseAlbumSheet();
  if (MUANON_ADMIN.currentTab !== 'gallery') {
    mnaSwitchTab('gallery');
  } else {
    mnaLoadGallery();
  }
}

function mnaExitAlbum() {
  MUANON_ADMIN.currentAlbumId = null;
  MUANON_ADMIN.currentAlbumName = null;
  MUANON_ADMIN.galleryOffset = 0;
  mnaLoadGallery();
}

async function mnaRenameCurrentAlbum() {
  const id = MUANON_ADMIN.currentAlbumId;
  if (!id) return;
  const ten = prompt('Đổi tên bộ sưu tập:', MUANON_ADMIN.currentAlbumName || '');
  if (!ten || !ten.trim()) return;
  try {
    const { data } = await supa.rpc('fn_muanon_admin_album_rename', {
      p_ma_admin: SESSION.ma, p_album_id: id, p_ten_moi: ten.trim()
    });
    if (!data || !data.ok) throw new Error(data && data.message || 'Lỗi');
    MUANON_ADMIN.currentAlbumName = ten.trim();
    showToast('✓ Đã đổi tên', 'ok');
    mnaRenderGallery();
  } catch (err) { showToast('Lỗi: ' + err.message, 'err'); }
}

async function mnaDeleteCurrentAlbum() {
  const id = MUANON_ADMIN.currentAlbumId;
  if (!id) return;
  if (!confirm('Xóa bộ sưu tập "' + MUANON_ADMIN.currentAlbumName + '"?\n\nẢnh gốc vẫn còn, chỉ xóa liên kết album.')) return;
  try {
    const { data } = await supa.rpc('fn_muanon_admin_album_delete', {
      p_ma_admin: SESSION.ma, p_album_id: id
    });
    if (!data || !data.ok) throw new Error(data && data.message || 'Lỗi');
    showToast('✓ Đã xóa', 'ok');
    mnaExitAlbum();
  } catch (err) { showToast('Lỗi: ' + err.message, 'err'); }
}

// Bulk remove khỏi album (khi đang xem trong album + selectMode)
async function mnaBulkRemoveFromAlbum() {
  const id = MUANON_ADMIN.currentAlbumId;
  if (!id) return;
  const ids = [...MUANON_ADMIN.selectedAnh];
  if (ids.length === 0) return;
  if (!confirm('Xóa ' + ids.length + ' ảnh khỏi bộ sưu tập?\n(Ảnh gốc vẫn còn)')) return;
  try {
    const { data } = await supa.rpc('fn_muanon_admin_album_remove', {
      p_ma_admin: SESSION.ma, p_album_id: id, p_anh_ids: ids
    });
    if (!data || !data.ok) throw new Error(data && data.message || 'Lỗi');
    showToast('✓ Đã xóa ' + (data.so_anh_xoa || 0), 'ok');
    MUANON_ADMIN.selectMode = false;
    MUANON_ADMIN.selectedAnh.clear();
    mnaLoadGallery();
  } catch (err) { showToast('Lỗi: ' + err.message, 'err'); }
}

// ════════════════════════════════════════════════════════════════════════════
// [v12.0] TAB "NHÓM AI" — AI Clustering ảnh mẫu nón
// ════════════════════════════════════════════════════════════════════════════

async function mnaLoadCluster() {
  const el = document.getElementById('muanon-admin-content');
  if (el) el.innerHTML = '<div class="mna-loading">Đang tải nhóm AI...</div>';

  try {
    // mnaClusterScope: null = tuần hiện tại; 'all' = tất cả tuần
    const scope = MUANON_ADMIN.clusterScope || 'tuan';
    const params = { p_ma_admin: SESSION.ma };
    if (scope === 'tuan') params.p_tuan_id = MUANON_ADMIN.tuanId;
    // 'all' → không truyền p_tuan_id (RPC default NULL = tất cả)

    const { data, error } = await supa.rpc('fn_muanon_admin_cluster_list', params);
    if (error) throw error;
    if (!data || !data.ok) throw new Error(data && data.message || 'Lỗi');

    MUANON_ADMIN.clusterData = data.data || [];
    MUANON_ADMIN.clusterPending = data.total_unprocessed || 0;
    mnaRenderCluster();
  } catch (err) {
    if (el) el.innerHTML = '<div class="mna-empty">Lỗi: ' + escHtml(err.message || 'network') + '</div>';
  }
}

function mnaRenderCluster() {
  const data = MUANON_ADMIN.clusterData || [];
  const pending = MUANON_ADMIN.clusterPending || 0;
  const scope = MUANON_ADMIN.clusterScope || 'tuan';

  let html = `
    <div class="mna-cluster-bar">
      <button class="mna-scope-btn ${scope === 'tuan' ? 'active' : ''}" onclick="mnaSetClusterScope('tuan')">Tuần này</button>
      <button class="mna-scope-btn ${scope === 'all' ? 'active' : ''}" onclick="mnaSetClusterScope('all')">Tất cả tuần</button>
    </div>
    <div class="mna-cluster-header">
      <div class="mna-cluster-info">
        <div class="mna-cluster-title">${data.length} nhóm</div>
        <div class="mna-cluster-sub">${pending > 0 ? '⏳ Đang xử lý <b>' + pending + '</b> ảnh' : '✓ Đã xử lý xong · Sắp xếp theo số lượng giảm dần'}</div>
      </div>
      <button class="mna-ai-trigger" onclick="mnaAITriggerNow()" ${pending > 0 ? 'disabled' : ''}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        <span>${pending > 0 ? 'AI đang xử lý...' : 'AI xử lý ngay'}</span>
      </button>
    </div>
  `;

  if (data.length === 0) {
    html += `<div class="mna-empty">
      <div style="margin-bottom:8px;font-size:28px">🎨</div>
      Chưa có nhóm nào.<br/>
      ${pending > 0 ? 'AI đang phân tích ' + pending + ' ảnh...' : 'Khi NV gửi ảnh, AI tự động nhóm các mẫu giống nhau.'}
    </div>`;
    document.getElementById('muanon-admin-content').innerHTML = html;
    return;
  }

  html += '<div class="mna-cluster-grid">';
  data.forEach(c => {
    const label = c.manual_label || c.auto_label || 'Chưa đặt tên';
    html += `
      <div class="mna-cluster-card" onclick="mnaOpenCluster(${c.id})">
        <div class="mna-cluster-cover">
          ${c.cover_url ? '<img src="' + _mnaEscAttr(c.cover_url) + '" loading="lazy"/>' : '<div class="mna-cluster-empty">📷</div>'}
          <span class="mna-cluster-count">${c.so_anh}</span>
        </div>
        <div class="mna-cluster-label">${escHtml(label)}</div>
      </div>
    `;
  });
  html += '</div>';

  document.getElementById('muanon-admin-content').innerHTML = html;
}

function mnaSetClusterScope(scope) {
  MUANON_ADMIN.clusterScope = scope;
  mnaLoadCluster();
}

async function mnaAITriggerNow() {
  try {
    showToast('Đang gửi tín hiệu cho AI...', 'ok');
    const { data, error } = await supa.rpc('fn_muanon_admin_ai_trigger_now', { p_ma_admin: SESSION.ma });
    if (error) throw error;
    if (!data || !data.ok) throw new Error(data && data.message || 'Lỗi');
    showToast('⚡ ' + (data.message || 'AI đang xử lý...'), 'ok');
    // Reload sau 5s để xem kết quả
    setTimeout(() => mnaLoadCluster(), 5000);
  } catch (err) {
    showToast('Lỗi: ' + (err.message || 'network'), 'err');
  }
}

async function mnaOpenCluster(clusterId) {
  const el = document.getElementById('muanon-admin-content');
  if (el) el.innerHTML = '<div class="mna-loading">Đang tải nhóm...</div>';

  try {
    const { data, error } = await supa.rpc('fn_muanon_admin_cluster_anh', {
      p_ma_admin: SESSION.ma, p_cluster_id: clusterId, p_limit: 100
    });
    if (error) throw error;
    if (!data || !data.ok) throw new Error(data && data.message || 'Lỗi');

    MUANON_ADMIN.currentClusterId = clusterId;
    MUANON_ADMIN.galleryData = data.data || [];   // reuse lightbox
    mnaRenderClusterDetail(data.cluster, data.data);
  } catch (err) {
    if (el) el.innerHTML = '<div class="mna-empty">Lỗi: ' + escHtml(err.message) + '</div>';
  }
}

function mnaRenderClusterDetail(info, items) {
  const label = info.manual_label || info.auto_label || 'Nhóm ' + info.id;
  let html = `
    <div class="mna-album-header">
      <button class="mna-album-back" onclick="mnaSwitchTab('nhom')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <div class="mna-album-h-info">
        <div class="mna-album-h-name">${escHtml(label)}</div>
        <div class="mna-album-h-meta">${items.length} ảnh ${info.auto_label ? '· AI: ' + escHtml(info.auto_label) : ''}</div>
      </div>
      <button class="mna-album-h-act" onclick="mnaRenameCluster(${info.id})" title="Đổi tên">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
    </div>
  `;

  if (items.length === 0) {
    html += '<div class="mna-empty">Nhóm trống</div>';
  } else {
    html += `<div class="mna-gallery-grid" style="--mna-cols:${MUANON_ADMIN.gridCols || 3}">`;
    items.forEach((a, idx) => {
      const tagColor = a.tag ? mnaTagColor(a.tag) : null;
      html += `
        <div class="mna-gallery-item" data-anh-id="${a.anh_id}" onclick="mnaOpenLightbox(${idx})">
          <img src="${_mnaEscAttr(a.url)}" loading="lazy"/>
          ${a.tag ? `<span class="mna-gallery-tag" style="background:${tagColor}">${escHtml(mnaTagLabel(a.tag))}</span>` : ''}
          <button class="mna-fav-btn ${a.is_fav ? 'on' : ''}" onclick="mnaToggleFav(${a.anh_id}, event)">
            <svg viewBox="0 0 24 24" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </button>
          <div class="mna-gallery-overlay">
            <div class="mna-gallery-nv">${escHtml(a.ten_nv || '')}</div>
            <div class="mna-gallery-ch">${escHtml(a.ten_ch || '')} · ${escHtml(a.khu_vuc || '')}</div>
          </div>
        </div>
      `;
    });
    html += '</div>';
  }

  document.getElementById('muanon-admin-content').innerHTML = html;
}

async function mnaRenameCluster(clusterId) {
  const ten = prompt('Đặt tên cho nhóm này:');
  if (!ten || !ten.trim()) return;
  try {
    const { data } = await supa.rpc('fn_muanon_admin_cluster_rename', {
      p_ma_admin: SESSION.ma, p_cluster_id: clusterId, p_label: ten.trim()
    });
    if (!data || !data.ok) throw new Error(data && data.message || 'Lỗi');
    showToast('✓ Đã đổi tên', 'ok');
    mnaOpenCluster(clusterId);
  } catch (err) {
    showToast('Lỗi: ' + err.message, 'err');
  }
}

// ─── Globals ────────────────────────────────────────────────────────────
window.mnaLoadCluster = mnaLoadCluster;
window.mnaAITriggerNow = mnaAITriggerNow;
window.mnaOpenCluster = mnaOpenCluster;
window.mnaRenameCluster = mnaRenameCluster;
window.mnaSetClusterScope = mnaSetClusterScope;

// ════════════════════════════════════════════════════════════════════════════
// [v12.0] GLOBALS
// ════════════════════════════════════════════════════════════════════════════
window.moPageMuanonAdmin = moPageMuanonAdmin;
window.mnaChangeTuan = mnaChangeTuan;
window.mnaReload = mnaReload;
window.mnaSwitchTab = mnaSwitchTab;
window.mnaSetFilter = mnaSetFilter;
window.mnaSetZoom = mnaSetZoom;
window.mnaOpenLightbox = mnaOpenLightbox;
window.mnaCloseLightbox = mnaCloseLightbox;
window.mnaLightboxNav = mnaLightboxNav;
window.mnaToggleSelect = mnaToggleSelect;
window.mnaSelectAll = mnaSelectAll;
window.mnaClearSelect = mnaClearSelect;
window.mnaNhacBulk = mnaNhacBulk;
window.mnaFilterCompliance = mnaFilterCompliance;
window.mnaDebounceSearch = mnaDebounceSearch;
window.mnaClearAllFilters = mnaClearAllFilters;
// [v11.3] Timeline + Filter sheet
window.mnaTimelinePage = mnaTimelinePage;
window.mnaOpenTimelineLightbox = mnaOpenTimelineLightbox;
window.mnaOpenFilterSheet = mnaOpenFilterSheet;
window.mnaCloseFilterSheet = mnaCloseFilterSheet;
window.mnaFilterSheetSet = mnaFilterSheetSet;
window.mnaSetTimeRange = mnaSetTimeRange;
// [v11.5] Tổng quan drill-down + sort 2-cấp + Tuân thủ filter
window.mnaSetGroup = mnaSetGroup;
window.mnaTqExpand = mnaTqExpand;
window.mnaTqSortPromote = mnaTqSortPromote;
window.mnaTqSortToggleField = mnaTqSortToggleField;
window.mnaTqSortToggleDir = mnaTqSortToggleDir;
window.mnaTqDrillDown = mnaTqDrillDown;
window.mnaSetCustomDate = mnaSetCustomDate;
window.mnaSetCplFilter = mnaSetCplFilter;
// [v11.8] Yêu thích + swipe lightbox
window.mnaToggleFav = mnaToggleFav;
window.mnaLightboxToggleFav = mnaLightboxToggleFav;
window.mnaToggleOnlyFav = mnaToggleOnlyFav;
// [v11.9] Album + multi-select
window.mnaToggleSelectMode = mnaToggleSelectMode;
window.mnaToggleAnhSelect = mnaToggleAnhSelect;
window.mnaSelectAllGallery = mnaSelectAllGallery;
window.mnaClearSelectAnh = mnaClearSelectAnh;
window.mnaBulkFav = mnaBulkFav;
window.mnaBulkDownload = mnaBulkDownload;
window.mnaBulkShare = mnaBulkShare;
window.mnaBulkRemoveFromAlbum = mnaBulkRemoveFromAlbum;
window.mnaOpenAlbumSheet = mnaOpenAlbumSheet;
window.mnaCloseAlbumSheet = mnaCloseAlbumSheet;
window.mnaPromptCreateAlbum = mnaPromptCreateAlbum;
window.mnaAddSelToAlbum = mnaAddSelToAlbum;
window.mnaOpenAlbum = mnaOpenAlbum;
window.mnaExitAlbum = mnaExitAlbum;
window.mnaRenameCurrentAlbum = mnaRenameCurrentAlbum;
window.mnaDeleteCurrentAlbum = mnaDeleteCurrentAlbum;
// [v11.10] Xóa ảnh + download + click handler
window.mnaItemClick = mnaItemClick;
window.mnaBulkDelete = mnaBulkDelete;
window.mnaLightboxDelete = mnaLightboxDelete;
window.mnaLightboxDownload = mnaLightboxDownload;
