// ════════════════════════════════════════════════════════════════════════════
//  MODULE: MẪU NÓN HÀNG TUẦN — NV side (Phase 3)
//  Path: js/pages/05-muanon.js
//  Phụ thuộc: supa client, SESSION, showToast, goToPage
// ════════════════════════════════════════════════════════════════════════════

// ─── STATE ──────────────────────────────────────────────────────────────────
let _muanonTuan = null;
let _muanonBaigui = null;
let _muanonAnhList = [];      // [{file?, blob?, dataUrl, url?, tag, width, height, size_bytes, _existed, _uploading}]
let _muanonMoTa = '';
let _muanonHistory = [];
let _muanonLoaded = false;

// ─── TAG DEFINITIONS ────────────────────────────────────────────────────────
const MUANON_TAGS = [
  { code: 'MUBAOHIEM',    label: 'Mũ bảo hiểm',     short: 'BH',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13a9 9 0 0 1 18 0v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><line x1="3" y1="13" x2="21" y2="13"/></svg>' },
  { code: 'NONKETTHUONG', label: 'Nón kết thường',  short: 'Kết',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17c0-5 4-9 8-9s8 4 8 9"/><path d="M2 17h14l4-2"/></svg>' },
  { code: 'NONSNAPBACK',  label: 'Snapback',        short: 'Snap',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 16c0-4 3-8 7-8s7 4 7 8"/><path d="M5 16h14"/><path d="M19 16l3 0"/></svg>' },
  { code: 'NONVANH',      label: 'Nón vành',        short: 'Vành',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 15c0-3 2-6 5-6s5 3 5 6"/><line x1="2" y1="15" x2="22" y2="15"/></svg>' },
  { code: 'NONDACBIET',   label: 'Đặc biệt',        short: 'ĐB',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15 9 22 9 17 14 19 21 12 17 5 21 7 14 2 9 9 9"/></svg>' },
  { code: 'NONTREEM',     label: 'Trẻ em',          short: 'TE',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>' },
  { code: 'KHAC',         label: 'Khác',            short: '...',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>' }
];

function muanonTagLabel(code) {
  const t = MUANON_TAGS.find(x => x.code === code);
  return t ? t.label : '';
}
function muanonTagShort(code) {
  const t = MUANON_TAGS.find(x => x.code === code);
  return t ? t.short : '';
}

// ─── ENTRY POINT ────────────────────────────────────────────────────────────
async function moPageMuanon() {
  goToPage('muanon');
  if (!_muanonLoaded) {
    await taiMuanonTuan();
    _muanonLoaded = true;
  } else {
    muanonRender();
  }
}

// ─── LOAD DATA ──────────────────────────────────────────────────────────────
async function taiMuanonTuan() {
  if (!SESSION || !SESSION.ma) return;
  const containerEl = document.getElementById('muanon-content');
  if (containerEl) containerEl.innerHTML = '<div class="muanon-loading">Đang tải...</div>';

  try {
    // 1. Tuần OPEN
    const { data: tuanRes, error: tuanErr } = await supa.rpc('fn_muanon_tuan_hien_tai');
    if (tuanErr) throw tuanErr;
    if (!tuanRes || !tuanRes.ok) {
      _muanonTuan = null;
      muanonRender();
      return;
    }
    _muanonTuan = tuanRes;

    // 2. Bài đã gửi
    const { data: bgRes, error: bgErr } = await supa.rpc('fn_muanon_my_baigui', { p_ma_nv: SESSION.ma });
    if (bgErr) throw bgErr;

    _muanonAnhList = [];
    _muanonBaigui = null;
    _muanonMoTa = '';

    if (bgRes && bgRes.ok) {
      _muanonBaigui = bgRes.baigui;
      _muanonMoTa = (bgRes.baigui && bgRes.baigui.mo_ta) || '';
      if (Array.isArray(bgRes.anh_list)) {
        _muanonAnhList = bgRes.anh_list.map(a => ({
          id: a.id,
          url: a.url || a.thumb_url,
          tag: a.tag,
          width: a.width,
          height: a.height,
          size_bytes: a.size_bytes,
          supabase_path: a.supabase_path,
          ten_file: a.ten_file,
          thu_tu: a.thu_tu,
          _existed: true
        }));
      }
    }

    // 3. History 4 tuần
    const { data: histRes } = await supa.rpc('fn_muanon_my_history', { p_ma_nv: SESSION.ma, p_so_tuan: 4 });
    _muanonHistory = (histRes && histRes.ok && histRes.data) || [];

    muanonRender();
  } catch (err) {
    if (containerEl) containerEl.innerHTML = '<div class="muanon-loading muanon-err">Lỗi tải: ' + (err.message || 'network') + '</div>';
  }
}

// ─── RENDER ─────────────────────────────────────────────────────────────────
function muanonRender() {
  const el = document.getElementById('muanon-content');
  if (!el) return;

  if (!_muanonTuan) {
    el.innerHTML = '<div class="muanon-empty">Hiện chưa có tuần thu thập ảnh đang mở. Vui lòng quay lại sau!</div>';
    return;
  }

  // Compact: bỏ slot null ở giữa
  _muanonAnhList = _muanonAnhList.filter(a => a);

  // Tính số slot hiển thị: min(max(3, đã có + 1), 20)
  const MIN_SLOTS = 3;
  const numFilled = _muanonAnhList.length;
  const numSlots = Math.max(MIN_SLOTS, Math.min(numFilled + (numFilled < 20 ? 1 : 0), 20));

  // Render hero status
  const remainHrs = _muanonTuan.gio_con_lai || 0;
  const remainText = remainHrs > 48
    ? Math.floor(remainHrs / 24) + ' ngày ' + (remainHrs % 24) + ' giờ'
    : remainHrs + ' giờ';

  const submitted = _muanonBaigui && _muanonBaigui.trang_thai === 'SUBMITTED';

  let html = '';

  // Status bar
  html += `
    <div class="muanon-status-card ${submitted ? 'submitted' : 'pending'}">
      <div class="muanon-status-icon">
        ${submitted
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'}
      </div>
      <div class="muanon-status-info">
        <div class="muanon-status-title">${submitted ? 'Đã gửi ' + numFilled + ' ảnh' : 'Chưa gửi ảnh tuần này'}</div>
        <div class="muanon-status-sub">${_muanonTuan.tuan_code} · còn <b>${remainText}</b></div>
      </div>
    </div>
  `;

  // Upload slots grid
  html += '<div class="muanon-slots-section">';
  // [v11.1] Section title + nút áp tag hàng loạt
  const filledCount = _muanonAnhList.length;
  const noTagCount = _muanonAnhList.filter(a => a && !a.tag).length;
  html += '<div class="muanon-section-header">';
  html += '<div class="muanon-section-title">ẢNH ĐÃ CHỌN' + (filledCount > 0 ? ' · ' + filledCount : '') + '</div>';
  if (noTagCount >= 2) {
    html += '<button class="muanon-bulk-tag-btn" onclick="muanonBulkTagOpen()">Chọn loại cho ' + noTagCount + ' ảnh</button>';
  }
  html += '</div>';
  html += '<div class="muanon-slots-grid">';
  for (let i = 0; i < numSlots; i++) {
    const a = _muanonAnhList[i];
    if (a) {
      const tagShort = a.tag ? muanonTagShort(a.tag) : null;
      html += `
        <div class="muanon-slot filled" data-idx="${i}">
          <img src="${escHtml(a.url || a.dataUrl)}" alt="ảnh ${i+1}" class="muanon-slot-img"/>
          <button class="muanon-slot-del" onclick="muanonXoaAnh(${i})" title="Xóa ảnh">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <button class="muanon-slot-tag ${tagShort ? 'has-tag' : ''}" onclick="muanonChonTag(${i})">
            ${tagShort
              ? '<span class="tag-label">' + escHtml(tagShort) + '</span>'
              : '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span>Loại</span>'}
          </button>
        </div>
      `;
    } else {
      html += `
        <button class="muanon-slot empty" onclick="muanonClickSlot(${i})" data-idx="${i}">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span class="muanon-slot-lbl">Thêm ảnh</span>
        </button>
      `;
    }
  }
  html += '</div>'; // grid
  html += '</div>'; // section

  // Mô tả
  html += `
    <div class="muanon-mota-section">
      <div class="muanon-section-title">MÔ TẢ <span style="font-weight:500;color:#9ca3af;font-size:10px">(không bắt buộc)</span></div>
      <textarea id="muanon-mota" class="muanon-mota" rows="3"
        placeholder="Ghi chú thêm về xu hướng, lý do bạn thích các mẫu này..."
        oninput="_muanonMoTa = this.value">${escHtml(_muanonMoTa)}</textarea>
    </div>
  `;

  // Submit button
  html += `
    <div class="muanon-submit-wrap">
      <button class="muanon-submit-btn" id="muanon-submit-btn" onclick="muanonSubmit()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:6px"><polyline points="20 6 9 17 4 12"/></svg>
        ${submitted ? 'Cập nhật bài gửi' : 'Lưu bài gửi'}
      </button>
    </div>
  `;

  // History
  if (_muanonHistory && _muanonHistory.length > 0) {
    html += '<div class="muanon-history-section">';
    html += '<div class="muanon-section-title">LỊCH SỬ 4 TUẦN GẦN NHẤT</div>';
    html += '<div class="muanon-history-list">';
    for (const h of _muanonHistory) {
      const isOpen = h.trang_thai_tuan === 'OPEN';
      let stateLabel, stateClass, stateIcon;
      if (isOpen) {
        stateLabel = 'Tuần này (đang nhận)';
        stateClass = 'open';
        stateIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>';
      } else if (h.trang_thai_tuan_thu === 'DUNG_HAN') {
        stateLabel = 'Đã gửi đúng hạn';
        stateClass = 'done';
        stateIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      } else if (h.trang_thai_tuan_thu === 'TRE') {
        stateLabel = 'Gửi trễ hạn';
        stateClass = 'late';
        stateIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
      } else {
        stateLabel = 'Không gửi';
        stateClass = 'miss';
        stateIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      }

      const dateRange = _muanonFmtDate(h.ngay_bat_dau) + ' – ' + _muanonFmtDate(h.ngay_ket_thuc);

      html += `
        <div class="muanon-history-item ${stateClass}">
          <div class="muanon-history-icon">${stateIcon}</div>
          <div class="muanon-history-info">
            <div class="muanon-history-title">${escHtml(h.tuan_code)} · ${stateLabel}</div>
            <div class="muanon-history-sub">${dateRange}${h.so_anh > 0 ? ' · ' + h.so_anh + ' ảnh' : ''}</div>
          </div>
        </div>
      `;
    }
    html += '</div></div>';
  }

  el.innerHTML = html;
}

// ─── FILE PICKER + UPLOAD HANDLER ──────────────────────────────────────────
function muanonClickSlot(idx) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/jpeg,image/png,image/webp,image/heic';
  input.multiple = true;  // [v11.1] cho phép chọn nhiều ảnh cùng lúc
  input.onchange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (files.length === 1) {
      // 1 ảnh: giữ flow cũ (auto-open tag picker)
      await muanonHandleFile(files[0], idx);
      return;
    }

    // Nhiều ảnh: append tuần tự, KHÔNG auto-open tag từng cái
    showToast('Đang xử lý ' + files.length + ' ảnh...', 'ok');
    let added = 0;
    for (const file of files) {
      if (_muanonAnhList.length >= 20) {
        showToast('Tối đa 20 ảnh, bỏ qua phần còn lại', 'err');
        break;
      }
      try {
        const result = await muanonCompressAnh(file);
        _muanonAnhList.push({
          file, blob: result.blob, dataUrl: result.dataUrl, url: result.dataUrl,
          width: result.width, height: result.height,
          size_bytes: result.blob.size, mime_type: 'image/jpeg',
          tag: null, _existed: false
        });
        added++;
      } catch (err) {
        console.warn('[muanon] compress fail:', err);
      }
    }
    muanonRender();
    if (added > 0) {
      showToast('✓ Đã thêm ' + added + ' ảnh, nhấn "Chọn loại cho tất cả" hoặc tap từng ảnh', 'ok');
    }
  };
  input.click();
}

async function muanonHandleFile(file, idx) {
  if (!file) return;

  // Validate size
  if (file.size > 15 * 1024 * 1024) {
    showToast('Ảnh quá lớn (> 15MB)', 'err');
    return;
  }

  try {
    showToast('Đang xử lý ảnh...', 'ok');
    const result = await muanonCompressAnh(file);

    // Insert vào slot
    if (idx < _muanonAnhList.length) {
      _muanonAnhList[idx] = {
        file, blob: result.blob, dataUrl: result.dataUrl, url: result.dataUrl,
        width: result.width, height: result.height,
        size_bytes: result.blob.size, mime_type: 'image/jpeg',
        tag: null, _existed: false
      };
    } else {
      _muanonAnhList.push({
        file, blob: result.blob, dataUrl: result.dataUrl, url: result.dataUrl,
        width: result.width, height: result.height,
        size_bytes: result.blob.size, mime_type: 'image/jpeg',
        tag: null, _existed: false
      });
    }

    muanonRender();

    // Auto-open tag picker sau 200ms
    const newIdx = idx < _muanonAnhList.length ? idx : _muanonAnhList.length - 1;
    setTimeout(() => muanonChonTag(newIdx), 220);
  } catch (err) {
    showToast('Lỗi: ' + err.message, 'err');
  }
}

function muanonCompressAnh(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1600;
        let w = img.naturalWidth, h = img.naturalHeight;
        if (w > MAX || h > MAX) {
          if (w >= h) { h = Math.round(h * MAX / w); w = MAX; }
          else        { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(blob => {
          if (!blob) return reject(new Error('Compress fail'));
          const dataUrl = canvas.toDataURL('image/jpeg', 0.5); // dataUrl chỉ dùng preview → quality thấp
          resolve({ blob, dataUrl, width: w, height: h });
        }, 'image/jpeg', 0.8);
      };
      img.onerror = () => reject(new Error('Đọc ảnh lỗi'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Đọc file lỗi'));
    reader.readAsDataURL(file);
  });
}

// ─── TAG BOTTOM SHEET ───────────────────────────────────────────────────────
function muanonChonTag(idx) {
  // Remove existing sheet if any
  const old = document.getElementById('muanon-tag-sheet-overlay');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = 'muanon-tag-sheet-overlay';
  overlay.className = 'muanon-tag-sheet-overlay';
  overlay.onclick = e => { if (e.target === overlay) muanonCloseTagSheet(); };

  const a = _muanonAnhList[idx];
  const currentTag = a ? a.tag : null;

  let html = '<div class="muanon-tag-sheet" onclick="event.stopPropagation()">';
  html += '<div class="muanon-tag-sheet-handle"></div>';
  html += '<div class="muanon-tag-sheet-title">Chọn loại nón cho ảnh này</div>';
  html += '<div class="muanon-tag-grid">';
  for (const t of MUANON_TAGS) {
    const active = (t.code === currentTag);
    html += `
      <button class="muanon-tag-chip ${active ? 'active' : ''}" onclick="muanonGanTag(${idx}, '${t.code}')">
        <div class="muanon-tag-chip-icon">${t.icon}</div>
        <div class="muanon-tag-chip-label">${escHtml(t.label)}</div>
        ${active ? '<div class="muanon-tag-chip-check"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>' : ''}
      </button>
    `;
  }
  html += '</div></div>';
  overlay.innerHTML = html;
  document.body.appendChild(overlay);

  // Animate in
  requestAnimationFrame(() => overlay.classList.add('open'));
}

function muanonCloseTagSheet() {
  const overlay = document.getElementById('muanon-tag-sheet-overlay');
  if (overlay) {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 250);
  }
}

function muanonGanTag(idx, tagCode) {
  if (_muanonAnhList[idx]) {
    _muanonAnhList[idx].tag = tagCode;
  }
  muanonCloseTagSheet();
  setTimeout(() => muanonRender(), 100);
}

// [v11.1] Mở bottom sheet áp tag cho TẤT CẢ ảnh chưa có tag
function muanonBulkTagOpen() {
  const old = document.getElementById('muanon-tag-sheet-overlay');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = 'muanon-tag-sheet-overlay';
  overlay.className = 'muanon-tag-sheet-overlay';
  overlay.onclick = e => { if (e.target === overlay) muanonCloseTagSheet(); };

  const noTagCount = _muanonAnhList.filter(a => a && !a.tag).length;

  let html = '<div class="muanon-tag-sheet" onclick="event.stopPropagation()">';
  html += '<div class="muanon-tag-sheet-handle"></div>';
  html += '<div class="muanon-tag-sheet-title">Chọn loại cho <b>' + noTagCount + '</b> ảnh chưa gắn loại</div>';
  html += '<div class="muanon-tag-grid">';
  for (const t of MUANON_TAGS) {
    html += `
      <button class="muanon-tag-chip" onclick="muanonBulkTagApply('${t.code}')">
        <div class="muanon-tag-chip-icon">${t.icon}</div>
        <div class="muanon-tag-chip-label">${escHtml(t.label)}</div>
      </button>
    `;
  }
  html += '</div></div>';
  overlay.innerHTML = html;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
}

function muanonBulkTagApply(tagCode) {
  let applied = 0;
  for (const a of _muanonAnhList) {
    if (a && !a.tag) {
      a.tag = tagCode;
      applied++;
    }
  }
  muanonCloseTagSheet();
  setTimeout(() => {
    muanonRender();
    showToast('✓ Đã áp loại cho ' + applied + ' ảnh', 'ok');
  }, 100);
}

function muanonXoaAnh(idx) {
  if (!confirm('Xóa ảnh này?')) return;
  _muanonAnhList.splice(idx, 1);
  muanonRender();
}

// ─── SUBMIT ─────────────────────────────────────────────────────────────────
async function muanonSubmit() {
  const valid = _muanonAnhList.filter(a => a);
  if (valid.length === 0) {
    showToast('Vui lòng thêm ít nhất 1 ảnh', 'err');
    return;
  }
  const missingTag = valid.find(a => !a.tag);
  if (missingTag) {
    showToast('Vui lòng chọn loại nón cho tất cả ảnh', 'err');
    return;
  }

  const btn = document.getElementById('muanon-submit-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Đang gửi...'; }

  try {
    const anhFinal = [];
    for (let i = 0; i < valid.length; i++) {
      const a = valid[i];

      if (a._existed) {
        anhFinal.push({
          ten_file: a.ten_file || ('existing_' + a.id),
          supabase_path: a.supabase_path,
          supabase_url: a.url,
          width: a.width || null,
          height: a.height || null,
          size_bytes: a.size_bytes || null,
          mime_type: 'image/jpeg',
          tag: a.tag,
          thu_tu: i + 1
        });
      } else {
        // Upload mới
        if (btn) btn.textContent = `Đang upload ${i+1}/${valid.length}...`;
        const ts = Date.now() + '_' + i;
        const fname = String(i+1).padStart(2,'0') + '_' + ts + '.jpg';
        const path = 'muanon/' + _muanonTuan.tuan_code + '/' + SESSION.ma + '/' + fname;

        const { error: upErr } = await supa.storage.from('muanon-images').upload(path, a.blob, {
          contentType: 'image/jpeg',
          upsert: true,
          cacheControl: '3600'
        });
        if (upErr) throw upErr;

        const { data: urlData } = supa.storage.from('muanon-images').getPublicUrl(path);
        anhFinal.push({
          ten_file: fname,
          supabase_path: path,
          supabase_url: urlData.publicUrl,
          width: a.width, height: a.height,
          size_bytes: a.size_bytes,
          mime_type: 'image/jpeg',
          tag: a.tag,
          thu_tu: i + 1
        });
      }
    }

    if (btn) btn.textContent = 'Đang lưu...';
    const { data: res, error: rpcErr } = await supa.rpc('fn_muanon_submit', {
      p_ma_nv: SESSION.ma,
      p_anh_list: anhFinal,
      p_mo_ta: _muanonMoTa || null
    });

    if (rpcErr) throw rpcErr;
    if (!res || !res.ok) throw new Error((res && res.message) || 'Lỗi DB');

    showToast('✓ Đã gửi ' + valid.length + ' ảnh', 'ok');
    _muanonLoaded = false;
    await taiMuanonTuan();
    _muanonLoaded = true;
  } catch (err) {
    showToast('Lỗi gửi: ' + (err.message || 'unknown'), 'err');
    if (btn) {
      btn.disabled = false;
      btn.textContent = (_muanonBaigui && _muanonBaigui.trang_thai === 'SUBMITTED')
        ? 'Cập nhật bài gửi' : 'Lưu bài gửi';
    }
  }
}

// ─── HELPERS ────────────────────────────────────────────────────────────────
function _muanonFmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return String(dt.getDate()).padStart(2,'0') + '/' + String(dt.getMonth()+1).padStart(2,'0');
}

// Expose globals
window.moPageMuanon = moPageMuanon;
window.taiMuanonTuan = taiMuanonTuan;
window.muanonClickSlot = muanonClickSlot;
window.muanonChonTag = muanonChonTag;
window.muanonGanTag = muanonGanTag;
window.muanonBulkTagOpen = muanonBulkTagOpen;
window.muanonBulkTagApply = muanonBulkTagApply;
window.muanonCloseTagSheet = muanonCloseTagSheet;
window.muanonXoaAnh = muanonXoaAnh;
window.muanonSubmit = muanonSubmit;
