// ════════════════════════════════════════════════════════════════════════════
//  MODULE: MẪU NÓN HÀNG TUẦN — ADMIN side (Phase 4)
//  Path: js/admin/04-muanon-admin.js
//  4 tabs: Tổng quan · Gallery · Chưa gửi · Compliance
// ════════════════════════════════════════════════════════════════════════════

const MUANON_ADMIN = {
  tuanId: null,
  tuanList: [],
  currentTab: 'tongquan',
  filters: { kv: null, ch: null, nv: null, tag: null },
  gridCols: parseInt(localStorage.getItem('muanon_grid_cols') || '3', 10),
  selectedNV: new Set(),
  galleryData: [],
  galleryTotal: 0,
  galleryOffset: 0,
  galleryLimit: 60,
  lightboxIdx: -1,
  _loaded: false
};

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
    { id: 'tongquan', label: 'Tổng quan' },
    { id: 'gallery', label: 'Gallery' },
    { id: 'chuagui', label: 'Chưa gửi' },
    { id: 'compliance', label: 'Tuân thủ' }
  ];
  const tabsHtml = tabs.map(t =>
    '<button class="mna-tab' + (MUANON_ADMIN.currentTab === t.id ? ' active' : '') + '" onclick="mnaSwitchTab(\'' + t.id + '\')">' + t.label + '</button>'
  ).join('');

  headerEl.innerHTML = `
    <div class="mna-header-row">
      <select class="mna-tuan-select" onchange="mnaChangeTuan(this.value)">${tuanOptions}</select>
      <button class="mna-refresh-btn" onclick="mnaReload()" title="Tải lại">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15A9 9 0 1 1 5.64 5.64L23 10"/></svg>
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
  else if (tab === 'gallery') mnaLoadGallery();
  else if (tab === 'chuagui') mnaLoadChuaGui();
  else if (tab === 'compliance') mnaLoadCompliance();
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 1: TỔNG QUAN
// ════════════════════════════════════════════════════════════════════════════
async function mnaLoadTongQuan() {
  try {
    const { data, error } = await supa.rpc('fn_muanon_admin_dashboard', {
      p_ma_admin: SESSION.ma, p_tuan_id: MUANON_ADMIN.tuanId
    });
    if (error) throw error;
    if (!data || !data.ok) throw new Error((data && data.message) || 'Lỗi');

    const tagRes = await supa.rpc('fn_muanon_admin_tag_stats', {
      p_ma_admin: SESSION.ma, p_tuan_id: MUANON_ADMIN.tuanId
    });

    mnaRenderTongQuan(data, tagRes.data);
  } catch (err) {
    document.getElementById('muanon-admin-content').innerHTML =
      '<div class="mna-empty">Lỗi: ' + (err.message || 'network') + '</div>';
  }
}

function mnaRenderTongQuan(data, tagData) {
  const d = data.dashboard || {};
  const trend = data.trend_12tuan || [];
  const topKV = data.top_khu_vuc || [];
  const tags = (tagData && tagData.ok && tagData.data) || [];
  const tiLe = d.ti_le_tuan_thu_pct || 0;
  const cssClass = tiLe >= 70 ? 'good' : (tiLe >= 40 ? 'medium' : 'low');

  let html = '<div class="mna-content-wrap">';
  html += `
    <div class="mna-stat-grid">
      <div class="mna-stat-card"><div class="mna-stat-label">Tổng NV</div><div class="mna-stat-value">${d.tong_nv_du_kien || 0}</div></div>
      <div class="mna-stat-card mna-stat-success"><div class="mna-stat-label">Đã gửi</div><div class="mna-stat-value">${d.so_nv_da_gui || 0}</div></div>
      <div class="mna-stat-card mna-stat-${cssClass}"><div class="mna-stat-label">Tỷ lệ</div><div class="mna-stat-value">${tiLe}%</div></div>
      <div class="mna-stat-card"><div class="mna-stat-label">Tổng ảnh</div><div class="mna-stat-value">${d.tong_so_anh || 0}</div></div>
    </div>
    <div class="mna-progress-card">
      <div class="mna-progress-label"><span>Tỷ lệ tuân thủ tuần này</span><b>${d.so_nv_da_gui || 0} / ${d.tong_nv_du_kien || 0}</b></div>
      <div class="mna-progress-bar"><div class="mna-progress-fill mna-progress-${cssClass}" style="width:${tiLe}%"></div></div>
      <div class="mna-progress-detail">
        <span><b style="color:#0F6E56">${d.so_dung_han || 0}</b> đúng hạn</span>
        <span><b style="color:#BA7517">${d.so_tre || 0}</b> trễ</span>
        <span><b style="color:#B91C1C">${(d.tong_nv_du_kien || 0) - (d.so_nv_da_gui || 0)}</b> chưa gửi</span>
      </div>
    </div>
  `;

  if (trend.length > 0) {
    html += '<div class="mna-section"><div class="mna-section-title">Xu hướng 12 tuần</div>';
    html += '<div class="mna-trend-chart">' + mnaRenderTrendSvg(trend) + '</div></div>';
  }

  if (topKV.length > 0) {
    html += '<div class="mna-section"><div class="mna-section-title">Top khu vực gửi nhiều nhất</div><div class="mna-kv-list">';
    const maxNv = Math.max(...topKV.map(k => k.so_nv_da_gui || 0));
    for (const kv of topKV) {
      const w = maxNv > 0 ? Math.round(100 * (kv.so_nv_da_gui || 0) / maxNv) : 0;
      html += `
        <div class="mna-kv-item">
          <div class="mna-kv-info">
            <div class="mna-kv-name">${escHtml(kv.khu_vuc || '(chưa rõ)')}</div>
            <div class="mna-kv-sub">${kv.so_nv_da_gui} NV · ${kv.so_anh} ảnh</div>
          </div>
          <div class="mna-kv-bar"><div class="mna-kv-bar-fill" style="width:${w}%"></div></div>
        </div>`;
    }
    html += '</div></div>';
  }

  if (tags.length > 0) {
    html += '<div class="mna-section"><div class="mna-section-title">Phân bổ theo loại nón</div><div class="mna-tag-stats">';
    const totalAnh = tags.reduce((s, t) => s + (t.so_anh || 0), 0);
    for (const t of tags) {
      const pct = totalAnh > 0 ? Math.round(100 * (t.so_anh || 0) / totalAnh) : 0;
      const color = mnaTagColor(t.tag);
      html += `
        <div class="mna-tag-stat-item">
          <div class="mna-tag-stat-header">
            <span class="mna-tag-dot" style="background:${color}"></span>
            <span class="mna-tag-stat-label">${escHtml(mnaTagLabel(t.tag))}</span>
            <span class="mna-tag-stat-value">${t.so_anh} ảnh · ${pct}%</span>
          </div>
          <div class="mna-tag-stat-bar"><div class="mna-tag-stat-fill" style="width:${pct}%;background:${color}"></div></div>
        </div>`;
    }
    html += '</div></div>';
  }

  html += '</div>';
  document.getElementById('muanon-admin-content').innerHTML = html;
}

function mnaRenderTrendSvg(trend) {
  if (!trend || trend.length === 0) return '';
  const W = 320, H = 110, PAD = 26;
  const max = Math.max(...trend.map(t => t.so_nv_da_gui || 0), 1);
  const stepX = (W - PAD * 2) / Math.max(trend.length - 1, 1);

  let pts = '', dots = '', labels = '';
  trend.forEach((t, i) => {
    const x = PAD + i * stepX;
    const y = H - PAD - ((H - PAD * 2) * (t.so_nv_da_gui || 0) / max);
    pts += x + ',' + y + ' ';
    dots += `<circle cx="${x}" cy="${y}" r="3" fill="#0F6E56"/>`;
    if (i % 2 === 0 || i === trend.length - 1) {
      labels += `<text x="${x}" y="${H - 6}" text-anchor="middle" font-size="9" fill="#9ca3af">W${(t.tuan_code || '').slice(-2)}</text>`;
    }
  });

  return `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">
      <defs><linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1D9E75" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="#1D9E75" stop-opacity="0"/>
      </linearGradient></defs>
      <polyline points="${pts}" fill="none" stroke="#0F6E56" stroke-width="2" stroke-linejoin="round"/>
      <polygon points="${PAD},${H-PAD} ${pts} ${PAD + (trend.length-1)*stepX},${H-PAD}" fill="url(#trendGrad)"/>
      ${dots}${labels}
    </svg>`;
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 2: GALLERY
// ════════════════════════════════════════════════════════════════════════════
async function mnaLoadGallery() {
  try {
    const { data, error } = await supa.rpc('fn_muanon_admin_list_anh', {
      p_ma_admin: SESSION.ma,
      p_tuan_id: MUANON_ADMIN.tuanId,
      p_kv: MUANON_ADMIN.filters.kv,
      p_ch: MUANON_ADMIN.filters.ch,
      p_nv: MUANON_ADMIN.filters.nv,
      p_tag: MUANON_ADMIN.filters.tag,
      p_limit: MUANON_ADMIN.galleryLimit,
      p_offset: MUANON_ADMIN.galleryOffset
    });
    if (error) throw error;
    if (!data || !data.ok) throw new Error((data && data.message) || 'Lỗi');

    MUANON_ADMIN.galleryData = data.data || [];
    MUANON_ADMIN.galleryTotal = data.total || 0;
    mnaRenderGallery();
  } catch (err) {
    document.getElementById('muanon-admin-content').innerHTML =
      '<div class="mna-empty">Lỗi: ' + (err.message || 'network') + '</div>';
  }
}

function mnaRenderGallery() {
  const data = MUANON_ADMIN.galleryData;
  const kvSet = new Set(data.map(d => d.khu_vuc).filter(Boolean));

  let html = `
    <div class="mna-filter-sticky">
      <div class="mna-filter-row">
        <select class="mna-filter-sel" onchange="mnaSetFilter('kv', this.value)">
          <option value="">Tất cả khu vực</option>
          ${[...kvSet].map(kv => `<option value="${_mnaEscAttr(kv)}" ${MUANON_ADMIN.filters.kv === kv ? 'selected' : ''}>${escHtml(kv)}</option>`).join('')}
        </select>
        <select class="mna-filter-sel" onchange="mnaSetFilter('tag', this.value)">
          <option value="">Tất cả loại</option>
          ${MUANON_TAGS_ADMIN.map(t => `<option value="${t.code}" ${MUANON_ADMIN.filters.tag === t.code ? 'selected' : ''}>${t.label}</option>`).join('')}
        </select>
      </div>
      <div class="mna-zoom-row">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
        <input type="range" min="2" max="5" step="1" value="${MUANON_ADMIN.gridCols}" class="mna-zoom-slider" oninput="mnaSetZoom(this.value)"/>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.5"><rect x="3" y="3" width="18" height="18"/></svg>
        <span class="mna-zoom-label">${MUANON_ADMIN.gridCols} cột</span>
      </div>
      <div class="mna-gallery-info">${MUANON_ADMIN.galleryTotal} ảnh</div>
    </div>
  `;

  if (data.length === 0) {
    html += '<div class="mna-empty">Chưa có ảnh nào</div>';
    document.getElementById('muanon-admin-content').innerHTML = html;
    return;
  }

  html += `<div class="mna-gallery-grid" style="--mna-cols:${MUANON_ADMIN.gridCols}">`;
  data.forEach((a, idx) => {
    const tagColor = a.tag ? mnaTagColor(a.tag) : null;
    html += `
      <div class="mna-gallery-item" onclick="mnaOpenLightbox(${idx})">
        <img src="${_mnaEscAttr(a.url || '')}" alt="${_mnaEscAttr(a.ten_nv || '')}" loading="lazy"/>
        ${a.tag ? `<span class="mna-gallery-tag" style="background:${tagColor}">${escHtml(mnaTagLabel(a.tag))}</span>` : ''}
        <div class="mna-gallery-overlay">
          <div class="mna-gallery-nv">${escHtml(a.ten_nv || a.ma_nv || '')}</div>
          <div class="mna-gallery-ch">${escHtml(a.ma_ch || '')}</div>
        </div>
      </div>`;
  });
  html += '</div>';

  document.getElementById('muanon-admin-content').innerHTML = html;
}

function mnaSetFilter(key, val) {
  MUANON_ADMIN.filters[key] = val || null;
  MUANON_ADMIN.galleryOffset = 0;
  if (MUANON_ADMIN.currentTab === 'gallery') mnaLoadGallery();
  else if (MUANON_ADMIN.currentTab === 'chuagui') mnaLoadChuaGui();
}

function mnaSetZoom(val) {
  MUANON_ADMIN.gridCols = parseInt(val, 10);
  localStorage.setItem('muanon_grid_cols', val);
  const grid = document.querySelector('.mna-gallery-grid');
  if (grid) grid.style.setProperty('--mna-cols', val);
  const lbl = document.querySelector('.mna-zoom-label');
  if (lbl) lbl.textContent = val + ' cột';
}

function mnaOpenLightbox(idx) { MUANON_ADMIN.lightboxIdx = idx; mnaRenderLightbox(); }
function mnaCloseLightbox() {
  MUANON_ADMIN.lightboxIdx = -1;
  const lb = document.getElementById('mna-lightbox');
  if (lb) { lb.classList.remove('open'); setTimeout(() => lb.remove(), 250); }
}
function mnaLightboxNav(dir) {
  const len = MUANON_ADMIN.galleryData.length;
  let next = MUANON_ADMIN.lightboxIdx + dir;
  if (next < 0) next = len - 1;
  if (next >= len) next = 0;
  MUANON_ADMIN.lightboxIdx = next;
  mnaRenderLightbox();
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
  }

  lb.innerHTML = `
    <button class="mna-lb-close" onclick="mnaCloseLightbox()">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
    <button class="mna-lb-prev" onclick="mnaLightboxNav(-1)">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    </button>
    <button class="mna-lb-next" onclick="mnaLightboxNav(1)">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
    </button>
    <img src="${_mnaEscAttr(a.url || '')}" class="mna-lb-img" alt=""/>
    <div class="mna-lb-info">
      <div class="mna-lb-nv">${escHtml(a.ten_nv || '')} <span style="opacity:0.7">· ${escHtml(a.ma_nv || '')}</span></div>
      <div class="mna-lb-meta">${escHtml(a.ma_ch || '')} · ${escHtml(a.khu_vuc || '')} ${a.tag ? '· <b style="color:' + mnaTagColor(a.tag) + '">' + escHtml(mnaTagLabel(a.tag)) + '</b>' : ''}</div>
      <div class="mna-lb-counter">${idx + 1} / ${MUANON_ADMIN.galleryData.length}</div>
    </div>
  `;
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
  const kvSet = new Set(list.map(d => d.khu_vuc).filter(Boolean));
  const selected = MUANON_ADMIN.selectedNV;

  let html = `
    <div class="mna-filter-sticky">
      <div class="mna-filter-row">
        <select class="mna-filter-sel" onchange="mnaSetFilter('kv', this.value)">
          <option value="">Tất cả khu vực</option>
          ${[...kvSet].map(kv => `<option value="${_mnaEscAttr(kv)}" ${MUANON_ADMIN.filters.kv === kv ? 'selected' : ''}>${escHtml(kv)}</option>`).join('')}
        </select>
        <button class="mna-bulk-btn" onclick="mnaSelectAll()">Chọn tất cả</button>
        <button class="mna-bulk-btn mna-bulk-btn-clear" onclick="mnaClearSelect()">Bỏ chọn</button>
      </div>
      <div class="mna-cg-info">${total} người chưa gửi · Đã chọn <b id="mna-cg-count">${selected.size}</b></div>
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
    html += `
      <div class="mna-cg-item ${isSelected ? 'selected' : ''}" onclick="mnaToggleSelect('${_mnaEscAttr(nv.ma_nv)}')">
        <div class="mna-cg-checkbox">${isSelected ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}</div>
        <div class="mna-cg-info-block">
          <div class="mna-cg-name">${escHtml(nv.ten_nv || '')}</div>
          <div class="mna-cg-meta">${escHtml(nv.ma_nv)} · ${escHtml(nv.ma_ch || '')} · ${escHtml(nv.khu_vuc || '')}</div>
        </div>
        ${nv.so_lan_nhac > 0 ? `<span class="mna-cg-reminded">Đã nhắc ${nv.so_lan_nhac}</span>` : ''}
      </div>`;
  }
  html += '</div>';

  html += `
    <button class="mna-cg-fab" id="mna-cg-fab" onclick="mnaNhacBulk()" style="display:${selected.size > 0 ? 'flex' : 'none'}">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      <span>Nhắc <b id="mna-cg-fab-count">${selected.size}</b> người</span>
    </button>
  `;

  document.getElementById('muanon-admin-content').innerHTML = html;
}

function mnaToggleSelect(maNv) {
  if (MUANON_ADMIN.selectedNV.has(maNv)) MUANON_ADMIN.selectedNV.delete(maNv);
  else MUANON_ADMIN.selectedNV.add(maNv);
  mnaUpdateSelectUI();
}

function mnaSelectAll() {
  document.querySelectorAll('.mna-cg-item').forEach(el => {
    const m = el.getAttribute('onclick').match(/'([^']+)'/);
    if (m) MUANON_ADMIN.selectedNV.add(m[1]);
  });
  mnaLoadChuaGui();
}

function mnaClearSelect() {
  MUANON_ADMIN.selectedNV.clear();
  mnaLoadChuaGui();
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
  if (!confirm(`Nhắc ${list.length} người chưa gửi?`)) return;

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

    mnaRenderCompliance(data.data || []);
  } catch (err) {
    document.getElementById('muanon-admin-content').innerHTML =
      '<div class="mna-empty">Lỗi: ' + (err.message || 'network') + '</div>';
  }
}

function mnaRenderCompliance(list) {
  let html = `
    <div class="mna-filter-sticky">
      <div class="mna-filter-row">
        <input type="text" class="mna-filter-search" placeholder="Tìm theo tên, mã NV, cửa hàng..." oninput="mnaFilterCompliance(this.value)"/>
      </div>
      <div class="mna-cg-info">${list.length} nhân viên</div>
    </div>
  `;

  if (list.length === 0) {
    html += '<div class="mna-empty">Chưa có dữ liệu compliance</div>';
    document.getElementById('muanon-admin-content').innerHTML = html;
    return;
  }

  html += '<div class="mna-comp-list" id="mna-comp-list">';
  for (const c of list) {
    const pct = c.ti_le_dung_han_pct || 0;
    const cls = pct >= 80 ? 'good' : (pct >= 50 ? 'medium' : 'low');
    const search = _mnaEscAttr((c.ma_nv + ' ' + (c.ten_nv || '') + ' ' + (c.ma_ch || '')).toLowerCase());
    html += `
      <div class="mna-comp-item" data-search="${search}">
        <div class="mna-comp-row1">
          <div class="mna-comp-name">${escHtml(c.ten_nv || '')}<span style="opacity:0.6;font-weight:500"> · ${escHtml(c.ma_nv)}</span></div>
          <div class="mna-comp-pct mna-comp-${cls}">${pct}%</div>
        </div>
        <div class="mna-comp-meta">${escHtml(c.ma_ch || '')} · ${escHtml(c.khu_vuc || '')}</div>
        <div class="mna-comp-bar"><div class="mna-comp-bar-fill mna-comp-bg-${cls}" style="width:${pct}%"></div></div>
        <div class="mna-comp-stats">
          <span>${c.tong_tuan} tuần</span>
          <span style="color:#0F6E56"><b>${c.so_tuan_dung_han}</b> đúng hạn</span>
          <span style="color:#BA7517"><b>${c.so_tuan_tre}</b> trễ</span>
          <span style="color:#B91C1C"><b>${c.so_tuan_khong_gui}</b> không gửi</span>
          ${c.tong_lan_bi_nhac > 0 ? `<span style="color:#6b7280"><b>${c.tong_lan_bi_nhac}</b> lần nhắc</span>` : ''}
        </div>
      </div>`;
  }
  html += '</div>';
  document.getElementById('muanon-admin-content').innerHTML = html;
}

function mnaFilterCompliance(q) {
  q = (q || '').trim().toLowerCase();
  document.querySelectorAll('#mna-comp-list .mna-comp-item').forEach(el => {
    const m = el.getAttribute('data-search') || '';
    el.style.display = (!q || m.includes(q)) ? '' : 'none';
  });
}

// ─── GLOBALS ────────────────────────────────────────────────────────────────
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
