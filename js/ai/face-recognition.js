/* ════════════════════════════════════════════════════════════════════════════
 *  Nón Sơn — Face Recognition Module v12.5 (Simple + Reliable)
 *
 *  Design: KHÔNG dùng yaw detection (yếu, không đáng tin)
 *  Approach: Tuần tự countdown 3-2-1, user quay đầu theo lệnh
 *
 *  Enrollment Flow:
 *   1. "Nhìn thẳng" → đợi face stable → countdown 3-2-1 → capture
 *   2. "Quay đầu sang TRÁI" → delay 2s cho user quay → stable → countdown → capture
 *   3. "Quay đầu sang PHẢI" → delay 2s → stable → countdown → capture
 *   Done. Simple. Reliable.
 *
 *  Verify Flow:
 *   - Mở camera → face stable → countdown 2-1 → capture & verify
 *  ──────────────────────────────────────────────────────────────────────── */

const NS_FACE = {
  FACEAPI_SCRIPT: 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js',
  MODELS_URL: 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model/',
  MIN_FACE_SIZE: 80,
  STABLE_FRAMES_NEEDED: 4,    // ~0.4s mặt ổn định
  STABLE_PX: 30
};

let _faceLoaded = false;
let _faceLoading = false;

// ─── Lazy load face-api.js ───────────────────────────────────────────────
async function nsFaceEnsureLoaded() {
  if (_faceLoaded) return true;
  if (_faceLoading) { while (_faceLoading) await new Promise(r => setTimeout(r, 100)); return _faceLoaded; }
  _faceLoading = true;
  try {
    if (typeof faceapi === 'undefined') {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = NS_FACE.FACEAPI_SCRIPT;
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(NS_FACE.MODELS_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(NS_FACE.MODELS_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(NS_FACE.MODELS_URL)
    ]);
    _faceLoaded = true;
    return true;
  } catch (e) {
    console.error('Face load fail:', e);
    return false;
  } finally {
    _faceLoading = false;
  }
}

async function _openCam(videoEl) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user' }, audio: false
  });
  videoEl.srcObject = stream;
  await new Promise(r => videoEl.onloadedmetadata = r);
  await videoEl.play();
  return stream;
}
function _stopCam(stream) { if (stream) stream.getTracks().forEach(t => t.stop()); }

async function _detectFace(videoEl) {
  if (!_faceLoaded) return null;
  const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.45 });
  const result = await faceapi.detectSingleFace(videoEl, opts).withFaceLandmarks().withFaceDescriptor();
  if (!result) return null;
  const box = result.detection.box;
  if (box.width < NS_FACE.MIN_FACE_SIZE) return { tooSmall: true };
  return {
    box: { cx: box.x + box.width / 2, cy: box.y + box.height / 2 },
    embedding: Array.from(result.descriptor)
  };
}

function _haptic(p) { try { if (navigator.vibrate) navigator.vibrate(p || 30); } catch (e) {} }

// ═════════════════════════════════════════════════════════════════════════
// SHARED MODAL BUILDER
// ═════════════════════════════════════════════════════════════════════════
function _buildModal(modalId, title, onClose) {
  const old = document.getElementById(modalId);
  if (old) old.remove();
  const m = document.createElement('div');
  m.id = modalId;
  m.className = 'ns-face-modal';
  m.innerHTML = `
    <div class="ns-face-header">
      <button class="ns-face-close" data-close>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <div class="ns-face-title">${title}</div>
    </div>
    <div class="ns-face-body" id="${modalId}-body"></div>
  `;
  m.querySelector('[data-close]').onclick = onClose;
  document.body.appendChild(m);
  requestAnimationFrame(() => m.classList.add('open'));
  return m;
}

function _buildScanScene(bodyEl, prefix) {
  bodyEl.innerHTML = `
    <div class="ns-face-scan-wrap" id="${prefix}-wrap">
      <div class="ns-face-scan-video">
        <video id="${prefix}-video" autoplay muted playsinline></video>
        <div class="ns-face-countdown" id="${prefix}-countdown"></div>
        <div class="ns-face-check-overlay" id="${prefix}-check">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#2BC084" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
      </div>
      <svg class="ns-face-scan-ring" viewBox="0 0 200 200">
        <defs>
          <linearGradient id="${prefix}Grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#2BC084"/>
            <stop offset="100%" stop-color="#0F6E56"/>
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r="92" fill="none" stroke="rgba(43,192,132,.13)" stroke-width="4"/>
        <circle id="${prefix}-progress" cx="100" cy="100" r="92" fill="none"
                stroke="url(#${prefix}Grad)" stroke-width="5" stroke-linecap="round"
                stroke-dasharray="578" stroke-dashoffset="578"
                transform="rotate(-90 100 100)"
                style="transition: stroke-dashoffset .5s cubic-bezier(.2,.7,.3,1)"/>
      </svg>
    </div>
    <div class="ns-face-big-instruction" id="${prefix}-instruction">Đang khởi động camera...</div>
    <div class="ns-face-scan-status" id="${prefix}-status"></div>
    <div class="ns-face-scan-progress" id="${prefix}-progress-text"></div>
  `;
}

function _setEl(id, txt) { const el = document.getElementById(id); if (el) el.textContent = txt; }
function _setArc(id, pct) {
  const arc = document.getElementById(id);
  if (arc) arc.setAttribute('stroke-dashoffset', 578 * (1 - pct / 100));
}
function _flashCheck(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1000);
}

// ═════════════════════════════════════════════════════════════════════════
// HELPER: Đợi mặt stable trong N frames
// ═════════════════════════════════════════════════════════════════════════
async function _waitForStableFace(video, statusElId, abortRef) {
  let prev = null, stableCount = 0;
  while (!abortRef.aborted) {
    const r = await _detectFace(video);
    if (!r) {
      _setEl(statusElId, 'Tìm khuôn mặt...');
      stableCount = 0; prev = null;
    } else if (r.tooSmall) {
      _setEl(statusElId, 'Đưa mặt gần hơn');
      stableCount = 0;
    } else {
      if (prev && Math.abs(prev.cx - r.box.cx) < NS_FACE.STABLE_PX
                && Math.abs(prev.cy - r.box.cy) < NS_FACE.STABLE_PX) {
        stableCount++;
      } else {
        stableCount = 0;
      }
      prev = r.box;
      if (stableCount >= NS_FACE.STABLE_FRAMES_NEEDED) {
        _setEl(statusElId, '✓ Sẵn sàng');
        return r.embedding;
      }
      _setEl(statusElId, 'Giữ yên...');
    }
    await new Promise(r => setTimeout(r, 100));
  }
  return null;
}

// ═════════════════════════════════════════════════════════════════════════
// HELPER: Countdown 3-2-1 visual
// ═════════════════════════════════════════════════════════════════════════
async function _runCountdown(countdownElId, progressArcId, video, statusElId, abortRef) {
  const el = document.getElementById(countdownElId);
  for (let i = 3; i >= 1; i--) {
    if (abortRef.aborted) return null;
    if (el) {
      el.textContent = i;
      el.classList.remove('show');
      void el.offsetWidth;  // force reflow
      el.classList.add('show');
    }
    _setArc(progressArcId, ((4 - i) / 3) * 100);
    _haptic(20);
    await new Promise(r => setTimeout(r, 700));
  }
  if (el) el.classList.remove('show');
  // Capture final frame
  const r = await _detectFace(video);
  if (r && r.embedding) return r.embedding;
  return null;
}

// ═════════════════════════════════════════════════════════════════════════
// FLOW 1: ENROLLMENT — 3 góc tuần tự với countdown
// ═════════════════════════════════════════════════════════════════════════
let _enrollAbort = { aborted: false };
let _enrollStream = null;

async function nsFaceOpenEnrollment() {
  _enrollAbort = { aborted: false };
  const modal = _buildModal('ns-face-modal', 'Đăng ký khuôn mặt', nsFaceCloseEnrollment);

  document.getElementById('ns-face-modal-body').innerHTML = `
    <div class="ns-face-step active">
      <div class="ns-face-icon-big">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#2BC084" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
      </div>
      <h3>Quét khuôn mặt</h3>
      <p>3 góc: thẳng → trái → phải. Hệ thống tự quét khi mặt ổn định.</p>
      <div class="ns-face-privacy">
        <b>Bảo mật:</b> Chỉ lưu vector đặc trưng (128 số), không lưu ảnh gốc.
      </div>
      <button class="ns-face-btn-primary" id="ns-fe-start">Bắt đầu</button>
    </div>
  `;
  document.getElementById('ns-fe-start').onclick = _startEnrollmentFlow;
}

function nsFaceCloseEnrollment() {
  _enrollAbort.aborted = true;
  if (_enrollStream) { _stopCam(_enrollStream); _enrollStream = null; }
  const m = document.getElementById('ns-face-modal');
  if (m) { m.classList.remove('open'); setTimeout(() => m.remove(), 250); }
}

async function _startEnrollmentFlow() {
  const body = document.getElementById('ns-face-modal-body');
  _buildScanScene(body, 'fe');

  const ok = await nsFaceEnsureLoaded();
  if (!ok) { _setEl('fe-instruction', 'Lỗi tải module nhận diện'); return; }

  const video = document.getElementById('fe-video');
  try {
    _enrollStream = await _openCam(video);
  } catch (e) {
    _setEl('fe-instruction', 'Cần cấp quyền camera');
    return;
  }

  const steps = [
    { goc: 'thang', label: 'Nhìn thẳng vào camera', delay: 0 },
    { goc: 'trai',  label: 'Quay nhẹ về vai TRÁI của bạn', delay: 1500 },
    { goc: 'phai',  label: 'Quay nhẹ về vai PHẢI của bạn', delay: 1500 }
  ];
  const captured = { thang: 0, trai: 0, phai: 0 };

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (_enrollAbort.aborted) return;

    // Hiển thị instruction
    _setEl('fe-instruction', step.label);
    _setEl('fe-status', '');
    _setEl('fe-progress-text', i + ' / 3 góc');
    _setArc('fe-progress', (i / 3) * 100);

    // Delay cho user kịp quay đầu
    if (step.delay) await new Promise(r => setTimeout(r, step.delay));

    // Đợi face stable
    const embedding = await _waitForStableFace(video, 'fe-status', _enrollAbort);
    if (!embedding) return;  // aborted

    // Countdown 3-2-1
    _setEl('fe-status', '');
    const finalEmb = await _runCountdown('fe-countdown', 'fe-progress', video, 'fe-status', _enrollAbort);
    if (_enrollAbort.aborted) return;

    const embToSave = finalEmb || embedding;

    // Save tới DB
    _setEl('fe-status', 'Đang lưu...');
    const saved = await _saveEnroll(step.goc, embToSave);
    if (!saved) {
      // Cho user retry góc này
      _setEl('fe-instruction', 'Lưu thất bại, đang thử lại...');
      await new Promise(r => setTimeout(r, 1500));
      i--;  // retry same step
      continue;
    }

    captured[step.goc] = 1;
    _flashCheck('fe-check');
    _haptic([40, 60, 40]);
    _setEl('fe-status', '✓ Đã lưu');
    await new Promise(r => setTimeout(r, 600));
  }

  // Done
  _setArc('fe-progress', 100);
  _setEl('fe-progress-text', '3 / 3 góc');
  await new Promise(r => setTimeout(r, 400));

  if (_enrollStream) { _stopCam(_enrollStream); _enrollStream = null; }
  _showEnrollDone();
}

async function _saveEnroll(goc, embedding) {
  try {
    const { data, error } = await supa.rpc('fn_face_enroll', {
      p_ma_nv: SESSION.ma,
      p_embedding: embedding,
      p_goc: goc,
      p_chat_luong: 0.9,
      p_device: navigator.userAgent.substring(0, 100)
    });
    if (error) throw error;
    if (!data || !data.ok) {
      const msg = (data && data.message) || 'unknown';
      if (typeof showToast === 'function') showToast('Lỗi lưu ' + goc + ': ' + msg, 'err');
      return false;
    }
    return true;
  } catch (e) {
    if (typeof showToast === 'function') showToast('Lỗi: ' + (e.message || 'network'), 'err');
    return false;
  }
}

function _showEnrollDone() {
  const body = document.getElementById('ns-face-modal-body');
  if (!body) return;
  body.innerHTML = `
    <div class="ns-face-step active">
      <div class="ns-face-icon-big success">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <h3>Đăng ký thành công</h3>
      <p>Từ giờ bạn có thể chấm công bằng cách quét khuôn mặt.</p>
      <button class="ns-face-btn-primary" onclick="nsFaceCloseEnrollment()">Hoàn tất</button>
    </div>
  `;
  // Update badge in Tài khoản
  const lbl = document.getElementById('menu-face-status');
  if (lbl) { lbl.textContent = '✓ Đã đăng ký'; lbl.style.color = '#0F6E56'; }
}

// ═════════════════════════════════════════════════════════════════════════
// FLOW 2: VERIFY — countdown 2-1, không cần quay đầu
// ═════════════════════════════════════════════════════════════════════════
let _verifyAbort = { aborted: false };
let _verifyStream = null;
let _verifyCallback = { onSuccess: null, onFail: null };

async function nsFaceStartChamCong(onSuccess, onFail) {
  _verifyCallback = { onSuccess, onFail };

  // Check enrollment
  let enrolled = false;
  try {
    const { data } = await supa.rpc('fn_face_enroll_status', { p_ma_nv: SESSION.ma });
    enrolled = data && data.completed;
  } catch (e) {}

  if (!enrolled) {
    if (window.confirm('Bạn chưa đăng ký khuôn mặt.\n\nOK để đăng ký ngay, Hủy để chấm công bằng ảnh tay.')) {
      nsFaceOpenEnrollment();
    } else {
      if (onFail) onFail({ reason: 'no_enroll', fallback: true });
    }
    return;
  }

  _verifyAbort = { aborted: false };
  _buildModal('ns-face-verify-modal', 'Xác minh khuôn mặt', nsFaceCloseVerify);

  const body = document.getElementById('ns-face-verify-modal-body');
  _buildScanScene(body, 'fv');
  _setEl('fv-instruction', 'Đặt mặt vào vòng tròn');

  const ok = await nsFaceEnsureLoaded();
  if (!ok) { _setEl('fv-status', 'Lỗi tải module'); return; }

  const video = document.getElementById('fv-video');
  try {
    _verifyStream = await _openCam(video);
  } catch (e) {
    _setEl('fv-status', 'Cần cấp quyền camera');
    return;
  }

  _runVerifyAttempt(video, 0);
}

async function _runVerifyAttempt(video, attempt) {
  if (_verifyAbort.aborted) return;
  if (attempt >= 3) {
    _setEl('fv-instruction', 'Đã thử 3 lần');
    _setEl('fv-status', 'Bấm "Chấm công bằng ảnh tay" bên dưới');
    _addFallbackBtn();
    return;
  }

  // Đợi face stable
  _setEl('fv-status', '');
  const embedding = await _waitForStableFace(video, 'fv-status', _verifyAbort);
  if (!embedding) return;

  // Countdown 2-1 (nhanh hơn enroll)
  _setEl('fv-instruction', 'Giữ yên');
  for (let i = 2; i >= 1; i--) {
    if (_verifyAbort.aborted) return;
    const el = document.getElementById('fv-countdown');
    if (el) { el.textContent = i; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }
    _setArc('fv-progress', ((3 - i) / 2) * 100);
    _haptic(20);
    await new Promise(r => setTimeout(r, 700));
  }
  const cd = document.getElementById('fv-countdown');
  if (cd) cd.classList.remove('show');

  // Capture multi-frame
  const frames = [embedding];
  for (let i = 0; i < 2; i++) {
    const r = await _detectFace(video);
    if (r && r.embedding) frames.push(r.embedding);
    await new Promise(r => setTimeout(r, 80));
  }
  const avg = _avgEmbeddings(frames);

  _setEl('fv-status', 'Đang xác minh...');
  const result = await _submitVerify(avg);

  if (result && result.passed) {
    _flashCheck('fv-check');
    const matchPct = result.match_pct || Math.round((1 - (result.distance||0)) * 100);
    _setEl('fv-status', '✓ Xác minh đúng (' + matchPct + '%)');
    _setArc('fv-progress', 100);
    _haptic([30, 50, 30, 50, 60]);
    const cb = _verifyCallback.onSuccess;
    setTimeout(() => { nsFaceCloseVerify(); if (cb) cb({ match_pct: matchPct, distance: result.distance }); }, 700);
  } else {
    const dist = result && result.distance ? result.distance.toFixed(3) : '?';
    _setEl('fv-status', '✗ Không khớp (khoảng cách ' + dist + ') — Thử lại');
    _setArc('fv-progress', 0);
    _haptic([100, 50, 100]);
    await new Promise(r => setTimeout(r, 1200));
    _runVerifyAttempt(video, attempt + 1);
  }
}

function _avgEmbeddings(arr) {
  if (!arr.length) return null;
  const dim = arr[0].length;
  const out = new Array(dim).fill(0);
  arr.forEach(e => { for (let i = 0; i < dim; i++) out[i] += e[i]; });
  for (let i = 0; i < dim; i++) out[i] /= arr.length;
  return out;
}

async function _submitVerify(embedding) {
  try {
    const { data, error } = await supa.rpc('fn_face_verify', {
      p_ma_nv: SESSION.ma, p_embedding: embedding,
      p_device: navigator.userAgent.substring(0, 100)
    });
    if (error) throw error;
    return data;
  } catch (e) {
    return { ok: false, passed: false, error: e.message };
  }
}

function _addFallbackBtn() {
  const body = document.getElementById('ns-face-verify-modal-body');
  if (!body || body.querySelector('.ns-face-btn-secondary')) return;
  const btn = document.createElement('button');
  btn.className = 'ns-face-btn-secondary';
  btn.textContent = 'Chấm công bằng ảnh tay';
  btn.onclick = () => {
    const cb = _verifyCallback.onFail;
    nsFaceCloseVerify();
    if (cb) cb({ reason: 'low_sim', fallback: true });
  };
  body.appendChild(btn);
}

function nsFaceCloseVerify() {
  _verifyAbort.aborted = true;
  if (_verifyStream) { _stopCam(_verifyStream); _verifyStream = null; }
  const m = document.getElementById('ns-face-verify-modal');
  if (m) { m.classList.remove('open'); setTimeout(() => m.remove(), 250); }
}

// ═════════════════════════════════════════════════════════════════════════
// FLOW 3: ADMIN PANEL (giữ nguyên v12.1)
// ═════════════════════════════════════════════════════════════════════════
async function nsFaceOpenAdmin() {
  const old = document.getElementById('ns-face-admin-modal');
  if (old) old.remove();

  const [cfgRes, statsRes] = await Promise.all([
    supa.rpc('fn_face_get_config'),
    supa.rpc('fn_face_admin_stats', { p_ma_admin: SESSION.ma, p_days: 7 })
  ]);
  const cfg = cfgRes.data || { enabled: false, threshold: 0.50 };
  const stats = statsRes.data || {};

  const modal = document.createElement('div');
  modal.id = 'ns-face-admin-modal';
  modal.className = 'ns-face-admin-modal';
  modal.innerHTML = `
    <div class="ns-fa-overlay" onclick="nsFaceCloseAdmin()"></div>
    <div class="ns-fa-sheet">
      <div class="ns-fa-handle"></div>
      <div class="ns-fa-header">
        <div class="ns-fa-title">Chấm công bằng khuôn mặt</div>
        <button class="ns-fa-close" onclick="nsFaceCloseAdmin()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="ns-fa-card ns-fa-toggle-card">
        <div class="ns-fa-toggle-info">
          <div class="ns-fa-toggle-label">Bật chấm công bằng khuôn mặt</div>
          <div class="ns-fa-toggle-sub">${cfg.enabled
            ? 'Đang hoạt động — NV chấm công bằng quét mặt'
            : 'Đang tắt — NV vẫn chấm công bằng ảnh tay'}</div>
        </div>
        <button class="ns-fa-toggle ${cfg.enabled ? 'on' : ''}" onclick="nsFaceToggleChamcong(${!cfg.enabled})">
          <span class="ns-fa-toggle-dot"></span>
        </button>
      </div>

      <div class="ns-fa-card">
        <div class="ns-fa-section-label">Thống kê 7 ngày qua</div>
        <div class="ns-fa-stats-grid">
          <div class="ns-fa-stat">
            <div class="ns-fa-stat-val">${stats.enrolled_nv || 0}<span class="ns-fa-stat-of">/${stats.total_nv || 0}</span></div>
            <div class="ns-fa-stat-lbl">NV đăng ký</div>
            <div class="ns-fa-stat-pct">${stats.enroll_rate || 0}%</div>
          </div>
          <div class="ns-fa-stat">
            <div class="ns-fa-stat-val">${stats.total || 0}</div>
            <div class="ns-fa-stat-lbl">Lần xác minh</div>
            <div class="ns-fa-stat-pct ${stats.pass_rate >= 80 ? 'good' : (stats.pass_rate >= 60 ? 'mid' : 'low')}">${stats.pass_rate || 0}% pass</div>
          </div>
          <div class="ns-fa-stat">
            <div class="ns-fa-stat-val">${stats.avg_similarity ? Number(stats.avg_similarity).toFixed(3) : '—'}</div>
            <div class="ns-fa-stat-lbl">Similarity TB</div>
          </div>
        </div>
      </div>

      <div class="ns-fa-card">
        <div class="ns-fa-section-label">Ngưỡng nhận diện</div>
        <div class="ns-fa-threshold-row">
          <input type="range" min="30" max="95" step="5" value="${Math.round((cfg.threshold || 0.5) * 100)}"
            id="ns-fa-threshold-slider" oninput="nsFaceThresholdPreview(this.value)" class="ns-fa-slider"/>
          <div class="ns-fa-threshold-val">
            <span id="ns-fa-threshold-display">${Math.round((cfg.threshold || 0.5) * 100)}%</span>
            <span class="ns-fa-threshold-hint" id="ns-fa-threshold-hint">${_threshHint(cfg.threshold || 0.5)}</span>
          </div>
        </div>
        <button class="ns-fa-btn-save" onclick="nsFaceSaveThreshold()">Cập nhật ngưỡng</button>
      </div>

      <div class="ns-fa-footer">
        <button class="ns-fa-btn-done" onclick="nsFaceCloseAdmin()">Đóng</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('open'));
}

function nsFaceCloseAdmin() {
  const m = document.getElementById('ns-face-admin-modal');
  if (!m) return;
  m.classList.remove('open');
  setTimeout(() => m.remove(), 250);
}

function _threshHint(t) {
  if (t < 0.45) return 'Nới rộng';
  if (t < 0.55) return 'Dễ pass';
  if (t < 0.65) return 'Cân bằng';
  if (t < 0.80) return 'Chặt';
  return 'Rất chặt';
}

function nsFaceThresholdPreview(val) {
  const t = val / 100;
  document.getElementById('ns-fa-threshold-display').textContent = val + '%';
  document.getElementById('ns-fa-threshold-hint').textContent = _threshHint(t);
}

async function nsFaceToggleChamcong(newState) {
  try {
    const { data, error } = await supa.rpc('fn_face_admin_toggle_chamcong', {
      p_ma_admin: SESSION.ma, p_enabled: newState
    });
    if (error) throw error;
    if (!data || !data.ok) throw new Error(data && data.message);
    showToast(newState ? '✓ Đã BẬT chấm công khuôn mặt' : '✓ Đã TẮT', 'ok');
    if (SESSION) { SESSION._faceEnabled = newState; SESSION._faceCfgTs = Date.now(); }
    const lbl = document.getElementById('menu-face-admin-status');
    if (lbl) {
      if (newState) { lbl.textContent = '🟢 BẬT'; lbl.style.color = '#16a34a'; }
      else { lbl.textContent = '⚪ TẮT'; lbl.style.color = '#94A3B8'; }
    }
    nsFaceCloseAdmin();
    setTimeout(() => nsFaceOpenAdmin(), 300);
  } catch (err) {
    showToast('Lỗi: ' + err.message, 'err');
  }
}

async function nsFaceSaveThreshold() {
  const slider = document.getElementById('ns-fa-threshold-slider');
  if (!slider) return;
  const newT = parseInt(slider.value, 10) / 100;
  try {
    const { data, error } = await supa.rpc('fn_face_admin_set_threshold', {
      p_ma_admin: SESSION.ma, p_scope: 'global', p_threshold: newT, p_note: 'Admin tune'
    });
    if (error) throw error;
    if (!data || !data.ok) throw new Error(data && data.message);
    showToast('✓ Đã cập nhật ngưỡng ' + Math.round(newT * 100) + '%', 'ok');
  } catch (err) {
    showToast('Lỗi: ' + err.message, 'err');
  }
}

// ═════════════════════════════════════════════════════════════════════════
// Check enabled (cache 60s)
// ═════════════════════════════════════════════════════════════════════════
async function nsFaceCheckEnabled() {
  if (SESSION && SESSION._faceCfgTs && (Date.now() - SESSION._faceCfgTs < 60000)) {
    return SESSION._faceEnabled === true;
  }
  try {
    const { data } = await supa.rpc('fn_face_get_config');
    if (SESSION) {
      SESSION._faceEnabled = !!(data && data.enabled);
      SESSION._faceCfgTs = Date.now();
    }
    return !!(data && data.enabled);
  } catch (e) {
    return false;
  }
}

// ─── Globals ─────────────────────────────────────────────────────────────
window.nsFaceOpenEnrollment = nsFaceOpenEnrollment;
window.nsFaceCloseEnrollment = nsFaceCloseEnrollment;
window.nsFaceStartChamCong = nsFaceStartChamCong;
window.nsFaceCloseVerify = nsFaceCloseVerify;
window.nsFaceOpenAdmin = nsFaceOpenAdmin;
window.nsFaceCloseAdmin = nsFaceCloseAdmin;
window.nsFaceToggleChamcong = nsFaceToggleChamcong;
window.nsFaceSaveThreshold = nsFaceSaveThreshold;
window.nsFaceThresholdPreview = nsFaceThresholdPreview;
window.nsFaceCheckEnabled = nsFaceCheckEnabled;
