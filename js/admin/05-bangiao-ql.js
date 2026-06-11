/* ═══════════════════════════════════════════════════════════════════════════
 *  NÓN SƠN — BÀN GIAO CA v1.0 — QL/ADMIN VIEW
 *  Dashboard sự vụ: tiếp nhận / xử lý / phản hồi
 *  Tự bỏ qua nếu user không phải ADMIN/QLBH/QLNS.
 * ═══════════════════════════════════════════════════════════════════════════ */

(function(){
  const BGQL = {
    filter: { trang_thai: null, muc_do: null, ma_ch: null, tu_ngay: null, den_ngay: null },
    list: []
  };

  window.moPageBanGiaoQL = async function(){
    const role = ((SESSION && SESSION.vaiTro) || '').toUpperCase();
    if (!['ADMIN','QLNS','QLBH'].includes(role)) {
      alert('Trang này chỉ dành cho quản lý.'); return;
    }
    showPage('bangiao-ql');
    await renderQLPage();
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

  async function renderQLPage(){
    const page = document.getElementById('page-bangiao-ql');
    page.innerHTML = `
      <div class="bg-hero">
        <button onclick="goToPage('chamcong')" style="background:transparent;border:0;color:#fff;font-size:22px;cursor:pointer;padding:0;margin-bottom:8px">‹</button>
        <h2>Bàn giao ca — Quản lý</h2>
        <div class="subtitle">Dashboard sự vụ toàn hệ thống</div>
      </div>
      
      <!-- Stats card -->
      <div class="bg-card">
        <div class="bg-card-body" id="bg-ql-stats">
          <div style="text-align:center;color:var(--slate-400);font:500 13px">Đang tải...</div>
        </div>
      </div>
      
      <!-- Filter -->
      <div class="bg-card">
        <div class="bg-card-body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <select onchange="bgqlSetFilter('trang_thai', this.value)" style="padding:8px 10px;border:1px solid var(--slate-200);border-radius:8px;font:500 13px 'Be Vietnam Pro';background:#fff">
              <option value="">Tất cả trạng thái</option>
              <option value="MOI_TAO">Mới tạo</option>
              <option value="DA_TIEP_NHAN">Đã tiếp nhận</option>
              <option value="DANG_XU_LY">Đang xử lý</option>
              <option value="DA_PHAN_HOI">Đã phản hồi</option>
              <option value="HOAN_TAT">Hoàn tất</option>
            </select>
            <select onchange="bgqlSetFilter('muc_do', this.value)" style="padding:8px 10px;border:1px solid var(--slate-200);border-radius:8px;font:500 13px 'Be Vietnam Pro';background:#fff">
              <option value="">Tất cả mức độ</option>
              <option value="KHAN_CAP">Khẩn cấp</option>
              <option value="QUAN_TRONG">Quan trọng</option>
              <option value="CAN_THIET">Cần thiết</option>
            </select>
            <input type="date" onchange="bgqlSetFilter('tu_ngay', this.value)" placeholder="Từ" style="padding:8px 10px;border:1px solid var(--slate-200);border-radius:8px">
            <input type="date" onchange="bgqlSetFilter('den_ngay', this.value)" placeholder="Đến" style="padding:8px 10px;border:1px solid var(--slate-200);border-radius:8px">
          </div>
          <button onclick="bgqlReload()" style="width:100%;margin-top:10px;padding:10px;border:0;background:var(--bg-navy);color:#fff;border-radius:8px;font:600 13px 'Be Vietnam Pro';cursor:pointer">Lọc</button>
        </div>
      </div>
      
      <div id="bg-ql-list"></div>
      <div style="height:40px"></div>
    `;
    await loadStats();
    await loadList();
  }

  async function loadStats(){
    const { data, error } = await supa.rpc('fn_su_vu_dashboard_today');
    const el = document.getElementById('bg-ql-stats');
    if (error || !data) { el.innerHTML = '<div style="color:var(--red-dark)">Lỗi tải thống kê</div>'; return; }
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center">
        <div><div style="font:700 22px 'Fraunces',serif;color:var(--red-dark)">${data.khan_cap_dang_mo||0}</div><div style="font:500 11px;color:var(--slate-600)">Khẩn cấp mở</div></div>
        <div><div style="font:700 22px 'Fraunces',serif;color:var(--amber)">${data.moi_tao||0}</div><div style="font:500 11px;color:var(--slate-600)">Mới tạo</div></div>
        <div><div style="font:700 22px 'Fraunces',serif;color:var(--bg-navy)">${data.dang_xu_ly||0}</div><div style="font:500 11px;color:var(--slate-600)">Đang xử lý</div></div>
        <div><div style="font:700 22px 'Fraunces',serif;color:var(--teal)">${data.da_phan_hoi||0}</div><div style="font:500 11px;color:var(--slate-600)">Đã phản hồi</div></div>
        <div><div style="font:700 22px 'Fraunces',serif;color:var(--slate-600)">${data.da_tiep_nhan||0}</div><div style="font:500 11px;color:var(--slate-600)">Đã tiếp nhận</div></div>
        <div><div style="font:700 22px 'Fraunces',serif;color:var(--emerald-soft)">${data.hoan_tat_hom_nay||0}</div><div style="font:500 11px;color:var(--slate-600)">Hoàn tất hôm nay</div></div>
      </div>
    `;
  }

  window.bgqlSetFilter = function(k, v){ BGQL.filter[k] = v || null; };
  window.bgqlReload = async function(){ await loadStats(); await loadList(); };

  async function loadList(){
    const container = document.getElementById('bg-ql-list');
    container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--slate-400)">Đang tải...</div>';
    const { data, error } = await supa.rpc('fn_su_vu_list', {
      p_ma_ch: BGQL.filter.ma_ch,
      p_trang_thai: BGQL.filter.trang_thai,
      p_muc_do: BGQL.filter.muc_do,
      p_nguoi_phu_trach: null,
      p_tu_ngay: BGQL.filter.tu_ngay,
      p_den_ngay: BGQL.filter.den_ngay,
      p_limit: 100, p_offset: 0
    });
    if (error) { container.innerHTML = '<div style="padding:20px;color:var(--red-dark)">'+error.message+'</div>'; return; }
    if (!data || data.length === 0) {
      container.innerHTML = '<div style="padding:40px 20px;text-align:center;color:var(--slate-400)">Không có sự vụ phù hợp.</div>'; return;
    }
    BGQL.list = data;
    container.innerHTML = data.map(s=>`
      <div class="sv-card ${s.muc_do==='KHAN_CAP'?'khan':s.muc_do==='QUAN_TRONG'?'quan':'can'}" onclick="bgqlOpenSuVu('${s.id}')">
        <div class="top">
          <div class="title">${escHtml(s.tieu_de)}</div>
          <span class="status ${s.trang_thai}">${suVuStatusLabel(s.trang_thai)}</span>
        </div>
        <div class="meta"><b>${escHtml(s.ten_ch_snapshot||s.ma_ch)}</b> · ${mucDoLabel(s.muc_do)} · ${formatDateTime(s.created_at)}</div>
        <div class="meta">Tạo bởi: <b>${escHtml(s.nguoi_tao_ten||'?')}</b>${s.nguoi_phu_trach_ten?` · Phụ trách: <b>${escHtml(s.nguoi_phu_trach_ten)}</b>`:''}</div>
        ${s.mo_ta?`<div class="meta" style="font-style:italic">"${escHtml(s.mo_ta).slice(0,140)}"</div>`:''}
        <div class="seen">${s.so_nguoi_xem||0} người đã xem</div>
      </div>
    `).join('');
  }

  // ─── Sự vụ chi tiết — QL view với action buttons ──────────────────────
  window.bgqlOpenSuVu = async function(id){
    // Log view của QL
    try {
      await supa.rpc('fn_su_vu_log_view', {
        p_su_vu_id: id,
        p_ma_nv: SESSION.maNV,
        p_ten_nv: SESSION.hoTen||SESSION.tenNV,
        p_ma_ch: SESSION.maCH||SESSION.cuaHangMa||'__QL__',
        p_vai_tro: SESSION.vaiTro||'QL'
      });
    } catch(e){}
    
    const { data, error } = await supa.rpc('fn_su_vu_get', { p_id: id });
    if (error || !data) { alert('Không tải được'); return; }
    showQLSuVuDetail(data);
  };

  function showQLSuVuDetail(data){
    const s = data.su_vu || {};
    const audit = data.audit || [];
    const nguoiXem = data.nguoi_xem || [];
    const role = (SESSION.vaiTro||'').toUpperCase();
    
    // Action button theo trạng thái
    let actionsHtml = '';
    if (s.trang_thai === 'MOI_TAO') {
      actionsHtml = `<button class="sv-action-btn primary" style="flex:1" onclick="bgqlTiepNhan('${s.id}')">Tiếp nhận</button>`;
    } else if (s.trang_thai === 'DA_TIEP_NHAN') {
      actionsHtml = `<button class="sv-action-btn primary" style="flex:1" onclick="bgqlBatDauXuLy('${s.id}')">Bắt đầu xử lý</button>`;
    } else if (s.trang_thai === 'DANG_XU_LY' || s.trang_thai === 'DA_TIEP_NHAN') {
      actionsHtml += `<button class="sv-action-btn primary" style="flex:1" onclick="bgqlMoPhanHoi('${s.id}')">Gửi phản hồi</button>`;
    }
    if (role === 'ADMIN' && s.trang_thai !== 'HOAN_TAT' && s.trang_thai !== 'HUY') {
      actionsHtml += `<button class="sv-action-btn ghost" onclick="bgqlHuy('${s.id}')">Hủy sự vụ</button>`;
    }
    
    const ov = document.createElement('div');
    ov.className = 'sv-detail';
    ov.innerHTML = `
      <div class="head">
        <button class="back" onclick="this.closest('.sv-detail').remove()">‹</button>
        <div class="title">Sự vụ</div>
        <span style="padding:4px 10px;border-radius:99px;background:rgba(255,255,255,.16);font:700 11px;color:#fff">${suVuStatusLabel(s.trang_thai)}</span>
      </div>
      
      <div class="bg-card" style="border-left:4px solid ${s.muc_do==='KHAN_CAP'?'var(--red-dark)':s.muc_do==='QUAN_TRONG'?'var(--amber)':'var(--slate-400)'}">
        <div class="bg-card-body">
          <div style="font:600 16px 'Be Vietnam Pro';color:var(--slate-800);margin-bottom:6px">${escHtml(s.tieu_de||'')}</div>
          <div style="font:500 12px;color:var(--slate-600);margin-bottom:6px">${mucDoLabel(s.muc_do)} · ${escHtml(s.ten_ch_snapshot||s.ma_ch||'')}</div>
          <div style="font:500 12px;color:var(--slate-600);margin-bottom:8px">Người tạo: <b>${escHtml(s.nguoi_tao_ten||'?')}</b> · ${formatDateTime(s.created_at)}</div>
          ${s.mo_ta?`<div style="font:500 13px;color:var(--slate-800);background:var(--slate-50);padding:10px;border-radius:8px;margin-top:8px;white-space:pre-wrap">${escHtml(s.mo_ta)}</div>`:''}
        </div>
      </div>
      
      <div class="seen-bar">
        <div class="progress"><div class="fill" id="sv-seen-fill" style="width:0%"></div></div>
        <div class="text" id="sv-seen-text">--/--</div>
        <button onclick="bgqlShowSeenList('${s.id}')" style="background:transparent;border:0;color:var(--bg-navy);font:600 12px;cursor:pointer">Chi tiết</button>
      </div>
      
      ${s.phan_hoi_xu_ly ? `
      <div class="bg-card" style="border-left:3px solid var(--teal)">
        <div class="bg-card-header"><h3 style="color:var(--teal)">Phản hồi xử lý</h3></div>
        <div class="bg-card-body">
          <div style="white-space:pre-wrap;font:500 13px;color:var(--slate-800)">${escHtml(s.phan_hoi_xu_ly)}</div>
          <div style="font:400 11px;color:var(--slate-400);margin-top:8px">${formatDateTime(s.thoi_gian_phan_hoi)}</div>
        </div>
      </div>` : ''}
      
      <div class="sv-timeline">
        <div style="font:600 13px 'Be Vietnam Pro';color:var(--slate-800);margin-bottom:8px">Diễn biến</div>
        ${audit.length===0 ? '<div style="color:var(--slate-400);font:500 12px">Chưa có hoạt động</div>' :
          audit.map(a=>`
            <div class="item">
              <div class="dot" style="background:${actionColor(a.action)}"></div>
              <div class="body">
                <div class="who">${escHtml(a.ten_nv||a.ma_nv||'?')} <span style="color:var(--slate-400);font-weight:400">(${escHtml(a.vai_tro||'')})</span></div>
                <div class="what">${actionLabel(a.action)}${a.noi_dung&&a.noi_dung.phan_hoi?': '+escHtml(String(a.noi_dung.phan_hoi)).slice(0,80):''}</div>
                <div class="when">${formatDateTime(a.created_at)}</div>
              </div>
            </div>
          `).join('')}
      </div>
      
      ${actionsHtml ? `<div class="sv-actions">${actionsHtml}</div>` : ''}
      
      <div style="height:40px"></div>
    `;
    document.body.appendChild(ov);
    loadPercentSeen(s.id);
  }

  async function loadPercentSeen(id){
    try {
      const { data } = await supa.rpc('fn_su_vu_percent_seen', { p_su_vu_id: id });
      if (data && !data.error) {
        const t = document.getElementById('sv-seen-text');
        const f = document.getElementById('sv-seen-fill');
        if (t) t.textContent = `${data.da_xem}/${data.tong_nv} (${data.phan_tram}%)`;
        if (f) f.style.width = data.phan_tram + '%';
        window._bgqlSeenData = data;
      }
    } catch(e){}
  }

  window.bgqlShowSeenList = function(id){
    const d = window._bgqlSeenData;
    if (!d) return;
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,46,69,.85);z-index:9700;display:flex;align-items:flex-end;justify-content:center';
    ov.innerHTML = `
      <div style="background:#fff;width:100%;max-width:520px;border-radius:20px 20px 0 0;padding:20px 16px;max-height:80vh;overflow-y:auto;padding-bottom:max(20px,env(safe-area-inset-bottom))">
        <h3 style="margin:0 0 8px;font:700 16px 'Be Vietnam Pro'">Chi tiết người xem</h3>
        <div style="font:500 13px;color:var(--slate-600);margin-bottom:12px">${d.da_xem}/${d.tong_nv} đã xem · ${d.phan_tram}%</div>
        ${(d.da_xem_list||[]).length>0 ? `
          <div style="font:600 12px;color:var(--emerald-soft);margin:12px 0 4px">Đã xem (${d.da_xem_list.length}):</div>
          ${d.da_xem_list.map(n=>`<div style="padding:6px 0;font:500 13px">${escHtml(n.ten_nv||n.ma_nv)} <span style="color:var(--slate-400);font-size:11px">${formatDateTime(n.xem_lan_dau)}</span></div>`).join('')}` : ''}
        ${(d.chua_xem_list||[]).length>0 ? `
          <div style="font:600 12px;color:var(--red-dark);margin:12px 0 4px">Chưa xem (${d.chua_xem_list.length}):</div>
          ${d.chua_xem_list.map(n=>`<div style="padding:6px 0;font:500 13px">${escHtml(n.ten_nv||n.ma_nv)}</div>`).join('')}` : ''}
        <button onclick="this.closest('div[style*=fixed]').remove()" style="width:100%;margin-top:14px;padding:12px;border:0;background:var(--slate-100);color:var(--slate-600);border-radius:10px;font:600 13px">Đóng</button>
      </div>
    `;
    document.body.appendChild(ov);
  };

  window.bgqlTiepNhan = async function(id){
    if (!confirm('Tiếp nhận sự vụ này về phụ trách?')) return;
    const { error } = await supa.rpc('fn_su_vu_tiep_nhan', {
      p_id: id, p_ma_nv: SESSION.maNV, p_ten_nv: SESSION.hoTen||SESSION.tenNV, p_vai_tro: SESSION.vaiTro
    });
    if (error) { alert('Lỗi: '+error.message); return; }
    document.querySelector('.sv-detail').remove();
    await loadList();
  };

  window.bgqlBatDauXuLy = async function(id){
    const { error } = await supa.rpc('fn_su_vu_bat_dau_xu_ly', {
      p_id: id, p_ma_nv: SESSION.maNV, p_ten_nv: SESSION.hoTen||SESSION.tenNV, p_vai_tro: SESSION.vaiTro
    });
    if (error) { alert('Lỗi: '+error.message); return; }
    document.querySelector('.sv-detail').remove();
    bgqlOpenSuVu(id);
  };

  window.bgqlMoPhanHoi = function(id){
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,46,69,.85);z-index:9700;display:flex;align-items:flex-end;justify-content:center';
    ov.innerHTML = `
      <div style="background:#fff;width:100%;max-width:520px;border-radius:20px 20px 0 0;padding:20px 16px;padding-bottom:max(20px,env(safe-area-inset-bottom))">
        <h3 style="margin:0 0 12px;font:700 16px 'Be Vietnam Pro'">Gửi phản hồi xử lý</h3>
        <textarea id="bgql-phan-hoi-input" rows="5" style="width:100%;padding:12px;border:1px solid var(--slate-200);border-radius:10px;font:500 13px 'Be Vietnam Pro';resize:vertical" placeholder="Mô tả cách xử lý / hành động đã thực hiện..."></textarea>
        <div style="display:flex;gap:10px;margin-top:12px">
          <button onclick="this.closest('div[style*=fixed]').remove()" style="flex:1;padding:12px;border:0;background:var(--slate-100);color:var(--slate-600);border-radius:10px;font:600 13px">Hủy</button>
          <button onclick="bgqlGuiPhanHoi('${id}')" style="flex:1;padding:12px;border:0;background:var(--bg-navy);color:#fff;border-radius:10px;font:600 13px">Gửi phản hồi</button>
        </div>
      </div>
    `;
    document.body.appendChild(ov);
    setTimeout(()=>document.getElementById('bgql-phan-hoi-input').focus(), 100);
  };

  window.bgqlGuiPhanHoi = async function(id){
    const input = document.getElementById('bgql-phan-hoi-input');
    const val = input.value.trim();
    if (!val) { alert('Nhập nội dung phản hồi'); return; }
    const { error } = await supa.rpc('fn_su_vu_phan_hoi', {
      p_id: id, p_ma_nv: SESSION.maNV, p_ten_nv: SESSION.hoTen||SESSION.tenNV,
      p_vai_tro: SESSION.vaiTro, p_noi_dung: val, p_anh_urls: []
    });
    if (error) { alert('Lỗi: '+error.message); return; }
    document.querySelectorAll('div[style*=fixed], .sv-detail').forEach(el=>el.remove());
    alert('✓ Đã gửi phản hồi. CH sẽ nhận thông báo.');
    await loadList();
  };

  window.bgqlHuy = async function(id){
    const ly_do = prompt('Lý do hủy sự vụ:');
    if (!ly_do) return;
    const { error } = await supa.rpc('fn_su_vu_huy', {
      p_id: id, p_ma_nv: SESSION.maNV, p_ten_nv: SESSION.hoTen||SESSION.tenNV,
      p_vai_tro: SESSION.vaiTro, p_ly_do: ly_do
    });
    if (error) { alert('Lỗi: '+error.message); return; }
    document.querySelector('.sv-detail').remove();
    await loadList();
  };

  // ─── Utility ──────────────────────────────────────────────────────────
  function escHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function formatDate(d){ if(!d) return ''; const dt = new Date(d); return dt.getDate().toString().padStart(2,'0')+'/'+(dt.getMonth()+1).toString().padStart(2,'0')+'/'+dt.getFullYear(); }
  function formatDateTime(d){ if(!d) return ''; const dt = new Date(d); return formatDate(d)+' '+dt.getHours().toString().padStart(2,'0')+':'+dt.getMinutes().toString().padStart(2,'0'); }
  function mucDoLabel(m){ return {KHAN_CAP:'<b style="color:var(--red-dark)">Khẩn cấp</b>',QUAN_TRONG:'<b style="color:var(--amber)">Quan trọng</b>',CAN_THIET:'<b style="color:var(--slate-600)">Cần thiết</b>'}[m] || m; }
  function suVuStatusLabel(s){ return {MOI_TAO:'Mới tạo',DA_TIEP_NHAN:'Đã tiếp nhận',DANG_XU_LY:'Đang xử lý',DA_PHAN_HOI:'Đã phản hồi',HOAN_TAT:'Hoàn tất',HUY:'Hủy'}[s]||s; }
  function actionLabel(a){ return {CREATE:'Tạo sự vụ',ACK_RECEIVE:'Tiếp nhận',START:'Bắt đầu xử lý',RESPOND:'Gửi phản hồi',CONFIRM:'Xác nhận',CLOSE:'Đóng sự vụ',REOPEN:'Mở lại',EDIT:'Chỉnh sửa',CANCEL:'Hủy'}[a]||a; }
  function actionColor(a){ return {CREATE:'var(--red-dark)',ACK_RECEIVE:'var(--amber)',START:'var(--bg-navy)',RESPOND:'var(--teal)',CLOSE:'var(--emerald-soft)',CANCEL:'var(--slate-400)'}[a]||'var(--slate-400)'; }
  
  window.BGQL = BGQL;
})();
