// ════════════════════════════════════════════════════════════
// PHÂN HỆ LỊCH CA v8 — JavaScript
// Thay đổi:
//   + LC_NGHI_PHEP thay LC_VANG ('Nghỉ phép' thay 'Vắng')
//   + Màu hồng cho Nghỉ phép
//   + Tab Lịch riêng ở bottom nav
//   + Xếp lịch: autocomplete cửa hàng + form xin nghỉ
//   + QLNS: accordion 3 cấp KV→CH→NV
//   + Tab con Đơn nghỉ phép trong Nhân sự
//   + Badge 2 chiều
// ════════════════════════════════════════════════════════════

// ─── Hằng số [SỬA v8] ───────────────────────────────────────
const LC_NGHI_PHEP = 'Nghỉ phép'; // thay 'Vắng'
const LC_DI_LAM    = 'Đi làm';

// ─── Helpers tuần ISO ───────────────────────────────────────
function _tuanISO(d){
  const date=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
  date.setUTCDate(date.getUTCDate()+4-(date.getUTCDay()||7));
  const y1=new Date(Date.UTC(date.getUTCFullYear(),0,1));
  const w=Math.ceil((((date-y1)/86400000)+1)/7);
  return date.getUTCFullYear()+'-W'+String(w).padStart(2,'0');
}
function _thuHai(tuan){
  const [y,w]=tuan.split('-W').map(Number);
  const jan4=new Date(y,0,4);
  const ms=jan4.getTime()+((1-(jan4.getDay()||7))+(w-1)*7)*86400000;
  const d=new Date(ms);
  return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
}
function _tuanLabel(tuan){
  const [,w]=tuan.split('-W');
  const th=_thuHai(tuan);
  const cn=new Date(new Date(th+'T00:00:00').getTime()+6*86400000);
  return `Tuần ${w} (${pad(new Date(th+'T00:00:00').getDate())}/${pad(new Date(th+'T00:00:00').getMonth()+1)} – ${pad(cn.getDate())}/${pad(cn.getMonth()+1)}/${cn.getFullYear()})`;
}
const DOW=['CN','T2','T3','T4','T5','T6','T7'];
function _ngayTuan(tuan){
  const th=new Date(_thuHai(tuan)+'T00:00:00');
  return Array.from({length:7},(_,i)=>{
    const d=new Date(th.getTime()+i*86400000);
    return {
      ngay:d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()),
      dow:DOW[d.getDay()], ngayNum:d.getDate(), thang:d.getMonth()+1,
    };
  });
}

// ─── State NV ───────────────────────────────────────────────
// lcEdit: { ngay: { type:'work'|'nghi', maCH, tenCH, gioBD, gioKT, lyDoNghi, anhNghiB64, trangThai } }
let lcTuan='', lcData=null, lcEdit={}, lcDaysChanged=new Set();
function _markLCChanged(ngay){
  if(!ngay) return;
  const today = new Date().toISOString().substring(0,10);
  if (ngay > today) lcDaysChanged.add(ngay);
}
let _npCamB64={}; // base64 ảnh đơn theo ngày

function moLichCa(){
  const now=new Date();
  // [v17.24] Tài khoản cửa hàng → Lịch hoạt động cửa hàng (Mở/Đóng), không phải lịch ca NV
  if(SESSION&&SESSION.vaiTro==='CUA_HANG'){ if(typeof moLichHD==='function'){ moLichHD(); return; } }
  const isQL=SESSION&&(SESSION.vaiTro==='QLNS'||SESSION.vaiTro==='ADMIN');
  if(isQL){ goToPage('lichca-ql'); return; }
  const dow=now.getDay();
  lcTuan=dow===6?_tuanISO(new Date(now.getTime()+7*86400000)):_tuanISO(now);
  goToPage('lichca');
}

function doiTuanLC(delta){
  const d=new Date(_thuHai(lcTuan)+'T00:00:00');
  d.setDate(d.getDate()+delta*7);
  lcTuan=_tuanISO(d);
  taiLichCa();
}

function taiLichCa(){
  if(!SESSION)return;
  _taiGoiYCH(); // [v10.85] Preload gợi ý CH
  document.getElementById('lc-tuan-lbl').textContent=_tuanLabel(lcTuan);
  document.getElementById('lc-week').innerHTML='<div style="padding:40px;text-align:center;color:var(--text-m);font-size:13px">⏳ Đang tải...</div>';
  // [v12-P3] Supabase RPC, adapt response sang format cũ
  supa.rpc('fn_get_lich_ca', { p_ma_nv: SESSION.ma, p_tuan: lcTuan })
  .then(({ data: res, error }) => {
    if(error || !res){document.getElementById('lc-week').innerHTML='<div class="ns-empty">❌ Lỗi tải. Thử lại.</div>';return;}
    // [v9.45] Backend mới: trả lich (mảng phẳng), conHan, trangThaiTuan, guiKhan, thuHai, chuNhat
    // Backward compat: nếu có res.lichCa cũ thì dùng, nếu không thì dùng res.lich
    const slots = res.lich || res.lichCa || [];
    // Group theo ngày
    const map = {};
    slots.forEach(s => {
      if(!map[s.ngay]) map[s.ngay] = [];
      map[s.ngay].push({
        loai: s.loai, maCH: s.maCH, tenCH: s.tenCH,
        gioBatDau: s.gioBatDau, gioKetThuc: s.gioKetThuc,
        trangThai: s.trangThai,
        ghiChuNV: s.ghiChuNV, ghiChuQLNS: s.ghiChuQLNS
      });
    });
    // Tạo array 7 ngày
    const arr = [];
    const ngayDau = new Date(res.thuHai || res.ngayDau);
    for(let i=0; i<7; i++){
      const d = new Date(ngayDau); d.setDate(d.getDate()+i);
      const ngayStr = d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
      arr.push({
        ngay: ngayStr,
        daDangKy: !!map[ngayStr],
        slots: map[ngayStr] || []
      });
    }
    // [v9.45] conHan + trangThaiTuan + guiKhan từ backend
    const conHan = res.conHan != null ? res.conHan : (function(){
      const today = new Date(); today.setHours(0,0,0,0);
      const cn = new Date(res.chuNhat || res.ngayCuoi);
      return today <= cn;
    })();
    lcData = {
      lichCa: arr,
      conHan: conHan,
      trangThaiTuan: res.trangThaiTuan || null,
      guiKhan: !!res.guiKhan,
      ngayDau: res.thuHai || res.ngayDau,
      ngayCuoi: res.chuNhat || res.ngayCuoi,
      tuan: res.tuan
    };
    lcEdit={};
    lcDaysChanged = new Set();  // [v10.85] reset track changes mỗi khi load tuần mới
    _npCamB64={};
    arr.forEach(ng=>{
      if(ng.daDangKy && ng.slots.length){
        const firstLoai=ng.slots[0].loai;
        if(firstLoai===LC_NGHI_PHEP){
          const s=ng.slots[0];
          lcEdit[ng.ngay]={
            type:'nghi',slots:[],
            trangThai:s.trangThai||'Chờ duyệt',
            ghiChuNV:s.ghiChuNV||'',
            ghiChuQLNS:s.ghiChuQLNS||'',
          };
        } else {
          lcEdit[ng.ngay]={
            type:'work',
            slots:ng.slots.map(s=>({
              maCH:s.maCH||'', tenCH:s.tenCH||'',
              gioBD:s.gioBatDau||'08:00', gioKT:s.gioKetThuc||'17:00',
            })),
            trangThai:'Đã gửi',
          };
        }
      }
    });
    renderLichCa(lcData);
  })
  .catch(()=>{document.getElementById('lc-week').innerHTML='<div class="ns-empty">❌ Lỗi tải. Thử lại.</div>';});
}

// ─── Render lịch NV [FIX v9 #4 + #5] ─────────────────────────
// - Trạng thái lịch "Đi làm" chỉ hiện "Đã gửi" (không duyệt)
// - Nghỉ phép chỉ còn Đi làm / Nghỉ — không form lý do/ảnh trong lịch (chuyển qua tab Đơn nghỉ phép)
// - Hỗ trợ nhiều ca/ngày bằng nút "+"
// - Autocomplete cửa hàng tràn ra ngoài khung, ~3 gợi ý
// - UX mượt: re-render từng ngày thay vì cả tuần khi thao tác
function renderLichCa(data){
  const conHan=data.conHan;
  const tt = data.trangThaiTuan || '';
  const guiKhan = !!data.guiKhan;
  const hanEl=document.getElementById('lc-han-badge');
  const metaEl=document.getElementById('lc-meta-txt');
  // [v9.45] Show/hide banner XIN ĐỔI LỊCH — cho cả tuần hiện tại và tuần sau (đã gửi)
  // [v10.85] Ẩn banner nếu setting 'lc.cho_phep_tuan_hien_tai' bật (vì NV gửi trực tiếp được)
  const xdlBanner = document.getElementById('lc-xdl-banner');
  const _choPhepHT = _getSetting('lc.cho_phep_tuan_hien_tai', false);
  if(xdlBanner) {
    let showBanner = false;
    if (tt === 'HIEN_TAI') {
      showBanner = !_choPhepHT; // ẩn nếu cho phép gửi trực tiếp tuần hiện tại
    } else if (tt === 'TUAN_SAU' || tt === 'TUAN_XA') {
      // Check có ca nào đã DA_GUI hoặc DA_DUYET không
      const hasChot = (data.lich || []).some(l => 
        l.trangThai === 'DA_GUI' || l.trangThai === 'DA_DUYET' || l.trangThai === 'CHO_DUYET_THAY_THE'
      );
      showBanner = hasChot;
    }
    xdlBanner.style.display = showBanner ? '' : 'none';
    
    // Check đề nghị đang chờ duyệt
    if (showBanner) {
      const pendingChanges = (data.lich || []).filter(l => 
        l.trangThai === 'CHO_DUYET' && 
        l.ghiChuNV && l.ghiChuNV.indexOf('[XIN ĐỔI LỊCH]') >= 0
      );
      const pendingInfo = document.getElementById('lc-xdl-pending-info');
      const cancelBtn = document.getElementById('lc-xdl-cancel-btn');
      if (pendingChanges.length > 0) {
        pendingInfo.innerHTML = `<strong>Đang chờ duyệt:</strong> ${pendingChanges.length} ngày đổi lịch`;
        pendingInfo.style.display = '';
        cancelBtn.style.display = '';
      } else {
        pendingInfo.style.display = 'none';
        cancelBtn.style.display = 'none';
      }
    }
  }
  // [v9.45] Banner theo loại tuần
  if(tt === 'DA_QUA'){
    hanEl.textContent='Tuần đã qua'; hanEl.className='lc-han-badge lc-han-het';
    metaEl.textContent='Không thể gửi/sửa lịch tuần này';
  } else if(tt === 'HIEN_TAI'){
    if (_choPhepHT) {
      hanEl.textContent='Tuần hiện tại'; hanEl.className='lc-han-badge lc-han-ok';
      metaEl.textContent='Được phép gửi/sửa lịch trực tiếp';
    } else {
      hanEl.textContent='Tuần hiện tại'; hanEl.className='lc-han-badge lc-han-het';
      metaEl.textContent='Chỉ cho phép gửi đơn nghỉ phép đột xuất · đổi ca liên hệ QLNS';
    }
  } else if(tt === 'TUAN_SAU' && guiKhan){
    hanEl.textContent='Quá hạn — Gửi khẩn'; hanEl.className='lc-han-badge lc-han-het';
    metaEl.textContent='Quá hạn T7 — bắt buộc ghi lý do gấp, QLNS sẽ duyệt riêng';
  } else if(tt === 'TUAN_SAU'){
    hanEl.textContent='Còn trong hạn gửi'; hanEl.className='lc-han-badge lc-han-ok';
    metaEl.textContent='Hạn cuối: Thứ 7 tuần này';
  } else if(tt === 'TUAN_XA'){
    hanEl.textContent='Lên kế hoạch trước'; hanEl.className='lc-han-badge lc-han-ok';
    metaEl.textContent='Tuần xa — gửi tự do';
  } else if(conHan){
    hanEl.textContent='Còn trong hạn gửi'; hanEl.className='lc-han-badge lc-han-ok';
    metaEl.textContent='Hạn thứ 7 tuần này';
  } else {
    hanEl.textContent='Đã qua hạn'; hanEl.className='lc-han-badge lc-han-het';
    metaEl.textContent='Không thể sửa lịch';
  }

  const ngayTuan=_ngayTuan(lcTuan);

  // Progress bar
  const prog=document.getElementById('lc-progress');
  prog.innerHTML=ngayTuan.map(({ngay})=>{
    const e=lcEdit[ngay];
    const cls=!e?'':e.type==='nghi'?'vang':'filled';
    return `<div class="lc-prog-day ${cls}"></div>`;
  }).join('');

  const soNgayDienTu=Object.keys(lcEdit).filter(k=>lcEdit[k]&&lcEdit[k].type).length;

  document.getElementById('lc-week').innerHTML=ngayTuan.map(ngInfo=>_renderLCDayCard(ngInfo)).join('');

  _updateLCSendBtn(conHan, soNgayDienTu);
}

// Render 1 card ngày [FIX v9 #4] — tách ra để có thể re-render từng ngày (UX mượt)
function _renderLCDayCard({ngay,dow,ngayNum}){
  const today=new Date().toISOString().substring(0,10);
  const e=lcEdit[ngay];
  const isToday=ngay===today;
  // [v10.85] Khóa ngày ≤ hôm nay (đã qua hoặc đang trong ngày — server không cho sửa)
  const isLocked = ngay <= today;
  const type=e?e.type:'';
  const dotCls=type==='work'?'work':type==='nghi'?'nghi':'';
  const ttTxt=type==='work'?'Đi làm':type==='nghi'?'Nghỉ phép':'Chưa đăng ký';

  // Sub-text
  let subTxt='';
  if(type==='work'&&e.slots&&e.slots.length){
    if(e.slots.length===1){
      const s=e.slots[0];
      subTxt=s.tenCH?`${s.tenCH}${s.gioBD?' · '+s.gioBD+(s.gioKT?'–'+s.gioKT:''):''}`:'';
    } else {
      subTxt=`${e.slots.length} ca / ${e.slots.map(s=>s.tenCH||'?').filter(Boolean).slice(0,2).join(', ')}${e.slots.length>2?'...':''}`;
    }
  }

  // [FIX v9 #4] Trạng thái hiển thị
  let stCls='', stLabel='';
  if(type==='work'){
    // Đi làm: luôn hiện "Đã gửi" khi đã đăng ký
    stCls='lcs-ok'; stLabel='Đã gửi';
  } else if(type==='nghi'){
    // Nghỉ phép: theo trạng thái duyệt
    const tts=e.trangThai||'Chờ duyệt';
    stCls=tts==='Đã duyệt'?'lcs-ok':tts==='Từ chối'?'lcs-deny':'lcs-wait';
    stLabel=tts==='Đã duyệt'?'✓ Đã duyệt':tts==='Từ chối'?'⚠ Không duyệt':'Chờ duyệt';
  }

  // Editor
  let editor='';
  if(type==='work'){
    const slots=(e&&e.slots)||[{maCH:'',tenCH:'',gioBD:'08:00',gioKT:'17:00'}];
    editor=slots.map((s,idx)=>`
      <div class="lc-slot" data-ngay="${ngay}" data-idx="${idx}">
        <div class="lc-slot-head">
          <span class="lc-slot-lbl">Ca ${idx+1}</span>
          ${slots.length>1?`<button type="button" class="lc-slot-del" onclick="xoaCa('${ngay}',${idx})" title="Xoá ca này">×</button>`:''}
        </div>
        <div class="lc-ed-row" style="position:relative">
          <input type="text" class="lc-ed-sel lc-ch-inp" id="lc-ch-inp-${ngay}-${idx}"
            placeholder="🔍 Nhập tên cửa hàng..." autocomplete="off"
            value="${(s.tenCH||'').replace(/"/g,'&quot;')}"
            oninput="onLCCHInput('${ngay}',${idx})"
            onfocus="showLCCHSuggest('${ngay}',${idx})"
            onblur="hideLCCHSuggest('${ngay}',${idx})">
          <div class="suggest-list lc-ch-sug" id="lc-ch-sug-${ngay}-${idx}"></div>
        </div>
        <div class="lc-ed-row" style="margin-top:8px">
          <input type="time" class="lc-ed-time" id="lc-time-bd-${ngay}-${idx}" value="${s.gioBD||'08:00'}" onchange="setLCGio('${ngay}',${idx},'bd',this.value)">
          <span class="lc-ed-sep">đến</span>
          <input type="time" class="lc-ed-time" id="lc-time-kt-${ngay}-${idx}" value="${s.gioKT||'17:00'}" onchange="setLCGio('${ngay}',${idx},'kt',this.value)">
        </div>
        <!-- [v12-FIX] Chia Ca / Full trên 2 dòng -->
        <div class="lc-preset-label">Ca:</div>
        <div class="lc-preset-row">
          <button type="button" class="lc-preset-chip" onclick="applyPresetCa('${ngay}',${idx},'07:30','15:30')">Sáng 7:30-15:30</button>
          <button type="button" class="lc-preset-chip" onclick="applyPresetCa('${ngay}',${idx},'08:00','14:00')">Sáng 8:00-14:00</button>
          <button type="button" class="lc-preset-chip" onclick="applyPresetCa('${ngay}',${idx},'13:30','21:30')">Chiều 13:30-21:30</button>
          <button type="button" class="lc-preset-chip" onclick="applyPresetCa('${ngay}',${idx},'14:00','22:00')">Chiều 14:00-22:00</button>
        </div>
        <div class="lc-preset-label" style="margin-top:4px">Full:</div>
        <div class="lc-preset-row">
          <button type="button" class="lc-preset-chip lc-preset-full" onclick="applyPresetCa('${ngay}',${idx},'07:30','21:30')">7:30-21:30</button>
          <button type="button" class="lc-preset-chip lc-preset-full" onclick="applyPresetCa('${ngay}',${idx},'07:30','22:00')">7:30-22:00</button>
          <button type="button" class="lc-preset-chip lc-preset-full" onclick="applyPresetCa('${ngay}',${idx},'08:00','21:00')">8:00-21:00</button>
        </div>
      </div>`).join('');
    editor+=`<button type="button" class="lc-add-ca" onclick="themCa('${ngay}')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;vertical-align:-2px;margin-right:4px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Thêm ca / cửa hàng khác
    </button>`;
  } else if(type==='nghi'){
    // [v10 Yc #2] Form inline: Lý do + Ảnh đính kèm (bắt buộc khi gửi mới)
    const ghiChuCu = e.ghiChuNV||'';
    const pipeCu   = ghiChuCu.indexOf(' | ');
    const lyDoCu   = pipeCu>=0 ? ghiChuCu.substring(0,pipeCu).trim() : ghiChuCu.trim();
    const linkAnhCu= pipeCu>=0 ? ghiChuCu.substring(pipeCu+3).trim() : '';
    const lyDoHT   = (e.lyDoMoi!==undefined) ? e.lyDoMoi : lyDoCu;
    const anhMoi   = !!e.anhB64Moi;
    const ttDuyet  = e.trangThai || 'Chờ duyệt';
    const isLocked = ttDuyet==='Đã duyệt' && !anhMoi; // đã duyệt, chưa đính kèm ảnh mới → hiển thị read-only nhẹ

    editor=`<div class="lc-nghi-form">
      <label class="lc-nghi-lbl">Lý do nghỉ phép ${isLocked?'<span style="color:var(--green);font-weight:400">· đã duyệt</span>':'<span style="color:var(--red)">*</span>'}</label>
      <textarea class="lc-nghi-input" id="lcnghi-lydo-${ngay}" rows="2"
        placeholder="VD: Khám bệnh, việc gia đình..."
        oninput="setLCNghiLyDo('${ngay}',this.value)">${lyDoHT.replace(/</g,'&lt;')}</textarea>

      <label class="lc-nghi-lbl" style="margin-top:8px">
        Ảnh đơn đính kèm ${isLocked?'<span style="color:var(--green);font-weight:400">· đã có</span>':'<span style="color:var(--red)">*</span>'}
      </label>
      <label class="lc-nghi-anh-btn ${anhMoi?'done':''}" for="lcnghi-anh-${ngay}">
        <input type="file" id="lcnghi-anh-${ngay}" accept="image/*" capture="environment"
               style="display:none" onchange="xuLyAnhNghiLich('${ngay}',this)">
        <span class="lc-nghi-anh-ico">${anhMoi?'✅':'📎'}</span>
        <span class="lc-nghi-anh-txt">${anhMoi?'Đã đính kèm ảnh mới':(linkAnhCu?'Đổi ảnh đơn':'Chụp / chọn ảnh đơn')}</span>
      </label>
      ${(!anhMoi && linkAnhCu) ? `<div onclick="window.open('${linkAnhCu}','_blank')" style="margin-top:6px;font-size:11px;color:var(--blue);text-decoration:underline;cursor:pointer">📎 Xem ảnh đơn đã gửi trước đây</div>` : ''}

      ${!isLocked ? `
      <div class="lc-multi-row">
        <label class="lc-multi-cb">
          <input type="checkbox" id="lc-multi-${ngay}" onchange="toggleApplyMultiDays('${ngay}')">
          <span>📅 Áp dụng đơn này cho nhiều ngày liên tiếp</span>
        </label>
        <div class="lc-multi-range" id="lc-multi-range-${ngay}" style="display:none">
          <!-- [v11.7 L2] 2 dòng: Từ ngày | Đến ngày, format DD/MM/YYYY -->
          <div class="lc-multi-line">
            <span class="lc-multi-prefix">Từ</span>
            <input type="date" id="lc-multi-from-${ngay}" value="${ngay}" min="${ngay}" onchange="renderMultiPreview('${ngay}')">
            <span class="lc-multi-display" id="lc-multi-from-disp-${ngay}">${_lcVNDate(ngay)}</span>
          </div>
          <div class="lc-multi-line">
            <span class="lc-multi-prefix">Đến</span>
            <input type="date" id="lc-multi-to-${ngay}" value="${ngay}" min="${ngay}" onchange="renderMultiPreview('${ngay}')">
            <span class="lc-multi-display" id="lc-multi-to-disp-${ngay}">${_lcVNDate(ngay)}</span>
          </div>
          <button type="button" class="lc-multi-apply-btn" onclick="applyMultiDays('${ngay}')">✓ Áp dụng cho dải ngày</button>
        </div>
      </div>
      ` : ''}

      <div style="margin-top:8px;font-size:11px;color:var(--text-m);line-height:1.4">
        ${isLocked
          ? 'Đơn đã được duyệt. Chỉ đính kèm ảnh mới nếu muốn thay đổi đơn.'
          : 'Cả Lý do và Ảnh đều bắt buộc. Khi bấm "Gửi lịch tuần" đơn sẽ được gửi.'}
      </div>
      ${e.ghiChuQLNS?`<div class="lc-qlns-note" style="margin-top:8px;font-size:12px;color:var(--green);font-style:italic;background:var(--green-lt);padding:6px 10px;border-radius:8px">💬 QLNS: ${e.ghiChuQLNS}</div>`:''}
    </div>`;
  }

  return `<div class="lc-day-card${isToday?' lc-today':''}${isLocked?' lc-locked':''}${type==='nghi'?' lc-nghi':''}" id="lc-day-${ngay}">
    <div class="lc-day-head" ${isLocked?'':`onclick="toggleLCEditor('${ngay}')"`}>
      <div class="lc-day-dot ${dotCls}">
        <span class="lc-day-dow">${dow}</span>
        <span class="lc-day-num">${ngayNum}</span>
      </div>
      <div class="lc-day-info">
        <div class="lc-day-tt">${ttTxt}</div>
        ${subTxt?`<div class="lc-day-sub">${subTxt}</div>`:''}
      </div>
      ${isLocked
        ? `<span class="lc-day-status" style="background:#F1F5F9;color:#64748B">🔒 ${isToday?'Hôm nay':'Đã qua'}</span>`
        : (stLabel?`<span class="lc-day-status ${stCls}">${stLabel}</span>`:'')}
    </div>
    <div class="lc-day-editor" id="lced-${ngay}">
      <div class="lc-type-row">
        <div class="lc-type-btn${type==='work'?' sel-work':''}" onclick="setLCDayType('${ngay}','work')">
          <svg style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;display:block;margin:0 auto 4px" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
          Đi làm
        </div>
        <div class="lc-type-btn${type==='nghi'?' sel-nghi':''}" onclick="setLCDayType('${ngay}','nghi')">
          <svg style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;display:block;margin:0 auto 4px" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          Nghỉ phép
        </div>
      </div>
      ${editor}
    </div>
  </div>`;
}

// Re-render CHỈ 1 ngày (UX mượt — không nháy cả tuần) [FIX v9 #4]
function _rerenderLCDay(ngay){
  const ngayTuan=_ngayTuan(lcTuan);
  const info=ngayTuan.find(n=>n.ngay===ngay);
  if(!info)return;
  const oldEl=document.getElementById('lc-day-'+ngay);
  if(!oldEl)return;
  const wasOpen=document.getElementById('lced-'+ngay)?.classList.contains('open');
  const tmp=document.createElement('div');
  tmp.innerHTML=_renderLCDayCard(info);
  const newEl=tmp.firstChild;
  oldEl.replaceWith(newEl);
  if(wasOpen)newEl.querySelector('.lc-day-editor')?.classList.add('open');
  // Cập nhật progress bar
  const prog=document.getElementById('lc-progress');
  if(prog){
    const e=lcEdit[ngay];
    const idx=ngayTuan.findIndex(n=>n.ngay===ngay);
    const progDay=prog.children[idx];
    if(progDay){
      progDay.className='lc-prog-day '+(!e?'':e.type==='nghi'?'vang':'filled');
    }
  }
  // Cập nhật nút gửi
  const soNgayDienTu=Object.keys(lcEdit).filter(k=>lcEdit[k]&&lcEdit[k].type).length;
  _updateLCSendBtn(lcData?.conHan, soNgayDienTu);
}

function toggleLCEditor(ngay){
  // [v10.85] Chặn mở editor cho ngày đã qua hoặc hôm nay
  const today=new Date().toISOString().substring(0,10);
  if(ngay <= today) return;
  const el=document.getElementById('lced-'+ngay);
  if(!el)return;
  el.classList.toggle('open');
}

function setLCDayType(ngay,type){
  // [v10.85] Chặn sửa cho ngày đã qua hoặc hôm nay
  const today=new Date().toISOString().substring(0,10);
  if(ngay <= today) return;
  if(!lcEdit[ngay])lcEdit[ngay]={};
  _markLCChanged(ngay);
  const prev=lcEdit[ngay].type;
  lcEdit[ngay].type=type;
  if(type==='work'){
    if(!lcEdit[ngay].slots||!lcEdit[ngay].slots.length)
      lcEdit[ngay].slots=[{maCH:'',tenCH:'',gioBD:'08:00',gioKT:'17:00'}];
    lcEdit[ngay].trangThai='Đã gửi';
    // [v10] Xóa state nghỉ nếu đổi sang đi làm
    delete lcEdit[ngay].lyDoMoi;
    delete lcEdit[ngay].anhB64Moi;
  } else if(type==='nghi'){
    lcEdit[ngay].slots=[];
    if(!lcEdit[ngay].trangThai)lcEdit[ngay].trangThai='Chờ duyệt';
  }
  _rerenderLCDay(ngay);
  // Giữ editor mở
  setTimeout(()=>{const el=document.getElementById('lced-'+ngay);if(el)el.classList.add('open');},10);
}

// [v10 Yc #2] Nghỉ phép inline — lưu lý do vào state khi gõ
function setLCNghiLyDo(ngay, value){
  if(!lcEdit[ngay])lcEdit[ngay]={type:'nghi'};
  lcEdit[ngay].lyDoMoi=value;
  _markLCChanged(ngay);
  // Không rerender (tránh mất focus) — chỉ lưu vào state
}

// [v10 Yc #2] Nghỉ phép inline — xử lý ảnh: resize → base64 → lưu vào state
function xuLyAnhNghiLich(ngay, input){
  if(!input||!input.files||!input.files[0])return;
  const file=input.files[0];
  const reader=new FileReader();
  reader.onload=ev=>{
    const img=new Image();
    img.onload=()=>{
      const MAX=900;
      const scale=Math.min(1,MAX/Math.max(img.width,img.height));
      const canvas=document.createElement('canvas');
      canvas.width=Math.round(img.width*scale);
      canvas.height=Math.round(img.height*scale);
      canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
      if(!lcEdit[ngay])lcEdit[ngay]={type:'nghi'};
      lcEdit[ngay].anhB64Moi=canvas.toDataURL('image/jpeg',0.78);
      _markLCChanged(ngay);
      _rerenderLCDay(ngay);
      setTimeout(()=>{const el=document.getElementById('lced-'+ngay);if(el)el.classList.add('open');},10);
    };
    img.src=ev.target.result;
  };
  reader.readAsDataURL(file);
}

// Thêm ca / cửa hàng khác trong cùng 1 ngày [FIX v9 #4]
function themCa(ngay){
  if(!lcEdit[ngay])lcEdit[ngay]={type:'work',slots:[]};
  if(!lcEdit[ngay].slots)lcEdit[ngay].slots=[];
  // Mặc định ca mới: bắt đầu từ giờ kết thúc của ca cuối
  const last=lcEdit[ngay].slots[lcEdit[ngay].slots.length-1];
  const gioBD=last&&last.gioKT?last.gioKT:'13:00';
  lcEdit[ngay].slots.push({maCH:'',tenCH:'',gioBD,gioKT:'17:00'});
  _markLCChanged(ngay);
  _rerenderLCDay(ngay);
}

// Xoá 1 ca [FIX v9 #4]
function xoaCa(ngay,idx){
  if(!lcEdit[ngay]||!lcEdit[ngay].slots)return;
  lcEdit[ngay].slots.splice(idx,1);
  _markLCChanged(ngay);
  if(!lcEdit[ngay].slots.length){
    // Xoá hết ca → coi như chưa đăng ký
    delete lcEdit[ngay];
  }
  _rerenderLCDay(ngay);
}

// Autocomplete cửa hàng [FIX v9 #4] — tràn ra ngoài khung, ~3 gợi ý
// [v10.85 Đề xuất] Khi input trống: hiển thị top 5 CH từ getGoiYCuaHang (CH hay làm tuần trước)
let _goiYCH_cache = null;
function _taiGoiYCH(){
  if(_goiYCH_cache || !SESSION)return;
  // [v12-P3] Đơn giản: dùng CH mặc định + top CH gần đó trong CH_LIST
  // Nếu có ma_ch_mac_dinh trong SESSION thì ưu tiên đầu tiên
  const goiY = [];
  if(SESSION.cuaHangMa && SESSION.cuaHangTen){
    goiY.push({ maCH: SESSION.cuaHangMa, tenCH: SESSION.cuaHangTen, soLan: 5 });
  }
  // Thêm các CH cùng khu vực
  if(CH_LIST && CH_LIST.length && SESSION.khuVuc){
    CH_LIST.filter(ch => ch.khuVuc === SESSION.khuVuc && ch.ma !== SESSION.cuaHangMa)
      .slice(0, 4).forEach(ch => goiY.push({ maCH: ch.ma, tenCH: ch.ten, soLan: 1 }));
  }
  _goiYCH_cache = goiY;
}
function onLCCHInput(ngay,idx){
  const inp=document.getElementById(`lc-ch-inp-${ngay}-${idx}`);
  const sug=document.getElementById(`lc-ch-sug-${ngay}-${idx}`);
  if(!inp||!sug)return;
  const q=inp.value.trim().toLowerCase();
  // Cập nhật state tenCH ngay khi gõ
  if(lcEdit[ngay]&&lcEdit[ngay].slots&&lcEdit[ngay].slots[idx]){
    lcEdit[ngay].slots[idx].tenCH=inp.value;
    if(!CH_LIST.find(ch=>ch.ma===lcEdit[ngay].slots[idx].maCH&&ch.ten===inp.value))
      lcEdit[ngay].slots[idx].maCH='';
    _markLCChanged(ngay);
  }
  let matched;
  if(!q){
    // [v10.85] Input trống → hiện gợi ý thông minh từ CH hay làm
    if(!_goiYCH_cache){_taiGoiYCH();}
    const goiY = _goiYCH_cache || [];
    if(!goiY.length){sug.style.display='none';return;}
    matched = goiY.slice(0, 5).map(g => ({ ma:g.maCH, ten:g.tenCH, _goiY:true, soLan:g.soLan }));
  } else {
    matched = CH_LIST.filter(ch=>ch.ma.toLowerCase().includes(q)||ch.ten.toLowerCase().includes(q)).slice(0,3);
  }
  if(!matched.length){sug.style.display='none';return;}
  sug.innerHTML=matched.map(ch=>{
    const badge = ch._goiY ? `<span style="font-size:10px;color:var(--green,#1D9E75);margin-left:auto;font-weight:600">⭐ ${ch.soLan}× tuần qua</span>` : '';
    return `<div class="suggest-item" onmousedown="event.preventDefault();selectLCCH('${ngay}',${idx},'${esc(ch.ma)}','${esc(ch.ten)}')"><span class="s-ma">${ch.ma}</span><span class="s-ten">${ch.ten}</span>${badge}</div>`;
  }).join('');
  sug.style.display='block';
}
function showLCCHSuggest(ngay,idx){
  // Gọi khi focus vào input — show gợi ý ngay cả khi trống
  onLCCHInput(ngay, idx);
}
function hideLCCHSuggest(ngay,idx){
  setTimeout(()=>{const s=document.getElementById(`lc-ch-sug-${ngay}-${idx}`);if(s)s.style.display='none';},180);
}
function selectLCCH(ngay,idx,ma,ten){
  if(!lcEdit[ngay])lcEdit[ngay]={type:'work',slots:[{}]};
  if(!lcEdit[ngay].slots[idx])lcEdit[ngay].slots[idx]={};
  lcEdit[ngay].slots[idx].maCH=ma;
  lcEdit[ngay].slots[idx].tenCH=ten;
  _markLCChanged(ngay);
  // Cập nhật DOM trực tiếp, không re-render cả ngày (UX mượt)
  const inp=document.getElementById(`lc-ch-inp-${ngay}-${idx}`);
  const sug=document.getElementById(`lc-ch-sug-${ngay}-${idx}`);
  if(inp)inp.value=ten;
  if(sug)sug.style.display='none';
  _updateLCSendBtn(lcData?.conHan, Object.keys(lcEdit).filter(k=>lcEdit[k]&&lcEdit[k].type).length);
}

function setLCGio(ngay,idx,field,value){
  if(!lcEdit[ngay]||!lcEdit[ngay].slots||!lcEdit[ngay].slots[idx])return;
  if(field==='bd')lcEdit[ngay].slots[idx].gioBD=value;
  if(field==='kt')lcEdit[ngay].slots[idx].gioKT=value;
  _markLCChanged(ngay);
}

// [v11.6 Item 6] Apply preset ca - tự fill 2 input giờ
function applyPresetCa(ngay, idx, gioBD, gioKT){
  if(!lcEdit[ngay] || !lcEdit[ngay].slots || !lcEdit[ngay].slots[idx]) return;
  lcEdit[ngay].slots[idx].gioBD = gioBD;
  lcEdit[ngay].slots[idx].gioKT = gioKT;
  _markLCChanged(ngay);
  // Update visual NGAY 2 ô input
  const inpBD = document.getElementById(`lc-time-bd-${ngay}-${idx}`);
  const inpKT = document.getElementById(`lc-time-kt-${ngay}-${idx}`);
  if(inpBD) inpBD.value = gioBD;
  if(inpKT) inpKT.value = gioKT;
  // Vibrate feedback
  if(navigator.vibrate) try{ navigator.vibrate(15); }catch(e){}
}

// [v11.7 L2] Helper format ngày VN
function _lcVNDate(s){
  if(!s) return '';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return s;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

// [v11.6 Item 7] Toggle range picker
function toggleApplyMultiDays(ngay){
  const cb = document.getElementById('lc-multi-' + ngay);
  const rangeEl = document.getElementById('lc-multi-range-' + ngay);
  if(rangeEl) rangeEl.style.display = cb.checked ? 'block' : 'none';
}

// [v11.7 L2] Update preview khi đổi ngày (input date tự hiển thị DD/MM/YYYY trên mobile)
function renderMultiPreview(ngay){
  // No-op cho desktop, mobile input date hiển thị format mặc định của hệ điều hành
  // Function này chỉ giữ để onchange không lỗi
}

// [v11.6 Item 7] Apply đơn nghỉ cho dải ngày liên tiếp
function applyMultiDays(ngay){
  const fromEl = document.getElementById('lc-multi-from-' + ngay);
  const toEl = document.getElementById('lc-multi-to-' + ngay);
  if(!fromEl || !toEl) return;
  const tuNgay = fromEl.value;
  const denNgay = toEl.value;
  if(!tuNgay || !denNgay){
    showToast('⚠ Vui lòng chọn từ ngày và đến ngày', 'warn');
    return;
  }
  if(tuNgay > denNgay){
    showToast('⚠ Ngày kết thúc phải >= ngày bắt đầu', 'warn');
    return;
  }
  // Lấy lý do + ảnh của ngày hiện tại
  const e = lcEdit[ngay];
  if(!e || e.type !== 'nghi'){
    showToast('⚠ Ngày hiện tại chưa có đơn nghỉ', 'warn');
    return;
  }
  const lyDo = (e.lyDoMoi !== undefined) ? e.lyDoMoi : (e.ghiChuNV || '');
  const anhB64 = e.anhB64Moi;
  if(!lyDo || !lyDo.trim()){
    showToast('⚠ Vui lòng điền lý do nghỉ phép trước', 'warn');
    return;
  }
  // Apply cho từng ngày trong dải (chỉ ngày trong tuần hiện tại đang hiển thị)
  const ngayTuan = _ngayTuan(lcTuan);
  const ngayTrongTuan = ngayTuan.map(n => n.ngay);
  let applied = 0;
  ngayTrongTuan.forEach(d => {
    if(d < tuNgay || d > denNgay) return;
    if(d === ngay) return; // skip ngày gốc đã có
    if(!lcEdit[d]) lcEdit[d] = {};
    lcEdit[d].type = 'nghi';
    lcEdit[d].slots = [];
    lcEdit[d].lyDoMoi = lyDo;
    if(anhB64) lcEdit[d].anhB64Moi = anhB64;
    if(!lcEdit[d].trangThai) lcEdit[d].trangThai = 'Chờ duyệt';
    _markLCChanged(d);
    _rerenderLCDay(d);
    applied++;
  });
  if(applied === 0){
    showToast('⚠ Không có ngày nào trong dải hợp lệ trong tuần này', 'warn');
  } else {
    showToast(`✓ Đã áp dụng đơn cho ${applied} ngày`, 'ok');
    // Đóng range picker
    const cb = document.getElementById('lc-multi-' + ngay);
    if(cb) cb.checked = false;
    const rangeEl = document.getElementById('lc-multi-range-' + ngay);
    if(rangeEl) rangeEl.style.display = 'none';
  }
}

function _updateLCSendBtn(conHan, soNgayDienTu){
  const btn=document.getElementById('lc-btn-send');
  if(!btn)return;
  // [v10 FIX #4] Cho phép gửi khi tất cả các ngày đã điền đều là Nghỉ phép (không giới hạn tuần)
  const toanNghi = soNgayDienTu>0 && Object.keys(lcEdit).every(k=>{
    const e=lcEdit[k]; if(!e||!e.type)return true; // ngày trống thì bỏ qua
    return e.type==='nghi';
  });
  // [v10.85] Setting "cho phép gửi tuần hiện tại" → coi như conHan=true cho HIEN_TAI
  let effectiveConHan = conHan;
  if (lcData && lcData.trangThaiTuan === 'HIEN_TAI' && _getSetting('lc.cho_phep_tuan_hien_tai', false)) {
    effectiveConHan = true;
  }
  if(soNgayDienTu===0){btn.disabled=true;btn.textContent='Chọn ít nhất 1 ngày để gửi';return;}
  if(!effectiveConHan && !toanNghi){btn.disabled=true;btn.textContent='Đã qua hạn gửi lịch đi làm';return;}
  btn.disabled=false;
  if(toanNghi)      btn.textContent=`Gửi ${soNgayDienTu} đơn nghỉ phép`;
  else              btn.textContent=`Gửi lịch ${soNgayDienTu} ngày tuần này`;
}

// Gửi lịch ca [FIX v9 #4: gửi mảng phẳng, nhiều slot/ngày]
async function guiLichCa(){
  const btn=document.getElementById('lc-btn-send');
  if(!SESSION||!lcTuan||btn.disabled)return;

  // [v9.45] Chặn gửi tuần đã qua / tuần hiện tại
  // [v9.45] Ngoại lệ: tuần HIEN_TAI vẫn cho gửi NẾU toàn bộ là Nghỉ phép đột xuất
  // [v10.85] Hoặc setting 'lc.cho_phep_tuan_hien_tai' bật → cho gửi tự do tuần hiện tại
  if(lcData){
    // Kiểm tra có phải toàn nghỉ phép không
    const toanNghi = Object.keys(lcEdit).every(k=>{
      const e=lcEdit[k]; if(!e||!e.type)return true;
      return e.type==='nghi';
    }) && Object.keys(lcEdit).some(k=>lcEdit[k]&&lcEdit[k].type==='nghi');

    if(lcData.trangThaiTuan === 'DA_QUA'){
      showToast('Không thể gửi lịch cho tuần đã qua.','err');
      return;
    }
    if(lcData.trangThaiTuan === 'HIEN_TAI'){
      // [v10.85] Reload settings từ DB trước check để chắc chắn không dính cache cũ
      try { await _loadAllSettings(); } catch(e){}
      const choPhepHT = _getSetting('lc.cho_phep_tuan_hien_tai', false);
      console.log('[guiLichCa] choPhepHT=', choPhepHT, 'typeof=', typeof choPhepHT, 'toanNghi=', toanNghi);
      if (!choPhepHT && !toanNghi) {
        showToast('Tuần hiện tại chỉ cho phép gửi ĐƠN NGHỈ PHÉP đột xuất. Để đổi ca, liên hệ QLNS.','err');
        return;
      }
      // OK: choPhepHT=true → cho gửi tự do; hoặc toàn nghỉ phép → cho gửi đột xuất
    }
  }
  
  // [v9.45] Nếu quá hạn T7 nhưng vẫn cho gửi tuần sau → hỏi lý do gấp
  let lyDoGap = '';
  if(lcData && lcData.guiKhan){
    lyDoGap = prompt('Đã quá hạn Thứ 7. Vui lòng nhập LÝ DO GẤP để QLNS xem xét:\n\n(VD: Nghỉ bệnh đột xuất, đổi ca khẩn cấp, gia đình có việc...)');
    if(!lyDoGap || !lyDoGap.trim()){
      showToast('Cần nhập lý do gấp để gửi lịch quá hạn.','err');
      return;
    }
    lyDoGap = lyDoGap.trim();
  }

  // Flatten: mỗi slot = 1 entry
  const lichCaArr=[];
  const loiValidate=[];
  // [v10.85] Bỏ qua các ngày <= hôm nay (đã qua + đang trong ngày)
  // [v10.85] Chỉ gửi ngày user thực sự đã sửa (lcDaysChanged) — KHÔNG đụng ngày khác
  const _todayStr = _toDateStr(new Date());
  Object.entries(lcEdit).forEach(([ngay,e])=>{
    if(!e||!e.type)return;
    if (ngay <= _todayStr) return;
    if (!lcDaysChanged.has(ngay)) return; // ngày không sửa → không gửi
    if(e.type==='nghi'){
      // [v10 Yc #2] Nghỉ phép — gửi kèm lyDo + anhBase64 để server upload ảnh
      const ghiChuCu = e.ghiChuNV||'';
      const pipeCu   = ghiChuCu.indexOf(' | ');
      const lyDoCu   = pipeCu>=0 ? ghiChuCu.substring(0,pipeCu).trim() : ghiChuCu.trim();
      const lyDoGui  = (e.lyDoMoi!==undefined) ? e.lyDoMoi.trim() : lyDoCu;
      const anhB64   = e.anhB64Moi || '';
      const ttCu     = e.trangThai || '';
      const daCoDonCu = !!ghiChuCu;

      // Validate:
      // - Nếu chưa có đơn cũ → bắt buộc cả lý do + ảnh
      // - Nếu đã có đơn cũ (đã duyệt hoặc chờ duyệt) và không đổi gì → cho phép giữ nguyên (server sẽ lấy snapshot)
      if(!daCoDonCu){
        if(!lyDoGui){ loiValidate.push(`${ngay}: thiếu lý do nghỉ phép.`); return; }
        if(!anhB64){ loiValidate.push(`${ngay}: đơn nghỉ phép bắt buộc có ảnh đính kèm.`); return; }
      }

      lichCaArr.push({
        ngay,
        loai:LC_NGHI_PHEP,
        maCH:'', tenCH:'',
        gioBatDau:'', gioKetThuc:'',
        lyDo:     lyDoGui,
        anhBase64:anhB64,  // base64 hoặc chuỗi rỗng (server sẽ giữ snapshot)
      });
    } else {
      // Đi làm — duyệt từng slot
      const slots=e.slots||[];
      // [v11.4 LC-02] Validate trùng giờ giữa các ca trong cùng 1 ngày
      const validSlots = slots.filter(s => s.maCH || s.tenCH);
      if(validSlots.length >= 2){
        // Convert "HH:mm" → phút
        const toMin = g => {
          const p = String(g||'').split(':').map(Number);
          return p[0] * 60 + (p[1] || 0);
        };
        // Kiểm tra từng cặp slot có overlap không
        for(let i = 0; i < validSlots.length; i++){
          for(let j = i + 1; j < validSlots.length; j++){
            const s1 = validSlots[i], s2 = validSlots[j];
            const a1 = toMin(s1.gioBD), b1 = toMin(s1.gioKT);
            const a2 = toMin(s2.gioBD), b2 = toMin(s2.gioKT);
            // Overlap: max(start) < min(end)
            if(Math.max(a1, a2) < Math.min(b1, b2)){
              loiValidate.push(`Ngày ${ngay}: 2 ca trùng giờ — Ca ${i+1} (${s1.gioBD}-${s1.gioKT}) và Ca ${j+1} (${s2.gioBD}-${s2.gioKT}). Bạn không thể làm 2 nơi cùng lúc.`);
            }
          }
        }
      }
      slots.forEach(s=>{
        if(!s.maCH&&!s.tenCH)return; // bỏ slot trống
        lichCaArr.push({
          ngay,
          loai:LC_DI_LAM,
          maCH:s.maCH||'', tenCH:s.tenCH||'',
          gioBatDau:s.gioBD||'', gioKetThuc:s.gioKT||'',
          ghiChuNV:'',
        });
      });
    }
  });

  if(loiValidate.length){
    showToast(loiValidate.join('\n'),'err');
    return;
  }
  if(!lichCaArr.length){showToast('Chưa đăng ký ngày nào.','err');return;}
  btn.disabled=true;btn.innerHTML='<span class="spinner"></span>Đang gửi...';

  // [v12-P3] Upload ảnh nghỉ phép lên Storage trước (nếu có), rồi gọi RPC
  (async () => {
    for (const item of lichCaArr) {
      if (item.loai === LC_NGHI_PHEP && item.anhBase64) {
        try {
          const b64 = String(item.anhBase64).replace(/^data:image\/\w+;base64,/, '');
          const byteChars = atob(b64);
          const bytes = new Uint8Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
          const blob = new Blob([bytes], { type: 'image/jpeg' });
          const path = item.ngay + '/' + SESSION.ma + '_' + Date.now() + '.jpg';
          const { error: upErr } = await supa.storage.from('don-nghi-anh').upload(path, blob, { contentType: 'image/jpeg' });
          if (!upErr) {
            const { data: urlData } = supa.storage.from('don-nghi-anh').getPublicUrl(path);
            item.anhUrl = urlData ? urlData.publicUrl : '';
          }
        } catch(e) { console.warn('Upload ảnh nghỉ lỗi:', e); }
        delete item.anhBase64;
      }
    }
    const { data: res, error } = await supa.rpc('fn_gui_lich_ca', {
      p_ma_nv: SESSION.ma,
      p_ten_nv: SESSION.ten,
      p_tuan: lcTuan,
      p_lich_ca: lichCaArr,
      p_ly_do_gap: lyDoGap || null
    });
    if (error || !res || !res.success) {
      showToast((res && res.error) || (error && error.message) || 'Lỗi gửi lịch.','err');
      btn.disabled=false;btn.textContent='Gửi lịch tuần';
      return;
    }
    // [v9.45] Đếm distinct ngày từ FE để tránh fallback sai (so_ngay đúng, count = số slot)
    const distinctNgay = new Set(lichCaArr.map(x => x.ngay).filter(Boolean));
    const soNgay = res.so_ngay || distinctNgay.size;
    showToast('✓ Đã gửi lịch ' + soNgay + ' ngày','ok');
    taiLichCa();
  })().catch(()=>{showToast('Lỗi kết nối.','err');btn.disabled=false;btn.textContent='Gửi lịch tuần';});
}

// ═════════════════════════════════════════════════════════════
// [v9.45] MODAL ĐƠN NGHỈ PHÉP ĐỘT XUẤT (tuần hiện tại)
// ═════════════════════════════════════════════════════════════
let _dxState = { ngayChon: new Set(), anhB64: '' };

// ════════════════════════════════════════════════════════════════════════
// [v9.45] XIN ĐỔI LỊCH — Modal multi-day cho phép NV đề nghị sửa lịch
// [v10.85] REWRITE — UI giống form Gửi lịch tuần (nhiều ca/ngày, autocomplete CH, preset giờ)
// State: _xdlEdit[ngay] = { enabled, type:'work'|'nghi', slots:[{maCH,tenCH,gioBD,gioKT}], lyDoMoi, anhB64Moi }
// ════════════════════════════════════════════════════════════════════════
let _xdlEdit = {};

function openXinDoiLichModal() {
  if (!SESSION) return;
  if (!lcData) {
    showToast('Lịch chưa tải xong.', 'err');
    return;
  }
  
  // Reset state
  _xdlEdit = {};
  document.getElementById('xdl-lydo').value = '';
  
  // Set title theo tuần
  const titleEl = document.getElementById('xdl-tuan-label');
  if (titleEl) {
    if (lcData.trangThaiTuan === 'HIEN_TAI') {
      titleEl.textContent = 'Tuần hiện tại · QLNS sẽ duyệt';
    } else if (lcData.trangThaiTuan === 'TUAN_SAU') {
      titleEl.textContent = 'Tuần sau (đã chốt) · QLNS sẽ duyệt';
    } else {
      titleEl.textContent = 'Đổi ca · QLNS sẽ duyệt';
    }
  }
  
  // [v10.85 FIX] Dùng helper _ngayTuan có sẵn (lcData không có field thuHai)
  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = _toDateStr(today);
  const fullTuan = (typeof _ngayTuan === 'function' && lcTuan) ? _ngayTuan(lcTuan) : [];
  const ngayList = [];
  for (const it of fullTuan) {
    if (it.ngay < todayStr) continue;  // skip ngày đã qua
    ngayList.push({ ngay: it.ngay });
  }
  
  if (ngayList.length === 0) {
    showToast('Không còn ngày nào trong tuần để đổi.', 'err');
    return;
  }
  
  // Khởi tạo _xdlEdit với ca hiện tại làm baseline (disabled cho đến khi tích)
  ngayList.forEach(item => {
    // [v10.85] Lấy TẤT CẢ slots trong ngày (1 ngày có thể có nhiều ca)
    const cacCa = (lcData.lich || []).filter(l =>
      l.ngay === item.ngay &&
      (l.trangThai === 'DA_DUYET' || l.trangThai === 'DA_GUI' || l.trangThai === 'CHO_DUYET_THAY_THE')
    );
    let snapshot = { enabled: false, type: 'work', slots: [{maCH:'',tenCH:'',gioBD:'08:00',gioKT:'17:00'}] };
    if (cacCa.length){
      // Nếu bất kỳ slot nào là Nghỉ phép → snapshot type nghi
      const hasNghi = cacCa.some(c => c.loai === 'Nghỉ phép');
      if (hasNghi) {
        snapshot = { enabled: false, type: 'nghi', slots: [] };
      } else {
        snapshot = {
          enabled: false, type: 'work',
          slots: cacCa.map(c => ({
            maCH: c.maCh || c.ma_ch || '',
            tenCH: c.tenCh || c.ten_ch_snapshot || '',
            gioBD: (c.gioBatDau || c.gio_bat_dau || '08:00').toString().slice(0,5),
            gioKT: (c.gioKetThuc || c.gio_ket_thuc || '17:00').toString().slice(0,5),
          }))
        };
        // Fallback nếu không có slot nào hợp lệ
        if (!snapshot.slots.length){
          snapshot.slots = [{maCH:'',tenCH:'',gioBD:'08:00',gioKT:'17:00'}];
        }
      }
    }
    _xdlEdit[item.ngay] = snapshot;
  });
  
  // Render danh sách
  _renderXDLDaysList(ngayList);
  document.getElementById('xdl-modal').style.display = 'flex';
}

function _toDateStr(d) {
  return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
}

function closeXinDoiLichModal() {
  document.getElementById('xdl-modal').style.display = 'none';
}

function _renderXDLDaysList(ngayList){
  const dowLbl = ['CN','T2','T3','T4','T5','T6','T7'];
  const html = ngayList.map(item => _renderXDLDayCard(item, dowLbl)).join('');
  document.getElementById('xdl-days-list').innerHTML = html;
}

function _renderXDLDayCard(item, dowLbl){
  const d = new Date(item.ngay + 'T00:00:00');
  const dowStr = (dowLbl || ['CN','T2','T3','T4','T5','T6','T7'])[d.getDay()];
  const dayStr = pad(d.getDate()) + '/' + pad(d.getMonth()+1);
  const e = _xdlEdit[item.ngay] || {};
  const enabled = !!e.enabled;
  const type = e.type || 'work';
  
  // Ca hiện tại (info-only) — gộp nhiều ca trong ngày
  const cacCaHt = (lcData?.lich || []).filter(l =>
    l.ngay === item.ngay &&
    (l.trangThai === 'DA_DUYET' || l.trangThai === 'DA_GUI' || l.trangThai === 'CHO_DUYET_THAY_THE')
  );
  let caCuStr = 'Chưa có ca';
  if (cacCaHt.length){
    if (cacCaHt.some(c => c.loai === 'Nghỉ phép')){
      caCuStr = 'Nghỉ phép';
    } else if (cacCaHt.length === 1){
      const c = cacCaHt[0];
      const tenCh = c.tenCh || c.ten_ch_snapshot || '';
      const gbd = (c.gioBatDau || c.gio_bat_dau || '').toString().slice(0,5);
      const gkt = (c.gioKetThuc || c.gio_ket_thuc || '').toString().slice(0,5);
      caCuStr = (tenCh || 'Đi làm') + (gbd ? ' · ' + gbd + (gkt ? '–' + gkt : '') : '');
    } else {
      caCuStr = cacCaHt.length + ' ca · ' + cacCaHt.map(c => c.tenCh || c.ten_ch_snapshot || '?').filter(Boolean).slice(0,2).join(', ') + (cacCaHt.length > 2 ? '...' : '');
    }
  }
  
  // Editor body — chỉ hiện khi enabled
  let editor = '';
  if (enabled){
    if (type === 'work'){
      const slots = e.slots || [{maCH:'',tenCH:'',gioBD:'08:00',gioKT:'17:00'}];
      editor = slots.map((s, idx) => `
        <div style="border:1px solid #E2E8F0;border-radius:8px;padding:10px;margin-bottom:8px;background:#FAFBFC" data-ngay="${item.ngay}" data-idx="${idx}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span style="font-size:11.5px;font-weight:700;color:#475569">Ca ${idx+1}</span>
            ${slots.length>1?`<button type="button" onclick="xdlXoaCa('${item.ngay}',${idx})" style="background:#FEE2E2;border:none;color:#DC2626;width:22px;height:22px;border-radius:50%;font-size:14px;cursor:pointer;line-height:1">×</button>`:''}
          </div>
          <div style="position:relative;margin-bottom:6px">
            <input type="text" id="xdl-ch-inp-${item.ngay}-${idx}"
              placeholder="🔍 Nhập tên cửa hàng..." autocomplete="off"
              value="${(s.tenCH||'').replace(/"/g,'&quot;')}"
              oninput="xdlOnCHInput('${item.ngay}',${idx})"
              onfocus="xdlShowCHSuggest('${item.ngay}',${idx})"
              onblur="xdlHideCHSuggest('${item.ngay}',${idx})"
              style="width:100%;padding:8px 10px;border:1.5px solid #E2E8F0;border-radius:7px;font-size:12.5px;outline:none;box-sizing:border-box">
            <div id="xdl-ch-sug-${item.ngay}-${idx}" style="position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid #E2E8F0;border-radius:7px;margin-top:2px;max-height:180px;overflow-y:auto;display:none;z-index:10;box-shadow:0 4px 12px rgba(0,0,0,.08)"></div>
          </div>
          <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px">
            <input type="time" id="xdl-time-bd-${item.ngay}-${idx}" value="${s.gioBD||'08:00'}" onchange="xdlSetGio('${item.ngay}',${idx},'bd',this.value)"
              style="flex:1;padding:7px 8px;border:1.5px solid #E2E8F0;border-radius:7px;font-size:12.5px;outline:none">
            <span style="font-size:11px;color:#64748B">đến</span>
            <input type="time" id="xdl-time-kt-${item.ngay}-${idx}" value="${s.gioKT||'17:00'}" onchange="xdlSetGio('${item.ngay}',${idx},'kt',this.value)"
              style="flex:1;padding:7px 8px;border:1.5px solid #E2E8F0;border-radius:7px;font-size:12.5px;outline:none">
          </div>
          <div style="font-size:10.5px;color:#64748B;margin-bottom:4px">Ca:</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:4px">
            <button type="button" onclick="xdlPreset('${item.ngay}',${idx},'07:30','15:30')" style="padding:4px 8px;background:#fff;border:1px solid #E2E8F0;border-radius:6px;font-size:11px;cursor:pointer">7:30-15:30</button>
            <button type="button" onclick="xdlPreset('${item.ngay}',${idx},'08:00','14:00')" style="padding:4px 8px;background:#fff;border:1px solid #E2E8F0;border-radius:6px;font-size:11px;cursor:pointer">8:00-14:00</button>
            <button type="button" onclick="xdlPreset('${item.ngay}',${idx},'13:30','21:30')" style="padding:4px 8px;background:#fff;border:1px solid #E2E8F0;border-radius:6px;font-size:11px;cursor:pointer">13:30-21:30</button>
            <button type="button" onclick="xdlPreset('${item.ngay}',${idx},'14:00','22:00')" style="padding:4px 8px;background:#fff;border:1px solid #E2E8F0;border-radius:6px;font-size:11px;cursor:pointer">14:00-22:00</button>
          </div>
          <div style="font-size:10.5px;color:#64748B;margin-bottom:4px">Full:</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px">
            <button type="button" onclick="xdlPreset('${item.ngay}',${idx},'07:30','21:30')" style="padding:4px 8px;background:#FFF7ED;border:1px solid #FED7AA;color:#9A3412;border-radius:6px;font-size:11px;cursor:pointer">7:30-21:30</button>
            <button type="button" onclick="xdlPreset('${item.ngay}',${idx},'07:30','22:00')" style="padding:4px 8px;background:#FFF7ED;border:1px solid #FED7AA;color:#9A3412;border-radius:6px;font-size:11px;cursor:pointer">7:30-22:00</button>
            <button type="button" onclick="xdlPreset('${item.ngay}',${idx},'08:00','21:00')" style="padding:4px 8px;background:#FFF7ED;border:1px solid #FED7AA;color:#9A3412;border-radius:6px;font-size:11px;cursor:pointer">8:00-21:00</button>
          </div>
        </div>
      `).join('');
      editor += `<button type="button" onclick="xdlThemCa('${item.ngay}')" style="width:100%;padding:8px;background:#fff;border:1.5px dashed #CBD5E1;color:#475569;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer">
        + Thêm ca / cửa hàng khác
      </button>`;
    } else if (type === 'nghi'){
      editor = `
        <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:10px">
          <div style="font-size:12px;color:#991B1B;font-weight:600;margin-bottom:4px">📋 Nghỉ phép</div>
          <div style="font-size:11.5px;color:#64748B;line-height:1.5">Bạn đang đề nghị đổi ngày này thành nghỉ phép. Lý do nhập ở cuối form.</div>
        </div>`;
    }
  }
  
  // Header status badge
  let badgeHtml = '';
  if (enabled){
    if (type === 'work'){
      const cnt = (e.slots || []).filter(s => s.maCH || s.tenCH).length;
      badgeHtml = `<span style="background:#FFEDD5;color:#9A3412;padding:2px 8px;border-radius:6px;font-size:10.5px;font-weight:700">${cnt} ca</span>`;
    } else {
      badgeHtml = `<span style="background:#FEE2E2;color:#991B1B;padding:2px 8px;border-radius:6px;font-size:10.5px;font-weight:700">Nghỉ phép</span>`;
    }
  }
  
  return `
    <div style="border:${enabled?'1.5px solid #EA580C':'1.5px solid #E2E8F0'};border-radius:10px;background:${enabled?'#FFFBF7':'#fff'};transition:all .15s" id="xdl-day-${item.ngay}">
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:11px 12px">
        <input type="checkbox" ${enabled?'checked':''} onchange="xdlToggleDay('${item.ngay}', this.checked)"
          style="width:18px;height:18px;accent-color:#EA580C;cursor:pointer;flex-shrink:0">
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:#0F172A">${dowStr}, ${dayStr}</div>
          <div style="font-size:11px;color:#64748B;margin-top:1px">Hiện tại: ${caCuStr}</div>
        </div>
        ${badgeHtml}
      </label>
      <div id="xdl-day-detail-${item.ngay}" style="display:${enabled?'block':'none'};padding:0 12px 12px;border-top:1px dashed #E2E8F0;padding-top:10px">
        <!-- Type toggle: Đi làm vs Nghỉ phép -->
        <div style="display:flex;gap:6px;margin-bottom:10px">
          <button type="button" onclick="xdlSetType('${item.ngay}','work')"
            style="flex:1;padding:7px;background:${type==='work'?'#FED7AA':'#fff'};color:${type==='work'?'#9A3412':'#475569'};border:1.5px solid ${type==='work'?'#EA580C':'#E2E8F0'};border-radius:7px;font-size:12px;font-weight:600;cursor:pointer">
            Đi làm
          </button>
          <button type="button" onclick="xdlSetType('${item.ngay}','nghi')"
            style="flex:1;padding:7px;background:${type==='nghi'?'#FEE2E2':'#fff'};color:${type==='nghi'?'#991B1B':'#475569'};border:1.5px solid ${type==='nghi'?'#DC2626':'#E2E8F0'};border-radius:7px;font-size:12px;font-weight:600;cursor:pointer">
            Nghỉ phép
          </button>
        </div>
        ${editor}
      </div>
    </div>
  `;
}

function _rerenderXDLDay(ngay){
  const oldEl = document.getElementById('xdl-day-' + ngay);
  if (!oldEl) return;
  const d = new Date(ngay + 'T00:00:00');
  const tmp = document.createElement('div');
  tmp.innerHTML = _renderXDLDayCard({ ngay, dow: d.getDay() });
  const newEl = tmp.firstElementChild;
  oldEl.replaceWith(newEl);
}

function xdlToggleDay(ngay, checked){
  if (!_xdlEdit[ngay]) _xdlEdit[ngay] = { enabled: false, type: 'work', slots: [{maCH:'',tenCH:'',gioBD:'08:00',gioKT:'17:00'}] };
  _xdlEdit[ngay].enabled = !!checked;
  if (checked && !_xdlEdit[ngay].slots) _xdlEdit[ngay].slots = [{maCH:'',tenCH:'',gioBD:'08:00',gioKT:'17:00'}];
  _rerenderXDLDay(ngay);
}

function xdlSetType(ngay, type){
  if (!_xdlEdit[ngay]) _xdlEdit[ngay] = { enabled: true, type: 'work', slots: [] };
  _xdlEdit[ngay].type = type;
  if (type === 'work' && (!_xdlEdit[ngay].slots || !_xdlEdit[ngay].slots.length)){
    _xdlEdit[ngay].slots = [{maCH:'',tenCH:'',gioBD:'08:00',gioKT:'17:00'}];
  }
  _rerenderXDLDay(ngay);
}

function xdlThemCa(ngay){
  if (!_xdlEdit[ngay]) return;
  if (!_xdlEdit[ngay].slots) _xdlEdit[ngay].slots = [];
  const last = _xdlEdit[ngay].slots[_xdlEdit[ngay].slots.length - 1];
  const gioBD = last && last.gioKT ? last.gioKT : '13:00';
  _xdlEdit[ngay].slots.push({maCH:'',tenCH:'',gioBD,gioKT:'17:00'});
  _rerenderXDLDay(ngay);
}

function xdlXoaCa(ngay, idx){
  if (!_xdlEdit[ngay] || !_xdlEdit[ngay].slots) return;
  _xdlEdit[ngay].slots.splice(idx, 1);
  if (!_xdlEdit[ngay].slots.length) _xdlEdit[ngay].slots = [{maCH:'',tenCH:'',gioBD:'08:00',gioKT:'17:00'}];
  _rerenderXDLDay(ngay);
}

function xdlSetGio(ngay, idx, field, value){
  if (!_xdlEdit[ngay] || !_xdlEdit[ngay].slots || !_xdlEdit[ngay].slots[idx]) return;
  if (field === 'bd') _xdlEdit[ngay].slots[idx].gioBD = value;
  else _xdlEdit[ngay].slots[idx].gioKT = value;
}

function xdlPreset(ngay, idx, gioBD, gioKT){
  if (!_xdlEdit[ngay] || !_xdlEdit[ngay].slots || !_xdlEdit[ngay].slots[idx]) return;
  _xdlEdit[ngay].slots[idx].gioBD = gioBD;
  _xdlEdit[ngay].slots[idx].gioKT = gioKT;
  const bd = document.getElementById('xdl-time-bd-' + ngay + '-' + idx);
  const kt = document.getElementById('xdl-time-kt-' + ngay + '-' + idx);
  if (bd) bd.value = gioBD;
  if (kt) kt.value = gioKT;
}

function xdlOnCHInput(ngay, idx){
  const inp = document.getElementById('xdl-ch-inp-' + ngay + '-' + idx);
  if (!inp) return;
  const val = inp.value.trim();
  if (_xdlEdit[ngay] && _xdlEdit[ngay].slots && _xdlEdit[ngay].slots[idx]){
    _xdlEdit[ngay].slots[idx].tenCH = val;
    _xdlEdit[ngay].slots[idx].maCH = ''; // sẽ resolve khi pick suggest
  }
  xdlShowCHSuggest(ngay, idx);
}

function xdlShowCHSuggest(ngay, idx){
  const inp = document.getElementById('xdl-ch-inp-' + ngay + '-' + idx);
  const sug = document.getElementById('xdl-ch-sug-' + ngay + '-' + idx);
  if (!inp || !sug) return;
  const q = inp.value.trim().toLowerCase();
  // [v10.85] CH_LIST khai báo bằng `let` → KHÔNG tự gán vào window. Dùng trực tiếp.
  const list = (typeof CH_LIST !== 'undefined' && CH_LIST) ? CH_LIST : [];
  let matched;
  if (!q){
    // Trống → gợi ý 5 CH hay làm (dùng cache _goiYCH_cache nếu có)
    try { if (typeof _taiGoiYCH === 'function' && typeof _goiYCH_cache !== 'undefined' && !_goiYCH_cache) _taiGoiYCH(); } catch(_){}
    const goiY = (typeof _goiYCH_cache !== 'undefined' && _goiYCH_cache) ? _goiYCH_cache : [];
    if (goiY.length){
      matched = goiY.slice(0, 5).map(g => ({ ma: g.maCH, ten: g.tenCH, _goiY: true, soLan: g.soLan }));
    } else {
      matched = list.slice(0, 5);
    }
  } else {
    matched = list.filter(ch =>
      (ch.ma || '').toLowerCase().includes(q) || (ch.ten || '').toLowerCase().includes(q)
    ).slice(0, 6);
  }
  if (!matched.length){ sug.style.display = 'none'; return; }
  sug.innerHTML = matched.map(ch => {
    const badge = ch._goiY ? `<span style="font-size:10px;color:#1D9E75;margin-left:auto;font-weight:600">⭐ ${ch.soLan}× tuần qua</span>` : '';
    return `<div onmousedown="event.preventDefault();xdlPickCH('${ngay}',${idx},'${(ch.ma||'').replace(/'/g,"\\'")}','${(ch.ten||'').replace(/'/g,"\\'")}')"
       style="padding:8px 10px;cursor:pointer;font-size:12px;border-bottom:1px solid #F1F5F9;display:flex;align-items:center;gap:8px"
       onmouseenter="this.style.background='#F8FAFC'" onmouseleave="this.style.background='#fff'">
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;color:#0F172A">${ch.ten || ''}</div>
        <div style="font-size:10.5px;color:#64748B">${ch.ma || ''}</div>
      </div>${badge}
    </div>`;
  }).join('');
  sug.style.display = 'block';
}

function xdlHideCHSuggest(ngay, idx){
  setTimeout(() => {
    const sug = document.getElementById('xdl-ch-sug-' + ngay + '-' + idx);
    if (sug) sug.style.display = 'none';
  }, 200);
}

function xdlPickCH(ngay, idx, maCH, tenCH){
  if (!_xdlEdit[ngay] || !_xdlEdit[ngay].slots || !_xdlEdit[ngay].slots[idx]) return;
  _xdlEdit[ngay].slots[idx].maCH = maCH;
  _xdlEdit[ngay].slots[idx].tenCH = tenCH;
  const inp = document.getElementById('xdl-ch-inp-' + ngay + '-' + idx);
  if (inp) inp.value = tenCH;
  const sug = document.getElementById('xdl-ch-sug-' + ngay + '-' + idx);
  if (sug) sug.style.display = 'none';
}

async function submitXinDoiLich() {
  if (!SESSION || !lcData) return;
  
  // Build danh sách ngày đã chọn
  const ngayKeys = Object.keys(_xdlEdit).filter(k => _xdlEdit[k] && _xdlEdit[k].enabled);
  if (ngayKeys.length === 0) {
    showToast('Chưa chọn ngày nào.', 'err');
    return;
  }
  
  // Validate từng ngày
  const thayDoi = [];
  const errors = [];
  for (const ngay of ngayKeys){
    const e = _xdlEdit[ngay];
    if (e.type === 'nghi'){
      thayDoi.push({
        ngay, loai: 'Nghỉ phép',
        ca_lam: 'Nghỉ phép', ma_ch: null, gio_bd: null, gio_kt: null,
      });
    } else {
      // Đi làm: validate slots
      const validSlots = (e.slots || []).filter(s => s.maCH || s.tenCH);
      if (!validSlots.length){
        errors.push(`Ngày ${ngay}: chưa nhập cửa hàng.`);
        continue;
      }
      // Validate trùng giờ giữa các ca trong cùng ngày
      if (validSlots.length >= 2){
        const toMin = g => { const p = String(g||'').split(':').map(Number); return p[0]*60 + (p[1]||0); };
        for (let i = 0; i < validSlots.length; i++){
          for (let j = i+1; j < validSlots.length; j++){
            const s1 = validSlots[i], s2 = validSlots[j];
            const a1 = toMin(s1.gioBD), b1 = toMin(s1.gioKT);
            const a2 = toMin(s2.gioBD), b2 = toMin(s2.gioKT);
            if (Math.max(a1, a2) < Math.min(b1, b2)){
              errors.push(`Ngày ${ngay}: 2 ca trùng giờ (${s1.gioBD}-${s1.gioKT} và ${s2.gioBD}-${s2.gioKT}).`);
            }
          }
        }
      }
      // Push từng slot
      validSlots.forEach(s => {
        // Nếu user gõ tên CH nhưng chưa pick suggest → resolve từ CH_LIST
        let maCH = s.maCH || '';
        let tenCH = s.tenCH || '';
        if (!maCH && tenCH && typeof CH_LIST !== 'undefined' && CH_LIST){
          const match = CH_LIST.find(ch => (ch.ten || '').toLowerCase() === tenCH.toLowerCase());
          if (match){ maCH = match.ma; tenCH = match.ten; }
        }
        thayDoi.push({
          ngay, loai: 'Đi làm',
          // [v10.85 FIX] ca_lam NOT NULL trong DB → dùng "HH:MM-HH:MM" hoặc "Đi làm"
          ca_lam: (s.gioBD && s.gioKT) ? (s.gioBD + '-' + s.gioKT) : 'Đi làm',
          ma_ch: maCH || null,
          gio_bd: s.gioBD || null,
          gio_kt: s.gioKT || null,
        });
      });
    }
  }
  
  if (errors.length){
    showToast(errors.join('\n'), 'err');
    return;
  }
  if (!thayDoi.length){
    showToast('Không có ca hợp lệ nào.', 'err');
    return;
  }
  
  const lyDo = document.getElementById('xdl-lydo').value.trim();
  if (!lyDo || lyDo.length < 5) {
    showToast('Lý do tối thiểu 5 ký tự.', 'err');
    return;
  }
  
  const btn = document.getElementById('xdl-submit-btn');
  btn.disabled = true;
  btn.style.opacity = '0.6';
  btn.innerHTML = '<span>Đang gửi...</span>';
  
  try {
    const { data: res, error } = await supa.rpc('fn_xin_doi_lich', {
      p_ma_nv: SESSION.ma,
      // [v10.85 FIX BUG] SESSION dùng key 'ten' (xem fn_dang_nhap), không phải hoTen/tenNV
      p_ten_nv: SESSION.ten || SESSION.ma,
      p_tuan: lcData.tuanNam || lcData.tuan,
      p_thay_doi: thayDoi,
      p_ly_do: lyDo
    });
    
    if (error || !res || !res.success) {
      showToast((res && res.error) || (error && error.message) || 'Lỗi gửi.', 'err');
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>Gửi yêu cầu';
      return;
    }
    
    // [v10.85 FIX BUG] RPC trả 'so_ngay_moi', không phải 'so_thay_doi'
    const soNgay = res.so_ngay_moi || ngayKeys.length;
    showToast('✓ Đã gửi yêu cầu đổi ' + soNgay + ' ngày. Chờ QLNS duyệt.', 'ok');
    closeXinDoiLichModal();
    if (typeof taiLichCa === 'function') taiLichCa();
  } catch (e) {
    console.error('[XDL] Lỗi:', e);
    showToast('Lỗi kết nối: ' + e.message, 'err');
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>Gửi yêu cầu';
  }
}


async function huyDeNghiDoiLich() {
  if (!SESSION || !lcData) return;
  
  const ok = await appConfirm(
    'Hủy tất cả đề nghị đổi lịch tuần này đang chờ duyệt?',
    { title: 'Hủy đề nghị', okLabel: 'Hủy đề nghị', danger: true }
  );
  if (!ok) return;
  
  try {
    const { data: res, error } = await supa.rpc('fn_huy_de_nghi_doi_lich', {
      p_ma_nv: SESSION.ma,
      p_tuan: lcData.tuanNam || lcData.tuan
    });
    
    if (error || !res || !res.success) {
      showToast((error && error.message) || 'Lỗi hủy.', 'err');
      return;
    }
    
    showToast('✓ Đã hủy ' + res.so_huy + ' đề nghị.', 'ok');
    if (typeof taiLichCa === 'function') taiLichCa();
  } catch (e) {
    console.error('[XDL HUY] Lỗi:', e);
    showToast('Lỗi kết nối.', 'err');
  }
}

// ════════════════════════════════════════════════════════════════════════
// END XIN ĐỔI LỊCH
// ════════════════════════════════════════════════════════════════════════
