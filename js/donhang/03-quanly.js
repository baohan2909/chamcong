/* ════════════════════════════════════════════════════════════════════════
 *  PHÂN HỆ ĐƠN HÀNG ONLINE — TRANG QUẢN LÝ  [v13.46]
 *  3 tab: Theo dõi (list đơn realtime) · Báo cáo (thống kê) · Cài đặt (công tắc).
 * ════════════════════════════════════════════════════════════════════════ */

let dhQLTab        = 'theodoi';
let dhQLPollTimer  = null;
let dhQLFilter     = '';

const DH_TT = {
  MOI_TAO:        { t:'Mới tạo',        c:'slate'   },
  DANG_DIEU_PHOI: { t:'Đang điều phối', c:'navy'    },
  CHO_CH_NHAN:    { t:'Chờ CH nhận',    c:'amber'   },
  CH_DA_NHAN:     { t:'CH đã nhận',     c:'teal'    },
  DANG_DONG_GOI:  { t:'Đang đóng gói',  c:'navy'    },
  DA_BOOK_SHIP:   { t:'Đã book ship',   c:'cyan'    },
  DANG_GIAO:      { t:'Đang giao',      c:'cyan'    },
  HOAN_TAT:       { t:'Hoàn tất',       c:'emerald' },
  HUY:            { t:'Hủy',            c:'red'     }
};
function _dhTTBadge(tt){
  const m = DH_TT[tt] || { t: tt, c:'slate' };
  return `<span class="dh-tt dh-tt-${m.c}">${m.t}</span>`;
}
function _dhVND(x){ return Number(x||0).toLocaleString('vi-VN'); }

// ─── Init ───────────────────────────────────────────────────────────────
window.dhQLInit = function(){
  if (!_dhCanAccess()) {
    showToast && showToast('Phân hệ đang chạy thử — chỉ tài khoản NS00490', 'warn');
    goToPage('home'); return;
  }
  dhQLSwitchTab('theodoi');
};
window.dhQLLeave = function(){
  if (dhQLPollTimer) { clearInterval(dhQLPollTimer); dhQLPollTimer = null; }
};

window.dhQLSwitchTab = function(tab){
  dhQLTab = tab;
  if (dhQLPollTimer) { clearInterval(dhQLPollTimer); dhQLPollTimer = null; }
  document.querySelectorAll('.dh-ql-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tab));
  const body = document.getElementById('dh-ql-body');
  if (tab === 'theodoi') {
    dhQLRenderTheoDoiShell();
    dhQLLoadDon();
    dhQLPollTimer = setInterval(dhQLLoadDon, 5000);
  } else if (tab === 'baocao') {
    dhQLLoadThongKe();
  } else if (tab === 'caidat') {
    dhQLLoadSettings();
  }
};

// ─── TAB THEO DÕI ───────────────────────────────────────────────────────
function dhQLRenderTheoDoiShell(){
  const filters = [
    ['',              'Tất cả'],
    ['CHO_CH_NHAN',   'Chờ CH'],
    ['CH_DA_NHAN',    'CH nhận'],
    ['DANG_GIAO',     'Đang giao'],
    ['HOAN_TAT',      'Hoàn tất']
  ];
  document.getElementById('dh-ql-body').innerHTML = `
    <div class="dh-ql-chips">
      ${filters.map(f => `<button class="dh-ql-chip ${dhQLFilter===f[0]?'active':''}" onclick="dhQLSetFilter('${f[0]}')">${f[1]}</button>`).join('')}
    </div>
    <div id="dh-ql-don-list"><div class="dh-ql-loading">Đang tải...</div></div>`;
}
window.dhQLSetFilter = function(f){
  dhQLFilter = f;
  document.querySelectorAll('.dh-ql-chip').forEach(c =>
    c.classList.toggle('active', c.getAttribute('onclick').includes("'"+f+"'")));
  dhQLLoadDon();
};
async function dhQLLoadDon(){
  try {
    const { data, error } = await supa.rpc('dh_fn_list_don', { p_trang_thai: dhQLFilter || null, p_limit: 60 });
    if (error) throw error;
    const list = Array.isArray(data) ? data : [];
    const box = document.getElementById('dh-ql-don-list');
    if (!box) return;
    if (!list.length) { box.innerHTML = '<div class="dh-ql-empty">Chưa có đơn nào.</div>'; return; }
    box.innerHTML = list.map(d => `
      <div class="dh-ql-don" onclick='dhQLDetail(${d.id})'>
        <div class="dh-ql-don-top">
          <span class="dh-ql-madon">${escHtml(d.ma_don||'')}</span>
          ${_dhTTBadge(d.trang_thai)}
        </div>
        <div class="dh-ql-don-sp">${escHtml(d.sp_ten||'')}${d.sp_size?(' · '+escHtml(d.sp_size)):''} · SL ${d.so_luong||1}</div>
        <div class="dh-ql-don-bot">
          <span>${escHtml(d.ch_nhan_ten || 'chưa có CH')}</span>
          <span class="dh-ql-don-gt">${_dhVND(d.gia_tri)}đ</span>
        </div>
      </div>`).join('');
  } catch(e){
    const box = document.getElementById('dh-ql-don-list');
    if (box) box.innerHTML = '<div class="dh-ql-empty" style="color:#E0827D">Lỗi tải: '+escHtml(e.message||'')+'</div>';
  }
}

window.dhQLDetail = async function(donId){
  try {
    const { data, error } = await supa.rpc('dh_fn_don_chi_tiet', { p_don_id: donId });
    if (error) throw error;
    if (!data || !data.ok) return;
    const d = data.don, dp = data.dieu_phoi || [];
    const hh = data.hoa_hong, tt = data.thanh_toan;
    window._dhQLCurDon = d;
    const ov = document.getElementById('dh-ql-detail');
    document.getElementById('dh-ql-detail-body').innerHTML = `
      <div class="dh-det-madon">${escHtml(d.ma_don||'')} ${_dhTTBadge(d.trang_thai)}</div>
      <div class="dh-det-sec">Khách hàng</div>
      <div class="dh-det-row"><span>Tên</span><b>${escHtml(d.khach_ten||'--')}</b></div>
      <div class="dh-det-row"><span>SĐT</span><b>${escHtml(d.khach_sdt||'--')}</b></div>
      <div class="dh-det-row"><span>Địa chỉ</span><b>${escHtml(d.dia_chi_full||'--')}</b></div>
      <div class="dh-det-sec">Sản phẩm</div>
      <div class="dh-det-row"><span>Mặt hàng</span><b>${escHtml(d.sp_ten||'--')}${d.sp_size?(' · '+escHtml(d.sp_size)):''}</b></div>
      <div class="dh-det-row"><span>Số lượng</span><b>${d.so_luong||1}</b></div>
      <div class="dh-det-row"><span>Giá trị</span><b>${_dhVND(d.gia_tri)}đ</b></div>
      <div class="dh-det-row"><span>Thanh toán</span><b>${d.phuong_thuc_tt==='CK_TRUOC'?'CK trước':'COD'}${d.tt_trang_thai==='DA_TT'?' · đã TT':''}</b></div>
      <div class="dh-det-sec">Hai bên (hoa hồng)</div>
      <div class="dh-det-row"><span>Người tư vấn</span><b>${escHtml(d.tu_van_ten||d.tu_van_ma||'--')}</b></div>
      <div class="dh-det-row"><span>Cửa hàng bán</span><b>${escHtml(d.ch_nhan_ten||'chưa có')}</b></div>
      <div class="dh-det-row"><span>Số đơn POS</span><b>${escHtml(d.so_don_pos||'chưa khớp')}</b></div>
      <div class="dh-det-sec">Điều phối (${dp.length} cửa hàng)</div>
      ${dp.map(x => `
        <div class="dh-det-dp">
          <span class="dh-det-dp-ch">${escHtml(x.ten_ch||x.ma_ch)}</span>
          <span class="dh-det-dp-km">${x.khoang_cach_km!=null?Number(x.khoang_cach_km).toFixed(1)+'km':''}</span>
          <span class="dh-det-dp-tt dh-dp-${(x.trang_thai||'').toLowerCase()}">${
            x.trang_thai==='NHAN'?'đã nhận':x.trang_thai==='TU_CHOI'?('từ chối: '+escHtml(x.ly_do_tu_choi||'')):x.trang_thai==='HET_GIO'?'hết giờ':'đang chờ'
          }</span>
        </div>`).join('') || '<div class="dh-det-empty">Chưa điều phối</div>'}
      ${hh ? `
        <div class="dh-det-sec">Hoa hồng đã chia</div>
        <div class="dh-det-hh">
          <div class="dh-det-hh-row"><span>${escHtml(hh.tu_van_ten||'Tư vấn')} · ${hh.pct_tu_van}%</span><b>${_dhVND(hh.tien_tu_van)}đ</b></div>
          <div class="dh-det-hh-row"><span>${escHtml(hh.ch_ten||'Cửa hàng')} · ${hh.pct_ban}%</span><b>${_dhVND(hh.tien_ban)}đ</b></div>
        </div>` : ''}
      ${(function(){
        let h = '';
        if (d.phuong_thuc_tt === 'CK_TRUOC') {
          if (d.tt_trang_thai === 'DA_TT') h += '<div class="dh-det-paid">✓ Đã thanh toán chuyển khoản</div>';
          else h += '<button class="dh-det-btn dh-det-btn-qr" onclick="dhQLShowQR('+d.id+')">Hiện QR thanh toán</button>';
        }
        const nx = {CH_DA_NHAN:['DANG_DONG_GOI','Đã đóng gói'],DANG_DONG_GOI:['DA_BOOK_SHIP','Đã book ship'],DA_BOOK_SHIP:['DANG_GIAO','Đang giao'],DANG_GIAO:['HOAN_TAT','Hoàn tất đơn']}[d.trang_thai];
        if (nx) {
          const cls = nx[0]==='HOAN_TAT' ? 'dh-det-btn-done' : 'dh-det-btn-next';
          h += '<button class="dh-det-btn '+cls+'" onclick="dhQLChuyenTT('+d.id+',\''+nx[0]+'\')">'+nx[1]+'</button>';
        }
        return h ? ('<div class="dh-det-actions">'+h+'</div>') : '';
      })()}`;
    ov.style.display = 'flex';
  } catch(e){
    showToast && showToast('Lỗi: '+(e.message||e), 'error');
  }
};
window.dhQLCloseDetail = function(){
  const ov = document.getElementById('dh-ql-detail');
  if (ov) ov.style.display = 'none';
};

// ─── TAB BÁO CÁO ────────────────────────────────────────────────────────
async function dhQLLoadThongKe(){
  document.getElementById('dh-ql-body').innerHTML = '<div class="dh-ql-loading">Đang tính thống kê...</div>';
  try {
    const { data, error } = await supa.rpc('dh_fn_thong_ke');
    if (error) throw error;
    const s = data || {};
    const tyLeNhan = s.so_gui ? Math.round((s.so_nhan/s.so_gui)*100) : 0;
    const tyLeTuChoi = s.so_gui ? Math.round((s.so_tu_choi/s.so_gui)*100) : 0;
    document.getElementById('dh-ql-body').innerHTML = `
      <div class="dh-bc-grid">
        <div class="dh-bc-card"><div class="dh-bc-num">${s.tong_don||0}</div><div class="dh-bc-lbl">Tổng đơn</div></div>
        <div class="dh-bc-card"><div class="dh-bc-num" style="color:#CBA45A">${s.dang_xu_ly||0}</div><div class="dh-bc-lbl">Đang xử lý</div></div>
        <div class="dh-bc-card"><div class="dh-bc-num" style="color:#34D399">${s.hoan_tat||0}</div><div class="dh-bc-lbl">Hoàn tất</div></div>
        <div class="dh-bc-card"><div class="dh-bc-num" style="color:#E0827D">${s.huy||0}</div><div class="dh-bc-lbl">Hủy</div></div>
      </div>
      <div class="dh-bc-row2">
        <div class="dh-bc-stat"><div class="dh-bc-stat-num" style="color:#34D399">${tyLeNhan}%</div><div class="dh-bc-stat-lbl">Tỷ lệ nhận đơn</div></div>
        <div class="dh-bc-stat"><div class="dh-bc-stat-num" style="color:#E0827D">${tyLeTuChoi}%</div><div class="dh-bc-stat-lbl">Tỷ lệ từ chối</div></div>
      </div>
      <div class="dh-bc-money">
        <div class="dh-bc-money-lbl">Tổng giá trị đơn hoàn tất</div>
        <div class="dh-bc-money-num">${_dhVND(s.tong_gia_tri)}đ</div>
      </div>
      <div class="dh-bc-sec">Top cửa hàng nhận nhiều đơn</div>
      ${(s.top_ch||[]).length ? (s.top_ch||[]).map(c => `
        <div class="dh-bc-item"><span>${escHtml(c.ten||'--')}</span><b>${c.so_don} đơn</b></div>`).join('')
        : '<div class="dh-det-empty">Chưa có dữ liệu</div>'}
      <div class="dh-bc-sec">Top người tư vấn</div>
      ${(s.top_tu_van||[]).length ? (s.top_tu_van||[]).map(c => `
        <div class="dh-bc-item"><span>${escHtml(c.ten||'--')}</span><b>${c.so_don} đơn</b></div>`).join('')
        : '<div class="dh-det-empty">Chưa có dữ liệu</div>'}
      <div class="dh-bc-sec">Lý do từ chối</div>
      ${(s.ly_do_tu_choi||[]).length ? (s.ly_do_tu_choi||[]).map(c => `
        <div class="dh-bc-item"><span>${escHtml(c.ly_do||'--')}</span><b>${c.c} lần</b></div>`).join('')
        : '<div class="dh-det-empty">Chưa có từ chối nào</div>'}`;
  } catch(e){
    document.getElementById('dh-ql-body').innerHTML = '<div class="dh-ql-empty" style="color:#E0827D">Lỗi: '+escHtml(e.message||'')+'</div>';
  }
}

// ─── TAB CÀI ĐẶT (công tắc + tham số) ───────────────────────────────────
async function dhQLLoadSettings(){
  document.getElementById('dh-ql-body').innerHTML = '<div class="dh-ql-loading">Đang tải cấu hình...</div>';
  let s = {};
  try {
    const { data } = await supa.rpc('dh_fn_get_settings');
    s = data || {};
  } catch(e){}
  const g = (k, d) => (s[k] !== undefined && s[k] !== null) ? s[k] : d;
  const cheDo = g('donhang.che_do','demo');
  const ahaEnv = g('donhang.ahamove_env','sandbox');

  document.getElementById('dh-ql-body').innerHTML = `
    <div class="dh-cd-warn">Đổi sang LIVE là bật phân hệ cho nhân viên + cửa hàng dùng thật. Hãy chắc chắn đã test xong.</div>

    <div class="dh-cd-sec">Công tắc chính</div>
    <div class="dh-cd-toggle">
      <div><div class="dh-cd-tg-ttl">Chế độ phân hệ</div><div class="dh-cd-tg-sub">demo = chỉ ADMIN · live = mọi người</div></div>
      <div class="dh-seg">
        <button class="dh-seg-btn ${cheDo==='demo'?'active':''}" onclick="dhQLSetSeg('che_do','demo',this)">DEMO</button>
        <button class="dh-seg-btn dh-seg-live ${cheDo==='live'?'active':''}" onclick="dhQLSetSeg('che_do','live',this)">LIVE</button>
      </div>
    </div>
    <div class="dh-cd-toggle">
      <div><div class="dh-cd-tg-ttl">Môi trường Ahamove</div><div class="dh-cd-tg-sub">sandbox = test · production = giao thật</div></div>
      <div class="dh-seg">
        <button class="dh-seg-btn ${ahaEnv==='sandbox'?'active':''}" onclick="dhQLSetSeg('ahamove_env','sandbox',this)">SANDBOX</button>
        <button class="dh-seg-btn dh-seg-live ${ahaEnv==='production'?'active':''}" onclick="dhQLSetSeg('ahamove_env','production',this)">THẬT</button>
      </div>
    </div>

    <div class="dh-cd-sec">Tham số điều phối</div>
    <div class="dh-cd-fld"><label>Bán kính đợt sóng (+km)</label><input class="dh-cd-inp" id="cd-ban_kinh_km" type="number" step="0.5" value="${g('donhang.ban_kinh_km',2)}"></div>
    <div class="dh-cd-fld"><label>Thời gian CH nhận (giây)</label><input class="dh-cd-inp" id="cd-timeout_giay" type="number" value="${g('donhang.timeout_giay',180)}"></div>
    <div class="dh-cd-fld"><label>Cảnh báo chưa lên POS (phút)</label><input class="dh-cd-inp" id="cd-canhbao_phut" type="number" value="${g('donhang.canhbao_phut',30)}"></div>

    <div class="dh-cd-sec">Hoa hồng (%)</div>
    <div class="dh-cd-row2">
      <div class="dh-cd-fld"><label>Người tư vấn</label><input class="dh-cd-inp" id="cd-pct_tu_van" type="number" value="${g('donhang.pct_tu_van',50)}"></div>
      <div class="dh-cd-fld"><label>Cửa hàng bán</label><input class="dh-cd-inp" id="cd-pct_ban" type="number" value="${g('donhang.pct_ban',50)}"></div>
    </div>

    <div class="dh-cd-sec">Tài khoản nhận tiền (VietQR)</div>
    <div class="dh-cd-fld"><label>Mã ngân hàng (vd VCB, MB, TCB)</label><input class="dh-cd-inp" id="cd-tt_ngan_hang" value="${escHtml(g('donhang.tt_ngan_hang',''))}"></div>
    <div class="dh-cd-fld"><label>Số tài khoản</label><input class="dh-cd-inp" id="cd-tt_so_tk" value="${escHtml(g('donhang.tt_so_tk',''))}"></div>
    <div class="dh-cd-fld"><label>Tên chủ tài khoản</label><input class="dh-cd-inp" id="cd-tt_ten_tk" value="${escHtml(g('donhang.tt_ten_tk',''))}"></div>
    <div class="dh-cd-fld"><label>Tiền tố nội dung CK</label><input class="dh-cd-inp" id="cd-tt_tien_to" value="${escHtml(g('donhang.tt_tien_to','NS'))}"></div>

    <button class="dh-cd-save" onclick="dhQLSaveSettings()">Lưu cấu hình</button>`;
}

// Toggle segment → lưu ngay
window.dhQLSetSeg = async function(key, val, el){
  const grp = el.parentElement;
  grp.querySelectorAll('.dh-seg-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  try {
    await supa.rpc('dh_fn_update_setting', { p_key: 'donhang.'+key, p_value: val });
    // cập nhật cache runtime để các màn khác thấy ngay
    if (window.APP_SETTINGS) window.APP_SETTINGS['donhang.'+key] = val;
    showToast && showToast('Đã lưu: '+key+' = '+val, 'success');
  } catch(e){ showToast && showToast('Lỗi lưu: '+(e.message||e), 'error'); }
};

window.dhQLSaveSettings = async function(){
  const num = id => { const el = document.getElementById('cd-'+id); return el ? parseFloat(el.value)||0 : null; };
  const str = id => { const el = document.getElementById('cd-'+id); return el ? el.value.trim() : null; };
  const items = [
    ['donhang.ban_kinh_km',  num('ban_kinh_km')],
    ['donhang.timeout_giay', num('timeout_giay')],
    ['donhang.canhbao_phut', num('canhbao_phut')],
    ['donhang.pct_tu_van',   num('pct_tu_van')],
    ['donhang.pct_ban',      num('pct_ban')],
    ['donhang.tt_ngan_hang', str('tt_ngan_hang')],
    ['donhang.tt_so_tk',     str('tt_so_tk')],
    ['donhang.tt_ten_tk',    str('tt_ten_tk')],
    ['donhang.tt_tien_to',   str('tt_tien_to')]
  ];
  const btn = event && event.target;
  if (btn) { btn.disabled = true; btn.textContent = 'Đang lưu...'; }
  try {
    for (const [k,v] of items) {
      await supa.rpc('dh_fn_update_setting', { p_key: k, p_value: v });
      if (window.APP_SETTINGS) window.APP_SETTINGS[k] = v;
    }
    showToast && showToast('Đã lưu toàn bộ cấu hình', 'success');
  } catch(e){ showToast && showToast('Lỗi: '+(e.message||e), 'error'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'Lưu cấu hình'; } }
};

// ─── Chuyển trạng thái đơn (đóng gói → ship → giao → hoàn tất) ──────────
window.dhQLChuyenTT = async function(donId, tt){
  try {
    let res;
    if (tt === 'HOAN_TAT') res = await supa.rpc('dh_fn_hoan_tat', { p_don_id: donId });
    else res = await supa.rpc('dh_fn_trang_thai', { p_don_id: donId, p_trang_thai: tt });
    if (res.error) throw res.error;
    showToast && showToast(tt==='HOAN_TAT' ? 'Đơn hoàn tất · đã chia hoa hồng' : 'Đã cập nhật trạng thái', 'success');
    dhQLDetail(donId);
    dhQLLoadDon();
  } catch(e){ showToast && showToast('Lỗi: '+(e.message||e), 'error'); }
};

// ─── QR thanh toán VietQR (động, miễn phí qua img.vietqr.io) ────────────
window.dhQLShowQR = async function(donId){
  try {
    const { data, error } = await supa.rpc('dh_fn_tao_thanh_toan', { p_don_id: donId });
    if (error) throw error;
    if (!data || !data.ok) { showToast && showToast((data&&data.error)||'Lỗi tạo thanh toán', 'warn'); return; }

    const bank = _getSetting('donhang.tt_ngan_hang', '');
    const acc  = _getSetting('donhang.tt_so_tk', '');
    const name = _getSetting('donhang.tt_ten_tk', '');
    if (!bank || !acc) { showToast && showToast('Chưa cấu hình ngân hàng nhận tiền — vào tab Cài đặt', 'warn'); return; }

    const amt  = Math.round(Number(data.so_tien) || 0);
    const ndck = data.noi_dung_ck;
    const qrUrl = 'https://img.vietqr.io/image/' + encodeURIComponent(bank) + '-' + encodeURIComponent(acc)
                + '-compact2.png?amount=' + amt + '&addInfo=' + encodeURIComponent(ndck)
                + '&accountName=' + encodeURIComponent(name);

    document.getElementById('dh-qr-img').src = qrUrl;
    document.getElementById('dh-qr-amt').textContent = _dhVND(amt) + 'đ';
    document.getElementById('dh-qr-ndck').textContent = ndck;
    document.getElementById('dh-qr-bank').textContent = String(bank).toUpperCase() + ' · ' + acc;
    document.getElementById('dh-qr-name').textContent = name || '--';
    window._dhQRDonId = donId;
    document.getElementById('dh-qr-overlay').style.display = 'flex';
  } catch(e){ showToast && showToast('Lỗi: '+(e.message||e), 'error'); }
};
window.dhQRClose = function(){ const o = document.getElementById('dh-qr-overlay'); if (o) o.style.display = 'none'; };

// Xác nhận đã nhận tiền (thủ công — webhook SePay thay thế khi go-live)
window.dhQLXacNhanTT = async function(){
  const donId = window._dhQRDonId;
  if (!donId) return;
  const btn = event && event.target;
  if (btn) { btn.disabled = true; btn.textContent = 'Đang xác nhận...'; }
  try {
    const { error } = await supa.rpc('dh_fn_xac_nhan_tt', { p_don_id: donId });
    if (error) throw error;
    showToast && showToast('Đã xác nhận thanh toán', 'success');
    dhQRClose();
    dhQLDetail(donId);
    dhQLLoadDon();
  } catch(e){ showToast && showToast('Lỗi: '+(e.message||e), 'error'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'Xác nhận đã nhận tiền'; } }
};
