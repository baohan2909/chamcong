/* ═══════════════════════════════════════════════════════════════════════
 *  [v18.172] HƯỚNG DẪN & XỬ LÝ SỰ CỐ CHẤM CÔNG — NỘI DUNG ĐỘNG (admin tự soạn)
 *  Nội dung lưu app_settings key 'huongdan.noidung' (JSON) qua fn_admin_set_setting.
 *  Ảnh upload Supabase Storage bucket 'muanon-images' (public) path 'huongdan/...'.
 *  Trang render từ DB (fallback HD_DEFAULT nếu chưa soạn). Nút "Soạn nội dung"
 *  chỉ hiện với coQuyen('admin.caidat'). Mini-format: dòng "- " = gạch đầu dòng,
 *  "**x**" = in đậm, dòng bắt đầu ⚠ = chữ cảnh báo, dòng trống = ngắt đoạn.
 * ═══════════════════════════════════════════════════════════════════════ */

var HD_KEY = 'huongdan.noidung';
var HD_BUCKET = 'muanon-images';   // tái dùng bucket public sẵn có (anon upload)
var hdEditData = null;

// ─── Nội dung MẶC ĐỊNH (dùng khi admin chưa soạn) ───
var HD_DEFAULT = {
  luuY: "**Lưu ý quan trọng:** Chấm công xong, hãy qua tab **GIỜ CÔNG** kiểm tra giờ vừa chấm đã được ghi nhận chưa rồi mới tắt app — tránh thoát app khi hệ thống chưa ghi nhận.",
  muc: [
    { tieuDe:"Chấm nhầm loại ca / cửa hàng",
      noiDung:"**Không** dùng Xin bổ sung ca. Nhắn thông tin vào **nhóm** để được hỗ trợ, theo mẫu:\n\n```\n1. Cửa hàng: Quảng Ngãi 2\n2. Hạng mục hỗ trợ: Chấm công\n3. Nội dung chi tiết:\n   - Ngày: 11/10/2026\n   - Thời gian: 7:30 – 17:30\n   - Nhân viên: NS01253 – Nguyễn Văn Linh\n   - Mô tả vấn đề: Chấm nhầm cửa hàng\n```",
      anh:[] },
    { tieuDe:"Quên chấm công (vào ca / ra ca)",
      noiDung:"Khi đã đi làm nhưng quên chấm vào hoặc ra ca.\n\n- Vào **Thêm ▸ Xin bổ sung ca**.\n- Chọn **đúng** thông tin của ca bị thiếu: **ngày làm việc, giờ chấm, loại ca, cửa hàng**; ghi lý do (≥10 ký tự).\n- ⚠ Khi nhớ ra đã quên chấm, **KHÔNG chấm bù tại chỗ** (vì sai vị trí & thời gian) — phải dùng Xin bổ sung ca.",
      anh:["assets/huongdan/quen-cham.png?v=18.173"] },
    { tieuDe:"Hỗ trợ 2 cửa hàng trong ngày — gần (< 50km)",
      noiDung:"Chấm bình thường theo đúng cửa hàng đang đứng.\n\n**Làm tại Hai Bà Trưng**\nVào ca → Hai Bà Trưng\nRa ca → Hai Bà Trưng\n\n**Làm tại Nguyễn Trãi 3**\nVào ca → Nguyễn Trãi 3\nRa ca → Nguyễn Trãi 3\n\nSẽ có cảnh báo — Ban quản lý sẽ duyệt.",
      anh:[] },
    { tieuDe:"Đi hỗ trợ cửa hàng khác — xa (> 50km)",
      noiDung:"**Trường hợp A — tới cửa hàng 2 nhưng chưa làm ngay (chỉ di chuyển)**\n\n**Làm tại Hai Bà Trưng**\nVào ca → Hai Bà Trưng\nRa ca → Hai Bà Trưng\n\n**Di chuyển hỗ trợ Cà Mau**\nVào ca → Cơ động - Hai Bà Trưng\nRa ca → Cơ động - Cà Mau\n\n**Trường hợp B — tới cửa hàng 2 và làm việc luôn**\n\n**Làm tại Hai Bà Trưng**\nVào ca → Hai Bà Trưng\nRa ca → Hai Bà Trưng\n\n**Di chuyển hỗ trợ Cà Mau**\nVào ca → Cơ động - Hai Bà Trưng\nRa ca → Cơ động - Cà Mau\n\n**Làm tại Cà Mau**\nVào ca → Cà Mau\nRa ca → Cà Mau\n\nNhân viên ghi chú lý do; có cảnh báo — Ban quản lý sẽ duyệt.",
      anh:[] },
    { tieuDe:"Cơ động hoặc nhân viên đi hỗ trợ ≥ 3 cửa hàng trong 1 ngày",
      noiDung:"Ví dụ: Hai Bà Trưng, Nguyễn Trãi 3, Dân Chủ, Nguyễn Trãi 5…\n\n**Chỉ chấm 1 lần vào — 1 lần ra**\nVào ca → Cơ động - Hai Bà Trưng (cửa hàng đầu)\nRa ca → Cơ động - Nguyễn Trãi 5 (cửa hàng cuối)\n\nGhi chú lý do + lịch trình di chuyển; có cảnh báo — Ban quản lý sẽ duyệt.",
      anh:[] },
    { tieuDe:"Ca kéo dài qua ngày hôm sau (ca đêm)",
      noiDung:"Cứ chấm vào ca và ra ca qua ngày như bình thường.\n\n**Ví dụ**\nVào ca → 05/11 lúc 07:30 · Hai Bà Trưng\nRa ca → 06/11 lúc 00:50 · Hai Bà Trưng\n\nGhi chú lý do; có cảnh báo — Ban quản lý sẽ duyệt.",
      anh:[] },
    { tieuDe:"Bị \"Từ chối truy cập vị trí\"",
      noiDung:"Bật lại quyền vị trí cho trình duyệt:\n\n- **iPhone (Safari):** Cài đặt ▸ Ứng dụng ▸ Safari ▸ Vị trí ▸ Cho phép.\n- **Android (Chrome):** Cài đặt trình duyệt ▸ Quyền trang web ▸ Vị trí ▸ Cho phép.",
      anh:["assets/huongdan/vi-tri.png?v=18.173"] },
    { tieuDe:"App lỗi, chấm mãi không được",
      noiDung:"- Mở app chấm công từ trình duyệt web: https://baohan2909.github.io/chamcong/\n- Vẫn không được: dùng **bất kỳ điện thoại nào** truy cập đường link trên, đăng nhập tài khoản của mình để chấm công.",
      anh:[] },
    { tieuDe:"Nhân viên đi hỗ trợ đội SALE",
      noiDung:"Vào ca → Đội SALE 01 - Hai Bà Trưng\nRa ca → Đội SALE 01 - Hai Bà Trưng\n\n⚠ Phải chọn **đội SALE** trước, sau đó mới chọn **cửa hàng SALE** — để tránh ghi nhận dữ liệu nhầm vào cửa hàng.",
      anh:[] }
  ]
};

// ─── Tiện ích ───
function hdEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function hdEscTa(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
// Biến link http/https trong nội dung thành <a> bấm được (mở tab mới). Chạy SAU hdEsc.
function hdLinkify(s){
  return String(s).replace(/(https?:\/\/[^\s<>"']+)/g, function(m){
    var href=m.replace(/[),.;:!?]+$/,''), tail=m.slice(href.length);
    return '<a href="'+href+'" target="_blank" rel="noopener" class="hd-a">'+href+'</a>'+tail;
  });
}
function hdFmtInline(s){ return hdLinkify(hdEsc(s).replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>')); }
// Dòng "khung xanh": bắt đầu bằng "Vào ca →" / "Ra ca →" (có mũi tên)
function hdIsRow(s){ var t=s.replace(/^\s*-\s*/,''); return /^(vào|ra)\s*ca\b/i.test(t) && t.indexOf('→')>=0; }
function hdFmt(raw){
  // Tách cặp ``` làm "khung mẫu" (verbatim), phần còn lại format thường
  var parts = String(raw||'').split(/```/), html='';
  for(var p=0;p<parts.length;p++){
    if(p%2===1){ html += '<div class="hd-tpl">'+hdEsc(parts[p].replace(/^\n/,'').replace(/\n+$/,''))+'</div>'; }
    else html += hdFmtBlocks(parts[p]);
  }
  return html;
}
function hdFmtBlocks(text){
  var esc = hdLinkify(hdEsc(text).replace(/->/g,'→').replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>'));
  var blocks = esc.split(/\n\s*\n/), out='';
  blocks.forEach(function(blk){
    var lines = blk.split('\n').map(function(x){return x.replace(/\s+$/,'');}).filter(function(x){return x.trim()!=='';});
    if(!lines.length) return;
    if(lines.some(hdIsRow)){
      // KHUNG XANH (flow card): dòng Vào/Ra = hàng; dòng khác = tiêu đề khung
      var inner='';
      lines.forEach(function(x){
        if(hdIsRow(x)){
          var ai=x.indexOf('→'), left=x.slice(0,ai).replace(/^\s*-\s*/,'').trim(), right=x.slice(ai+1).trim();
          var teal=/cơ\s*động|đội\s*sale/i.test(right);
          inner += '<div class="hd-row"><span class="hd-k">'+left+'</span><span class="hd-v">→ '+(teal?'<span class="hd-co">'+right+'</span>':right)+'</span></div>';
        } else {
          inner += '<div class="hd-ft">'+x.replace(/^\s*-\s*/,'')+'</div>';
        }
      });
      out += '<div class="hd-flow">'+inner+'</div>';
    } else {
      var buf=[], ul=[];
      function flush(){ if(ul.length){ buf.push('<ul>'+ul.join('')+'</ul>'); ul=[]; } }
      lines.forEach(function(x){
        var t=x.replace(/^\s+/,'');
        if(/^-\s+/.test(t)){ var it=t.replace(/^-\s+/,''); ul.push('<li'+(/^⚠/.test(it)?' class="hd-warn"':'')+'>'+it+'</li>'); }
        else { flush(); buf.push('<p'+(/^⚠/.test(t)?' class="hd-warn"':'')+'>'+t+'</p>'); }
      });
      flush();
      out += buf.join('');
    }
  });
  return out;
}

// ─── Đọc / ghi app_settings (pattern slipcfg) ───
function hdReadSetting(key){
  try{
    var v = (typeof _getSetting==='function') ? _getSetting(key,null) : (window.APP_SETTINGS && window.APP_SETTINGS[key]);
    if(v==null) return null;
    if(typeof v==='string'){ v=v.trim(); if(!v) return null; return JSON.parse(v); }
    return v;
  }catch(e){ return null; }
}
async function hdWriteSetting(key,obj){
  if(typeof supa==='undefined' || !supa) throw new Error('Chưa kết nối');
  var val = JSON.stringify(obj);
  var r = await supa.rpc('fn_admin_set_setting',{ p_admin:(typeof SESSION!=='undefined'&&SESSION)?SESSION.ma:null, p_key:key, p_value:val });
  if(r.error || !r.data || !r.data.success) throw new Error((r.data&&r.data.error)||(r.error&&r.error.message)||'Lỗi lưu');
  try{ window.APP_SETTINGS=window.APP_SETTINGS||{}; window.APP_SETTINGS[key]=val; localStorage.setItem('_app_settings',JSON.stringify(window.APP_SETTINGS)); }catch(e){}
}
function hdGetData(){
  var d = hdReadSetting(HD_KEY);
  if(d && Array.isArray(d.muc) && d.muc.length) return d;
  return HD_DEFAULT;
}
function hdCanEdit(){ return (typeof coQuyen==='function') ? coQuyen('admin.caidat') : (typeof SESSION!=='undefined'&&SESSION&&SESSION.vaiTro==='ADMIN'); }

// ─── RENDER TRANG ───
function hdRenderPage(){
  var root = document.getElementById('hd-root'); if(!root) return;
  var data = hdGetData();
  var h = '';
  h += '<div class="hd-hero"><div class="hd-eye">Chấm công &amp; Nhân sự</div>'
     + '<h2>Hướng dẫn &amp; xử lý sự cố chấm công</h2>'
     + '<p>Cách xử lý nhanh khi chấm công gặp sự cố.</p>'
     + (hdCanEdit() ? '<button class="hd-edit-btn" onclick="hdOpenEditor()">✎ Soạn nội dung</button>' : '')
     + '</div>';
  if(data.luuY) h += '<div class="hd-callout warn">'+hdFmtInline(data.luuY)+'</div>';
  h += '<div class="hd-seclbl">Các tình huống thường gặp</div><div class="hd-acc">';
  (data.muc||[]).forEach(function(m,i){
    h += '<details open><summary><span class="hd-num">'+(i+1)+'</span><span class="hd-t">'+hdEsc(m.tieuDe||'')+'</span><span class="hd-caret">▶</span></summary>'
       + '<div class="hd-body">' + hdFmt(m.noiDung||'')
       + ((m.anh&&m.anh.length) ? m.anh.map(function(u){ return '<div class="hd-fig"><img src="'+hdEsc(u)+'" loading="lazy" onclick="hdZoom(this.src)"></div>'; }).join('') : '')
       + '</div></details>';
  });
  h += '</div><div class="hd-foot">Nón Sơn · Hướng dẫn &amp; xử lý sự cố chấm công</div>';
  root.innerHTML = h;
}

function hdZoom(src){
  var d=document.getElementById('hd-lb'); if(d) d.remove();
  d=document.createElement('div'); d.id='hd-lb'; d.onclick=function(){ d.remove(); };
  var i=new Image(); i.src=src; d.appendChild(i); document.body.appendChild(d);
}

// ─── MÀN SOẠN NỘI DUNG (admin) ───
function hdOpenEditor(){
  if(!hdCanEdit()){ if(typeof showToast==='function') showToast('Không có quyền','warn'); return; }
  hdEditData = JSON.parse(JSON.stringify(hdGetData()));
  if(!Array.isArray(hdEditData.muc)) hdEditData.muc=[];
  var ov=document.getElementById('hd-ed-ov');
  if(!ov){ ov=document.createElement('div'); ov.id='hd-ed-ov'; document.body.appendChild(ov); }
  ov.className='hd-ed-ov';
  ov.innerHTML = '<div class="hd-ed-head"><div class="hd-ed-ttl">Soạn nội dung hướng dẫn</div>'
    + '<div class="hd-ed-headbtn"><button class="hd-ed-x" onclick="hdCloseEditor()">Hủy</button>'
    + '<button class="hd-ed-save" id="hd-ed-save" onclick="hdSaveEditor()">Lưu</button></div></div>'
    + '<div class="hd-ed-body" id="hd-ed-body"></div>';
  hdRenderEditor();
}
function hdCloseEditor(){ var ov=document.getElementById('hd-ed-ov'); if(ov) ov.remove(); }
function hdRenderEditor(){
  var b=document.getElementById('hd-ed-body'); if(!b) return;
  var h='';
  h += '<label class="hd-ed-lbl">Lưu ý quan trọng (ô đầu trang)</label>';
  h += '<textarea class="hd-ed-ta" rows="3" oninput="hdEditData.luuY=this.value">'+hdEscTa(hdEditData.luuY||'')+'</textarea>';
  h += '<div class="hd-ed-tip"><b>Mẹo định dạng:</b><br>'
     + '• Đầu dòng <b>- </b> = gạch đầu dòng · <b>**chữ**</b> = in đậm · dòng trống = ngắt đoạn.<br>'
     + '• Dòng bắt đầu <b>Vào ca →</b> hoặc <b>Ra ca →</b> sẽ tự thành <b>khung xanh</b> (chữ "Cơ động"/"Đội SALE" được tô màu).<br>'
     + '• Muốn có <b>khung mẫu</b> (ô xám, như mẫu tin nhắn): để đoạn đó giữa hai dòng chỉ gõ 3 dấu huyền <b>```</b>.</div>';
  h += '<div class="hd-ed-seclbl">Các tình huống ('+hdEditData.muc.length+')</div>';
  hdEditData.muc.forEach(function(m,i){
    h += '<div class="hd-ed-card">';
    h += '<div class="hd-ed-row"><span class="hd-ed-ord">'+(i+1)+'</span>'
       + '<button class="hd-ed-mini"'+(i===0?' disabled':'')+' onclick="hdMove('+i+',-1)" title="Lên">▲</button>'
       + '<button class="hd-ed-mini"'+(i===hdEditData.muc.length-1?' disabled':'')+' onclick="hdMove('+i+',1)" title="Xuống">▼</button>'
       + '<span style="flex:1"></span>'
       + '<button class="hd-ed-del" onclick="hdDelMuc('+i+')">Xóa</button></div>';
    h += '<input class="hd-ed-inp" placeholder="Tiêu đề tình huống" value="'+hdEsc(m.tieuDe||'')+'" oninput="hdEditData.muc['+i+'].tieuDe=this.value">';
    h += '<textarea class="hd-ed-ta" rows="5" placeholder="Nội dung hướng dẫn..." oninput="hdEditData.muc['+i+'].noiDung=this.value">'+hdEscTa(m.noiDung||'')+'</textarea>';
    h += '<div class="hd-ed-anh" id="hd-ed-anh-'+i+'">';
    (m.anh||[]).forEach(function(u,j){ h += '<div class="hd-ed-thumb"><img src="'+hdEsc(u)+'"><button onclick="hdDelAnh('+i+','+j+')" title="Xóa ảnh">✕</button></div>'; });
    h += '<label class="hd-ed-addimg">+ Ảnh<input type="file" accept="image/*" style="display:none" onchange="hdAddAnh('+i+',this)"></label>';
    h += '</div></div>';
  });
  h += '<button class="hd-ed-addmuc" onclick="hdAddMuc()">+ Thêm tình huống</button>';
  b.innerHTML = h;
}
function hdMove(i,d){ var a=hdEditData.muc, j=i+d; if(j<0||j>=a.length) return; var t=a[i]; a[i]=a[j]; a[j]=t; hdRenderEditor(); }
function hdDelMuc(i){ if(typeof confirm==='function' && !confirm('Xóa tình huống này?')) return; hdEditData.muc.splice(i,1); hdRenderEditor(); }
function hdAddMuc(){ hdEditData.muc.push({tieuDe:'Tình huống mới', noiDung:'', anh:[]}); hdRenderEditor(); }
function hdDelAnh(i,j){ hdEditData.muc[i].anh.splice(j,1); hdRenderEditor(); }
async function hdAddAnh(i, inp){
  var file = inp.files && inp.files[0]; if(!file) return; inp.value='';
  var box = document.getElementById('hd-ed-anh-'+i); var ld=null;
  try{
    if(box){ ld=document.createElement('span'); ld.className='hd-ed-upld'; ld.textContent='Đang tải ảnh...'; box.appendChild(ld); }
    var c = (typeof muanonCompressAnh==='function') ? await muanonCompressAnh(file) : { blob:file };
    var path = 'huongdan/' + Date.now() + '-' + Math.random().toString(36).slice(2,8) + '.jpg';
    var up = await supa.storage.from(HD_BUCKET).upload(path, c.blob, { contentType:'image/jpeg', upsert:true, cacheControl:'3600' });
    if(up.error) throw up.error;
    var urlData = supa.storage.from(HD_BUCKET).getPublicUrl(path);
    var url = urlData && urlData.data && urlData.data.publicUrl;
    if(!url) throw new Error('Không lấy được link ảnh');
    hdEditData.muc[i].anh = hdEditData.muc[i].anh || []; hdEditData.muc[i].anh.push(url);
    hdRenderEditor();
  }catch(e){ if(ld) ld.remove(); if(typeof showToast==='function') showToast('⚠ Lỗi tải ảnh: '+(e.message||e),'warn'); }
}
async function hdSaveEditor(){
  var btn=document.getElementById('hd-ed-save'); if(btn){ btn.disabled=true; btn.textContent='Đang lưu...'; }
  try{
    // dọn tình huống rỗng tiêu đề (tránh lưu rác)
    hdEditData.muc = (hdEditData.muc||[]).filter(function(m){ return (m.tieuDe&&m.tieuDe.trim()) || (m.noiDung&&m.noiDung.trim()) || (m.anh&&m.anh.length); });
    await hdWriteSetting(HD_KEY, hdEditData);
    if(typeof showToast==='function') showToast('✓ Đã lưu nội dung', 'ok');
    hdCloseEditor();
    hdRenderPage();
  }catch(e){ if(btn){ btn.disabled=false; btn.textContent='Lưu'; } if(typeof showToast==='function') showToast('⚠ '+(e.message||'Lỗi lưu'), 'warn'); }
}

// Expose (onclick / goToPage)
if(typeof window!=='undefined'){
  window.hdRenderPage=hdRenderPage; window.hdZoom=hdZoom; window.hdOpenEditor=hdOpenEditor;
  window.hdCloseEditor=hdCloseEditor; window.hdSaveEditor=hdSaveEditor; window.hdMove=hdMove;
  window.hdDelMuc=hdDelMuc; window.hdAddMuc=hdAddMuc; window.hdDelAnh=hdDelAnh; window.hdAddAnh=hdAddAnh;
}
