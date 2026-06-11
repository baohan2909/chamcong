/* ═══════════════════════════════════════════════════════════════════════════
 *  NÓN SƠN — BÀN GIAO CA v1.0 — NV VIEW + ACK + BLOCK RA_CA
 *  Module phần NV: tạo biên bản, ack biên bản nhận, đọc sự vụ, đóng sự vụ.
 *  Phần QL nằm ở 06-bangiao-ql.js (admin).
 * ═══════════════════════════════════════════════════════════════════════════ */

(function(){
  // ─── State module ─────────────────────────────────────────────────────
  const BG = {
    danhMucCache: null,           // 45 items master (load 1 lần)
    currentForm: null,            // dữ liệu form đang nhập
    currentTab: 'tao',            // 'tao' | 'lich-su' | 'su-vu'
    photoBlobs: []                // array { blob, dataUrl, url, path }
  };

  // ─── Entry point — register vào router ─────────────────────────────────
  window.moPageBanGiao = async function(){
    if (typeof SESSION === 'undefined' || !SESSION) {
      alert('Vui lòng đăng nhập lại'); return;
    }
    showPage('bangiao');
    await renderBanGiaoPage();
  };

  function showPage(name){
    document.querySelectorAll('.page').forEach(p=>p.style.display='none');
    let page = document.getElementById('page-' + name);
    if (!page){
      page = document.createElement('div');
      page.id = 'page-' + name;
      page.className = 'page';
      document.body.appendChild(page);
    }
    page.style.display = 'block';
    currentPage = name;
  }

  async function renderBanGiaoPage(){
    const page = document.getElementById('page-bangiao');
    page.innerHTML = `
      <div class="bg-hero">
        <button onclick="goToPage('chamcong')" style="background:transparent;border:0;color:#fff;font-size:22px;cursor:pointer;padding:0;margin-bottom:8px">‹</button>
        <h2>Bàn giao ca</h2>
        <div class="subtitle">Biên bản bàn giao & sự vụ vận hành</div>
        <div class="ch-name" id="bg-ch-name">${escHtml(SESSION.tenCH || SESSION.maCH || '')}</div>
      </div>
      <div class="bg-tabs">
        <div class="bg-tab active" data-tab="tao" onclick="bgSwitchTab('tao')">Tạo bàn giao</div>
        <div class="bg-tab" data-tab="lich-su" onclick="bgSwitchTab('lich-su')">Lịch sử</div>
        <div class="bg-tab" data-tab="su-vu" onclick="bgSwitchTab('su-vu')">
          Sự vụ <span class="badge" id="bg-su-vu-badge" style="display:none"></span>
        </div>
      </div>
      <div id="bg-tab-content"></div>
    `;
    await Promise.all([loadDanhMuc(), loadSuVuBadge()]);
    await renderTabTao();
  }

  window.bgSwitchTab = async function(tab){
    BG.currentTab = tab;
    document.querySelectorAll('.bg-tab').forEach(t=>t.classList.toggle('active', t.dataset.tab===tab));
    if (tab === 'tao') await renderTabTao();
    else if (tab === 'lich-su') await renderTabLichSu();
    else if (tab === 'su-vu') await renderTabSuVu();
  };

  // ─── Load 45 items master + cache ─────────────────────────────────────
  async function loadDanhMuc(){
    if (BG.danhMucCache) return BG.danhMucCache;
    const { data, error } = await supa.rpc('fn_get_danh_muc_tai_san');
    if (error) { console.error(error); BG.danhMucCache = []; return []; }
    BG.danhMucCache = data || [];
    return BG.danhMucCache;
  }

  async function loadSuVuBadge(){
    try {
      const { data } = await supa.rpc('fn_su_vu_count_unread', { 
        p_ma_nv: SESSION.maNV, p_ma_ch: SESSION.maCH || SESSION.cuaHangMa
      });
      const badge = document.getElementById('bg-su-vu-badge');
      if (badge && data && data.tong > 0) {
        badge.style.display = 'inline-block';
        badge.textContent = data.tong;
      }
    } catch(e){ /* silent */ }
  }

  // ═════════════════════════════════════════════════════════════════════
  //  TAB 1: TẠO BÀN GIAO
  // ═════════════════════════════════════════════════════════════════════
  async function renderTabTao(){
    // Init form data
    if (!BG.currentForm) BG.currentForm = newFormData();
    
    const items = await loadDanhMuc();
    const itemsByKv = { 1: [], 2: [], 4: [] };
    items.forEach(it => { itemsByKv[it.khu_vuc].push(it); });
    
    // Populate items vào form nếu chưa có (default Đạt)
    if (!BG.currentForm.taisan || BG.currentForm.taisan.length === 0) {
      BG.currentForm.taisan = items.map(it => ({
        stt: it.stt, ten: it.ten, don_vi: it.don_vi, khu_vuc: it.khu_vuc,
        dat: true, ghi_chu: ''
      }));
    }
    if (!BG.currentForm.hang || BG.currentForm.hang.length === 0) {
      const nhom = ['Nhóm Nón Vải','Nhóm Nón Bảo Hiểm','Nhóm Phụ Kiện (Lưới, kính....)'];
      BG.currentForm.hang = [];
      for (const kv of ['SANH','KHO','NIEM_PHONG']) {
        for (const nh of nhom) {
          BG.currentForm.hang.push({ khu_vuc: kv, nhom_hang: nh, so_luong_thuc_te: 0, ghi_chu: '' });
        }
      }
    }
    
    const container = document.getElementById('bg-tab-content');
    container.innerHTML = `
      <!-- I. Tiền mặt & Doanh thu -->
      <div class="bg-card">
        <div class="bg-card-header"><h3>I. Bàn giao tiền mặt & doanh thu</h3></div>
        <div class="bg-card-body" id="bg-tien-body"></div>
      </div>

      <!-- II. Tài sản 45 items -->
      <div class="bg-card">
        <div class="bg-card-header">
          <h3>II. Tài sản & trang thiết bị</h3>
          <span id="bg-ts-summary" style="font:600 12px 'JetBrains Mono';color:var(--slate-600)"></span>
        </div>
        <div class="bg-quick-row">
          <button class="bg-quick-btn active" data-filter="all" onclick="bgFilterItems('all')">Tất cả</button>
          <button class="bg-quick-btn" data-filter="kd" onclick="bgFilterItems('kd')">Không đạt</button>
        </div>
        <div class="bg-search">
          <input type="text" id="bg-search-input" placeholder="🔍 Tìm hạng mục..." oninput="bgSearchItems(this.value)">
        </div>
        <div id="bg-items-container"></div>
      </div>

      <!-- III. Hàng hóa Sảnh + Kho + Niêm phong -->
      <div class="bg-card">
        <div class="bg-card-header"><h3>III. Hàng hóa & tồn kho</h3></div>
        <div id="bg-hang-body"></div>
      </div>

      <!-- IV. Ghi chú chung + mức độ -->
      <div class="bg-card">
        <div class="bg-card-header"><h3>IV. Ghi chú phát sinh</h3></div>
        <div class="bg-card-body">
          <textarea id="bg-ghichu-chung" rows="3" 
            style="width:100%;padding:10px;border:1px solid var(--slate-200);border-radius:8px;font:500 13px 'Be Vietnam Pro';resize:vertical"
            placeholder="Sự việc phát sinh trong ca chưa xử lý xong..."
            oninput="BG.currentForm.ghi_chu_chung=this.value"
          >${escHtml(BG.currentForm.ghi_chu_chung || '')}</textarea>
        </div>
      </div>

      <!-- V. Ảnh biên bản giấy -->
      <div class="bg-card">
        <div class="bg-card-header">
          <h3>V. Ảnh biên bản giấy đã ký</h3>
          <span id="bg-photo-count" style="font:500 11px 'Be Vietnam Pro';color:var(--slate-600)">0/6 ảnh</span>
        </div>
        <div id="bg-photo-grid" class="bg-photo-grid"></div>
      </div>

      <div style="height:80px"></div>

      <!-- Sticky bottom: Gửi bàn giao -->
      <div class="bg-sticky-bottom">
        <div class="bg-progress-text" id="bg-progress-text">Đang chuẩn bị...</div>
        <button class="bg-btn bg-btn-primary" id="bg-submit-btn" onclick="bgSubmit()">Gửi bàn giao</button>
      </div>
    `;
    
    renderTienMat();
    renderItems('all', '');
    renderHang();
    renderPhotos();
    updateProgress();
  }

  function newFormData(){
    return {
      ma_ch: SESSION.maCH || SESSION.cuaHangMa,
      ten_ch_snapshot: SESSION.tenCH || '',
      nguoi_ban_giao_ma_nv: SESSION.maNV,
      nguoi_ban_giao_ten: SESSION.hoTen || SESSION.tenNV || '',
      nguoi_ban_giao_chuc_vu: SESSION.vaiTro || 'NV',
      ngay_ban_giao: new Date().toISOString().slice(0,10),
      gio_ban_giao: new Date().toTimeString().slice(0,8),
      thoi_gian_chot_tu: null,
      thoi_gian_chot_den: null,
      tien_mat_ket: 0, tien_mat_ket_ghi_chu: '',
      tien_ban_hang: 0, tien_ban_hang_ghi_chu: '',
      tien_chi: 0, tien_chi_ghi_chu: '',
      ghi_chu_chung: '',
      muc_do_ghi_chu: null,    // KHAN_CAP nếu user pick
      taisan: [],
      hang: []
    };
  }

  // ─── Render Tiền mặt ──────────────────────────────────────────────────
  function renderTienMat(){
    const body = document.getElementById('bg-tien-body');
    const rows = [
      { key:'tien_mat_ket', label:'Tiền mặt trong két và trong kho' },
      { key:'tien_ban_hang', label:'Tiền bán hàng thu trong ca' },
      { key:'tien_chi', label:'Tiền chi trong ca' }
    ];
    body.innerHTML = rows.map((r, i)=>{
      const hasNote = !!BG.currentForm[r.key + '_ghi_chu'];
      const val = BG.currentForm[r.key] || 0;
      return `
        <div class="bg-tien-row">
          <div class="label">${r.label}</div>
          <input type="text" inputmode="numeric" class="val" 
            value="${formatVND(val)}" 
            onblur="bgUpdateTien('${r.key}', this.value)"
            onfocus="this.value=BG.currentForm.${r.key}||''">
          <button class="note-btn ${hasNote?'has':''}" onclick="bgToggleTienNote(${i})">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </button>
        </div>
        <div class="bg-note-inline" id="bg-tien-note-${i}">
          <textarea placeholder="Ghi chú/giải trình (nếu lệch tiền)..." 
            oninput="BG.currentForm.${r.key}_ghi_chu=this.value">${escHtml(BG.currentForm[r.key+'_ghi_chu']||'')}</textarea>
        </div>
      `;
    }).join('') + `
      <div class="bg-tien-row total">
        <div class="label">Tổng tiền mặt bàn giao (1+2-3)</div>
        <div class="val" id="bg-tien-tong">0</div>
      </div>
    `;
    updateTienTong();
  }

  window.bgUpdateTien = function(key, str){
    const v = parseInt(String(str).replace(/[^\d]/g,''), 10) || 0;
    BG.currentForm[key] = v;
    document.querySelector(`[onblur*="${key}"]`).value = formatVND(v);
    updateTienTong();
    updateProgress();
  };
  
  window.bgToggleTienNote = function(i){
    document.getElementById('bg-tien-note-'+i).classList.toggle('on');
  };

  function updateTienTong(){
    const tong = (BG.currentForm.tien_mat_ket||0) + (BG.currentForm.tien_ban_hang||0) - (BG.currentForm.tien_chi||0);
    const el = document.getElementById('bg-tien-tong');
    if (el) el.textContent = formatVND(tong);
  }

  function formatVND(n){
    return (n || 0).toLocaleString('vi-VN');
  }

  // ─── Render 45 items ──────────────────────────────────────────────────
  function renderItems(filter, search){
    const container = document.getElementById('bg-items-container');
    const items = BG.currentForm.taisan || [];
    const searchLc = (search || '').toLowerCase().trim();
    
    const groups = { 1: [], 2: [], 4: [] };
    items.forEach((it, idx) => {
      if (filter === 'kd' && it.dat) return;
      if (searchLc && it.ten.toLowerCase().indexOf(searchLc) < 0) return;
      groups[it.khu_vuc].push({ ...it, _idx: idx });
    });
    
    const KV_TITLE = {
      1: 'A. Khu vực 1 — Mặt tiền, hạ tầng & không gian chung',
      2: 'B. Khu vực 2 — Quầy thu ngân & thiết bị IT',
      4: 'C. Khu vực 4 — Kho, sinh hoạt & công cụ dụng cụ'
    };
    
    let html = '';
    for (const kv of [1, 2, 4]) {
      const arr = groups[kv];
      if (arr.length === 0 && (filter !== 'all' || searchLc)) continue;
      const ok = arr.filter(x=>x.dat).length;
      const bad = arr.length - ok;
      html += `
        <div class="bg-section" id="bg-section-${kv}">
          <div class="bg-section-head" onclick="bgToggleSection(${kv})">
            <div class="title">${KV_TITLE[kv]}</div>
            <div class="stats"><span class="ok">${ok}✓</span> ${bad>0?`<span class="bad">${bad}✗</span>`:''}</div>
            <div class="chevron">▼</div>
          </div>
          <div class="bg-items-list">
            ${arr.map(it=>`
              <div class="bg-item-row ${it.ghi_chu?'expanded':''}" data-idx="${it._idx}">
                <div class="stt">${it.stt}</div>
                <div class="info">
                  <div class="name">${escHtml(it.ten)}</div>
                  <div class="unit">${escHtml(it.don_vi||'')}</div>
                </div>
                <div class="bg-toggle ${it.dat?'dat':'khong-dat'}" onclick="bgToggleItem(${it._idx})">
                  ${it.dat?'Đạt':'Không đạt'}
                </div>
                <button class="bg-item-note-btn ${it.ghi_chu?'has':''}" 
                  onclick="bgItemNote(${it._idx})" ${it.dat?'disabled':''}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </button>
              </div>
              <div class="bg-item-note ${it.ghi_chu?'on':''}" id="bg-item-note-${it._idx}">
                <textarea placeholder="Mô tả tình trạng hư hỏng/mất/thiếu..." 
                  oninput="bgItemNoteInput(${it._idx}, this.value)">${escHtml(it.ghi_chu||'')}</textarea>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
    container.innerHTML = html;
    updateItemsSummary();
  }

  function updateItemsSummary(){
    const items = BG.currentForm.taisan || [];
    const ok = items.filter(it=>it.dat).length;
    const bad = items.length - ok;
    const el = document.getElementById('bg-ts-summary');
    if (el) el.innerHTML = `<span style="color:var(--emerald-soft)">${ok}✓</span> <span style="color:var(--red-dark)">${bad}✗</span> / ${items.length}`;
  }

  window.bgToggleItem = function(idx){
    const it = BG.currentForm.taisan[idx];
    it.dat = !it.dat;
    if (it.dat) it.ghi_chu = '';   // chuyển về Đạt → xóa ghi chú
    renderItems(getCurrentFilter(), document.getElementById('bg-search-input').value);
    updateProgress();
  };
  
  window.bgItemNote = function(idx){
    const noteEl = document.getElementById('bg-item-note-'+idx);
    if (!noteEl) return;
    noteEl.classList.toggle('on');
    if (noteEl.classList.contains('on')) {
      setTimeout(()=>noteEl.querySelector('textarea').focus(), 50);
    }
  };
  
  window.bgItemNoteInput = function(idx, val){
    BG.currentForm.taisan[idx].ghi_chu = val;
    // update icon button highlight
    const row = document.querySelector(`[data-idx="${idx}"]`);
    if (row) {
      const btn = row.querySelector('.bg-item-note-btn');
      btn.classList.toggle('has', !!val);
    }
  };
  
  window.bgToggleSection = function(kv){
    document.getElementById('bg-section-'+kv).classList.toggle('collapsed');
    document.querySelector(`#bg-section-${kv} .bg-section-head`).classList.toggle('collapsed');
  };

  function getCurrentFilter(){
    const active = document.querySelector('.bg-quick-btn.active');
    return active ? active.dataset.filter : 'all';
  }

  window.bgFilterItems = function(f){
    document.querySelectorAll('.bg-quick-btn').forEach(b=>b.classList.toggle('active', b.dataset.filter===f));
    renderItems(f, document.getElementById('bg-search-input').value);
  };

  window.bgSearchItems = function(v){
    renderItems(getCurrentFilter(), v);
  };

  // ─── Render Hàng hóa ──────────────────────────────────────────────────
  function renderHang(){
    const body = document.getElementById('bg-hang-body');
    const KV_LABEL = { 'SANH':'A. Khu vực sảnh trưng bày', 'KHO':'B. Khu vực kho', 'NIEM_PHONG':'C. Hàng niêm phong' };
    const rows = BG.currentForm.hang || [];
    let html = '';
    for (const kv of ['SANH','KHO','NIEM_PHONG']) {
      html += `<div class="bg-hang-section">${KV_LABEL[kv]}</div>`;
      rows.filter(r=>r.khu_vuc===kv).forEach((r, _idx)=>{
        const globalIdx = rows.indexOf(r);
        const hasNote = !!r.ghi_chu;
        html += `
          <div class="bg-hang-row">
            <div class="info">
              <div class="name">${escHtml(r.nhom_hang)}</div>
              <div class="unit">Cái</div>
            </div>
            <input type="number" inputmode="numeric" min="0" class="val" 
              value="${r.so_luong_thuc_te||0}" 
              onchange="bgUpdateHang(${globalIdx}, this.value)">
            <button class="note-btn ${hasNote?'has':''}" onclick="bgToggleHangNote(${globalIdx})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </button>
          </div>
          <div class="bg-note-inline" id="bg-hang-note-${globalIdx}" style="padding:0 16px 12px">
            <textarea placeholder="Chênh lệch/ghi chú..." 
              oninput="bgUpdateHangNote(${globalIdx}, this.value)">${escHtml(r.ghi_chu||'')}</textarea>
          </div>
        `;
      });
    }
    body.innerHTML = html;
  }

  window.bgUpdateHang = function(idx, val){
    BG.currentForm.hang[idx].so_luong_thuc_te = parseInt(val, 10) || 0;
  };
  window.bgToggleHangNote = function(idx){
    document.getElementById('bg-hang-note-'+idx).classList.toggle('on');
  };
  window.bgUpdateHangNote = function(idx, val){
    BG.currentForm.hang[idx].ghi_chu = val;
    const btn = document.querySelector(`[onclick="bgToggleHangNote(${idx})"]`);
    if (btn) btn.classList.toggle('has', !!val);
  };

  // ─── Photo grid + CamScanner ──────────────────────────────────────────
  function renderPhotos(){
    const grid = document.getElementById('bg-photo-grid');
    const photos = BG.photoBlobs;
    let html = photos.map((p, i)=>`
      <div class="bg-photo-thumb" onclick="bgPreviewPhoto(${i})">
        <img src="${p.dataUrl}" alt="">
        <button class="del" onclick="event.stopPropagation(); bgDelPhoto(${i})">×</button>
      </div>
    `).join('');
    if (photos.length < 6) {
      html += `
        <div class="bg-photo-add" onclick="bgAddPhoto()">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          <span>Chụp biên bản</span>
        </div>
      `;
    }
    grid.innerHTML = html;
    document.getElementById('bg-photo-count').textContent = `${photos.length}/6 ảnh`;
  }

  window.bgAddPhoto = function(){
    if (BG.photoBlobs.length >= 6) { alert('Tối đa 6 ảnh'); return; }
    if (typeof csOpen !== 'function') {
      alert('Module camera chưa sẵn sàng — vui lòng tải lại trang');
      return;
    }
    csOpen({
      onComplete: (blob, dataUrl)=>{
        BG.photoBlobs.push({ blob, dataUrl, url: null, path: null });
        renderPhotos();
        updateProgress();
      },
      onCancel: ()=>{}
    });
  };

  window.bgDelPhoto = function(i){
    BG.photoBlobs.splice(i, 1);
    renderPhotos();
    updateProgress();
  };

  window.bgPreviewPhoto = function(i){
    const p = BG.photoBlobs[i];
    if (!p) return;
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:pointer';
    ov.onclick = ()=>ov.remove();
    ov.innerHTML = `<img src="${p.dataUrl}" style="max-width:95%;max-height:95%;object-fit:contain;border-radius:8px">`;
    document.body.appendChild(ov);
  };

  // ─── Progress / Submit ────────────────────────────────────────────────
  function updateProgress(){
    const items = BG.currentForm.taisan || [];
    const totalChecked = items.length;  // tất cả đã default Đạt
    const photosCount = BG.photoBlobs.length;
    
    const el = document.getElementById('bg-progress-text');
    const btn = document.getElementById('bg-submit-btn');
    if (!el || !btn) return;
    
    // Validate: cần ít nhất 1 ảnh biên bản
    if (photosCount === 0) {
      el.innerHTML = '<span class="pending">Cần ít nhất 1 ảnh biên bản giấy</span>';
      btn.disabled = true;
    } else {
      const itemsKD = items.filter(x=>!x.dat).length;
      el.innerHTML = `<b>${formatVND(BG.currentForm.tien_mat_ket+BG.currentForm.tien_ban_hang-BG.currentForm.tien_chi)}</b> · ${photosCount} ảnh · ${itemsKD} hạng mục không đạt`;
      btn.disabled = false;
    }
  }

  window.bgSubmit = async function(){
    const btn = document.getElementById('bg-submit-btn');
    btn.disabled = true;
    btn.textContent = 'Đang xử lý...';
    
    try {
      // 1) Upload ảnh lên Supabase Storage
      const uploadedUrls = [];
      const uploadedPaths = [];
      const bucket = 'bien-ban-ban-giao';
      const ngay = BG.currentForm.ngay_ban_giao;
      const maCH = BG.currentForm.ma_ch;
      for (let i = 0; i < BG.photoBlobs.length; i++) {
        btn.textContent = `Tải ảnh ${i+1}/${BG.photoBlobs.length}...`;
        const p = BG.photoBlobs[i];
        const path = `${maCH}/${ngay}/${Date.now()}_${i}_${SESSION.maNV}.jpg`;
        const { error: upErr } = await supa.storage.from(bucket).upload(path, p.blob, {
          contentType: 'image/jpeg', upsert: false
        });
        if (upErr) throw new Error('Upload ảnh ' + (i+1) + ': ' + upErr.message);
        const { data: pub } = supa.storage.from(bucket).getPublicUrl(path);
        uploadedUrls.push(pub.publicUrl);
        uploadedPaths.push(path);
      }
      
      // 2) Insert header + items + hàng (atomic)
      btn.textContent = 'Đang lưu biên bản...';
      const { data: banGiaoId, error: createErr } = await supa.rpc('fn_ban_giao_create', {
        p_ma_ch: BG.currentForm.ma_ch,
        p_ten_ch_snapshot: BG.currentForm.ten_ch_snapshot,
        p_nguoi_ban_giao_ma_nv: BG.currentForm.nguoi_ban_giao_ma_nv,
        p_nguoi_ban_giao_ten: BG.currentForm.nguoi_ban_giao_ten,
        p_nguoi_ban_giao_chuc_vu: BG.currentForm.nguoi_ban_giao_chuc_vu,
        p_ngay_ban_giao: BG.currentForm.ngay_ban_giao,
        p_gio_ban_giao: BG.currentForm.gio_ban_giao,
        p_thoi_gian_chot_tu: BG.currentForm.thoi_gian_chot_tu,
        p_thoi_gian_chot_den: BG.currentForm.thoi_gian_chot_den,
        p_tien_mat_ket: BG.currentForm.tien_mat_ket,
        p_tien_mat_ket_ghi_chu: BG.currentForm.tien_mat_ket_ghi_chu,
        p_tien_ban_hang: BG.currentForm.tien_ban_hang,
        p_tien_ban_hang_ghi_chu: BG.currentForm.tien_ban_hang_ghi_chu,
        p_tien_chi: BG.currentForm.tien_chi,
        p_tien_chi_ghi_chu: BG.currentForm.tien_chi_ghi_chu,
        p_ghi_chu_chung: BG.currentForm.ghi_chu_chung,
        p_anh_urls: uploadedUrls,
        p_anh_storage_paths: uploadedPaths,
        p_chi_tiet_tai_san: BG.currentForm.taisan.map(it=>({
          stt: it.stt, ten: it.ten, don_vi: it.don_vi, khu_vuc: it.khu_vuc,
          dat: it.dat, ghi_chu: it.ghi_chu
        })),
        p_chi_tiet_hang: BG.currentForm.hang
      });
      if (createErr) throw createErr;
      
      // 3) Auto-create sự vụ cho từng item không đạt + chênh lệch hàng + ghi chú khẩn
      btn.textContent = 'Đang tạo sự vụ...';
      const suVuCreated = await autoCreateSuVu(banGiaoId);
      
      // 4) Reset form, jump sang tab lịch sử
      BG.currentForm = null;
      BG.photoBlobs = [];
      alert(`✓ Đã gửi biên bản thành công.\n${suVuCreated} sự vụ phát sinh đã được tạo và gửi đến quản lý.`);
      await renderBanGiaoPage();
      bgSwitchTab('lich-su');
    } catch(e){
      console.error(e);
      alert('Lỗi: ' + e.message);
      btn.disabled = false;
      btn.textContent = 'Gửi bàn giao';
    }
  };

  async function autoCreateSuVu(banGiaoId){
    let count = 0;
    const itemsKD = (BG.currentForm.taisan || []).filter(it => !it.dat);
    for (const it of itemsKD) {
      // Mức độ default = QUAN_TRONG, NV có thể edit sau
      await supa.rpc('fn_su_vu_create', {
        p_ban_giao_id: banGiaoId,
        p_loai: 'TAI_SAN_KHONG_DAT',
        p_ma_ch: BG.currentForm.ma_ch,
        p_ten_ch_snapshot: BG.currentForm.ten_ch_snapshot,
        p_nguoi_tao_ma_nv: BG.currentForm.nguoi_ban_giao_ma_nv,
        p_nguoi_tao_ten: BG.currentForm.nguoi_ban_giao_ten,
        p_nguoi_tao_chuc_vu: BG.currentForm.nguoi_ban_giao_chuc_vu,
        p_tieu_de: it.ten + ' — Không đạt',
        p_mo_ta: it.ghi_chu || '',
        p_so_lieu: { stt: it.stt, khu_vuc: it.khu_vuc },
        p_anh_urls: [],
        p_muc_do: 'QUAN_TRONG'
      });
      count++;
    }
    // Chênh lệch hàng (chỉ tạo sự vụ nếu CÓ ghi chú — nghĩa là có chênh lệch)
    const hangChenh = (BG.currentForm.hang || []).filter(h => h.ghi_chu && h.ghi_chu.trim());
    for (const h of hangChenh) {
      await supa.rpc('fn_su_vu_create', {
        p_ban_giao_id: banGiaoId,
        p_loai: 'HANG_CHENH',
        p_ma_ch: BG.currentForm.ma_ch,
        p_ten_ch_snapshot: BG.currentForm.ten_ch_snapshot,
        p_nguoi_tao_ma_nv: BG.currentForm.nguoi_ban_giao_ma_nv,
        p_nguoi_tao_ten: BG.currentForm.nguoi_ban_giao_ten,
        p_nguoi_tao_chuc_vu: BG.currentForm.nguoi_ban_giao_chuc_vu,
        p_tieu_de: h.nhom_hang + ' (' + h.khu_vuc + ') — Chênh lệch',
        p_mo_ta: h.ghi_chu,
        p_so_lieu: { khu_vuc: h.khu_vuc, nhom: h.nhom_hang, sl: h.so_luong_thuc_te },
        p_anh_urls: [],
        p_muc_do: 'QUAN_TRONG'
      });
      count++;
    }
    // Tiền lệch (nếu có ghi chú)
    for (const k of ['tien_mat_ket','tien_ban_hang','tien_chi']) {
      const note = BG.currentForm[k + '_ghi_chu'];
      if (note && note.trim()) {
        await supa.rpc('fn_su_vu_create', {
          p_ban_giao_id: banGiaoId,
          p_loai: 'TIEN_LECH',
          p_ma_ch: BG.currentForm.ma_ch,
          p_ten_ch_snapshot: BG.currentForm.ten_ch_snapshot,
          p_nguoi_tao_ma_nv: BG.currentForm.nguoi_ban_giao_ma_nv,
          p_nguoi_tao_ten: BG.currentForm.nguoi_ban_giao_ten,
          p_nguoi_tao_chuc_vu: BG.currentForm.nguoi_ban_giao_chuc_vu,
          p_tieu_de: ({tien_mat_ket:'Tiền két',tien_ban_hang:'Tiền bán hàng',tien_chi:'Tiền chi'}[k]) + ' — Có ghi chú/lệch',
          p_mo_ta: note,
          p_so_lieu: { loai: k, so_tien: BG.currentForm[k] },
          p_anh_urls: [],
          p_muc_do: 'KHAN_CAP'
        });
        count++;
      }
    }
    return count;
  }

  // ═════════════════════════════════════════════════════════════════════
  //  TAB 2: LỊCH SỬ BÀN GIAO
  // ═════════════════════════════════════════════════════════════════════
  async function renderTabLichSu(){
    const container = document.getElementById('bg-tab-content');
    container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--slate-400)">Đang tải...</div>';
    
    const { data: list, error } = await supa.rpc('fn_ban_giao_list', {
      p_ma_ch: SESSION.maCH || SESSION.cuaHangMa,
      p_limit: 50, p_offset: 0
    });
    if (error) { container.innerHTML = '<div style="padding:20px;color:var(--red-dark)">Lỗi: '+error.message+'</div>'; return; }
    if (!list || list.length === 0) {
      container.innerHTML = '<div style="padding:40px 20px;text-align:center;color:var(--slate-400)">Chưa có biên bản nào.</div>'; return;
    }
    container.innerHTML = list.map(b => `
      <div class="sv-card" onclick="bgOpenDetail('${b.id}')">
        <div class="top">
          <div class="title">${escHtml(b.ten_ch_snapshot || b.ma_ch)} — ${formatDate(b.ngay_ban_giao)}</div>
          <span class="status ${b.trang_thai}">${b.trang_thai==='DA_GUI'?'Đã gửi':b.trang_thai==='DA_TIEP_NHAN'?'Đã tiếp nhận':b.trang_thai}</span>
        </div>
        <div class="meta">
          <b>Người giao:</b> ${escHtml(b.nguoi_ban_giao_ten||'?')} · 
          <b>Tiền:</b> ${formatVND(b.tien_tong)}đ · 
          <b>Ảnh:</b> ${b.so_anh} · 
          <b>Không đạt:</b> ${b.so_item_khong_dat}
          ${b.so_su_vu_khan > 0 ? `· <span style="color:var(--red-dark);font-weight:700">${b.so_su_vu_khan} sự vụ khẩn</span>` : ''}
        </div>
      </div>
    `).join('');
  }

  window.bgOpenDetail = async function(id){
    const { data, error } = await supa.rpc('fn_ban_giao_get', { p_id: id });
    if (error || !data) { alert('Không tải được'); return; }
    showBanGiaoDetail(data);
  };

  function showBanGiaoDetail(data){
    const h = data.header || {};
    const anh = data.anh || [];
    const ts = data.tai_san || [];
    const tsKD = ts.filter(t=>!t.dat);
    const hg = data.hang || [];
    const sv = data.su_vu || [];
    const ackArr = data.ack || [];
    
    const ov = document.createElement('div');
    ov.className = 'sv-detail';
    ov.innerHTML = `
      <div class="head">
        <button class="back" onclick="this.closest('.sv-detail').remove()">‹</button>
        <div class="title">Biên bản ${formatDate(h.ngay_ban_giao)} — ${h.gio_ban_giao||''}</div>
      </div>
      <div class="bg-card">
        <div class="bg-card-body">
          <div style="font:600 14px;color:var(--slate-800);margin-bottom:6px">${escHtml(h.ten_ch_snapshot||h.ma_ch||'')}</div>
          <div style="font:500 12px;color:var(--slate-600)">Người giao: <b>${escHtml(h.nguoi_ban_giao_ten||'?')}</b></div>
          <div style="font:500 12px;color:var(--slate-600)">Người nhận: <b>${escHtml(h.nguoi_nhan_ten||'(chưa)')}</b></div>
        </div>
      </div>
      
      <!-- Tiền mặt -->
      <div class="bg-card">
        <div class="bg-card-header"><h3>Tiền mặt</h3></div>
        <div class="bg-card-body" style="font:500 13px 'JetBrains Mono'">
          Két: ${formatVND(h.tien_mat_ket)}đ${h.tien_mat_ket_ghi_chu?` <span style="color:var(--amber)">— ${escHtml(h.tien_mat_ket_ghi_chu)}</span>`:''}<br>
          Bán hàng: ${formatVND(h.tien_ban_hang)}đ${h.tien_ban_hang_ghi_chu?` <span style="color:var(--amber)">— ${escHtml(h.tien_ban_hang_ghi_chu)}</span>`:''}<br>
          Chi: ${formatVND(h.tien_chi)}đ${h.tien_chi_ghi_chu?` <span style="color:var(--amber)">— ${escHtml(h.tien_chi_ghi_chu)}</span>`:''}<br>
          <b style="font-size:15px;color:var(--bg-navy-deep)">Tổng: ${formatVND(h.tien_tong)}đ</b>
        </div>
      </div>
      
      <!-- Ảnh -->
      ${anh.length ? `
      <div class="bg-card">
        <div class="bg-card-header"><h3>${anh.length} ảnh biên bản giấy</h3></div>
        <div class="bg-photo-grid">
          ${anh.map(a=>`<div class="bg-photo-thumb" onclick="bgViewImg('${a.anh_url}')"><img src="${a.anh_url}" loading="lazy" onerror="this.src='${a.anh_url_drive||''}'"></div>`).join('')}
        </div>
      </div>` : ''}
      
      <!-- Items không đạt -->
      ${tsKD.length ? `
      <div class="bg-card">
        <div class="bg-card-header"><h3 style="color:var(--red-dark)">${tsKD.length} hạng mục không đạt</h3></div>
        <div>
          ${tsKD.map(t=>`
            <div class="bg-item-row">
              <div class="stt">${t.stt_chuan||'+'}</div>
              <div class="info">
                <div class="name">${escHtml(t.ten_hang_muc)}</div>
                ${t.ghi_chu?`<div class="unit" style="color:var(--red-dark)">${escHtml(t.ghi_chu)}</div>`:''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>` : ''}
      
      <!-- Hàng có ghi chú -->
      ${hg.filter(x=>x.ghi_chu).length ? `
      <div class="bg-card">
        <div class="bg-card-header"><h3>Hàng hóa có chênh lệch/ghi chú</h3></div>
        <div>
          ${hg.filter(x=>x.ghi_chu).map(x=>`
            <div class="bg-item-row">
              <div class="info">
                <div class="name">${escHtml(x.nhom_hang)} — ${x.khu_vuc}</div>
                <div class="unit">Số lượng: ${x.so_luong_thuc_te} · ${escHtml(x.ghi_chu)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>` : ''}
      
      ${h.ghi_chu_chung ? `
      <div class="bg-card">
        <div class="bg-card-header"><h3>Ghi chú chung</h3></div>
        <div class="bg-card-body">${escHtml(h.ghi_chu_chung)}</div>
      </div>` : ''}
      
      ${sv.length ? `
      <div class="bg-card">
        <div class="bg-card-header"><h3>${sv.length} sự vụ phát sinh</h3></div>
        <div>
          ${sv.map(s=>`
            <div class="sv-card ${s.muc_do==='KHAN_CAP'?'khan':s.muc_do==='QUAN_TRONG'?'quan':'can'}" style="margin:8px" onclick="bgOpenSuVu('${s.id}')">
              <div class="top">
                <div class="title">${escHtml(s.tieu_de)}</div>
                <span class="status ${s.trang_thai}">${suVuStatusLabel(s.trang_thai)}</span>
              </div>
              <div class="meta">${mucDoLabel(s.muc_do)}</div>
            </div>
          `).join('')}
        </div>
      </div>` : ''}
      
      ${ackArr.length ? `
      <div class="bg-card">
        <div class="bg-card-header"><h3>${ackArr.length} người đã ack</h3></div>
        <div>
          ${ackArr.map(a=>`<div class="bg-item-row"><div class="info"><div class="name">${escHtml(a.ten_nv||a.ma_nv)}</div><div class="unit">${formatDateTime(a.ack_at)}</div></div></div>`).join('')}
        </div>
      </div>` : ''}
      
      <div style="height:40px"></div>
    `;
    document.body.appendChild(ov);
  }

  window.bgViewImg = function(url){
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.95);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:pointer';
    ov.onclick = ()=>ov.remove();
    ov.innerHTML = `<img src="${url}" style="max-width:95%;max-height:95%;object-fit:contain">`;
    document.body.appendChild(ov);
  };

  // ═════════════════════════════════════════════════════════════════════
  //  TAB 3: SỰ VỤ — NV view
  // ═════════════════════════════════════════════════════════════════════
  async function renderTabSuVu(){
    const container = document.getElementById('bg-tab-content');
    container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--slate-400)">Đang tải...</div>';
    const { data, error } = await supa.rpc('fn_su_vu_list', {
      p_ma_ch: SESSION.maCH || SESSION.cuaHangMa,
      p_limit: 100, p_offset: 0
    });
    if (error) { container.innerHTML = '<div style="padding:20px;color:var(--red-dark)">'+error.message+'</div>'; return; }
    if (!data || data.length === 0) {
      container.innerHTML = '<div style="padding:40px 20px;text-align:center;color:var(--slate-400)">Chưa có sự vụ.</div>'; return;
    }
    container.innerHTML = data.map(s=>`
      <div class="sv-card ${s.muc_do==='KHAN_CAP'?'khan':s.muc_do==='QUAN_TRONG'?'quan':'can'}" onclick="bgOpenSuVu('${s.id}')">
        <div class="top">
          <div class="title">${escHtml(s.tieu_de)}</div>
          <span class="status ${s.trang_thai}">${suVuStatusLabel(s.trang_thai)}</span>
        </div>
        <div class="meta">
          ${mucDoLabel(s.muc_do)} · <b>${escHtml(s.nguoi_tao_ten||'?')}</b> · ${formatDateTime(s.created_at)}
          ${s.nguoi_phu_trach_ten?`· Phụ trách: <b>${escHtml(s.nguoi_phu_trach_ten)}</b>`:''}
        </div>
        ${s.mo_ta?`<div class="meta" style="font-style:italic">"${escHtml(s.mo_ta).slice(0,140)}"</div>`:''}
        <div class="seen">${s.so_nguoi_xem||0} người đã xem</div>
      </div>
    `).join('');
  }

  // ─── Sự vụ chi tiết ──────────────────────────────────────────────────
  window.bgOpenSuVu = async function(id){
    // Log view
    try {
      await supa.rpc('fn_su_vu_log_view', {
        p_su_vu_id: id,
        p_ma_nv: SESSION.maNV,
        p_ten_nv: SESSION.hoTen || SESSION.tenNV,
        p_ma_ch: SESSION.maCH || SESSION.cuaHangMa,
        p_vai_tro: SESSION.vaiTro || 'NV'
      });
    } catch(e){}
    
    const { data, error } = await supa.rpc('fn_su_vu_get', { p_id: id });
    if (error || !data) { alert('Không tải được'); return; }
    showSuVuDetail(data);
  };

  function showSuVuDetail(data){
    const s = data.su_vu || {};
    const audit = data.audit || [];
    const nguoiXem = data.nguoi_xem || [];
    const role = (SESSION.vaiTro||'').toUpperCase();
    const canClose = (role === 'TAI_KHOAN_CH' || role === 'CUA_HANG' || /TRUONG.*CA/i.test(SESSION.chucVu||'') || /TC/i.test(SESSION.chucVu||''));
    
    const ov = document.createElement('div');
    ov.className = 'sv-detail';
    ov.innerHTML = `
      <div class="head">
        <button class="back" onclick="this.closest('.sv-detail').remove()">‹</button>
        <div class="title">Sự vụ</div>
        <span class="status ${s.trang_thai}" style="padding:4px 10px;border-radius:99px;background:rgba(255,255,255,.16);font:700 11px;color:#fff">${suVuStatusLabel(s.trang_thai)}</span>
      </div>
      
      <div class="bg-card" style="border-left:4px solid ${s.muc_do==='KHAN_CAP'?'var(--red-dark)':s.muc_do==='QUAN_TRONG'?'var(--amber)':'var(--slate-400)'}">
        <div class="bg-card-body">
          <div style="font:600 16px 'Be Vietnam Pro';color:var(--slate-800);margin-bottom:6px">${escHtml(s.tieu_de||'')}</div>
          <div style="font:500 12px;color:var(--slate-600);margin-bottom:8px">
            ${mucDoLabel(s.muc_do)} · ${escHtml(s.ten_ch_snapshot||s.ma_ch||'')}
          </div>
          ${s.mo_ta?`<div style="font:500 13px;color:var(--slate-800);background:var(--slate-50);padding:10px;border-radius:8px;margin-top:8px">${escHtml(s.mo_ta)}</div>`:''}
        </div>
      </div>
      
      <div class="seen-bar">
        <div class="progress"><div class="fill" id="sv-seen-fill" style="width:0%"></div></div>
        <div class="text" id="sv-seen-text">--/--</div>
      </div>
      
      ${s.phan_hoi_xu_ly ? `
      <div class="bg-card" style="border-left:3px solid var(--teal)">
        <div class="bg-card-header"><h3 style="color:var(--teal)">Phản hồi từ quản lý</h3></div>
        <div class="bg-card-body">
          <div style="font:500 13px;color:var(--slate-800);white-space:pre-wrap">${escHtml(s.phan_hoi_xu_ly)}</div>
          <div style="font:400 11px;color:var(--slate-400);margin-top:8px">${formatDateTime(s.thoi_gian_phan_hoi)} bởi ${escHtml(s.nguoi_phu_trach_ten||'?')}</div>
        </div>
      </div>` : ''}
      
      <div class="sv-timeline">
        <div style="font:600 13px 'Be Vietnam Pro';color:var(--slate-800);margin-bottom:8px">Diễn biến</div>
        ${audit.length===0 ? '<div style="color:var(--slate-400);font:500 12px">Chưa có hoạt động</div>' :
          audit.map(a=>`
            <div class="item">
              <div class="dot" style="background:${actionColor(a.action)}"></div>
              <div class="body">
                <div class="who">${escHtml(a.ten_nv||a.ma_nv||'?')}</div>
                <div class="what">${actionLabel(a.action)}${a.noi_dung&&a.noi_dung.phan_hoi?': '+escHtml(a.noi_dung.phan_hoi).slice(0,80):''}</div>
                <div class="when">${formatDateTime(a.created_at)}</div>
              </div>
            </div>
          `).join('')}
      </div>
      
      ${nguoiXem.length ? `
      <div class="bg-card">
        <div class="bg-card-header"><h3>${nguoiXem.length} người đã xem</h3></div>
        <div>
          ${nguoiXem.slice(0,20).map(n=>`<div class="bg-item-row"><div class="info"><div class="name">${escHtml(n.ten_nv||n.ma_nv)}</div><div class="unit">${formatDateTime(n.xem_lan_dau)} · ${n.so_lan_xem} lần</div></div></div>`).join('')}
        </div>
      </div>` : ''}
      
      ${s.trang_thai === 'DA_PHAN_HOI' && canClose ? `
      <div class="sv-actions">
        <button class="sv-action-btn success" onclick="bgCloseSuVu('${s.id}')">✓ Xác nhận hoàn tất</button>
      </div>` : ''}
      
      <div style="height:40px"></div>
    `;
    document.body.appendChild(ov);
    
    // Load % seen
    loadPercentSeen(s.id);
  }

  async function loadPercentSeen(id){
    try {
      const { data } = await supa.rpc('fn_su_vu_percent_seen', { p_su_vu_id: id });
      if (data && !data.error) {
        document.getElementById('sv-seen-text').textContent = `${data.da_xem}/${data.tong_nv} (${data.phan_tram}%)`;
        document.getElementById('sv-seen-fill').style.width = data.phan_tram + '%';
      }
    } catch(e){}
  }

  window.bgCloseSuVu = async function(id){
    if (!confirm('Xác nhận sự vụ đã hoàn tất tại CH?\nSau khi đóng không thể mở lại (trừ ADMIN).')) return;
    const role = (SESSION.vaiTro||'').toUpperCase();
    const vaiTroDong = (role==='CUA_HANG'||role==='TAI_KHOAN_CH') ? 'TAI_KHOAN_CH' : 'TRUONG_CA';
    const { data, error } = await supa.rpc('fn_su_vu_dong', {
      p_id: id, p_ma_nv: SESSION.maNV, p_ten_nv: SESSION.hoTen||SESSION.tenNV,
      p_vai_tro_dong: vaiTroDong, p_ghi_chu: null
    });
    if (error) { alert('Lỗi: '+error.message); return; }
    if (data && data.ok === false) { alert(data.error); return; }
    alert('✓ Đã đóng sự vụ');
    document.querySelector('.sv-detail').remove();
    if (BG.currentTab==='su-vu') renderTabSuVu();
  };

  // ═════════════════════════════════════════════════════════════════════
  //  ACK FLOW — gọi khi NV chấm VAO_CA + bật cờ Trưởng ca
  // ═════════════════════════════════════════════════════════════════════
  window.bgCheckAckOnVaoCa = async function(){
    // Gọi từ flow chấm công sau khi VAO_CA + có cờ TC
    if (!SESSION) return { has_blocking: false };
    const { data, error } = await supa.rpc('fn_ban_giao_check_blocking', {
      p_ma_nv: SESSION.maNV,
      p_ma_ch: SESSION.maCH || SESSION.cuaHangMa
    });
    if (error || !data || !data.has_blocking) return { has_blocking: false };
    
    // Hiện modal force ack
    return new Promise(resolve => {
      showAckModal(data.items, resolve);
    });
  };

  function showAckModal(items, resolve){
    const ov = document.createElement('div');
    ov.className = 'bg-block-modal';
    ov.innerHTML = `
      <div class="bg-block-sheet">
        <h3>⚠ Có ${items.length} biên bản chờ tiếp nhận</h3>
        <div class="desc">Là trưởng ca, bạn cần xem và xác nhận đã tiếp nhận các biên bản dưới đây trước khi tiếp tục.</div>
        ${items.map(it=>`
          <div class="bg-block-item">
            <div class="h">Biên bản ${formatDate(it.ngay)} ${it.gio}</div>
            <div class="m">Người giao: <b>${escHtml(it.nguoi_giao||'?')}</b> · ${it.so_item_khong_dat} hạng mục không đạt</div>
            <button class="sv-action-btn primary" style="margin-top:8px;width:100%" onclick="bgViewAndAck('${it.id}', this)">Xem chi tiết</button>
          </div>
        `).join('')}
        <div class="sv-actions" style="margin-top:12px;padding:0">
          <button class="sv-action-btn ghost" onclick="this.closest('.bg-block-modal').remove(); window._bgAckResolve && window._bgAckResolve({has_blocking:true,cancelled:true})">Để sau</button>
          <button class="sv-action-btn primary" id="bg-ack-finish" disabled onclick="this.closest('.bg-block-modal').remove(); window._bgAckResolve && window._bgAckResolve({has_blocking:false,completed:true})">Xong</button>
        </div>
      </div>
    `;
    document.body.appendChild(ov);
    window._bgAckResolve = resolve;
    window._bgAckItemsCount = items.length;
    window._bgAckedCount = 0;
  }

  window.bgViewAndAck = async function(id, btn){
    const { data, error } = await supa.rpc('fn_ban_giao_get', { p_id: id });
    if (error || !data) { alert('Không tải được'); return; }
    showBanGiaoDetail(data);
    // Thêm nút ack vào cuối detail
    const ackBtn = document.createElement('div');
    ackBtn.className = 'sv-actions';
    ackBtn.style.cssText = 'position:sticky;bottom:0;background:#fff;padding:14px 16px;box-shadow:0 -2px 12px rgba(0,0,0,.1)';
    ackBtn.innerHTML = `<button class="sv-action-btn success" style="width:100%" onclick="bgAckBienBan('${id}', this)">Đã đọc — Xác nhận tiếp nhận biên bản</button>`;
    document.querySelector('.sv-detail').appendChild(ackBtn);
  };

  window.bgAckBienBan = async function(id, btn){
    btn.disabled = true; btn.textContent = 'Đang xác nhận...';
    const { error } = await supa.rpc('fn_ban_giao_ack', {
      p_ban_giao_id: id,
      p_ma_nv: SESSION.maNV,
      p_ten_nv: SESSION.hoTen||SESSION.tenNV,
      p_thiet_bi: navigator.userAgent.slice(0,200)
    });
    if (error) { alert('Lỗi: '+error.message); btn.disabled = false; return; }
    document.querySelector('.sv-detail').remove();
    window._bgAckedCount = (window._bgAckedCount||0) + 1;
    if (window._bgAckedCount >= window._bgAckItemsCount) {
      const fin = document.getElementById('bg-ack-finish');
      if (fin) fin.disabled = false;
    }
    // Update từng nút "Xem chi tiết" → "✓ Đã xem"
    const blockItems = document.querySelectorAll('.bg-block-item button');
    blockItems.forEach(b => {
      if (b.getAttribute('onclick') && b.getAttribute('onclick').indexOf(id) >= 0) {
        b.disabled = true; b.textContent = '✓ Đã xác nhận'; b.style.background = 'var(--emerald-soft)';
      }
    });
  };

  // ═════════════════════════════════════════════════════════════════════
  //  BLOCK RA_CA — gọi trước khi NV chấm RA_CA
  // ═════════════════════════════════════════════════════════════════════
  window.bgCheckBlockRaCa = async function(){
    if (!SESSION) return { allow: true };
    const { data } = await supa.rpc('fn_ban_giao_check_blocking', {
      p_ma_nv: SESSION.maNV,
      p_ma_ch: SESSION.maCH || SESSION.cuaHangMa
    });
    if (!data || !data.has_blocking) return { allow: true };
    
    // Hiển thị modal block — hard block, không cho qua
    return new Promise(resolve=>{
      const ov = document.createElement('div');
      ov.className = 'bg-block-modal';
      ov.innerHTML = `
        <div class="bg-block-sheet">
          <h3>🚫 Không thể ra ca</h3>
          <div class="desc">Có ${data.items.length} biên bản bàn giao chưa được tiếp nhận. Bạn phải xem và xác nhận trước khi ra ca.</div>
          ${data.items.map(it=>`
            <div class="bg-block-item">
              <div class="h">${formatDate(it.ngay)} ${it.gio}</div>
              <div class="m">Người giao: <b>${escHtml(it.nguoi_giao||'?')}</b></div>
              <button class="sv-action-btn primary" style="margin-top:8px;width:100%" onclick="bgViewAndAck('${it.id}', this)">Xem & xác nhận</button>
            </div>
          `).join('')}
          <div style="margin-top:12px">
            <button class="sv-action-btn ghost" style="width:100%" onclick="this.closest('.bg-block-modal').remove(); window._bgBlockResolve && window._bgBlockResolve({allow:false})">Đóng</button>
          </div>
        </div>
      `;
      document.body.appendChild(ov);
      window._bgBlockResolve = resolve;
    });
  };

  // ─── Utility ──────────────────────────────────────────────────────────
  function escHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function formatDate(d){ if(!d) return ''; const dt = new Date(d); return dt.getDate().toString().padStart(2,'0')+'/'+(dt.getMonth()+1).toString().padStart(2,'0')+'/'+dt.getFullYear(); }
  function formatDateTime(d){ if(!d) return ''; const dt = new Date(d); return formatDate(d)+' '+dt.getHours().toString().padStart(2,'0')+':'+dt.getMinutes().toString().padStart(2,'0'); }
  function mucDoLabel(m){ return {KHAN_CAP:'<b style="color:var(--red-dark)">Khẩn cấp</b>',QUAN_TRONG:'<b style="color:var(--amber)">Quan trọng</b>',CAN_THIET:'<b style="color:var(--slate-600)">Cần thiết</b>'}[m] || m; }
  function suVuStatusLabel(s){ return {MOI_TAO:'Mới tạo',DA_TIEP_NHAN:'Đã tiếp nhận',DANG_XU_LY:'Đang xử lý',DA_PHAN_HOI:'Đã phản hồi',HOAN_TAT:'Hoàn tất',HUY:'Hủy'}[s]||s; }
  function actionLabel(a){ return {CREATE:'Tạo sự vụ',ACK_RECEIVE:'Tiếp nhận',START:'Bắt đầu xử lý',RESPOND:'Gửi phản hồi',CONFIRM:'Xác nhận',CLOSE:'Đóng sự vụ',REOPEN:'Mở lại',EDIT:'Chỉnh sửa',CANCEL:'Hủy',ASSIGN:'Phân công'}[a]||a; }
  function actionColor(a){ return {CREATE:'var(--red-dark)',ACK_RECEIVE:'var(--amber)',START:'var(--bg-navy)',RESPOND:'var(--teal)',CLOSE:'var(--emerald-soft)',CANCEL:'var(--slate-400)'}[a]||'var(--slate-400)'; }
  
  // Expose for debugging
  window.BG = BG;
  
})();
