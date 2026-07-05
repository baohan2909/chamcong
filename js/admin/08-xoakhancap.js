/* ═══════════════════════════════════════════════════════════════════════
 *  [v15.9] XÓA DỮ LIỆU KHẨN CẤP — chỉ NS00490 (chủ hệ thống)
 *  Nhiều lớp: (1) chỉ NS00490 thấy tab  (2) chọn nhóm/bảng
 *  (3) nhập MÃ BÍ MẬT = mật khẩu NS00490  (4) gõ chuỗi xác nhận
 *  (5) xác nhận cuối  (6) RPC verify lại mật khẩu + ghi audit
 * ═══════════════════════════════════════════════════════════════════════ */

// Nhóm bảng dữ liệu vận hành (xóa data, GIỮ cấu trúc bảng)
const XKC_GROUPS = [
  { id:'chamcong', ten:'Chấm công & Giờ công', tables:['cham_cong','cham_cong_face_log','gio_cong_ngay_ch','tong_hop_thang','canh_bao','nv_quota_sua'] },
  { id:'lichnghi', ten:'Lịch ca & Nghỉ phép', tables:['lich_ca','don_nghi'] },
  { id:'bangiao', ten:'Bàn giao & Sự vụ', tables:['ban_giao','ban_giao_ack','ban_giao_anh','ban_giao_chi_tiet_hang','ban_giao_chi_tiet_tai_san','su_vu','su_vu_audit','su_vu_nguoi_xem','checklist','checklist_muc','checklist_van_de','bao_cao_bat_thuong'] },
  { id:'donhang', ten:'Đơn hàng & Khách hàng', tables:['dh_cua_hang','dh_dieu_phoi','dh_don','dh_giao_dich_tt','dh_hoa_hong','dh_ton_kho','dh_van_chuyen','khach_hang'] },
  { id:'banhang', ten:'Bán hàng', tables:['phien_ban_hang','phien_nv','phien_san_pham','phien_san_pham_quan_tam','bang_xep_hang'] },
  { id:'muanon', ten:'Mẫu nón & AI', tables:['muanon_ai_job','muanon_album','muanon_album_anh','muanon_anh','muanon_anh_cluster','muanon_baigui','muanon_cleanup_log','muanon_favorite','muanon_nhacnho','muanon_tuan','muanon_tuanthu','ai_chat_message','ai_chat_session','ai_report'] },
  { id:'log', ten:'Thông báo & Nhật ký', tables:['thong_bao','audit_log','sync_anh_done','sync_anh_log','webhook_queue','rate_limit','push_subscriptions','digest_recipients'] },
];
// Nhóm CỰC nguy hiểm — tài khoản, phân quyền, master data
const XKC_DANGER = { id:'taikhoan', ten:'Tài khoản, phân quyền & dữ liệu gốc', tables:['nhan_vien','quan_ly','cua_hang','chuc_danh_quyen','app_settings','san_pham','nhom_san_pham','danh_muc_tai_san_chuan','face_threshold_config','nv_face_embedding','phien_ban'] };

let xkcChon = new Set();

function xkcLaChuHeThong(){ return (typeof SESSION!=='undefined' && SESSION && SESSION.ma === 'NS00490'); }

function xkcInit(){
  const root = document.getElementById('xkc-root');
  if (!root) return;
  if (!xkcLaChuHeThong()){
    root.innerHTML = '<div class="xkc-lock">Khu vực này chỉ dành cho chủ hệ thống (NS00490).</div>';
    return;
  }
  xkcChon = new Set();
  xkcRender();
}

function xkcRender(){
  const root = document.getElementById('xkc-root');
  if (!root) return;
  const grp = (g, danger) => {
    const allOn = g.tables.every(t => xkcChon.has(t));
    return `<div class="xkc-grp${danger?' danger':''}">
      <div class="xkc-grp-head" onclick="xkcToggleGroup('${g.id}',${danger?1:0})">
        <span class="xkc-chk ${allOn?'on':''}"></span>
        <span class="xkc-grp-ten">${g.ten}</span>
        <span class="xkc-grp-n">${g.tables.length} bảng</span>
      </div>
    </div>`;
  };
  const tongChon = xkcChon.size;
  root.innerHTML = `
    <div class="xkc-warn">
      <div class="xkc-warn-t">Vùng nguy hiểm — Xóa dữ liệu khẩn cấp</div>
      <div class="xkc-warn-d">Thao tác này XÓA TOÀN BỘ dữ liệu trong các bảng đã chọn và KHÔNG THỂ hoàn tác. Cấu trúc bảng được giữ lại (chỉ xóa dữ liệu). Chỉ dùng khi thật sự khẩn cấp.</div>
    </div>
    <div class="xkc-sec-t">Nhóm dữ liệu vận hành</div>
    ${XKC_GROUPS.map(g=>grp(g,false)).join('')}
    <div class="xkc-sec-t danger">Cực kỳ nguy hiểm — sẽ khóa hệ thống nếu xóa</div>
    ${grp(XKC_DANGER,true)}
    <div class="xkc-quick">
      <button class="xkc-q" onclick="xkcChonTatCaVanHanh()">Chọn hết dữ liệu vận hành</button>
      <button class="xkc-q ghost" onclick="xkcBoChon()">Bỏ chọn</button>
    </div>
    <div class="xkc-form">
      <div class="xkc-f-row">
        <label>Đã chọn</label>
        <div class="xkc-count"><b>${tongChon}</b> bảng sẽ bị xóa sạch dữ liệu</div>
      </div>
      <div class="xkc-f-row">
        <label>Mã bí mật (mật khẩu NS00490)</label>
        <input type="password" id="xkc-secret" placeholder="Nhập mã bí mật của anh" autocomplete="off">
      </div>
      <div class="xkc-f-row">
        <label>Gõ chính xác: <code>XOA DU LIEU</code></label>
        <input type="text" id="xkc-confirm" placeholder="XOA DU LIEU" autocomplete="off" oninput="xkcCheckReady()">
      </div>
      <button class="xkc-del-btn" id="xkc-del-btn" disabled onclick="xkcExecute()">Xóa dữ liệu đã chọn</button>
      <div class="xkc-result" id="xkc-result"></div>
    </div>`;
  xkcCheckReady();
}

function xkcToggleGroup(id, danger){
  const g = danger ? XKC_DANGER : XKC_GROUPS.find(x=>x.id===id);
  if (!g) return;
  const allOn = g.tables.every(t => xkcChon.has(t));
  if (allOn) g.tables.forEach(t => xkcChon.delete(t));
  else g.tables.forEach(t => xkcChon.add(t));
  xkcRender();
}
function xkcChonTatCaVanHanh(){ xkcChon = new Set(); XKC_GROUPS.forEach(g=>g.tables.forEach(t=>xkcChon.add(t))); xkcRender(); }
function xkcBoChon(){ xkcChon = new Set(); xkcRender(); }

function xkcCheckReady(){
  const btn = document.getElementById('xkc-del-btn');
  if (!btn) return;
  const cf = (document.getElementById('xkc-confirm')||{}).value || '';
  const sc = (document.getElementById('xkc-secret')||{}).value || '';
  btn.disabled = !(xkcChon.size > 0 && cf === 'XOA DU LIEU' && sc.length > 0);
}

async function xkcExecute(){
  if (!xkcLaChuHeThong()) return;
  const secret = (document.getElementById('xkc-secret')||{}).value || '';
  const confirm1 = (document.getElementById('xkc-confirm')||{}).value || '';
  const tables = Array.from(xkcChon);
  if (tables.length === 0 || confirm1 !== 'XOA DU LIEU' || !secret) return;

  const coTaiKhoan = tables.some(t => XKC_DANGER.tables.includes(t));
  let msg = 'XÁC NHẬN CUỐI: Xóa sạch dữ liệu của ' + tables.length + ' bảng. KHÔNG THỂ hoàn tác.';
  if (coTaiKhoan) msg += '\n\n⚠ Có bảng TÀI KHOẢN/CẤU HÌNH GỐC — xóa sẽ khiến KHÔNG ĐĂNG NHẬP ĐƯỢC. Chắc chắn?';
  if (!window.confirm(msg)) return;

  const btn = document.getElementById('xkc-del-btn');
  const res = document.getElementById('xkc-result');
  btn.disabled = true; btn.textContent = 'Đang xóa...';
  try {
    const { data, error } = await supa.rpc('fn_admin_emergency_delete', {
      p_ma: SESSION.ma, p_password: secret, p_tables: tables, p_confirm: confirm1
    });
    if (error || (data && data.ok === false)) throw new Error((data && data.error) || (error||{}).message);
    res.innerHTML = '<div class="xkc-ok">Đã xóa xong: ' + (data.tables||0) + ' bảng · ' + (data.rows||0) + ' dòng. Nên đăng xuất và kiểm tra lại.</div>';
    xkcChon = new Set();
    btn.textContent = 'Xóa dữ liệu đã chọn';
    setTimeout(()=>{ const s=document.getElementById('xkc-secret'); if(s)s.value=''; const c=document.getElementById('xkc-confirm'); if(c)c.value=''; }, 100);
  } catch(e){
    res.innerHTML = '<div class="xkc-err">Lỗi: ' + (e.message||e) + '</div>';
    btn.textContent = 'Xóa dữ liệu đã chọn'; btn.disabled = false;
  }
}

window.xkcInit = xkcInit;
window.xkcToggleGroup = xkcToggleGroup;
window.xkcChonTatCaVanHanh = xkcChonTatCaVanHanh;
window.xkcBoChon = xkcBoChon;
window.xkcCheckReady = xkcCheckReady;
window.xkcExecute = xkcExecute;
