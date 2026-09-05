// ═══════════════════════════════════════════════════════════════════════════
//  THEO DÕI PHONG ĐỘ (app nhân viên) — CHỈ XEM lỗi của chính NV + cách quản lý
//  đã xử lý từng lỗi (Nhắc nhở / Nhắc nhở + biên bản / Xử lý kỷ luật) + phản hồi.
//  Chọn tháng (từ 2026-08 → tháng hiện tại). RPC: fn_diem_theo_doi_nv.
// ═══════════════════════════════════════════════════════════════════════════
let _tddThang = null;
const _TDD_MIN = '2026-08';

function _tddEsc(s){ return String(s==null?'':s).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c])); }
function _tddThangMax(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
function _tddAddMonth(ym, delta){
  let y=parseInt(ym.slice(0,4),10), m=parseInt(ym.slice(5,7),10)-1+delta;
  y+=Math.floor(m/12); m=((m%12)+12)%12;
  return y+'-'+String(m+1).padStart(2,'0');
}
function _tddThangLabel(ym){ const p=ym.split('-'); return 'Tháng '+p[1]+'/'+p[0]; }

// mã → nhãn loại lỗi
const _TDD_LOAI = { QUEN_RA:'Quên ra ca', QUEN_VAO:'Quên vào ca', THIEU_LICH:'Thiếu lịch ca',
  THIEU_ANH:'Thiếu ảnh nón', THIEU_BANGIAO:'Thiếu bàn giao', BO_SUNG:'Bổ sung ca' };
// mã hình thức → [nhãn, chữ, nền, viền]
const _TDD_HF = {
  NHAC_NHO:     ['Nhắc nhở',            '#0F6E56', '#E1F5EE', '#9FE1CB'],
  NHAC_NHO_BB:  ['Nhắc nhở + biên bản', '#92400E', '#FEF3C7', '#FCD34D'],
  KY_LUAT:      ['Xử lý kỷ luật',        '#991B1B', '#FEE2E2', '#FCA5A5']
};

function tddInitPage(){
  const root=document.getElementById('tdd-root'); if(!root) return;
  if(!_tddThang) _tddThang=_tddThangMax();
  if(_tddThang<_TDD_MIN) _tddThang=_TDD_MIN;
  tddLoad();
}
function tddDoiThang(delta){
  const moi=_tddAddMonth(_tddThang, delta);
  if(moi<_TDD_MIN || moi>_tddThangMax()) return;
  _tddThang=moi; tddLoad();
}
window.tddInitPage=tddInitPage; window.tddDoiThang=tddDoiThang; window.moTheoDoiPhongDo=function(){ goToPage('theodoi'); };

async function tddLoad(){
  const root=document.getElementById('tdd-root'); if(!root) return;
  root.innerHTML='<div style="padding:40px 20px;text-align:center;color:#9CA3AF;font-size:13px">Đang tải…</div>';
  try{
    const { data } = await supa.rpc('fn_diem_theo_doi_nv', { p_ma_nv: SESSION.ma, p_thang: _tddThang });
    if(!data || !data.ok){ root.innerHTML='<div style="padding:40px 20px;text-align:center;color:#DC2626;font-size:13px">Không tải được dữ liệu.</div>'; return; }
    _tddRender(data);
  }catch(e){ root.innerHTML='<div style="padding:40px 20px;text-align:center;color:#DC2626;font-size:13px">Lỗi: '+_tddEsc((e&&e.message)||'')+'</div>'; }
}

function _tddRender(d){
  const root=document.getElementById('tdd-root'); if(!root) return;
  const sk=(d.su_kien||[]).filter(e=>!e.da_mien);
  const daXL=sk.filter(e=>e.hinh_thuc).length;
  const diem=(d.diem!=null)?d.diem:'—';
  const dColor=(d.diem!=null&&d.diem<=5)?'#FFD9D9':(d.diem!=null&&d.diem<=6)?'#FDE68A':'#CDEBE0';
  const canPrev=(_tddAddMonth(_tddThang,-1)>=_TDD_MIN);
  const canNext=(_tddAddMonth(_tddThang, 1)<=_tddThangMax());
  const navBtn=(dir,on,txt)=>'<button '+(on?'onclick="tddDoiThang('+dir+')"':'disabled')+' style="width:30px;height:30px;border-radius:9px;border:none;background:rgba(255,255,255,'+(on?'.22':'.08')+');color:#fff;font-size:16px;font-weight:800;cursor:'+(on?'pointer':'default')+';opacity:'+(on?'1':'.4')+'">'+txt+'</button>';

  let h='<div style="background:#0F6E56;color:#fff;padding:16px 16px 15px;border-radius:0 0 18px 18px">'+
    '<div style="font-size:11px;letter-spacing:.1em;color:#9FE1CB;font-weight:700">THEO DÕI PHONG ĐỘ</div>'+
    '<div style="font-size:18px;font-weight:800;margin-top:2px">'+_tddEsc(d.ten_nv||d.ma_nv)+'</div>'+
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:3px">'+
      '<div style="font-size:12px;color:#CDEBE0">'+_tddEsc(d.ma_nv||'')+'</div>'+
      '<div style="display:flex;align-items:center;gap:8px">'+navBtn(-1,canPrev,'‹')+'<span style="font-size:12.5px;font-weight:700;min-width:96px;text-align:center">'+_tddThangLabel(_tddThang)+'</span>'+navBtn(1,canNext,'›')+'</div>'+
    '</div>'+
    '<div style="display:flex;gap:22px;margin-top:13px">'+
      '<div><div style="font-size:22px;font-weight:800;line-height:1;color:'+dColor+'">'+diem+'<span style="font-size:12px;color:#9FE1CB">/10</span></div><div style="font-size:10px;color:#9FE1CB;margin-top:3px">ĐIỂM</div></div>'+
      '<div><div style="font-size:22px;font-weight:800;line-height:1">'+(d.so_lan_bs||0)+'</div><div style="font-size:10px;color:#9FE1CB;margin-top:3px">BỔ SUNG CÔNG</div></div>'+
      '<div><div style="font-size:22px;font-weight:800;line-height:1">'+sk.length+'</div><div style="font-size:10px;color:#9FE1CB;margin-top:3px">SỐ LỖI</div></div>'+
    '</div>'+
  '</div>';

  h+='<div style="padding:14px;max-width:560px;margin:0 auto">';

  if(!sk.length){
    h+='<div style="background:#E1F5EE;border:1px solid #9FE1CB;border-radius:12px;padding:26px 18px;text-align:center;color:#0F6E56;font-size:13.5px;font-weight:600">Tháng này bạn chưa bị trừ điểm nào — giữ vững nhé!</div>';
  } else {
    h+='<div style="display:flex;gap:8px;align-items:center;background:#E1F5EE;border:1px solid #9FE1CB;border-radius:10px;padding:9px 11px;margin-bottom:12px;font-size:11.5px;color:#0F6E56;line-height:1.45">'+
       'Quản lý đã xử lý <b style="margin:0 3px">'+daXL+'/'+sk.length+'</b> lỗi. Bạn được thông báo mỗi khi quản lý xử lý một lỗi.</div>';
    h+='<div style="font-size:11.5px;font-weight:800;color:#64748B;letter-spacing:.03em;margin:2px 2px 9px">CÁC LỖI TRONG THÁNG ('+sk.length+')</div>';
    sk.forEach(e=>{
      const hf=e.hinh_thuc?_TDD_HF[e.hinh_thuc]:null;
      h+='<div style="background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:12px 13px;margin-bottom:9px">'+
        '<div style="display:flex;justify-content:space-between;align-items:baseline">'+
          '<div style="font-size:14px;font-weight:800;color:#111827">'+_tddEsc(_TDD_LOAI[e.loai]||e.loai)+'</div>'+
          '<div style="font-size:11px;color:#9CA3AF">'+_tddEsc(e.ngay||'')+'</div>'+
        '</div>'+
        '<div style="font-size:12px;color:#6B7280;margin-top:2px">'+_tddEsc(e.mo_ta||'')+'</div>'+
        '<div style="margin-top:9px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">'+
        (hf
          ? '<span style="font-size:10.5px;font-weight:700;color:'+hf[1]+';background:'+hf[2]+';border:1px solid '+hf[3]+';padding:3px 10px;border-radius:20px">'+hf[0]+'</span><span style="font-size:10.5px;color:#9CA3AF">'+(e.mac_dinh?'Mặc định':'Quản lý đã xử lý')+'</span>'
          : '<span style="font-size:10.5px;font-weight:700;color:#6B7280;background:#F3F4F6;border:1px solid #E5E7EB;padding:3px 10px;border-radius:20px">Chờ quản lý xử lý</span>')+
        '</div>'+
        (e.phan_hoi
          ? '<div style="margin-top:7px;background:#F9FAFB;border:1px solid #EEF0F2;border-radius:8px;padding:7px 10px;font-size:11.5px;color:#374151;line-height:1.5"><b style="color:'+(hf?hf[1]:'#0F6E56')+'">Phản hồi:</b> '+_tddEsc(e.phan_hoi)+'</div>'
          : '')+
      '</div>';
    });
    // chốt cuối
    const c=d.chot;
    if(c && c.hinh_thuc){
      const cf=_TDD_HF[c.hinh_thuc]||['—','#374151','#F3F4F6','#E5E7EB'];
      h+='<div style="margin-top:6px;background:#FFFFFF;border:1.5px solid '+cf[3]+';border-radius:12px;padding:12px 13px">'+
        '<div style="font-size:11.5px;font-weight:800;color:#64748B;letter-spacing:.02em;margin-bottom:7px">KẾT LUẬN CỦA QUẢN LÝ</div>'+
        '<span style="font-size:11px;font-weight:700;color:'+cf[1]+';background:'+cf[2]+';border:1px solid '+cf[3]+';padding:4px 11px;border-radius:20px">'+cf[0]+'</span>'+
        (c.phan_hoi?'<div style="margin-top:8px;font-size:12px;color:#374151;line-height:1.5">'+_tddEsc(c.phan_hoi)+'</div>':'')+
        (c.khi?'<div style="margin-top:6px;font-size:10.5px;color:#9CA3AF">'+_tddEsc(c.khi)+'</div>':'')+
      '</div>';
    }
  }
  h+='</div>';
  root.innerHTML=h;
}
