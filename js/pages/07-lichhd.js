// ════════════════════════════════════════════════════════════════════
// [v17.24] LỊCH HOẠT ĐỘNG CỬA HÀNG
//  - Cửa hàng: đăng ký Mở/Đóng 7 ngày của tuần (mặc định tuần kế tiếp) + lịch sử
//  - Admin/BQL: lưới toàn hệ thống (CH × 7 ngày) + bộ lọc khu vực/tìm kiếm/đổi tuần
//  RPC: fn_get_lich_hd_ch · fn_gui_lich_hd_ch · fn_lich_hd_ch_lichsu · fn_lich_hd_ch_all
// ════════════════════════════════════════════════════════════════════

// ── Helpers tuần ISO ──────────────────────────────────────────────
function lhdMondayOf(d){ const x=new Date(d); const day=(x.getDay()+6)%7; x.setDate(x.getDate()-day); x.setHours(0,0,0,0); return x; }
function lhdAddDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function lhdFmtDate(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function lhd7Days(monday){ const nm=['T2','T3','T4','T5','T6','T7','CN']; const out=[]; for(let i=0;i<7;i++){ const d=lhdAddDays(monday,i); out.push({ngay:lhdFmtDate(d),thu:i+2,dow:nm[i],ngayNum:d.getDate(),thang:d.getMonth()+1}); } return out; }
function lhdISOWeek(monday){
  const d=new Date(Date.UTC(monday.getFullYear(),monday.getMonth(),monday.getDate()));
  d.setUTCDate(d.getUTCDate()+3); // thứ Năm của tuần
  let ft=new Date(Date.UTC(d.getUTCFullYear(),0,4));
  ft.setUTCDate(ft.getUTCDate()-((ft.getUTCDay()+6)%7)+3); // thứ Năm tuần 1
  const w=1+Math.round((d-ft)/(7*86400000));
  return d.getUTCFullYear()+'-W'+String(w).padStart(2,'0');
}
function lhdRangeLabel(days){ const a=days[0],b=days[6]; const p=n=>String(n).padStart(2,'0'); return `${p(a.ngayNum)}/${p(a.thang)} – ${p(b.ngayNum)}/${p(b.thang)}`; }
function lhdTuanLabel(tuan){ if(!tuan) return ''; const m=String(tuan).match(/W(\d+)/); return 'Tuần '+(m?parseInt(m[1]):tuan); }
function lhdFmtDT(t){ if(!t) return ''; const d=new Date(t); const p=n=>String(n).padStart(2,'0'); return `${p(d.getDate())}/${p(d.getMonth()+1)} ${p(d.getHours())}:${p(d.getMinutes())}`; }
function lhdRelLabel(monday){ const cur=lhdMondayOf(new Date()); const diff=Math.round((monday-cur)/(7*86400000)); return diff===0?'Tuần này':diff===1?'Tuần kế tiếp':lhdTuanLabel(lhdISOWeek(monday)); }

// ════════════════════════════════════════════════════════════════
//  CỬA HÀNG — đăng ký lịch
// ════════════════════════════════════════════════════════════════
let lhdSelMonday=null, lhdTuan='', lhdEdit={}, lhdData=null, lhdSub='dangky';

function moLichHD(){ goToPage('lichhd-ch'); lhdSub='dangky'; lhdSelMonday=lhdAddDays(lhdMondayOf(new Date()),7); taiLichHD(); }

function lhdDoiTuan(delta){
  const cur=lhdMondayOf(new Date()); const next=lhdAddDays(cur,7);
  let m=lhdAddDays(lhdSelMonday, delta*7);
  if(m<cur) m=cur; if(m>next) m=next;   // chỉ cho tuần này + tuần kế tiếp
  lhdSelMonday=m; taiLichHD();
}

function lhdRenderSubtabs(){
  const el=document.getElementById('lhd-subtabs'); if(!el) return;
  const b=(a)=>`flex:1;padding:10px;border:none;border-bottom:2.5px solid ${a?'#1D9E75':'transparent'};background:none;font-size:13.5px;font-weight:700;color:${a?'#0F6E56':'#94A3B8'};cursor:pointer`;
  el.innerHTML=`<button onclick="lhdSetSub('dangky')" style="${b(lhdSub==='dangky')}">Đăng ký lịch</button>
    <button onclick="lhdSetSub('lichsu')" style="${b(lhdSub==='lichsu')}">Lịch sử</button>`;
}
window.lhdSetSub=function(s){ lhdSub=s; taiLichHD(); };

async function taiLichHD(){
  lhdRenderSubtabs();
  const cont=document.getElementById('lhd-content'); if(!cont) return;
  if(lhdSub==='lichsu') return taiLichHDLichSu();
  const maCH=SESSION&&SESSION.cuaHangMa;
  if(!maCH){ cont.innerHTML='<div class="ns-empty">Tài khoản này không gắn với cửa hàng nào.</div>'; return; }
  cont.innerHTML='<div class="ns-empty">⏳ Đang tải...</div>';
  lhdTuan=lhdISOWeek(lhdSelMonday);
  try{
    const {data,error}=await supa.rpc('fn_get_lich_hd_ch',{p_ma_ch:maCH,p_tuan:lhdTuan});
    if(error) throw error;
    lhdData=data||{};
    const days=lhd7Days(lhdSelMonday);
    const saved=Array.isArray(lhdData.lich)?lhdData.lich:null;
    lhdEdit={};
    days.forEach(dd=>{ const f=saved?saved.find(x=>x.ngay===dd.ngay):null; lhdEdit[dd.ngay]=(f&&f.tt==='DONG')?'DONG':'MO'; });
    renderLichHD();
  }catch(e){ cont.innerHTML=`<div class="ns-empty" style="color:#DC2626">Lỗi: ${escHtml(e.message)}</div>`; }
}

function setLHDDay(ngay,tt){ lhdEdit[ngay]=tt; renderLichHD(); }

function renderLichHD(){
  const cont=document.getElementById('lhd-content'); if(!cont) return;
  const days=lhd7Days(lhdSelMonday);
  const submitted=lhdData&&lhdData.submitted_at;
  const moCount=days.filter(dd=>(lhdEdit[dd.ngay]||'MO')==='MO').length;
  const cur=lhdMondayOf(new Date()); const next=lhdAddDays(cur,7);
  const canPrev=lhdSelMonday>cur, canNext=lhdSelMonday<next;
  cont.innerHTML=`
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
      <button onclick="lhdDoiTuan(-1)" ${canPrev?'':'disabled'} style="border:1px solid #D1D5DB;background:${canPrev?'#fff':'#F1F5F9'};color:${canPrev?'#334155':'#CBD5E1'};border-radius:9px;width:36px;height:36px;cursor:${canPrev?'pointer':'default'};font-size:18px;flex:none">‹</button>
      <div style="flex:1;text-align:center;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:8px 10px">
        <div style="font-size:11.5px;color:#15803D;font-weight:700;letter-spacing:.03em">${lhdRelLabel(lhdSelMonday).toUpperCase()}</div>
        <div style="font-size:15px;font-weight:800;color:#0F2E45;margin-top:1px">${lhdRangeLabel(days)}</div>
      </div>
      <button onclick="lhdDoiTuan(1)" ${canNext?'':'disabled'} style="border:1px solid #D1D5DB;background:${canNext?'#fff':'#F1F5F9'};color:${canNext?'#334155':'#CBD5E1'};border-radius:9px;width:36px;height:36px;cursor:${canNext?'pointer':'default'};font-size:18px;flex:none">›</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">${days.map(dd=>lhdDayRow(dd)).join('')}</div>
    <div style="margin-top:14px;font-size:13px;color:#475569;text-align:center">
      <b style="color:#15803D">${moCount}</b> ngày Mở · <b style="color:#B91C1C">${7-moCount}</b> ngày Đóng
      ${submitted?` · Đã gửi ${lhdFmtDT(lhdData.submitted_at)}`:''}
    </div>
    <button id="lhd-submit" onclick="guiLichHD()" style="width:100%;margin-top:12px;padding:14px;border:none;border-radius:12px;background:linear-gradient(135deg,#1D9E75,#0F6E56);color:#fff;font-size:15px;font-weight:700;cursor:pointer">
      ${submitted?'Cập nhật lịch tuần':'Gửi lịch tuần'}
    </button>
    <div style="margin-top:10px;font-size:11.5px;color:#94A3B8;text-align:center;line-height:1.5">Hoàn tất đăng ký tuần kế tiếp trước Chủ Nhật. Có thể chỉnh lại trong tuần khi cần.</div>`;
}

function lhdDayRow(dd){
  const cur=lhdEdit[dd.ngay]||'MO'; const mo=cur==='MO', dong=cur==='DONG'; const p=n=>String(n).padStart(2,'0');
  return `<div style="display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:10px 12px">
    <div style="flex:none;width:60px">
      <div style="font-size:14px;font-weight:800;color:#0F2E45">${dd.dow}</div>
      <div style="font-size:11px;color:#94A3B8">${p(dd.ngayNum)}/${p(dd.thang)}</div>
    </div>
    <div style="flex:1;display:flex;gap:8px">
      <button onclick="setLHDDay('${dd.ngay}','MO')" style="flex:1;padding:9px;border-radius:9px;font-size:13.5px;font-weight:700;cursor:pointer;border:1.5px solid ${mo?'#1D9E75':'#E2E8F0'};background:${mo?'#1D9E75':'#fff'};color:${mo?'#fff':'#94A3B8'}">Mở</button>
      <button onclick="setLHDDay('${dd.ngay}','DONG')" style="flex:1;padding:9px;border-radius:9px;font-size:13.5px;font-weight:700;cursor:pointer;border:1.5px solid ${dong?'#DC2626':'#E2E8F0'};background:${dong?'#FEE2E2':'#fff'};color:${dong?'#B91C1C':'#94A3B8'}">Đóng</button>
    </div>
  </div>`;
}

async function guiLichHD(){
  const btn=document.getElementById('lhd-submit');
  const maCH=SESSION&&SESSION.cuaHangMa;
  if(!maCH){ showToast('Tài khoản không gắn cửa hàng.','err'); return; }
  const days=lhd7Days(lhdSelMonday);
  const lich=days.map(dd=>({ngay:dd.ngay,thu:dd.thu,tt:(lhdEdit[dd.ngay]||'MO')}));
  if(btn){ btn.disabled=true; btn.textContent='Đang gửi...'; }
  try{
    const {data,error}=await supa.rpc('fn_gui_lich_hd_ch',{
      p_ma_ch:maCH, p_ten_ch:(SESSION.cuaHangTen||''), p_khu_vuc:(window.SESSION_KV||null),
      p_tuan:lhdTuan, p_lich:lich, p_nguoi_gui_ma:SESSION.ma, p_nguoi_gui_ten:SESSION.ten
    });
    if(error||!data||!data.success){ showToast((data&&data.error)||(error&&error.message)||'Lỗi gửi lịch.','err'); if(btn){btn.disabled=false;btn.textContent='Gửi lịch tuần';} return; }
    showToast('✓ Đã gửi lịch hoạt động','ok');
    taiLichHD();
  }catch(e){ showToast('Lỗi kết nối.','err'); if(btn){btn.disabled=false;btn.textContent='Gửi lịch tuần';} }
}

async function taiLichHDLichSu(){
  const cont=document.getElementById('lhd-content'); if(!cont) return;
  const maCH=SESSION&&SESSION.cuaHangMa;
  if(!maCH){ cont.innerHTML='<div class="ns-empty">Tài khoản không gắn cửa hàng.</div>'; return; }
  cont.innerHTML='<div class="ns-empty">⏳ Đang tải...</div>';
  try{
    const {data,error}=await supa.rpc('fn_lich_hd_ch_lichsu',{p_ma_ch:maCH,p_limit:30});
    if(error) throw error;
    const arr=Array.isArray(data)?data:[];
    if(!arr.length){ cont.innerHTML='<div class="ns-empty">Chưa có lịch sử đăng ký.</div>'; return; }
    cont.innerHTML=arr.map(w=>lhdHistoryCard(w)).join('');
  }catch(e){ cont.innerHTML=`<div class="ns-empty" style="color:#DC2626">Lỗi: ${escHtml(e.message)}</div>`; }
}

function lhdHistoryCard(w){
  const lich=Array.isArray(w.lich)?w.lich:[]; const nm=['T2','T3','T4','T5','T6','T7','CN'];
  return `<div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:12px 14px;margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div style="font-size:14px;font-weight:800;color:#0F2E45">${lhdTuanLabel(w.tuan)} <span style="font-size:11px;color:#94A3B8;font-weight:500">(${escHtml(w.tuan||'')})</span></div>
      <div style="font-size:11px;color:#94A3B8">${w.submitted_at?lhdFmtDT(w.submitted_at):''}</div>
    </div>
    <div style="display:flex;gap:5px">${nm.map((n,i)=>{ const d=lich.find(x=>x.thu===i+2)||lich[i]; const mo=!d||d.tt!=='DONG';
      return `<div style="flex:1;text-align:center"><div style="font-size:10px;color:#94A3B8;margin-bottom:3px">${n}</div><div style="padding:6px 0;border-radius:7px;font-size:11px;font-weight:700;background:${mo?'#DCFCE7':'#FEE2E2'};color:${mo?'#15803D':'#B91C1C'}">${mo?'Mở':'Đóng'}</div></div>`; }).join('')}</div>
  </div>`;
}

// ════════════════════════════════════════════════════════════════
//  ADMIN / BQL — lưới toàn hệ thống
// ════════════════════════════════════════════════════════════════
let lhdqlMonday=null, lhdqlTuan='', lhdqlKV='', lhdqlQ='', lhdqlData=[];

function moLichHDQL(){ goToPage('lichhd-ql'); lhdqlMonday=lhdAddDays(lhdMondayOf(new Date()),7); lhdqlKV=''; lhdqlQ=''; taiLichHDQL(); }
function lhdqlDoiTuan(delta){ lhdqlMonday=lhdAddDays(lhdqlMonday,delta*7); taiLichHDQL(); }
window.lhdqlSetKV=function(v){ lhdqlKV=v; renderLichHDQL(); };

async function taiLichHDQL(){
  const cont=document.getElementById('lhdql-content'); if(!cont) return;
  lhdqlTuan=lhdISOWeek(lhdqlMonday);
  cont.innerHTML=lhdqlFilterBar()+'<div class="ns-empty">⏳ Đang tải...</div>';
  try{
    const {data,error}=await supa.rpc('fn_lich_hd_ch_all',{p_tuan:lhdqlTuan,p_khu_vuc:null});
    if(error) throw error;
    lhdqlData=Array.isArray(data)?data:[];
    renderLichHDQL();
  }catch(e){ cont.innerHTML=lhdqlFilterBar()+`<div class="ns-empty" style="color:#DC2626">Lỗi: ${escHtml(e.message)}</div>`; }
}

function lhdqlFilterBar(){
  const days=lhd7Days(lhdqlMonday);
  const kvs=[...new Set(lhdqlData.map(r=>r.khu_vuc).filter(Boolean))].sort();
  const sel='border:1px solid #D1D5DB;border-radius:9px;padding:8px 10px;font-size:12.5px;background:#fff;color:#334155';
  return `<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:4px">
    <div style="display:flex;align-items:center;gap:8px">
      <button onclick="lhdqlDoiTuan(-1)" style="border:1px solid #D1D5DB;background:#fff;border-radius:9px;width:34px;height:34px;cursor:pointer;font-size:16px;flex:none">‹</button>
      <div style="flex:1;text-align:center;font-size:14px;font-weight:800;color:#0F2E45">${lhdRelLabel(lhdqlMonday)} · ${lhdRangeLabel(days)}</div>
      <button onclick="lhdqlDoiTuan(1)" style="border:1px solid #D1D5DB;background:#fff;border-radius:9px;width:34px;height:34px;cursor:pointer;font-size:16px;flex:none">›</button>
    </div>
    <div style="display:flex;gap:8px">
      <select onchange="lhdqlSetKV(this.value)" style="${sel};flex:none;max-width:46%">
        <option value="">Tất cả khu vực</option>
        ${kvs.map(k=>`<option value="${escHtml(k)}"${lhdqlKV===k?' selected':''}>${escHtml(k)}</option>`).join('')}
      </select>
      <input value="${escHtml(lhdqlQ)}" oninput="lhdqlQ=this.value" onkeyup="if(event.key==='Enter')renderLichHDQL()" onchange="renderLichHDQL()" placeholder="Tìm cửa hàng..." style="${sel};flex:1">
    </div>
  </div>`;
}

function renderLichHDQL(){
  const cont=document.getElementById('lhdql-content'); if(!cont) return;
  const days=lhd7Days(lhdqlMonday); const nm=['T2','T3','T4','T5','T6','T7','CN']; const p=n=>String(n).padStart(2,'0');
  let rows=lhdqlData;
  if(lhdqlKV) rows=rows.filter(r=>r.khu_vuc===lhdqlKV);
  if(lhdqlQ.trim()){ const q=lhdqlQ.trim().toLowerCase(); rows=rows.filter(r=>((r.ten_ch||'')+' '+(r.ma_ch||'')).toLowerCase().includes(q)); }
  const daGui=rows.filter(r=>r.submitted_at).length, chuaGui=rows.length-daGui;
  const head=`<div style="display:flex;position:sticky;top:0;background:#0F6E56;color:#fff;font-size:11px;font-weight:700;z-index:1">
    <div style="flex:none;width:132px;padding:8px 10px">Cửa hàng (${rows.length})</div>
    ${days.map((dd,i)=>`<div style="flex:1;min-width:42px;text-align:center;padding:7px 2px;border-left:1px solid rgba(255,255,255,.15)">${nm[i]}<div style="font-size:9px;opacity:.85;font-weight:500">${p(dd.ngayNum)}/${p(dd.thang)}</div></div>`).join('')}
  </div>`;
  const body=rows.length?rows.map(r=>lhdqlRow(r,days)).join(''):'<div class="ns-empty">Không có cửa hàng phù hợp.</div>';
  cont.innerHTML=lhdqlFilterBar()+`
    <div style="display:flex;gap:8px;margin:10px 0;font-size:12px">
      <span style="background:#DCFCE7;color:#15803D;padding:4px 11px;border-radius:99px;font-weight:700">Đã gửi: ${daGui}</span>
      <span style="background:#FEF3C7;color:#92400E;padding:4px 11px;border-radius:99px;font-weight:700">Chưa gửi: ${chuaGui}</span>
    </div>
    <div style="overflow-x:auto;border:1px solid #E2E8F0;border-radius:8px">${head}${body}</div>`;
}

function lhdqlRow(r,days){
  const lich=Array.isArray(r.lich)?r.lich:null; const sent=!!r.submitted_at;
  return `<div style="display:flex;border-top:1px solid #F1F5F9;font-size:11px;background:${sent?'#fff':'#FFFBEB'}">
    <div style="flex:none;width:132px;padding:7px 10px;overflow:hidden">
      <div style="font-weight:700;color:#0F2E45;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(r.ten_ch||r.ma_ch)}</div>
      <div style="font-size:9px;color:#94A3B8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(r.khu_vuc||'')}${sent?'':' · chưa gửi'}</div>
    </div>
    ${days.map((dd,i)=>{
      if(!sent||!lich) return `<div style="flex:1;min-width:42px;display:flex;align-items:center;justify-content:center;padding:6px 2px;color:#D1D5DB;font-size:13px;border-left:1px solid #F1F5F9">–</div>`;
      const d=lich.find(x=>x.ngay===dd.ngay)||lich.find(x=>x.thu===i+2)||lich[i]; const mo=!d||d.tt!=='DONG';
      return `<div style="flex:1;min-width:42px;padding:5px 3px;border-left:1px solid #F1F5F9"><div style="padding:5px 0;text-align:center;border-radius:5px;font-weight:700;background:${mo?'#DCFCE7':'#FEE2E2'};color:${mo?'#15803D':'#B91C1C'}">${mo?'Mở':'Đóng'}</div></div>`;
    }).join('')}
  </div>`;
}
