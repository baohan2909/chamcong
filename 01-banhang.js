/* ═══════════════════════════════════════════════════════════
   [v10.94] REDESIGN PHASE 1 — Trang Chấm công (REFINED)
   Fix sau test thực tế:
   - Header sticky opaque + compact 2 hàng (tên / ngày · clock live)
   - Bỏ "Chào X" — thay bằng tên NV
   - 4 action cards: SVG icon, gọn hơn, sel mềm
   - Bottom nav: active expand, inactive icon-only, sát đáy
   - Tất cả cards: bubble subtle + card-section có icon
   ═══════════════════════════════════════════════════════════ */

/* ─── Body background ─── */
body { background: linear-gradient(180deg, #FAFAF8 0%, #F4F3EF 100%); }

/* ═══ HEADER MODERN — STICKY OPAQUE ═══ */
.cc-header-modern {
  background: rgba(250,250,248,0.85) !important;
  -webkit-backdrop-filter: blur(20px) saturate(160%);
  backdrop-filter: blur(20px) saturate(160%);
  padding-top: env(safe-area-inset-top, 0px) !important;
  box-shadow: none !important;
  border-bottom: 1px solid rgba(0,0,0,0.05) !important;
  position: sticky !important;
  top: 0 !important;
  z-index: 50 !important;
}
.cc-header-modern .header-inner {
  max-width: 430px;
  margin: 0 auto;
  padding: 10px 16px 10px !important;
  position: relative;
  display: block !important;
}
.cc-header-modern .header-title,
.cc-header-modern .header-time,
.cc-header-modern .header-nv,
.cc-header-modern > .header-inner > .header-bell {
  display: none !important;
}
.cc-header-row {
  display: flex;
  align-items: center;
  gap: 11px;
}
.cc-header-avatar {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: linear-gradient(135deg, #1D9E75, #0F6E56);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 12px;
  box-shadow: 0 4px 12px rgba(15,110,86,0.28);
  flex-shrink: 0;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.cc-header-avatar:active { transform: scale(0.95); }
.cc-header-info {
  flex: 1;
  min-width: 0;
}
.cc-header-name {
  font-size: 14.5px;
  font-weight: 700;
  color: #1a1d18;
  letter-spacing: -0.3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.25;
}
.cc-header-meta {
  font-size: 11px;
  color: #6b7280;
  font-weight: 500;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}
.cc-header-meta .cc-clock-live {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: #0F6E56;
}
.cc-header-bell-btn {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid rgba(0,0,0,0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0,0,0,0.03);
  -webkit-tap-highlight-color: transparent;
  flex-shrink: 0;
}
.cc-header-bell-btn svg { width: 18px; height: 18px; color: #4b5563; }
.cc-header-bell-btn:active { transform: scale(0.95); }
.cc-header-bell-badge {
  position: absolute;
  top: -3px;
  right: -3px;
  min-width: 18px;
  height: 18px;
  background: #EF4444;
  color: #fff;
  border-radius: 9px;
  font-size: 9.5px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #FAFAF8;
  padding: 0 4px;
}
/* Ẩn cc-header-greet cũ (chứa "Chào X") */
.cc-header-greet, .cc-header-actions { display: none !important; }

/* ═══ HERO CARD — KHÔNG ĐỔI cấu trúc, chỉ giảm margin-top ═══ */
.cc-hero {
  background: var(--cc-hero-gradient);
  border-radius: 22px;
  margin: 10px 14px 14px;
  padding: 18px 20px;
  color: #fff;
  position: relative;
  overflow: hidden;
  box-shadow: var(--cc-hero-shadow);
}
.cc-hero-bubble-1 {
  position: absolute;
  right: -20px; top: -20px;
  width: 160px; height: 160px;
  border-radius: 50%;
  background: var(--cc-bubble-color);
  pointer-events: none;
}
.cc-hero-bubble-2 {
  position: absolute;
  right: 60px; top: 60px;
  width: 90px; height: 90px;
  border-radius: 50%;
  background: var(--cc-bubble-color-sm);
  pointer-events: none;
}
.cc-hero-body { position: relative; z-index: 1; }
.cc-hero-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}
.cc-hero-label {
  font-size: 10.5px;
  opacity: 0.85;
  letter-spacing: 1.2px;
  font-weight: 700;
}
.cc-hero-time {
  font-size: 26px;
  font-weight: 700;
  margin-top: 5px;
  letter-spacing: -0.6px;
  line-height: 1;
}
.cc-hero-time-sep {
  opacity: 0.5;
  margin: 0 6px;
  font-weight: 300;
}
.cc-hero-loc {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  font-size: 11.5px;
  opacity: 0.9;
}
.cc-hero-loc svg { width: 12px; height: 12px; flex-shrink: 0; }
.cc-hero-status {
  background: rgba(255,255,255,0.2);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  padding: 5px 10px;
  border-radius: 11px;
  display: flex;
  align-items: center;
  gap: 5px;
  border: 1px solid rgba(255,255,255,0.22);
  position: relative;
  z-index: 2;
  white-space: nowrap;
  flex-shrink: 0;
}
.cc-hero-status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #9FE1CB;
}
.cc-hero-status-txt {
  font-size: 10.5px;
  font-weight: 600;
}
.cc-hero-progress-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 14px;
  font-size: 11px;
  opacity: 0.92;
}
.cc-hero-progress-row b { font-weight: 700; }
.cc-hero-progress-hl { color: #9FE1CB; }
.cc-hero-progress-bar {
  height: 4px;
  background: rgba(0,0,0,0.2);
  border-radius: 2px;
  margin-top: 6px;
  overflow: hidden;
}
.cc-hero-progress-fill {
  height: 100%;
  background: #9FE1CB;
  border-radius: 2px;
  transition: width 0.6s ease;
}

/* ═══ CARDS CHUNG (Info NV, Cửa hàng, ...) — bubble subtle ═══ */
.cc-redesign-active #page-chamcong > .card {
  background: #fff !important;
  border: 1px solid rgba(0,0,0,0.05) !important;
  border-radius: 18px !important;
  box-shadow: 0 3px 12px rgba(0,0,0,0.03) !important;
  margin: 10px 14px 0 !important;
  padding: 14px 16px !important;
  position: relative;
  overflow: hidden;
}
/* Bubble subtle teal-lt ở góc trên-phải mỗi card */
.cc-redesign-active #page-chamcong > .card::before {
  content: '';
  position: absolute;
  right: -40px;
  top: -40px;
  width: 130px;
  height: 130px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(29,158,117,0.07) 0%, rgba(29,158,117,0.02) 50%, transparent 75%);
  pointer-events: none;
  z-index: 0;
}
.cc-redesign-active #page-chamcong > .card > * {
  position: relative;
  z-index: 1;
}
/* Card section header (label) — có vạch teal */
.cc-redesign-active #page-chamcong > .card .card-section {
  font-size: 10.5px !important;
  font-weight: 700 !important;
  color: #0F6E56 !important;
  letter-spacing: 0.8px !important;
  text-transform: uppercase !important;
  margin-bottom: 10px !important;
  padding: 0 0 0 10px !important;
  position: relative;
  border-left: 3px solid #1D9E75;
}

/* Field labels và values */
.cc-redesign-active #page-chamcong .field { padding: 6px 0 !important; }
.cc-redesign-active #page-chamcong .field label {
  font-size: 11px !important;
  color: #6b7280 !important;
  font-weight: 500 !important;
  margin-bottom: 3px !important;
}
.cc-redesign-active #page-chamcong .field-val-name,
.cc-redesign-active #page-chamcong .field-val-readonly {
  font-size: 15px !important;
  font-weight: 700 !important;
  color: #1a1d18 !important;
  background: transparent !important;
  padding: 0 !important;
  border: none !important;
}

/* Cửa hàng input */
.cc-redesign-active #page-chamcong .ch-field { padding: 0 !important; }
.cc-redesign-active #page-chamcong .ch-input {
  background: #F4F3EF !important;
  border: 1px solid rgba(0,0,0,0.04) !important;
  border-radius: 11px !important;
  padding: 11px 13px !important;
  font-size: 14px !important;
}
.cc-redesign-active #page-chamcong .ch-input:focus {
  background: #fff !important;
  border-color: #1D9E75 !important;
}

/* ═══ 4 ACTION CARDS ═══ */
.cc-redesign-active #page-chamcong .type-grid {
  display: grid !important;
  grid-template-columns: 1fr 1fr !important;
  gap: 10px !important;
  padding: 0 !important;
}

.cc-redesign-active .type-btn.tb-vao,
.cc-redesign-active .type-btn.tb-ra,
.cc-redesign-active .type-btn.tb-ra-g,
.cc-redesign-active .type-btn.tb-vao-g {
  background: #fff !important;
  border: 1px solid rgba(0,0,0,0.05) !important;
  border-radius: 18px !important;
  padding: 13px !important;
  position: relative;
  overflow: hidden;
  box-shadow: 0 3px 12px rgba(0,0,0,0.03) !important;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform .15s ease, background .2s ease, border-color .2s ease;
  display: flex !important;
  flex-direction: column;
  align-items: stretch !important;
  gap: 10px !important;
  text-align: left !important;
  min-height: auto !important;
  color: inherit !important;
}
.cc-redesign-active .type-btn:active { transform: scale(0.97); }

/* Pseudo glow — nhẹ hơn, không quá đậm */
.cc-redesign-active .type-btn.tb-vao::before,
.cc-redesign-active .type-btn.tb-ra::before,
.cc-redesign-active .type-btn.tb-ra-g::before,
.cc-redesign-active .type-btn.tb-vao-g::before {
  content: '';
  position: absolute;
  right: -25px; top: -25px;
  width: 90px; height: 90px;
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
}
.cc-redesign-active .type-btn.tb-vao::after,
.cc-redesign-active .type-btn.tb-ra::after,
.cc-redesign-active .type-btn.tb-ra-g::after,
.cc-redesign-active .type-btn.tb-vao-g::after {
  content: '';
  position: absolute;
  left: -10px; bottom: -20px;
  width: 60px; height: 60px;
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
}

.cc-redesign-active .type-btn.tb-vao::before { background: radial-gradient(circle, rgba(29,158,117,0.18) 0%, rgba(29,158,117,0.05) 45%, transparent 75%); }
.cc-redesign-active .type-btn.tb-vao::after  { background: radial-gradient(circle, rgba(29,158,117,0.10) 0%, transparent 65%); }
.cc-redesign-active .type-btn.tb-ra::before  { background: radial-gradient(circle, rgba(226,75,74,0.16) 0%, rgba(226,75,74,0.05) 45%, transparent 75%); }
.cc-redesign-active .type-btn.tb-ra::after   { background: radial-gradient(circle, rgba(226,75,74,0.09) 0%, transparent 65%); }
.cc-redesign-active .type-btn.tb-ra-g::before { background: radial-gradient(circle, rgba(55,138,221,0.18) 0%, rgba(55,138,221,0.05) 45%, transparent 75%); }
.cc-redesign-active .type-btn.tb-ra-g::after  { background: radial-gradient(circle, rgba(55,138,221,0.10) 0%, transparent 65%); }
.cc-redesign-active .type-btn.tb-vao-g::before { background: radial-gradient(circle, rgba(239,159,39,0.20) 0%, rgba(239,159,39,0.06) 45%, transparent 75%); }
.cc-redesign-active .type-btn.tb-vao-g::after  { background: radial-gradient(circle, rgba(239,159,39,0.11) 0%, transparent 65%); }

/* Icon bubble — gradient + chứa SVG (KHÔNG dùng emoji) */
.cc-redesign-active .type-btn .t-icon {
  width: 38px !important;
  height: 38px !important;
  border-radius: 11px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  position: relative;
  z-index: 1;
  margin: 0 !important;
  padding: 0 !important;
  line-height: 1 !important;
  font-size: 0 !important; /* ẩn emoji cũ */
  background-clip: padding-box;
}
/* SVG bên trong icon bubble (sẽ thêm vào HTML) */
.cc-redesign-active .type-btn .t-icon svg {
  width: 20px; height: 20px;
  color: #fff;
  stroke-width: 2.4;
}
.cc-redesign-active .type-btn.tb-vao .t-icon  { background: linear-gradient(135deg, #1D9E75, #0F6E56) !important; box-shadow: 0 6px 14px -3px rgba(29,158,117,0.42); }
.cc-redesign-active .type-btn.tb-ra .t-icon   { background: linear-gradient(135deg, #E24B4A, #A32D2D) !important; box-shadow: 0 6px 14px -3px rgba(226,75,74,0.42); }
.cc-redesign-active .type-btn.tb-ra-g .t-icon { background: linear-gradient(135deg, #378ADD, #185FA5) !important; box-shadow: 0 6px 14px -3px rgba(55,138,221,0.42); }
.cc-redesign-active .type-btn.tb-vao-g .t-icon { background: linear-gradient(135deg, #EF9F27, #BA7517) !important; box-shadow: 0 6px 14px -3px rgba(239,159,39,0.42); }

/* Text */
.cc-redesign-active .type-btn .t-name {
  font-size: 14px !important;
  font-weight: 700 !important;
  color: #1a1d18 !important;
  letter-spacing: -0.3px !important;
  margin: 0 !important;
  position: relative;
  z-index: 1;
  line-height: 1.2 !important;
}
.cc-redesign-active .type-btn .t-sub {
  font-size: 10.5px !important;
  color: #6b7280 !important;
  margin-top: 2px !important;
  font-weight: 500 !important;
  position: relative;
  z-index: 1;
  line-height: 1.3 !important;
}

/* Sel state — mềm hơn (background teal-lt + border subtle, KHÔNG outline cứng) */
.cc-redesign-active .type-btn.sel {
  background: linear-gradient(135deg, #E1F5EE 0%, #FAFAF8 100%) !important;
  border: 1.5px solid #5DCAA5 !important;
  box-shadow: 0 6px 20px -4px rgba(29,158,117,0.25) !important;
}
.cc-redesign-active .type-btn.tb-ra.sel    { border-color: #F09595 !important; box-shadow: 0 6px 20px -4px rgba(226,75,74,0.25) !important; background: linear-gradient(135deg, #FCEBEB 0%, #FAFAF8 100%) !important; }
.cc-redesign-active .type-btn.tb-ra-g.sel  { border-color: #85B7EB !important; box-shadow: 0 6px 20px -4px rgba(55,138,221,0.25) !important; background: linear-gradient(135deg, #E6F1FB 0%, #FAFAF8 100%) !important; }
.cc-redesign-active .type-btn.tb-vao-g.sel { border-color: #FAC775 !important; box-shadow: 0 6px 20px -4px rgba(239,159,39,0.25) !important; background: linear-gradient(135deg, #FAEEDA 0%, #FAFAF8 100%) !important; }

/* ═══ GPS CARD ═══ */
.cc-redesign-active #page-chamcong .card .gps-btn {
  background: transparent !important;
  border: none !important;
  padding: 0 !important;
  display: flex;
  align-items: center;
  gap: 11px;
  cursor: pointer;
}
.cc-redesign-active #page-chamcong .card .gps-left {
  display: flex;
  align-items: center;
  gap: 11px;
  flex: 1;
  min-width: 0;
}
.cc-redesign-active #page-chamcong .card .gps-icon {
  width: 36px !important;
  height: 36px !important;
  border-radius: 11px !important;
  background: linear-gradient(135deg, #1D9E75, #0F6E56) !important;
  color: #fff !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 18px !important;
  flex-shrink: 0 !important;
  box-shadow: 0 4px 10px -2px rgba(15,110,86,0.3);
}
.cc-redesign-active #page-chamcong .card .gps-label {
  font-size: 13px !important;
  font-weight: 600 !important;
  color: #1a1d18 !important;
}
.cc-redesign-active #page-chamcong .card .gps-sub {
  font-size: 11px !important;
  color: #6b7280 !important;
  margin-top: 1px !important;
}
.cc-redesign-active #page-chamcong .card .gps-badge {
  font-size: 10px !important;
  background: #E1F5EE !important;
  color: #0F6E56 !important;
  padding: 5px 11px !important;
  border-radius: 10px !important;
  font-weight: 700 !important;
  letter-spacing: 0.5px !important;
  flex-shrink: 0 !important;
}

/* Selfie button — đồng bộ style */
.cc-redesign-active #page-chamcong .selfie-btn {
  background: transparent !important;
  border: none !important;
  padding: 0 !important;
  display: flex;
  align-items: center;
  gap: 11px;
}
.cc-redesign-active #page-chamcong .selfie-icon {
  width: 36px !important;
  height: 36px !important;
  border-radius: 11px !important;
  background: linear-gradient(135deg, #EF9F27, #BA7517) !important;
  color: #fff !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 18px !important;
  flex-shrink: 0 !important;
  box-shadow: 0 4px 10px -2px rgba(186,117,23,0.3);
}
.cc-redesign-active #page-chamcong .selfie-text {
  font-size: 13px !important;
  font-weight: 600 !important;
  color: #1a1d18 !important;
}
.cc-redesign-active #page-chamcong .selfie-sub {
  font-size: 11px !important;
  color: #BA7517 !important;
  margin-top: 1px !important;
}

/* ═══ SUBMIT BUTTON — gradient + bubble ═══ */
.cc-redesign-active #page-chamcong .submit-btn {
  background: linear-gradient(135deg, #1D9E75 0%, #0F6E56 100%) !important;
  border: none !important;
  border-radius: 16px !important;
  padding: 14px 16px !important;
  font-size: 15px !important;
  font-weight: 700 !important;
  color: #fff !important;
  position: relative;
  overflow: hidden;
  box-shadow: 0 10px 24px -6px rgba(15,110,86,0.42) !important;
  letter-spacing: 0.2px;
}
.cc-redesign-active #page-chamcong .submit-btn.s-disabled {
  background: #D3D1C7 !important;
  color: #fff !important;
  box-shadow: none !important;
  opacity: 1 !important;
}
.cc-redesign-active #page-chamcong .submit-btn:not(.s-disabled)::before {
  content: '';
  position: absolute;
  right: -30px; top: -30px;
  width: 100px; height: 100px;
  border-radius: 50%;
  background: rgba(255,255,255,0.13);
  pointer-events: none;
}

/* ═══ BOTTOM NAV — iOS 18 GLASS — ACTIVE EXPAND, INACTIVE ICON ONLY ═══ */
.bottom-nav.cc-nav-modern {
  position: fixed !important;
  bottom: 0 !important;
  left: 50% !important;
  transform: translateX(-50%);
  width: 100% !important;
  max-width: 430px !important;
  z-index: 30 !important;
  padding: 0 12px env(safe-area-inset-bottom, 8px) !important;
  background: transparent !important;
  border-top: none !important;
  box-shadow: none !important;
  display: block !important;
  height: auto !important;
}
.cc-nav-inner {
  background: rgba(255,255,255,0.72);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  backdrop-filter: blur(28px) saturate(180%);
  border: 0.5px solid rgba(255,255,255,0.9);
  border-radius: 22px;
  padding: 5px;
  display: flex;
  gap: 2px;
  box-shadow:
    0 12px 32px -6px rgba(0,0,0,0.14),
    0 0 0 0.5px rgba(0,0,0,0.04),
    inset 0 1px 0 rgba(255,255,255,0.9);
  margin-bottom: 4px;
}
.cc-nav-modern .nav-item {
  flex: 0 0 auto !important;
  width: auto !important;
  height: auto !important;
  padding: 9px 10px !important;
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 6px !important;
  border-radius: 16px !important;
  background: transparent !important;
  border: none !important;
  cursor: pointer;
  position: relative;
  -webkit-tap-highlight-color: transparent;
  transition: background .2s ease, flex .25s ease;
  min-width: 0 !important;
  color: inherit !important;
}
.cc-nav-modern .nav-item .nav-svg {
  width: 19px !important;
  height: 19px !important;
  color: #9b9a96 !important;
  stroke-width: 2.2 !important;
  transition: color .2s ease;
  margin: 0 !important;
  flex-shrink: 0;
}
/* Label MẶC ĐỊNH ẨN */
.cc-nav-modern .nav-item .nav-label {
  display: none !important;
}
/* Active tab: EXPAND + show label + background teal-lt */
.cc-nav-modern .nav-item.active {
  flex: 1 1 auto !important;
  background: #E1F5EE !important;
  padding: 9px 12px !important;
}
.cc-nav-modern .nav-item.active .nav-svg { color: #0F6E56 !important; }
.cc-nav-modern .nav-item.active .nav-label {
  display: block !important;
  font-size: 11.5px !important;
  color: #0F6E56 !important;
  font-weight: 700 !important;
  letter-spacing: 0.1px;
  white-space: nowrap;
  margin: 0 !important;
  line-height: 1;
}
.cc-nav-modern .nav-item:active { transform: scale(0.94); }
.cc-nav-modern .nav-item .nav-badge {
  position: absolute !important;
  top: 2px !important;
  right: 4px !important;
  min-width: 16px !important;
  height: 16px !important;
  border-radius: 8px !important;
  background: #EF4444 !important;
  color: #fff !important;
  font-size: 9px !important;
  font-weight: 700 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 0 4px !important;
  border: 1.5px solid #fff !important;
}

/* Padding-bottom đủ chỗ nav */
body.cc-redesign-active .page { padding-bottom: 88px !important; }
body.cc-redesign-active #page-chamcong { padding-bottom: 88px !important; padding-top: 0 !important; }

/* Banner-pw — đồng bộ style */
body.cc-redesign-active #page-chamcong .banner-pw {
  margin: 10px 14px 0 !important;
  border-radius: 16px !important;
  border: 1px solid rgba(186,117,23,0.2) !important;
  background: linear-gradient(135deg, #FAEEDA 0%, #FFF7E6 100%) !important;
}
