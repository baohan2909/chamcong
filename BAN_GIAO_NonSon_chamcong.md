# BÀN GIAO DỰ ÁN — NÓN SƠN chamcong PWA

> File này lưu **TOÀN BỘ ngữ cảnh** để Aroma mang sang đoạn chat mới.
> **Quy tắc bắt buộc:** mỗi khi làm thêm bất cứ việc gì, GHI NỐI TIẾP vào cuối file (mục 10 "NHẬT KÝ NỐI TIẾP") — KHÔNG xóa nội dung cũ.
> Khi sang chat mới: đính kèm file này + kết quả `full cấu trúc Supabase` (Mục 9).
>
> **Chốt ở phiên bản app: v16.75.**

---

## 0. CÁCH DÙNG FILE NÀY

- Đầu mỗi đoạn chat mới: gửi Claude file này + kết quả cấu trúc Supabase (Mục 9). Yêu cầu đọc kỹ trước khi làm.
- Sau mỗi việc, Claude **ghi nối tiếp** vào Mục 10 — không xóa cũ.
- Claude **không truy cập Supabase trực tiếp** → Aroma chạy mọi SQL.
- Claude **không giữ được file giữa các phiên** (thư mục làm việc reset) → mỗi phiên mới, nếu cần sửa code, Aroma gửi lại file liên quan (hoặc cả repo).

---

## 1. CON NGƯỜI & PHONG CÁCH LÀM VIỆC (Aroma)

- Aroma = **NS00490**, vai trò **ADMIN**, chủ hệ thống & lập trình viên **duy nhất** của Nón Sơn (chuỗi ~220 cửa hàng, ~540 nhân sự, bán mũ bảo hiểm + nón vải). Nằm trong bảng `quan_ly`.
- Làm chính trên **iPhone** (17 Pro Max), có test trên PC.
- Ngôn ngữ: **tiếng Việt**, xưng **anh** – gọi **em**. **Kết quả trước, giải thích sau, không dài dòng. Chỉ làm.**

### Nguyên tắc làm việc (Claude phải tuân thủ tuyệt đối)
1. **Đối chiếu / hỏi cấu trúc TRƯỚC khi làm.** Không chắc tầng dữ liệu (RPC trả gì, bảng có cột gì, hàm enforce gì) → nhờ Aroma chạy SQL probe (`pg_get_functiondef`, `information_schema`), **KHÔNG ĐOÁN**. Mọi bug đa tầng đã giải bằng cách đọc nguồn thật trước.
2. **Đọc code thật** (tên hàm/biến) trước khi sửa. Sửa **tối thiểu** (surgical) — không thêm tính năng không yêu cầu, không "cải thiện" lung tung, không đụng code lân cận.
3. **Mỗi dòng sửa truy ngược về 1 yêu cầu.** Khi liệt kê N việc/lỗi → fix đủ N **hoặc** bảng ✅/⚠️/❌ trung thực.
4. **Phân quyền theo độ rủi ro:** đụng dữ liệu thật / nhiều bản ghi / bảng pre-computed / luồng lõi / phân quyền → **xác nhận phạm vi với Aroma trước**, làm cuốn chiếu, chia phase.
5. **Thành thật** khi chẩn đoán sai. **Không emoji trong UI.** **Không over-format.**
6. **Lưu ý các hạng mục đang dở dang** (Mục 6) — qua đoạn mới làm tiếp đúng chỗ.
7. Sau mỗi việc: **bump version đủ chỗ** (Mục 2), **`node --check`** file JS, **cân bằng `{` `}`** cho CSS.

---

## 2. MÔI TRƯỜNG & STACK

- Repo: **`baohan2909/chamcong`** trên GitHub Pages. Supabase Pro **`yeyiduztwdcyguivomxq`** (AWS Sydney).
- Kiến trúc file: trước đây 1 file `index.html` khổng lồ; **nay tách module** — `index.html` + `js/` (core, admin, pages, donhang, ai) + `css/`. Service worker `sw.js`.
- Thư mục làm việc Claude (chỉ trong-phiên, KHÔNG bền): `/home/claude/...`. File reset giữa các phiên.

### Quy tắc BUMP PHIÊN BẢN (mỗi lần đổi version = đồng bộ 5 chỗ, dùng 2 chữ số thập phân, vd v16.75)
1. `index.html`: `?v=X` (perl/sed toàn bộ — hiện **34 chỗ**, kiểm `grep -c '?v=16.75' index.html` = 34).
2. `index.html`: login text `· vX` (dòng ~48).
3. `index.html`: Account `vX · Bấm` (dòng ~2029).
4. `sw.js`: `CACHE_VERSION = 'nonson-vX'` (dòng ~15).
5. `js/core/02-system.js`: `'sys.cache_version': 'vX'` (dòng ~28).
- (Tùy chọn force toàn hệ thống: upsert `app_settings` key `sys.cache_version` qua SQL.)
- Dùng `perl -i -pe` với ranh giới chính xác để **không đụng comment**. Quy ước: sau `.9` lên bậc cao (15.9 → 16.0).

### Build & deploy
- **Build PATCH zip:** mỗi đợt sửa, zip **các file đã đổi** (giữ cấu trúc thư mục) → present_files. Aroma giải nén đè repo.
- File hay đụng (đợt sự vụ + phân quyền): `js/admin/05-bangiao-ql.js`, `js/pages/06-bangiao.js`, `js/admin/07-phanquyen.js`, `js/core/02-system.js`, `css/08-redesign.css`, `index.html`, `sw.js`.
- Output: `/mnt/user-data/outputs/` → zip → present_files.
- **Bẫy cwd:** `cat heredoc` với đường dẫn tuyệt đối KHÔNG tự `cd` — phải `cd` trước khi chạy `wc`/`node` tương đối.
- `.gs` của Apps Script: `node --check` không nhận đuôi `.gs` → copy sang `_check.js` rồi check.

---

## 3. DESIGN SYSTEM — RẤT QUAN TRỌNG (Aroma cực kỳ để ý thẩm mỹ)

> Có **3 bộ palette tách biệt**. Đừng trộn. Xuyên suốt: **TUYỆT ĐỐI KHÔNG MÀU TÍM ở bất kỳ đâu.**

### 3.1 App chamcong (giao diện chính — cái đang làm)
- **Nền sáng / trắng.**
- **Xanh chủ đạo (gradient):** `#1D9E75` → `#0F6E56`. Nav active `#0F6E56`. Tint nền nhạt: `#DCF3E8` / `#E1F5EE` / `#F4FBF8` / `#F0FDFA`.
- **KHÔNG MÀU TÍM.** Mọi badge "admin / quản lý" dùng **xanh dương** `#1D4ED8` trên nền `#DBEAFE` (thay cho tím). Nếu thấy tím ở đâu → coi là lỗi cần sửa.
- **Sự vụ + Phân quyền** dùng họ biến `--green` (`--green` / `--green-lt` / `--green-m`) cho đồng nhất.
- **Màu chức năng (semantic):**
  - Đỏ `#DC2626` — khẩn cấp / lỗi / quá hạn.
  - Cam `#F97316` / `#D97706` / `#C2410C` — cảnh báo / sắp hết hạn (countdown < 2h).
  - Hổ phách `#FEF3C7` nền · `#FCD34D` viền · `#92400E` chữ — badge "cửa hàng báo lại N lần".
  - Xanh lá — hợp lệ / đã duyệt.
- **Viền trái card sự vụ theo mức độ:** KHAN_CAP `#DC2626`, QUAN_TRONG `#F97316`, CAN_THIET `#1B4965`.
- **Icon:** SVG stroke (Lucide / Feather). **KHÔNG emoji trong UI** (ngoại trừ glyph trạng thái đã có sẵn như ✓ ⚠ và vài nhãn cũ).
- **Không over-format.** Admin panel dùng class `adm2-*`. **CSS mới cho admin → thêm vào `css/08-redesign.css`** (file này nằm trong gói build; `css/05-admin.css` KHÔNG nằm trong gói).

### 3.2 Design system CÁ NHÂN của Aroma (cho sản phẩm / tài liệu KHÁC — KHÔNG phải app chamcong)
- Nền **obsidian / navy**. Accent **gold `#CBA45A`** + **teal `#3FB6A8`**.
- Font: **Fraunces** (display), **Be Vietnam Pro** (body), **JetBrains Mono** (code/số liệu).
- Icon SVG **stroke trắng**. **Không emoji. Không tím.**

### 3.3 Tài liệu Word / báo cáo
- **Navy `#1B3A5C` / Teal `#0F6E56`**, font **Arial**.

---

## 4. KIẾN TRÚC AUTH & PHÂN QUYỀN (quan trọng — đang làm sâu)

### 4.1 Hai bảng tài khoản
- `nhan_vien` (PK `ma_nv`, role chủ yếu NV + vài QLBH) và `quan_ly` (PK `ma_ql`, role ADMIN/QLNS/QLBH...). Aroma NS00490 ở `quan_ly`.
- Đăng nhập: RPC `fn_dang_nhap(p_ma, p_password)` → `SESSION.ma`, `SESSION.vaiTro` (vai trò GỐC), `SESSION.cuaHangMa` (nếu CUA_HANG)...
- **Cửa hàng login:** `SESSION.vaiTro = 'CUA_HANG'`, `SESSION.ma = ma_ch`.

### 4.2 Vai trò & chức danh
- **`role` (enum `role_type`):** NV, CTV, QLNS, ADMIN, ADMINBH, CUA_HANG, QLBH, QLBHHCM, QLBHMD, QLBHMT, QLBHTTN, QLBHMDTTN, QLBHHNTB.
- **Cột M (Google Sheet) = chức danh chi tiết.** Trong DB lưu ở **`chuc_danh_m` (text, raw cột M)** — TÁCH BIỆT với `role` (enum). Mã cơ động: **CDSG** (cơ động Sài Gòn), **CDMT** (cơ động Miền Tây)... Ô trống = NV.
  - **Lý do tách:** `role` là enum cố định, không nhận CDSG/CDMT → nếu nhét cột M vào `role` sẽ bị ép về 'NV'. Vì vậy cột M raw đi vào `chuc_danh_m`.
- `quan_ly.khu_vuc_phu_trach` = ARRAY (vùng quản lý). `quan_ly.bo_phan` = NULL (không dùng).
- **6 khu vực** (phẳng, không phân cấp): **Hồ Chí Minh, Hà Nội, Bắc Trung Bộ, Trung Tây Nguyên, Đông Nam Bộ, Tây Nam Bộ.** (`nhan_vien.khu_vuc` + `quan_ly.khu_vuc_phu_trach` dùng cùng tên này.)
- **Chức danh hiệu dụng (đã chốt):** `COALESCE(NULLIF(chuc_danh_m,''), role::text)`. → ai có cột M thì theo cột M, không thì theo role.

### 4.3 Nguồn dữ liệu
- **Google Sheet = nguồn sự thật** cho thông tin nhân sự (cột M = chức danh). Supabase đồng bộ TỪ Sheet qua Apps Script `ChamCongSync.gs`.
- **"Ai thuộc chức danh nào" = Sheet** (cột M → `chuc_danh_m`). **"Chức danh được làm gì" = Supabase** (bảng `chuc_danh_quyen` + `quyen_ca_nhan`, do tab Phân quyền ghi).

### 4.4 Đồng bộ cột M — Apps Script `ChamCongSync.gs` (v9.48, ĐÃ SỬA)
- File `ChamCongSync.gs` đọc Sheet "DANH SÁCH NHÂN VIÊN" cột E(5)=ma_nv, F(6)=ho_ten, G(7)=chuc_vu, L(12)=mật khẩu, **M(13)=PHÂN QUYỀN/chức danh**, N(14)=avatar. (getValues 0-index: row[4], row[5], row[11], **row[12]**, row[13].)
- **Bug gốc đã fix:** trong `syncNhanVienToSupabase` + `syncQuanLyToSupabase`, cột M bị ép qua bộ lọc `validRoles` → CDSG/CDMT → 'NV', và **không gửi cột M raw**. **Fix (v9.48):** thêm đúng 1 dòng vào mỗi hàm, ngay sau `role: role,`:
  ```js
  chuc_danh_m: String(row[12] || '').trim().toUpperCase() || null,
  ```
- **BẮT BUỘC chạy FULL:** Apps Script → file `ChamCongSync.gs` → dán đè → Lưu → menu **🔄 Sync Supabase → 💪 ĐỒNG BỘ 2 CHIỀU — FULL** (`forceDongBoHaiChieu`, xóa hash → đẩy lại tất cả). Sync thường sẽ **bỏ qua** vì hash dữ liệu Sheet không đổi (chỉ đổi code).
- Kiểm: `SELECT ma_nv, role, chuc_danh_m FROM nhan_vien WHERE chuc_danh_m IS NOT NULL LIMIT 10;`
- 2 hàm batch DB `fn_sync_nhan_vien_batch` / `fn_sync_quan_ly_batch` phải ghi `chuc_danh_m` (đã có).
- Apps Script CFG: SUPABASE_URL `https://yeyiduztwdcyguivomxq.supabase.co`; SHEET_ID_CC `1q5_VVOhI9F5OD3_RnbRvWU5AC5mPhW6_tca1n3gTekY`; secret ở Script Property `SUPABASE_SECRET_KEY`. Project có nhiều .gs (Mã.gs, WebhookCC.gs, ChamCongSync.gs, Nhacchamcong.gs, MuanonSync.gs, TonKhoSync.gs...). `removeTriggers()` chỉ xóa trigger thuộc Mã.gs.

### 4.5 Phân quyền CỨNG hiện đang chạy (chưa thay bằng RBAC động)
- **Hub:** `HUB_GROUPS` trong `02-system.js` (~dòng 508), mỗi mục có `roles:[...]`, ADMIN thấy hết (`_hubItemVisible`).
- **Menu/nav:** dựng trong `02-system.js` (`khoiDongApp`, ~dòng 808–1009): `isQL=(QLNS||ADMIN)`, `isCH=CUA_HANG`, `isQLBH=(QLBH||startsWith 'QLBH')`, `isAdminAll=ADMIN`, `isNV=phần còn lại`.
- **Gate nhân sự:** `_canQuanLyNS()` = `vaiTro==='ADMIN' || vaiTro==='QLNS'`; `_chanQuanLyNS()` chặn nếu không phải. `taiNhanSu()` gọi `_chanQuanLyNS()` đầu hàm.
- Tóm tắt quyền cứng: ADMIN toàn quyền; QLNS = nhân sự/lịch ca HT/duyệt YC/giờ công HT/phiên BH/dashboard/QL bàn giao/QL mẫu nón; QLBH(+vùng) = phiên BH/dashboard/QL bàn giao/mẫu nón/bổ sung ca; NV/CTV/CHT/TC/CĐ = chấm công/giờ công mình/bản đồ/lịch ca mình/bổ sung ca/bàn giao ca/mẫu nón/KM/giao diện.

---

## 5. VIỆC ĐÃ LÀM (v15.9 → v16.75)

### 5.1 PHÂN QUYỀN — tab linh hoạt (nhóm + multi-select + autocomplete) — v16.73, ĐÃ XONG UI + BACKEND, CHƯA ÁP DỤNG (enforcement) + CHƯA RUNTIME-TEST
File `js/admin/07-phanquyen.js` (viết lại, ~731 dòng). Yêu cầu Aroma đã chốt:
- Chức danh hiển thị = **MÃ viết tắt cột M** (CDSG, CDMT...), bỏ tên đẹp map sẵn. Tên do Aroma đặt **chỉ ở cấp nhóm**.
- **Nhóm = thùng chứa linh hoạt:** 1 nhóm chứa NHIỀU chức danh (cột M) VÀ/HOẶC NHIỀU cá nhân; thêm thành viên bằng **gõ tên + gợi ý autocomplete** (như chấm công), không gõ mã.
- **Phân quyền hàng loạt:** tích chọn nhiều mục (chức danh/cá nhân) → 1 bảng quyền → áp 1 lần. UI inline, bỏ hết prompt thô.
- 6 khu vực trong `PQ_KHU_VUC`. State: `pqTree`, `pqGio[]` (giỏ multi-select), inline editors, `pqTimKq` (autocomplete debounce 250ms).

**Backend (Aroma ĐÃ chạy, xác nhận `fn_pq_tree` + `fn_pq_tim` chạy):** file `sql_dot4_phanquyen_p3.sql`. Hàm tên riêng `fn_pq_*` (KHÔNG đụng bản cũ):
- Bảng `nhom_thanh_vien(nhom, loai['chuc_danh'|'ca_nhan'], ma, ten_hien_thi, thu_tu, PK(nhom,loai,ma))`.
- `fn_pq_tree()` (dùng CTE, không temp-table): trả `{nhom:[...], chuc_danh_tu_do:[...]}`. Chức danh = `COALESCE(NULLIF(chuc_danh_m,''), role::text)`.
- `fn_pq_tim(p_kw, p_gioi_han=20)` autocomplete → `{chuc_danh:[...], nhan_su:[...]}`.
- `fn_pq_them_thanh_vien`, `fn_pq_xoa_thanh_vien`, `fn_pq_ap_nhieu(p_admin, p_targets jsonb, p_quyen, p_pham_vi, p_khu_vuc)` (loop targets → INSERT/UPDATE `chuc_danh_quyen` hoặc `quyen_ca_nhan`, ADMIN skip), `fn_nhom_doi_ten`, `fn_nhom_xoa`. Mọi hàm ghi guard `_check_role_admin_qlns(p_admin)`.

### 5.2 SỰ VỤ — 3 việc lớn — v16.74 → v16.75
> Luồng sự vụ: cửa hàng bàn giao ca có vấn đề → tạo `su_vu` → (giao người xử lý + deadline) → người xử lý "Đã xử lý xong" (`DA_XU_LY_XONG`) → cửa hàng/BQL "Xác nhận hoàn tất & đóng" (`HOAN_TAT`).

**VIỆC 1 — Khóa quyền đóng (✅ XONG, 2 lớp).**
- *Gốc:* `fn_su_vu_dong` KHÔNG kiểm tra vai trò → bất kỳ ai gọi cũng đóng được (cơ động Nguyễn Mạnh Tuấn NS00321 đóng được). Frontend còn hiện nút đóng cho cả người xử lý.
- *Fix backend (`fn_su_vu_dong`):* chỉ cho đóng nếu **Ban Quản lý** (`EXISTS(SELECT 1 FROM quan_ly WHERE ma_ql=p_ma_nv)`) **HOẶC cửa hàng liên quan** (`p_ma_nv = su_vu.ma_ch`). Cơ động/NV → trả lỗi `'Chỉ Ban Quản lý hoặc cửa hàng liên quan mới được đóng sự vụ'`. (QL đóng qua `bgqlHoanTat` với `p_vai_tro_dong='QUAN_LY'` vẫn chạy vì nằm trong `quan_ly`.)
- *Fix frontend (`06-bangiao.js` `bgSuVuCardHtml`):* nút "Xác nhận hoàn tất & đóng" chỉ hiện khi `DA_XU_LY_XONG && (laBanQuanLy || laCuaHang)`. `vaiTroDong` ghi đúng: CUA_HANG→TAI_KHOAN_CH, BQL→QUAN_LY, còn lại→TRUONG_CA.

**VIỆC 3 — Chống trùng sự vụ (✅ XONG).**
- *Gốc:* `fn_su_vu_create` plain INSERT — cửa hàng báo lại hôm sau → đẻ sự vụ mới → trùng + spam.
- *Fix (`fn_su_vu_create`, đổi RETURN uuid → jsonb `{id, trung, so_lan}`):* nếu đã có sự vụ ĐANG MỞ cùng `(ma_ch + loai + tieu_de)` (trạng thái NOT IN HOAN_TAT/HUY) → **KHÔNG tạo mới**, mà nối mô tả + `so_lan_bao_lai += 1` + ghi audit `'UPDATE_REPEAT'`. **Phải `DROP FUNCTION` trước** vì đổi kiểu trả về (lỗi 42P13 nếu không drop).
- Thêm cột `su_vu.so_lan_bao_lai int DEFAULT 1`, `su_vu.thoi_gian_bao_lai_cuoi timestamptz`.
- *Frontend:* badge "🔁 Cửa hàng đã báo lại N lần · cùng một sự vụ đang xử lý" trên thẻ; lúc gửi biên bản đếm tách "X sự vụ mới · Y cập nhật vào sự vụ đang mở" (helper `_demSv` đọc `r.data.trung`).

**VIỆC 2 — Tự động phân bổ + theo dõi (⚠️ MỚI XONG MỘT PHẦN).**
- ✅ **Tự gán deadline theo mức độ** (trong `fn_su_vu_create` khi tạo mới): KHAN_CAP **24h** · QUAN_TRONG **48h** · CAN_THIET (và khác) **7 ngày**. (Mapping do Aroma chốt.)
- ✅ **Đơn vị giao = "Ban Quản lý"** (set `nguoi_phu_trach_ten = 'Ban Quản lý'` khi tạo).
- ✅ **Countdown đủ ngày/giờ/phút/giây, chạy realtime mỗi giây** ở **CẢ 2 phía**:
  - Cửa hàng (`06-bangiao.js`): `_bgFmtConLai` luôn hiện đủ d/g/p/s; `bgSuVuTickCountdowns` + timer 1s; <2h cam, ≤0 đỏ.
  - Ban Quản lý (`05-bangiao-ql.js`): thêm `.bgql-dl-count` + `_bgqlFmtConLai` + `bgqlTickSvCountdowns` + `bgqlStartSvTimer/Stop` (gọi sau khi render list).
- ❌ **CHƯA: tự gán cơ động theo khu vực** (xem Mục 6).
- ❌ **CHƯA: 3 danh sách tách rõ** (đang xử lý / sắp hết hạn / quá hạn). Hiện chỉ có lọc trạng thái + nhãn "TRỄ" (`bgqlLaTre`: quá deadline HOẶC tạo >12h chưa QL phản hồi).
- ⚠️ **Điều chỉnh deadline / đổi người phụ trách:** chỉ **gián tiếp** qua modal "Cập nhật phản hồi" (có ô `datetime-local #bgql-ph-deadline` + chọn người xử lý), CHƯA có nút/công cụ riêng.

### 5.3 (Nền tảng cũ vẫn còn) RBAC nạp quyền session — v15.7
- `khoiDongApp()` gọi `pqLoadQuyenSession()` → `fn_get_quyen_user(SESSION.ma)` → set `window.SESSION_QUYEN[]`, `SESSION_PHAMVI`, `SESSION_KV`, `SESSION_KVPT[]`, `SESSION_MACH`, `SESSION_CHUCDANH`, `SESSION_QUYEN_READY`.
- Helper `coQuyen('phanhe.thaotac')` (ADMIN luôn true), `phamViData()`, `khuVucChoPhep()`. **CHƯA dùng để khống chế UI** — app chạy y như cũ (xem Mục 6).

### 5.4 Việc nhỏ đã xong các phiên trước (tham khảo)
- v15.0–15.3: bug thanh "Chọn nhiều" ở Sự vụ — gốc là toast `#_toast` (z-index 99999) sau khi mờ vẫn nhận chuột → tấm kính vô hình. Fix: `pointer-events:none` vĩnh viễn trong `showToast` (02-system.js) + `bgqlForceExitMultiSelect()` trong `goToPage()`.
- v15.9: tab Khẩn cấp xóa dữ liệu (chỉ NS00490; `js/admin/08-xoakhancap.js`; RPC `fn_admin_emergency_delete`, xác thực `mat_khau_plain` + chuỗi `XOA DU LIEU`).
- v16.71: fix mất chấm công — client CHỜ server xác nhận `success=true` mới báo thành công, retry 3 lần (backoff), thất bại thì KHÔNG ghi lịch sử giả (`_ccChamThatBai`). Test bằng tắt/bật wifi giữa lúc chấm.

---

## 6. VIỆC TỒN ĐỌNG / ĐANG DỞ (làm tiếp ở chỗ này)

### 6.1 [PHÂN QUYỀN] Enforcement — quyền set rồi NHƯNG CHƯA CÓ HIỆU LỰC (ưu tiên cao)
- *Triệu chứng Aroma gặp:* "set admin/quyền trong tab Phân quyền nhưng vẫn không duyệt công được".
- *Gốc (đã xác định trong `02-system.js`):* các chức năng kiểm tra **vai trò GỐC** (`SESSION.vaiTro`, vd `_canQuanLyNS()`), KHÔNG đọc `SESSION_QUYEN`. `pqLoadQuyenSession()` có nạp quyền nhưng comment ghi rõ *"chưa khống chế UI"*. `coQuyen()` tồn tại nhưng **chưa hàm nào gọi**.
- *Việc cần làm:* nối `coQuyen(...)` vào từng chức năng (hub/menu/nav + nút + gate như `taiNhanSu`), thay dần quyền cứng — **cuốn chiếu, nhóm admin trước**. Phải xử lý **timing**: quyền nạp **async** → dựng lại menu SAU khi `SESSION_QUYEN_READY`, nếu không sẽ ẩn nhầm. Cần cơ chế "chưa lưu quyền → tạm dùng quyền mặc định cũ" để không khóa nhầm người.
- *Cần Aroma cung cấp khi làm:* (1) `js/admin/07-phanquyen.js` để biết **mã quyền** (vd quyền "duyệt công" tên gì); (2) `pg_get_functiondef('fn_get_quyen_user')` để biết quyền trả dạng nào.
- *Phụ thuộc:* nên hoàn tất **cột M** (4.4) trước, để chức danh CDSG/CDMT hiện đúng trong Phân quyền.

### 6.2 [SỰ VỤ] Tự động phân bổ cho cơ động theo khu vực (chưa làm)
- *Yêu cầu Aroma:* khi sự vụ tạo → hệ thống tự gán **TẤT CẢ cơ động của khu vực** cửa hàng đó (mỗi khu vực ≥2 cơ động), hiển thị tên họ kèm "Ban Quản lý giao", các bạn **tự chia nhau, cùng kiểm soát**.
- **Quan trọng — Aroma đã làm rõ:** Aroma để **cột M = tên/mã chức danh** (CDSG/CDMT...), rồi vào **tab Phân quyền** gán quyền + khu vực. *Lưu ý:* gán trong Phân quyền chỉ là **cấp quyền truy cập** — **KHÔNG tự khiến sự vụ chảy về cơ động.** Routing là code riêng phải viết.
- *Chặn bởi 2 điều:*
  1. **Cột M phải có dữ liệu trong DB** (chạy FULL sync — Mục 4.4) để nhận diện CDSG/CDMT.
  2. **Đổi mô hình người xử lý từ 1 → NHIỀU người.** Hiện `su_vu.nguoi_xu_ly_ma` chỉ 1 mã; `fn_su_vu_xac_nhan_xong` chỉ cho đúng 1 người xác nhận. Cần bảng `su_vu_nguoi_xu_ly` (hoặc mảng) + sửa xác nhận thành `p_ma_nv IN (danh sách)`.
- *Cần chốt khi làm:* cơ động ↔ khu vực lấy ở đâu — `nhan_vien.khu_vuc` khớp `cua_hang.khu_vuc`, hay theo "khu vực phụ trách" gán trong Phân quyền cho chức danh CDSG/CDMT.

### 6.3 [SỰ VỤ] Việc 2 phần còn lại (chưa làm)
- 3 danh sách tách rõ: **đang xử lý / sắp hết hạn / quá hạn** (trong `05-bangiao-ql.js`).
- Nút/công cụ **chỉnh deadline** riêng; công cụ **đổi người phụ trách** riêng (hiện chỉ gián tiếp qua modal phản hồi).

### 6.4 [CHT] Chưa rõ
- Cửa hàng trưởng (CHT) đăng nhập thấy giao diện NV thường hay bán hàng? Quyết định mặc định cho CHT + phạm vi cửa hàng.

### 6.5 Tồn đọng cũ (không gấp)
- SePay bật lại API Key sau debug; SePay đối chiếu đơn (hoa hồng); Ahamove express dispatch `hoatoc` (BLOCKED: 3 quyết định kinh doanh + API key — COD cao, đồng bộ tồn kho, doanh thu đơn điều phối); push notification đơn hàng khi app CH đóng (cần VAPID); gộp sự vụ bàn giao; VietQR `DH_QR` còn TEST; camera/face-scan lỗi sâu iOS (Lockdown/Screen Time) — Aroma tự xử; `bh-toast` còn `pointer-events:auto` (nguy cơ ghost tương tự — chưa fix).

---

## 7. CẤU TRÚC SUPABASE — bảng & cột quan trọng (lấy đầy đủ theo Mục 9)

> Project ref `yeyiduztwdcyguivomxq`. ~66+ bảng. Dưới đây là cột hay dùng; cột chi tiết chạy query Mục 9.

- **`nhan_vien`** (PK `ma_nv`): ho_ten, **role (enum)**, **chuc_vu (text)**, **chuc_danh_m (text — raw cột M, dùng cho chức danh hiệu dụng & cơ động)**, mat_khau_hash, mat_khau_plain, da_doi_mk, ma_ch_mac_dinh, so_dien_thoai, email, ngay_vao_lam, trang_thai, **khu_vuc**, ten_ch_snapshot, avatar_url.
- **`quan_ly`** (PK `ma_ql`): ho_ten, **role (enum)**, **chuc_danh_m (text)**, mat_khau_hash, mat_khau_plain, da_doi_mk, **khu_vuc_phu_trach (ARRAY)**, so_dien_thoai, email, trang_thai, bo_phan(NULL).
- **`chuc_danh_quyen`** (PK `chuc_danh`): ten_hien_thi, quyen(jsonb), pham_vi(text), khu_vuc_phu_trach(jsonb), nhom, updated_at, updated_by.
- **`quyen_ca_nhan`** (PK `ma_nv`): ten_nv, quyen(jsonb), pham_vi, khu_vuc_phu_trach(jsonb).
- **`nhom_phan_quyen`** (PK `ten`): thu_tu.
- **`nhom_thanh_vien`**: nhom, loai('chuc_danh'|'ca_nhan'), ma, ten_hien_thi, thu_tu, PK(nhom,loai,ma).
- **`su_vu`** (PK `id` uuid): ban_giao_id, loai (TAI_SAN_KHONG_DAT/TIEN_LECH/HANG_CHENH...), ma_ch, ten_ch_snapshot, nguoi_tao_ma_nv/ten/chuc_vu, tieu_de, mo_ta, so_lieu(jsonb), anh_urls(ARRAY), muc_do(KHAN_CAP/QUAN_TRONG/CAN_THIET), trang_thai, **deadline_xu_ly (timestamptz)**, nguoi_phu_trach_ma_nv/ten, **nguoi_xu_ly_ma/ten/loai/ch (SINGLE — cần đổi sang nhiều cho 6.2)**, phan_hoi_xu_ly, phan_hoi_anh_urls, anh_phan_hoi, thoi_gian_tiep_nhan/bat_dau_xu_ly/phan_hoi/**xu_ly_xong**/dong, nguoi_dong_ma_nv/ten/vai_tro (CHECK ∈ TAI_KHOAN_CH/TRUONG_CA/QUAN_LY), ghi_chu_dong, ma_sv, **so_lan_bao_lai (int default 1)**, **thoi_gian_bao_lai_cuoi (timestamptz)**, da_escalate, created_at, updated_at.
  - **Trạng thái:** MOI_TAO → DA_TIEP_NHAN → DANG_XU_LY → DA_PHAN_HOI → DA_XU_LY_XONG → HOAN_TAT / HUY.
- **`su_vu_audit`**: su_vu_id, action (CREATE/UPDATE_REPEAT/RESPOND/PHAN_HOI...), ma_nv, ten_nv, vai_tro, noi_dung(jsonb) HOẶC payload(jsonb), created_at.
- **`su_vu_nguoi_xem`**: su_vu_id, ... (đếm số người xem).
- **`cham_cong`**: id, idempotency_key, ma_nv, ma_ch, loai(enum VAO_CA/RA_CA/VAO_GIUA_CA/RA_GIUA_CA), thoi_gian, lat, lng, khoang_cach_m, anh_url, ngay, xac_nhan, ma_ch_dieu_chinh, loai_dieu_chinh(enum), **nguon (text — gồm 'CO_DONG')**, device_info, ghi_chu, ten_ch_snapshot.
- **`gio_cong_ngay_ch`** (pre-computed): ma_nv, ngay, thu_tu, gio_vao/ra, loai_vao/ra, ma_ch_vao/ra, gio_cong, hop_le, ly_do_khong_hop_le, updated_at.
- **`tong_hop_thang`**: ma_nv, thang, so_ngay_cong, tong_gio_cong, break_phut.
- **`canh_bao`**: id, cham_cong_id, ma_nv, ma_ch, loai_canh_bao, noi_dung, gio_chamcong(time), ngay, trang_thai(DA_DUYET/TU_CHOI/CHO_DUYET/CHUA_GIAI_TRINH/DA_GIAI_TRINH), nguoi_duyet, ghi_chu_duyet.
- **`cua_hang`**: ma_ch, ten_ch, khu_vuc, lat, lng, dia_chi, trang_thai. **`app_settings`**: key, value(jsonb).

### RPC đã biết (không đầy đủ — lấy chi tiết Mục 9)
- **Auth/chung:** `fn_dang_nhap`, `fn_get_data_login`, `fn_doi_mat_khau_v2`, `fn_get_thong_bao`, `fn_get_all_settings`.
- **Phân quyền (cũ):** `fn_get_quyen_user(p_ma)`, `fn_save_quyen_chuc_danh`, `fn_list_chuc_danh`. Gate `_check_role_admin_qlns(p_admin)`.
- **Phân quyền (đợt mới `fn_pq_*`):** `fn_pq_tree`, `fn_pq_tim`, `fn_pq_them_thanh_vien`, `fn_pq_xoa_thanh_vien`, `fn_pq_ap_nhieu`, `fn_nhom_doi_ten`, `fn_nhom_xoa`.
- **Giờ công:** `fn_get_gio_cong_thang`, `fn_tong_hop_ngay`, `fn_ghi_cham_cong_v2(...,p_nguon)`, `fn_admin_sua_cham_cong`, `fn_duyet_canh_bao`, `fn_get_nhan_su_overview`, `fn_get_tong_hop_thang_all`, `fn_thong_ke_gio_cong_thang`.
- **Sự vụ:** `fn_su_vu_list(...,p_nguoi_xu_ly)`, `fn_su_vu_create` (→ jsonb, chống trùng + auto deadline), `fn_su_vu_tiep_nhan`, `fn_su_vu_bat_dau_xu_ly`, `fn_su_vu_phan_hoi` (2 overload — 8 tham số deadline bắt buộc; 12 tham số + nguoi_xu_ly_* deadline tùy chọn), `fn_su_vu_xac_nhan_xong(p_id,p_ma_nv,p_ten_nv)` (chỉ 1 người xử lý), `fn_su_vu_dong(p_id,p_ma_nv,p_ten_nv,p_vai_tro_dong,p_ghi_chu)` (đã chặn quyền), `fn_su_vu_huy`, `fn_su_vu_detail`, `fn_su_vu_delete`, `fn_su_vu_delete_bulk`, `fn_ban_giao_timeline_ql`. **Lưu ý: `fn_su_vu_hoan_tat` KHÔNG tồn tại** (comment cũ sai — QL đóng qua `fn_su_vu_dong`).
- **Khẩn cấp:** `fn_admin_emergency_delete(p_ma,p_password,p_tables[],p_confirm)`.

---

## 8. SQL GOM ĐỂ CHẠY LẠI CHO AN TOÀN (idempotent / CREATE OR REPLACE; có DROP khi đổi return type)

> Các file SQL đã giao gần đây — Aroma kiểm tra đã chạy chưa:
> - `sql_dot4_phanquyen_p3.sql` — bảng `nhom_thanh_vien` + các hàm `fn_pq_*` (Aroma đã chạy, xác nhận tree+tim chạy).
> - `sql_sync_cotM.sql` — 2 hàm batch ghi `chuc_danh_m` (đã chạy).
> - **`sql_su_vu_fix_quyen_trung.sql`** — gộp VIỆC 1 (khóa quyền đóng) + VIỆC 3 (chống trùng) + VIỆC 2 phần deadline. **Có `DROP FUNCTION fn_su_vu_create(...)` trước CREATE** (vì đổi uuid→jsonb). Nội dung chính:
>   - `ALTER TABLE su_vu ADD COLUMN IF NOT EXISTS so_lan_bao_lai int DEFAULT 1;`
>   - `ALTER TABLE su_vu ADD COLUMN IF NOT EXISTS thoi_gian_bao_lai_cuoi timestamptz;`
>   - `fn_su_vu_dong` — thêm chặn: `v_la_ql = EXISTS(quan_ly WHERE ma_ql=p_ma_nv)`, `v_la_ch = (p_ma_nv = su_vu.ma_ch)`, NOT cả hai → lỗi quyền.
>   - `DROP FUNCTION IF EXISTS public.fn_su_vu_create(uuid,text,text,text,text,text,text,text,text,jsonb,text[],text);`
>   - `fn_su_vu_create` → RETURNS jsonb `{id,trung,so_lan}`; tự gán `deadline_xu_ly` (24h/48h/7 ngày theo muc_do) + `nguoi_phu_trach_ten='Ban Quản lý'` khi tạo mới; gộp vào sự vụ cũ + `so_lan_bao_lai+1` + audit khi trùng.

### Kiểm tra nhanh sau khi chạy
```sql
-- VIỆC 1: phải trả lỗi quyền (NS00321 = cơ động)
SELECT id FROM su_vu WHERE trang_thai NOT IN ('HOAN_TAT','HUY') LIMIT 1;
SELECT fn_su_vu_dong('<uuid-thật>','NS00321','Test','TRUONG_CA');
-- Cột M:
SELECT ma_nv, role, chuc_danh_m FROM nhan_vien WHERE chuc_danh_m IS NOT NULL LIMIT 10;
```

> (Các gói SQL cũ vẫn cần kiểm tra đã chạy: bảng/hàm phân quyền cũ `chuc_danh_quyen` + `fn_get_quyen_user`/`fn_save_quyen_chuc_danh`/`fn_list_chuc_danh`; `su_vu.thoi_gian_xu_ly_xong` + `fn_su_vu_xac_nhan_xong`; `fn_admin_emergency_delete`. Nội dung gốc đã có trong các file SQL đã giao.)

---

## 9. CÁCH LẤY FULL CẤU TRÚC SUPABASE (đính kèm cho chat mới)

Chạy trên Supabase → SQL Editor, copy kết quả (Markdown) dán vào chat mới:

(a) Toàn bộ cột mọi bảng:
```sql
SELECT table_name, ordinal_position AS pos, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema='public'
ORDER BY table_name, ordinal_position;
```
(b) Tất cả hàm RPC + tham số:
```sql
SELECT p.proname AS ten_ham, pg_get_function_identity_arguments(p.oid) AS tham_so
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' ORDER BY p.proname;
```
(c) Định nghĩa đầy đủ 1 hàm (khi cần sửa):
```sql
SELECT pg_get_functiondef('TEN_HAM'::regproc);
```
(d) Enum:
```sql
SELECT t.typname, string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS gia_tri
FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid
JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public'
GROUP BY t.typname ORDER BY t.typname;
```
→ Gửi (a) + (b) là đủ cho hầu hết việc; (c)/(d) khi đụng hàm/enum cụ thể.

---

## 10. NHẬT KÝ NỐI TIẾP (ghi thêm mỗi lần làm — KHÔNG xóa cũ)

- **v15.9** — Công cụ xóa dữ liệu khẩn cấp (tab Khẩn cấp, chỉ NS00490) + file bàn giao. SQL `fn_admin_emergency_delete` chờ chạy.
- **v16.71** — Fix mất chấm công: client chờ server xác nhận + retry, thất bại không ghi lịch sử giả.
- **v16.73** — Phân quyền: viết lại tab thành nhóm linh hoạt + multi-select + autocomplete (`07-phanquyen.js`). Backend `sql_dot4_phanquyen_p3.sql` (`fn_pq_*` + bảng `nhom_thanh_vien`) — Aroma đã chạy (tree+tim OK). **CHƯA runtime-test UI, CHƯA enforcement.**
- **v9.48 (ChamCongSync.gs)** — Fix đồng bộ cột M: thêm `chuc_danh_m` vào `syncNhanVienToSupabase` + `syncQuanLyToSupabase`. **CHỜ Aroma dán vào Apps Script + chạy ĐỒNG BỘ FULL + verify SELECT.**
- **v16.74 → v16.75 (Sự vụ)** —
  - VIỆC 1 ✅ khóa quyền đóng (backend `fn_su_vu_dong` + frontend ẩn nút).
  - VIỆC 3 ✅ chống trùng (`fn_su_vu_create` → jsonb, `so_lan_bao_lai`, badge "báo lại N lần").
  - VIỆC 2 ⚠️ một phần: ✅ auto deadline (24/48/7 ngày) + "Ban Quản lý" + countdown d/g/p/s realtime cả 2 phía. ❌ tự gán cơ động khu vực, ❌ 3 danh sách, ⚠️ chỉnh deadline/đổi người (chỉ gián tiếp).
  - SQL: `sql_su_vu_fix_quyen_trung.sql` (có DROP trước fn_su_vu_create vì đổi return type — đã sửa lỗi 42P13). **Aroma chạy lại cả file.**
- **Tồn đọng ưu tiên kế tiếp:** (1) Enforcement phân quyền — nối `coQuyen()` vào chức năng (cần `07-phanquyen.js` + `fn_get_quyen_user` def). (2) Hoàn tất cột M (FULL sync). (3) Sự vụ: tự gán cơ động khu vực (cần cột M + mô hình 1→nhiều người xử lý) + 3 danh sách + công cụ chỉnh deadline/đổi người.

---

*(Lần sau ghi tiếp ở đây: phiên bản — việc đã làm — SQL cần chạy — file đã build.)*

---

### ⏩ NỐI TIẾP (cập nhật đến v17.59 · 01/07/2026)

> **Lưu ý:** nhật ký trên dừng ở v16.75 (24/6). Quãng v16.76→v17.51 không ghi từng bản; mục này chốt **TRẠNG THÁI HIỆN TẠI** + chi tiết đợt gần nhất (v17.52→v17.59). Nguồn sự thật vẫn là Supabase + code repo.

**Kiến trúc auth (nhắc lại — quan trọng):** 2 bảng riêng `nhan_vien` (PK `ma_nv`, role NV/CTV, cột `chuc_danh_m` = chức danh viết tắt, **cơ động = `chuc_danh_m LIKE 'CD%'`** vd CDSG) + `quan_ly` (PK `ma_ql`, cột `role` = ADMIN/QLNS/QLBH). RPC admin tra `quan_ly` qua `role`. Không RLS, dùng SECURITY DEFINER + GRANT anon.

**HỆ ĐIỂM PHONG ĐỘ (mới — hoàn tất đợt này):**
- Kiến trúc: sự kiện trừ tính SỐNG từ dữ liệu gốc + bảng `diem_mien` (xóa điểm trừ = ghi 1 dòng miễn, giữ audit; bấm lại = khôi phục). Điểm = GREATEST(0, 10 − (số sự kiện − số miễn)) trong tháng. **Reset tự động theo tháng** (RPC mặc định tháng hiện tại).
- 5 máy dò (`fn_diem_su_kien_thang`): QUEN_RA (`cham_cong.nguon='AUTO_CLOSE'`), QUEN_VAO (`gio_cong_ngay_ch.ly_do_khong_hop_le='THIEU_VAO'`), THIEU_LICH (tuần T2–CN không có dòng `lich_ca`, deadline CN trước), THIEU_ANH (`muanon_tuan` đã kết thúc mà NV không có `muanon_baigui` SUBMITTED), THIEU_BANGIAO (CH có TC ngày đã qua mà không có `ban_giao` → TC đó −1). **Cơ động loại sạch** (`chuc_danh_m LIKE 'CD%'`).
- RPC: `fn_diem_chi_tiet(p_ma_nv,p_thang)`, `fn_diem_tat_ca(p_thang)`, `fn_toggle_mien_diem(p_ma_ql,p_ma_nv,p_loai,p_source_key,p_ngay,p_ly_do)` (chỉ ADMIN/QLNS), `fn_diem_nhan_vien` viết lại (thẻ Chấm công gọi, chỉ đọc field `diem`).
- **SQL:** `diem_he_thong.sql` (Aroma ĐÃ CHẠY). Trước đó `fn_diem_nhan_vien.sql` (bản baseline — đã bị bản mới thay).
- **UI:**
  - Thẻ điểm màn Chấm công (`page-chamcong`, `id="diem-card"`) + `taiDiemPhongDo()` trong `02-system.js` — ẩn nếu cơ động.
  - **Hub "ĐIỂM HỆ THỐNG"** (admin): file mới `js/admin/09-diem-hethong.js` (`diemHubOpen()`), launch trong menu phân hệ nhóm Nhân sự (`02-system.js`). Overlay: list hàng ngang (avatar·tên·thanh điểm·X/10, màu theo điểm), lọc khu vực, đổi tháng ‹›, bấm NV → xổ chi tiết + nút Xóa điểm trừ/Khôi phục.
  - **Thẻ điểm + lịch sử trừ tab Tài khoản** (`page-taikhoan`, `id="tk-diem-wrap"`) + `taiDiemTaiKhoan()` gọi trong `renderTaiKhoan()` — ẩn nếu cơ động.

**SỬA LỖI QUY TRÌNH đợt này:**
- **TC ra ca cuối ngày** (`08-truongca.js` `tcAskRaCaTransfer`): dialog 2 lối — *chuyển cho người còn ca* HOẶC nút **"Ra ca cuối ngày — đóng cửa hàng"** (không chuyển, gọi `tcRaCaSkip`). (Sửa lại việc siết bắt buộc chuyển ở v17.54.)
- **GAS `ChamcongSync.gs`**: menu mới **"Tổng hợp GIỜ CÔNG (chọn KHOẢNG NGÀY)"** (`menuTongHopGioCongKhoang`) — nhập ngày bắt đầu/kết thúc, mặc định tháng hiện tại; `syncTongHopGioCong(p_tu,p_den)` lặp từng tháng qua RPC `fn_thong_ke_gio_cong_thang` rồi lọc đúng khoảng (KHÔNG sửa RPC). Giải quyết mất dữ liệu khi qua tháng mới (dữ liệu gốc vẫn ở Supabase, query lại là có). **Đề xuất chưa làm:** ghi kết quả khoảng ra tab riêng theo tháng để lưu vĩnh viễn.
- Trước đó (cùng chuỗi gần đây): `fix_login_chan_inactive.sql` (chặn tài khoản INACTIVE đăng nhập — ĐÃ CHẠY), `fn_admin_sua_cham_cong_truongca.sql` (Sửa lịch thêm cờ TC, param `p_truong_ca` — ĐÃ CHẠY), GAS thêm sheet "TỔNG HỢP CỬA HÀNG" + giờ công dạng số thập phân, GAS prune xóa tài khoản (`fn_prune_danh_sach`).

**LỀ GIAO DIỆN:**
- Mobile: `.header-inner` padding 20px→14px (khớp mọi card 14px). — `css/01-base.css`.
- PC (≥1024px): gom 5 trang phone-style (chấm công, lịch ca, giờ công, mẫu nón, chương trình) cùng khổ 600px; bỏ cap 560px của `.ct-wrap`. — `css/04-responsive.css`, `css/06-modules.css`.

**Bản version:** hiện **v17.59**. Quy tắc bump: 5 chỗ đồng thời (index.html `?v=`, sw.js `nonson-vX`, `02-system.js sys.cache_version`, login sub, tab Tài khoản) — dùng `perl -i -pe 's/17\.NN/17.MM/g' index.html sw.js js/core/02-system.js` + SQL `app_settings sys.cache_version`.

**Tồn đọng:** (1) Enforcement phân quyền (menu chưa nối `coQuyen()`). (2) Khóa TC ra ca phía server trong `fn_ghi_cham_cong_v2` (frontend đã khóa mềm; server chưa — cần logic "ai là TC hiện tại", tham khảo `fn_truong_ca_trang_thai`). (3) Tab riêng lưu tổng hợp giờ công theo tháng (đề xuất). (4) Máy dò THIEU_LICH/THIEU_ANH dùng existence, chưa xét nộp trễ so với deadline (chấp nhận cho v1).

---

## ⏩ NỐI TIẾP (v17.60 · 01/07/2026 — cùng ngày, sau v17.59)

**GAS `ChamcongSync.gs` — sửa TIMEOUT đồng bộ 5 bảng** (bảng DATA CHẤM CÔNG ~27k dòng, tăng ~1.500 dòng/ngày):
- Nguyên nhân chính: `Utilities.formatDate` gọi ~108k lần (rất chậm) + chạy chung 5 bảng > 6 phút.
- Sửa: (1) helper `_ccVN(iso)` format nhanh UTC+7 bằng JS thuần (thay toàn bộ `Utilities.formatDate` trong `syncChamCongFromSupabase` — doiMap + rows); (2) `CFG.CC_SO_NGAY_SHEET=45` → bảng CC chỉ lấy 45 ngày gần nhất (`&thoi_gian=gte.<cutoff>`); (3) menu mới **"Refresh CHỈ Chấm công (bảng lớn)"** (`menuRefreshChiCC`) chạy riêng, không cộng dồn 4 bảng kia.
- Lịch sử đầy đủ vẫn ở Supabase; xem tháng cũ qua menu "Tổng hợp GIỜ CÔNG (chọn KHOẢNG NGÀY)". Chỉnh `CC_SO_NGAY_SHEET` nếu cần nhiều/ít hơn. **GAS-only, không bump version.**

**Cửa hàng "Văn Phòng" KHÔNG cần trưởng ca** (bảng `cua_hang` KHÔNG có cột phân loại — nhận theo `ten_ch`):
- Nhân viên ở Văn Phòng bấm chuyển TC nhầm → sinh các dòng chuyển ca rác. Dòng tự sinh này **`nguon` ≠ `AUTO_CHUYEN_TC`** (ghi chú "Tự động chốt giờ Trưởng ca khi chuyển / nhận vai trò Trưởng ca / vào ca lại (nhân viên thường)"), **không có GPS**.
- SQL dọn: `xoa_chuyen_tc_vanphong_0107_v2.sql` — lọc theo `ten_ch_snapshot ILIKE '%Văn Phòng%'` + `ghi_chu ILIKE '%Trưởng ca%' OR '%vào ca lại%'` (KHÔNG theo nguon), xóa + `fn_tong_hop_ngay` tính lại giờ công. (Bản v1 lọc nguon='AUTO_CHUYEN_TC' → trượt.)
- **HƯỚNG XỬ LÝ (Aroma chốt):** KHÔNG hardcode chặn TC phía frontend. Thay bằng **tính năng admin (làm sau)**: thêm cờ "không cần trưởng ca" cho cửa hàng — đề xuất cột `cua_hang.khong_can_tc` (bool) hoặc list `ma_ch` trong `app_settings` — + toggle trong tab Admin; dialog/logic TC đọc cờ đó để bỏ qua ở các CH đánh dấu. Dữ liệu rác trước mắt đã dọn bằng SQL.

**v17.60 — sửa thẻ "Hệ thống tự động" đếm ra 0** (`js/pages/02-nhansu.js`, Nhân sự → Lịch sử chấm công):
- Cũ: auto = **chỉ** `nguon==='AUTO_CLOSE'` (5 chỗ: HTML onclick, đếm, tag, lọc, card active) → sót ca chuyển TC / tự đóng có nguon khác → ra 0.
- Sửa: helper `_ccIsAuto(r)` = `ghi_chu` bắt đầu "Tự động" **hoặc** `nguon` ∈ (AUTO_CLOSE, AUTO_CHUYEN_TC). Filter thẻ đổi sang sentinel `'AUTO'` (nhánh `list.filter(_ccIsAuto)`); onclick HTML → `lscFilterByNguon('AUTO')`; card active theo `'AUTO'`.
- Files đổi: `index.html` (onclick + version), `js/pages/02-nhansu.js` (helper + 4 chỗ), `sw.js` + `js/core/02-system.js` (version).

**Bản version:** **v17.60**. SQL app_settings: `INSERT INTO app_settings (key,value,updated_at) VALUES ('sys.cache_version','"v17.60"'::jsonb,now()) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now();`

---

## ⏩ NỐI TIẾP (v17.61 · 01/07/2026 — audit điểm trừ)

**Bối cảnh:** Aroma báo điểm trừ sai (NS00959 bị trừ "thiếu ca" oan; CTV0207 thiếu ca không bị trừ). Audit ra 2 gốc.

**GỐC 1 — Ghép giờ công vs chuyển TC (`fix_giocong_chuyen_tc_v3.sql`, backend, Aroma chạy):**
- Chuyển TC tự đẻ 2 dòng bookkeeping: auto-RA (đóng TC) + auto-VÀO "vào ca lại" (`nguon='AUTO_CHUYEN_TC'`), cách ~1s. Đây KHÔNG phải mốc làm việc thật; NV KHÔNG sai.
- Bản v2 lọc cặp này bằng "hàng xóm liền kề" (LEAD/LAG) → **trượt khi ra-ca-THẬT chen giữa** (NS00959: auto-RA 11:11:59 · ra-thật 11:12:00.794 · auto-VÀO 11:12:00.862) → đẻ 2 phiên rác THIEU_VAO + THIEU_RA → trừ điểm oan.
- **v3:** nhận cặp theo **cửa sổ ±5s (EXISTS)**, bất kể dòng thật chen giữa. Giữ auto-RA đơn lẻ (ca "chuyển TC rồi nghỉ" cũ). Cuối file tự `fn_tong_hop_ngay` lại cho MỌI NV từng chuyển TC (theo từng tháng). KHÔNG xoá dữ liệu.

**GỐC 2 — Máy dò (`diem_may_do_v2.sql` = fn_diem_su_kien_thang v2, backend). Quy tắc Aroma chốt:**
- **Quên ra ca:** thêm phiên `THIEU_RA` (vào chưa ra) bên cạnh `AUTO_CLOSE` (cùng loại QUEN_RA, source_key `...#thu_tu#RA`). **CHỈ tính `ngay < CURRENT_DATE`** — ca đang mở hôm nay (đang làm việc, chưa tới giờ ra) cũng là THIEU_RA nhưng KHÔNG phải quên → loại ra.
- **Bổ sung ca (loại MỚI `BO_SUNG`):** mỗi dòng `nguon='BO_SUNG_NV'` = 1 điểm ("quên mới bổ sung"), source_key = cham_cong.id.
- **Thiếu bàn giao:** đổi từ "chỉ TC" → **MỌI nhân viên (trừ cơ động) có chấm công tại CH đó ngày đó** khi CH có TC on-duty mà không có `ban_giao`. source_key `ma_ch#ngay` (mỗi NV 1 dòng).
- **CTV VẪN tính đủ** (kể cả THIEU_LICH/THIEU_ANH). **Nhiều lỗi/ngày = đếm từng lỗi** (source_key khác nhau, không trùng). QUEN_VAO/THIEU_LICH/THIEU_ANH giữ nguyên.
- KHÔNG có tầng "duyệt thì tha" — admin dùng nút "Xóa điểm trừ" (diem_mien) cho ngoại lệ.

**Frontend v17.61:** thêm nhãn/màu loại `BO_SUNG` ('Bổ sung ca', teal #0D9488) vào 2 map: `_diemLoai` (js/admin/09-diem-hethong.js) + `_lo` (js/core/02-system.js ~953). Files đổi: 09-diem-hethong.js, 02-system.js, index.html+sw.js (version).

**THỨ TỰ CHẠY:** (1) `fix_giocong_chuyen_tc_v3.sql` → (2) `diem_may_do_v2.sql` → (3) giải nén `chamcong_v17.61_files.zip` → (4) SQL app_settings v17.61 → vào hub "Điểm hệ thống" Tải lại.

**TỒN ĐỌNG:** chặn TC ở Văn Phòng (tính năng admin, chưa làm — xem mục v17.60). Cờ "không cần TC" cho CH cũng sẽ giúp THIEU_BANGIAO không trừ oan NV ở CH không cần bàn giao.

**SQL app_settings v17.61:** `INSERT INTO app_settings (key,value,updated_at) VALUES ('sys.cache_version','"v17.61"'::jsonb,now()) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now();`

---

## ⏩ NỐI TIẾP (máy dò điểm v3 — SỬA TRỪ ĐÚP · 01/07/2026)

**`diem_may_do_v3.sql` THAY `diem_may_do_v2.sql`** (v2 bị trừ đúp: bổ sung ca tạo dòng chấm chưa đối ứng → phiên "thiếu ra" → đếm 2 lần "Bổ sung ca" + "Quên ra ca" cho cùng 1 sự việc).

**Mô hình v3 — đếm quên chấm THEO PHIÊN giờ công:**
- Mỗi PHIÊN (gio_cong_ngay_ch) có **dấu hiệu chắc chắn** = 1 điểm: dòng chấm `BO_SUNG_NV` **hoặc** `AUTO_CLOSE` (khớp `cham_cong.thoi_gian = g.gio_vao/gio_ra`).
- 1 phiên dù vừa bổ sung vừa tự đóng → **1 điểm** (ưu tiên nhãn BO_SUNG, else QUEN_RA). source_key = `ma_nv#ngay#thu_tu` → không trùng.
- **BỎ 2 máy dò thô THIEU_VAO / THIEU_RA** (cũ). Lý do: phiên đang mở (đang làm) + chấm sai loại (bấm nhầm Vào/Ra) đều KHÔNG có 2 dấu hiệu trên → không tính → hết trừ oan người đang làm + hết nhầm quên với thao tác sai.
- Nguyên tắc chốt: **hành động "bổ sung ca" là căn cứ phân biệt quên-thật với bấm-nhầm** — không đoán trong ngày.
- THIEU_BANGIAO / THIEU_LICH / THIEU_ANH giữ nguyên. Dùng lại nhãn frontend BO_SUNG + QUEN_RA → **KHÔNG bump version** (v17.61 vẫn là bản frontend hiện hành).

**Chạy:** `fix_giocong_chuyen_tc_v3.sql` (nếu chưa) → `diem_may_do_v3.sql` → vào hub Điểm hệ thống Tải lại. (KHÔNG cần chạy diem_may_do_v2 nữa.)

---

## ⏩ NỐI TIẾP (v17.63 · 02/07/2026 — UI: Timeline + 2 overlay + phân tích lỗi)

**3 việc UI (làm chung 1 patch):**

1. **Tab Timeline (bàn giao QL, `js/admin/05-bangiao-ql.js`):** bỏ 2 dropdown "Mọi khu vực"/"Mọi cửa hàng", thay bằng 1 ô typeahead "Cửa hàng / khu vực" y chang tab Sự vụ (hàm `bgqlTlSearchInput/Label/PickKV/PickCH/Clear`, dd `#bgql-tl-search-dd`). Bố cục lọc **2×2**: [khoảng ngày · tình trạng] / [sắp xếp · ô tìm].

2. **Giám sát Trưởng ca (`js/pages/08-truongca.js`, tcOpenGiamSat…tcGsRender viết lại):** banner **xanh gradient + hình tròn nền**; ô typeahead khu vực/cửa hàng (`tcGsSearchInput/PickKhu/PickCh/Clear`); **4 thẻ số liệu bấm-để-lọc** (Tất cả / Có TC / Chưa có TC / Lỗi 2+ TC) qua `tcGsQuick(q)`. State: `_tcGsKhu/_tcGsCh/_tcGsQuick`. Dữ liệu vẫn từ `fn_truong_ca_toan_chuoi`.

3. **Điểm hệ thống (`js/admin/09-diem-hethong.js` viết lại):** banner **cam gradient + hình tròn nền**; ô typeahead **khu vực/cửa hàng/tên NV** (`diemSearchInput/PickKhu/PickCh/PickNv/Clear`); **sort** (điểm ↑/điểm ↓/lỗi nhiều→ít/tên); chip khu vực giữ; **thẻ "Kiểm soát điểm trừ"** = tổng quan (NV bị trừ · tổng lỗi · điểm TB) + **thống kê lỗi theo loại dạng bar, bấm loại để lọc danh sách** (`diemHubLoai`). State: `_diemHub{khu,ch,nv,loai,sort,…}`.

**Backend cho Điểm (`diem_tat_ca_v2.sql`, Aroma chạy):** mở rộng `fn_diem_tat_ca` — mỗi NV thêm `ma_ch/ten_ch` (cửa hàng mặc định, cho typeahead cửa hàng) + `cac_loai` (mảng loại đang mắc, cho lọc theo loại) + trả `thong_ke_loai` (đếm lỗi chưa-miễn theo loại, cho phân tích). Gọi máy dò 1 lần (MATERIALIZED). Frontend chỉ cần 1 RPC.

**Bản version: v17.63.** SQL app_settings: `INSERT INTO app_settings (key,value,updated_at) VALUES ('sys.cache_version','"v17.63"'::jsonb,now()) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now();`

**THỨ TỰ CHẠY:** (1) `diem_tat_ca_v2.sql` → (2) giải nén `chamcong_v17.63_files.zip` → (3) SQL app_settings v17.63 → mở lại các màn.

**TỒN ĐỌNG:** chặn TC ở Văn Phòng (tính năng admin cờ "không cần TC" — chưa làm). "Cửa hàng" trong Điểm hiện lấy theo cửa hàng mặc định của NV (nhan_vien.ma_ch_mac_dinh), không phải nơi phát sinh lỗi.

---

## ⏩ NỐI TIẾP (v17.64 · 02/07/2026 — tinh chỉnh Điểm hệ thống)

Theo 5 yêu cầu tinh chỉnh của Aroma (`js/admin/09-diem-hethong.js` viết lại):
1. Banner **bo góc 16px + có độ hở** (inset: wrap `padding:12px 14px 2px`, overlay nền #F1F5F9).
2. Gradient **đậm TRÁI → nhạt PHẢI**: `linear-gradient(100deg,#C2410C,#EA580C,#FB923C)` (đảo lại so với v17.63).
3. **Bộ lọc 1 hàng**: ô tìm khu vực/cửa hàng/NV (flex) + select **loại lỗi** (`diemHubSetLoai`, options từ thong_ke_loai) + select **sort** (điểm ↑/↓, lỗi, tên). Đồng bộ với bar phân tích (`diemHubLoai` toggle).
4. **Bỏ chip khu vực** (lọc khu vực giờ qua ô tìm). Lề 14px + bo góc thống nhất.
5. **Avatar = ẢNH nhân viên** (`avatar` từ RPC), fallback chữ cái nếu lỗi ảnh; **rê chuột phóng to** (`diemAvatarZoom/Unzoom`, popup 170px fixed).

**Backend (`diem_tat_ca_v3.sql`, Aroma chạy):** `fn_diem_tat_ca` thêm field `avatar` = `nhan_vien.avatar_url` (cho avatar list). Các field khác giữ như v2.

**Bản version: v17.64.** SQL app_settings: `INSERT INTO app_settings (key,value,updated_at) VALUES ('sys.cache_version','"v17.64"'::jsonb,now()) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now();`

Chạy: (1) `diem_tat_ca_v3.sql` → (2) giải nén `chamcong_v17.64_files.zip` → (3) SQL app_settings v17.64 → mở lại Điểm hệ thống.
(Ghi chú: có thể áp cùng cách bo-góc/gradient/avatar cho overlay Giám sát TC nếu anh muốn đồng bộ — chưa làm, chờ anh.)

---

## ⏩ NỐI TIẾP (v17.65 · 02/07/2026)
- **Điểm hệ thống:** BỎ khối "Kiểm soát điểm trừ" (analytics) khỏi body — `_diemHubPaint` giờ chỉ render list. Filter loại lỗi + sort ở hàng trên vẫn giữ. (`_diemHubAnalyticsHtml` còn trong file nhưng không gọi.)
- **Giám sát Trưởng ca:** header đổi sang chuẩn như Điểm — banner **bo góc 16px + độ hở** (wrap padding 12px 14px 2px, nền overlay #F1F5F9), gradient **đậm trái → nhạt phải** `linear-gradient(100deg,#0F6E56,#149C74,#34D399)`; controls/body lề 14px.
- **v17.65.** app_settings: `INSERT INTO app_settings (key,value,updated_at) VALUES ('sys.cache_version','"v17.65"'::jsonb,now()) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now();`

---

## ⏩ NỐI TIẾP (v17.66 · 02/07/2026 — ẩn dòng auto chuyển TC khỏi hiển thị)

**Vấn đề:** chuyển TC tự sinh dòng "Tự động chốt giờ Trưởng ca khi chuyển" + "Tự động vào ca lại (nhân viên thường)" — các dòng này hiển thị ở app mọi tài khoản (nhân viên + admin) gây nhiễu. Yêu cầu: chỉ giữ trên Google Sheet, ẨN khỏi app. **Không ẩn auto-close (quên ra).**

**Cách làm (frontend-only, không đụng backend/giờ công — giờ công đã đúng từ v3):**
- Helper `_ccHideAutoTc(ghiChu)` (js/core/02-system.js): true nếu `ghi_chu` bắt đầu "Tự động" VÀ chứa "Trưởng ca" hoặc "vào ca lại". (RPC `fn_get_lich_su_hom_nay` KHÔNG trả `nguon` nên lọc theo ghi chú.)
- **Nhật ký chấm công NV** (`taiLichSu`) + **tóm tắt ca** (`hienTomTatCa`): bỏ qua dòng khớp `_ccHideAutoTc`.
- **Lịch sử chấm công admin** (js/pages/02-nhansu.js): `all = all.filter(r => r.nguon !== 'AUTO_CHUYEN_TC')` ngay sau khi fetch (có field nguon ở đây) → ẩn khỏi cả list + stats. Thẻ "Hệ thống tự động" giờ chỉ còn đếm AUTO_CLOSE.
- Giờ công NV/QL dùng session server (`fn_get_gio_cong_thang`, đã sạch nhờ v3) → không đổi.

**v17.66.** app_settings: `INSERT INTO app_settings (key,value,updated_at) VALUES ('sys.cache_version','"v17.66"'::jsonb,now()) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now();`

---

## ⏩ NỐI TIẾP (máy dò điểm v4 · 02/07/2026)
**`diem_may_do_v4.sql` THAY `diem_may_do_v3.sql`** — chỉ 1 thay đổi ở máy dò THIEU_BANGIAO: **loại cửa hàng Văn Phòng + Cơ Động** khỏi việc xét thiếu bàn giao:
```
AND COALESCE(cc.ten_ch_snapshot,'') NOT ILIKE '%văn phòng%'
AND COALESCE(cc.ten_ch_snapshot,'') NOT ILIKE '%cơ động%'
```
→ nhân viên chấm công tại CH "Văn Phòng"/"Cơ Động …" không bị trừ điểm thiếu bàn giao. Các máy dò khác giữ nguyên. Backend-only, KHÔNG đổi frontend/version.
Chạy: `diem_may_do_v4.sql` → hub Điểm hệ thống Tải lại.
(Ghi chú: khi làm cờ "không cần TC/bàn giao" cho cửa hàng sau này, nên thay cách lọc theo-tên này bằng cờ trong bảng cua_hang cho chuẩn.)

---

## ⏩ NỐI TIẾP (máy dò điểm v5 · 02/07/2026)
**`diem_may_do_v5.sql` THAY v4** — THIEU_BANGIAO loại thêm **Hội Chợ** + **Đội SALE**. Tổng cộng không xét bàn giao cho: Văn Phòng, Cơ Động, Hội Chợ, Đội SALE.
```
AND COALESCE(cc.ten_ch_snapshot,'') NOT ILIKE '%hội chợ%'
AND COALESCE(cc.ten_ch_snapshot,'') NOT ILIKE '%đội sale%'
AND COALESCE(cc.ten_ch_snapshot,'') NOT ILIKE '%doi sale%'
AND COALESCE(cc.ghi_chu,'')         NOT ILIKE '%đội sale%'   -- NV đội SALE hỗ trợ tại CH thường
```
(Đội SALE bắt cả tên CH "Đội SALE XX" lẫn ghi_chu "[Đội SALE XX] hỗ trợ…" — đúng cách app nhận diện.) Backend-only, KHÔNG đổi frontend/version. Chạy `diem_may_do_v5.sql` → hub Điểm hệ thống Tải lại.

---

## ⏩ NỐI TIẾP (máy dò điểm v6 · 02/07/2026)
**`diem_may_do_v6.sql` THAY v5** — 4 nơi đặc biệt (Văn Phòng, Cơ Động, Hội Chợ, Đội SALE) giờ KHÔNG bị xét cả **Thiếu lịch** + **Thiếu ảnh** (ngoài Thiếu bàn giao đã bỏ ở v5). Vì đây là quy tắc bán lẻ, không hợp văn phòng/đội sự kiện.
- Thiếu lịch + Thiếu ảnh: thêm `LEFT JOIN cua_hang ch0 ON ch0.ma_ch = nv.ma_ch_mac_dinh` + loại `ch0.ten_ch NOT ILIKE` (văn phòng/cơ động/hội chợ/đội sale/doi sale) — tức lọc theo **cửa hàng mặc định của NV**.
- GIỮ: Quên ra ca / Bổ sung ca (attendance) vẫn tính cho các nơi này (họ vẫn chấm công vào/ra).
Backend-only, KHÔNG đổi frontend/version. Chạy `diem_may_do_v6.sql` → hub Tải lại.

---

## ⏩ NỐI TIẾP (máy dò điểm v7 · 02/07/2026) — dùng v7, BỎ v6 (v6 miễn lịch/ảnh cho cả 4 nơi = quá)
**`diem_may_do_v7.sql` THAY v5/v6.** Hai thay đổi:
1. **Thiếu bàn giao — CHỈ trừ TRƯỞNG CA** (`cc.truong_ca = true`), thành viên khác KHÔNG bị trừ (trước v7 trừ tất cả thành viên). Vẫn loại 4 nơi (VP/Cơ Động/Hội Chợ/Đội SALE) khỏi xét bàn giao.
2. **Thiếu lịch + Thiếu ảnh — CHỈ Văn Phòng được miễn** (join `cua_hang ch0` theo `nv.ma_ch_mac_dinh`, `ch0.ten_ch NOT ILIKE '%văn phòng%'`). Cơ Động đã miễn sẵn qua CD%; Hội Chợ/Đội SALE VẪN xét lịch/ảnh (khác v6).
- Quên ra ca / Bổ sung ca: giữ nguyên cho mọi nơi.
Backend-only, KHÔNG đổi frontend/version. Chạy `diem_may_do_v7.sql` → hub Tải lại.

---

## ⏩ NỐI TIẾP (v17.67 · 03/07/2026 — modal Bổ sung ca: chọn ngày trong tháng, bỏ quota)
**Frontend (index.html + js/pages/03-donnghi-bosung.js + js/core/02-system.js):**
- Modal "Xin bổ sung ca": bỏ 2 nút Hôm nay/Hôm qua + ô quota → thay bằng **`<input type="date" id="bsc-ngay">`** với `min = đầu tháng`, `max = hôm nay` (chọn bất kỳ ngày trong tháng).
- `bscChonNgay` → thay bằng `bscSetupNgay()` (set default hôm nay + min/max). `moModalBoSungCa` bỏ load quota. `guiBoSungCa` thêm validate ngày trong tháng + bỏ quota khỏi toast.
- Bỏ badge "Còn X/3" ở menu (index.html span + fetch trong 02-system.js ~1112). (Quota giải trình/sửa CB ở 02-system ~3628 là feature KHÁC, giữ nguyên.)
- Lý do bỏ quota: đã có hệ điểm trừ (loại BO_SUNG) kiểm soát.

**⚠️ BACKEND CÒN TỒN — CHỜ SOURCE:** RPC `fn_nv_bo_sung_ca` (không có trong tài liệu) hiện có thể vẫn chặn hôm-nay/hôm-qua + quota 3/tháng. Cần Aroma gửi source để sửa: (a) bỏ giới hạn ngày (cho phép mọi ngày trong tháng, ≤ hôm nay), (b) bỏ quota. Trước khi sửa backend, nếu RPC chặn thì chọn ngày cũ/quá 3 lần sẽ báo lỗi.

**v17.67.** app_settings: `INSERT INTO app_settings (key,value,updated_at) VALUES ('sys.cache_version','"v17.67"'::jsonb,now()) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now();`

---

## ⏩ NỐI TIẾP (fn_nv_bo_sung_ca v2 · 03/07/2026) — hoàn tất backend bổ sung ca
Đã có source (2 overload). `fn_nv_bo_sung_ca_v2.sql` sửa **CẢ 2 bản** (6 & 7 tham số):
- `v_min_date = date_trunc('month', now VN)::date` (đầu tháng) thay cho `v_today - lui_days` → cho bổ sung **bất kỳ ngày trong tháng** (đến hôm nay). Khớp frontend v17.67 (input date min=đầu tháng, max=hôm nay).
- **BỎ chặn giờ 22h** (khối `v_chan_gio`) và **BỎ chặn quota** (khối `>= v_quota_max`). Đã có hệ điểm trừ BO_SUNG kiểm soát.
- Vẫn ghi `nv_quota_sua.so_lan_bo_sung_ca +1` (tra cứu) nhưng không chặn. Giữ nguyên: ghi cham_cong (nguon BO_SUNG_NV/CO_DONG), canh_bao, auto-duyệt cùng CH, thông báo QLNS/ADMIN, audit_log.
Backend-only, KHÔNG đổi frontend/version. Chạy `fn_nv_bo_sung_ca_v2.sql`.

**Cũng đã xong (data):** `fix_admin_trangthai.sql` — chuẩn hoá `quan_ly.trang_thai` về 'ACTIVE' → tài khoản ADMIN 1670 (Trần Thị Thu Hương) hết mất quyền duyệt/sửa. (Gốc: `_check_role_admin_qlns` chỉ nhận 'ACTIVE'; tài khoản tạo với 'ĐANG LÀM VIỆC' bị chặn. Nếu muốn bền hơn có thể sửa hàm đó nhận nhiều biến thể trạng thái — chưa cần vì đã chuẩn hoá data.)

---

## ⏩ NỐI TIẾP (v17.68 · 05/07/2026 — ĐẠI TU giao diện + phân quyền + RÀ LỖI CHỨC NĂNG 6 module)

> Phiên này Claude làm RẤT LỚN, TOÀN BỘ trên **nhánh git `fix-test`** (KHÔNG commit thẳng main). **15 commit, đều nằm trong release v17.68.** Aroma ĐÃ chạy 2 SQL (mục dưới) + ĐÃ test một vòng OK, **CHƯA merge `fix-test`→`main`**.
>
> **Quy tắc phiên (Aroma chốt):** sửa trên nhánh `fix-test`; KHÔNG tự chạy DDL (repo chỉ có **anon key** `sb_publishable_...` ở js/core/01-config.js:9 → không chạy được `CREATE FUNCTION`/SQL tùy ý; Aroma chạy tay — nếu sau cấp service_role key/connection string thì Claude tự chạy được); hỏi/verify trước, dần nới thành chủ động.

### 2 SQL Aroma ĐÃ CHẠY (production)
1. `INSERT INTO app_settings (key,value,updated_at) VALUES ('sys.cache_version','"v17.68"'::jsonb,now()) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now();`
2. `CREATE OR REPLACE FUNCTION fn_get_quyen_user(p_ma text)` — **đọc thêm `quyen_ca_nhan`** (override chuc_danh_quyen nếu có + mảng không rỗng) + `da_cau_hinh = (chức danh OR cá nhân)`. Lý do: hàm cũ chỉ đọc `chuc_danh_quyen` → set quyền cho **CÁ NHÂN** không load = 1 phần gốc lỗi (a). Nay quyền chức danh + cá nhân đều vào SESSION.

### Bump version
v17.67 → **v17.68**, 5 chỗ: index.html `?v=` (37), login sub, tab Tài khoản, sw.js CACHE_VERSION, 02-system `sys.cache_version`.

### ĐÃ LÀM (15 commit fix-test)
**A. GIAO DIỆN.** Bỏ hết tím/indigo (Thiếu lịch #7C3AED→cyan #0284C7; BXH bán chạy is-me→xanh chủ đạo, rank-10→xanh dương đậm; icon Lịch sử duyệt→xanh). Chuẩn hóa 4 ô search (Điểm HT/Giám sát TC/Bàn giao QL/Sự vụ) về kiểu `.suggest-list` màn Chấm công (bo 14px, shadow mềm, hover xanh, dòng chính xanh #0F6E56 / dòng phụ xám); Sự vụ đổi `<datalist>`→typeahead tự chế (`bgSvSearchInput`/`bgSvPickStore` ở 06-bangiao.js). Banner overlay Điểm HT (cam)/Giám sát TC (xanh)/Chương trình KM/Sự vụ KV → recipe `.cc-hero`, thêm token `--cc-hero-gradient-cam`/`--cc-hero-shadow-cam` (00-tokens.css). **Kích thước header đồng bộ theo CHUẨN LỊCH `.cc-hero-page` (padding 14/18, bubble 150/80, title 20/700, label 10):** kéo `.cc-hero` (Chấm công), 2 overlay, ct-banner, Sự vụ KV về đúng — dh-hero (Đơn hàng, back nav) + nvai (AI chat) GIỮ vì UX riêng. Overlay nền #F1F5F9→#f4f3ef; bỏ font Plus Jakarta Sans thừa. Dọn tên class: `--purple*`→`--teal-dark*` (tránh trùng `--teal` #14B8A6 ở 12-bangiao), `.bh-ql-stat.purple`→`.teal`, `.mna-tq-card.a-violet`→`.a-teal`; thẻ "Quản lý" rename `violet`→`teal` (giữ màu teal, Aroma dặn KHÔNG xanh dương); bỏ emoji chip mức độ + ★ badge phân quyền. **GIỮ CÓ CHỦ ĐÍCH** (Aroma giao Claude quyết): theme navy/teal/gold Bàn giao (12-bangiao.css ghi "per design rules") + dark+gold Đơn hàng Điều phối — cohesive; heading navy #0F2E45 (68 chỗ) giữ.

**B. PHÂN QUYỀN.** Thêm danh mục `PQ_GROUPS` (07-phanquyen.js) cho tính năng mới: `nhansu.giamsat`, `diem.xem`, `diem.quanly`, `lichca.hoatdong`; gán mã đúng cho `HUB_GROUPS` (bỏ mượn `nhansu.xem`); `PQ_DEFAULT` QLNS/QLBH cộng thêm. **Probe xác nhận cả 8 RPC nghi thiếu ĐỀU CÓ THẬT** (fn_nhom_luu, fn_list_nv_theo_chuc_danh, fn_save_quyen_ca_nhan, 4× fn_su_vu_co_dong_*, dh_fn_dieu_phoi — tài liệu cũ liệt kê thiếu). Enforcement: hub visibility đã cộng-thêm qua `_hubItemVisible`/`_quyenCauHinh`. **Backend action-RPC (fn_toggle_mien_diem, fn_duyet_canh_bao...) VẪN check ROLE ADMIN/QLNS** → non-QLNS có quyền vẫn bị backend chặn HÀNH ĐỘNG. Quyết định (Aroma OK): KHÔNG refactor loạt RPC (rủi ro bảo mật production); cần trao quyền quản lý → gán vai trò, hoặc yêu cầu cụ thể thì sửa từng RPC.

**C. ĐẤU NỐI UI-RPC.** 27 chỗ `throw new Error((data&&data.error)||error.message)` → `(error||{}).message` (hết crash TypeError che lỗi khi error=null). Biên bản bàn giao `_demSv` đếm nhầm sự vụ tạo-lỗi thành "mới" → thêm `svFail` + cảnh báo.

**D. RÀ LỖI CHỨC NĂNG (6 agent quét, Claude verify code thật):**
- **BÀN GIAO:** `bgSwitchSub('today')` subtab không tồn tại → **trang trắng sau MỖI lần gửi biên bản** (đổi `'timeline'`); màn "Xác nhận trước khi gửi" phân loại sai mã (`'D'/'K'/'KC'` thay vì thực tế `'BT'/'KO'/'VD'`) → "Bình thường"/"Không có" **luôn = 0** (sửa mã + nhãn "Đạt"→"Bình thường"); guard `window._bgSubmitting` chống gửi biên bản đúp.
- **SỰ VỤ:** rò rỉ timer countdown → thêm `bgqlStopSvTimer`/`bgSuVuStopTimer` ở `goToPage` + `bgqlSwitchSub`; **9 handler guard `window._svActing`** chống double-click (bgqlTiepNhan/BatDau/HoanTat/Huy, bgSuVuXacNhanXong/Dong/CoDongXong, svcdNhanViec/Xong); biên ngày 7d/30d → mốc đầu-ngày; số lượng hàng clamp ≥0; ô từ>đến custom hoán đổi; đồng hồ QL đồng bộ NV.
- **ĐIỂM:** `diemHubMien` chỉ vẽ hộp chi tiết, thẻ điểm đứng im sau xóa điểm trừ → thêm cập nhật `tk` + `_diemHubPaint()`; nút ✕ thiếu khi lọc khu vực; `taiDiemPhongDo` null → "—" thay "10 Tuyệt vời".
- **CHẤM CÔNG (cốt lõi):** `_doSubmitFinal` thêm **guard re-entry** (chống double-submit khi dialog TC/GPS chưa khóa nút) + **re-check `_ccDataExpired`** — gốc: interval `_ccInvalidateStale` (1s) null-hóa `state.lat/lng` khi dialog "Bạn có phải Trưởng ca?" mở > giới hạn tươi (~60s) → bản ghi chấm công **lưu tọa độ NULL**, server không kiểm được vị trí; `ngayCham` UTC→VN local.
- **LỊCH CA:** `moLichCa` Chủ Nhật mở tuần kế (trước đây CN mở tuần đã kết thúc → mọi ngày bị khóa, NV bí); `applyMultiDays` báo trung thực (cảnh báo "còn N ngày ở tuần khác" thay vì âm thầm bỏ).
- **ĐƠN NGHỈ:** modal bổ sung ca reset CH đã chọn (hết gửi nhầm CH lần mở trước); dashboard adapter đổi tên field (`canhBaoMoi`→`canhBao`, `topKV`→`theoKhuVuc`, `topCH`→`theoCuaHang`, `duLieuNgay`→`trend7`) → danh sách cảnh báo + biểu đồ hiện đúng (trước luôn rỗng).
- **GIỜ CÔNG:** `adm2RevertCanhBao` + `adm2TuChoiCanhBao` gọi `_rebuildCong` (trước không → giờ công tính sẵn giữ số sai khi đổi trạng thái CB).

### NOTED — CHƯA SỬA (phiên sau làm, verify kỹ từng cái — Claude cố ý không sửa vì cần quyết định/rủi ro)
- **Chấm công #5:** `idemKey` (02-system:2018) sinh mới mỗi lần bấm; sau khi `_ccChamThatBai` (3 retry rớt) user bấm lại → key mới → nếu server ĐÃ ghi (response rớt) thì tạo **bản ghi thứ 2**. Fix: lưu idemKey vào state, reuse khi retry, clear khi SUCCESS + khi đổi loại/CH. RỦI RO: clear sai → chặn nhầm chấm lại hợp lệ.
- **Giờ công #1:** giải trình NHIỀU cảnh báo (nhánh CÓ sửa CH/ca) chỉ ghi cho 1 CB (`_gtCbId`), biến `cbIdsStr` truyền vào nhưng **không dùng** → CB thứ 2 treo "chờ duyệt". (02-system ~2294/2332/3748)
- **Giờ công #3:** ~16 chỗ `new Date().toISOString().substring(0,10)` lấy "hôm nay" theo **UTC** → sai ngày **00:00–07:00 sáng VN**. Có helper `_ymd(new Date())` (02-system:4036, local) để thay. Chỗ đáng sửa: 02-nhansu:1149-1150 (taiLichSuDuyet ẩn CB sáng nay), 02-system:4382/4403/4432 (`p_ngay` duyệt sai), :2222 (taiLichSu chấm công). CẦN trace từng phép so sánh (vế kia có thể cũng UTC) → rủi ro tạo lệch mới.
- **Giờ công #7:** từ chối cảnh báo xong `nsData[nvIdx].xacNhan` không cập nhật (02-system:4346-4350 chỉ set trong nhánh 'Duyệt') → NV vẫn hiện "cần duyệt". Cần biết giá trị `xacNhan` đúng cho từ-chối.
- **Giờ công #2:** thẻ/lọc "AUTO" (02-nhansu:606/612/619) — `all` đã filter bỏ `AUTO_CHUYEN_TC` TRƯỚC khi `_ccIsAuto` chạy → nhánh `AUTO_CHUYEN_TC` trong `_ccIsAuto` chết (có thể chủ đích v17.66).
- **Đơn nghỉ #7:** `duyetDoiLichById` (03-donnghi ~1064, `.update lich_ca`) không guard trạng thái → duyệt đè đơn đã hủy/2 QLNS. Fix: `.eq('trang_thai', <pending>)` hoặc guard theo-ID.
- **Đơn nghỉ #8:** `duyetTatCa` (03-donnghi:1464) lấy toàn bộ `_ycData.donNghi` không lọc trạng thái → có thể duyệt lại đơn đã xử lý (tùy RPC null trả gì). Cần biết field trạng thái của item.
- **Duyệt double-click:** `duyetDonNghiById`/`duyetDoiLichById`/`duyetTatCa` chưa guard (riêng `duyetCB` ĐÃ disable nút). Fix: khóa **theo-ID** (Set in-flight), KHÔNG global (chặn nhầm duyệt đơn khác).
- **KPI dashboard #5:** `khongHoatDong = tongNV − chấmcông − đơnnghỉ` có thể trừ đúp (NV vừa chấm vừa nghỉ). Cần biết server đếm thế nào.
- **Thấp:** state global rò rỉ khi đổi tài khoản không reload (bg*Cache, `_bscChList`, DOM sale-target); nhận diện Đội SALE theo tên (ILIKE/startsWith) dễ trượt; `state.lat/lng` gửi RPC dạng string.
- **CHƯA RÀ module:** bán hàng (js/admin/01-banhang 148KB), đơn hàng (js/donhang/*), mẫu nón (04-muanon, pages/05-muanon), face-recognition.

### VIỆC AROMA CẦN LÀM
1. Merge `fix-test` → `main` (đã test OK) → GitHub Pages deploy.
2. Muốn làm tiếp NOTED: phiên sau đọc mục này; nếu Claude làm việc trên máy khác thì clone lại repo, tạo/checkout `fix-test`, làm tiếp.

### 15 commit fix-test (mới→cũ)
`8fc8cac` áp-nhiều-ngày báo trung thực · `0f8124b` giờ công rebuild khi từ chối/đặt lại · `66b0068` lỗi module lõi (chấm công/lịch ca/đơn nghỉ) · `5982c8b` double-click sự vụ · `2207872` lỗi bàn giao/sự vụ/điểm · `ada947b` lỗi nhẹ (biên ngày/số lượng/đồng hồ) · `14e9838` bổ sung phân quyền tính năng mới · `924e028` đấu nối UI-RPC · `f06562d` overlay nền ngà ấm + font · `c2c53ab` đồng bộ kích thước header · `4973e60` dọn tên purple→teal · `95aa34d` bump v17.68 · `2a34528` banner + emoji/badge · `1d9b11f` chuẩn hóa ô search · `fc920f6` bỏ tím/indigo.

**Bản version: v17.68.**

---

## ⏩ NỐI TIẾP (v17.68 → v17.85 · 10-11/07/2026) — ĐÃ DEPLOY PRODUCTION

> **Khác mọi phiên trước: v17.68 ĐÃ merge `fix-test`→`main` + push → GitHub Pages LIVE.** Từ đó mọi việc đều deploy thẳng lên production, `main` == `fix-test` (fast-forward, luôn đồng bộ). **Bản đang chạy: v17.85.**

### LUẬT MỚI (Aroma chốt phiên này — GHI ĐÈ luật cũ)
- **Mức tự chủ:** việc RÕ RÀNG (sửa nhỏ, thẩm mỹ, lỗi xác định) → **làm thẳng + deploy luôn**, không hỏi tới lui. Chỉ dừng hỏi khi: đa tầng/rủi ro cao (đụng DB nhiều bản ghi, luồng lõi, phân quyền), yêu cầu mơ hồ, hoặc cần quyết định nghiệp vụ.
- **Deploy = BẮT BUỘC bump version +0.01** (vd v17.84→v17.85) để Aroma nhìn version là biết có bản mới. Đủ 5 chỗ + SQL `app_settings`.
- **Merge main:** Aroma pre-authorize, NHƯNG auto-classifier của harness vẫn chặn mỗi phiên → khi bị chặn, xin Aroma 1 câu *"cho đụng main"* rồi làm tiếp.
- **SQL:** vẫn KHÔNG tự chạy DDL/DML (repo chỉ có anon key `sb_publishable_...` ở js/core/01-config.js:9) → viết SQL, Aroma chạy tay. **Supabase SQL Editor chạy cả script trong 1 TRANSACTION** → lỗi 1 lệnh là **rollback hết** (kể cả CREATE TABLE trước đó) → phải gửi lại nguyên khối đã sửa.

### ĐÃ LÀM (v17.69 → v17.85)

**1. Camera / nhận diện khuôn mặt (v17.69, 78, 80, 84, 85) — nhiều đợt, GỐC THẬT tìm ra ở v17.84**
- v17.69: thêm pill "Quét khuôn mặt" cạnh "Lấy vị trí" (min-width 112px cho cân).
- Fix trước đó (v17.68): mở **camera TRƯỚC** rồi tải model (hết cảm giác treo lần đầu) + timeout 22s + preconnect jsdelivr + fix 2 nút "Thử lại" gọi hàm không tồn tại (`nsFaceEnroll`/`nsFaceVerify`) + `_faceStopStreams()` chống rò camera.
- v17.78: nhịp quét 160→**110ms** + `nsFacePreload()` (nạp model nền 2.5s sau login cho NV bật face → mở camera là quét ngay).
- v17.80: **vladmandic 1.7.15** thống nhất script+model, **inputSize 320→224**, `faceLandmark68Net`→**`faceLandmark68TinyNet`** + `.withFaceLandmarks(true)`. ĐỔI pipeline → **BẮT BUỘC reset enroll** (`DELETE FROM nv_face_embedding` — 1632 vector/544 NV).
- **v17.84 — GỐC THẬT của "zoom ra vào / nhảy camera":** `_openCam` xin `width/height ideal:720` → **iOS Safari RAMP res** (thấp→cao lúc mở) + **TỤT res khi CPU tải** (đang nhận diện) → `object-fit:cover` khung tròn **re-crop mỗi lần đổi res** → zoom/nhảy. **FIX: xin NATIVE `640x480` cố định** (iOS giao ngay, không ramp/tụt), **BỎ `aspectRatio:1`** (ép vuông làm iOS xử lý số thêm).
- v17.85: **BỎ hẳn `applyConstraints` sau khi mở** — gọi giữa stream làm camera cấu hình lại → giật (nguồn "thỉnh thoảng bị"); và `focusMode:'continuous'` lỡ thêm ở v17.84 chính là chế độ tự-lấy-nét = "thở". Chỉ dựa vào 640x480 cố định.
- **KẾT LUẬN QUAN TRỌNG:** zoom **CHỈ là preview** — `object-fit:cover` đổi cách CẮT để hiện trong vòng tròn, KHÔNG đổi pixel gốc. Hàm chụp + nhận diện đều chạy trên **nguyên khung video** → **ảnh chấm công + nhận diện + bản ghi VẪN ĐÚNG**. Không phải lỗi hệ thống/dữ liệu.
- CSS `11-face.css` đã soi sạch: không animation/transform nào trên video (chỉ `scale(-1,1)` lật gương). Ring/pulse chạy trên phần tử khác.
- **Nước cờ tiếp nếu còn zoom:** hạ **480×360**, hoặc chuyển ảnh vào ca sang **chụp native** (mất quét tự động).

**2. Fix bền lỗi phân quyền admin 1670 (Trần Thị Thu Hương) — backend only**
- GỐC (probe xác nhận): guard `_check_role_admin_qlns` chỉ nhận `trang_thai='ACTIVE'` — quá cứng. 1670 có `role=ADMIN` nhưng `trang_thai='ĐANG LÀM VIỆC'` (4 tài khoản quan_ly bị vậy) → bị chặn. **TÁI PHÁT vì `fn_sync_quan_ly_batch` ghi `trang_thai = excluded`** = đúng chữ Google Sheet → fix data 1 lần bị sync ghi đè lại.
- ĐÃ FIX: guard đổi `trang_thai='ACTIVE'` → `coalesce(trang_thai,'') <> 'INACTIVE'` (cả 2 SELECT quan_ly+nhan_vien) — chỉ chặn INACTIVE, khớp luật login, sync-proof, 1 hàm fix cả hệ. + `UPDATE quan_ly SET trang_thai='ACTIVE' WHERE trang_thai='ĐANG LÀM VIỆC'` + chèn vào sync `IF upper(v_trang_thai)='ĐANG LÀM VIỆC' THEN v_trang_thai:='ACTIVE'`.

**3. Đơn hàng online — hồi sinh thanh toán (v17.70)**
- Aroma tưởng "mất phần thanh toán" — code còn nguyên, bị **3 bug + 1 dây đứt**: (a) `dh_fn_check_tt_sepay` chỉ có chữ ký `(p_ma,...)` nhưng màn chờ gọi `{p_sdt}` → lỗi âm thầm mỗi 4s; (b) check `data === true` trong khi hàm trả **object** giao dịch → không bao giờ khớp; (c) **`dhShowSepayWait` KHÔNG nơi nào gọi** (đứt khỏi luồng tạo đơn — đây là "mất"); (d) STK test hardcode lệch app_settings.
- ĐÃ FIX: p_ma + neo nội dung CK theo **MÃ ĐƠN** + `if(data)` + tiền vào gọi `dh_fn_danh_dau_tt` + nối lại màn chờ + getter `dhAccVietQR()/dhAccSepay()` đọc app_settings (key MỚI `donhang.sepay_ngan_hang/sepay_so_tk/sepay_ten_tk`, có ô ở tab Cài đặt).
- **Hạ tầng DB ĐÃ CÓ SẴN:** `dh_giao_dich_tt` (sổ cái webhook), `dh_thanh_toan` (phiếu thu, `sandbox=true` hardcode), `dh_van_chuyen` (chờ Ahamove), `dh_fn_xac_nhan_tt` 2 overload (1-arg tay + 4-arg webhook).
- **TỒN:** `p_is_demo:true` hardcode (01-dieuphoi:258) + `sandbox=true` — cần quyết khi go-live; matching `abs(so_tien-p_so_tien)<1000` + LIKE hơi lỏng; Ahamove chờ key + 3 quyết định kinh doanh. Kiến trúc 3 tầng: https://claude.ai/code/artifact/b91b7f4d-4e1d-4669-9d55-01f0d6ba4d91

**4. Điểm hệ thống (v17.71) + máy dò v8**
- Nút **"Lịch sử điểm trừ"** (hình đồng hồ) mỗi account trong hub → modal gom **12 tháng** (Promise.all `fn_diem_chi_tiet` từng tháng).
- Công cụ **"Xóa hàng loạt"** chỉ NS00490: filter tháng+CH+khu vực+loại lỗi+ngày → **Xem trước** (dry-run) → nhập **"dãy số bí mật"** (mật khẩu NS00490, verify bằng crypt) → RPC `fn_diem_mien_hang_loat`. Xóa = ghi `diem_mien` (khôi phục được, có audit) vì điểm là số **dẫn xuất**, không xóa cứng được.
- **Máy dò v8 — "1 điểm / 1 hạng mục / 1 ngày"** (Aroma chốt): v7 có thể trừ 2+ điểm cùng (NV,loại,ngày). v8: source_key đổi `ma_nv#loai#ngay` + `DISTINCT ON (ma_nv, loai, ngay)`. Kèm migrate `diem_mien.source_key` sang format mới (giữ miễn cũ).
- **Xác nhận:** bổ sung ca ĐÃ tính đúng tháng (source_key dùng `gio_cong_ngay_ch.ngay` = ngày làm việc thật). Bàn giao: chỉ cần **1 biên bản/CH/ngày** là **mọi TC** thoát trừ — logic v7 đã đúng.

**5. Bỏ cap giới hạn (v17.72, 73)**
- **GỐC:** PostgREST tự cap **1000 dòng** với hàm `RETURNS TABLE` (độc lập `p_limit`). Fix = đổi sang **`RETURNS jsonb`** + `jsonb_agg`.
- Đã đổi: `fn_su_vu_list` (verify ra 1261 ✓), `fn_ban_giao_timeline_ql`, `fn_bg_tien_chi_list`. `fn_get_thong_bao` (overload jsonb) bỏ `LIMIT 100`→1M. Frontend `p_limit` 100k→**1M** (9 chỗ).
- **KHÔNG động** `fn_diem_su_kien_thang` (backend-only, đổi type = break máy dò). Skip `fn_ban_giao_list` (không frontend gọi), `fn_thong_ke_lich_ca_nv` (max ~540).
- **Ảnh:** biên bản 6→**50**, mục tài sản 4→**20**, mẫu nón 20→**200**. **Số ảnh biên bản + ảnh mỗi mục VD phải CHẴN** (in 2 mặt) — cảnh báo realtime + chặn khi gửi (v17.74).

**6. Chuyển đổi mã CTV→NV (`fn_chuyen_doi_ma_nv` v2)**
- v1 chỉ update **14 bảng**, SÓT ~11 bảng + 4 cột đặc biệt. v2 = **27 UPDATE**: 21 bảng có `ma_nv` + `ban_giao` (3 cột: `last_edit_by_ma_nv`, `nguoi_ban_giao_ma_nv`, `nguoi_nhan_ma_nv`) + `ai_report.nguoi_tao_ma`.
- **`diem_mien` ĐẶC BIỆT:** phải đổi CẢ `source_key` = `ma_moi#loai#ngay` (khớp máy dò v8), không thì NV bị **trừ điểm lại**.
- Case CTV0163 → NS01676 (Aroma xác nhận cùng người); NS00451/NS01531 chỉ trùng tên.

**7. Sự vụ đóng không được — intermittent (v17.75)**
- **GỐC (workflow đa-agent, 5 hướng phản bác đều thất bại):** `bgSuVuDong` là handler **DUY NHẤT trong 9 handler sự vụ thiếu `finally { window._svActing = false }`**. Cờ **global** kẹt `true` sau lần đóng đầu → mọi lần sau `if(_svActing)return` **nuốt im lặng ngay sau prompt OK**. Intermittent vì reload/banner reset cờ. Giờ **9 set-true / 9 finally-reset** cân bằng.
- **CÒN TỒN (pass 2 xác nhận, chờ Aroma quyết):** `laNhanSuCHNay` ([06-bangiao.js:1249](js/pages/06-bangiao.js:1249), thêm ở v16.89) hiện nút Đóng cho **NV thường trực ca**, nhưng `bgSuVuDong` gửi `p_ma_nv=SESSION.ma` (mã cá nhân) — gate `fn_su_vu_dong` chỉ nhận **BQL hoặc `p_ma_nv=su_vu.ma_ch`** → **NV cá nhân LUÔN bị từ chối** (có cảnh báo, không im lặng). Đây là lý do "**một số** nhân viên đóng không được". 2 hướng: (A) gỡ `laNhanSuCHNay` khỏi ĐK hiện nút (khớp thiết kế v16.74, frontend-only); (B) nới gate RPC cho NV trực đúng CH.

**8. Biên bản bàn giao "báo thành công nhưng mất" (v17.77) — forensic**
- 3 CH báo mất biên bản 10/7. **Forensic DB xác nhận: KHÔNG mất.** Chỉ **1 mồ côi** CH01028 09/7 (1 ảnh lẻ = 1 lần gửi rớt thật).
- **GỐC: bug ngày UTC** — `bgSubmit:696` `new Date().toISOString().slice(0,10)` → up **trước 07:00 sáng VN** bị dán **lùi 1 ngày**. VD CH05006 gửi 10/7 lúc **06:54** → `ngay_ban_giao=09/7` → tìm 10/7 không thấy dù row còn nguyên. Toàn lịch sử **9 biên bản** bị lệch (đều gửi 00:13-06:54).
- ĐÃ FIX: ngày **LOCAL VN** + **kiểm `banGiaoId`** (RPC trả null không kèm error → app báo "✓" + reset form → MẤT THẬT; giờ throw giữ dữ liệu) + `bgTimelineCache=null` sau gửi.
- **CỨU DATA:** `UPDATE ban_giao SET ngay_ban_giao=(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date WHERE (created_at AT VN)::date = ngay_ban_giao + 1` (9 dòng; ảnh không ảnh hưởng vì link theo URL; không có unique (ma_ch,ngày)). **LỢI ÍCH KÉP:** gỡ luôn điểm trừ oan THIEU_BANGIAO (máy dò khớp `ngay_ban_giao` với `cham_cong.ngay`=VN).
- **FORENSIC KEY (dùng lại được):** ảnh up **TRƯỚC** RPC (697-706, lỗi=throw) → thấy "✓" = ảnh CHẮC CHẮN đã lên storage, path dùng **cùng biến `ngay`** → **folder ảnh CÓ mà KHÔNG có row khớp = mất thật; row ở ngày khác = ẩn (cứu được)**.

**9. CTV ⇄ NV đổi vị trí → buộc đăng nhập lại (v17.79)**
- `_kiemTraDoiViTri()` (02-system.js) gọi lúc khởi động (delay 1.5s), so `SESSION.vaiTro` với role DB qua RPC `fn_vai_tro_hien_tai(p_ma)`. **CHỈ kick đúng cặp NV↔CTV** (conservative — không đụng QL/CUA_HANG, tránh kick oan). Lỗi/không rõ → KHÔNG kick.

**10. Mục kiểm tra bàn giao — admin tự thêm/xóa (v17.81, 82, 83)**
- Aroma cần thêm nội dung check (vd **dột nước mùa mưa**), admin chủ động thêm/xóa trên app.
- **Cấu trúc BÀN GIAO giờ ĐỘNG:** nhóm tài sản đọc từ bảng MỚI `bg_nhom_taisan` (3 nhóm gốc seed khu_vuc 1/2/4 + nhóm admin tạo). `bgBuildGroups` có **fallback 3 nhóm gốc hardcode** nếu RPC lỗi → bàn giao không bao giờ vỡ. Nhóm rỗng không hiện cho cửa hàng.
- Mục lưu ở `danh_muc_tai_san_chuan` + cột MỚI **`la_tuy_chinh`** (tách 45 mục lõi — admin chỉ xóa được mục mình thêm). Mục tự hiện trong biên bản **như mục tài sản** (Đạt/Có vấn đề + ảnh → tạo sự vụ) — **store-side KHÔNG đổi code**.
- **Editor trực quan** `js/admin/10-mucbangiao.js` (`mucBGOpen`): overlay full màn, render nhóm+mục **giống biên bản thật**, thêm mục inline mỗi nhóm, tạo/xóa nhóm, mục/nhóm gốc gắn nhãn "gốc/NHÓM GỐC" + khóa. Nút ở hub **"Bàn giao hệ thống"** (roles QLNS; ban đầu để nhầm nhóm "Chấm công & Nhân sự" → đã chuyển ở v17.82).
- `danh_muc_tai_san_chuan` cols: `stt`(int PK), `khu_vuc`(int), `ten`, `don_vi`, `hien_thi`(bool), `thu_tu_hien_thi`(int), `la_tuy_chinh`(bool MỚI).

### ⚠️ SQL AROMA CẦN XÁC NHẬN ĐÃ CHẠY (nếu chưa → tính năng chưa hoạt động)
1. `fn_vai_tro_hien_tai(p_ma)` — cho v17.79 (CTV↔NV logout).
2. `DELETE FROM public.nv_face_embedding;` — reset đăng ký khuôn mặt (pipeline đổi ở v17.80; **1632 vector / 544 NV** phải quét lại). Chưa chạy → người cũ quét trượt → rơi về ảnh tay.
3. Việc 3: bảng `bg_nhom_taisan` (+seed 3 nhóm) + cột `la_tuy_chinh` + RPC `fn_bg_nhom_list` / `fn_bg_cauhinh` / `fn_bg_nhom_them` / `fn_bg_nhom_xoa` / `fn_bg_muc_them` / `fn_bg_muc_xoa` + `ENABLE ROW LEVEL SECURITY` trên bảng mới.
4. `UPDATE ban_giao ... ngay_ban_giao` (9 dòng lệch UTC) — cứu 3 biên bản 10/7 + gỡ điểm trừ oan.
5. Máy dò điểm **v8** (nếu chưa) + migrate `diem_mien.source_key`.
6. `app_settings` `sys.cache_version` = **"v17.85"**.

### VIỆC TIẾP THEO
1. **Test camera v17.85** trên iPhone — còn zoom "thỉnh thoảng" không. Còn nhiều → hạ 480×360 hoặc chuyển chụp native.
2. **Quyết `laNhanSuCHNay`** (mục 7): NV trực ca có được đóng sự vụ không → gỡ nút (A) hay nới gate RPC (B).
3. NOTED chưa sửa (mục v17.68): Chấm công #5 idemKey trùng; Giờ công #1/#3/#7; Đơn nghỉ #7/#8 + double-click guard; KPI trừ đúp.
4. Chưa rà module: bán hàng (01-banhang 148KB), mẫu nón, đơn hàng (vừa fix thanh toán v17.70).

**Bản version: v17.85** · `main` == `fix-test` == `53912a6`.

---

## ⏩ NỐI TIẾP (v17.86 · 17/07/2026 — camera iOS: khóa exact + preview CANVAS + dòng debug)

**Bối cảnh:** sau v17.84/85 Aroma + nhân viên VẪN bị zoom ra/vào lúc quét, kèm hình chụp khung tròn bị **vẽ hụt** (nửa khung lộ nền đen — đường cắt thẳng đứng/nằm ngang). Không phải mọi cửa hàng đều bị.

**CHẨN ĐOÁN LẠI — 2 phát hiện quan trọng:**
1. **Ghi chú v3-cam (v17.84) SAI về hình học:** với `object-fit:cover`, góc nhìn chỉ phụ thuộc **TỶ LỆ khung**, KHÔNG phụ thuộc độ phân giải → hạ 720p→VGA tự nó không thể chữa zoom. Vùng tối trong hình = nền `#050d0b` của `.ns-face-cam` lộ ra = thẻ `<video>` không phủ kín khung = **iOS Safari vẽ lại lớp video KHÔNG TRỌN khi kích thước video đổi giữa chừng** (`ideal` là ràng buộc MỀM, iOS được phép đổi res đang stream).
2. **Nghi vấn tầng 2 (chưa khẳng định — chờ số liệu):** iPhone 17 series có camera trước **Center Stage** — HỆ ĐIỀU HÀNH tự nhận diện mặt rồi tự zoom ra/vào để đóng khung (mất dấu mặt → zoom ra tìm). Khớp giả thuyết Aroma ("không nhìn ra mặt nên zoom") + khớp "không phải máy nào cũng bị" (máy Aroma 17 Pro Max có, iPhone đời cũ không). **Web KHÔNG tắt được bằng code** — chỉ tắt trên máy: đang quét → Control Center → ô Video Effects → tắt Center Stage.

**ĐÃ LÀM (release v17.86, 2 commit `8aa95af` + `8197b07`):**
1. **getUserMedia khóa `exact`** thay `ideal`: chuỗi thử `exact 640x480` → `exact 480x640` → lui về chuỗi cũ (`ideal`/`facingMode`/`video:true`) — không máy nào mất camera. Biến `_camMode` ghi mode trúng.
2. **Preview bằng CANVAS tự vẽ** (`_startPreview`, face-recognition.js): canvas 480×480 chốt cứng trong `.ns-face-cam`; mỗi khung center-crop VUÔNG + lật gương ngay trong `drawImage` (rAF ~30fps, guard `_nsRaf` chống 2 vòng khi Thử lại). `<video>` thu 2px + opacity 0 (KHÔNG display:none — iOS có thể ngừng decode), vẫn là nguồn cho face-api + `_captureFaceFrame`. **Bỏ hết transform CSS** trên video/khung. → dù iOS đổi res, hình học preview đứng yên tuyệt đối, không bao giờ lộ nền. Đã test giả lập (captureStream): hình học đúng, sống sót khi nguồn đổi 640×480→480×640, chiều lật gương đúng.
3. **Dòng số liệu debug** (`.ns-face-debug`, CHỈ NS00490 thấy): `xin <mode> · track WxH@fps · video WxH · ĐỔI n`. **Số ĐỔI là trọng tài:** ĐỔI>0 khi zoom = iOS vẫn đổi res (quay lại tầng 1); ĐỔI=0 mà vẫn zoom = tầng OS (Center Stage) → thử tắt qua Control Center để chốt. Gỡ dòng này khi xong.
- Bump v17.85→v17.86 đủ 5 chỗ. Desktop `_moCameraDialog` không đổi.

**Xác minh SQL tồn (probe anon key 17/07):** mục 1–5 của danh sách v17.85 ĐÃ chạy hết (fn_vai_tro_hien_tai OK; face reset xong — 461/468 NV active đã đăng ký lại, chỉ 3 người nghỉ còn sót vector; bg_nhom_taisan + RPC OK; 7856 biên bản 0 dòng lệch ngày; máy dò v8 source_key đúng format). Chỉ còn app_settings (v17.84 → cần v17.86). LƯU Ý: `_kiemTraVersion()` (02-system:247) đã DISABLED từ v12 — `sys.cache_version` trong app_settings KHÔNG ép reload gì, chỉ để tra cứu.

**SQL:** `INSERT INTO app_settings (key,value,updated_at) VALUES ('sys.cache_version','"v17.86"'::jsonb,now()) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now();`

**VIỆC TIẾP:** (1) Aroma quét trên 17 Pro Max, đọc số ĐỔI lúc zoom → phân xử tầng 1 vs tầng OS; nếu tầng OS: tắt Center Stage qua Control Center xác nhận, rồi chọn: hướng dẫn tắt cho máy bị / chụp native cho máy đó / chấp nhận (zoom chỉ preview, ảnh+nhận diện+bản ghi đúng — đã xác minh v17.85). (2) Các NOTED cũ giữ nguyên.

**Bản version: v17.86.**
