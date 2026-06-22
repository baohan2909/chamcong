// ═══════════════════════════════════════════════════════════
// TAB ĐƠN NGHỈ PHÉP CỦA NV [FIX v9 #5]
// ═══════════════════════════════════════════════════════════
let _lcnvSubTab='lich'; // 'lich' | 'nghi'
let _donCuaToi=null;
let _dnAnhB64=null; // base64 ảnh đơn đang soạn

function setLCNVSubTab(tab){
  _lcnvSubTab=tab;
  document.getElementById('lcnvsub-lich').classList.toggle('active',tab==='lich');
  document.getElementById('lcnvsub-nghi').classList.toggle('active',tab==='nghi');
  document.getElementById('lcnv-sub-lich').style.display=tab==='lich'?'':'none';
  document.getElementById('lcnv-sub-nghi').style.display=tab==='nghi'?'':'none';
  if(tab==='nghi')taiDonNghiCuaToi();
}

function taiDonNghiCuaToi(){
  if(!SESSION)return;
  const listEl=document.getElementById('lcnv-nghi-list');
  if(!listEl)return;
  listEl.innerHTML='<div class="dnp-empty">⏳ Đang tải đơn...</div>';
  // [v12-P3] Supabase RPC
  supa.rpc('fn_get_don_nghi_cua_toi', { p_ma_nv: SESSION.ma })
  .then(({ data: arr, error }) => {
    if(error || !Array.isArray(arr)){listEl.innerHTML='<div class="dnp-empty">❌ Lỗi tải.</div>';return;}
    
    // [v9.45 BUG-FIX] Group by ngày → tạo cấu trúc theoDon mà renderDonNghiCuaToi cần
    // Adapt sang format cũ: { ngay, loai, ghiChuNV (lyDo|anhUrl), trangThai, ghiChuQLNS, tenCH, maCH }
    const danhSachFlat = arr.map(d => ({
      ngay: d.ngayNghi,
      loai: 'Nghỉ phép',
      ghiChuNV: (d.lyDo||'') + (d.anhUrl ? ' | ' + d.anhUrl : ''),
      trangThai: d.trangThai,
      ghiChuQLNS: d.ghiChuQLNS || '',
      tenCH: d.tenCH || '',
      maCH: d.maCH || '',
      id: d.id
    }));
    
    // Group theo ngày
    const groupMap = {};
    danhSachFlat.forEach(don => {
      const k = don.ngay;
      if (!groupMap[k]) groupMap[k] = { ngay: k, danhSach: [], soDon: 0 };
      groupMap[k].danhSach.push(don);
      groupMap[k].soDon++;
    });
    // Sort theo ngày giảm dần (mới nhất lên đầu)
    const theoDon = Object.values(groupMap).sort((a,b) => b.ngay.localeCompare(a.ngay));
    
    _donCuaToi = {
      tongChoDuyet: arr.filter(d => d.trangThai === 'Chờ duyệt').length,
      danhSach: danhSachFlat,
      theoDon: theoDon
    };
    
    console.log('[Đơn nghỉ NV] Loaded:', arr.length, 'đơn |', theoDon.length, 'ngày');
    renderDonNghiCuaToi();
  }).catch((e)=>{
    console.error('[Đơn nghỉ NV] Lỗi:', e);
    listEl.innerHTML='<div class="dnp-empty">❌ Lỗi kết nối.</div>';
  });
}

// [v10 Yc #2] Bộ lọc thời gian cho đơn nghỉ phép của NV
let _lcnvRange='tatca'; // [v10 FIX #6] default 'Tất cả' để không bỏ sót đơn cũ/tương lai
function _getLCNVRange(){
  if(_lcnvRange==='thangnay')  return _thangNay();
  if(_lcnvRange==='thangtruoc')return _thangTruoc();
  if(_lcnvRange==='tatca')     return ['1970-01-01','2999-12-31'];
  if(_lcnvRange==='tuy'){
    const tu=document.getElementById('lcnv-tu')?.value;
    const den=document.getElementById('lcnv-den')?.value;
    const def=_thangNay();
    return [tu||def[0], den||def[1]];
  }
  return _thangNay();
}
function setLCNVRange(r){
  _lcnvRange=r;
  document.querySelectorAll('.ns-time-tab[data-lcnvrange]').forEach(b=>{
    b.classList.toggle('active',b.dataset.lcnvrange===r);
  });
  document.getElementById('lcnv-daterange').style.display=r==='tuy'?'flex':'none';
  if(r==='tuy'){
    const def=_thangNay();
    if(!document.getElementById('lcnv-tu').value) document.getElementById('lcnv-tu').value=def[0];
    if(!document.getElementById('lcnv-den').value) document.getElementById('lcnv-den').value=def[1];
  }
  renderDonNghiCuaToi();
}

function renderDonNghiCuaToi(){
  const listEl=document.getElementById('lcnv-nghi-list');
  if(!_donCuaToi||!listEl)return;
  // Cập nhật badge tab
  const cho=_donCuaToi.tongChoDuyet||0;
  const badge=document.getElementById('lcnv-donnghi-badge');
  if(badge){badge.textContent=cho>0?String(cho):'';badge.style.display=cho>0?'flex':'none';}
  // [v10] Lọc theo phạm vi thời gian
  const [tu,den]=_getLCNVRange();
  const theoDonAll=_donCuaToi.theoDon||[];
  const theoDon=theoDonAll.filter(g=>g.ngay>=tu&&g.ngay<=den);
  if(!theoDon.length){
    listEl.innerHTML='<div class="dnp-empty" style="margin-top:16px">📭 Không có đơn nào trong phạm vi.<br><span style="font-size:11px;margin-top:4px;display:inline-block;color:var(--text-m)">Chọn "Tất cả" để xem mọi đơn đã gửi.</span></div>';
    return;
  }
  const dow2=['CN','T2','T3','T4','T5','T6','T7'];
  listEl.innerHTML=theoDon.map(group=>{
    const d=new Date(group.ngay+'T00:00:00');
    const ngayFmt=dow2[d.getDay()]+', '+pad(d.getDate())+'/'+pad(d.getMonth()+1)+'/'+d.getFullYear();
    const items=group.danhSach.map(don=>{
      const badgeCls=don.trangThai==='Đã duyệt'?'dnpb-da':don.trangThai==='Từ chối'?'dnpb-tc':'dnpb-cho';
      // Parse lý do và link ảnh
      const ghiChu=don.ghiChuNV||'';
      const pipeIdx=ghiChu.indexOf(' | ');
      let lyDoTxt=ghiChu, linkAnh='';
      if(pipeIdx>=0){
        lyDoTxt=ghiChu.substring(0,pipeIdx).trim();
        linkAnh=ghiChu.substring(pipeIdx+3).trim();
      }
      const qlnsNote=don.ghiChuQLNS?`<div class="dnp-qlns-note">💬 QLNS: ${don.ghiChuQLNS}</div>`:'';
      return `<div class="dnp-item">
        <div class="dnp-item-top">
          <div class="dnp-info">
            <div class="dnp-name">${don.tenCH||don.maCH||'Đơn xin nghỉ'}</div>
            <div class="dnp-sub">${don.ngay}</div>
          </div>
          <span class="dnp-badge ${badgeCls}">${don.trangThai}</span>
        </div>
        ${lyDoTxt?`<div class="dnp-lydo"><div class="dnp-lydo-lbl">Lý do</div>${lyDoTxt}</div>`:''}
        ${linkAnh?`<div onclick="window.open('${linkAnh}','_blank')" class="dnp-anh-btn">📎 Xem ảnh đơn đã gửi</div>`:''}
        ${qlnsNote}
      </div>`;
    }).join('');
    return `<div class="dnp-day-group">
      <div class="dnp-day-head">
        <span>${ngayFmt}</span>
        <span class="dnp-day-cnt">${group.soDon} đơn</span>
      </div>
      <div class="dnp-card">${items}</div>
    </div>`;
  }).join('');
}

// ── Modal tạo đơn nghỉ phép mới ──
function moFormTaoDonNghi(){
  // Reset
  _dnAnhB64=null;
  const today=new Date();
  document.getElementById('dn-ngay').value=today.getFullYear()+'-'+pad(today.getMonth()+1)+'-'+pad(today.getDate());
  document.getElementById('dn-lydo').value='';
  document.getElementById('dn-anh-ico').textContent='📎';
  document.getElementById('dn-anh-txt').textContent='Chụp / chọn ảnh đơn';
  document.getElementById('dn-anh-sub').textContent='Bắt buộc để QLNS đối soát';
  document.getElementById('dn-anh-btn').classList.remove('done');
  document.getElementById('dn-anh-file').value='';
  document.getElementById('don-nghi-modal').classList.add('show');
}
function dongFormDonNghi(){
  document.getElementById('don-nghi-modal').classList.remove('show');
}

function xuLyAnhDonNghi(input){
  if(!input.files||!input.files[0])return;
  const file=input.files[0];
  const reader=new FileReader();
  reader.onload=e=>{
    const img=new Image();
    img.onload=()=>{
      const MAX=900;
      const scale=Math.min(1,MAX/Math.max(img.width,img.height));
      const canvas=document.createElement('canvas');
      canvas.width=Math.round(img.width*scale);
      canvas.height=Math.round(img.height*scale);
      canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
      _dnAnhB64=canvas.toDataURL('image/jpeg',0.78);
      document.getElementById('dn-anh-ico').textContent='✅';
      document.getElementById('dn-anh-txt').textContent='Đã đính kèm đơn';
      document.getElementById('dn-anh-sub').textContent='Bấm để chụp lại';
      document.getElementById('dn-anh-btn').classList.add('done');
    };
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
}

function guiDonNghiMoi(){
  const ngay=document.getElementById('dn-ngay').value;
  const lyDo=document.getElementById('dn-lydo').value.trim();
  if(!ngay){showToast('Chọn ngày xin nghỉ.','err');return;}
  if(!lyDo){showToast('Nhập lý do nghỉ.','err');return;}
  // [v10.85] Setting bắt buộc ảnh + tối thiểu trước N ngày
  const batBuocAnh = _getSetting('np.bat_buoc_anh', true);
  if((batBuocAnh === true || batBuocAnh === 'true') && !_dnAnhB64){
    showToast('Đơn nghỉ phép bắt buộc có ảnh đính kèm.','err');return;
  }
  const minTruoc = Number(_getSetting('np.toi_thieu_truoc_ngay', 0));
  if(minTruoc > 0){
    const now = new Date(); now.setHours(0,0,0,0);
    const ngayXin = new Date(ngay + 'T00:00:00');
    const diff = Math.floor((ngayXin - now) / (1000*60*60*24));
    if(diff < minTruoc){
      showToast('Phải xin nghỉ trước tối thiểu ' + minTruoc + ' ngày (hiện cách ' + diff + ' ngày).','err');return;
    }
  }
  const btn=document.getElementById('dn-btn-send');
  btn.disabled=true;btn.innerHTML='<span class="spinner"></span>Đang gửi...';

  // [v12-P3] Upload ảnh lên Storage trước, rồi gọi RPC
  (async () => {
    let anhUrl = '', anhPath = '';
    if (_dnAnhB64) {
      try {
        const b64 = String(_dnAnhB64).replace(/^data:image\/\w+;base64,/, '');
        const byteChars = atob(b64);
        const bytes = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'image/jpeg' });
        anhPath = ngay + '/' + SESSION.ma + '_' + Date.now() + '.jpg';
        const { error: upErr } = await supa.storage.from('don-nghi-anh').upload(anhPath, blob, { contentType: 'image/jpeg' });
        if (upErr) { showToast('Upload ảnh lỗi: ' + upErr.message, 'err'); btn.disabled=false; btn.textContent='Gửi đơn'; return; }
        const { data: urlData } = supa.storage.from('don-nghi-anh').getPublicUrl(anhPath);
        anhUrl = urlData ? urlData.publicUrl : '';
      } catch(e) {
        showToast('Upload ảnh lỗi.', 'err'); btn.disabled=false; btn.textContent='Gửi đơn'; return;
      }
    }
    const { data: res, error } = await supa.rpc('fn_gui_don_nghi_phep', {
      p_ma_nv: SESSION.ma,
      p_ten_nv: SESSION.ten,
      p_ngay_nghi: ngay,
      p_ly_do: lyDo,
      p_loai_nghi: 'Có lương',
      p_anh_url: anhUrl,
      p_anh_path: anhPath
    });
    btn.disabled=false;btn.textContent='Gửi đơn';
    if(error || !res || !res.success){
      showToast((res && res.error) || (error && error.message) || 'Lỗi gửi đơn.','err');
      return;
    }
    showToast('✓ Đã gửi đơn nghỉ phép','ok');
    dongFormDonNghi();
    taiDonNghiCuaToi();
  })().catch(()=>{btn.disabled=false;btn.textContent='Gửi đơn';showToast('Lỗi kết nối.','err');});
}

// ═══════════════════════════════════════════════════════════
// DASHBOARD QLNS [FIX v9 #12, v10 Yc #6: feedback rõ ràng]
// ═══════════════════════════════════════════════════════════
let _dashRange='homnay';
let _dashDebounce=null;
let _dashLoading=false;

function setDashRange(range){
  _dashRange=range;
  document.querySelectorAll('.dash-time-tab').forEach(b=>b.classList.toggle('active',b.dataset.range===range));
  document.getElementById('dash-date-range').style.display=range==='tuy'?'flex':'none';
  // [v10 Yc #6] Khi chọn "Tuỳ chọn" → set default cho input và load luôn
  if(range==='tuy'){
    const now=new Date();
    const y=now.getFullYear(),m=pad(now.getMonth()+1),d=pad(now.getDate());
    const homNay=`${y}-${m}-${d}`;
    const dauThang=`${y}-${m}-01`;
    const tuEl=document.getElementById('dash-tu');
    const denEl=document.getElementById('dash-den');
    if(!tuEl.value)  tuEl.value=dauThang;
    if(!denEl.value) denEl.value=homNay;
    taiDashboard();
  } else {
    taiDashboard();
  }
}
function taiDashboardDebounce(){
  clearTimeout(_dashDebounce);
  _dashDebounce=setTimeout(taiDashboard,400);
}
function _getDashDateRange(){
  const now=new Date();
  const y=now.getFullYear(),m=pad(now.getMonth()+1),d=pad(now.getDate());
  const homNay=`${y}-${m}-${d}`;
  if(_dashRange==='homnay')return [homNay,homNay];
  if(_dashRange==='homqua'){
    const hq=new Date(now.getTime()-86400000);
    const s=hq.getFullYear()+'-'+pad(hq.getMonth()+1)+'-'+pad(hq.getDate());
    return [s,s];
  }
  if(_dashRange==='7ngay'){
    const tu=new Date(now.getTime()-6*86400000);
    return [tu.getFullYear()+'-'+pad(tu.getMonth()+1)+'-'+pad(tu.getDate()),homNay];
  }
  if(_dashRange==='tuannay'){
    const dow=now.getDay()||7; // CN=0→7
    const thuHai=new Date(now.getTime()-(dow-1)*86400000);
    return [thuHai.getFullYear()+'-'+pad(thuHai.getMonth()+1)+'-'+pad(thuHai.getDate()),homNay];
  }
  if(_dashRange==='thangnay')return [`${y}-${m}-01`,homNay];
  if(_dashRange==='tuy'){
    const t=document.getElementById('dash-tu').value;
    const de=document.getElementById('dash-den').value;
    return [t||homNay,de||homNay];
  }
  return [homNay,homNay];
}

function taiDashboard(){
  if(_dashLoading)return; // tránh trùng request
  _dashLoading=true;
  const [tu,den]=_getDashDateRange();
  const q=document.getElementById('dash-search')?.value?.trim()||'';
  // [v10 Yc #6] Visual feedback ngay lập tức — không để người dùng tưởng "bấm không phản ứng"
  ['dash-k-tong','dash-k-dilam','dash-k-nghi','dash-k-khong',
   'dash-k-giodk','dash-k-giott','dash-k-chenh'].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.textContent='…';
  });
  document.getElementById('dash-donut').innerHTML='<text x="80" y="80" text-anchor="middle" fill="#9b9a96" font-size="11">Đang tải...</text>';
  document.getElementById('dash-bar').innerHTML='<text x="170" y="70" text-anchor="middle" fill="#9b9a96" font-size="11">Đang tải...</text>';
  document.getElementById('dash-trend').innerHTML='<text x="170" y="80" text-anchor="middle" fill="#9b9a96" font-size="11">Đang tải...</text>';
  document.getElementById('dash-rank-kv').innerHTML='<div class="dash-alert-empty">⏳ Đang tải...</div>';
  document.getElementById('dash-rank-ch').innerHTML='<div class="dash-alert-empty">⏳ Đang tải...</div>';
  document.getElementById('dash-alerts').innerHTML='<div class="dash-alert-empty">⏳ Đang tải...</div>';

  // [v12-P3] Supabase RPC. Format khác Apps Script → adapt nội bộ
  supa.rpc('fn_get_dashboard', { p_tu_ngay: tu, p_den_ngay: den, p_q: q || null })
  .then(({ data: res, error }) => {
    _dashLoading=false;
    if(error || !res){
      showToast('Dashboard: ' + (error ? error.message : 'dữ liệu rỗng'),'err');
      ['dash-k-tong','dash-k-dilam','dash-k-nghi','dash-k-khong',
       'dash-k-giodk','dash-k-giott','dash-k-chenh'].forEach(id=>{
        const el=document.getElementById(id);if(el)el.textContent='0';
      });
      return;
    }
    // Adapt sang format Apps Script gốc — keys khớp với renderDashboard
    const tq = res.tongQuan || {};
    const dashboard = {
      kpi: {
        tongNS: tq.tongNV || 0,
        diLam: tq.tongChamCong || 0,
        nghiPhep: tq.tongDonNghi || 0,
        khongHoatDong: Math.max(0, (tq.tongNV || 0) - (tq.tongChamCong || 0) - (tq.tongDonNghi || 0))
      },
      gioCong: {
        tongGioDK: tq.tongGioDK || '0g',
        tongGioTT: tq.tongGioTT || '0g',
        chenhGio: tq.chenhGio || '0g',
        tongPhutDK: tq.tongPhutDK || 0,
        tongPhutTT: tq.tongPhutTT || 0,
        chenhPct: tq.chenhPct || '—'
      },
      duLieuNgay: [],
      topKV: [],
      topCH: [],
      canhBaoMoi: (res.topNVCB || []).slice(0, 10).map(x => ({
        maNV: x.maNV, tenNV: x.tenNV, soCB: x.soCB,
        ngay: '', loaiCB: '', noiDung: 'Tổng ' + x.soCB + ' cảnh báo'
      }))
    };
    renderDashboard(dashboard);
  }).catch(err=>{
    _dashLoading=false;
    showToast('Lỗi tải dashboard: '+(err&&err.message?err.message:'network'),'err');
  });
}

function renderDashboard(d){
  const k = d.kpi || {}, gc = d.gioCong || {};
  // KPI
  document.getElementById('dash-k-tong').textContent=k.tongNS||0;
  document.getElementById('dash-k-dilam').textContent=k.diLam||0;
  document.getElementById('dash-k-nghi').textContent=k.nghiPhep||0;
  document.getElementById('dash-k-khong').textContent=k.khongHoatDong||0;
  document.getElementById('dash-k-giodk').textContent=gc.tongGioDK||'0g';
  document.getElementById('dash-k-giott').textContent=gc.tongGioTT||'0g';
  const chenh=document.getElementById('dash-k-chenh');
  chenh.textContent=gc.chenhGio||'0g';
  chenh.style.color=(gc.tongPhutTT||0)>=(gc.tongPhutDK||0)?'var(--green-m)':'var(--red)';
  document.getElementById('dash-k-chenh-lbl').textContent='Chênh lệch · '+(gc.chenhPct||'—');

  // Donut cơ cấu NS
  _renderDonut(k);
  // Bar đăng ký vs thực tế theo khu vực
  _renderBarChart(d.theoKhuVuc);
  // Line trend 7 ngày
  _renderTrendChart(d.trend7);
  // Xếp hạng
  _renderRankKV(d.theoKhuVuc);
  _renderRankCH(d.theoCuaHang);
  // Cảnh báo
  _renderDashAlerts(d.canhBao);
}

function _renderDonut(k){
  const total=k.tongNS||1;
  const parts=[
    {label:'Đi làm',   val:k.diLam,         color:'#1D9E75'},
    {label:'Nghỉ phép',val:k.nghiPhep,      color:'#C2185B'},
    {label:'Không HĐ', val:k.khongHoatDong, color:'#A32D2D'},
  ];
  const cx=80,cy=80,r=55,sw=22;
  let offset=0;
  const segs=parts.map(p=>{
    const frac=p.val/total;
    const len=2*Math.PI*r*frac;
    const gap=2*Math.PI*r-len;
    const s=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${p.color}" stroke-width="${sw}" stroke-dasharray="${len} ${gap}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"/>`;
    offset+=len;
    return s;
  }).join('');
  document.getElementById('dash-donut').innerHTML=
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#f1efe8" stroke-width="${sw}"/>${segs}
     <text x="${cx}" y="${cy-4}" text-anchor="middle" font-size="22" font-weight="700" fill="#1a1a18">${k.tongNS}</text>
     <text x="${cx}" y="${cy+14}" text-anchor="middle" font-size="10" fill="#6b6b67">Tổng</text>`;
  document.getElementById('dash-donut-legend').innerHTML=parts.map(p=>{
    const pct=total>0?((p.val/total)*100).toFixed(0):0;
    return `<div class="dash-legend-item"><span class="dash-legend-dot" style="background:${p.color}"></span><span class="dash-legend-text">${p.label}</span><span class="dash-legend-val">${p.val} (${pct}%)</span></div>`;
  }).join('');
}

function _renderBarChart(theoKV){
  if(!theoKV||!theoKV.length){
    document.getElementById('dash-bar').innerHTML='<text x="170" y="70" text-anchor="middle" fill="#9b9a96" font-size="12">Không có dữ liệu</text>';
    return;
  }
  // Chuyển giờ về phút
  const _p=s=>{const m=String(s||'').match(/(\d+)g\s*(\d+)p/);return m?parseInt(m[1])*60+parseInt(m[2]):0;};
  const data=theoKV.slice(0,5).map(k=>({
    name:k.khuVuc.length>10?k.khuVuc.substring(0,9)+'…':k.khuVuc,
    dk:_p(k.gioDK), tt:_p(k.gioTT),
  }));
  const maxV=Math.max(...data.flatMap(d=>[d.dk,d.tt]),60);
  const w=340,h=140,pl=8,pr=8,pt=10,pb=28;
  const barW=(w-pl-pr)/data.length;
  const bars=data.map((d,i)=>{
    const x=pl+i*barW;
    const hDK=Math.round((d.dk/maxV)*(h-pt-pb));
    const hTT=Math.round((d.tt/maxV)*(h-pt-pb));
    const bw=(barW-8)/2;
    return `
      <rect x="${x+2}" y="${h-pb-hDK}" width="${bw}" height="${hDK}" fill="#185FA5" rx="2"/>
      <rect x="${x+4+bw}" y="${h-pb-hTT}" width="${bw}" height="${hTT}" fill="#1D9E75" rx="2"/>
      <text x="${x+barW/2}" y="${h-10}" text-anchor="middle" font-size="9" fill="#6b6b67">${d.name}</text>`;
  }).join('');
  document.getElementById('dash-bar').innerHTML=`
    <g>${bars}</g>
    <g font-size="9" fill="#6b6b67">
      <rect x="8" y="2" width="8" height="8" fill="#185FA5" rx="1"/><text x="19" y="10">Đăng ký</text>
      <rect x="70" y="2" width="8" height="8" fill="#1D9E75" rx="1"/><text x="81" y="10">Thực tế</text>
    </g>`;
}

function _renderTrendChart(trend){
  if(!trend||!trend.length){
    document.getElementById('dash-trend').innerHTML='<text x="170" y="80" text-anchor="middle" fill="#9b9a96" font-size="12">Không có dữ liệu</text>';
    return;
  }
  const w=340,h=160,pl=28,pr=8,pt=12,pb=26;
  const maxDK=Math.max(...trend.map(t=>t.phutDK),60);
  const maxTT=Math.max(...trend.map(t=>t.phutTT),60);
  const maxV=Math.max(maxDK,maxTT);
  const sx=i=>pl+(i/(trend.length-1))*(w-pl-pr);
  const sy=v=>h-pb-(v/maxV)*(h-pt-pb);
  const lineDK=trend.map((t,i)=>`${i===0?'M':'L'}${sx(i)},${sy(t.phutDK)}`).join(' ');
  const lineTT=trend.map((t,i)=>`${i===0?'M':'L'}${sx(i)},${sy(t.phutTT)}`).join(' ');
  const dots=trend.map((t,i)=>`<circle cx="${sx(i)}" cy="${sy(t.phutTT)}" r="3" fill="#1D9E75"/><circle cx="${sx(i)}" cy="${sy(t.phutDK)}" r="2.5" fill="#185FA5"/>`).join('');
  const labels=trend.map((t,i)=>{
    const d=new Date(t.ngay+'T00:00:00');
    return `<text x="${sx(i)}" y="${h-10}" text-anchor="middle" font-size="8" fill="#6b6b67">${pad(d.getDate())}/${pad(d.getMonth()+1)}</text>`;
  }).join('');
  document.getElementById('dash-trend').innerHTML=`
    <line x1="${pl}" y1="${h-pb}" x2="${w-pr}" y2="${h-pb}" stroke="#e5e3dc"/>
    <path d="${lineDK}" stroke="#185FA5" stroke-width="2" fill="none" opacity=".6" stroke-dasharray="4 3"/>
    <path d="${lineTT}" stroke="#1D9E75" stroke-width="2.5" fill="none"/>
    ${dots}
    ${labels}
    <g font-size="9" fill="#6b6b67">
      <line x1="8" y1="5" x2="20" y2="5" stroke="#185FA5" stroke-width="2" stroke-dasharray="3 2"/><text x="24" y="8">Đăng ký</text>
      <line x1="70" y1="5" x2="82" y2="5" stroke="#1D9E75" stroke-width="2.5"/><text x="86" y="8">Thực tế</text>
    </g>`;
}

function _renderRankKV(kv){
  const el=document.getElementById('dash-rank-kv');
  if(!kv||!kv.length){el.innerHTML='<div class="dash-alert-empty">Không có dữ liệu</div>';return;}
  el.innerHTML=kv.slice(0,5).map((k,i)=>`
    <div class="dash-rank-item">
      <div class="dash-rank-idx">${i+1}</div>
      <div class="dash-rank-info">
        <div class="dash-rank-name">${k.khuVuc}</div>
        <div class="dash-rank-sub">${k.diLam}/${k.tongNV} NV đi làm · ${k.tyLeDiLam} · ${k.gioTT}</div>
      </div>
      <div class="dash-rank-val">${k.chenhGio}</div>
    </div>`).join('');
}

function _renderRankCH(ch){
  const el=document.getElementById('dash-rank-ch');
  if(!ch||!ch.length){el.innerHTML='<div class="dash-alert-empty">Không có dữ liệu</div>';return;}
  el.innerHTML=ch.slice(0,10).map((c,i)=>`
    <div class="dash-rank-item">
      <div class="dash-rank-idx">${i+1}</div>
      <div class="dash-rank-info">
        <div class="dash-rank-name">${c.tenCH}</div>
        <div class="dash-rank-sub">${c.khuVuc} · ${c.diLam}/${c.tongNV} NV · ${c.gioTT}</div>
      </div>
      <div class="dash-rank-val" style="color:${c.khongHD>0?'var(--red)':'var(--green)'}">${c.tyLeDiLam}</div>
    </div>`).join('');
}

function _renderDashAlerts(alerts){
  const el=document.getElementById('dash-alerts');
  if(!alerts||!alerts.length){el.innerHTML='<div class="dash-alert-empty">✅ Không có cảnh báo nào</div>';return;}
  const iconMap={
    CO_LICH_KHONG_TT:{cls:'warn',ico:'⏰'},
    KHONG_HOAT_DONG: {cls:'err', ico:'⚠'},
    DON_CHO_DUYET:   {cls:'info',ico:'📋'},
    CH_THIEU_NHAN_SU:{cls:'err', ico:'🏪'},
  };
  el.innerHTML=alerts.slice(0,15).map(a=>{
    const info=iconMap[a.loai]||{cls:'info',ico:'ℹ'};
    return `<div class="dash-alert-item">
      <div class="dash-alert-ico ${info.cls}">${info.ico}</div>
      <div class="dash-alert-txt">${a.noiDung}</div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════
// [v10 Yc #4] PAGE ĐƠN NGHỈ PHÉP từ menu Tài khoản
// Cho NV: xem đơn của mình
// Cho QLNS: xem/duyệt đơn tất cả (có bộ lọc + search)
// ═══════════════════════════════════════════════════════════
let _accDnpRange='tatca'; // [v10 FIX #6] default 'Tất cả'
let _accDnpData=null;

// [v16.2] Nhận diện vị trí di động (Đội SALE + Cơ Động) — dùng cho form bổ sung ca
function _bscLaDiDong(tenCH, maCH){
  if (typeof _laViTriDiDong === 'function') return _laViTriDiDong(tenCH || '', maCH || '');
  const t = (tenCH || '').trim().toLowerCase();
  const m = (maCH || '').trim().toUpperCase();
  return m === 'CODONG'
    || t.startsWith('đội sale') || t.startsWith('doi sale')
    || t.startsWith('cơ động')  || t.startsWith('co dong');
}

// [v7.0] MODAL: Xin bổ sung ca
async function moModalBoSungCa(){
  const m = document.getElementById('bsc-modal');
  if (!m) return;
  // Reset
  document.getElementById('bsc-gio').value = '';
  document.getElementById('bsc-loai').value = '';
  document.getElementById('bsc-lydo').value = '';
  document.getElementById('bsc-err').style.display = 'none';
  // [v10.85] Reset field CH thực + hidden ô
  const wrap = document.getElementById('bsc-chthuc-wrap');
  if (wrap) wrap.style.display = 'none';
  const chThucInp = document.getElementById('bsc-chthuc-inp');
  if (chThucInp) chThucInp.value = '';
  const chThucH = document.getElementById('bsc-chthuc');
  if (chThucH) chThucH.value = '';

  // [v10.85 YC#2] Mặc định chọn hôm nay
  bscChonNgay(0);

  // Load quota
  try {
    const { data } = await supa.rpc('fn_nv_quota_status', { p_ma_nv: SESSION.ma });
    const el = document.getElementById('bsc-quota');
    if (data && el) {
      if (data.quota_bo_sung_con <= 0) {
        el.innerHTML = '⛔ <strong>Đã hết quota bổ sung ca tháng này (3/3 lần)</strong>. Vui lòng liên hệ QLNS để được sửa thủ công.';
        el.style.background = '#FEF2F2';
        el.style.color = '#991B1B';
      } else {
        el.innerHTML = `Quota tháng ${data.thang}: <strong>còn ${data.quota_bo_sung_con}/3 lần</strong>`;
      }
    }
  } catch (e) {}

  // [v10.85] Load CH list vào window cache để dùng cho custom dropdown
  const inpCH = document.getElementById('bsc-ch-inp');
  if (!window._bscChList || !window._bscChList.length) {
    try {
      const { data } = await supa.from('cua_hang')
        .select('ma_ch, ten_ch, khu_vuc')
        .eq('trang_thai', 'ĐANG HOẠT ĐỘNG')
        .order('khu_vuc').order('ten_ch');
      if (data) {
        window._bscChList = data;
        window._bscChSet = new Set();
        window._bscChMap = {};
        data.forEach(ch => {
          window._bscChSet.add(ch.ma_ch);
          window._bscChMap[ch.ma_ch] = ch.ten_ch;
        });
      }
    } catch (e) {}
  }

  // Set default CH = CH mặc định của NV (hiển thị tên đẹp)
  const hiddenCH = document.getElementById('bsc-ch');
  if (inpCH && SESSION.cuaHangMa && !hiddenCH.value) {
    hiddenCH.value = SESSION.cuaHangMa;
    const ten = window._bscChMap ? window._bscChMap[SESSION.cuaHangMa] : '';
    inpCH.value = ten ? `${ten} (${SESSION.cuaHangMa})` : SESSION.cuaHangMa;
    const hint = document.getElementById('bsc-ch-hint');
    if (hint && ten) { hint.textContent = '✓ ' + ten; hint.style.color = '#059669'; }
  }

  m.style.display = 'flex';
}

// [v10.85] Bổ sung ca — custom dropdown (search-on-type) cho CH + Đội SALE
function bscOnCHInput(){
  const inp = document.getElementById('bsc-ch-inp');
  const hid = document.getElementById('bsc-ch');
  if (!inp.value.trim()) { hid.value = ''; }
  const hint = document.getElementById('bsc-ch-hint');
  if (hint) hint.textContent = '';
  bscShowCHSug();
}
function bscShowCHSug(){
  const inp = document.getElementById('bsc-ch-inp');
  const sug = document.getElementById('bsc-ch-sug');
  if (!inp || !sug) return;
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
    const isDoi = _bscLaDiDong(ch.ten_ch || '', ch.ma_ch || '');
    const tagHtml = isDoi
      ? `<span style="background:#F5F3FF;color:#7C3AED;font-size:9.5px;font-weight:700;padding:1px 6px;border-radius:4px;margin-left:6px">DI ĐỘNG</span>`
      : '';
    return `<div onmousedown="event.preventDefault();bscPickCH('${ch.ma_ch}', \`${(ch.ten_ch||'').replace(/`/g,"'")}\`)"
         style="padding:9px 11px;cursor:pointer;font-size:13px;border-bottom:1px solid #F1F5F9"
         onmouseenter="this.style.background='#F8FAFC'" onmouseleave="this.style.background='#fff'">
        <div style="font-weight:600;color:#0F172A">${(ch.ten_ch || '').replace(/</g,'&lt;')}${tagHtml}</div>
        <div style="font-size:10.5px;color:#64748B;margin-top:2px">${ch.ma_ch}${ch.khu_vuc ? ' · ' + ch.khu_vuc.replace(/</g,'&lt;') : ''}</div>
      </div>`;
  }).join('');
  sug.style.display = 'block';
}
function bscHideCHSug(){
  setTimeout(() => { const s = document.getElementById('bsc-ch-sug'); if (s) s.style.display = 'none'; }, 200);
}
function bscPickCH(ma, ten){
  document.getElementById('bsc-ch-inp').value = ten + ' (' + ma + ')';
  document.getElementById('bsc-ch').value = ma;
  document.getElementById('bsc-ch-sug').style.display = 'none';
  const hint = document.getElementById('bsc-ch-hint');
  if (hint) { hint.textContent = '✓ ' + ten; hint.style.color = '#059669'; }
  // [v16.2] Nếu chọn vị trí di động (Đội SALE hoặc Cơ Động) → hiện field CH thực
  const isDoi = _bscLaDiDong(ten, ma);
  const wrap = document.getElementById('bsc-chthuc-wrap');
  if (wrap) {
    wrap.style.display = isDoi ? '' : 'none';
    if (!isDoi) {
      document.getElementById('bsc-chthuc-inp').value = '';
      document.getElementById('bsc-chthuc').value = '';
    }
  }
}

// [v10.85] Autocomplete CH thực cho modal bổ sung ca NV
function bscOnCHThucInput() {
  const inp = document.getElementById('bsc-chthuc-inp');
  if (!inp.value.trim()) document.getElementById('bsc-chthuc').value = '';
  bscShowCHThucSug();
}
function bscShowCHThucSug() {
  const inp = document.getElementById('bsc-chthuc-inp');
  const sug = document.getElementById('bsc-chthuc-sug');
  const list = (window._bscChList || []).filter(ch => !_bscLaDiDong(ch.ten_ch || '', ch.ma_ch || ''));
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
    `<div onmousedown="event.preventDefault();bscPickCHThuc('${ch.ma_ch}', \`${(ch.ten_ch||'').replace(/`/g,"'")}\`)"
         style="padding:9px 11px;cursor:pointer;font-size:13px;border-bottom:1px solid #F1F5F9"
         onmouseenter="this.style.background='#F8FAFC'" onmouseleave="this.style.background='#fff'">
      <div style="font-weight:600;color:#0F172A">${(ch.ten_ch || '').replace(/</g,'&lt;')}</div>
      <div style="font-size:10.5px;color:#64748B;margin-top:2px">${ch.ma_ch}${ch.khu_vuc ? ' · ' + ch.khu_vuc.replace(/</g,'&lt;') : ''}</div>
    </div>`
  ).join('');
  sug.style.display = 'block';
}
function bscHideCHThucSug() {
  setTimeout(() => { const s = document.getElementById('bsc-chthuc-sug'); if (s) s.style.display = 'none'; }, 200);
}
function bscPickCHThuc(ma, ten){
  document.getElementById('bsc-chthuc-inp').value = ten + ' (' + ma + ')';
  document.getElementById('bsc-chthuc').value = ma;
  document.getElementById('bsc-chthuc-sug').style.display = 'none';
}

function dongModalBoSungCa(){
  document.getElementById('bsc-modal').style.display = 'none';
}

// [v10.85 YC#2] Chọn ngày bổ sung ca: 0 = hôm nay, -1 = hôm qua
function bscChonNgay(offset){
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const ngayStr = d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
  document.getElementById('bsc-ngay').value = ngayStr;
  const btnHN = document.getElementById('bsc-ngay-homnay');
  const btnHQ = document.getElementById('bsc-ngay-homqua');
  // [v10.85] Render label kèm ngày dd/MM
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (btnHN) btnHN.innerHTML = '<div style="font-size:13px;font-weight:600">Hôm nay</div><div style="font-size:10.5px;opacity:.85;margin-top:2px">'+pad(today.getDate())+'/'+pad(today.getMonth()+1)+'</div>';
  if (btnHQ) btnHQ.innerHTML = '<div style="font-size:13px;font-weight:600">Hôm qua</div><div style="font-size:10.5px;opacity:.85;margin-top:2px">'+pad(yesterday.getDate())+'/'+pad(yesterday.getMonth()+1)+'</div>';
  if (offset === 0){
    btnHN.style.borderColor = '#0F6E56'; btnHN.style.background = '#0F6E56'; btnHN.style.color = '#fff';
    btnHQ.style.borderColor = '#D1D5DB'; btnHQ.style.background = '#fff'; btnHQ.style.color = '#374151';
  } else {
    btnHQ.style.borderColor = '#0F6E56'; btnHQ.style.background = '#0F6E56'; btnHQ.style.color = '#fff';
    btnHN.style.borderColor = '#D1D5DB'; btnHN.style.background = '#fff'; btnHN.style.color = '#374151';
  }
}

async function guiBoSungCa(){
  const gio  = document.getElementById('bsc-gio').value;
  const loai = document.getElementById('bsc-loai').value;
  const maCH = document.getElementById('bsc-ch').value;
  const tenCHChon = document.getElementById('bsc-ch-inp').value;
  let lyDo = (document.getElementById('bsc-lydo').value || '').trim();
  const errEl = document.getElementById('bsc-err');
  errEl.style.display = 'none';

  if (!gio)  { errEl.textContent = 'Vui lòng nhập giờ chấm.'; errEl.style.display='block'; return; }
  if (!loai) { errEl.textContent = 'Vui lòng chọn loại ca.'; errEl.style.display='block'; return; }
  if (!maCH) { errEl.textContent = 'Vui lòng chọn cửa hàng.'; errEl.style.display='block'; return; }
  if (lyDo.length < 10) { errEl.textContent = 'Lý do tối thiểu 10 ký tự.'; errEl.style.display='block'; return; }

  // [v16.2] Nếu chọn vị trí di động (Đội SALE/Cơ Động) → bắt buộc nhập CH thực, lưu CH thực vào ma_ch
  let maChFinal = maCH;
  const isDoi = _bscLaDiDong(tenCHChon, maCH);
  const isCoDong = !!(isDoi && (typeof _laCoDong === 'function') && _laCoDong(tenCHChon, maCH));
  if (isDoi) {
    const maChThuc = document.getElementById('bsc-chthuc').value.trim();
    const tenChThuc = document.getElementById('bsc-chthuc-inp').value;
    if (!maChThuc) {
      errEl.textContent = 'Đã chọn vị trí di động — vui lòng chọn cửa hàng đang hỗ trợ.';
      errEl.style.display = 'block'; return;
    }
    maChFinal = maChThuc;
    const tenDoi = tenCHChon.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const tenChThucClean = tenChThuc.replace(/\s*\([^)]*\)\s*$/, '').trim();
    lyDo = `[${tenDoi}] hỗ trợ ${tenChThucClean} · ` + lyDo;
  }

  const btn = document.getElementById('bsc-btn-gui');
  btn.disabled = true; btn.textContent = 'Đang gửi...';
  try {
    const ngayBSC = document.getElementById('bsc-ngay').value;
    if (!ngayBSC){ errEl.textContent = 'Chọn ngày cần bổ sung.'; errEl.style.display='block'; btn.disabled=false; btn.textContent='Gửi yêu cầu'; return; }
    const { data, error } = await supa.rpc('fn_nv_bo_sung_ca', {
      p_ma_nv: SESSION.ma,
      p_ngay: ngayBSC,
      p_gio: gio,
      p_loai: loai,
      p_ma_ch: maChFinal,
      p_ly_do: lyDo,
      p_nguon: isCoDong ? 'CO_DONG' : null
    });
    if (error) throw error;
    if (data && data.success === false) {
      errEl.textContent = data.error || 'Lỗi gửi yêu cầu';
      errEl.style.display = 'block';
    } else {
      dongModalBoSungCa();
      showToast(`✓ Đã gửi yêu cầu bổ sung. QLNS sẽ xem xét. Quota còn ${data.quota_con_lai}/3.`, 'ok');
      // Update menu quota label
      const lbl = document.getElementById('menu-bosung-quota');
      if (lbl && data.quota_con_lai != null) lbl.textContent = 'Còn ' + data.quota_con_lai + '/3';
      taiLichSu();
    }
  } catch (e) {
    errEl.textContent = e.message || 'Lỗi kết nối';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false; btn.textContent = 'Gửi yêu cầu';
  }
}

function moDonNghiPhep(){
  if(!SESSION)return;
  goToPage('donnghi-acc');
}

function _getACCDNPRange(){
  if(_accDnpRange==='thangnay')  return _thangNay();
  if(_accDnpRange==='thangtruoc')return _thangTruoc();
  if(_accDnpRange==='30ngay')    return _30ngay();
  if(_accDnpRange==='tatca')     return ['1970-01-01','2999-12-31'];
  if(_accDnpRange==='tuy'){
    const tu=document.getElementById('accdnp-tu')?.value;
    const den=document.getElementById('accdnp-den')?.value;
    const def=_thangNay();
    return [tu||def[0], den||def[1]];
  }
  return _thangNay();
}
function setACCDNPRange(r){
  _accDnpRange=r;
  document.querySelectorAll('.ns-time-tab[data-accdnprange]').forEach(b=>{
    b.classList.toggle('active',b.dataset.accdnprange===r);
  });
  document.getElementById('accdnp-daterange').style.display=r==='tuy'?'flex':'none';
  if(r==='tuy'){
    const def=_thangNay();
    if(!document.getElementById('accdnp-tu').value) document.getElementById('accdnp-tu').value=def[0];
    if(!document.getElementById('accdnp-den').value) document.getElementById('accdnp-den').value=def[1];
  }
  taiDonNghiACC();
}

function taiDonNghiACC(){
  const isQL=SESSION&&(SESSION.vaiTro==='QLNS'||SESSION.vaiTro==='ADMIN');
  // [v13.03] QLBH cũng có quyền xem list (kiểu QLNS)
  const _role = String((SESSION && SESSION.vaiTro) || '').toUpperCase();
  const isQLBH = _role.startsWith('QLBH');
  const isCH = _role === 'CUA_HANG';
  const showListView = isQL || isQLBH || isCH;
  document.getElementById('accdnp-qlns-filter').style.display = showListView ? '' : 'none';
  const listEl=document.getElementById('accdnp-list');
  listEl.innerHTML='<div class="dnp-empty">⏳ Đang tải đơn...</div>';
  const [tu,den]=_getACCDNPRange();
  if(showListView){
    // [v12-P3] Supabase RPC
    const tt=document.getElementById('accdnp-f-tt')?.value||'';
    const q=document.getElementById('accdnp-f-search')?.value?.trim()||'';
    // [v13.05] CH truyền p_ma_ch để RPC filter server-side (thay vì client-side)
    const maCH = isCH ? (SESSION.cuaHangMa || null) : null;
    supa.rpc('fn_get_don_nghi_list', {
      p_trang_thai: tt || null,
      p_tu_ngay: tu, p_den_ngay: den,
      p_q: q || null,
      p_ma_ch: maCH
    }).then(({ data: res, error }) => {
      if(error || !res){listEl.innerHTML='<div class="dnp-empty">❌ Lỗi tải.</div>';return;}
      // Adapt: Apps Script trả {tongChoDuyet, theoDon: [{ngay, donList:[]}], theoNV: [...]}
      // RPC mới trả {tongChoDuyet, danhSach: [...]} → group theo ngày
      const ds = res.danhSach || [];
      const map = {};
      ds.forEach(d => {
        if(!map[d.ngayNghi]) map[d.ngayNghi] = [];
        map[d.ngayNghi].push({
          id: d.id,
          maNV: d.maNV,
          tenNV: d.tenNV,
          maCH: d.maCH || '', tenCH: d.cuaHang || '',
          khuVuc: d.khuVuc,
          ngay: d.ngayNghi,
          loaiNghi: d.loaiNghi,
          lyDo: d.lyDo,
          ghiChuNV: d.lyDo || '',
          anhUrl: d.anhUrl,
          trangThai: d.trangThai,
          ghiChuQLNS: d.ghiChuQLNS,
          nguoiDuyet: d.nguoiDuyet,
          createdAt: d.createdAt,
          tuan: ''
        });
      });
      const theoDon = Object.keys(map).sort().reverse().map(ngay => ({
        ngay,
        danhSach: map[ngay],
        soDon: map[ngay].length,
        soChoDuyet: map[ngay].filter(x => x.trangThai === 'Chờ duyệt').length
      }));
      _accDnpData = {
        tongChoDuyet: res.tongChoDuyet || 0,
        theoDon, theoNV: []
      };
      _renderACCDnpQL();
    }).catch((e)=>{listEl.innerHTML='<div class="dnp-empty">❌ '+((e&&e.message)||'Lỗi kết nối')+'</div>';});
  } else {
    // [v12-P3] NV xem
    supa.rpc('fn_get_don_nghi_cua_toi', { p_ma_nv: SESSION.ma })
    .then(({ data: arr, error }) => {
      if(error || !Array.isArray(arr)){listEl.innerHTML='<div class="dnp-empty">❌ Lỗi tải.</div>';return;}
      const theoDon = arr.map(d => ({
        ngay: d.ngayNghi,
        soDon: 1,
        soChoDuyet: d.trangThai === 'Chờ duyệt' ? 1 : 0,
        danhSach: [{
          id: d.id, maNV: SESSION.ma, tenNV: SESSION.ten,
          ngay: d.ngayNghi, loaiNghi: d.loaiNghi, lyDo: d.lyDo,
          anhUrl: d.anhUrl, trangThai: d.trangThai,
          ghiChuQLNS: d.ghiChuQLNS
        }]
      }));
      _accDnpData = {
        tongChoDuyet: arr.filter(d => d.trangThai === 'Chờ duyệt').length,
        theoDon: theoDon, theoNV: []
      };
      _renderACCDnpNV(tu,den);
    }).catch((e)=>{listEl.innerHTML='<div class="dnp-empty">❌ '+((e&&e.message)||'Lỗi NV')+'</div>';});
  }
}

function _renderACCDnpNV(tu,den){
  const listEl=document.getElementById('accdnp-list');
  const theoDonAll=_accDnpData.theoDon||[];
  const theoDon=theoDonAll.filter(g=>g.ngay>=tu&&g.ngay<=den);
  if(!theoDon.length){
    listEl.innerHTML='<div class="dnp-empty" style="margin-top:16px">📭 Không có đơn nào trong phạm vi.<br><span style="font-size:11px;margin-top:4px;display:inline-block;color:var(--text-m)">Chọn "Tất cả" để xem mọi đơn.</span></div>';
    return;
  }
  const dow2=['CN','T2','T3','T4','T5','T6','T7'];
  listEl.innerHTML=theoDon.map(group=>{
    const d=new Date(group.ngay+'T00:00:00');
    const ngayFmt=dow2[d.getDay()]+', '+pad(d.getDate())+'/'+pad(d.getMonth()+1)+'/'+d.getFullYear();
    const items=group.danhSach.map(don=>{
      const badgeCls=don.trangThai==='Đã duyệt'?'dnpb-da':don.trangThai==='Từ chối'?'dnpb-tc':'dnpb-cho';
      // [v8.8] Dùng lyDo + anhUrl trực tiếp từ RPC
      const lyDoTxt = don.lyDo || '';
      const linkAnh = don.anhUrl || '';
      const qlnsNote=don.ghiChuQLNS?`<div class="dnp-qlns-note">💬 QLNS: ${don.ghiChuQLNS}</div>`:'';
      return `<div class="dnp-item">
        <div class="dnp-item-top">
          <div class="dnp-info">
            <div class="dnp-name">${don.tenCH||don.maCH||'Đơn xin nghỉ'}</div>
            <div class="dnp-sub">${don.ngay}</div>
          </div>
          <span class="dnp-badge ${badgeCls}">${don.trangThai}</span>
        </div>
        ${lyDoTxt?`<div class="dnp-lydo"><div class="dnp-lydo-lbl">Lý do</div>${lyDoTxt}</div>`:''}
        ${linkAnh?`<div onclick="window.open('${linkAnh}','_blank')" class="dnp-anh-btn">📎 Xem ảnh đính kèm</div>`:''}
        ${qlnsNote}
      </div>`;
    }).join('');
    return `<div class="dnp-day-group"><div class="dnp-day-head"><span>${ngayFmt}</span><span class="dnp-day-cnt">${group.soDon} đơn</span></div><div class="dnp-card">${items}</div></div>`;
  }).join('');
}

function _renderACCDnpQL(){
  // Dùng lại logic renderDonNghiPhep nhưng đổi container
  const listEl=document.getElementById('accdnp-list');
  const theoDon=_accDnpData.theoDon||[];
  if(!theoDon.length){listEl.innerHTML='<div class="dnp-empty">📭 Không có đơn nào.</div>';return;}
  const dow2=['CN','T2','T3','T4','T5','T6','T7'];
  listEl.innerHTML=theoDon.map(group=>{
    const d=new Date(group.ngay+'T00:00:00');
    const ngayFmt=dow2[d.getDay()]+', '+pad(d.getDate())+'/'+pad(d.getMonth()+1)+'/'+d.getFullYear();
    const items=group.danhSach.map(don=>{
      const init=don.tenNV.split(' ').slice(-2).map(w=>w[0]||'').join('').toUpperCase();
      const badgeCls=don.trangThai==='Đã duyệt'?'dnpb-da':don.trangThai==='Từ chối'?'dnpb-tc':'dnpb-cho';
      // [v8.8] Dùng lyDo + anhUrl trực tiếp từ RPC
      const lyDoTxt = don.lyDo || '';
      const linkAnh = don.anhUrl || '';
      const btns=(don.trangThai==='Chờ duyệt' && (typeof _canQuanLyNS==='function' && _canQuanLyNS()))
        ? `<div class="ns-duyet-wrap" style="margin-top:8px">
             <button class="ns-btn-ok" onclick="duyetDonNghiById('${don.id}','Đã duyệt')">✓ Duyệt</button>
             <button class="ns-btn-no" onclick="duyetDonNghiById('${don.id}','Từ chối')">✗ Từ chối</button>
           </div>`
        : '';
      const qlnsNote=don.ghiChuQLNS?`<div class="dnp-qlns-note">💬 QLNS: ${don.ghiChuQLNS}</div>`:'';
      const nguoiDuyetInfo = (don.trangThai!=='Chờ duyệt' && don.nguoiDuyet)
        ? `<div style="font-size:11px;color:var(--text-m);margin-top:5px">👤 ${don.nguoiDuyet}</div>` : '';
      return `<div class="dnp-item">
        <div class="dnp-item-top">
          ${_renderAvatar(don.maNV, don.tenNV, 32)}
          <div class="dnp-info" style="flex:1;margin-left:10px">
            <div class="dnp-name">${don.tenNV} <span style="font-size:10px;font-weight:400;color:var(--text-m)">${don.maNV}</span></div>
            <div class="dnp-sub">${don.tenCH||don.maCH||'—'}${don.khuVuc?' · '+don.khuVuc:''}</div>
          </div>
          <span class="dnp-badge ${badgeCls}">${don.trangThai}</span>
        </div>
        ${lyDoTxt?`<div class="dnp-lydo"><div class="dnp-lydo-lbl">Lý do</div>${lyDoTxt}</div>`:''}
        ${linkAnh?`<div onclick="window.open('${linkAnh}','_blank')" class="dnp-anh-btn">📎 Xem ảnh đính kèm</div>`:''}
        ${nguoiDuyetInfo}
        ${qlnsNote}${btns}
      </div>`;
    }).join('');
    return `<div class="dnp-day-group"><div class="dnp-day-head"><span>${ngayFmt}</span><span class="dnp-day-cnt">${group.soDon} đơn</span></div><div class="dnp-card">${items}</div></div>`;
  }).join('');
}

// [v12-FIX] Duyệt đơn nghỉ bằng UUID trực tiếp
function duyetDonNghiById(dnId, qd){
  if(typeof _canQuanLyNS==='function' && !_canQuanLyNS()){ if(typeof showToast==='function') showToast('Chỉ QLNS hoặc Admin mới được duyệt','warn'); return; }
  let ghiChu = '';
  if(qd==='Từ chối'){
    ghiChu=prompt('Lý do từ chối đơn này?');
    if(!ghiChu)return;
  }
  // Fade out UI
  const itemEl=document.querySelector(`[data-dnitem="${dnId}"]`);
  if(itemEl){
    itemEl.style.transition='opacity .25s, max-height .25s, margin .25s';
    itemEl.style.opacity='0';itemEl.style.maxHeight='0';itemEl.style.margin='0';
    setTimeout(()=>{try{itemEl.remove();}catch(e){}},260);
  }
  // Update local data
  if(_ycData){
    _ycData.donNghi=(_ycData.donNghi||[]).filter(d=>d.id!==dnId);
    const cnt=document.getElementById('yc-bulk-count');
    if(cnt)cnt.textContent=(_ycData.donNghi||[]).length;
    if(!(_ycData.donNghi||[]).length){
      const bar=document.getElementById('yc-bulk-bar');
      if(bar)bar.style.display='none';
    }
    _updateYCDayCounts();
    // [v12-FIX] Update badge ngay lập tức
    const remainDN = (_ycData.donNghi||[]).length;
    const remainGT = (_ycData.giaiTrinh||[]).length;
    const dnBadge=document.getElementById('yc-dn-badge');
    if(dnBadge){dnBadge.textContent=remainDN>0?String(remainDN):'';dnBadge.style.display=remainDN>0?'flex':'none';}
    const accBadge=document.getElementById('acc-duyetyc-badge');
    if(accBadge){const t=remainDN+remainGT;accBadge.textContent=t>0?String(t):'';accBadge.style.display=t>0?'flex':'none';}
  }
  showToast(qd==='Đã duyệt'?'✓ Đã duyệt':'✗ Đã từ chối','ok');
  supa.rpc('fn_duyet_don_nghi',{
    p_id:dnId, p_quyet_dinh:qd,
    p_ma_nguoi_duyet:SESSION.ma,
    p_ghi_chu:ghiChu||null
  }).then(({data:res,error})=>{
    if(error||!res||!res.success) showToast('⚠ '+ ((res&&res.error)||(error&&error.message)||'Lỗi'),'warn');
    else _silentUpdateAccBadges();
  }).catch(()=>showToast('⚠ Mất kết nối','warn'));
}

// [v9.45] Duyệt đề nghị XIN ĐỔI LỊCH (cập nhật lich_ca, trigger trg_after_duyet_lich_ca tự xử lý ca cũ)
async function duyetDoiLichById(lcId, qd) {
  if(typeof _canQuanLyNS==='function' && !_canQuanLyNS()){ if(typeof showToast==='function') showToast('Chỉ QLNS hoặc Admin mới được duyệt','warn'); return; }
  let ghiChu = '';
  if (qd === 'Từ chối') {
    ghiChu = prompt('Lý do từ chối yêu cầu này?');
    if (!ghiChu) return;
  }
  
  // Fade out
  const itemEl = document.querySelector(`[data-dnitem="${lcId}"]`);
  if (itemEl) {
    itemEl.style.transition = 'opacity .25s, max-height .25s, margin .25s';
    itemEl.style.opacity = '0';
    itemEl.style.maxHeight = '0';
    itemEl.style.margin = '0';
    setTimeout(() => { try { itemEl.remove(); } catch(e) {} }, 260);
  }
  
  // Update local
  if (_ycData) {
    _ycData.donNghi = (_ycData.donNghi || []).filter(d => d.id !== lcId);
    const cnt = document.getElementById('yc-bulk-count');
    if (cnt) cnt.textContent = (_ycData.donNghi || []).length;
    if (!(_ycData.donNghi || []).length) {
      const bar = document.getElementById('yc-bulk-bar');
      if (bar) bar.style.display = 'none';
    }
    _updateYCDayCounts();
    const remainDN = (_ycData.donNghi || []).length;
    const remainGT = (_ycData.giaiTrinh || []).length;
    const dnBadge = document.getElementById('yc-dn-badge');
    if (dnBadge) { dnBadge.textContent = remainDN > 0 ? String(remainDN) : ''; dnBadge.style.display = remainDN > 0 ? 'flex' : 'none'; }
    const accBadge = document.getElementById('acc-duyetyc-badge');
    if (accBadge) { const t = remainDN + remainGT; accBadge.textContent = t > 0 ? String(t) : ''; accBadge.style.display = t > 0 ? 'flex' : 'none'; }
  }
  
  showToast(qd === 'Đã duyệt' ? '✓ Đã duyệt yêu cầu đổi lịch' : '✗ Đã từ chối', 'ok');
  
  // Update lich_ca trực tiếp — trigger trg_after_duyet_lich_ca sẽ tự xử lý ca cũ
  try {
    const newStatus = qd === 'Đã duyệt' ? 'DA_DUYET' : 'TU_CHOI';
    const updates = { 
      trang_thai: newStatus,
      nguoi_duyet: SESSION.ma
    };
    if (ghiChu) updates.ghi_chu_qlns = ghiChu;
    
    const { error } = await supa
      .from('lich_ca')
      .update(updates)
      .eq('id', lcId);
    
    if (error) {
      console.error('[Duyệt XDL] Lỗi:', error);
      showToast('⚠ Lỗi cập nhật: ' + error.message, 'warn');
      return;
    }
    _silentUpdateAccBadges();
  } catch (e) {
    console.error('[Duyệt XDL] Catch:', e);
    showToast('⚠ Mất kết nối', 'warn');
  }
}

// Hàm duyệt đơn — dùng chung cho cả QLNS page Nhân sự và page Duyệt YC
// [v11.6 Item 1] Fire-and-forget: fade out NGAY, server xử lý ngầm
function duyetDonNghi(maNV,ngay,tuan,qd,ghiChuQLNS,fromACC){
  if(qd==='Từ chối' && !ghiChuQLNS){
    ghiChuQLNS=prompt('Lý do từ chối đơn này?');
    if(!ghiChuQLNS)return;
  }
  const itemEl=document.querySelector(`[data-dnitem="${maNV}_${ngay}"]`);

  // [v11.6 Item 1] Fade out / update NGAY trước khi gửi
  if(itemEl){
    if(currentPage==='duyetyc' || currentPage==='nhansu'){
      // Fade out + remove
      itemEl.style.transition='opacity .25s, max-height .25s, margin .25s';
      itemEl.style.opacity='0';
      itemEl.style.maxHeight='0';
      itemEl.style.margin='0';
      setTimeout(() => { try { itemEl.remove(); } catch(e){} }, 260);
      // Update _ycData state NGAY
      if(_ycData){
        _ycData.donNghi = (_ycData.donNghi||[]).filter(d => !(d.maNV===maNV && d.ngay===ngay));
        const bulkCnt = document.getElementById('yc-bulk-count');
        if(bulkCnt) bulkCnt.textContent = (_ycData.donNghi||[]).length;
        if(!(_ycData.donNghi||[]).length){
          const bulkBar = document.getElementById('yc-bulk-bar');
          if(bulkBar) bulkBar.style.display='none';
        }
        _updateYCDayCounts();
      }
    } else if(currentPage==='donnghi-acc'){
      // Update trạng thái tại chỗ
      const badge=itemEl.querySelector('.dnp-badge');
      if(badge){
        badge.classList.remove('dnpb-cho');
        badge.classList.add(qd==='Đã duyệt' ? 'dnpb-ok' : 'dnpb-no');
        badge.textContent = qd==='Đã duyệt' ? '✓ Đã duyệt' : '✗ Từ chối';
      }
      const dwrap = itemEl.querySelector('.ns-duyet-wrap');
      if(dwrap) dwrap.style.display='none';
    }
  }
  showToast((qd==='Đã duyệt'?'✓ Đã duyệt':'✗ Đã từ chối'), 'ok');

  // [v12-P3] Supabase RPC
  (async () => {
    const { data: dn, error: e1 } = await supa.from('don_nghi')
      .select('id').eq('ma_nv', maNV).eq('ngay_nghi', ngay)
      .limit(1).maybeSingle();
    if (e1 || !dn) { showToast('⚠ Không tìm thấy đơn để duyệt', 'warn'); return; }
    const { data: res, error } = await supa.rpc('fn_duyet_don_nghi', {
      p_id: dn.id,
      p_quyet_dinh: qd,
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

// [v11.4 NS-01 + NS-03a] Cập nhật count trong day-header sau khi remove item
function _updateYCDayCounts(){
  document.querySelectorAll('.yc-day-header').forEach(h => {
    // Đếm dnp-item liền sau header (đến header tiếp theo)
    let count = 0;
    let next = h.nextElementSibling;
    while(next && !next.classList.contains('yc-day-header')){
      if(next.classList.contains('dnp-item') && !next.classList.contains('dnp-removed')) count++;
      next = next.nextElementSibling;
    }
    const badge = h.querySelector('.yc-day-count');
    if(badge) badge.textContent = count;
    // Nếu day không còn item nào → ẩn header
    if(count === 0) h.style.display='none';
  });
}

// ═══════════════════════════════════════════════════════════
// [v10 Yc #5] PAGE DUYỆT YÊU CẦU (QLNS/ADMIN)
// ═══════════════════════════════════════════════════════════
let _ycRange='tatca', _ycTab='donnghi', _ycData=null;

function _getYCRange(){
  if(_ycRange==='thangnay')  return _thangNay();
  if(_ycRange==='thangtruoc')return _thangTruoc();
  if(_ycRange==='30ngay')    return _30ngay();
  if(_ycRange==='tatca')     return ['1970-01-01','2999-12-31'];
  if(_ycRange==='tuy'){
    const tu=document.getElementById('yc-tu')?.value;
    const den=document.getElementById('yc-den')?.value;
    const def=_thangNay();
    return [tu||def[0], den||def[1]];
  }
  return ['1970-01-01','2999-12-31'];
}
function setYCRange(r){
  _ycRange=r;
  document.querySelectorAll('.ns-time-tab[data-ycrange]').forEach(b=>{
    b.classList.toggle('active',b.dataset.ycrange===r);
  });
  document.getElementById('yc-daterange').style.display=r==='tuy'?'flex':'none';
  if(r==='tuy'){
    const def=_thangNay();
    if(!document.getElementById('yc-tu').value) document.getElementById('yc-tu').value=def[0];
    if(!document.getElementById('yc-den').value) document.getElementById('yc-den').value=def[1];
  }
  taiDuyetYC();
}
function setYCTab(tab){
  _ycTab=tab;
  document.getElementById('yctab-donnghi').classList.toggle('active',tab==='donnghi');
  document.getElementById('yctab-giaitrinh').classList.toggle('active',tab==='giaitrinh');
  _renderYC();
}
// [v12-FIX] Filter local theo tên NV
function filterYCLocal(){
  const q = (document.getElementById('yc-filter-q')||{}).value || '';
  _renderYC(q.trim().toLowerCase());
}

// [v9.45] Fetch các đề nghị XIN ĐỔI LỊCH (lich_ca CHO_DUYET có tag [XIN ĐỔI LỊCH])
async function _fetchYeuCauDoiLich(tu, den, ttFilter) {
  try {
    // Map filter trạng thái sang enum lich_ca
    let ttArr = ['CHO_DUYET'];  // default chỉ chờ duyệt
    if (ttFilter === 'DA_DUYET') ttArr = ['DA_DUYET'];
    else if (ttFilter === 'TU_CHOI') ttArr = ['TU_CHOI'];
    else if (ttFilter === 'TAT_CA') ttArr = ['CHO_DUYET','DA_DUYET','TU_CHOI','DA_HUY'];
    
    let query = supa
      .from('lich_ca')
      .select('*')
      .like('ghi_chu_nv', '%[XIN ĐỔI LỊCH]%')
      .in('trang_thai', ttArr)
      .order('ngay', { ascending: false });
    
    if (tu) query = query.gte('ngay', tu);
    if (den) query = query.lte('ngay', den);
    
    const { data, error } = await query;
    if (error) {
      console.warn('[XDL fetch] Lỗi:', error);
      return [];
    }
    return data || [];
  } catch (e) {
    console.warn('[XDL fetch] Catch:', e);
    return [];
  }
}

function taiDuyetYC(){
  if(typeof _chanQuanLyNS==='function' && _chanQuanLyNS()) return;   // [v13.49] chỉ ADMIN/QLNS (CH-xem chờ RPC lọc theo CH)
  const content=document.getElementById('yc-content');
  content.innerHTML='<div class="dnp-empty">⏳ Đang tải...</div>';
  const [tu,den]=_getYCRange();
  const ttFilter = (document.getElementById('yc-filter-tt')||{}).value || null;
  // [v12-FIX] Truyền filter trạng thái
  // [v9.45] Parallel: fetch yêu cầu + fetch đề nghị XIN ĐỔI LỊCH
  Promise.all([
    supa.rpc('fn_get_duyet_yeu_cau', { p_tu_ngay: tu, p_den_ngay: den, p_trang_thai: ttFilter || null }),
    _fetchYeuCauDoiLich(tu, den, ttFilter)
  ])
  .then(([ycRes, doiLichArr]) => {
    const { data: res, error } = ycRes;
    if(error || !res){content.innerHTML='<div class="dnp-empty">❌ Lỗi tải.</div>';return;}
    
    // [v9.45] Convert lich_ca XIN ĐỔI LỊCH thành format giống donNghi để inject vào UI
    const doiLichItems = (doiLichArr || []).map(lc => {
      // Parse lý do (loại bỏ prefix [XIN ĐỔI LỊCH])
      let lyDoTxt = lc.ghi_chu_nv || '';
      lyDoTxt = lyDoTxt.replace('[XIN ĐỔI LỊCH]', '').trim();
      
      // Mô tả ca cũ → ca mới
      const caCu = lc._ca_cu || '';
      const caMoi = lc.loai === 'Nghỉ phép' 
        ? 'Nghỉ phép' 
        : (lc.ca_lam || 'Đi làm') + (lc.ten_ch_snapshot ? ' · ' + lc.ten_ch_snapshot : '');
      
      return {
        id: lc.id, 
        maNV: lc.ma_nv, 
        tenNV: lc.ten_nv_snapshot || lc.ma_nv,
        cuaHang: lc.ten_ch_snapshot || '',
        khuVuc: lc._khu_vuc || '',
        ngay: lc.ngay, 
        loaiNghi: 'Yêu cầu đổi lịch',  // Phân biệt với đơn nghỉ thường
        lyDo: lyDoTxt,
        anhUrl: '',
        trangThai: lc.trang_thai || 'CHO_DUYET',
        nguoiDuyet: '',
        ghiChuQLNS: lc.ghi_chu_qlns || '',
        ghiChuNV: lyDoTxt,
        maCH: lc.ma_ch || '',
        tenCH: lc.ten_ch_snapshot || '',
        createdAt: lc.created_at,
        tuan: lc.tuan_nam || '',
        _isXinDoiLich: true,  // Flag để render badge cam
        _caCu: caCu,
        _caMoi: caMoi,
        _loaiCaMoi: lc.loai,
        _caLamMoi: lc.ca_lam
      };
    });
    
    // Adapt
    _ycData = {
      donNghi: [
        // Đề nghị XIN ĐỔI LỊCH lên đầu (cam, ưu tiên)
        ...doiLichItems,
        // Đơn nghỉ phép thường
        ...(res.donNghi || []).map(d => ({
          id: d.id, maNV: d.maNV, tenNV: d.tenNV, cuaHang: d.cuaHang,
          khuVuc: d.khuVuc || '',
          ngay: d.ngayNghi, loaiNghi: d.loaiNghi, lyDo: d.lyDo, anhUrl: d.anhUrl,
          trangThai: d.trangThai || 'CHO_DUYET',
          nguoiDuyet: d.nguoiDuyet || '',
          ghiChuQLNS: d.ghiChuQLNS || '',
          ghiChuNV: d.lyDo || '',
          maCH: '', tenCH: d.cuaHang || '',
          createdAt: d.createdAt, tuan: '',
          _isXinDoiLich: false
        }))
      ],
      giaiTrinh: (res.giaiTrinh || []).map(g => ({
        cbId: g.cbId, maNV: g.maNV, tenNV: g.tenNV, cuaHang: g.cuaHang,
        maCh: g.maCh || '', chamCongId: g.chamCongId || '',
        khuVuc: g.khuVuc || '',
        ngay: g.ngay, gio: g.gio, loaiCB: g.loaiCB,
        noiDung: g.noiDung, giaiTrinh: g.giaiTrinh,
        trangThai: g.trangThai || 'DA_GIAI_TRINH',
        nguoiDuyet: g.nguoiDuyet || '',
        thoiGianGiaiTrinh: g.thoiGianGiaiTrinh
      })),
      soDonNghi: doiLichItems.length + (res.donNghi || []).length,
      soGiaiTrinh: (res.giaiTrinh || []).length
    };
    const sDN=_ycData.soDonNghi||0;
    const sGT=_ycData.soGiaiTrinh||0;
    const dnBadge=document.getElementById('yc-dn-badge');
    const gtBadge=document.getElementById('yc-gt-badge');
    if(dnBadge){dnBadge.textContent=sDN>0?String(sDN):'';dnBadge.style.display=sDN>0?'flex':'none';}
    if(gtBadge){gtBadge.textContent=sGT>0?String(sGT):'';gtBadge.style.display=sGT>0?'flex':'none';}
    const accBadge=document.getElementById('acc-duyetyc-badge');
    if(accBadge){
      const tot=sDN+sGT;
      accBadge.textContent=tot>0?String(tot):'';
      accBadge.style.display=tot>0?'flex':'none';
    }
    _renderYC();
  }).catch(()=>{content.innerHTML='<div class="dnp-empty">❌ Lỗi kết nối.</div>';});
}

function _renderYC(filterQ){
  const content=document.getElementById('yc-content');
  if(!_ycData){return;}
  const bulkBar=document.getElementById('yc-bulk-bar');
  const bulkCnt=document.getElementById('yc-bulk-count');
  let ds = _ycTab==='donnghi' ? (_ycData.donNghi||[]) : (_ycData.giaiTrinh||[]);
  // [v12-FIX] Filter local theo tên/mã NV
  if(filterQ){
    ds = ds.filter(d => (d.tenNV||'').toLowerCase().includes(filterQ) || (d.maNV||'').toLowerCase().includes(filterQ));
  }
  const ttFilter = (document.getElementById('yc-filter-tt')||{}).value || '';
  // Hiện/ẩn nút duyệt tất cả: chỉ khi filter = chờ duyệt
  if(bulkBar){
    if(ds.length>0 && !ttFilter){
      bulkBar.style.display='flex';
      if(bulkCnt)bulkCnt.textContent=ds.length;
    } else bulkBar.style.display='none';
  }

  // [v11.4 NS-01] Group theo ngày → sort theo ngày DESC, mỗi nhóm sort theo tên ASC
  const grouped = {};
  ds.forEach(d => {
    const k = d.ngay || '0000-00-00';
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(d);
  });
  const ngayList = Object.keys(grouped).sort().reverse(); // mới nhất trước
  ngayList.forEach(k => grouped[k].sort((a, b) => (a.tenNV || '').localeCompare(b.tenNV || '', 'vi')));

  // Format ngày VN
  const fmtNgay = (s) => {
    if (!s) return '';
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return s;
    const d = new Date(m[1] + '-' + m[2] + '-' + m[3]);
    const dow = ['Chủ nhật','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'][d.getDay()];
    return `${dow}, ${m[3]}/${m[2]}/${m[1]}`;
  };

  if(_ycTab==='donnghi'){
    if(!ds.length){content.innerHTML='<div class="dnp-empty">✅ Không có đơn nghỉ chờ duyệt.</div>';return;}
    let html = '<div class="dnp-list">';
    ngayList.forEach(k => {
      html += `<div class="yc-day-header"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;vertical-align:-2px"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ${fmtNgay(k)} <span class="yc-day-count">${grouped[k].length}</span></div>`;
      html += grouped[k].map(d => {
        const init=d.tenNV.split(' ').slice(-2).map(w=>w[0]||'').join('').toUpperCase();
        const lyDo=d.ghiChuNV||'';
        let lyDoTxt=lyDo, linkAnh='';
        const pipeIdx=lyDo.indexOf(' | ');
        if(pipeIdx>=0){lyDoTxt=lyDo.substring(0,pipeIdx).trim();linkAnh=lyDo.substring(pipeIdx+3).trim();}
        return `<div class="dnp-item ${d._isXinDoiLich?'xdl-item':''}" data-dnitem="${d.id||d.maNV+'_'+d.ngay}"${d._isXinDoiLich?' style="border-left:3px solid #EA580C;background:linear-gradient(to right,#FFF7ED 0%,#FFFFFF 50%)"':''}>
          ${d._isXinDoiLich ? `<div style="display:inline-flex;align-items:center;gap:5px;background:#EA580C;color:#fff;font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:99px;margin-bottom:6px;letter-spacing:0.2px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>YÊU CẦU ĐỔI LỊCH</div>` : ''}
          <div class="dnp-item-top">
            ${_renderAvatar(d.maNV, d.tenNV, 32)}
            <div class="dnp-info" style="flex:1;margin-left:10px">
              <div class="dnp-name">${d.tenNV} <span style="font-size:10px;font-weight:400;color:var(--text-m)">${d.maNV}</span></div>
              <div class="dnp-sub">${d.tenCH||d.maCH||'—'}${d.khuVuc?' · '+d.khuVuc:''}</div>
            </div>
            <span class="dnp-badge ${d.trangThai==='DA_DUYET'?'dnpb-dd':d.trangThai==='TU_CHOI'?'dnpb-tc':'dnpb-cho'}">${d.trangThai==='DA_DUYET'?'Đã duyệt':d.trangThai==='TU_CHOI'?'Từ chối':'Chờ duyệt'}</span>
          </div>
          ${d._isXinDoiLich && d._caMoi ? `<div style="margin-top:8px;padding:8px 10px;background:#fff;border-radius:8px;border:1px solid #FED7AA;font-size:12px"><div style="color:#9A3412;font-weight:600;font-size:11px;margin-bottom:3px">Đổi thành:</div><div style="color:#7C2D12">${d._caMoi}</div></div>` : ''}
          ${lyDoTxt?`<div class="dnp-lydo"><div class="dnp-lydo-lbl">Lý do</div>${lyDoTxt}</div>`:''}
          ${linkAnh?`<div onclick="window.open('${linkAnh}','_blank')" class="dnp-anh-btn">📎 Xem ảnh đơn đính kèm</div>`:''}
          ${(d.trangThai==='CHO_DUYET' && (typeof _canQuanLyNS==='function' && _canQuanLyNS()))?`<div class="ns-duyet-wrap" style="margin-top:8px">
            <button class="ns-btn-ok" onclick="${d._isXinDoiLich?`duyetDoiLichById('${d.id}','Đã duyệt')`:`duyetDonNghiById('${d.id}','Đã duyệt')`}">✓ Duyệt</button>
            <button class="ns-btn-no" onclick="${d._isXinDoiLich?`duyetDoiLichById('${d.id}','Từ chối')`:`duyetDonNghiById('${d.id}','Từ chối')`}">✗ Từ chối</button>
          </div>`:(d.nguoiDuyet?`<div style="font-size:11px;color:var(--text-m);margin-top:6px">Duyệt bởi: ${d.nguoiDuyet}${d.ghiChuQLNS?' · '+d.ghiChuQLNS:''}</div>`:'')}
        </div>`;
      }).join('');
    });
    html += '</div>';
    content.innerHTML = html;
  } else {
    // Giải trình cảnh báo
    if(!ds.length){content.innerHTML='<div class="dnp-empty">✅ Không có giải trình chờ duyệt.</div>';return;}
    // [v11.6 Item 4] Sort phụ: đã giải trình lên TRÊN, chưa giải trình xuống DƯỚI
    ngayList.forEach(k => {
      grouped[k].sort((a, b) => {
        const aDaGT = a.giaiTrinh ? 1 : 0;
        const bDaGT = b.giaiTrinh ? 1 : 0;
        if (aDaGT !== bDaGT) return bDaGT - aDaGT; // Đã GT (1) lên trước
        return (a.tenNV || '').localeCompare(b.tenNV || '', 'vi');
      });
    });
    let html = '<div class="dnp-list">';
    ngayList.forEach(k => {
      html += `<div class="yc-day-header"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;vertical-align:-2px"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ${fmtNgay(k)} <span class="yc-day-count">${grouped[k].length}</span></div>`;
      html += grouped[k].map(d => {
        const init=d.tenNV.split(' ').slice(-2).map(w=>w[0]||'').join('').toUpperCase();
        const cbId = d.cbId || d.cbRowIdx || '';
        const badgeCls = d.giaiTrinh ? 'dnpb-cho' : 'dnpb-tc';
        const badgeTxt = d.giaiTrinh ? 'Đã giải trình' : 'Chưa giải trình';
        return `<div class="dnp-item" data-gtitem="${cbId}">
          <div class="dnp-item-top">
            ${_renderAvatar(d.maNV, d.tenNV, 32)}
            <div class="dnp-info" style="flex:1;margin-left:10px">
              <div class="dnp-name">${d.tenNV} <span style="font-size:10px;font-weight:400;color:var(--text-m)">${d.maNV}</span></div>
              <div class="dnp-sub">${d.gio} · ${d.loaiCB}${d.khuVuc?' · '+d.khuVuc:''}</div>
            </div>
            <span class="dnp-badge ${d.trangThai==='DA_DUYET'?'dnpb-dd':d.trangThai==='TU_CHOI'?'dnpb-tc':badgeCls}">${d.trangThai==='DA_DUYET'?'Đã duyệt':d.trangThai==='TU_CHOI'?'Từ chối':badgeTxt}</span>
          </div>
          <div class="dnp-lydo"><div class="dnp-lydo-lbl">Nội dung CB</div>${d.noiDung.replace(/\n/g,'<br>')}</div>
          ${d.giaiTrinh?`<div class="dnp-lydo"><div class="dnp-lydo-lbl">Giải trình của NV</div>${d.giaiTrinh}</div>`:'<div class="dnp-lydo" style="color:var(--red)"><div class="dnp-lydo-lbl">⚠ NV chưa giải trình</div>Khuyến nghị: chờ NV giải trình trước khi duyệt</div>'}
          ${(d.trangThai==='DA_GIAI_TRINH'||d.trangThai==='CHUA_GIAI_TRINH') && (typeof _canQuanLyNS==='function' && _canQuanLyNS())?`<div class="ns-duyet-wrap" style="margin-top:8px">
            <button class="ns-btn-ok" onclick="duyetGiaiTrinhYC('${d.maNV}','${d.ngay}','Duyệt','${cbId}')">✓ Duyệt</button>
            <button class="ns-btn-no" onclick="duyetGiaiTrinhYC('${d.maNV}','${d.ngay}','Không duyệt','${cbId}')">✗ Không duyệt</button>
            ${(d.loaiCB==='BỔ SUNG CA')?`<button class="ns-btn-edit" onclick='moModalSuaCB(${JSON.stringify({cbId:d.cbId,maCh:d.maCh,cuaHang:d.cuaHang,gio:d.gio,ngay:d.ngay,noiDung:d.noiDung}).replace(/'/g,"&#39;")})'><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Sửa</button>`:''}
          </div>`:(d.nguoiDuyet?`<div style="font-size:11px;color:var(--text-m);margin-top:6px">Duyệt bởi: ${d.nguoiDuyet}</div>`:'')}
        </div>`;
      }).join('');
    });
    html += '</div>';
    content.innerHTML = html;
  }
}

// [v10.85 Yc #1] Duyệt hàng loạt — confirm → batch API → toast kèm nút Hoàn tác 24h
async function duyetTatCa(action){
  if(!_ycData)return;
  const items = _ycTab==='donnghi' ? (_ycData.donNghi||[]) : (_ycData.giaiTrinh||[]);
  if(!items.length){showToast('Không có mục để duyệt.','err');return;}
  const loai = _ycTab==='donnghi' ? 'DON_NGHI' : 'GIAI_TRINH';
  let qd, verb;
  if(_ycTab==='donnghi'){
    qd = action==='ok' ? 'Đã duyệt' : 'Từ chối';
    verb = action==='ok' ? 'duyệt' : 'từ chối';
  } else {
    qd = action==='ok' ? 'Duyệt' : 'Không duyệt';
    verb = action==='ok' ? 'duyệt' : 'không duyệt';
  }
  // [v11.4 NS-03b/LC-03c] App-style confirm
  const ok = await appConfirm(
    `${verb} tất cả ${items.length} yêu cầu?\nBạn có thể Hoàn tác trong 24h.`,
    { title: `${qd} hàng loạt`, okLabel: qd, danger: action!=='ok' }
  );
  if(!ok) return;
  let ghiChuQLNS='';
  if(action==='no' && _ycTab==='donnghi'){
    ghiChuQLNS=prompt('Lý do từ chối chung (áp dụng cho tất cả):');
    if(!ghiChuQLNS)return;
  }
  // Mờ toàn bộ list + bulk bar
  document.querySelectorAll('#yc-content .dnp-item').forEach(el=>el.classList.add('duyet-processing'));
  const bulkBar=document.getElementById('yc-bulk-bar');
  if(bulkBar)bulkBar.style.opacity='.5';
  // [v12-P3] Supabase RPC
  (async () => {
    let ids = [];
    if (loai === 'GIAI_TRINH') {
      ids = items.map(d => d.cbId).filter(Boolean);
    } else {
      ids = items.map(d => d.id).filter(Boolean);
    }

    if(!ids.length){
      // Fallback: duyệt từng item bằng RPC riêng
      let ok = 0;
      for(const it of items){
        try {
          if(loai === 'GIAI_TRINH'){
            const { data: r } = await supa.rpc('fn_duyet_canh_bao', {
              p_ma_nv: it.maNV, p_ngay: it.ngay, p_quyet_dinh: qd,
              p_ma_nguoi_duyet: SESSION.ma, p_cb_id: null, p_loai_cb: null, p_gio: null
            });
            if(r && r.success) ok++;
          } else {
            const { data: r } = await supa.rpc('fn_duyet_don_nghi', {
              p_id: it.id || null, p_quyet_dinh: qd,
              p_ma_nguoi_duyet: SESSION.ma, p_ghi_chu: ghiChuQLNS || null
            });
            if(r && r.success) ok++;
          }
        } catch(e){}
      }
      if(bulkBar)bulkBar.style.opacity='1';
      showToast(`✓ Đã ${verb} ${ok}/${items.length} yêu cầu.`, ok>0?'ok':'warn');
      taiDuyetYC();
      _silentUpdateAccBadges();
      return;
    }
    const { data: res, error } = await supa.rpc('fn_duyet_batch', {
      p_loai: loai,
      p_quyet_dinh: qd,
      p_ma_nguoi_duyet: SESSION.ma,
      p_ids: ids,
      p_ghi_chu_qlns: ghiChuQLNS || null
    });
    if(bulkBar)bulkBar.style.opacity='1';
    if(!error && res && res.success){
      const successMsg = `✓ Đã ${verb} ${res.count}/${items.length} yêu cầu.`;
      showToast(successMsg, 'ok');
      taiDuyetYC();
      _silentUpdateAccBadges();
    } else {
      document.querySelectorAll('#yc-content .dnp-item').forEach(el=>el.classList.remove('duyet-processing'));
      showToast((res&&res.error)||(error&&error.message)||'Lỗi batch.','err');
    }
  })().catch(()=>{
    if(bulkBar)bulkBar.style.opacity='1';
    document.querySelectorAll('#yc-content .dnp-item').forEach(el=>el.classList.remove('duyet-processing'));
    showToast('Lỗi kết nối.','err');
  });
}

// [v10.85 Yc #1 UNDO] Toast kèm nút Hoàn tác — lưu token vào localStorage 24h
const UNDO_LS_KEY='_undoTokens';
function _layUndoTokens(){
  try{
    const arr=JSON.parse(localStorage.getItem(UNDO_LS_KEY)||'[]');
    const now=Date.now();
    return arr.filter(t=>t.expiresAt>now);
  } catch(e){return [];}
}
function _luuUndoToken(token, expiresAt, label){
  const arr=_layUndoTokens();
  arr.push({token, expiresAt, label, createdAt:Date.now()});
  localStorage.setItem(UNDO_LS_KEY, JSON.stringify(arr));
}
function _xoaUndoToken(token){
  const arr=_layUndoTokens().filter(t=>t.token!==token);
  localStorage.setItem(UNDO_LS_KEY, JSON.stringify(arr));
}
function showToastVoiHoanTac(msg, token, expiresAt){
  if(!token){showToast(msg,'ok');return;}
  // Lưu token để có thể gọi lại từ menu
  _luuUndoToken(token, expiresAt, msg);
  let t=document.getElementById('_toast_undo');
  if(!t){
    t=document.createElement('div');t.id='_toast_undo';
    t.style.cssText='position:fixed;bottom:100px;left:50%;transform:translateX(-50%);padding:12px 18px;border-radius:12px;background:var(--green,#1D9E75);color:white;font-size:13px;font-weight:600;z-index:3001;max-width:340px;box-shadow:0 4px 16px rgba(0,0,0,.2);display:flex;align-items:center;gap:12px';
    document.body.appendChild(t);
  }
  t.innerHTML=`<span style="flex:1">${msg}</span><button style="background:rgba(255,255,255,.25);color:white;border:none;padding:6px 12px;border-radius:8px;font-weight:700;cursor:pointer;font-size:12px" onclick="hoanTacDuyet('${token}')">↩ Hoàn tác</button>`;
  t.style.display='flex';
  clearTimeout(t._h);t._h=setTimeout(()=>{t.style.display='none';},15000); // hiện 15s
}
async function hoanTacDuyet(token){
  // [v11.4 NS-03b] App-style confirm
  const ok = await appConfirm(
    'Các yêu cầu đã duyệt sẽ trở lại trạng thái chờ duyệt.',
    { title: 'Hoàn tác duyệt?', okLabel: 'Hoàn tác', danger: true }
  );
  if(!ok) return;
  // [v12-P3] Tạm thời chưa hỗ trợ undo
  showToast('Tính năng hoàn tác chưa được hỗ trợ trong phiên bản này.', 'warn');
  _xoaUndoToken(token);
  const t=document.getElementById('_toast_undo');if(t)t.style.display='none';
}

function duyetGiaiTrinhYC(maNV,ngay,quyetDinh,cbId){
  if(typeof _canQuanLyNS==='function' && !_canQuanLyNS()){ if(typeof showToast==='function') showToast('Chỉ QLNS hoặc Admin mới được duyệt','warn'); return; }
  // Remove item từ UI ngay
  const itemEl=document.querySelector(`[data-gtitem="${cbId}"]`);
  if(itemEl){
    itemEl.style.transition='opacity .25s, max-height .25s, margin .25s';
    itemEl.style.opacity='0';
    itemEl.style.maxHeight='0';
    itemEl.style.margin='0';
    setTimeout(() => { try { itemEl.remove(); } catch(e){} }, 260);
  }
  // Update _ycData state
  if(_ycData){
    _ycData.giaiTrinh = (_ycData.giaiTrinh||[]).filter(d => d.cbId !== cbId);
    const bulkCnt = document.getElementById('yc-bulk-count');
    if(bulkCnt) bulkCnt.textContent = (_ycData.giaiTrinh||[]).length;
    if(!(_ycData.giaiTrinh||[]).length){
      const bulkBar = document.getElementById('yc-bulk-bar');
      if(bulkBar) bulkBar.style.display='none';
    }
    _updateYCDayCounts();
    // [v12-FIX] Badge update ngay
    const rGT=(_ycData.giaiTrinh||[]).length;
    const rDN=(_ycData.donNghi||[]).length;
    const gtB=document.getElementById('yc-gt-badge');
    if(gtB){gtB.textContent=rGT>0?String(rGT):'';gtB.style.display=rGT>0?'flex':'none';}
    const aB=document.getElementById('acc-duyetyc-badge');
    if(aB){const t=rGT+rDN;aB.textContent=t>0?String(t):'';aB.style.display=t>0?'flex':'none';}
  }
  showToast('✓ Đã cập nhật', 'ok');
  // Supabase RPC
  const isUuid = String(cbId).match(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
  supa.rpc('fn_duyet_canh_bao', {
    p_ma_nv: maNV, p_ngay: ngay, p_quyet_dinh: quyetDinh,
    p_ma_nguoi_duyet: SESSION.ma,
    p_cb_id: isUuid ? cbId : null,
    p_loai_cb: null, p_gio: null
  }).then(({ data: res, error }) => {
    if(error || !res || !res.success){
      showToast('⚠ ' + ((res && res.error) || (error && error.message) || 'Lỗi server'), 'warn');
    } else {
      _silentUpdateAccBadges();
    }
  }).catch(()=>{
    showToast('⚠ Mất kết nối', 'warn');
  });
}
