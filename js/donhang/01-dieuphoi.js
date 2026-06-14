/* ════════════════════════════════════════════════════════════════════════
 *  PHÂN HỆ ĐƠN HÀNG ONLINE — MÀN ĐIỀU PHỐI  [v13.44]
 *  Tái dùng: CH_LIST (cua_hang có sẵn lat/lng) + OSRM (router.project-osrm.org)
 *  Geocode địa chỉ khách: Nominatim (OSM, miễn phí).
 *  Backend: dh_fn_tao_don + dh_fn_dieu_phoi (đã có ở SQL v1.2).
 * ════════════════════════════════════════════════════════════════════════ */

let dhLastCHRanked = [];    // CH đã xếp hạng sau OSRM
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
};

function dhResetForm(){
  dhLastCHRanked = [];
  dhKhachLatLng  = null;
  ['dh-khach-ten','dh-khach-sdt','dh-diachi','dh-sp-barcode','dh-sp-ten','dh-sp-size','dh-sp-giatri']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const sl = document.getElementById('dh-sp-sl'); if (sl) sl.value = '1';
  const box = document.getElementById('dh-ch-list'); if (box) box.innerHTML = '';
  const sw = document.getElementById('dh-send-wrap'); if (sw) sw.style.display = 'none';
  const bt = document.getElementById('dh-btn-tim'); if (bt) { bt.disabled = false; bt.textContent = 'Tìm cửa hàng gần khách'; }
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
  if (!window.CH_LIST || !CH_LIST.length) { showToast && showToast('Chưa tải được danh sách cửa hàng', 'warn'); return; }

  const btn = document.getElementById('dh-btn-tim');
  const box = document.getElementById('dh-ch-list');
  if (btn){ btn.disabled = true; btn.textContent = 'Đang tìm...'; }
  box.innerHTML = '<div class="dh-loading">Đang định vị địa chỉ khách...</div>';

  // 1) Geocode khách
  const geo = await dhGeocode(diaChi);
  if (!geo) {
    box.innerHTML = '<div class="dh-empty">Không tìm được tọa độ địa chỉ này. Thử ghi rõ hơn: số nhà, đường, phường, tỉnh/thành.</div>';
    if (btn){ btn.disabled = false; btn.textContent = 'Tìm cửa hàng gần khách'; }
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
    if (btn){ btn.disabled = false; btn.textContent = 'Tìm cửa hàng gần khách'; }
    return;
  }

  // 2b) Lọc CH còn hàng nếu có nhập barcode (tồn hiện tại > 0)
  let candidate = near;
  const barcode = (document.getElementById('dh-sp-barcode').value || '').trim();
  if (barcode) {
    try {
      const { data: tk } = await supa.rpc('dh_fn_ch_con_hang', { p_barcode: barcode });
      if (Array.isArray(tk) && tk.length) {
        const conHang = {};
        tk.forEach(x => { conHang[x.ma_ch] = x.ton; });
        const loc = near.filter(ch => conHang[ch.ma] != null);
        if (loc.length) {
          loc.forEach(ch => { ch.ton = conHang[ch.ma]; });
          candidate = loc;
        } else {
          box.innerHTML = '<div class="dh-empty">Không có cửa hàng gần nào còn hàng sản phẩm này (barcode ' + escHtml(barcode) + '). Bỏ barcode để xem tất cả CH gần.</div>';
          if (btn){ btn.disabled = false; btn.textContent = 'Tìm cửa hàng gần khách'; }
          return;
        }
      }
      // tk rỗng → chưa đồng bộ tồn / SP không có dữ liệu → giữ tất cả CH gần
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
  if (btn){ btn.disabled = false; btn.textContent = 'Tìm lại'; }
};

// ─── Render danh sách CH + đánh dấu đợt 1 (bán kính +Nkm) ────────────────
function dhRenderCHList(list){
  const banKinh = parseFloat(_getSetting('donhang.ban_kinh_km', 2)) || 2;
  const nearest = list[0].km_sort;
  const nguong  = nearest + banKinh;

  let html = '';
  list.forEach((ch,i) => {
    const dot1   = ch.km_sort <= nguong + 0.001;
    const kmTxt  = ch.di_chuyen != null ? ch.di_chuyen.toFixed(1) + ' km' : '~' + ch.chim_bay.toFixed(1) + ' km';
    const loai   = ch.di_chuyen != null ? 'di chuyển' : 'đường thẳng';
    html += `
      <div class="dh-ch-card ${dot1 ? 'dh-ch-dot1' : ''}">
        <div class="dh-ch-idx">${String.fromCharCode(65 + i)}</div>
        <div class="dh-ch-info">
          <div class="dh-ch-ten">${escHtml(ch.ten || ch.ma)}</div>
          <div class="dh-ch-sub">${escHtml(ch.ma)} · ${loai}${ch.ton!=null?(' · còn '+ch.ton):''}</div>
        </div>
        <div class="dh-ch-km">
          <div class="dh-ch-km-num">${kmTxt}</div>
          ${dot1 ? '<div class="dh-ch-dot1-tag">đợt 1</div>' : '<div class="dh-ch-wait">chờ đợt 2</div>'}
        </div>
      </div>`;
  });

  const soDot1 = list.filter(ch => ch.km_sort <= nguong + 0.001).length;
  document.getElementById('dh-ch-list').innerHTML = html;

  const sw = document.getElementById('dh-send-wrap');
  const gb = document.getElementById('dh-btn-gui');
  if (sw) sw.style.display = 'block';
  if (gb) { gb.disabled = false; gb.textContent = 'Gửi yêu cầu đến ' + soDot1 + ' cửa hàng'; }
}

// ─── Gửi yêu cầu: tạo đơn + điều phối đợt 1 ─────────────────────────────
window.dhGuiYeuCau = async function(){
  if (!dhLastCHRanked.length) { showToast && showToast('Chưa có cửa hàng để gửi', 'warn'); return; }
  const diaChi  = (document.getElementById('dh-diachi').value || '').trim();
  const spTen   = (document.getElementById('dh-sp-ten').value || '').trim();
  if (!diaChi || !spTen) { showToast && showToast('Cần địa chỉ + tên sản phẩm', 'warn'); return; }
  if (!dhKhachLatLng) { showToast && showToast('Bấm Tìm cửa hàng trước', 'warn'); return; }

  const khachTen = (document.getElementById('dh-khach-ten').value || '').trim();
  const khachSdt = (document.getElementById('dh-khach-sdt').value || '').trim();
  const spBar    = (document.getElementById('dh-sp-barcode').value || '').trim();
  const spSize   = (document.getElementById('dh-sp-size').value || '').trim();
  const soLuong  = parseInt(document.getElementById('dh-sp-sl').value || '1') || 1;
  const giaTri   = parseFloat((document.getElementById('dh-sp-giatri').value || '0').replace(/[^\d.]/g,'')) || 0;
  const pttt     = document.getElementById('dh-pttt').value || 'COD';

  const banKinh = parseFloat(_getSetting('donhang.ban_kinh_km', 2)) || 2;
  const nguong  = dhLastCHRanked[0].km_sort + banKinh;
  const dot1 = dhLastCHRanked
    .filter(ch => ch.km_sort <= nguong + 0.001)
    .map(ch => ({ ma_ch: ch.ma, ten_ch: ch.ten, km: +(ch.km_sort.toFixed(2)) }));
  if (!dot1.length) { showToast && showToast('Không có CH trong bán kính', 'warn'); return; }

  const btn = document.getElementById('dh-btn-gui');
  if (btn) { btn.disabled = true; btn.textContent = 'Đang gửi...'; }

  try {
    const tao = await supa.rpc('dh_fn_tao_don', {
      p_khach_ten: khachTen, p_khach_sdt: khachSdt,
      p_dia_chi_full: diaChi, p_dia_chi_tinh: null, p_dia_chi_xa: null, p_dia_chi_con_lai: null,
      p_khach_lat: dhKhachLatLng.lat, p_khach_lng: dhKhachLatLng.lng,
      p_sp_barcode: spBar, p_sp_ten: spTen, p_sp_size: spSize,
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
    dhResetForm();
  } catch(e) {
    showToast && showToast('Lỗi: ' + (e.message || e), 'error');
    if (btn) btn.disabled = false;
  }
};
