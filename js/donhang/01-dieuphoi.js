/* ════════════════════════════════════════════════════════════════════════
 *  PHÂN HỆ ĐƠN HÀNG ONLINE — MÀN ĐIỀU PHỐI  [v13.44]
 *  Tái dùng: CH_LIST (cua_hang có sẵn lat/lng) + OSRM (router.project-osrm.org)
 *  Geocode địa chỉ khách: Nominatim (OSM, miễn phí).
 *  Backend: dh_fn_tao_don + dh_fn_dieu_phoi (đã có ở SQL v1.2).
 * ════════════════════════════════════════════════════════════════════════ */

let dhLastCHRanked = [];    // CH đã xếp hạng sau OSRM
let dhCHChecked    = new Set(); // [v13.80] mã CH đang được chọn để gửi
let dhKhachLatLng  = null;  // tọa độ khách (geocode)

// Quyền truy cập phân hệ: live = mọi người; demo = CHỈ NS00490 (admin khác cũng chặn)
window._dhCanAccess = function(){
  const cheDo = _getSetting('donhang.che_do', 'demo');
  if (cheDo === 'live') return true;
  return (typeof SESSION !== 'undefined' && SESSION && SESSION.ma === 'NS00490');
};

// ─── Init khi vào page ──────────────────────────────────────────────────
window.dhDieuPhoiInit = function(){
  if (!_dhCanAccess()) {
    if (typeof showToast === 'function') showToast('Phân hệ đang chạy thử — chỉ tài khoản NS00490', 'warn');
    goToPage('home'); return;
  }
  const cheDo = _getSetting('donhang.che_do', 'demo');
  // Nhãn DEMO/LIVE
  const tag = document.getElementById('dh-demo-tag');
  if (tag) {
    if (cheDo === 'live') { tag.textContent = 'LIVE'; tag.classList.add('dh-tag-live'); }
    else { tag.textContent = 'DEMO'; tag.classList.remove('dh-tag-live'); }
  }
  dhResetForm();
  dhEnsureSanPham();   // nạp danh sách SP cho autocomplete (tái dùng engine bán hàng)
  dhLoadTinh();        // nạp danh sách tỉnh/thành cho địa chỉ phân cấp
};

function dhResetForm(){
  dhLastCHRanked = [];
  dhCHChecked    = new Set();
  dhKhachLatLng  = null;
  dhSelectedSp   = null;
  ['dh-khach-ten','dh-khach-sdt','dh-diachi','dh-addr-street','dh-sp-search','dh-sp-ck','dh-addr-tinh','dh-addr-huyen','dh-addr-xa']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  // [v13.79] reset trạng thái địa chỉ autocomplete
  dhSelTinh = null; dhSelHuyen = null; dhSelXa = null; dhHuyenList = []; dhXaList = [];
  const hi = document.getElementById('dh-addr-huyen'); if (hi) hi.disabled = true;
  const xi = document.getElementById('dh-addr-xa'); if (xi) xi.disabled = true;
  ['dh-addr-tinh-dd','dh-addr-huyen-dd','dh-addr-xa-dd'].forEach(id => { const el=document.getElementById(id); if(el){ el.innerHTML=''; el.classList.remove('on'); } });
  const sl = document.getElementById('dh-sp-sl'); if (sl) sl.value = '1';
  if (typeof dhRenderSpChosen === 'function') dhRenderSpChosen();
  const mb = document.getElementById('dh-money-box'); if (mb) mb.style.display='none';
  const pttt = document.getElementById('dh-pttt'); if (pttt) pttt.value = 'COD';
  const qr = document.getElementById('dh-qr-box'); if (qr) qr.style.display = 'none';
  const ac = document.getElementById('dh-sp-aclist'); if (ac){ ac.classList.remove('on'); ac.innerHTML=''; }
  const box = document.getElementById('dh-ch-list'); if (box) box.innerHTML = '';
  const sw = document.getElementById('dh-send-wrap'); if (sw) sw.style.display = 'none';
  const bt = document.getElementById('dh-btn-tim'); if (bt) { bt.disabled = false; bt.textContent = 'AI gợi ý cửa hàng'; }
}

// ─── Geocode địa chỉ khách (Nominatim, miễn phí) ────────────────────────
async function dhGeocode(diaChi){
  const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=vn&q='
            + encodeURIComponent(diaChi);
  try {
    const r = await fetch(url, { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(9000) });
    const data = await r.json();
    if (Array.isArray(data) && data.length) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name };
    }
  } catch(e){}
  return null;
}

// ─── Haversine (đường chim bay, km) ─────────────────────────────────────
function dhHaversine(lat1,lng1,lat2,lng2){
  const R = 6371, toR = Math.PI/180;
  const dLat = (lat2-lat1)*toR, dLng = (lng2-lng1)*toR;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*toR)*Math.cos(lat2*toR)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ─── OSRM khoảng cách di chuyển 1 CH (km) — null nếu lỗi ─────────────────
async function dhOSRM(fromLat,fromLng,toLat,toLng){
  const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=false&alternatives=false`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const d = await r.json();
    if (d.code === 'Ok' && d.routes && d.routes[0]) return d.routes[0].distance / 1000;
  } catch(e){}
  return null;
}

// ─── Tìm cửa hàng: geocode → haversine lọc thô → OSRM top 15 ─────────────
window.dhTimCuaHang = async function(){
  const diaChi = (document.getElementById('dh-diachi').value || '').trim();
  if (!diaChi) { showToast && showToast('Nhập địa chỉ khách trước', 'warn'); return; }
  if (typeof CH_LIST === 'undefined' || !CH_LIST || !CH_LIST.length) { showToast && showToast('Chưa tải được danh sách cửa hàng — thử lại sau giây lát', 'warn'); return; }

  const btn = document.getElementById('dh-btn-tim');
  const box = document.getElementById('dh-ch-list');
  if (btn){ btn.disabled = true; btn.textContent = 'AI đang phân tích...'; }
  box.innerHTML = '<div class="dh-loading">Đang định vị địa chỉ khách...</div>';

  // 1) Geocode khách (thông minh, fallback nhiều cấp)
  const geo = await dhGeocodeSmart();
  if (!geo) {
    box.innerHTML = '<div class="dh-empty">Không tìm được tọa độ địa chỉ này. Thử ghi rõ hơn: số nhà, đường, phường, tỉnh/thành.</div>';
    if (btn){ btn.disabled = false; btn.textContent = 'AI gợi ý cửa hàng'; }
    return;
  }
  dhKhachLatLng = { lat: geo.lat, lng: geo.lng };

  // 2) Haversine tới mọi CH có tọa độ → lấy 15 gần nhất
  const near = CH_LIST
    .filter(ch => ch.lat && ch.lng && !isNaN(parseFloat(ch.lat)) && !isNaN(parseFloat(ch.lng)))
    .map(ch => ({
      ma: ch.ma, ten: ch.ten,
      lat: parseFloat(ch.lat), lng: parseFloat(ch.lng),
      chim_bay: dhHaversine(geo.lat, geo.lng, parseFloat(ch.lat), parseFloat(ch.lng))
    }))
    .sort((a,b) => a.chim_bay - b.chim_bay)
    .slice(0, 15);

  if (!near.length) {
    box.innerHTML = '<div class="dh-empty">Không có cửa hàng nào có tọa độ để điều phối.</div>';
    if (btn){ btn.disabled = false; btn.textContent = 'AI gợi ý cửa hàng'; }
    return;
  }

  // 2b) Nếu có barcode: ưu tiên CH CÒN HÀNG, sắp theo gần nhất.
  //     Lấy MỌI cửa hàng còn hàng (không bó hẹp trong 15 CH gần) rồi mới sắp khoảng cách.
  let candidate = near;
  const barcode = (dhSelectedSp && dhSelectedSp.maVach) ? String(dhSelectedSp.maVach).trim() : '';
  if (barcode) {
    try {
      const { data: tk } = await supa.rpc('dh_fn_ch_con_hang', { p_barcode: barcode });
      if (Array.isArray(tk) && tk.length) {
        const conHang = {};
        tk.forEach(x => { conHang[String(x.ma_ch).trim()] = x.ton; });
        const conHangGan = CH_LIST
          .filter(ch => conHang[String(ch.ma).trim()] != null
                     && ch.lat && ch.lng && !isNaN(parseFloat(ch.lat)) && !isNaN(parseFloat(ch.lng)))
          .map(ch => ({
            ma: ch.ma, ten: ch.ten,
            lat: parseFloat(ch.lat), lng: parseFloat(ch.lng),
            ton: conHang[String(ch.ma).trim()],
            chim_bay: dhHaversine(geo.lat, geo.lng, parseFloat(ch.lat), parseFloat(ch.lng))
          }))
          .sort((a,b) => a.chim_bay - b.chim_bay)
          .slice(0, 15);
        if (conHangGan.length) {
          candidate = conHangGan;
        } else {
          // Còn hàng nhưng các CH đó chưa có toạ độ → không chặn, vẫn hiện CH gần
          candidate = near;
        }
      }
      // tk rỗng → SP chưa có dữ liệu tồn → giữ tất cả CH gần
    } catch(e){}
  }

  box.innerHTML = '<div class="dh-loading">Đang tính khoảng cách di chuyển ' + candidate.length + ' cửa hàng...</div>';

  // 3) OSRM cho các CH ứng viên (song song)
  await Promise.all(candidate.map(async ch => { ch.di_chuyen = await dhOSRM(geo.lat, geo.lng, ch.lat, ch.lng); }));

  // Xếp hạng: ưu tiên di chuyển, fallback chim bay
  candidate.forEach(ch => { ch.km_sort = (ch.di_chuyen != null ? ch.di_chuyen : ch.chim_bay); });
  candidate.sort((a,b) => a.km_sort - b.km_sort);

  dhLastCHRanked = candidate;
  dhRenderCHList(candidate);
  if (btn){ btn.disabled = false; btn.textContent = 'Gợi ý lại'; }
};

// ─── Render danh sách CH + đánh dấu đợt 1 (bán kính +Nkm) ────────────────
function dhRenderCHList(list){
  const banKinh = parseFloat(_getSetting('donhang.ban_kinh_km', 2)) || 2;
  const nguong  = list[0].km_sort + banKinh;
  // [v13.80] mặc định chọn sẵn CH trong bán kính (đợt 1); khách có thể tick thêm / bỏ
  dhCHChecked = new Set(list.filter(ch => ch.km_sort <= nguong + 0.001).map(ch => ch.ma));
  dhPaintCHList(list);
}
function dhPaintCHList(list){
  const banKinh = parseFloat(_getSetting('donhang.ban_kinh_km', 2)) || 2;
  const nguong  = list[0].km_sort + banKinh;
  let html = '';
  list.forEach((ch) => {
    const gan    = ch.km_sort <= nguong + 0.001;
    const checked= dhCHChecked.has(ch.ma);
    const kmTxt  = ch.di_chuyen != null ? ch.di_chuyen.toFixed(1) + ' km' : '~' + ch.chim_bay.toFixed(1) + ' km';
    const loai   = ch.di_chuyen != null ? 'di chuyển' : 'đường thẳng';
    html += `
      <div class="dh-ch-card ${checked ? 'dh-ch-on' : ''}" onclick="dhToggleCH('${escHtml(ch.ma)}')">
        <div class="dh-ch-chk ${checked?'on':''}">${checked?'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>':''}</div>
        <div class="dh-ch-info">
          <div class="dh-ch-ten">${escHtml(ch.ten || ch.ma)}</div>
          <div class="dh-ch-sub">${escHtml(ch.ma)} · ${loai}${ch.ton!=null?(' · còn '+ch.ton):''}</div>
        </div>
        <div class="dh-ch-km">
          <div class="dh-ch-km-num">${kmTxt}</div>
          ${gan ? '<div class="dh-ch-dot1-tag">gần</div>' : '<div class="dh-ch-wait">xa hơn</div>'}
        </div>
      </div>`;
  });
  document.getElementById('dh-ch-list').innerHTML = html;
  dhUpdateSendBtn();
}
window.dhToggleCH = function(ma){
  if (dhCHChecked.has(ma)) dhCHChecked.delete(ma); else dhCHChecked.add(ma);
  if (dhLastCHRanked.length) dhPaintCHList(dhLastCHRanked);
};
function dhUpdateSendBtn(){
  const sw = document.getElementById('dh-send-wrap');
  const gb = document.getElementById('dh-btn-gui');
  const n = dhCHChecked.size;
  if (sw) sw.style.display = 'block';
  if (gb) { gb.disabled = (n === 0); gb.textContent = n > 0 ? ('Gửi yêu cầu đến ' + n + ' cửa hàng') : 'Chọn ít nhất 1 cửa hàng'; }
}

// ─── Gửi yêu cầu: tạo đơn + điều phối đợt 1 ─────────────────────────────
window.dhGuiYeuCau = async function(){
  if (!dhLastCHRanked.length) { showToast && showToast('Chưa có cửa hàng để gửi', 'warn'); return; }
  const diaChi  = (document.getElementById('dh-diachi').value || '').trim();
  if (!diaChi) { showToast && showToast('Cần địa chỉ giao', 'warn'); return; }
  if (!dhSelectedSp) { showToast && showToast('Chọn sản phẩm trước', 'warn'); return; }
  if (!dhKhachLatLng) { showToast && showToast('Bấm Tìm cửa hàng trước', 'warn'); return; }

  const khachTen = (document.getElementById('dh-khach-ten').value || '').trim();
  const khachSdt = (document.getElementById('dh-khach-sdt').value || '').trim();
  const spTen    = dhSelectedSp.ten || '';
  const spBar    = dhSelectedSp.maVach || '';
  const spSku    = dhSelectedSp.sku || '';
  const gia      = dhGiaSp(dhSelectedSp);
  const soLuong  = parseInt(document.getElementById('dh-sp-sl').value || '1') || 1;
  const chietKhau= parseFloat((document.getElementById('dh-sp-ck').value || '0').replace(/[^\d.]/g,'')) || 0;
  const giaTri   = Math.max(0, gia*soLuong - chietKhau);
  const pttt     = document.getElementById('dh-pttt').value || 'COD';
  const addrTinh = dhAddrText('dh-addr-tinh');
  const addrXa   = dhAddrText('dh-addr-xa');
  const addrConLai = [ (document.getElementById('dh-addr-street').value||'').trim(), dhAddrText('dh-addr-huyen') ].filter(Boolean).join(', ');

  const dot1 = dhLastCHRanked
    .filter(ch => dhCHChecked.has(ch.ma))
    .map(ch => ({ ma_ch: ch.ma, ten_ch: ch.ten, km: +(ch.km_sort.toFixed(2)) }));
  if (!dot1.length) { showToast && showToast('Chọn ít nhất 1 cửa hàng', 'warn'); return; }

  const btn = document.getElementById('dh-btn-gui');
  if (btn) { btn.disabled = true; btn.textContent = 'Đang gửi...'; }

  try {
    const tao = await supa.rpc('dh_fn_tao_don', {
      p_khach_ten: khachTen, p_khach_sdt: khachSdt,
      p_dia_chi_full: diaChi, p_dia_chi_tinh: addrTinh||null, p_dia_chi_xa: addrXa||null, p_dia_chi_con_lai: addrConLai||null,
      p_khach_lat: dhKhachLatLng.lat, p_khach_lng: dhKhachLatLng.lng,
      p_sp_barcode: spBar, p_sp_ten: spTen, p_sp_size: spSku,
      p_so_luong: soLuong, p_gia_tri: giaTri,
      p_tu_van_ma: SESSION.ma, p_tu_van_ten: SESSION.ten,
      p_phuong_thuc_tt: pttt, p_nguon: 'WEB', p_is_demo: true
    });
    if (tao.error) throw tao.error;
    const res = tao.data;
    if (!res || !res.ok) throw new Error((res && res.error) || 'Lỗi tạo đơn');

    const dp = await supa.rpc('dh_fn_dieu_phoi', { p_don_id: res.id, p_danh_sach: dot1, p_dot: 1 });
    if (dp.error) throw dp.error;

    showToast && showToast('Đã gửi đến ' + dot1.length + ' cửa hàng · Đơn ' + res.ma_don, 'success');
    if (pttt === 'SEPAY') { dhShowSepayWait(res.id, giaTri, khachSdt, res.ma_don); }
    else { dhResetForm(); }
  } catch(e) {
    showToast && showToast('Lỗi: ' + (e.message || e), 'error');
    if (btn) btn.disabled = false;
  }
};

/* ════════════════════════════════════════════════════════════════════════
 *  [v13.61] NÂNG CẤP: autocomplete sản phẩm + địa chỉ phân cấp + thành tiền
 * ════════════════════════════════════════════════════════════════════════ */
let dhSelectedSp = null;   // sản phẩm đã chọn (object từ BH.spList)
let dhAcItems    = [];     // kết quả gợi ý hiện tại
let dhTinhList   = [];     // danh sách tỉnh/thành
let dhHuyenList  = [];     // [v13.79] huyện của tỉnh đang chọn
let dhXaList     = [];     // [v13.79] xã của huyện đang chọn
let dhSelTinh = null, dhSelHuyen = null, dhSelXa = null; // [v13.79] {code,name} đã chọn

function dhFmtTien(n){ n = Math.round(n||0); return n.toLocaleString('vi-VN') + 'đ'; }
function dhGiaSp(sp){ return (sp && sp.giaSale>0) ? sp.giaSale : (sp ? sp.giaNY : 0); }

// ─── Sản phẩm: nạp danh sách (tái dùng engine phiên bán hàng) ───
async function dhEnsureSanPham(){
  if (typeof BH !== 'undefined' && BH.spList && BH.spList.length) return;
  if (typeof bhLoadSpData === 'function') {
    try { await bhLoadSpData(); } catch(e){ console.warn('[DH] load SP:', e); }
  }
}

window.dhSpSearch = function(q){
  const box = document.getElementById('dh-sp-aclist');
  if (!box) return;
  q = (q||'').trim();
  if (q.length < 1) { box.classList.remove('on'); box.innerHTML=''; return; }
  let res = [];
  if (typeof bhSearchSpLocal === 'function') res = bhSearchSpLocal(q, 12) || [];
  dhAcItems = res;
  if (!res.length) {
    box.innerHTML = '<div class="dh-ac-empty">Không tìm thấy sản phẩm phù hợp</div>';
    box.classList.add('on'); return;
  }
  box.innerHTML = res.map((sp,i)=>`
    <div class="dh-ac-item" onclick="dhSpPick(${i})">
      <div class="dh-ac-info">
        <div class="dh-ac-ten">${escHtml(sp.ten||'')}</div>
        <div class="dh-ac-meta">${escHtml(sp.maCu||'')}${sp.sku?(' · '+escHtml(sp.sku)):''}${sp.maVach?(' · '+escHtml(sp.maVach)):''}</div>
      </div>
      <div class="dh-ac-gia">${dhFmtTien(dhGiaSp(sp))}</div>
    </div>`).join('');
  box.classList.add('on');
};

window.dhSpPick = function(i){
  const sp = dhAcItems[i]; if (!sp) return;
  dhSelectedSp = sp;
  const box = document.getElementById('dh-sp-aclist');
  if (box){ box.classList.remove('on'); box.innerHTML=''; }
  const srch = document.getElementById('dh-sp-search'); if (srch) srch.value = '';
  dhRenderSpChosen();
  dhCalcTien();
};

function dhRenderSpChosen(){
  const wrap = document.getElementById('dh-sp-chosen');
  if (!wrap) return;
  if (!dhSelectedSp){ wrap.innerHTML=''; return; }
  const sp = dhSelectedSp;
  wrap.innerHTML = `<div class="dh-sp-card">
    <button class="dh-sp-card-x" onclick="dhSpClear()" aria-label="Bỏ">×</button>
    <div class="dh-sp-card-tt">${escHtml(sp.ten||'')}</div>
    <div class="dh-sp-card-meta">${escHtml(sp.maCu||'')}${sp.sku?(' · SKU '+escHtml(sp.sku)):''} · ${dhFmtTien(dhGiaSp(sp))}</div>
  </div>`;
}

window.dhSpClear = function(){ dhSelectedSp = null; dhRenderSpChosen(); dhCalcTien(); };

window.dhCalcTien = function(){
  const box = document.getElementById('dh-money-box');
  if (!dhSelectedSp){ if (box) box.style.display='none'; if (typeof dhUpdateQR==='function') dhUpdateQR(); return; }
  const gia = dhGiaSp(dhSelectedSp);
  const sl = parseInt(document.getElementById('dh-sp-sl').value||'1')||1;
  const ck = parseFloat((document.getElementById('dh-sp-ck').value||'0').replace(/[^\d.]/g,''))||0;
  const total = Math.max(0, gia*sl - ck);
  document.getElementById('dh-m-gia').textContent = dhFmtTien(gia);
  document.getElementById('dh-m-sl').textContent = '×'+sl;
  document.getElementById('dh-m-ck').textContent = '−'+dhFmtTien(ck);
  document.getElementById('dh-m-total').textContent = dhFmtTien(total);
  if (box) box.style.display='block';
  if (typeof dhUpdateQR==='function') dhUpdateQR();
};

// ─── Địa chỉ: phân cấp Tỉnh → Huyện → Xã (provinces.open-api.vn, miễn phí) ───
function _dhNorm(s){ return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').trim(); }
function _dhAddrShowDD(ddId, items, pickFn){
  const dd = document.getElementById(ddId);
  if (!dd) return;
  if (!items.length) { dd.classList.remove('on'); dd.innerHTML=''; return; }
  dd.innerHTML = items.slice(0,3).map(it=>`<div class="dh-addr-dd-it" onclick="${pickFn}(${it.code})">${escHtml(it.name)}</div>`).join('');
  dd.classList.add('on');
}
async function dhLoadTinh(){
  if (dhTinhList.length) return;
  try {
    const r = await fetch('https://provinces.open-api.vn/api/p/', { signal: AbortSignal.timeout(9000) });
    dhTinhList = await r.json();
  } catch(e){ console.warn('[DH] load tỉnh:', e); }
}
window.dhAddrTinhInput = function(kw){
  if (!dhTinhList.length) { dhLoadTinh().then(()=>dhAddrTinhInput(kw)); return; }
  const low = _dhNorm(kw);
  const items = low ? dhTinhList.filter(t=>_dhNorm(t.name).includes(low)) : dhTinhList;
  _dhAddrShowDD('dh-addr-tinh-dd', items, 'dhPickTinh');
};
window.dhPickTinh = async function(code){
  const t = dhTinhList.find(x=>x.code==code); if(!t) return;
  dhSelTinh = {code:t.code, name:t.name};
  document.getElementById('dh-addr-tinh').value = t.name;
  document.getElementById('dh-addr-tinh-dd').classList.remove('on');
  dhSelHuyen = null; dhSelXa = null; dhHuyenList = []; dhXaList = [];
  const hi=document.getElementById('dh-addr-huyen'); if(hi){ hi.value=''; hi.disabled=false; }
  const xi=document.getElementById('dh-addr-xa'); if(xi){ xi.value=''; xi.disabled=true; }
  dhAddrCompose();
  try {
    const r = await fetch(`https://provinces.open-api.vn/api/p/${code}?depth=2`, { signal: AbortSignal.timeout(9000) });
    const d = await r.json(); dhHuyenList = d.districts||[];
  } catch(e){ console.warn('[DH] load huyện:', e); }
};
window.dhAddrHuyenInput = function(kw){
  const low = _dhNorm(kw);
  const items = low ? dhHuyenList.filter(h=>_dhNorm(h.name).includes(low)) : dhHuyenList;
  _dhAddrShowDD('dh-addr-huyen-dd', items, 'dhPickHuyen');
};
window.dhPickHuyen = async function(code){
  const h = dhHuyenList.find(x=>x.code==code); if(!h) return;
  dhSelHuyen = {code:h.code, name:h.name};
  document.getElementById('dh-addr-huyen').value = h.name;
  document.getElementById('dh-addr-huyen-dd').classList.remove('on');
  dhSelXa = null; dhXaList = [];
  const xi=document.getElementById('dh-addr-xa'); if(xi){ xi.value=''; xi.disabled=false; }
  dhAddrCompose();
  try {
    const r = await fetch(`https://provinces.open-api.vn/api/d/${code}?depth=2`, { signal: AbortSignal.timeout(9000) });
    const d = await r.json(); dhXaList = d.wards||[];
  } catch(e){ console.warn('[DH] load xã:', e); }
};
window.dhAddrXaInput = function(kw){
  const low = _dhNorm(kw);
  const items = low ? dhXaList.filter(x=>_dhNorm(x.name).includes(low)) : dhXaList;
  _dhAddrShowDD('dh-addr-xa-dd', items, 'dhPickXa');
};
window.dhPickXa = function(code){
  const x = dhXaList.find(w=>w.code==code); if(!x) return;
  dhSelXa = {code:x.code, name:x.name};
  document.getElementById('dh-addr-xa').value = x.name;
  document.getElementById('dh-addr-xa-dd').classList.remove('on');
  dhAddrCompose();
};
function dhAddrText(selId){
  if (selId === 'dh-addr-tinh') return dhSelTinh ? dhSelTinh.name : '';
  if (selId === 'dh-addr-huyen') return dhSelHuyen ? dhSelHuyen.name : '';
  if (selId === 'dh-addr-xa') return dhSelXa ? dhSelXa.name : '';
  return '';
}
window.dhAddrCompose = function(){
  const street = (document.getElementById('dh-addr-street').value||'').trim();
  const parts = [street, dhSelXa?dhSelXa.name:'', dhSelHuyen?dhSelHuyen.name:'', dhSelTinh?dhSelTinh.name:''].filter(Boolean);
  const ta = document.getElementById('dh-diachi');
  if (ta) ta.value = parts.join(', ');
};

// Đóng dropdown gợi ý khi chạm ra ngoài
document.addEventListener('click', function(e){
  const w = e.target.closest('.dh-ac-wrap');
  if (!w) { const box = document.getElementById('dh-sp-aclist'); if (box) box.classList.remove('on'); }
  const aw = e.target.closest('.dh-addr-ac');
  if (!aw) { ['dh-addr-tinh-dd','dh-addr-huyen-dd','dh-addr-xa-dd'].forEach(id=>{ const d=document.getElementById(id); if(d) d.classList.remove('on'); }); }
}, true);

/* ════════════════════════════════════════════════════════════════════════
 *  [v13.64] GEOCODE THÔNG MINH — fallback nhiều cấp cho địa chỉ VN
 *  Nominatim yếu với địa chỉ chi tiết (số nhà, "Phường 6", "Quận ...").
 *  → thử lần lượt: đường+quận+tỉnh → quận+tỉnh → raw → tỉnh. Bỏ tiền tố.
 * ════════════════════════════════════════════════════════════════════════ */
function dhCleanPart(s){
  return String(s||'').replace(/^(Thành phố|Thanh pho|TP\.?|Tỉnh|Quận|Huyện|Phường|Xã|Thị xã|Thị trấn)\s+/i,'').trim();
}
function dhStreetName(s){
  // Bỏ số nhà đầu: "44 Nguyễn Văn Dung" → "Nguyễn Văn Dung"; "12/3 Lê Lợi" → "Lê Lợi"
  return String(s||'').replace(/^[\d]+[\/\d\w]*\s+/,'').trim();
}
async function dhGeocodeSmart(){
  const tinh   = dhCleanPart(dhAddrText('dh-addr-tinh'));
  const huyen  = dhCleanPart(dhAddrText('dh-addr-huyen'));
  const street = dhStreetName((document.getElementById('dh-addr-street')||{}).value || '');
  const raw    = (document.getElementById('dh-diachi').value || '').trim();
  const queries = [];
  if (street && huyen && tinh) queries.push(`${street}, ${huyen}, ${tinh}, Vietnam`);
  if (huyen && tinh)           queries.push(`${huyen}, ${tinh}, Vietnam`);
  if (raw)                     queries.push(raw + ', Vietnam');
  if (raw)                     queries.push(raw);
  if (tinh)                    queries.push(`${tinh}, Vietnam`);
  // unique giữ thứ tự
  const seen = new Set();
  for (const q of queries) {
    if (seen.has(q)) continue; seen.add(q);
    const geo = await dhGeocode(q);
    if (geo) return geo;
  }
  return null;
}

/* ════════════════════════════════════════════════════════════════════════
 *  [v13.64] QR CHUYỂN KHOẢN (VietQR) — gắn sẵn số tiền + nội dung
 *  STK test; đổi sang STK Nón Sơn khi chạy thật (có thể đưa vào app_settings).
 * ════════════════════════════════════════════════════════════════════════ */
const DH_QR = { bank: 'ACB', stk: '868636868', owner: 'NGUYEN PHAN BAO HAN' };
// [v13.80] SePay — đổi STK/bank sang tài khoản đã kết nối SePay khi chạy thật
const DH_SEPAY = { bank: 'ACB', stk: '868636868', owner: 'NGUYEN PHAN BAO HAN' };

function dhDonAmount(){
  if (!dhSelectedSp) return 0;
  const gia = dhGiaSp(dhSelectedSp);
  const sl = parseInt((document.getElementById('dh-sp-sl')||{}).value||'1')||1;
  const ck = parseFloat(((document.getElementById('dh-sp-ck')||{}).value||'0').replace(/[^\d.]/g,''))||0;
  return Math.max(0, gia*sl - ck);
}

window.dhPtttChange = function(){ dhUpdateQR(); };

function dhUpdateQR(){
  const box = document.getElementById('dh-qr-box');
  if (!box) return;
  const pttt = (document.getElementById('dh-pttt')||{}).value;
  if (pttt !== 'CK_TRUOC' && pttt !== 'SEPAY') { box.style.display='none'; return; }
  const amt = dhDonAmount();
  const sdt = ((document.getElementById('dh-khach-sdt')||{}).value || '').trim();
  let url, note, acc;
  if (pttt === 'SEPAY') {
    acc = DH_SEPAY;
    const des = ('NONSON ' + sdt).trim();
    url = `https://qr.sepay.vn/img?acc=${acc.stk}&bank=${acc.bank}&amount=${amt}&des=${encodeURIComponent(des)}`;
    note = 'Hệ thống tự động xác nhận ngay khi nhận được tiền (qua SePay).';
  } else {
    acc = DH_QR;
    const info = encodeURIComponent(('NonSon ' + sdt).trim());
    url = `https://img.vietqr.io/image/${acc.bank}-${acc.stk}-compact2.png?amount=${amt}&addInfo=${info}&accountName=${encodeURIComponent(acc.owner)}`;
    note = 'Mã QR gắn sẵn số tiền + nội dung. Khách quét app ngân hàng để chuyển; anh tự kiểm tra biến động số dư.';
  }
  const img = document.getElementById('dh-pqr-img'); if (img) img.src = url;
  const amtEl = document.getElementById('dh-pqr-amt'); if (amtEl) amtEl.textContent = dhFmtTien(amt);
  const noteEl = document.getElementById('dh-pqr-note'); if (noteEl) noteEl.textContent = note;
  const bn = document.getElementById('dh-qr-bankname'); if (bn) bn.textContent = acc.bank;
  const st = document.getElementById('dh-qr-stk'); if (st) st.textContent = acc.stk;
  const ow = document.getElementById('dh-qr-owner'); if (ow) ow.textContent = acc.owner;
  box.style.display='block';
}

// ─── [v13.81] SePay: màn chờ thanh toán + tự động xác nhận ──────────────
let dhTTPollTimer = null;
window.dhShowSepayWait = function(donId, amt, sdt, maDon){
  let ov = document.getElementById('dh-sepay-wait');
  if (!ov) { ov = document.createElement('div'); ov.id = 'dh-sepay-wait'; ov.className = 'dh-sepay-ov'; document.body.appendChild(ov); }
  const des = ('NONSON ' + (sdt||'')).trim();
  const qr = `https://qr.sepay.vn/img?acc=${DH_SEPAY.stk}&bank=${DH_SEPAY.bank}&amount=${amt}&des=${encodeURIComponent(des)}`;
  ov.innerHTML = `
    <div class="dh-sepay-card" id="dh-sepay-card">
      <div class="dh-sepay-title">Chờ khách thanh toán</div>
      <div class="dh-sepay-sub">Đơn ${escHtml(maDon||'')}</div>
      <img class="dh-sepay-qr" src="${qr}" alt="QR SePay">
      <div class="dh-sepay-amt">${dhFmtTien(amt)}</div>
      <div class="dh-sepay-status" id="dh-sepay-status"><span class="dh-sepay-spin"></span> Đang chờ chuyển khoản…</div>
      <button class="dh-sepay-close" onclick="dhCloseSepayWait()">Đóng</button>
    </div>`;
  ov.style.display = 'flex';
  clearInterval(dhTTPollTimer);
  let tries = 0;
  dhTTPollTimer = setInterval(async () => {
    tries++;
    if (tries > 150) { clearInterval(dhTTPollTimer); return; }  // ~10 phút dừng
    try {
      const { data } = await supa.rpc('dh_fn_check_tt', { p_don_id: donId });
      if (data === 'DA_TT') {
        clearInterval(dhTTPollTimer);
        const st = document.getElementById('dh-sepay-status');
        if (st) st.innerHTML = '<span class="dh-sepay-ok">✓</span> Đã thanh toán';
        const card = document.getElementById('dh-sepay-card'); if (card) card.classList.add('paid');
        showToast && showToast('✓ Đơn ' + (maDon||'') + ' đã thanh toán', 'success');
        setTimeout(() => { dhCloseSepayWait(); dhResetForm(); }, 2200);
      }
    } catch(e){}
  }, 4000);
};
window.dhCloseSepayWait = function(){
  clearInterval(dhTTPollTimer);
  const ov = document.getElementById('dh-sepay-wait');
  if (ov) ov.style.display = 'none';
};
