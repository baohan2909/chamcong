
function openNghiDotXuatModal(){
  if(!SESSION) return;
  if(!lcData || lcData.trangThaiTuan !== 'HIEN_TAI') {
    showToast('Chỉ dùng cho tuần hiện tại.','err');
    return;
  }
  _dxState = { ngayChon: new Set(), anhB64: '' };
  // Reset UI
  document.getElementById('dx-lydo').value = '';
  document.getElementById('dx-anh').value = '';
  document.getElementById('dx-anh-preview').style.display = 'none';
  // Render 7 ngày của tuần hiện tại
  const today = new Date(); today.setHours(0,0,0,0);
  const tuanDau = new Date(lcData.ngayDau); tuanDau.setHours(0,0,0,0);
  const dows = ['CN','T2','T3','T4','T5','T6','T7'];
  let html = '';
  for(let i=0; i<7; i++){
    const d = new Date(tuanDau); d.setDate(d.getDate()+i);
    const ngayStr = d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
    const isPast = d < today;
    const dow = dows[d.getDay()];
    const dayNum = pad(d.getDate());
    const monthNum = pad(d.getMonth()+1);
    // Check nếu ngày này đã có lịch DA_DUYET/CHO_DUYET
    const daCoLich = (lcEdit[ngayStr] && lcEdit[ngayStr].type);
    if(isPast){
      html += `<div style="padding:8px 4px;text-align:center;background:#F3F4F6;border-radius:6px;opacity:.5;cursor:not-allowed">
        <div style="font-size:10px;color:#9CA3AF">${dow}</div>
        <div style="font-size:13px;font-weight:600;color:#9CA3AF">${dayNum}/${monthNum}</div>
      </div>`;
    } else {
      html += `<button id="dx-day-${ngayStr}" onclick="toggleDXDay('${ngayStr}')" style="padding:8px 4px;text-align:center;background:white;border:1.5px solid #E5E7EB;border-radius:6px;cursor:pointer;transition:all .15s">
        <div style="font-size:10px;color:#6B7280">${dow}</div>
        <div style="font-size:13px;font-weight:600;color:#111827">${dayNum}/${monthNum}</div>
        ${daCoLich ? '<div style="font-size:9px;color:#F59E0B;margin-top:1px">đã có lịch</div>' : ''}
      </button>`;
    }
  }
  document.getElementById('dx-days').innerHTML = html;
  document.getElementById('dx-modal').style.display = 'flex';
}

function toggleDXDay(ngayStr){
  const btn = document.getElementById('dx-day-'+ngayStr);
  if(!btn) return;
  if(_dxState.ngayChon.has(ngayStr)){
    _dxState.ngayChon.delete(ngayStr);
    btn.style.background = 'white';
    btn.style.borderColor = '#E5E7EB';
    btn.style.color = '#111827';
  } else {
    _dxState.ngayChon.add(ngayStr);
    btn.style.background = '#EA580C';
    btn.style.borderColor = '#EA580C';
    btn.style.color = 'white';
    btn.querySelectorAll('div').forEach(d=>d.style.color='white');
  }
}

function closeNghiDotXuatModal(){
  document.getElementById('dx-modal').style.display = 'none';
}

function onDXAnhChange(input){
  const file = input.files && input.files[0];
  if(!file) return;
  // Compress: dùng cách giống ảnh chấm công nếu có sẵn
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxW = 1200;
      let w = img.width, h = img.height;
      if(w > maxW){ h = h * maxW / w; w = maxW; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const b64 = canvas.toDataURL('image/jpeg', 0.85);
      _dxState.anhB64 = b64;
      const previewImg = document.getElementById('dx-anh-img');
      previewImg.src = b64;
      document.getElementById('dx-anh-preview').style.display = 'block';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function submitNghiDotXuat(){
  if(_dxState.ngayChon.size === 0){
    showToast('Chọn ít nhất 1 ngày nghỉ.','err'); return;
  }
  const lyDo = document.getElementById('dx-lydo').value.trim();
  if(!lyDo){ showToast('Cần nhập lý do.','err'); return; }
  if(!_dxState.anhB64){ showToast('Cần đính kèm ảnh.','err'); return; }
  
  const btn = document.getElementById('dx-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Đang gửi...';
  
  try {
    // Build lichCaArr - chỉ Nghỉ phép
    const ngayList = Array.from(_dxState.ngayChon).sort();
    const lichCaArr = [];
    // Upload ảnh 1 lần, dùng chung cho mọi ngày
    let anhUrl = '';
    try {
      const b64 = _dxState.anhB64.replace(/^data:image\/\w+;base64,/, '');
      const byteChars = atob(b64);
      const bytes = new Uint8Array(byteChars.length);
      for(let i=0; i<byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'image/jpeg' });
      const path = ngayList[0] + '/' + SESSION.ma + '_dotxuat_' + Date.now() + '.jpg';
      const { error: upErr } = await supa.storage.from('don-nghi-anh').upload(path, blob, { contentType: 'image/jpeg' });
      if(!upErr){
        const { data: urlData } = supa.storage.from('don-nghi-anh').getPublicUrl(path);
        anhUrl = urlData ? urlData.publicUrl : '';
      }
    } catch(e){ console.warn('Upload ảnh đột xuất lỗi:', e); }
    
    ngayList.forEach(ng => {
      lichCaArr.push({
        ngay: ng,
        loai: LC_NGHI_PHEP,
        maCH: '', tenCH: '',
        gioBatDau: '', gioKetThuc: '',
        lyDo: lyDo,
        anhUrl: anhUrl
      });
    });
    
    const { data: res, error } = await supa.rpc('fn_gui_lich_ca', {
      p_ma_nv: SESSION.ma,
      p_ten_nv: SESSION.ten,
      p_tuan: lcTuan,
      p_lich_ca: lichCaArr,
      p_ly_do_gap: null
    });
    
    if(error || !res || !res.success){
      showToast((res && res.error) || (error && error.message) || 'Lỗi gửi đơn.','err');
      btn.disabled = false;
      btn.textContent = 'Gửi đơn nghỉ';
      return;
    }
    
    showToast('✓ Đã gửi ' + ngayList.length + ' ngày nghỉ đột xuất cho QLNS', 'ok');
    closeNghiDotXuatModal();
    taiLichCa();
  } catch(e) {
    showToast('Lỗi: ' + e.message,'err');
    btn.disabled = false;
    btn.textContent = 'Gửi đơn nghỉ';
  }
}

// ─── QLNS xem lịch ca — accordion phân tầng [SỬA HOÀN TOÀN v8] ──
let lcqlTuan='', lcqlData=null, lcqlMode='kv';
// Trạng thái mở accordion
let _accOpenKV='', _accOpenCH='';
let _lcqlFilter='all'; // 'all' | 'dagui' | 'chuagui' [FIX v9]

function doiTuanLCQL(delta){
  const d=new Date(_thuHai(lcqlTuan)+'T00:00:00');
  d.setDate(d.getDate()+delta*7);
  lcqlTuan=_tuanISO(d);
  taiLichCaQL();
}

// Lọc theo nút bấm thống kê [FIX v9]
function filterLCQL(filter){
  _lcqlFilter=filter;
  // Đánh dấu active
  document.querySelectorAll('.lcql-mstat').forEach(b=>b.classList.remove('active'));
  const map={all:'lcql-ms1-wrap',dagui:'lcql-ms2-wrap',chuagui:'lcql-ms3-wrap'};
  if(map[filter])document.getElementById(map[filter])?.classList.add('active');
  renderLCQL();
}

// Tìm kiếm thông minh [FIX v9]
function onLCQLSearch(){
  _accOpenKV=''; _accOpenCH='';
  renderLCQL();
}

let _lcqlAllData = [];
function taiLichCaQL(){
  if(typeof _chanQuanLyNS==='function' && _chanQuanLyNS()) return;   // [v13.49] chỉ ADMIN/QLNS
  if(!lcqlTuan)lcqlTuan=_tuanISO(new Date());
  document.getElementById('lcql-tuan-lbl').textContent=_tuanLabel(lcqlTuan);
  document.getElementById('lcql-list').innerHTML='<div class="ns-empty">⏳ Đang tải...</div>';
  const tuanClean = lcqlTuan.replace('W','');
  const parts = tuanClean.split('-');
  const year = parseInt(parts[0]); const week = parseInt(parts[1]);
  const jan4 = new Date(year, 0, 4);
  const ms = jan4.getTime() + ((1 - (jan4.getDay() || 7)) + (week - 1) * 7) * 86400000;
  const thuHai = new Date(ms);
  const chuNhat = new Date(thuHai.getTime() + 6*86400000);
  // [v9.45] Build yyyy-mm-dd theo local (không dùng toISOString vì lệch timezone)
  const _fmt = d => d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
  const tuStr = _fmt(thuHai);
  const denStr = _fmt(chuNhat);
  Promise.all([
    supa.from('lich_ca').select('*').gte('ngay', tuStr).lte('ngay', denStr),
    supa.from('don_nghi').select('*').gte('ngay_nghi', tuStr).lte('ngay_nghi', denStr),
    supa.from('nhan_vien').select('ma_nv, ho_ten, ma_ch_mac_dinh, khu_vuc'),
    supa.from('cua_hang').select('ma_ch, ten_ch, khu_vuc')
  ]).then(([lcRes, dnRes, nvRes, chRes]) => {
    const nvMap = {}; (nvRes.data||[]).forEach(nv => { nvMap[nv.ma_nv] = nv; });
    const chMap = {}; (chRes.data||[]).forEach(ch => { chMap[ch.ma_ch] = ch; });
    _lcqlAllData = [];
    (lcRes.data||[]).forEach(r => {
      const nv = nvMap[r.ma_nv] || {};
      const effectiveMaCH = r.ma_ch || nv.ma_ch_mac_dinh || '—';
      const ch = chMap[effectiveMaCH] || chMap[r.ma_ch] || {};
      _lcqlAllData.push({
        maNV: r.ma_nv, tenNV: r.ten_nv_snapshot || nv.ho_ten || r.ma_nv,
        maCH: effectiveMaCH,
        tenCH: ch.ten_ch || r.ten_ch_snapshot || effectiveMaCH,
        khuVuc: ch.khu_vuc || nv.khu_vuc || '(Chưa phân khu)',
        ngay: r.ngay, loai: r.loai || r.ca_lam,
        gio: r.gio_bat_dau ? (r.gio_bat_dau+'').substring(0,5)+'-'+(r.gio_ket_thuc+'').substring(0,5) : '',
        trangThai: r.trang_thai || 'DA_GUI', ghiChu: r.ghi_chu_nv || ''
      });
    });
    // [v9.45] Build set "đã có Nghỉ phép trong lich_ca" để skip don_nghi trùng
    const _nghiPhepKey = new Set();
    (lcRes.data||[]).forEach(r => {
      if ((r.loai || r.ca_lam) === 'Nghỉ phép') {
        _nghiPhepKey.add(r.ma_nv + '|' + r.ngay);
      }
    });
    (dnRes.data||[]).forEach(dn => {
      // Skip nếu đã có row Nghỉ phép cùng NV + ngày trong lich_ca
      if (_nghiPhepKey.has(dn.ma_nv + '|' + dn.ngay_nghi)) return;
      const nv = nvMap[dn.ma_nv] || {};
      const effectiveMaCH = dn.ma_ch || nv.ma_ch_mac_dinh || '—';
      const ch = chMap[effectiveMaCH] || chMap[dn.ma_ch] || {};
      _lcqlAllData.push({
        maNV: dn.ma_nv, tenNV: nv.ho_ten || dn.ma_nv,
        maCH: effectiveMaCH,
        tenCH: ch.ten_ch || effectiveMaCH,
        khuVuc: ch.khu_vuc || nv.khu_vuc || '(Chưa phân khu)',
        ngay: dn.ngay_nghi, loai: 'Nghỉ phép', gio: '',
        trangThai: dn.trang_thai || 'CHO_DUYET', ghiChu: dn.ly_do || ''
      });
    });
    renderLCQL();
    const kvs = new Set(_lcqlAllData.map(d=>d.khuVuc));
    const chs = new Set(_lcqlAllData.map(d=>d.maCH));
    const nvs = new Set(_lcqlAllData.map(d=>d.maNV));
    _lcqlUpdateStats(kvs.size, chs.size, nvs.size);
  }).catch(()=>{
    document.getElementById('lcql-list').innerHTML='<div class="ns-empty">❌ Lỗi kết nối.</div>';
  });
  const now=new Date();
  document.getElementById('lcql-updated').textContent='Cập nhật lúc '+pad(now.getHours())+':'+pad(now.getMinutes());
}
function _lcqlUpdateStats(kvC, chC, nvC){
  document.getElementById('lcql-ms1').textContent = kvC;
  document.getElementById('lcql-ms1-lbl').textContent = 'Khu vực';
  document.getElementById('lcql-ms2').textContent = chC;
  document.getElementById('lcql-ms2-lbl').textContent = 'Cửa hàng';
  document.getElementById('lcql-ms3').textContent = nvC;
  document.getElementById('lcql-ms3-lbl').textContent = 'Nhân viên';
  document.getElementById('lcql-ms4').textContent = _lcqlAllData.length;
  document.getElementById('lcql-ms4-lbl').textContent = 'Tổng lịch';
}
function setLCQLMode(mode){
  lcqlMode=mode;
  document.querySelectorAll('.lcql-mode-tab').forEach(b=>b.classList.remove('active'));
  document.getElementById('lcqlm-'+mode).classList.add('active');
  renderLCQL();
}
function renderLCQL(){
  const data = _lcqlAllData;
  const list = document.getElementById('lcql-list');
  if(!data.length){ list.innerHTML='<div class="ns-empty"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:0 auto 8px"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Chưa có lịch ca / đơn nghỉ.</div>'; return; }
  const q = ((document.getElementById('lcql-search')||{}).value||'').toLowerCase();
  const filtered = q ? data.filter(d => (d.tenNV||'').toLowerCase().includes(q)||(d.maNV||'').toLowerCase().includes(q)||(d.tenCH||'').toLowerCase().includes(q)||(d.maCH||'').toLowerCase().includes(q)||(d.khuVuc||'').toLowerCase().includes(q)) : data;
  const dow=['CN','T2','T3','T4','T5','T6','T7'];
  const _dl=d=>{const dt=new Date(d.ngay);return dow[dt.getDay()]+' '+d.ngay.substring(8)+'/'+d.ngay.substring(5,7);};
  // SVG icons
  const _icoCheck = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><polyline points="20 6 9 17 4 12"/></svg>';
  const _icoX     = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  const _icoWait  = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
  const _tt=d=>{
    const t=d.trangThai;
    if (t==='DA_DUYET') return `<span style="color:#0F6E56;font-weight:600;font-size:11px">${_icoCheck} Đã duyệt</span>`;
    if (t==='TU_CHOI')  return `<span style="color:#DC2626;font-weight:600;font-size:11px">${_icoX} Từ chối</span>`;
    if (t==='CHO_DUYET')return `<span style="color:#F59E0B;font-weight:600;font-size:11px">${_icoWait} Chờ duyệt</span>`;
    if (t==='DA_GUI')   return `<span style="color:#64748B;font-weight:500;font-size:11px">Đã gửi</span>`;
    return `<span style="color:#94A3B8;font-size:11px">—</span>`;
  };
  const _dr=d=>{
    const tenCH = (d.loai === 'Nghỉ phép') ? '' : (d.tenCH || d.maCH || '');
    const gio = (d.loai === 'Nghỉ phép') ? '' : d.gio;
    return `<div style="display:grid;grid-template-columns:130px 1fr 95px 100px;gap:8px;padding:6px 10px;font-size:11.5px;border-bottom:1px solid #F1F5F9;align-items:center"><span style="color:#0F172A;font-weight:500">${_dl(d)} · <span style="color:#64748B;font-weight:400">${d.loai}</span></span><span style="color:#64748B;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${tenCH}</span><span style="color:#64748B;text-align:right;font-variant-numeric:tabular-nums">${gio}</span><span style="text-align:right">${_tt(d)}</span></div>`;
  };
  const _tog=`onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'"`;
  const _togP=`onclick="this.parentElement.classList.toggle('open')"`;
  // SVG: location pin, store, user, calendar, chevron
  const _icoKV = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
  const _icoCH = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0369A1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>';
  const _icoNV = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0F766E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  const _icoCal= '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
  // [v10.85 YC#2] Sort KV theo thứ tự: Hà Nội, Bắc Trung Bộ, Trung Tây Nguyên, HCM, Đông Nam Bộ, Tây Nam Bộ, còn lại
  const _kvSortLich = (a, b) => {
    const ORDER = ['hà nội', 'bắc trung', 'trung tây nguyên', 'hồ chí minh', 'đông nam', 'tây nam'];
    const _idx = (kv) => {
      const k = (kv || '').toLowerCase().replace(/^khu vực\s+/i, '');
      for (let i = 0; i < ORDER.length; i++) if (k.includes(ORDER[i])) return i;
      // Khác/chưa phân khu cuối cùng
      if (k.includes('chưa phân') || !k) return 99;
      return 50;
    };
    const ia = _idx(a), ib = _idx(b);
    if (ia !== ib) return ia - ib;
    return (a || '').localeCompare(b || '', 'vi');
  };
  // [v10.85] Mỗi KV 1 màu — style action card: nền tint nhạt + chữ đậm + viền mỏng
  const LCQL_KV_COLORS = {
    'Hà Nội':         { accent:'#0284C7', tint:'#F0F9FF', bd:'#BAE6FD' },
    'Bắc Trung Bộ':   { accent:'#0F6E56', tint:'#ECFDF5', bd:'#A7F3D0' },
    'Trung Tây Nguyên':{ accent:'#0D9488', tint:'#F0FDFA', bd:'#99F6E4' },
    'Hồ Chí Minh':    { accent:'#DC2626', tint:'#FEF2F2', bd:'#FECACA' },
    'Đông Nam Bộ':    { accent:'#D97706', tint:'#FFFBEB', bd:'#FDE68A' },
    'Tây Nam Bộ':     { accent:'#BE185D', tint:'#FDF2F8', bd:'#FBCFE8' },
    'Khác':           { accent:'#475569', tint:'#F8FAFC', bd:'#E2E8F0' },
  };
  const _kvc = (kv) => LCQL_KV_COLORS[kv] || LCQL_KV_COLORS['Khác'];
  let html='<style>.lcql-kv-group.open>.lcql-kv-body{display:block!important}.lcql-kv-group{border-radius:12px;margin-bottom:10px;overflow:hidden;transition:transform .15s,box-shadow .15s}.lcql-kv-group:hover{transform:translateX(2px);box-shadow:0 4px 14px -4px rgba(15,23,42,.1)}</style>';
  if(lcqlMode==='kv'){
    const g={};filtered.forEach(d=>{if(!g[d.khuVuc])g[d.khuVuc]={};if(!g[d.khuVuc][d.maCH])g[d.khuVuc][d.maCH]={ten:d.tenCH,nvs:{}};if(!g[d.khuVuc][d.maCH].nvs[d.maNV])g[d.khuVuc][d.maCH].nvs[d.maNV]={ten:d.tenNV,days:[]};g[d.khuVuc][d.maCH].nvs[d.maNV].days.push(d);});
    Object.keys(g).sort(_kvSortLich).forEach(kv=>{
      const cks=Object.keys(g[kv]).sort();
      const totalNV = new Set();
      cks.forEach(ck => Object.keys(g[kv][ck].nvs).forEach(nk => totalNV.add(nk)));
      const c = _kvc(kv);
      html+=`<div class="lcql-kv-group" style="border:none"><div ${_togP} style="cursor:pointer;padding:13px 14px;background:${c.tint};color:${c.accent};border-left:4px solid ${c.accent};display:flex;align-items:center;gap:10px;font-weight:700;font-size:13.5px;transition:filter .15s" onmouseover="this.style.filter='brightness(.97)'" onmouseout="this.style.filter=''"><span style="display:inline-flex;width:14px;height:14px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></span><span style="flex:1">${escHtml(kv)}</span><span style="font-size:11.5px;font-weight:600;opacity:.75">${cks.length} CH · ${totalNV.size} NV</span></div><div class="lcql-kv-body" style="display:none;padding:8px">`;
      cks.forEach(ck=>{
        const ci=g[kv][ck];
        const nks=Object.keys(ci.nvs).sort();
        html+=`<div style="background:#fff;border:none;border-radius:10px;margin-bottom:6px;overflow:hidden"><div ${_tog} style="cursor:pointer;padding:9px 12px;display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:600;color:#0F172A;background:${c.tint}">${_icoCH}<span style="flex:1">${escHtml(ci.ten)} <span style="font-weight:400;color:#94A3B8;font-size:11px">${escHtml(ck)}</span></span><span style="font-size:11px;font-weight:600;color:${c.accent}">${nks.length} NV</span></div><div style="display:none;padding:6px 8px 8px 8px;background:#fff">`;
        nks.forEach(nk=>{
          const ni=ci.nvs[nk];
          html+=`<div style="margin-bottom:5px"><div ${_tog} style="cursor:pointer;padding:8px 10px;background:#fff;border-radius:8px;border:1px solid #E5E7EB;display:flex;align-items:center;gap:8px;font-size:12px">${_renderAvatar(nk, ni.ten, 32)}<span style="flex:1;color:#0F172A;font-weight:500">${escHtml(ni.ten)} <span style="color:#94A3B8;font-weight:400;font-size:11px">${escHtml(nk)}</span></span><span style="color:#64748B;font-size:11px;font-weight:600">${ni.days.length} ngày</span></div><div style="display:none;padding:4px 0 4px 4px">${ni.days.sort((a,b)=>a.ngay.localeCompare(b.ngay)).map(_dr).join('')}</div></div>`;
        });
        html+=`</div></div>`;
      });
      html+=`</div></div>`;
    });
  } else if(lcqlMode==='ch'){
    const g={};filtered.forEach(d=>{if(!g[d.maCH])g[d.maCH]={ten:d.tenCH,kv:d.khuVuc,nvs:{},allDays:[]};if(!g[d.maCH].nvs[d.maNV])g[d.maCH].nvs[d.maNV]={ten:d.tenNV,days:[]};g[d.maCH].nvs[d.maNV].days.push(d);g[d.maCH].allDays.push(d);});
    Object.keys(g).sort().forEach(ck=>{const ci=g[ck];const nks=Object.keys(ci.nvs).sort();
      const c = _kvc(ci.kv);
      const chBodyId = 'ch-body-' + ck.replace(/[^A-Za-z0-9]/g,'');
      let nvHtml = '';
      nks.forEach(nk=>{const ni=ci.nvs[nk];const _soNgay = new Set(ni.days.map(x=>x.ngay)).size;
        nvHtml += `<div style="margin-bottom:5px"><div ${_tog} style="cursor:pointer;padding:8px 10px;background:#fff;border-radius:8px;border:1px solid ${c.bd};display:flex;align-items:center;gap:8px;font-size:12px">${_renderAvatar(nk, ni.ten, 32)}<span style="flex:1;color:#0F172A;font-weight:500">${escHtml(ni.ten)} <span style="color:#94A3B8;font-weight:400;font-size:11px">${escHtml(nk)}</span></span><span style="color:#64748B;font-size:11px;font-weight:600">${_soNgay} ngày</span></div><div style="display:none;padding:4px 0 4px 4px">${ni.days.sort((a,b)=>a.ngay.localeCompare(b.ngay)).map(_dr).join('')}</div></div>`;
      });
      const ngayMap = {};
      ci.allDays.forEach(d=>{ if(!ngayMap[d.ngay]) ngayMap[d.ngay]=[]; ngayMap[d.ngay].push(d); });
      let dayHtml = '';
      Object.keys(ngayMap).sort().forEach(ng=>{
        const items = ngayMap[ng];
        const uniqueNV = new Set(items.map(x=>x.maNV)).size;
        const dt = new Date(ng); const dowLbl = dow[dt.getDay()];
        dayHtml += `<div style="margin-bottom:5px"><div ${_tog} style="cursor:pointer;padding:8px 10px;background:#fff;border-radius:8px;border:1px solid ${c.bd};display:flex;align-items:center;gap:8px;font-size:12px">${_icoCal}<span style="flex:1;color:#0F172A"><strong>${dowLbl} ${ng.substring(8)}/${ng.substring(5,7)}</strong></span><span style="color:#64748B;font-size:11px;font-weight:600">${uniqueNV} NV · ${items.length} slot</span></div><div style="display:none;padding:4px 0 4px 4px">${items.sort((a,b)=>(a.tenNV||'').localeCompare(b.tenNV||'','vi')).map(d=>{
          const tenCH = (d.loai === 'Nghỉ phép') ? '' : (d.tenCH || d.maCH || '');
          const gio = (d.loai === 'Nghỉ phép') ? '' : d.gio;
          return `<div style="display:grid;grid-template-columns:auto 160px 1fr 95px 100px;gap:8px;padding:6px 10px;font-size:11.5px;border-bottom:1px solid #F1F5F9;align-items:center">${_renderAvatar(d.maNV, d.tenNV, 28)}<span style="color:#0F172A;font-weight:500">${escHtml(d.tenNV)} <span style="color:#94A3B8;font-weight:400;font-size:10.5px">${escHtml(d.maNV)}</span></span><span style="color:#64748B">${d.loai}</span><span style="color:#64748B;text-align:right;font-variant-numeric:tabular-nums">${gio}</span><span style="text-align:right">${_tt(d)}</span></div>`;
        }).join('')}</div></div>`;
      });
      html+=`<div class="lcql-kv-group" style="border:none"><div ${_togP} style="cursor:pointer;padding:12px 14px;background:${c.tint};color:${c.accent};border-left:4px solid ${c.accent};display:flex;align-items:center;gap:10px;font-weight:700;font-size:13px;transition:filter .15s" onmouseover="this.style.filter='brightness(.97)'" onmouseout="this.style.filter=''"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg><span style="flex:1">${escHtml(ci.ten)} <span style="font-weight:400;opacity:.7;font-size:11.5px">${escHtml(ck)}</span></span><span style="font-size:11px;font-weight:600;opacity:.75">${escHtml(ci.kv||'')} · ${nks.length} NV</span></div><div class="lcql-kv-body" style="display:none;padding:8px">
        <div style="display:flex;gap:5px;margin-bottom:10px;font-size:11.5px">
          <button onclick="lcqlCHViewSwitch('${chBodyId}','nv',this)" class="lcql-ch-view active" style="padding:6px 12px;border-radius:7px;border:1.5px solid ${c.accent};background:${c.accent};color:#fff;cursor:pointer;font-weight:600;display:inline-flex;align-items:center;gap:5px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Theo NV</button>
          <button onclick="lcqlCHViewSwitch('${chBodyId}','day',this)" class="lcql-ch-view" style="padding:6px 12px;border-radius:7px;border:1.5px solid #E5E7EB;background:#fff;color:#374151;cursor:pointer;font-weight:600;display:inline-flex;align-items:center;gap:5px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg>Theo ngày</button>
        </div>
        <div id="${chBodyId}-nv" class="lcql-ch-pane">${nvHtml}</div>
        <div id="${chBodyId}-day" class="lcql-ch-pane" style="display:none">${dayHtml}</div>
      </div></div>`;
    });
  } else {
    // [v10.85 YC#4] Mode NV: avatar lớn 40, body xanh nhạt
    const g={};filtered.forEach(d=>{if(!g[d.maNV])g[d.maNV]={ten:d.tenNV,ch:d.tenCH,maCH:d.maCH,kv:d.khuVuc,days:[]};g[d.maNV].days.push(d);});
    Object.keys(g).sort((a,b)=>(g[a].ten||'').localeCompare(g[b].ten||'','vi')).forEach(nk=>{
      const ni=g[nk];const _soNgay = new Set(ni.days.map(x=>x.ngay)).size;
      html+=`<div class="lcql-kv-group"><div ${_togP} style="cursor:pointer;padding:12px 14px;background:#fff;display:flex;align-items:center;gap:12px;font-size:13px">${_renderAvatar(nk, ni.ten, 40)}<span style="flex:1"><strong style="color:#0F172A">${escHtml(ni.ten)}</strong> <span style="color:#94A3B8;font-size:11.5px;font-weight:400">${escHtml(nk)}</span><div style="font-size:11px;color:#64748B;margin-top:2px">${escHtml(ni.ch||'')}</div></span><span style="font-size:11px;color:#0F6E56;font-weight:700;background:#DCFCE7;padding:3px 10px;border-radius:99px">${_soNgay} ngày</span></div><div class="lcql-kv-body" style="display:none;padding:4px 8px 8px 8px;background:#F0FDF4">${ni.days.sort((a,b)=>a.ngay.localeCompare(b.ngay)).map(_dr).join('')}</div></div>`;
    });
  }
  list.innerHTML = html || '<div class="ns-empty">Không tìm thấy.</div>';
  try { if (window._avatarLoadedAll) _patchAvatars(); } catch(e){}
}

function toggleAccKV(kv){
  _accOpenKV=_accOpenKV===kv?'':kv;
  _accOpenCH='';
  renderLCQL();
}
// [v9.45] Switch view "Theo NV" / "Theo ngày" trong mode CH
function lcqlCHViewSwitch(chBodyId, view, btn){
  document.getElementById(chBodyId+'-nv').style.display = (view==='nv') ? '' : 'none';
  document.getElementById(chBodyId+'-day').style.display = (view==='day') ? '' : 'none';
  // Cập nhật style nút
  const parent = btn.parentElement;
  parent.querySelectorAll('.lcql-ch-view').forEach(b=>{
    b.style.background = 'white';
    b.style.color = '';
    b.style.borderColor = '#e5e7eb';
    b.classList.remove('active');
  });
  btn.style.background = 'var(--green-m)';
  btn.style.color = 'white';
  btn.style.borderColor = 'var(--green-m)';
  btn.classList.add('active');
}
function toggleAccCH(kv,maCH){
  const key=kv+'_'+maCH;
  _accOpenCH=_accOpenCH===key?'':key;
  renderLCQL();
}

// Modal chi tiết lịch NV [SỬA v8: hiện Nghỉ phép màu hồng, giờ BD-KT, nhiều slot/ngày]
let _lcMaNV='', _lcTuanModal='';
function xemLichCaNV(maNV, tenNV){
  const nv=lcqlData.danhSachLich.find(n=>n.ma===maNV);
  if(!nv)return;
  _lcMaNV=maNV; _lcTuanModal=lcqlTuan;
  document.getElementById('lc-d-name').textContent=tenNV+' ('+maNV+')';
  document.getElementById('lc-d-sub').textContent=_tuanLabel(lcqlTuan);
  const ngayTuan=_ngayTuan(lcqlTuan);
  const body=document.getElementById('lc-d-body');
  if(!nv.daDangKy){
    body.innerHTML='<div style="padding:20px;text-align:center;color:var(--text-m);font-size:13px">Nhân viên chưa gửi lịch tuần này.</div>';
    document.getElementById('lc-d-actions').style.display='none';
    document.getElementById('lc-detail-modal').classList.add('show');
    return;
  }
  document.getElementById('lc-d-actions').style.display='flex';
  body.innerHTML=ngayTuan.map(({ngay,dow,ngayNum})=>{
    // Lấy tất cả slots của ngày (hỗ trợ nhiều ca/ngày)
    const slots=nv.lich.filter(l=>l.ngay===ngay);
    const isNghi=slots.length>0&&slots[0].loai===LC_NGHI_PHEP;
    const cls=slots.length===0?'off':isNghi?'nghi':
      slots[0].trangThai==='Từ chối'?'deny':
      slots[0].trangThai==='Chờ duyệt'?'wait':'work';

    let infoHtml='';
    if(slots.length===0){
      infoHtml='<div class="lc-d-ch">Không đăng ký</div>';
    } else if(isNghi){
      const ly=slots[0].ghiChuNV?`<div class="lc-d-gio" style="color:#C2185B">${slots[0].ghiChuNV.substring(0,40)}</div>`:'';
      const qlns=slots[0].ghiChuQLNS?`<div class="lc-d-gio" style="color:var(--green)">💬 ${slots[0].ghiChuQLNS}</div>`:'';
      infoHtml=`<div class="lc-d-ch">Nghỉ phép</div>${ly}${qlns}`;
    } else {
      infoHtml=slots.map(s=>{
        const gio=s.gioBatDau?`${s.gioBatDau}${s.gioKetThuc?' – '+s.gioKetThuc:''}`:'';
        return `<div class="lc-d-ch">${s.tenCH||'--'}</div>${gio?`<div class="lc-d-gio">${gio}</div>`:''}`;
      }).join('<div style="height:4px"></div>');
    }

    const stLabel=slots.length>0?slots[0].trangThai:'';
    const stCls=cls==='work'?'lcs-ok':cls==='wait'?'lcs-wait':cls==='deny'?'lcs-deny':cls==='nghi'?'lcs-nghi':'lcs-vang';

    return `<div class="lc-d-day-row">
      <div class="lc-d-day-dot lc-day-dot ${cls}">
        <span class="lc-d-dow">${dow}</span>
        <span class="lc-d-date">${ngayNum}</span>
      </div>
      <div class="lc-d-info">${infoHtml}</div>
      ${stLabel?`<span class="lc-day-status ${stCls}">${stLabel}</span>`:''}
    </div>`;
  }).join('');
  document.getElementById('lc-detail-modal').classList.add('show');
}
function closeLCDetail(){document.getElementById('lc-detail-modal').classList.remove('show');}
function duyetLichTuModal(qd){
  const quyetDinh=qd==='Da duyet'?'Đã duyệt':(qd==='Tu choi'?'Từ chối':qd);
  closeLCDetail();
  // [v12-P3] Lịch ca duyệt - chuyển trạng thái lich_ca rows sang DA_DUYET/TU_CHOI
  // Tạm dùng update trực tiếp qua bảng (RLS đã grant)
  const ttEnum = quyetDinh === 'Đã duyệt' ? 'DA_DUYET' : 'TU_CHOI';
  // Tính ngày đầu/cuối tuần
  const ngayDau = new Date(_thuHai(_lcTuanModal)+'T00:00:00');
  const ngayCuoi = new Date(ngayDau); ngayCuoi.setDate(ngayCuoi.getDate()+6);
  const dStr = d => d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
  supa.from('lich_ca')
    .update({ trang_thai: ttEnum, nguoi_duyet: SESSION.ma, thoi_gian_duyet: new Date().toISOString() })
    .eq('ma_nv', _lcMaNV)
    .gte('ngay', dStr(ngayDau))
    .lte('ngay', dStr(ngayCuoi))
    .then(({ error }) => {
      if(error){showToast('Lỗi: '+error.message,'err');return;}
      showToast(quyetDinh==='Đã duyệt'?'✓ Đã duyệt lịch ca':'✗ Đã từ chối lịch ca','ok');
      taiLichCaQL();
    });
}

// ─── TAB CON NHÂN SỰ / ĐƠN NGHỈ PHÉP [MỚI v8] ──────────────
let _nsSubTab='nhansu'; // 'nhansu' | 'donnghi'
let _dnpData=null;

function setNSSubTab(tab){
  _nsSubTab=tab;
  document.getElementById('nssub-nhansu').classList.toggle('active',tab==='nhansu');
  document.getElementById('nssub-donnghi').classList.toggle('active',tab==='donnghi');
  const elLS = document.getElementById('nssub-lichsu');
  if (elLS) elLS.classList.toggle('active',tab==='lichsu');
  const elLSCC = document.getElementById('nssub-lichsucc');
  if (elLSCC) elLSCC.classList.toggle('active',tab==='lichsucc');
  // [v10.86] Tab Chuyển đổi mã
  const elCDM = document.getElementById('nssub-chuyenma');
  if (elCDM) elCDM.classList.toggle('active',tab==='chuyenma');
  document.getElementById('ns-sub-nhansu').style.display=tab==='nhansu'?'':'none';
  document.getElementById('ns-sub-donnghi').style.display=tab==='donnghi'?'':'none';
  const elLSPanel = document.getElementById('ns-sub-lichsu');
  if (elLSPanel) elLSPanel.style.display=tab==='lichsu'?'':'none';
  const elLSCCPanel = document.getElementById('ns-sub-lichsucc');
  if (elLSCCPanel) elLSCCPanel.style.display=tab==='lichsucc'?'':'none';
  // [v10.86] Panel Chuyển đổi mã
  const elCDMPanel = document.getElementById('ns-sub-chuyenma');
  if (elCDMPanel) elCDMPanel.style.display=tab==='chuyenma'?'':'none';
  if(tab==='donnghi')taiDonNghiPhep();
  if(tab==='lichsu') taiLichSuDuyet();
  if(tab==='lichsucc') taiLichSuCC();
  if(tab==='chuyenma') cdmInit(); // [v10.86]
}

// ═══ [v10.85] LỊCH SỬ CHẤM CÔNG (ADMIN TỔNG KIỂM) ═══
let _lscDeb;
function _debLichSuCC(){
  clearTimeout(_lscDeb);
  _lscDeb = setTimeout(taiLichSuCC, 400);
}

// [v10.85] Helper detect trạng thái xác nhận bất kể enum thật là gì
function _ccIsHopLe(xn) {
  if (!xn) return false;
  const u = xn.toString().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return u === 'HOP_LE' || u === 'HOPLE' || u === 'OK';
}
// [v10.85] "Không hợp lệ" = MỌI thứ không phải Hợp lệ (null, enum khác đều gom vào)
// Đảm bảo Tổng = Hợp lệ + Không hợp lệ (không thiếu dòng nào)
function _ccIsKhongHopLe(xn) {
  return !_ccIsHopLe(xn);
}

async function taiLichSuCC(){
  const el = document.getElementById('lscc-list');
  if (!el) return;
  el.innerHTML = '<div class="ns-empty">⏳ Đang tải...</div>';

  if (!_lsdNVList && typeof _lsdLoadNVList === 'function') {
    await _lsdLoadNVList().catch(()=>{});
  }

  let tu = document.getElementById('lscc-tu').value;
  let den = document.getElementById('lscc-den').value;
  const loai = document.getElementById('lscc-loai').value;
  const xn = document.getElementById('lscc-xn').value; // '' | 'HL' | 'KHL'
  const nv = document.getElementById('lscc-nv').value.trim();
  const ch = document.getElementById('lscc-ch').value.trim();

  if (!tu && !den) {
    const today = new Date();
    const w = new Date(today); w.setDate(w.getDate() - 6);
    tu = _toDateStr(w); den = _toDateStr(today);
    document.getElementById('lscc-tu').value = tu;
    document.getElementById('lscc-den').value = den;
  }

  try {
    // [v10.85] Fetch theo batch để vượt mặc định 1000 của Supabase
    const PAGE = 1000;
    const MAX = 50000;
    const all = [];
    let from = 0;
    while (all.length < MAX) {
      let q = supa.from('cham_cong').select('id, ma_nv, ten_nv_snapshot, ma_ch, ten_ch_snapshot, loai, thoi_gian, ngay, xac_nhan, trang_thai_o, ghi_chu, device_info, nguon');
      if (tu) q = q.gte('ngay', tu);
      if (den) q = q.lte('ngay', den);
      if (loai) q = q.eq('loai', loai); // loai_cham_cong enum vẫn dùng được
      // [v10.85] Bỏ filter xac_nhan/nguon server-side để tránh lỗi enum casting → filter client-side
      if (nv) q = q.or(`ma_nv.ilike.%${nv}%,ten_nv_snapshot.ilike.%${nv}%`);
      if (ch) q = q.or(`ma_ch.ilike.%${ch}%,ten_ch_snapshot.ilike.%${ch}%`);
      q = q.order('ngay', { ascending:false }).order('thoi_gian', { ascending:false }).range(from, from + PAGE - 1);
      const { data, error } = await q;
      if (error) throw error;
      if (!data || !data.length) break;
      all.push(...data);
      if (data.length < PAGE) break;
      from += PAGE;
    }

    // Client-side filter cho xac_nhan / nguon
    let list = all;
    if (xn === 'HL') list = all.filter(r => _ccIsHopLe(r.xac_nhan));
    else if (xn === 'KHL') list = all.filter(r => _ccIsKhongHopLe(r.xac_nhan));
    if (window._lscNguonFilter) list = list.filter(r => r.nguon === window._lscNguonFilter);

    // Stats luôn count trên `all` (full data theo ngày), không count trên list (đã filter xn/nguon)
    document.getElementById('lscc-stat-tong').textContent = all.length + (all.length >= MAX ? '+' : '');
    document.getElementById('lscc-stat-hl').textContent  = all.filter(r => _ccIsHopLe(r.xac_nhan)).length;
    document.getElementById('lscc-stat-khl').textContent = all.filter(r => _ccIsKhongHopLe(r.xac_nhan)).length;
    document.getElementById('lscc-stat-auto').textContent = all.filter(r => r.nguon === 'AUTO_CLOSE').length;

    if (!list.length) {
      el.innerHTML = '<div class="ns-empty">' + (all.length ? 'Không có dòng nào khớp bộ lọc' : 'Không có log nào trong khoảng thời gian này') + '</div>';
      if (typeof _lscUpdateActiveCard === 'function') _lscUpdateActiveCard();
      return;
    }
    let warning = '';
    if (all.length >= MAX) {
      warning = '<div style="background:#FEF3C7;color:#92400E;padding:10px 12px;border-radius:8px;margin-bottom:10px;font-size:12.5px;font-weight:600">⚠ Đạt ngưỡng ' + MAX.toLocaleString() + ' dòng. Thu hẹp khoảng ngày để xem đầy đủ.</div>';
    }

    const nvMap = {};
    (_lsdNVList || []).forEach(n => { nvMap[n.ma_nv] = n; });

    // [v10.85] Build map đội sale từ list + sync window._doiSaleMap
    const doiMap = _buildDoiSaleMap(all);
    window._doiSaleMap = doiMap;

    const loaiLabel = { VAO_CA:'Vào ca', RA_CA:'Ra ca', VAO_GIUA_CA:'Vào giữa ca', RA_GIUA_CA:'Ra giữa ca' };
    // [#5] Tên đội SALE / cơ động của CHÍNH log này (per-log, KHÔNG gom theo NV-ngày)
    const _logSaleTeamName = (r) => {
      const di = r.device_info || '';
      let m = di.match(/\[SALE_ORIGIN:[^|]+\|([^\]]+)\]/i) || di.match(/\[SALE_TARGET:[^|]+\|([^\]]+)\]/i);
      if (m) return m[1].trim();
      const ghi = r.ghi_chu || '';
      m = ghi.match(/\[((?:đội\s*sale|cơ\s*động|co\s*dong)[^\]]*)\]/i);
      if (m) return m[1].trim();
      return null;
    };
    // [v13.99] Item 1 lần chấm (gọn). allowLive=true CHỈ cho log mới nhất của HÔM NAY (#1/#2)
    const _renderCCItem = (r, allowLive) => {
      const gio = r.thoi_gian ? new Date(r.thoi_gian).toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit',timeZone:'Asia/Ho_Chi_Minh'}) : '--:--';
      let xnBadge;
      if (_ccIsHopLe(r.xac_nhan)) {
        xnBadge = '<span style="background:#DCFCE7;color:#15803D;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700">HỢP LỆ</span>';
      } else {
        const u = r.xac_nhan ? r.xac_nhan.toString().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';
        const isStandard = /KHONG_?HOP_?LE/.test(u);
        const extra = isStandard ? '' : ` <span style="background:#FECACA;color:#7F1D1D;padding:1px 5px;border-radius:3px;font-size:9px;font-weight:700;margin-left:3px" title="Giá trị xac_nhan thật">${escHtml(r.xac_nhan || 'NULL')}</span>`;
        xnBadge = `<span style="background:#FEE2E2;color:#B91C1C;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700">KHÔNG HỢP LỆ</span>${extra}`;
      }
      const ttoBadge = !allowLive ? ''
        : (r.trang_thai_o === 'DANG_LAM_VIEC'
          ? '<span style="background:#DBEAFE;color:#1E40AF;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700;margin-left:4px">ĐANG LV</span>'
          : (r.trang_thai_o === 'RA_GIUA_CA' ? '<span style="background:#FEF3C7;color:#92400E;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700;margin-left:4px">RA GIỮA</span>' : ''));
      const autoTag = r.nguon === 'AUTO_CLOSE'
        ? ' <span style="background:#F0FDFA;color:#0F766E;padding:1px 6px;border-radius:4px;font-size:9.5px;font-weight:700">AUTO</span>' : '';
      // [#5] Nhãn đội/cơ động theo CHÍNH log này — log thường tại CH chỉ hiện tên CH
      const _teamName = _logSaleTeamName(r);
      let tenCH;
      if (/đội\s*sale/i.test(r.ten_ch_snapshot || '')) {
        tenCH = `<span style="color:#0F766E;font-weight:600">${escHtml(r.ten_ch_snapshot || '')}</span>`;
      } else if (_teamName && r.ten_ch_snapshot) {
        tenCH = `<span style="color:#0F766E;font-weight:600">${escHtml(_teamName)}</span> - ${escHtml(r.ten_ch_snapshot)}`;
      } else {
        tenCH = escHtml(r.ten_ch_snapshot || '');
      }
      return `
        <div class="lscc-item">
          <div class="lscc-item-main">
            <div class="lscc-item-line"><strong>${loaiLabel[r.loai] || r.loai}</strong> <b>${gio}</b>${autoTag} · ${tenCH}</div>
            ${r.ghi_chu ? `<div class="lsd-card-noidung" style="margin-top:4px">${escHtml(r.ghi_chu)}</div>` : ''}
          </div>
          <div class="lscc-item-badges">${xnBadge}${ttoBadge}</div>
        </div>`;
    };

    // [v13.99] Gộp lịch sử chấm công theo NV + ngày (1 dòng/nhóm, xổ ra xem từng lần chấm)
    const _ccOrder = []; const _ccMap = {};
    list.forEach(r => {
      const k = (r.ma_nv || '?') + '|' + (r.ngay || '?');
      if (!_ccMap[k]) { _ccMap[k] = []; _ccOrder.push(k); }
      _ccMap[k].push(r);
    });
    const _isAdminCC = SESSION && (SESSION.vaiTro === 'QLNS' || SESSION.vaiTro === 'ADMIN');
    const _todayStr = _toDateStr(new Date()); // [#1/#2] ngày hôm nay để giới hạn "đang làm việc"

    el.innerHTML = warning + _ccOrder.map(k => {
      const items = _ccMap[k];
      const r0 = items[0];
      const maNV = r0.ma_nv || '';
      const tenNV = r0.ten_nv_snapshot || maNV;
      const ngay = r0.ngay || '';
      const ngayFmt = ngay ? ngay.split('-').reverse().join('/') : '';
      const total = items.length;
      const nKHL = items.filter(r => !_ccIsHopLe(r.xac_nhan)).length;
      const loaiCount = {};
      items.forEach(r => { const l = loaiLabel[r.loai] || r.loai || '—'; loaiCount[l] = (loaiCount[l] || 0) + 1; });
      const chips = Object.keys(loaiCount).map(l =>
        `<span class="lsd-gchip">${escHtml(l)}${loaiCount[l] > 1 ? ' ×' + loaiCount[l] : ''}</span>`).join('');
      const gBadge = nKHL > 0
        ? `<span class="lsd-gbadge lsd-gbadge-no">${nKHL} không hợp lệ</span>`
        : `<span class="lsd-gbadge lsd-gbadge-ok">Hợp lệ</span>`;
      const nv2 = nvMap[maNV];
      const avatarUrl = nv2 && nv2.avatar ? nv2.avatar : '';
      const initial = (tenNV || maNV || '?').trim().charAt(0).toUpperCase();
      const avatarHtml = avatarUrl
        ? `<img class="lscc-avatar" src="${escHtml(avatarUrl)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="lscc-avatar lscc-avatar-fallback" style="display:none">${escHtml(initial)}</div>`
        : `<div class="lscc-avatar lscc-avatar-fallback">${escHtml(initial)}</div>`;
      const gid = 'lscg_' + k.replace(/[^a-zA-Z0-9]/g, '_');
      const gAction = _isAdminCC
        ? `<div class="lsd-group-actions"><button class="lsd-btn-mini lsd-btn-sua" onclick="event.stopPropagation();adm2OpenSuaLog('${maNV}','${ngay}','')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1.5px;margin-right:3px"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>Sửa lịch ngày này</button></div>`
        : '';
      return `
      <div class="lsd-group lscc-group" id="${gid}_wrap">
        <div class="lsd-group-head" onclick="_lsdToggleGroup('${gid}')">
          <div class="lscc-avatar-wrap">${avatarHtml}</div>
          <div class="lsd-group-main">
            <div class="lsd-group-name">${escHtml(tenNV)} <span class="lsd-group-nv">${escHtml(maNV)}</span></div>
            <div class="lsd-group-meta">${ngayFmt} · ${total} lần chấm</div>
            <div class="lsd-group-chips">${chips}</div>
          </div>
          <div class="lsd-group-right">
            ${gBadge}
            <svg class="lsd-group-caret" id="${gid}_caret" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
        ${gAction}
        <div class="lsd-group-body" id="${gid}_body" style="display:none">
          ${items.map((r, _i) => _renderCCItem(r, _i === 0 && ngay === _todayStr)).join('')}
        </div>
      </div>`;
    }).join('');
    if (typeof _lscUpdateActiveCard === 'function') _lscUpdateActiveCard();
  } catch (e) {
    el.innerHTML = `<div class="ns-empty" style="color:#DC2626">Lỗi: ${escHtml(e.message)}</div>`;
  }
}

function lscResetFilter(){
  const today = new Date();
  const w = new Date(today); w.setDate(w.getDate() - 6);
  document.getElementById('lscc-tu').value = _toDateStr(w);
  document.getElementById('lscc-den').value = _toDateStr(today);
  document.getElementById('lscc-loai').value = '';
  document.getElementById('lscc-xn').value = '';
  document.getElementById('lscc-nv').value = '';
  document.getElementById('lscc-ch').value = '';
  window._lscNguonFilter = '';
  _lscUpdateActiveCard();
  taiLichSuCC();
}

// [v10.85] Click stat card → filter
function lscFilterByXN(xn) {
  document.getElementById('lscc-xn').value = xn;
  window._lscNguonFilter = '';
  taiLichSuCC();
  _lscUpdateActiveCard();
}
function lscFilterByNguon(nguon) {
  document.getElementById('lscc-xn').value = '';
  window._lscNguonFilter = nguon;
  taiLichSuCC();
  _lscUpdateActiveCard();
}
function _lscUpdateActiveCard() {
  const xn = document.getElementById('lscc-xn').value;
  const nguon = window._lscNguonFilter || '';
  const map = {
    'tong': (!xn && !nguon),
    'hl': (xn === 'HL'),
    'khl': (xn === 'KHL'),
    'auto': (nguon === 'AUTO_CLOSE')
  };
  Object.keys(map).forEach(k => {
    const card = document.getElementById('lscc-card-' + k);
    if (card) card.classList.toggle('active', map[k]);
  });
}

function lscThemCa(){
  // [v10.85.1] Mở modal có autocomplete (không dùng prompt)
  openAdminThemLog({ maNV: '', ngay: _toDateStr(new Date()), mode: 'add_full' });
}

// ═══ [v10.85.1] MODAL ADMIN THÊM LOG — autocomplete NV + CH ═══
let _atlState = { mode: 'add_log', onSuccess: null };

async function openAdminThemLog(opts) {
  _atlState = { mode: opts.mode || 'add_log', onSuccess: opts.onSuccess || null };

  // Load NV + CH cache nếu chưa có
  if (!window._adminNVList || !window._adminNVList.length) {
    try {
      const { data } = await supa.from('nhan_vien')
        .select('ma_nv, ho_ten, ma_ch_mac_dinh')
        .eq('trang_thai', 'ACTIVE').order('ma_nv');
      window._adminNVList = data || [];
    } catch (e) { window._adminNVList = []; }
  }
  if (!window._bscChList || !window._bscChList.length) {
    try {
      const { data } = await supa.from('cua_hang')
        .select('ma_ch, ten_ch, khu_vuc').eq('trang_thai', 'ĐANG HOẠT ĐỘNG').order('ten_ch');
      if (data) {
        window._bscChList = data;
        window._bscChMap = {};
        data.forEach(ch => { window._bscChMap[ch.ma_ch] = ch.ten_ch; });
      }
    } catch (e) {}
  }

  // Set context label
  const ctxEl = document.getElementById('atl-context');
  if (opts.mode === 'add_log') {
    ctxEl.textContent = `Đang thêm log cho NV này, ngày này (mod sửa lịch). Chỉ chọn giờ + loại + CH.`;
  } else {
    ctxEl.textContent = `Thêm ca thủ công cho 1 NV (admin tổng kiểm).`;
  }

  // Set NV
  const nvInp = document.getElementById('atl-nv-inp');
  const nvHid = document.getElementById('atl-nv');
  if (opts.maNV) {
    nvHid.value = opts.maNV;
    const nv = window._adminNVList.find(n => n.ma_nv === opts.maNV);
    nvInp.value = nv ? `${nv.ho_ten} (${opts.maNV})` : opts.maNV;
    nvInp.disabled = (opts.mode === 'add_log'); // Không cho đổi NV trong mod sửa lịch
    nvInp.style.background = nvInp.disabled ? '#F1F5F9' : '#fff';
  } else {
    nvHid.value = ''; nvInp.value = ''; nvInp.disabled = false; nvInp.style.background = '#fff';
  }

  // Set ngày
  const ngayInp = document.getElementById('atl-ngay');
  ngayInp.value = opts.ngay || _toDateStr(new Date());
  ngayInp.disabled = (opts.mode === 'add_log');
  ngayInp.style.background = ngayInp.disabled ? '#F1F5F9' : '#fff';

  // Reset các field khác
  document.getElementById('atl-gio').value = '08:00';
  document.getElementById('atl-loai').value = 'VAO_CA';
  document.getElementById('atl-ch-inp').value = '';
  document.getElementById('atl-ch').value = '';
  document.getElementById('atl-lydo').value = opts.mode === 'add_log' ? 'Bổ sung log thiếu' : 'Thêm ca thủ công';
  document.getElementById('atl-err').style.display = 'none';

  document.getElementById('admin-themlog-modal').style.display = 'flex';
}

function dongAdminThemLog() {
  document.getElementById('admin-themlog-modal').style.display = 'none';
}

// NV autocomplete
function atlOnNVInput() {
  const inp = document.getElementById('atl-nv-inp');
  if (!inp.value.trim()) document.getElementById('atl-nv').value = '';
  atlShowNVSug();
}
function atlShowNVSug() {
  const inp = document.getElementById('atl-nv-inp');
  const sug = document.getElementById('atl-nv-sug');
  const list = window._adminNVList || [];
  const q = inp.value.trim().toLowerCase();
  let matched;
  if (!q) matched = list.slice(0, 12);
  else matched = list.filter(n =>
    (n.ma_nv || '').toLowerCase().includes(q) ||
    (n.ho_ten || '').toLowerCase().includes(q)
  ).slice(0, 15);
  if (!matched.length) { sug.style.display = 'none'; return; }
  sug.innerHTML = matched.map(n =>
    `<div onmousedown="event.preventDefault();atlPickNV('${n.ma_nv}', \`${(n.ho_ten||'').replace(/`/g,"'")}\`)"
         style="padding:9px 11px;cursor:pointer;font-size:13px;border-bottom:1px solid #F1F5F9"
         onmouseenter="this.style.background='#F8FAFC'" onmouseleave="this.style.background='#fff'">
      <div style="font-weight:600;color:#0F172A">${(n.ho_ten || '').replace(/</g,'&lt;')}</div>
      <div style="font-size:10.5px;color:#64748B;margin-top:2px">${n.ma_nv}${n.ma_ch_mac_dinh ? ' · ' + n.ma_ch_mac_dinh : ''}</div>
    </div>`
  ).join('');
  sug.style.display = 'block';
}
function atlHideNVSug() { setTimeout(()=>{ const s=document.getElementById('atl-nv-sug'); if (s) s.style.display='none'; }, 200); }
function atlPickNV(ma, ten) {
  document.getElementById('atl-nv-inp').value = ten + ' (' + ma + ')';
  document.getElementById('atl-nv').value = ma;
  document.getElementById('atl-nv-sug').style.display = 'none';
}

// CH autocomplete
function atlOnCHInput() {
  const inp = document.getElementById('atl-ch-inp');
  if (!inp.value.trim()) document.getElementById('atl-ch').value = '';
  atlShowCHSug();
}
function atlShowCHSug() {
  const inp = document.getElementById('atl-ch-inp');
  const sug = document.getElementById('atl-ch-sug');
  const list = window._bscChList || [];
  const q = inp.value.trim().toLowerCase();
  let matched;
  if (!q) matched = list.slice(0, 12);
  else matched = list.filter(ch =>
    (ch.ma_ch || '').toLowerCase().includes(q) ||
    (ch.ten_ch || '').toLowerCase().includes(q) ||
    (ch.khu_vuc || '').toLowerCase().includes(q)
  ).slice(0, 15);
  if (!matched.length) { sug.style.display = 'none'; return; }
  sug.innerHTML = matched.map(ch => {
    const isDoi = /đội\s*sale/i.test(ch.ten_ch || '');
    const tagHtml = isDoi ? `<span style="background:#F0FDFA;color:#0F766E;font-size:9.5px;font-weight:700;padding:1px 6px;border-radius:4px;margin-left:6px">ĐỘI</span>` : '';
    return `<div onmousedown="event.preventDefault();atlPickCH('${ch.ma_ch}', \`${(ch.ten_ch||'').replace(/`/g,"'")}\`)"
         style="padding:9px 11px;cursor:pointer;font-size:13px;border-bottom:1px solid #F1F5F9"
         onmouseenter="this.style.background='#F8FAFC'" onmouseleave="this.style.background='#fff'">
      <div style="font-weight:600;color:#0F172A">${(ch.ten_ch || '').replace(/</g,'&lt;')}${tagHtml}</div>
      <div style="font-size:10.5px;color:#64748B;margin-top:2px">${ch.ma_ch}${ch.khu_vuc ? ' · ' + ch.khu_vuc.replace(/</g,'&lt;') : ''}</div>
    </div>`;
  }).join('');
  sug.style.display = 'block';
}
function atlHideCHSug() { setTimeout(()=>{ const s=document.getElementById('atl-ch-sug'); if (s) s.style.display='none'; }, 200); }
function atlPickCH(ma, ten) {
  document.getElementById('atl-ch-inp').value = ten + ' (' + ma + ')';
  document.getElementById('atl-ch').value = ma;
  document.getElementById('atl-ch-sug').style.display = 'none';
  // [v10.85] Nếu chọn Đội SALE → hiện field CH thực
  const isDoi = /đội\s*sale/i.test(ten);
  const wrap = document.getElementById('atl-chthuc-wrap');
  if (wrap) {
    wrap.style.display = isDoi ? '' : 'none';
    if (!isDoi) {
      document.getElementById('atl-chthuc-inp').value = '';
      document.getElementById('atl-chthuc').value = '';
    }
  }
}

// [v10.85] Autocomplete CH thực (loại bỏ các đội sale khỏi gợi ý)
function atlOnCHThucInput() {
  const inp = document.getElementById('atl-chthuc-inp');
  if (!inp.value.trim()) document.getElementById('atl-chthuc').value = '';
  atlShowCHThucSug();
}
function atlShowCHThucSug() {
  const inp = document.getElementById('atl-chthuc-inp');
  const sug = document.getElementById('atl-chthuc-sug');
  const list = (window._bscChList || []).filter(ch => !/đội\s*sale/i.test(ch.ten_ch || ''));
  const q = inp.value.trim().toLowerCase();
  let matched;
  if (!q) matched = list.slice(0, 12);
  else matched = list.filter(ch =>
    (ch.ma_ch || '').toLowerCase().includes(q) ||
    (ch.ten_ch || '').toLowerCase().includes(q) ||
    (ch.khu_vuc || '').toLowerCase().includes(q)
  ).slice(0, 15);
  if (!matched.length) { sug.style.display = 'none'; return; }
  sug.innerHTML = matched.map(ch =>
    `<div onmousedown="event.preventDefault();atlPickCHThuc('${ch.ma_ch}', \`${(ch.ten_ch||'').replace(/`/g,"'")}\`)"
         style="padding:9px 11px;cursor:pointer;font-size:13px;border-bottom:1px solid #F1F5F9"
         onmouseenter="this.style.background='#F8FAFC'" onmouseleave="this.style.background='#fff'">
      <div style="font-weight:600;color:#0F172A">${(ch.ten_ch || '').replace(/</g,'&lt;')}</div>
      <div style="font-size:10.5px;color:#64748B;margin-top:2px">${ch.ma_ch}${ch.khu_vuc ? ' · ' + ch.khu_vuc.replace(/</g,'&lt;') : ''}</div>
    </div>`
  ).join('');
  sug.style.display = 'block';
}
function atlHideCHThucSug() { setTimeout(()=>{ const s=document.getElementById('atl-chthuc-sug'); if (s) s.style.display='none'; }, 200); }
function atlPickCHThuc(ma, ten) {
  document.getElementById('atl-chthuc-inp').value = ten + ' (' + ma + ')';
  document.getElementById('atl-chthuc').value = ma;
  document.getElementById('atl-chthuc-sug').style.display = 'none';
}

async function atlConfirm() {
  const errEl = document.getElementById('atl-err');
  errEl.style.display = 'none';
  const maNV = document.getElementById('atl-nv').value.trim();
  const ngay = document.getElementById('atl-ngay').value;
  const gio = document.getElementById('atl-gio').value;
  const loai = document.getElementById('atl-loai').value;
  const maCH = document.getElementById('atl-ch').value.trim();
  const tenCHChon = document.getElementById('atl-ch-inp').value;
  const lyDo = document.getElementById('atl-lydo').value.trim() || 'Thêm log thủ công';

  if (!maNV) { errEl.textContent = 'Chưa chọn nhân viên'; errEl.style.display='block'; return; }
  if (!ngay) { errEl.textContent = 'Chưa chọn ngày'; errEl.style.display='block'; return; }
  if (!gio) { errEl.textContent = 'Chưa chọn giờ'; errEl.style.display='block'; return; }
  if (!maCH) { errEl.textContent = 'Chưa chọn cửa hàng / đội SALE'; errEl.style.display='block'; return; }

  // [v10.85] Nếu chọn Đội SALE → bắt buộc nhập CH thực
  const isDoi = /đội\s*sale/i.test(tenCHChon);
  let maChFinal = maCH;
  let lyDoFinal = lyDo;
  if (isDoi) {
    const maChThuc = document.getElementById('atl-chthuc').value.trim();
    const tenChThuc = document.getElementById('atl-chthuc-inp').value;
    if (!maChThuc) {
      errEl.textContent = 'Đã chọn Đội SALE — vui lòng chọn cửa hàng NV đang hỗ trợ.';
      errEl.style.display = 'block'; return;
    }
    maChFinal = maChThuc;
    // Tách tên đội từ "Đội SALE 01 (CTV0138)" → "Đội SALE 01"
    const tenDoi = tenCHChon.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const tenChThucClean = tenChThuc.replace(/\s*\([^)]*\)\s*$/, '').trim();
    lyDoFinal = `[${tenDoi}] hỗ trợ ${tenChThucClean} · ` + lyDo;
  }

  const thoiGian = ngay + 'T' + gio + ':00+07:00';
  try {
    const d = await adm2Rpc('fn_admin_them_cham_cong', {
      p_admin: SESSION.ma, p_ma_nv: maNV,
      p_ma_ch: maChFinal, p_thoi_gian: thoiGian,
      p_loai: loai, p_ly_do: lyDoFinal
    });
    if (d && d.success === false) { errEl.textContent = d.error || 'Lỗi'; errEl.style.display='block'; return; }
    adm2Toast('✓ Đã thêm log chấm công', 'success');
    dongAdminThemLog();
    if (_atlState.onSuccess) _atlState.onSuccess();
    if (_nsSubTab === 'lichsucc') taiLichSuCC();
  } catch (e) {
    errEl.textContent = e.message || 'Lỗi';
    errEl.style.display = 'block';
  }
}

// [v8.1] LỊCH SỬ DUYỆT
let _lsdDeb;
function _debLichSuDuyet(){
  clearTimeout(_lsdDeb);
  _lsdDeb = setTimeout(taiLichSuDuyet, 400);
}

// [v10.85 YC#4] Click card stats để filter theo trạng thái
function lsdFilterByStatus(status){
  const sel = document.getElementById('lsd-trangthai');
  if (sel) sel.value = status;
  // Reset bộ lọc loại CB nếu đang lọc theo loại
  const selLoai = document.getElementById('lsd-loaicb');
  if (selLoai) selLoai.value = '';
  taiLichSuDuyet();
}

// [v10.85] Click thẻ "Bổ sung ca" → filter theo loaiCB
function lsdFilterByLoai(loai){
  const sel = document.getElementById('lsd-loaicb');
  if (sel) sel.value = loai;
  // Reset trạng thái
  const selTT = document.getElementById('lsd-trangthai');
  if (selTT) selTT.value = '';
  taiLichSuDuyet();
}

function _lsdUpdateActiveStat(currentStatus){
  // [v10.85] Cân nhắc cả filter loaiCB="BỔ SUNG CA"
  const selLoai = document.getElementById('lsd-loaicb');
  const isBoSung = selLoai && selLoai.value === 'BỔ SUNG CA';
  const ids = {
    '': 'lsd-stat-card-tong',
    'CHO_DUYET': 'lsd-stat-card-chodet',
    'DA_DUYET': 'lsd-stat-card-duyet',
    'TU_CHOI': 'lsd-stat-card-tuchoi'
  };
  Object.values(ids).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });
  const bsEl = document.getElementById('lsd-stat-card-bosung');
  if (bsEl) bsEl.classList.remove('active');
  if (isBoSung) {
    if (bsEl) bsEl.classList.add('active');
  } else {
    const activeId = ids[currentStatus || ''];
    const activeEl = document.getElementById(activeId);
    if (activeEl) activeEl.classList.add('active');
  }
}

// [v13.98] Xổ/thu nhóm cảnh báo (gộp theo NV+ngày)
function _lsdToggleGroup(gid){
  const body = document.getElementById(gid + '_body');
  const caret = document.getElementById(gid + '_caret');
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : '';
  if (caret) caret.style.transform = open ? '' : 'rotate(180deg)';
}

// [v13.98] Duyệt cả nhóm (mọi cảnh báo chờ duyệt của 1 NV trong 1 ngày)
async function adm2DuyetNhom(maNV, ngay){
  const list = window._lsdCachedList || [];
  const isPend = (r) => (r.trangThai === 'CHO_DUYET' || r.trangThai === 'CHUA_GIAI_TRINH' || r.trangThai === 'DA_GIAI_TRINH');
  const pend = list.filter(r => (r.maNV || r.ma_nv) === maNV && r.ngay === ngay && isPend(r));
  if (!pend.length) { showToast('Nhóm không còn cảnh báo chờ duyệt.', 'err'); return; }
  // Còn lỗi SAI CA / THIẾU CA chưa sửa giờ → bắt sửa lịch trước
  const needFix = pend.filter(r => r.loaiCB === 'SAI CA' || r.loaiCB === 'THIẾU CA');
  if (needFix.length) {
    showToast('Còn ' + needFix.length + ' lỗi SAI/THIẾU CA cần sửa giờ trước. Mở sửa lịch…', 'err');
    if (typeof adm2OpenSuaLog === 'function') adm2OpenSuaLog(maNV, ngay, needFix[0].id);
    return;
  }
  const ten = pend[0].tenNV || maNV;
  const ngP = (ngay || '').split('-');
  const ngayFmt = ngP.length === 3 ? ngP[2] + '/' + ngP[1] + '/' + ngP[0] : ngay;
  const ok = await appConfirm(
    'Duyệt tất cả ' + pend.length + ' cảnh báo của ' + ten + ' ngày ' + ngayFmt + '?',
    { title: 'Duyệt nhóm', okLabel: 'Duyệt' }
  );
  if (!ok) return;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const ids = pend.map(r => r.id).filter(id => id && uuidRegex.test(String(id)));
  if (!ids.length) { showToast('Không có ID hợp lệ để duyệt.', 'err'); return; }
  supa.rpc('fn_duyet_batch', {
    p_loai: 'GIAI_TRINH', p_quyet_dinh: 'Duyệt',
    p_ma_nguoi_duyet: SESSION.ma, p_ids: ids, p_ghi_chu_qlns: null
  }).then(async ({ data: res, error }) => {
    if (!error && res && res.success) {
      const c = res.count || 0;
      try { await supa.rpc('fn_tong_hop_ngay', { p_ma_nv: maNV, p_ngay: ngay }); } catch (_) {}
      showToast('✓ Đã duyệt ' + c + '/' + ids.length + ' cảnh báo.', c < ids.length ? 'err' : 'ok');
      if (typeof taiLichSuDuyet === 'function') taiLichSuDuyet();
    } else {
      showToast((res && res.error) || (error && error.message) || 'Lỗi duyệt nhóm.', 'err');
    }
  }).catch(() => showToast('Lỗi kết nối khi duyệt nhóm.', 'err'));
}

async function taiLichSuDuyet(){
  const listEl = document.getElementById('lsd-list');
  if (!listEl) return;
  // [v10.85] Smooth loading: không clear DOM, chỉ giảm opacity
  const isFirstLoad = !listEl.querySelector('.lsd-card');
  if (isFirstLoad) {
    listEl.innerHTML = '<div class="ns-empty" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:30px;color:#94A3B8;font-size:13px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 1s linear infinite"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg><span>Đang tải...</span></div>';
  } else {
    listEl.style.opacity = '0.45';
    listEl.style.transition = 'opacity .15s';
  }

  const today = new Date().toISOString().substring(0,10);
  const ago30 = new Date(Date.now() - 30*86400000).toISOString().substring(0,10);
  const tu  = document.getElementById('lsd-tu').value || ago30;
  const den = document.getElementById('lsd-den').value || today;
  const tt  = document.getElementById('lsd-trangthai').value || null;
  const loai = document.getElementById('lsd-loaicb').value || null;
  const q   = (document.getElementById('lsd-q').value || '').trim();
  // [v10.85 YC#1] Filter NV / CH / Người duyệt
  const maNV0 = (document.getElementById('lsd-nv-ma') && document.getElementById('lsd-nv-ma').value) || null;
  const maCH0 = (document.getElementById('lsd-ch-ma') && document.getElementById('lsd-ch-ma').value) || null;
  const maND = (document.getElementById('lsd-nd-ma') && document.getElementById('lsd-nd-ma').value) || null;

  // [v13.03] Phân quyền theo role:
  //   - NV/CTV: ép maNV = SESSION.ma → chỉ thấy của mình
  //   - CUA_HANG: ép maCH = SESSION.cuaHangMa → chỉ thấy NV thuộc CH
  //   - QLBH/QLNS/ADMIN: giữ nguyên filter user nhập
  // [v13.08] FIX: dùng SESSION trực tiếp (top-level let), KHÔNG dùng window.SESSION
  let maNV = maNV0;
  let maCH = maCH0;
  try {
    const _role = String((SESSION && SESSION.vaiTro) || '').toUpperCase();
    const _isQL = _role === 'QLNS' || _role === 'ADMIN' || _role.startsWith('QLBH');
    if (!_isQL && SESSION) {
      if (_role === 'CUA_HANG') {
        maCH = SESSION.cuaHangMa || maCH;
      } else {
        // NV/CTV: ép theo mã NV của session
        maNV = SESSION.ma;
      }
    }
  } catch(e){}

  if (!document.getElementById('lsd-tu').value)  document.getElementById('lsd-tu').value = tu;
  if (!document.getElementById('lsd-den').value) document.getElementById('lsd-den').value = den;

  try {
    // [v10.85] Đảm bảo NV list đã load để biết đội sale
    if (!_lsdNVList) { await _lsdLoadNVList().catch(()=>{}); }
    // [v13.05] Truyền p_ma_ch để RPC filter server-side — robust hơn client-side
    const { data, error } = await supa.rpc('fn_get_lich_su_duyet', {
      p_tu_ngay: tu, p_den_ngay: den, p_ma_nv: maNV,
      p_nguoi_duyet: maND, p_loai_cb: loai, p_trang_thai: tt,
      p_q: q || null, p_limit: 1000, p_ma_ch: maCH
    });
    if (error || !data) {
      listEl.innerHTML = '<div class="ns-empty" style="color:#DC2626">Lỗi tải: ' + (error?.message || 'không có dữ liệu') + '</div>';
      return;
    }

    let list = data.list || [];

    // [v10.85] Debug: log keys của 1 record để xác định field name
    if (list.length > 0 && !window._lsdDebugged){
      console.log('[LSD DEBUG] Sample record keys:', Object.keys(list[0]), list[0]);
      window._lsdDebugged = true;
    }

    // [v10.85 YC#1] Filter CH client-side — thử nhiều variant field
    if (maCH){
      list = list.filter(r => {
        const ch = r.maCh || r.maCH || r.ma_ch || r.maCuaHang || '';
        return ch === maCH;
      });
    }
    // [v10.85 YC#1+3] Filter Q (giải trình + tên) client-side
    if (q){
      const qLower = q.toLowerCase();
      list = list.filter(r => {
        return (r.giaiTrinh || r.giai_trinh || '').toLowerCase().includes(qLower)
            || (r.noiDung || r.noi_dung || '').toLowerCase().includes(qLower)
            || (r.tenNV || r.ten_nv || r.tenNv || '').toLowerCase().includes(qLower)
            || (r.maNV || r.ma_nv || r.maNv || '').toLowerCase().includes(qLower)
            || (r.ghiChuDuyet || r.ghi_chu_duyet || '').toLowerCase().includes(qLower)
            || (r.tenCH || r.tenCh || r.ten_ch || '').toLowerCase().includes(qLower);
      });
    }
    // [v10.85 YC#1] Sort client-side: mới → cũ (theo ngày + giờ)
    list.sort((a, b) => {
      const dA = (a.ngay || '') + 'T' + (a.gioCham || '00:00');
      const dB = (b.ngay || '') + 'T' + (b.gioCham || '00:00');
      if (dA === dB){
        return String(b.id || '').localeCompare(String(a.id || ''));
      }
      return dB.localeCompare(dA);
    });

    // Cache để xuất Excel
    window._lsdCachedList = list;
    // [v10.85] Build map đội sale từ cham_cong supplement (vì RPC LSD không trả device_info)
    window._doiSaleMap = await _loadDoiSaleMapForRecords(list);

    const stats = data.stats || {};
    document.getElementById('lsd-stat-tong').textContent   = list.length;
    document.getElementById('lsd-stat-duyet').textContent  = list.filter(r => r.trangThai === 'DA_DUYET').length;
    document.getElementById('lsd-stat-tuchoi').textContent = list.filter(r => r.trangThai === 'TU_CHOI').length;
    const choEl = document.getElementById('lsd-stat-chodet');
    let choCount = 0;
    if (choEl) {
      choCount = list.filter(r => r.trangThai === 'CHO_DUYET' || r.trangThai === 'CHUA_GIAI_TRINH' || r.trangThai === 'DA_GIAI_TRINH').length;
      choEl.textContent = choCount;
    }
    // [v10.85] Số bổ sung ca + cập nhật badge nav
    const bosungEl = document.getElementById('lsd-stat-bosung');
    let bosungCount = 0;
    let bosungChoCount = 0;
    if (bosungEl) {
      bosungCount = list.filter(r => r.loaiCB === 'BỔ SUNG CA').length;
      bosungChoCount = list.filter(r => r.loaiCB === 'BỔ SUNG CA' &&
        (r.trangThai === 'CHO_DUYET' || r.trangThai === 'CHUA_GIAI_TRINH' || r.trangThai === 'DA_GIAI_TRINH')).length;
      bosungEl.textContent = bosungCount;
    }
    // Badge trên tab nav (số chờ duyệt tổng)
    const lsdBadge = document.getElementById('lsd-badge');
    if (lsdBadge) {
      if (choCount > 0) { lsdBadge.textContent = choCount; lsdBadge.style.display = ''; }
      else lsdBadge.style.display = 'none';
    }
    // [v10.85 YC#4] Highlight card đang được filter
    _lsdUpdateActiveStat(tt);

    if (!list.length) {
      listEl.innerHTML = '<div class="ns-empty" style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:40px 20px;color:#94A3B8;font-size:13px"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg><span>Không có lịch sử duyệt phù hợp</span></div>';
      return;
    }

    const _isPendCB = (r) => (r.trangThai === 'CHO_DUYET' || r.trangThai === 'CHUA_GIAI_TRINH' || r.trangThai === 'DA_GIAI_TRINH');
    const _renderCBItem = (r) => {
      const ngayParts = (r.ngay||'').split('-');
      const ngayFmt = ngayParts.length===3 ? ngayParts[2]+'/'+ngayParts[1]+'/'+ngayParts[0] : r.ngay;
      const dtDuyet = r.thoiGianDuyet ? new Date(r.thoiGianDuyet) : null;
      const gioDuyet = dtDuyet ? (pad(dtDuyet.getDate())+'/'+pad(dtDuyet.getMonth()+1)+' '+pad(dtDuyet.getHours())+':'+pad(dtDuyet.getMinutes())) : '';

      let ttBadge;
      if (r.trangThai === 'DA_DUYET') {
        ttBadge = '<span class="lsd-badge lsd-badge-ok"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>DUYỆT</span>';
      } else if (r.trangThai === 'TU_CHOI') {
        ttBadge = '<span class="lsd-badge lsd-badge-no"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>TỪ CHỐI</span>';
      } else {
        ttBadge = '<span class="lsd-badge lsd-badge-wait"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>CHỜ DUYỆT</span>';
      }
      const isRequireFix = (r.loaiCB === 'SAI CA' || r.loaiCB === 'THIẾU CA');
      const badgeFix = isRequireFix ? '<span class="lsd-badge-fix">CẦN SỬA GIỜ</span>' : '';
      const noiDung = r.noiDung ? `<div class="lsd-card-noidung">${escHtml(r.noiDung)}</div>` : '';
      const isPending = (r.trangThai === 'CHO_DUYET' || r.trangThai === 'CHUA_GIAI_TRINH' || r.trangThai === 'DA_GIAI_TRINH');
      const isDuyetRoi = (r.trangThai === 'DA_DUYET' || r.trangThai === 'TU_CHOI');
      const isAdmin = SESSION && (SESSION.vaiTro==='QLNS' || SESSION.vaiTro==='ADMIN');
      // [v10.85 V#1] Cho phép sửa lịch CHO MỌI loại + MỌI trạng thái (sau duyệt vẫn sửa được)
      const suaLichBtn = isAdmin
        ? `<button class="lsd-btn-mini lsd-btn-sua" onclick="adm2OpenSuaLog('${r.maNV||r.ma_nv||''}','${r.ngay||''}','${r.id||''}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1.5px;margin-right:3px"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>Sửa lịch</button>` : '';
      const datLaiBtn = (isAdmin && isDuyetRoi)
        ? `<button class="lsd-btn-mini" style="background:#F3F4F6;color:#374151;border:1px solid #D1D5DB" onclick="adm2RevertCanhBao('${r.id}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1.5px;margin-right:3px"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>Đặt lại</button>` : '';
      const actionBtn = isAdmin
        ? `<div class="lsd-card-actions">
             ${suaLichBtn}
             ${isPending ? `<button class="lsd-btn-mini lsd-btn-duyet" onclick="adm2DuyetCanhBao('${r.id}','${r.loaiCB||''}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Duyệt</button>
             <button class="lsd-btn-mini lsd-btn-tuchoi" onclick="adm2TuChoiCanhBao('${r.id}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Từ chối</button>` : ''}
             ${datLaiBtn}
           </div>`
        : '';
      const giaiTrinhBlock = r.giaiTrinh
        ? `<div class="lsd-quote lsd-quote-giai"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#92400E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg><div><strong style="color:#92400E">Giải trình:</strong> ${escHtml(r.giaiTrinh)}</div></div>`
        : '';
      const ghiChuBlock = r.ghiChuDuyet
        ? `<div class="lsd-quote lsd-quote-ghi"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><div><strong>Ghi chú QLNS:</strong> ${escHtml(r.ghiChuDuyet)}</div></div>`
        : '';

      return `
      <div class="lsd-card">
        <div class="lsd-card-head">
          <div style="flex:1;min-width:0">
            <div class="lsd-card-name">${escHtml(r.tenNV||r.maNV)}</div>
            <div class="lsd-card-meta">
              <strong>${escHtml(r.loaiCB||'')}</strong>${badgeFix} · ${ngayFmt} ${r.gioCham||''} · ${_fmtChVoiDoiSale(r.maNV||r.ma_nv, r.tenCH, r.ngay)}
            </div>
            ${noiDung}
          </div>
          ${ttBadge}
        </div>
        ${giaiTrinhBlock}
        ${ghiChuBlock}
        <div class="lsd-card-foot">
          <span>${r.nguoiDuyet ? 'Người duyệt: <strong>'+escHtml(r.nguoiDuyet)+'</strong>' : ''}</span>
          <span>${gioDuyet}</span>
        </div>
        ${actionBtn}
      </div>`;
    };

    // [v13.98] GỘP cảnh báo theo NV + ngày: 1 dòng/nhóm, xổ ra xem chi tiết.
    // Giữ thứ tự list (đã sort mới→cũ) → nhóm có cảnh báo mới nhất nằm trên đầu.
    const _grpOrder = []; const _grpMap = {};
    list.forEach(r => {
      const k = (r.maNV || r.ma_nv || '?') + '|' + (r.ngay || '?');
      if (!_grpMap[k]) { _grpMap[k] = []; _grpOrder.push(k); }
      _grpMap[k].push(r);
    });
    const _isAdminG = SESSION && (SESSION.vaiTro === 'QLNS' || SESSION.vaiTro === 'ADMIN');

    listEl.innerHTML = _grpOrder.map(k => {
      const items = _grpMap[k];
      const r0 = items[0];
      const maNV = r0.maNV || r0.ma_nv || '';
      const tenNV = r0.tenNV || maNV;
      const ngay = r0.ngay || '';
      const ngP = ngay.split('-');
      const ngayFmt = ngP.length === 3 ? ngP[2] + '/' + ngP[1] + '/' + ngP[0] : ngay;
      // Đếm theo loại lỗi → chip
      const loaiCount = {};
      items.forEach(r => { const l = r.loaiCB || '—'; loaiCount[l] = (loaiCount[l] || 0) + 1; });
      const chips = Object.keys(loaiCount).map(l =>
        `<span class="lsd-gchip">${escHtml(l)}${loaiCount[l] > 1 ? ' ×' + loaiCount[l] : ''}</span>`).join('');
      // Trạng thái tổng của nhóm
      const nPend = items.filter(_isPendCB).length;
      const nDuyet = items.filter(r => r.trangThai === 'DA_DUYET').length;
      const nTuChoi = items.filter(r => r.trangThai === 'TU_CHOI').length;
      const total = items.length;
      let gBadge;
      if (nPend > 0) gBadge = `<span class="lsd-gbadge lsd-gbadge-wait">${nPend} chờ duyệt</span>`;
      else if (nTuChoi === total) gBadge = `<span class="lsd-gbadge lsd-gbadge-no">Đã từ chối</span>`;
      else if (nTuChoi > 0) gBadge = `<span class="lsd-gbadge lsd-gbadge-ok">Đã xử lý</span>`;
      else gBadge = `<span class="lsd-gbadge lsd-gbadge-ok">Đã duyệt</span>`;
      const gid = 'lsdg_' + k.replace(/[^a-zA-Z0-9]/g, '_');
      // Nút cấp nhóm (chỉ khi còn cảnh báo chờ duyệt)
      const gActions = (_isAdminG && nPend > 0) ? `
        <div class="lsd-group-actions">
          <button class="lsd-btn-mini lsd-btn-sua" onclick="event.stopPropagation();adm2OpenSuaLog('${maNV}','${ngay}','${r0.id}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1.5px;margin-right:3px"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>Sửa lịch</button>
          <button class="lsd-btn-mini lsd-btn-duyet" onclick="event.stopPropagation();adm2DuyetNhom('${maNV}','${ngay}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Duyệt nhóm</button>
        </div>` : '';
      return `
      <div class="lsd-group" id="${gid}_wrap">
        <div class="lsd-group-head" onclick="_lsdToggleGroup('${gid}')">
          <div class="lsd-group-main">
            <div class="lsd-group-name">${escHtml(tenNV)} <span class="lsd-group-nv">${escHtml(maNV)}</span></div>
            <div class="lsd-group-meta">${ngayFmt} · ${total} cảnh báo</div>
            <div class="lsd-group-chips">${chips}</div>
          </div>
          <div class="lsd-group-right">
            ${gBadge}
            <svg class="lsd-group-caret" id="${gid}_caret" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
        ${gActions}
        <div class="lsd-group-body" id="${gid}_body" style="display:none">
          ${items.map(_renderCBItem).join('')}
        </div>
      </div>`;
    }).join('');
    // [v10.85] Reset opacity sau khi render thành công
    listEl.style.opacity = '1';
  } catch(e) {
    listEl.innerHTML = '<div class="ns-empty" style="color:#DC2626">Lỗi: '+escHtml(e.message)+'</div>';
    listEl.style.opacity = '1';
  }
}

// [v10.85] Lookup đội sale của NV: trả về tên đội nếu NV mặc định thuộc đội sale, null nếu không
function _getDoiSaleNV(maNV) {
  if (!maNV || !_lsdNVList) return null;
  const nv = _lsdNVList.find(n => n.ma_nv === maNV);
  if (!nv || !nv.ma_ch) return null;
  if (typeof CH_LIST === 'undefined' || !CH_LIST) return null;
  const ch = CH_LIST.find(c => c.ma === nv.ma_ch);
  if (!ch || !ch.ten) return null;
  // Tên CH bắt đầu "Đội SALE" → là đội sale
  if (/^\s*đội\s*sale/i.test(ch.ten)) return ch.ten;
  return null;
}

// [v10.85] Format hiển thị CH với prefix đội sale
// Ưu tiên window._doiSaleMap (build từ data thực) → fallback _getDoiSaleNV (NV cố định)
function _fmtChVoiDoiSale(maNV, tenCH, ngay) {
  if (!tenCH) return '';
  // Bản ghi này TẠI Đội SALE → tô tím nguyên tên
  if (/đội\s*sale/i.test(tenCH)) {
    return `<span style="color:#0F766E;font-weight:600">${escHtml(tenCH)}</span>`;
  }
  // Có map từ data thực + ngày → check cùng ngày NV có chấm tại đội nào không
  if (ngay && window._doiSaleMap) {
    const doi = window._doiSaleMap[maNV + ':' + ngay];
    if (doi) return `<span style="color:#0F766E;font-weight:600">${escHtml(doi)}</span> - ${escHtml(tenCH)}`;
  }
  // Fallback: NV có CH mặc định là đội sale (case NV cố định)
  const doi = _getDoiSaleNV(maNV);
  if (doi) return `<span style="color:#0F766E;font-weight:600">${escHtml(doi)}</span> - ${escHtml(tenCH)}`;
  return escHtml(tenCH);
}

// [v10.85] Build map đội sale từ list — gọi sau khi load data và lưu vào window._doiSaleMap
// Detect 3 nguồn:
//   1) ten_ch_snapshot match "Đội SALE XX" (chấm trực tiếp tại đội)
//   2) device_info match "[SALE_ORIGIN:ma|ten]" hoặc "[SALE_TARGET:ma|ten]" (data v9.57+, format CŨ)
//   3) ghi_chu match "[Đội SALE XX] hỗ trợ..." (data v10.78+, format MỚI)
function _buildDoiSaleMap(records) {
  const map = {};
  if (!Array.isArray(records)) return map;
  records.forEach(r => {
    if (!r) return;
    const maNV = r.ma_nv || r.maNV || '';
    const ngay = r.ngay || '';
    if (!maNV || !ngay) return;
    const key = maNV + ':' + ngay;
    if (map[key]) return;
    // 1) ten_ch_snapshot
    const ten = r.ten_ch_snapshot || r.tenCH || '';
    if (/đội\s*sale/i.test(ten)) {
      const m = ten.match(/(đội\s*sale\s*\d+)/i);
      map[key] = m ? m[1].trim() : ten.trim();
      return;
    }
    // 2) device_info format cũ
    const di = r.device_info || r.deviceInfo || '';
    if (di) {
      const mNew = di.match(/\[SALE_ORIGIN:[^|]+\|([^\]]+)\]/i);
      const mOld = di.match(/\[SALE_TARGET:[^|]+\|([^\]]+)\]/i);
      if (mNew) { map[key] = mNew[1].trim(); return; }
      if (mOld) { map[key] = mOld[1].trim(); return; }
    }
    // 3) ghi_chu format mới
    const ghi = r.ghi_chu || r.ghiChu || '';
    if (ghi) {
      // [v16.2] Bắt cả "[Cơ Động]" (không chỉ Đội SALE) → hiển thị ghép "Cơ Động - CH"
      const m = ghi.match(/\[((?:đội\s*sale|cơ\s*động|co\s*dong)[^\]]*)\]/i);
      if (m) map[key] = m[1].trim();
    }
  });
  return map;
}

// [v10.85] Query supplement cham_cong để build doiMap đầy đủ (có device_info)
// Dùng cho các page mà RPC trả về không có sẵn device_info (LSD, CB, log NV)
async function _loadDoiSaleMapForRecords(records) {
  if (!Array.isArray(records) || !records.length) return {};
  const uniqueNV = [...new Set(records.map(r => r.ma_nv || r.maNV).filter(Boolean))];
  const ngayList = records.map(r => r.ngay).filter(Boolean).sort();
  if (!uniqueNV.length || !ngayList.length) return _buildDoiSaleMap(records);
  const minNgay = ngayList[0];
  const maxNgay = ngayList[ngayList.length - 1];
  try {
    const { data } = await supa.from('cham_cong')
      .select('ma_nv, ngay, ten_ch_snapshot, ghi_chu, device_info')
      .in('ma_nv', uniqueNV)
      .gte('ngay', minNgay)
      .lte('ngay', maxNgay)
      .limit(5000);
    return _buildDoiSaleMap(data || []);
  } catch (e) {
    return _buildDoiSaleMap(records);
  }
}

// ════════════════════════════════════════════════════════════════════════
// [v10.85 YC#1] AUTOCOMPLETE FILTERS cho tab Lịch sử duyệt
// ════════════════════════════════════════════════════════════════════════

// Cache danh sách NV để autocomplete (lazy load)
let _lsdNVList = null;
async function _lsdLoadNVList(){
  if (_lsdNVList) return _lsdNVList;
  try {
    // [v10.85] Thêm avatar_url để hiển thị ảnh đại diện trong các card
    const { data, error } = await supa.from('nhan_vien')
      .select('ma_nv, ho_ten, role, ma_ch_mac_dinh, avatar_url')
      .order('ho_ten', { ascending: true });
    if (error || !data) {
      console.warn('[_lsdLoadNVList] Lỗi:', error?.message);
      return [];
    }
    // Normalize về { ma_nv, ten_nv, role, ma_ch, avatar } để code phía sau dùng nhất quán
    _lsdNVList = data.map(r => ({
      ma_nv: r.ma_nv,
      ten_nv: r.ho_ten || r.ma_nv,
      role: r.role || 'NV',
      ma_ch: r.ma_ch_mac_dinh || '',
      avatar: r.avatar_url || ''
    }));
    console.log('[_lsdLoadNVList] Loaded', _lsdNVList.length, 'NV');
    return _lsdNVList;
  } catch(e){
    console.warn('[_lsdLoadNVList] Exception:', e.message);
    return [];
  }
}

// [v10.85] Load danh sách quản lý từ bảng quan_ly riêng (sheet "DANH SÁCH QUẢN LÝ")
let _lsdQLList = null;
async function _lsdLoadQLList(){
  if (_lsdQLList) return _lsdQLList;
  try {
    const { data, error } = await supa.from('quan_ly')
      .select('ma_ql, ho_ten, role, trang_thai')
      .order('ho_ten', { ascending: true });
    if (error || !data) {
      console.warn('[_lsdLoadQLList] Lỗi:', error?.message);
      return [];
    }
    // Chỉ lấy quản lý đang ACTIVE (nếu có cột trang_thai)
    _lsdQLList = data.filter(r => !r.trang_thai || r.trang_thai === 'ACTIVE');
    console.log('[_lsdLoadQLList] Loaded', _lsdQLList.length, 'quản lý');
    return _lsdQLList;
  } catch(e){
    console.warn('[_lsdLoadQLList] Exception:', e.message);
    return [];
  }
}

// NV input handlers
function lsdOnNVInput(){
  const inp = document.getElementById('lsd-nv-inp');
  const hid = document.getElementById('lsd-nv-ma');
  if (!inp.value.trim()){ hid.value = ''; taiLichSuDuyet(); }
  lsdShowNVSuggest();
}
async function lsdShowNVSuggest(){
  const inp = document.getElementById('lsd-nv-inp');
  const sug = document.getElementById('lsd-nv-sug');
  if (!inp || !sug) return;
  const list = await _lsdLoadNVList();
  const q = inp.value.trim().toLowerCase();
  let matched;
  if (!q){
    matched = list.slice(0, 8);
  } else {
    matched = list.filter(nv =>
      (nv.ma_nv || '').toLowerCase().includes(q) || (nv.ten_nv || '').toLowerCase().includes(q)
    ).slice(0, 10);
  }
  if (!matched.length){ sug.style.display = 'none'; return; }
  sug.innerHTML = matched.map(nv =>
    `<div onmousedown="event.preventDefault();lsdPickNV('${nv.ma_nv}','${(nv.ten_nv||'').replace(/'/g,"\\'")}')"
       style="padding:8px 10px;cursor:pointer;font-size:12px;border-bottom:1px solid #F1F5F9"
       onmouseenter="this.style.background='#F8FAFC'" onmouseleave="this.style.background='#fff'">
      <div style="font-weight:600;color:#0F172A">${nv.ten_nv || ''}</div>
      <div style="font-size:10.5px;color:#64748B">${nv.ma_nv || ''}${nv.role && nv.role!=='NV' ? ' · '+nv.role : ''}</div>
    </div>`
  ).join('');
  sug.style.display = 'block';
}
function lsdHideNVSuggest(){
  setTimeout(()=>{const s=document.getElementById('lsd-nv-sug'); if(s) s.style.display='none';}, 200);
}
function lsdPickNV(ma, ten){
  document.getElementById('lsd-nv-inp').value = ten + ' (' + ma + ')';
  document.getElementById('lsd-nv-ma').value = ma;
  document.getElementById('lsd-nv-sug').style.display = 'none';
  taiLichSuDuyet();
}

// CH input handlers — dùng CH_LIST có sẵn
function lsdOnCHInput(){
  const inp = document.getElementById('lsd-ch-inp');
  const hid = document.getElementById('lsd-ch-ma');
  if (!inp.value.trim()){ hid.value = ''; taiLichSuDuyet(); }
  lsdShowCHSuggest();
}
function lsdShowCHSuggest(){
  const inp = document.getElementById('lsd-ch-inp');
  const sug = document.getElementById('lsd-ch-sug');
  if (!inp || !sug) return;
  const list = (typeof CH_LIST !== 'undefined' && CH_LIST) ? CH_LIST : [];
  const q = inp.value.trim().toLowerCase();
  let matched;
  if (!q) matched = list.slice(0, 8);
  else matched = list.filter(ch =>
    (ch.ma || '').toLowerCase().includes(q) || (ch.ten || '').toLowerCase().includes(q)
  ).slice(0, 10);
  if (!matched.length){ sug.style.display = 'none'; return; }
  sug.innerHTML = matched.map(ch =>
    `<div onmousedown="event.preventDefault();lsdPickCH('${ch.ma}','${(ch.ten||'').replace(/'/g,"\\'")}')"
       style="padding:8px 10px;cursor:pointer;font-size:12px;border-bottom:1px solid #F1F5F9"
       onmouseenter="this.style.background='#F8FAFC'" onmouseleave="this.style.background='#fff'">
      <div style="font-weight:600;color:#0F172A">${ch.ten || ''}</div>
      <div style="font-size:10.5px;color:#64748B">${ch.ma || ''}</div>
    </div>`
  ).join('');
  sug.style.display = 'block';
}
function lsdHideCHSuggest(){
  setTimeout(()=>{const s=document.getElementById('lsd-ch-sug'); if(s) s.style.display='none';}, 200);
}
function lsdPickCH(ma, ten){
  document.getElementById('lsd-ch-inp').value = ten + ' (' + ma + ')';
  document.getElementById('lsd-ch-ma').value = ma;
  document.getElementById('lsd-ch-sug').style.display = 'none';
  taiLichSuDuyet();
}

// Người duyệt input handlers — filter chỉ QLNS/ADMIN
function lsdOnNDInput(){
  const inp = document.getElementById('lsd-nd-inp');
  const hid = document.getElementById('lsd-nd-ma');
  if (!inp.value.trim()){ hid.value = ''; taiLichSuDuyet(); }
  lsdShowNDSuggest();
}
async function lsdShowNDSuggest(){
  const inp = document.getElementById('lsd-nd-inp');
  const sug = document.getElementById('lsd-nd-sug');
  if (!inp || !sug) return;
  // [v10.85] Người duyệt từ bảng quan_ly (không phải nhan_vien)
  const list = await _lsdLoadQLList();
  const q = inp.value.trim().toLowerCase();
  let matched;
  if (!q) matched = list.slice(0, 8);
  else matched = list.filter(ql =>
    (ql.ma_ql || '').toLowerCase().includes(q) || (ql.ho_ten || '').toLowerCase().includes(q)
  ).slice(0, 10);
  if (!matched.length){ sug.style.display = 'none'; return; }
  sug.innerHTML = matched.map(ql =>
    `<div onmousedown="event.preventDefault();lsdPickND('${ql.ma_ql}','${(ql.ho_ten||'').replace(/'/g,"\\'")}')"
       style="padding:8px 10px;cursor:pointer;font-size:12px;border-bottom:1px solid #F1F5F9"
       onmouseenter="this.style.background='#F8FAFC'" onmouseleave="this.style.background='#fff'">
      <div style="font-weight:600;color:#0F172A">${ql.ho_ten || ''}</div>
      <div style="font-size:10.5px;color:#64748B">${ql.ma_ql || ''} · ${ql.role || ''}</div>
    </div>`
  ).join('');
  sug.style.display = 'block';
}
function lsdHideNDSuggest(){
  setTimeout(()=>{const s=document.getElementById('lsd-nd-sug'); if(s) s.style.display='none';}, 200);
}
function lsdPickND(ma, ten){
  document.getElementById('lsd-nd-inp').value = ten + ' (' + ma + ')';
  document.getElementById('lsd-nd-ma').value = ma;
  document.getElementById('lsd-nd-sug').style.display = 'none';
  taiLichSuDuyet();
}

function lsdResetFilters(){
  const today = new Date().toISOString().substring(0,10);
  const ago30 = new Date(Date.now() - 30*86400000).toISOString().substring(0,10);
  document.getElementById('lsd-tu').value = ago30;
  document.getElementById('lsd-den').value = today;
  document.getElementById('lsd-trangthai').value = '';
  document.getElementById('lsd-loaicb').value = '';
  document.getElementById('lsd-q').value = '';
  document.getElementById('lsd-nv-inp').value = '';
  document.getElementById('lsd-nv-ma').value = '';
  document.getElementById('lsd-ch-inp').value = '';
  document.getElementById('lsd-ch-ma').value = '';
  document.getElementById('lsd-nd-inp').value = '';
  document.getElementById('lsd-nd-ma').value = '';
  taiLichSuDuyet();
}

// Xuất CSV (mở Excel được, không cần thư viện)
function lsdExportExcel(){
  const list = window._lsdCachedList || [];
  if (!list.length){
    showToast('Không có dữ liệu để xuất.', 'err');
    return;
  }
  const headers = ['Ngày','Mã NV','Tên NV','CH chấm','Tên CH','Loại CB','Trạng thái','Giải trình','Người duyệt','Thời gian duyệt'];
  const rows = list.map(r => [
    r.ngay || '',
    r.maNv || '',
    r.tenNv || '',
    r.maCh || r.maCH || '',
    r.tenCh || r.tenCH || '',
    r.loaiCb || r.loai || '',
    r.trangThai || '',
    (r.giaiTrinh || '').replace(/\n/g,' ').replace(/"/g,'""'),
    r.maNguoiDuyet || r.tenNguoiDuyet || '',
    r.thoiGianDuyet || ''
  ]);
  const csv = [headers, ...rows].map(row =>
    row.map(cell => '"' + String(cell).replace(/"/g,'""') + '"').join(',')
  ).join('\n');
  // UTF-8 BOM để Excel mở tiếng Việt không bị lỗi
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'lich-su-duyet-' + new Date().toISOString().substring(0,10) + '.csv';
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{document.body.removeChild(a); URL.revokeObjectURL(url);}, 100);
  showToast('✓ Đã xuất ' + list.length + ' dòng.', 'ok');
}

// Nạp danh sách đơn nghỉ phép
function taiDonNghiPhep(){
  const listEl=document.getElementById('dnp-list');
  if(!listEl)return;
  listEl.innerHTML='<div class="dnp-empty">⏳ Đang tải đơn...</div>';
  const tt=document.getElementById('dnp-f-tt')?.value||'';
  const q=document.getElementById('dnp-f-search')?.value?.trim()||'';
  const [dnpTu,dnpDen]=_getDNPRange();
  // [v12-P3] Supabase RPC
  // [v13.10] CH chỉ thấy đơn của NV thuộc CH mình — filter server-side
  const _maCHFilter = (SESSION && SESSION.vaiTro === 'CUA_HANG') ? (SESSION.cuaHangMa || null) : null;
  supa.rpc('fn_get_don_nghi_list', {
    p_trang_thai: tt || null,
    p_tu_ngay: dnpTu, p_den_ngay: dnpDen,
    p_q: q || null,
    p_ma_ch: _maCHFilter
  }).then(({ data: res, error }) => {
    if(error || !res){listEl.innerHTML='<div class="dnp-empty">❌ Lỗi tải.</div>';return;}
    // Adapt RPC → Apps Script format
    const ds = res.danhSach || [];
    const map = {};
    ds.forEach(d => {
      if(!map[d.ngayNghi]) map[d.ngayNghi] = [];
      map[d.ngayNghi].push({
        id: d.id, maNV: d.maNV, tenNV: d.tenNV,
        maCH: d.maCH || '', tenCH: d.cuaHang || '', khuVuc: d.khuVuc,
        ngay: d.ngayNghi, loaiNghi: d.loaiNghi, lyDo: d.lyDo,
        anhUrl: d.anhUrl, trangThai: d.trangThai,
        ghiChuQLNS: d.ghiChuQLNS, nguoiDuyet: d.nguoiDuyet,
        createdAt: d.createdAt
      });
    });
    const theoDon = Object.keys(map).sort().reverse().map(ngay => ({
      ngay,
      danhSach: map[ngay],
      soDon: map[ngay].length,
      soChoDuyet: map[ngay].filter(x => x.trangThai === 'Chờ duyệt').length
    }));
    _dnpData = { tongChoDuyet: res.tongChoDuyet || 0, theoDon, theoNV: [], dsDon: ds };
    const cho=_dnpData.tongChoDuyet||0;
    const badge=document.getElementById('dnp-badge');
    if(badge){badge.textContent=cho>0?String(cho):'';badge.style.display=cho>0?'flex':'none';}
    const bnr=document.getElementById('ns-donnghi-banner');
    const bnrCnt=document.getElementById('ns-donnghi-count');
    if(bnr&&bnrCnt){
      if(cho>0){bnrCnt.textContent=cho;bnr.style.display='flex';}
      else bnr.style.display='none';
    }
    const tongCanXuLy=(nsCBList?nsCBList.length:0)+cho;
    _capNhatBadgeNS(tongCanXuLy);
    renderDonNghiPhep();
  }).catch((e)=>{listEl.innerHTML='<div class="dnp-empty">❌ Lỗi: '+(e.message||e)+'</div>';});
}

function renderDonNghiPhep(){
  const listEl=document.getElementById('dnp-list');
  if(!_dnpData||!listEl)return;
  // [v10.85 YC#5] Gộp đơn nghỉ liên tục của cùng NV
  const dsDon = _dnpData.dsDon || [];
  if(!dsDon.length){listEl.innerHTML='<div class="dnp-empty"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:0 auto 8px"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Không có đơn nào.</div>';return;}
  // Sort theo maNV + ngayNghi
  const sorted = [...dsDon].sort((a,b)=>{
    if(a.maNV !== b.maNV) return a.maNV.localeCompare(b.maNV);
    return (a.ngayNghi||a.ngay||'').localeCompare(b.ngayNghi||b.ngay||'');
  });
  // Build groups: cùng maNV + ngày liên tục + cùng trạng thái + cùng lý do
  const groups = [];
  const _dateDiff = (a, b) => {
    const dA = new Date(a + 'T00:00:00');
    const dB = new Date(b + 'T00:00:00');
    return Math.round((dB - dA) / 86400000);
  };
  for (const d of sorted){
    const ngay = d.ngayNghi || d.ngay;
    const last = groups[groups.length - 1];
    if (last
        && last.maNV === d.maNV
        && last.trangThai === d.trangThai
        && (last.lyDo || '') === (d.lyDo || '')
        && _dateDiff(last.ngayKetThuc, ngay) === 1){
      // Gộp vào group hiện tại
      last.ngayKetThuc = ngay;
      last.soNgay += 1;
      last.danhSach.push(d);
    } else {
      groups.push({
        maNV: d.maNV,
        tenNV: d.tenNV,
        cuaHang: d.cuaHang || '',
        khuVuc: d.khuVuc || '',
        trangThai: d.trangThai,
        lyDo: d.lyDo || '',
        anhUrl: d.anhUrl || '',
        ghiChuQLNS: d.ghiChuQLNS || '',
        nguoiDuyet: d.nguoiDuyet || '',
        ngayBatDau: ngay,
        ngayKetThuc: ngay,
        soNgay: 1,
        danhSach: [d]
      });
    }
  }
  // Sort groups: ngày bắt đầu mới nhất lên trước
  groups.sort((a,b) => (b.ngayBatDau||'').localeCompare(a.ngayBatDau||''));
  const dow2=['CN','T2','T3','T4','T5','T6','T7'];
  const fmtNgay2 = (s) => {
    const d = new Date(s + 'T00:00:00');
    return dow2[d.getDay()] + ' ' + pad(d.getDate()) + '/' + pad(d.getMonth()+1);
  };
  // [v10.85 YC#4] Nhóm theo ngày bắt đầu để có header lớn
  const byDay = {};
  groups.forEach(g => {
    if (!byDay[g.ngayBatDau]) byDay[g.ngayBatDau] = [];
    byDay[g.ngayBatDau].push(g);
  });
  const dayKeys = Object.keys(byDay).sort().reverse();
  listEl.innerHTML = dayKeys.map(ngay => {
    const d = new Date(ngay + 'T00:00:00');
    const ngayHeader = dow2[d.getDay()] + ', ' + pad(d.getDate()) + '/' + pad(d.getMonth()+1) + '/' + d.getFullYear();
    const groupsInDay = byDay[ngay];
    const soDon = groupsInDay.length;
    const soCho = groupsInDay.filter(g => g.trangThai === 'Chờ duyệt').length;
    const itemsHtml = groupsInDay.map(g => {
      const badgeCls = g.trangThai==='Đã duyệt'?'dnpb-da':g.trangThai==='Từ chối'?'dnpb-tc':'dnpb-cho';
      const lyDoTxt = g.lyDo || '';
      const linkAnh = g.anhUrl || '';
      const timeLabel = g.soNgay === 1
        ? fmtNgay2(g.ngayBatDau)
        : `<span style="color:#0F6E56;font-weight:700">${fmtNgay2(g.ngayBatDau)} → ${fmtNgay2(g.ngayKetThuc)}</span> <span style="background:#E0F2F1;color:#0F6E56;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;margin-left:4px">${g.soNgay} ngày</span>`;
      const ids = g.danhSach.map(x => x.id).filter(Boolean);
      const actionsHtml = g.trangThai === 'Chờ duyệt' ? `
        <div class="dnp-actions" style="margin-top:8px">
          <button class="dnp-btn-ok" onclick="duyetGopDonNghi('${ids.join(',')}','Đã duyệt')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px"><polyline points="20 6 9 17 4 12"/></svg>Duyệt${g.soNgay>1?' cả '+g.soNgay+' ngày':''}</button>
          <button class="dnp-btn-no" onclick="duyetGopDonNghi('${ids.join(',')}','Từ chối')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Từ chối</button>
        </div>` : '';
      const qlnsNote = g.ghiChuQLNS ? `<div class="dnp-qlns-note">💬 ${g.ghiChuQLNS}</div>` : '';
      const nguoiDuyetInfo = (g.trangThai!=='Chờ duyệt' && g.nguoiDuyet)
        ? `<div style="font-size:11px;color:var(--text-m);margin-top:5px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Người duyệt: ${g.nguoiDuyet}</div>` : '';
      return `<div class="dnp-item" style="background:#fff;border:1px solid #E5E7EB;border-radius:10px;padding:12px;margin-bottom:8px">
        <div class="dnp-item-top" style="display:flex;align-items:flex-start;gap:10px">
          ${_renderAvatar(g.maNV, g.tenNV, 40)}
          <div class="dnp-info" style="flex:1;min-width:0">
            <div class="dnp-name" style="font-size:14px;font-weight:600;color:#0F172A">${g.tenNV} <span style="font-size:11px;font-weight:400;color:var(--text-m)">${g.maNV}</span></div>
            <div style="font-size:12.5px;color:#334155;margin-top:4px">${timeLabel}</div>
            <div class="dnp-sub" style="font-size:11.5px;color:var(--text-m);margin-top:3px">${g.cuaHang || g.khuVuc || ''}</div>
          </div>
          <span class="dnp-badge ${badgeCls}">${g.trangThai}</span>
        </div>
        ${lyDoTxt?`<div class="dnp-lydo" style="margin-top:8px"><div class="dnp-lydo-lbl">Lý do</div>${lyDoTxt}</div>`:''}
        ${linkAnh?`<div onclick="window.open('${linkAnh}','_blank')" class="dnp-anh-btn"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>Xem ảnh</div>`:''}
        ${nguoiDuyetInfo}
        ${qlnsNote}
        ${actionsHtml}
      </div>`;
    }).join('');
    return `<div class="dnp-day-group">
      <div class="dnp-day-head" style="display:flex;align-items:center;gap:8px;padding:8px 4px 8px 4px;font-size:13px;font-weight:700;color:#0F172A">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <span style="flex:1">${ngayHeader}</span>
        <span style="font-size:11.5px;font-weight:600;color:#64748B">${soDon} đơn${soCho>0?' · <span style="color:#F59E0B">'+soCho+' chờ</span>':''}</span>
      </div>
      ${itemsHtml}
    </div>`;
  }).join('');
  // [v10.8] Toggle bulk bar theo số đơn Chờ duyệt
  const soCho = (_dnpData.dsDon||[]).filter(d=>d.trangThai==='Chờ duyệt').length;
  const bulkBar  = document.getElementById('dnp-bulk-bar');
  const bulkCnt  = document.getElementById('dnp-bulk-count');
  if(bulkBar) bulkBar.style.display = soCho>0 ? 'flex' : 'none';
  if(bulkCnt) bulkCnt.textContent = soCho;
}

// [v10.8] Duyệt tất cả cảnh báo giải trình đang hiển thị trong page Nhân sự
// Chỉ duyệt các CB ĐÃ GIẢI TRÌNH (eligible) — backend chấp nhận dạng CB_DUYET/CB_KHONG_DUYET
async function duyetTatCaCBNS(action){
  // Lọc CB đã giải trình trong danh sách đang hiển thị (áp filter NS hiện tại)
  const q = (nsSearchQ||'').toLowerCase().trim();
  const kv = nsKhuVucFilter;
  const daGT = nsCBList.filter(cb=>{
    if(!cb.giaiTrinh) return false;
    if(kv){
      const nv = nsData.find(n=>n.ma===cb.maNV);
      if(!nv || nv.khuVuc!==kv) return false;
    }
    if(q){
      const nv = nsData.find(n=>n.ma===cb.maNV) || {cuaHang:'',khuVuc:''};
      if(nsSuggestType==='kv') { if(!nv.khuVuc.toLowerCase().includes(q)) return false; }
      else if(nsSuggestType==='ch') { if(!nv.cuaHang.toLowerCase().includes(q)) return false; }
      else {
        if(!cb.maNV.toLowerCase().includes(q) && !cb.tenNV.toLowerCase().includes(q) &&
           !nv.cuaHang.toLowerCase().includes(q) && !nv.khuVuc.toLowerCase().includes(q)) return false;
      }
    }
    return true;
  });
  if(!daGT.length){showToast('Không có cảnh báo đã giải trình để duyệt.','err');return;}
  const qd = action==='ok' ? 'Duyệt' : 'Không duyệt';
  const verb = action==='ok' ? 'duyệt' : 'từ chối';
  // [v11.4 NS-03b] Thay confirm() native bằng appConfirm app-style
  const ok = await appConfirm(
    `${verb} tất cả ${daGT.length} cảnh báo đã giải trình?\nBạn có thể Hoàn tác trong 24h.`,
    { title: `${qd} hàng loạt`, okLabel: qd, danger: action!=='ok' }
  );
  if(!ok) return;
  // Mờ các row đang xử lý
  daGT.forEach(cb=>{
    const row=document.getElementById('cb-row-'+cb.cbRowIdx);
    if(row) row.classList.add('duyet-processing');
  });
  // [v9.45 BUG-FIX] Chỉ gửi UUID hợp lệ. Field id thật: cb.id (mới) HOẶC cb.cbRowIdx (legacy nếu là UUID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const cbIds = daGT
    .map(cb => cb.id || cb.cbRowIdx)
    .filter(id => id && uuidRegex.test(String(id)));
  
  console.log('[Duyệt batch CB] eligible:', daGT.length, 'valid UUID:', cbIds.length, 'samples:', cbIds.slice(0,3));
  
  // Cảnh báo nếu có items không có UUID hợp lệ
  if (cbIds.length < daGT.length) {
    const missing = daGT.length - cbIds.length;
    console.warn(`[Duyệt batch CB] ${missing} cảnh báo không có UUID hợp lệ — sẽ không được duyệt`);
  }
  
  if (cbIds.length === 0) {
    showToast('Không có ID hợp lệ để duyệt. Vui lòng tải lại trang.', 'err');
    daGT.forEach(cb=>{
      const row=document.getElementById('cb-row-'+cb.cbRowIdx);
      if(row) row.classList.remove('duyet-processing');
    });
    return;
  }
  
  // [v12-P3] Supabase RPC
  supa.rpc('fn_duyet_batch', {
    p_loai: 'GIAI_TRINH',
    p_quyet_dinh: qd,
    p_ma_nguoi_duyet: SESSION.ma,
    p_ids: cbIds,
    p_ghi_chu_qlns: null
  }).then(({ data: res, error }) => {
    if(!error && res && res.success){
      // [v9.45 BUG-FIX] Kiểm tra count thực tế — cảnh báo nếu mismatch
      const actualCount = res.count || 0;
      const expectedCount = cbIds.length;
      let msg = `✓ Đã ${verb} ${actualCount}/${expectedCount} cảnh báo.`;
      let toastType = 'ok';
      if (actualCount < expectedCount) {
        msg += ` (${expectedCount - actualCount} không thể xử lý)`;
        toastType = 'err';
      }
      showToast(msg, toastType);
      if(typeof taiNhanSu==='function') taiNhanSu(true); // force refresh
      _silentUpdateAccBadges();
    } else {
      daGT.forEach(cb=>{
        const row=document.getElementById('cb-row-'+cb.cbRowIdx);
        if(row) row.classList.remove('duyet-processing');
      });
      console.error('[Duyệt batch CB] lỗi:', error, res);
      showToast((res&&res.error)||(error&&error.message)||'Lỗi batch.','err');
    }
  }).catch((err)=>{
    daGT.forEach(cb=>{
      const row=document.getElementById('cb-row-'+cb.cbRowIdx);
      if(row) row.classList.remove('duyet-processing');
    });
    console.error('[Duyệt batch CB] catch:', err);
    showToast('Lỗi kết nối.','err');
  });
}

// [v10.8] Duyệt tất cả đơn nghỉ phép trong sub-tab Nhân sự
async function duyetTatCaDonNghiNS(action){
  if(!_dnpData)return;
  const items = (_dnpData.dsDon||[]).filter(d=>d.trangThai==='Chờ duyệt');
  if(!items.length){showToast('Không có đơn chờ duyệt.','err');return;}
  const qd = action==='ok' ? 'Đã duyệt' : 'Từ chối';
  const verb = action==='ok' ? 'duyệt' : 'từ chối';
  // [v11.4 NS-03b]
  const ok = await appConfirm(
    `${verb} tất cả ${items.length} đơn nghỉ phép đang chờ?\nBạn có thể Hoàn tác trong 24h.`,
    { title: `${action==='ok'?'Duyệt':'Từ chối'} hàng loạt`, okLabel: action==='ok'?'Duyệt':'Từ chối', danger: action!=='ok' }
  );
  if(!ok) return;
  let ghiChuQLNS='';
  if(action==='no'){
    ghiChuQLNS=prompt('Lý do từ chối chung (áp dụng cho tất cả):');
    if(!ghiChuQLNS)return;
  }
  document.querySelectorAll('#dnp-list .dnp-item').forEach(el=>el.classList.add('duyet-processing'));
  const bulkBar=document.getElementById('dnp-bulk-bar');
  if(bulkBar) bulkBar.style.opacity='.5';
  // [v9.45 BUG-FIX] Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const ids = items.map(it => it.id).filter(id => id && uuidRegex.test(String(id)));
  
  console.log('[Duyệt batch DN] expected:', items.length, 'valid UUID:', ids.length);
  
  if (!ids.length) {
    if(bulkBar) bulkBar.style.opacity='1';
    document.querySelectorAll('#dnp-list .dnp-item').forEach(el=>el.classList.remove('duyet-processing'));
    showToast('Không tìm thấy đơn hợp lệ để duyệt. Vui lòng tải lại trang.','err');
    return;
  }
  (async () => {
    const { data: res, error } = await supa.rpc('fn_duyet_batch', {
      p_loai: 'DON_NGHI',
      p_quyet_dinh: qd,
      p_ma_nguoi_duyet: SESSION.ma,
      p_ids: ids,
      p_ghi_chu_qlns: ghiChuQLNS || null
    });
    if(bulkBar) bulkBar.style.opacity='1';
    if(!error && res && res.success){
      // [v9.45 BUG-FIX] Check count thực vs expected
      const actualCount = res.count || 0;
      let msg = `✓ Đã ${verb} ${actualCount}/${ids.length} đơn.`;
      let toastType = 'ok';
      if (actualCount < ids.length) {
        msg += ` (${ids.length - actualCount} không thể xử lý)`;
        toastType = 'err';
      }
      showToast(msg, toastType);
      taiDonNghiPhep();
      _silentUpdateAccBadges();
    } else {
      document.querySelectorAll('#dnp-list .dnp-item').forEach(el=>el.classList.remove('duyet-processing'));
      const errMsg = (res&&(res.error||res.errors))||(error&&error.message)||'Lỗi batch.';
      showToast(String(errMsg).substring(0,200),'err');
      console.error('[duyet batch DN] err:', { res, error });
    }
  })().catch((e)=>{
    console.error('[duyet batch DN] catch', e);
    if(bulkBar) bulkBar.style.opacity='1';
    document.querySelectorAll('#dnp-list .dnp-item').forEach(el=>el.classList.remove('duyet-processing'));
    showToast('Lỗi kết nối: ' + (e.message||''),'err');
  });
}

// QLNS duyệt đơn nghỉ phép — [v11.6 Item 1] Fire-and-forget
// [v10.85 YC#5] Duyệt nhiều đơn cùng lúc (gộp)
async function duyetGopDonNghi(idsStr, quyetDinh){
  if(typeof _canQuanLyNS==='function' && !_canQuanLyNS()){ if(typeof showToast==='function') showToast('Chỉ QLNS hoặc Admin mới được duyệt','warn'); return; }
  const ids = String(idsStr || '').split(',').filter(Boolean);
  if (!ids.length){ showToast('Không có đơn để duyệt', 'err'); return; }
  let ghiChuQLNS = '';
  if (quyetDinh === 'Từ chối'){
    ghiChuQLNS = prompt('Lý do từ chối cả ' + ids.length + ' ngày nghỉ?') || '';
    if (!ghiChuQLNS) return;
  }
  showToast('Đang duyệt ' + ids.length + ' đơn...', 'ok');
  let okCnt = 0, errCnt = 0;
  for (const id of ids){
    try {
      const { data: res, error } = await supa.rpc('fn_duyet_don_nghi', {
        p_id: id,
        p_quyet_dinh: quyetDinh,
        p_ma_nguoi_duyet: SESSION.ma,
        p_ghi_chu: ghiChuQLNS || null
      });
      if (error || !res || !res.success) errCnt++;
      else okCnt++;
    } catch(e){ errCnt++; }
  }
  if (errCnt === 0){
    showToast('✓ Đã ' + (quyetDinh === 'Đã duyệt' ? 'duyệt' : 'từ chối') + ' ' + okCnt + ' đơn', 'ok');
  } else {
    showToast('⚠ ' + okCnt + ' OK, ' + errCnt + ' lỗi', 'warn');
  }
  _silentUpdateAccBadges();
  taiDonNghiPhep();
}

function duyetDonNP(maNV, ngay, tuan, quyetDinh){
  const ghiChuEl=document.getElementById(`dnp-note-inp-${maNV}-${ngay}`);
  let ghiChuQLNS=ghiChuEl?ghiChuEl.value.trim():'';
  if(quyetDinh==='Từ chối' && !ghiChuQLNS){
    ghiChuQLNS=prompt('Lý do từ chối đơn này?');
    if(!ghiChuQLNS)return;
  }
  const itemEl=document.getElementById(`dnp-item-${maNV}-${ngay}`);

  // [v11.6 Item 1] Update UI NGAY
  if(itemEl){
    const badge=itemEl.querySelector('.dnp-badge');
    if(badge){
      badge.classList.remove('dnpb-cho');
      badge.classList.add(quyetDinh==='Đã duyệt' ? 'dnpb-da' : 'dnpb-tc');
      badge.textContent = quyetDinh;
    }
    const noteWrap = itemEl.querySelector('.dnp-note-wrap');
    const actions = itemEl.querySelector('.dnp-actions');
    if(noteWrap) noteWrap.style.display='none';
    if(actions) actions.style.display='none';
    if(ghiChuQLNS){
      const noteHtml = `<div class="dnp-qlns-note">💬 ${ghiChuQLNS.replace(/</g,'&lt;')}</div>`;
      if(actions) actions.insertAdjacentHTML('beforebegin', noteHtml);
      else itemEl.insertAdjacentHTML('beforeend', noteHtml);
    }
    // Update số "chờ" trong day-head
    const dayGrp = itemEl.closest('.dnp-day-group');
    if(dayGrp){
      const dayCntEl = dayGrp.querySelector('.dnp-day-cnt');
      if(dayCntEl){
        const txt = dayCntEl.textContent || '';
        const match = txt.match(/(\d+)\s*chờ/);
        if(match){
          const newCho = Math.max(0, parseInt(match[1]) - 1);
          dayCntEl.textContent = txt.replace(/(\d+)\s*chờ/, newCho > 0 ? newCho+' chờ' : '');
          if(newCho === 0) dayCntEl.textContent = dayCntEl.textContent.replace(/\s*·\s*$/, '');
        }
      }
    }
  }
  showToast(quyetDinh==='Đã duyệt'?'✓ Đã duyệt':'✗ Đã từ chối', 'ok');

  // [v12-P3] Supabase RPC - cần lấy id đơn từ ma_nv + ngay
  (async () => {
    const { data: dn, error: e1 } = await supa.from('don_nghi')
      .select('id').eq('ma_nv', maNV).eq('ngay_nghi', ngay)
      .limit(1).maybeSingle();
    if (e1 || !dn) { showToast('⚠ Không tìm thấy đơn để duyệt', 'warn'); return; }
    const { data: res, error } = await supa.rpc('fn_duyet_don_nghi', {
      p_id: dn.id,
      p_quyet_dinh: quyetDinh,
      p_ma_nguoi_duyet: SESSION.ma,
      p_ghi_chu: ghiChuQLNS || null
    });
    if(error || !res || !res.success){
      showToast('⚠ ' + ((res && res.error) || (error && error.message) || 'Server lỗi'), 'warn');
    } else {
      _silentUpdateAccBadges();
    }
  })().catch(()=>{
    showToast('⚠ Mất kết nối - đang đồng bộ', 'warn');
  });
}

// Build filter khu vực cho đơn nghỉ phép — không còn dùng dropdown, giữ để tương thích
function _buildDNPKVFilter(){ /* deprecated v9 — đã thay bằng ô search */ }

// Badge lịch cho NV khi QLNS từ chối [polling nhẹ]
function _capNhatBadgeLich(so){
  const badge=document.getElementById('lc-nav-badge');
  if(!badge)return;
  if(so>0){badge.textContent=so>99?'99+':String(so);badge.style.display='flex';}
  else badge.style.display='none';
}
