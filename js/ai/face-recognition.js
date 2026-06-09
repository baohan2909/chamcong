/* ════════════════════════════════════════════════════════════════════════════
 *  Nón Sơn — Face Recognition Module v12.2 (Face ID Style)
 *
 *  Inspired by iPhone Face ID setup:
 *   - Camera live trong vòng tròn lớn
 *   - Outer progress ring với 12 dots fill dần khi đủ góc
 *   - Rotating sweep beam (radar style)
 *   - Auto-capture khi face stable + đúng góc head (yaw detection)
 *   - KHÔNG dùng chớp mắt (hay fail) — dùng head movement
 *   - Haptic feedback (vibrate)
 *  ──────────────────────────────────────────────────────────────────────── */

const NS_FACE = {
  FACEAPI_SCRIPT: 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js',
  MODELS_URL: 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model/',
  MIN_FACE_SIZE: 80,
  STABILITY_FRAMES: 3,   // ~0.3s — dễ hơn
  STABILITY_PX: 30,      // cho phép dao động nhiều hơn
  YAW_STRAIGHT: 0.10,    // nới rộng
  YAW_TURN_MIN: 0.10,    // chỉ cần quay nhẹ
  YAW_TURN_MAX: 0.60,    // chấp nhận quay nhiều
  CAPTURE_FRAMES: 2,     // chỉ cần 2 frames
  VERIFY_STABILITY: 3    // verify nhanh hơn
};

let _faceLoaded = false;
let _faceLoading = false;
let _enrollState = null;
let _verifyState = null;

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

async function nsFaceOpenCamera(videoEl) {
  // Để camera mặc định, không force resolution để tránh kích hoạt ultra-wide
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user' },
    audio: false
  });
  videoEl.srcObject = stream;
  await new Promise(r => videoEl.onloadedmetadata = r);
  await videoEl.play();
  return stream;
}
function nsFaceStopCamera(stream) { if (stream) stream.getTracks().forEach(t => t.stop()); }

async function nsFaceDetect(videoEl) {
  if (!_faceLoaded) return null;
  const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.45 });
  const result = await faceapi.detectSingleFace(videoEl, opts).withFaceLandmarks().withFaceDescriptor();
  if (!result) return null;
  const box = result.detection.box;
  if (box.width < NS_FACE.MIN_FACE_SIZE) return { tooSmall: true };
  return {
    box: { x: box.x, y: box.y, width: box.width, height: box.height,
           cx: box.x + box.width / 2, cy: box.y + box.height / 2 },
    landmarks: result.landmarks.positions,
    embedding: Array.from(result.descriptor),
    score: result.detection.score
  };
}

function nsFaceEstimateYaw(landmarks) {
  if (!landmarks || landmarks.length < 68) return 0;
  const nose = landmarks[30];
  const leftEye = landmarks[36];
  const rightEye = landmarks[45];
  const dL = Math.abs(nose.x - leftEye.x);
  const dR = Math.abs(nose.x - rightEye.x);
  const total = dL + dR;
  return total > 1 ? (dR - dL) / total : 0;
}

function nsFaceCheckStable(prev, curr) {
  if (!prev || !curr) return false;
  return Math.abs(prev.cx - curr.cx) < NS_FACE.STABILITY_PX
      && Math.abs(prev.cy - curr.cy) < NS_FACE.STABILITY_PX;
}

function nsFaceAvg(embeddings) {
  if (!embeddings.length) return null;
  const dim = embeddings[0].length;
  const avg = new Array(dim).fill(0);
  embeddings.forEach(e => { for (let i = 0; i < dim; i++) avg[i] += e[i]; });
  for (let i = 0; i < dim; i++) avg[i] /= embeddings.length;
  return avg;
}

function _haptic(pattern) {
  try { if (navigator.vibrate) navigator.vibrate(pattern || 30); } catch (e) {}
}

function _nsFaceRenderDots(svgId) {
  const dotsG = document.getElementById(svgId);
  if (!dotsG) return;
  dotsG.innerHTML = '';
  for (let i = 0; i < 12; i++) {
    const angle = (i * 30 - 90) * Math.PI / 180;
    const x = 100 + 92 * Math.cos(angle);
    const y = 100 + 92 * Math.sin(angle);
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', x); dot.setAttribute('cy', y);
    dot.setAttribute('r', '3');
    dot.setAttribute('fill', 'rgba(43,192,132,.25)');
    dot.setAttribute('class', 'ns-face-dot-svg');
    dotsG.appendChild(dot);
  }
}

function _nsFaceLightDots(svgId, activeCount) {
  const dots = document.querySelectorAll('#' + svgId + ' .ns-face-dot-svg');
  dots.forEach((d, i) => {
    if (i < activeCount) { d.setAttribute('fill', '#2BC084'); d.setAttribute('r', '4.5'); }
    else { d.setAttribute('fill', 'rgba(43,192,132,.25)'); d.setAttribute('r', '3'); }
  });
}

// ═════════════════════════════════════════════════════════════════════════
// FLOW 1: ENROLLMENT (Face ID style)
// ═════════════════════════════════════════════════════════════════════════

async function nsFaceOpenEnrollment() {
  const old = document.getElementById('ns-face-modal');
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = 'ns-face-modal';
  modal.className = 'ns-face-modal';
  modal.innerHTML = `
    <div class="ns-face-header">
      <button class="ns-face-close" onclick="nsFaceCloseEnrollment()">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <div class="ns-face-title">Đăng ký khuôn mặt</div>
    </div>
    <div class="ns-face-body">
      <div id="ns-face-step-intro" class="ns-face-step active">
        <div class="ns-face-icon-big">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#2BC084" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
        </div>
        <h3>Quét khuôn mặt</h3>
        <p>Đặt mặt vào vòng tròn. Hệ thống tự quét 3 góc khi mặt ổn định — KHÔNG cần chớp mắt.</p>
        <div class="ns-face-privacy">
          <b>Bảo mật:</b> Chỉ lưu vector đặc trưng (128 số), không lưu ảnh gốc.
        </div>
        <button class="ns-face-btn-primary" onclick="nsFaceStartEnrollScan()">Bắt đầu quét</button>
      </div>
      <div id="ns-face-step-scan" class="ns-face-step"></div>
      <div id="ns-face-step-done" class="ns-face-step">
        <div class="ns-face-icon-big success">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h3>Quét thành công</h3>
        <p>Từ giờ bạn có thể chấm công bằng cách quét khuôn mặt.</p>
        <button class="ns-face-btn-primary" onclick="nsFaceCloseEnrollment()">Xong</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('open'));
}

function nsFaceCloseEnrollment() {
  const modal = document.getElementById('ns-face-modal');
  if (!modal) return;
  if (_enrollState && _enrollState.stream) nsFaceStopCamera(_enrollState.stream);
  _enrollState = null;
  modal.classList.remove('open');
  setTimeout(() => modal.remove(), 250);
}

async function nsFaceStartEnrollScan() {
  document.getElementById('ns-face-step-intro').classList.remove('active');
  document.getElementById('ns-face-step-scan').classList.add('active');

  const scanStep = document.getElementById('ns-face-step-scan');
  scanStep.innerHTML = `
    <div class="ns-face-scan-wrap" id="fe-wrap">
      <div class="ns-face-scan-video">
        <video id="fe-video" autoplay muted playsinline></video>
        <div class="ns-face-check-overlay" id="fe-check">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#2BC084" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
      </div>
      <div class="ns-face-arrow" id="fe-arrow-left">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </div>
      <div class="ns-face-arrow" id="fe-arrow-right">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
      <svg class="ns-face-scan-ring" viewBox="0 0 200 200">
        <defs>
          <linearGradient id="feGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#2BC084"/>
            <stop offset="100%" stop-color="#0F6E56"/>
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r="92" fill="none" stroke="rgba(43,192,132,.13)" stroke-width="4"/>
        <circle id="fe-progress" cx="100" cy="100" r="92" fill="none"
                stroke="url(#feGrad)" stroke-width="5" stroke-linecap="round"
                stroke-dasharray="578" stroke-dashoffset="578"
                transform="rotate(-90 100 100)"
                style="transition: stroke-dashoffset .5s cubic-bezier(.2,.7,.3,1)"/>
      </svg>
    </div>
    <div class="ns-face-scan-status" id="fe-status">Đang khởi động camera...</div>
    <div class="ns-face-scan-instruction" id="fe-instruction">Vui lòng chờ</div>
    <div class="ns-face-scan-progress" id="fe-progress-text">0 / 3 góc</div>
  `;

  _enrollState = {
    angles: ['thang', 'trai', 'phai'],
    captured: {},
    currentTarget: 'thang',
    stream: null, prevFace: null, stableCount: 0, captureBuffer: []
  };

  const ok = await nsFaceEnsureLoaded();
  if (!ok) { _setFeStatus('Lỗi tải module'); return; }

  const video = document.getElementById('fe-video');
  try { _enrollState.stream = await nsFaceOpenCamera(video); }
  catch (e) { _setFeStatus('Cần cấp quyền camera'); return; }

  _setFeStatus('Tìm khuôn mặt...');
  _setFeInstruction('Đặt mặt vào vòng tròn');
  _runEnrollLoop(video);
}

function _setFeStatus(t) { const el = document.getElementById('fe-status'); if (el) el.textContent = t; }
function _setFeInstruction(t) { const el = document.getElementById('fe-instruction'); if (el) el.textContent = t; }
function _setFeProgressText(t) { const el = document.getElementById('fe-progress-text'); if (el) el.textContent = t; }
function _setFeProgressArc(pct) {
  const arc = document.getElementById('fe-progress');
  if (arc) arc.setAttribute('stroke-dashoffset', 578 * (1 - pct / 100));
}

async function _runEnrollLoop(video) {
  const targetInstructions = {
    'thang': 'Nhìn thẳng vào camera',
    'trai': 'Quay đầu sang TRÁI nhẹ',
    'phai': 'Quay đầu sang PHẢI nhẹ'
  };

  while (_enrollState && _enrollState.stream) {
    const target = _enrollState.currentTarget;
    if (!target) break;
    _setFeInstruction(targetInstructions[target]);
    _setFeArrow(target);

    const res = await nsFaceDetect(video);
    if (!res) {
      _setFeStatus('Tìm khuôn mặt...');
      _enrollState.stableCount = 0; _enrollState.captureBuffer = [];
    } else if (res.tooSmall) {
      _setFeStatus('Đưa mặt gần hơn');
      _enrollState.stableCount = 0;
    } else {
      const stable = nsFaceCheckStable(_enrollState.prevFace, res.box);
      if (stable) _enrollState.stableCount++;
      else { _enrollState.stableCount = 0; _enrollState.captureBuffer = []; }
      _enrollState.prevFace = res.box;

      const yaw = nsFaceEstimateYaw(res.landmarks);
      let matchesAngle = false;
      if (target === 'thang') matchesAngle = Math.abs(yaw) < NS_FACE.YAW_STRAIGHT;
      else if (target === 'trai') matchesAngle = yaw > NS_FACE.YAW_TURN_MIN && yaw < NS_FACE.YAW_TURN_MAX;
      else if (target === 'phai') matchesAngle = yaw < -NS_FACE.YAW_TURN_MIN && yaw > -NS_FACE.YAW_TURN_MAX;

      if (matchesAngle && _enrollState.stableCount >= NS_FACE.STABILITY_FRAMES) {
        _enrollState.captureBuffer.push(res.embedding);
        _setFeStatus('Đang quét ' + _enrollState.captureBuffer.length + '/' + NS_FACE.CAPTURE_FRAMES);
        // Pulse effect
        const wrap = document.getElementById('fe-wrap');
        if (wrap) { wrap.classList.add('capturing'); setTimeout(() => wrap.classList.remove('capturing'), 600); }

        if (_enrollState.captureBuffer.length >= NS_FACE.CAPTURE_FRAMES) {
          const avg = nsFaceAvg(_enrollState.captureBuffer);
          const saveResult = await _saveEnrollAngle(target, avg);
          _enrollState.captureBuffer = []; _enrollState.stableCount = 0;

          if (saveResult) {
            // Show check overlay
            const check = document.getElementById('fe-check');
            if (check) { check.classList.add('show'); setTimeout(() => check.classList.remove('show'), 900); }
            _haptic([40, 60, 40]);

            const idx = _enrollState.angles.indexOf(target);
            if (idx === _enrollState.angles.length - 1) {
              _enrollState.currentTarget = null;
              await _onEnrollComplete();
              return;
            } else {
              _enrollState.currentTarget = _enrollState.angles[idx + 1];
              _setFeStatus('✓ Đã lưu góc');
              await new Promise(r => setTimeout(r, 1000));
            }
          }
        }
      } else if (matchesAngle) {
        _setFeStatus('Giữ yên...');
      } else {
        if (target === 'thang' && Math.abs(yaw) > NS_FACE.YAW_STRAIGHT) {
          _setFeStatus(yaw > 0 ? 'Quay đầu sang phải' : 'Quay đầu sang trái');
        } else {
          _setFeStatus('Đang chờ đúng góc...');
        }
      }
    }
    await new Promise(r => setTimeout(r, 100));
  }
}

function _setFeArrow(target) {
  const aL = document.getElementById('fe-arrow-left');
  const aR = document.getElementById('fe-arrow-right');
  if (!aL || !aR) return;
  if (target === 'trai') { aL.classList.add('show'); aR.classList.remove('show'); }
  else if (target === 'phai') { aR.classList.add('show'); aL.classList.remove('show'); }
  else { aL.classList.remove('show'); aR.classList.remove('show'); }
}

async function _saveEnrollAngle(goc, embedding) {
  try {
    const { data, error } = await supa.rpc('fn_face_enroll', {
      p_ma_nv: SESSION.ma, p_embedding: embedding, p_goc: goc,
      p_chat_luong: 0.9, p_device: navigator.userAgent.substring(0, 100)
    });
    if (error) throw error;
    if (!data || !data.ok) throw new Error(data && data.message || 'Lưu thất bại');
    _enrollState.captured[goc] = true;
    const done = Object.keys(_enrollState.captured).length;
    _setFeProgressArc((done / 3) * 100);
    _setFeProgressText(done + ' / 3 góc');
    return true;
  } catch (e) {
    const msg = e.message || 'Lỗi không xác định';
    _setFeStatus('✗ Lỗi: ' + msg);
    if (typeof showToast === 'function') showToast('Lỗi lưu góc: ' + msg, 'err');
    return false;
  }
}

async function _onEnrollComplete() {
  _setFeProgressArc(100);
  await new Promise(r => setTimeout(r, 600));
  if (_enrollState && _enrollState.stream) nsFaceStopCamera(_enrollState.stream);
  document.getElementById('ns-face-step-scan').classList.remove('active');
  document.getElementById('ns-face-step-done').classList.add('active');
  const lbl = document.getElementById('menu-face-status');
  if (lbl) { lbl.textContent = '✓ Đã đăng ký'; lbl.style.color = '#0F6E56'; }
}

// ═════════════════════════════════════════════════════════════════════════
// FLOW 2: VERIFY KHI CHẤM CÔNG
// ═════════════════════════════════════════════════════════════════════════

async function nsFaceStartChamCong(onSuccess, onFail) {
  let enrolled = false;
  try {
    const { data } = await supa.rpc('fn_face_enroll_status', { p_ma_nv: SESSION.ma });
    enrolled = data && data.completed;
  } catch (e) {}

  if (!enrolled) {
    const yes = window.confirm('Bạn chưa đăng ký khuôn mặt.\n\nBấm OK để đăng ký ngay (~1 phút)\nHoặc Hủy để chấm công bằng ảnh tay như cũ.');
    if (yes) { nsFaceOpenEnrollment(); }
    else { if (onFail) onFail({ reason: 'no_enroll', fallback: true }); }
    return;
  }

  const old = document.getElementById('ns-face-verify-modal');
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = 'ns-face-verify-modal';
  modal.className = 'ns-face-modal';
  modal.innerHTML = `
    <div class="ns-face-header">
      <button class="ns-face-close" onclick="nsFaceCloseVerify()">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <div class="ns-face-title">Xác minh khuôn mặt</div>
    </div>
    <div class="ns-face-body">
      <div class="ns-face-step active">
        <div class="ns-face-scan-wrap">
          <div class="ns-face-scan-video">
            <video id="fv-video" autoplay muted playsinline></video>
          </div>
          <svg class="ns-face-scan-ring" viewBox="0 0 200 200">
            <defs>
              <linearGradient id="fvGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#2BC084"/>
                <stop offset="100%" stop-color="#0F6E56"/>
              </linearGradient>
            </defs>
            <circle cx="100" cy="100" r="92" fill="none" stroke="rgba(43,192,132,.13)" stroke-width="4"/>
            <circle id="fv-progress" cx="100" cy="100" r="92" fill="none"
                    stroke="url(#fvGrad)" stroke-width="5" stroke-linecap="round"
                    stroke-dasharray="578" stroke-dashoffset="578"
                    transform="rotate(-90 100 100)"
                    style="transition: stroke-dashoffset .3s ease"/>
          </svg>
        </div>
        <div class="ns-face-scan-status" id="fv-status">Đang tải...</div>
        <div class="ns-face-scan-instruction" id="fv-instruction">Vui lòng chờ</div>
        <div class="ns-face-attempts" id="fv-attempts" style="display:none"></div>
        <button class="ns-face-btn-secondary" onclick="nsFaceVerifyFallback()" id="fv-fallback-btn" style="display:none">Chấm công bằng ảnh tay</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('open'));

  _verifyState = { stream: null, attempts: 0, prevFace: null, stableCount: 0,
                   onSuccess, onFail, captureBuffer: [] };

  const ok = await nsFaceEnsureLoaded();
  if (!ok) { _setFvStatus('Lỗi tải module'); return; }

  const video = document.getElementById('fv-video');
  try { _verifyState.stream = await nsFaceOpenCamera(video); }
  catch (e) { _setFvStatus('Cần cấp quyền camera'); return; }

  _setFvStatus('Đặt mặt vào khung');
  _setFvInstruction('Hệ thống tự xác minh khi mặt ổn định');
  _runVerifyLoop(video);
}

function _setFvStatus(t) { const el = document.getElementById('fv-status'); if (el) el.textContent = t; }
function _setFvInstruction(t) { const el = document.getElementById('fv-instruction'); if (el) el.textContent = t; }
function _setFvArc(pct) {
  const arc = document.getElementById('fv-progress');
  if (arc) arc.setAttribute('stroke-dashoffset', 578 * (1 - pct / 100));
}

async function _runVerifyLoop(video) {
  while (_verifyState && _verifyState.stream) {
    const res = await nsFaceDetect(video);
    if (!res) {
      _setFvStatus('Tìm khuôn mặt...');
      _verifyState.stableCount = 0; _verifyState.captureBuffer = [];
      _setFvArc(0);
    } else if (res.tooSmall) {
      _setFvStatus('Đưa mặt gần hơn');
      _verifyState.stableCount = 0; _setFvArc(0);
    } else {
      const stable = nsFaceCheckStable(_verifyState.prevFace, res.box);
      if (stable) _verifyState.stableCount++;
      else { _verifyState.stableCount = 0; _verifyState.captureBuffer = []; }
      _verifyState.prevFace = res.box;

      const needed = NS_FACE.VERIFY_STABILITY + NS_FACE.CAPTURE_FRAMES;
      const pct = Math.min(100, (_verifyState.stableCount / needed) * 100);
      _setFvArc(pct);

      if (_verifyState.stableCount >= NS_FACE.VERIFY_STABILITY) {
        _verifyState.captureBuffer.push(res.embedding);
        _setFvStatus('Giữ yên ' + _verifyState.captureBuffer.length + '/' + NS_FACE.CAPTURE_FRAMES);
        if (_verifyState.captureBuffer.length >= NS_FACE.CAPTURE_FRAMES) {
          const avg = nsFaceAvg(_verifyState.captureBuffer);
          _setFvStatus('Đang xác minh...');
          await _doVerifySubmit(avg);
          return;
        }
      } else {
        _setFvStatus('Giữ yên');
      }
    }
    await new Promise(r => setTimeout(r, 100));
  }
}

async function _doVerifySubmit(embedding) {
  try {
    const { data, error } = await supa.rpc('fn_face_verify', {
      p_ma_nv: SESSION.ma, p_embedding: embedding,
      p_device: navigator.userAgent.substring(0, 100)
    });
    if (error) throw error;
    if (data && data.passed) {
      _setFvStatus('✓ Xác minh thành công');
      _setFvArc(100);
      _haptic([30, 50, 30, 50, 60]);
      const cb = _verifyState.onSuccess;
      const sim = data.similarity;
      setTimeout(() => { nsFaceCloseVerify(); if (cb) cb({ similarity: sim }); }, 600);
    } else {
      _verifyState.attempts++;
      const att = document.getElementById('fv-attempts');
      if (att) { att.style.display = ''; att.textContent = 'Thử lần ' + _verifyState.attempts + '/3 — không khớp'; }
      _setFvStatus('✗ Không khớp');
      _setFvArc(0);
      _verifyState.captureBuffer = []; _verifyState.stableCount = 0;
      _haptic([100, 50, 100]);

      if (_verifyState.attempts >= 3) {
        const fb = document.getElementById('fv-fallback-btn');
        if (fb) fb.style.display = '';
        _setFvInstruction('Đã thử 3 lần. Bấm bên dưới để chấm công bằng ảnh tay');
      } else {
        const video = document.getElementById('fv-video');
        await new Promise(r => setTimeout(r, 1300));
        if (_verifyState && _verifyState.stream) _runVerifyLoop(video);
      }
    }
  } catch (e) {
    _setFvStatus('Lỗi: ' + (e.message || 'network'));
  }
}

function nsFaceCloseVerify() {
  const m = document.getElementById('ns-face-verify-modal');
  if (!m) return;
  if (_verifyState && _verifyState.stream) nsFaceStopCamera(_verifyState.stream);
  _verifyState = null;
  m.classList.remove('open');
  setTimeout(() => m.remove(), 250);
}

function nsFaceVerifyFallback() {
  const cb = _verifyState && _verifyState.onFail;
  nsFaceCloseVerify();
  if (cb) cb({ reason: 'low_sim', fallback: true });
}

// ═════════════════════════════════════════════════════════════════════════
// FLOW 3: ADMIN PANEL
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
            <span class="ns-fa-threshold-hint" id="ns-fa-threshold-hint">${_nsFaceThresholdHint(cfg.threshold || 0.5)}</span>
          </div>
        </div>
        <button class="ns-fa-btn-save" onclick="nsFaceSaveThreshold()">Cập nhật ngưỡng</button>
      </div>

      ${stats.top_fails && stats.top_fails.length > 0 ? `
      <div class="ns-fa-card">
        <div class="ns-fa-section-label">NV xác minh fail nhiều (7 ngày)</div>
        <div class="ns-fa-fail-list">
          ${stats.top_fails.slice(0, 5).map(f => `
            <div class="ns-fa-fail-row">
              <div class="ns-fa-fail-nv">${escHtml(f.ma_nv)}</div>
              <div class="ns-fa-fail-cnt">${f.fail_count}× fail</div>
              <div class="ns-fa-fail-sim">sim ${Number(f.avg_sim).toFixed(2)}</div>
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}

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

function _nsFaceThresholdHint(t) {
  if (t < 0.45) return 'Nới rộng';
  if (t < 0.55) return 'Dễ pass (giai đoạn đầu)';
  if (t < 0.65) return 'Cân bằng';
  if (t < 0.80) return 'Chặt';
  return 'Rất chặt';
}

function nsFaceThresholdPreview(val) {
  const t = val / 100;
  document.getElementById('ns-fa-threshold-display').textContent = val + '%';
  document.getElementById('ns-fa-threshold-hint').textContent = _nsFaceThresholdHint(t);
}

async function nsFaceToggleChamcong(newState) {
  try {
    const { data, error } = await supa.rpc('fn_face_admin_toggle_chamcong', {
      p_ma_admin: SESSION.ma, p_enabled: newState
    });
    if (error) throw error;
    if (!data || !data.ok) throw new Error(data && data.message);
    showToast(newState ? '✓ Đã BẬT chấm công khuôn mặt' : '✓ Đã TẮT — quay về chụp ảnh tay', 'ok');
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
// Cache: check face.chamcong_enabled (cache 60s)
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

// ─── Expose globals ────────────────────────────────────────────────────────
window.nsFaceOpenEnrollment = nsFaceOpenEnrollment;
window.nsFaceCloseEnrollment = nsFaceCloseEnrollment;
window.nsFaceStartEnrollScan = nsFaceStartEnrollScan;
window.nsFaceStartChamCong = nsFaceStartChamCong;
window.nsFaceCloseVerify = nsFaceCloseVerify;
window.nsFaceVerifyFallback = nsFaceVerifyFallback;
window.nsFaceOpenAdmin = nsFaceOpenAdmin;
window.nsFaceCloseAdmin = nsFaceCloseAdmin;
window.nsFaceToggleChamcong = nsFaceToggleChamcong;
window.nsFaceSaveThreshold = nsFaceSaveThreshold;
window.nsFaceThresholdPreview = nsFaceThresholdPreview;
window.nsFaceCheckEnabled = nsFaceCheckEnabled;
