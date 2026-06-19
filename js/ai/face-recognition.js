/* ════════════════════════════════════════════════════════════════════════════
 *  Nón Sơn — Face Recognition Module v12.7 (Smooth Premium UX)
 *
 *  Changes from v12.6:
 *   - BỎ countdown 3-2-1 giật → smooth continuous ring fill (2.5s)
 *   - Pulse ring khi đang scan
 *   - Big success screen full overlay sau verify
 *   - Câu chữ tinh tế hơn
 *   - Vòng tròn 92vw (CSS đã setup từ v12.6)
 *  ──────────────────────────────────────────────────────────────────────── */

const NS_FACE = {
  FACEAPI_SCRIPT: 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js',
  MODELS_URL: 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model/',
  MIN_FACE_SIZE: 80,
  STABLE_FRAMES_NEEDED: 3,
  STABLE_PX: 30,
  SCAN_DURATION_MS: 2500  // smooth fill 2.5s
};

let _faceLoaded = false;
let _faceLoading = false;

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
  // Stop stream cũ nếu còn
  if (videoEl.srcObject) {
    try { videoEl.srcObject.getTracks().forEach(t => t.stop()); } catch(_){}
    videoEl.srcObject = null;
  }

  // Thuộc tính autoplay-friendly cho iOS (muted phải là PROPERTY mới tự phát được)
  try {
    videoEl.muted = true;
    videoEl.defaultMuted = true;
    videoEl.playsInline = true;
    videoEl.setAttribute('muted', '');
    videoEl.setAttribute('autoplay', '');
    videoEl.setAttribute('playsinline', '');
    videoEl.setAttribute('webkit-playsinline', '');
  } catch (_) {}

  // Cấu hình tối giản, ổn định: chỉ camera trước, KHÔNG ép độ phân giải (tránh camera nhảy/refocus liên tục)
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
  } catch (e1) {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  }
  videoEl.srcObject = stream;

  // Đợi metadata (timeout 5s phòng treo)
  if (videoEl.readyState < 1) {
    await new Promise((resolve) => {
      const tid = setTimeout(resolve, 5000);
      videoEl.addEventListener('loadedmetadata', () => { clearTimeout(tid); resolve(); }, { once: true });
    });
  }

  // play() + retry 1 lần (iOS có thể reject AbortError khi stream vừa attach)
  try {
    await videoEl.play();
  } catch (e) {
    await new Promise(r => setTimeout(r, 150));
    try { await videoEl.play(); } catch(_) {}
  }

  // Autoplay bị chặn (tiết kiệm pin / một số trình duyệt) → chạm vào vùng camera để bật
  if (videoEl.paused) {
    const tapTarget = videoEl.closest('.ns-face-stage') || videoEl;
    const _tapPlay = () => { videoEl.play().catch(() => {}); };
    tapTarget.addEventListener('click', _tapPlay);
    tapTarget.addEventListener('touchstart', _tapPlay, { passive: true });
  }

  return stream;
}
function _stopCam(stream) { if (stream) stream.getTracks().forEach(t => t.stop()); }

// [v13.14] Capture frame face thực từ video element (mirror để khớp với góc nhìn user)
function _captureFaceFrame(videoEl) {
  try {
    const w = videoEl.videoWidth || 640;
    const h = videoEl.videoHeight || 480;
    if (!w || !h) return null;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    // Mirror: video selfie hiển thị mirrored cho user, lưu khớp với những gì user thấy
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoEl, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.88);
  } catch(e) { return null; }
}

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

function _checkStable(prev, curr) {
  if (!prev || !curr) return false;
  return Math.abs(prev.cx - curr.cx) < NS_FACE.STABLE_PX
      && Math.abs(prev.cy - curr.cy) < NS_FACE.STABLE_PX;
}

function _avgEmbeddings(arr) {
  if (!arr.length) return null;
  const dim = arr[0].length;
  const out = new Array(dim).fill(0);
  arr.forEach(e => { for (let i = 0; i < dim; i++) out[i] += e[i]; });
  for (let i = 0; i < dim; i++) out[i] /= arr.length;
  return out;
}

function _haptic(p) { try { if (navigator.vibrate) navigator.vibrate(p || 30); } catch (e) {} }

// ═════════════════════════════════════════════════════════════════════════
// SHARED: Build face scan stage (vòng tròn camera + ring + check)
// ═════════════════════════════════════════════════════════════════════════
function _buildStage(containerEl, prefix) {
  containerEl.innerHTML = `
    <div class="ns-face-stage" id="${prefix}-stage">
      <div class="ns-face-cam">
        <video id="${prefix}-video" autoplay muted playsinline webkit-playsinline></video>
      </div>
      <div class="ns-face-cam-overlay">
        <div class="ns-face-cam-check" id="${prefix}-check">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
      </div>
      <svg class="ns-face-ring" viewBox="0 0 200 200">
        <defs>
          <linearGradient id="nsFaceRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#2BC084"/>
            <stop offset="100%" stop-color="#0F6E56"/>
          </linearGradient>
        </defs>
        <circle class="ns-face-ring-bg" cx="100" cy="100" r="95"/>
        <circle class="ns-face-ring-fg" id="${prefix}-ring-fg" cx="100" cy="100" r="95"/>
      </svg>
    </div>
    <div class="ns-face-instruction" id="${prefix}-instruction"></div>
    <div class="ns-face-substatus" id="${prefix}-substatus"></div>
  `;
}

function _setInstruction(prefix, text) {
  const el = document.getElementById(prefix + '-instruction');
  if (el) el.textContent = text;
}
function _setSubstatus(prefix, text, type) {
  const el = document.getElementById(prefix + '-substatus');
  if (!el) return;
  el.textContent = text || '';
  el.className = 'ns-face-substatus' + (type ? ' ' + type : '');
}

// ═════════════════════════════════════════════════════════════════════════
// CORE: Đợi face stable + smooth ring fill + capture frames
// ═════════════════════════════════════════════════════════════════════════
async function _waitStable(video, prefix, abortRef) {
  let prev = null, stableCount = 0;
  // Đợi video có khung hình thật trước khi nhận diện — tránh nghẽn CPU/đứng hình lúc camera vừa khởi tạo
  let _ready = 0;
  while (!abortRef.aborted && _ready < 30) {
    if (video.videoWidth > 0 && video.readyState >= 2 && !video.paused) break;
    await new Promise(r => setTimeout(r, 100));
    _ready++;
  }
  while (!abortRef.aborted) {
    const r = await _detectFace(video);
    if (!r) {
      _setSubstatus(prefix, 'Đang tìm khuôn mặt');
      stableCount = 0; prev = null;
    } else if (r.tooSmall) {
      _setSubstatus(prefix, 'Đưa khuôn mặt gần hơn');
      stableCount = 0;
    } else {
      if (_checkStable(prev, r.box)) stableCount++;
      else stableCount = 0;
      prev = r.box;
      if (stableCount >= NS_FACE.STABLE_FRAMES_NEEDED) {
        return r.embedding;
      }
      _setSubstatus(prefix, 'Đã định vị, sẵn sàng quét');
    }
    await new Promise(r => setTimeout(r, 100));
  }
  return null;
}

async function _smoothScan(video, prefix, abortRef) {
  const initial = await _waitStable(video, prefix, abortRef);
  if (!initial || abortRef.aborted) return null;

  const stage = document.getElementById(prefix + '-stage');
  const ringFg = document.getElementById(prefix + '-ring-fg');

  // Reset ring → 0%
  if (ringFg) {
    ringFg.classList.remove('animating', 'flash-complete');
    ringFg.style.strokeDashoffset = '597';
  }

  // Start scanning pulse
  if (stage) stage.classList.add('scanning');
  _setSubstatus(prefix, 'Đang quét...', 'ok');

  // Force reflow then animate ring fill 0 → 100%
  if (ringFg) {
    void ringFg.offsetWidth;
    ringFg.classList.add('animating');
    ringFg.style.strokeDashoffset = '0';
  }

  // Multi-frame capture trong khoảng 2.5s
  const frames = [initial];
  const frameCount = 4;
  const stepMs = Math.floor(NS_FACE.SCAN_DURATION_MS / frameCount);
  for (let i = 0; i < frameCount; i++) {
    if (abortRef.aborted) return null;
    await new Promise(r => setTimeout(r, stepMs));
    const r = await _detectFace(video);
    if (r && r.embedding) frames.push(r.embedding);
  }

  // Complete: flash ring + check icon
  if (stage) stage.classList.remove('scanning');
  if (ringFg) ringFg.classList.add('flash-complete');

  const check = document.getElementById(prefix + '-check');
  if (check) check.classList.add('show');
  _haptic([40, 60, 40]);

  await new Promise(r => setTimeout(r, 800));

  // Reset for next round
  if (check) check.classList.remove('show');
  if (ringFg) ringFg.classList.remove('flash-complete');

  return _avgEmbeddings(frames);
}

// ═════════════════════════════════════════════════════════════════════════
// FLOW 1: ENROLLMENT
// ═════════════════════════════════════════════════════════════════════════
let _enrollAbort = { aborted: false };
let _enrollStream = null;

async function nsFaceOpenEnrollment() {
  _enrollAbort = { aborted: false };
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
    <div class="ns-face-body" id="ns-face-modal-body">
      <div class="ns-face-step active">
        <div class="ns-face-icon-big">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#2BC084" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
        </div>
        <h3>Quét khuôn mặt</h3>
        <p>Hệ thống sẽ lưu 3 góc nhìn: chính diện, nghiêng trái và nghiêng phải. Mỗi lần quét chỉ mất vài giây.</p>
        <div class="ns-face-privacy">
          <b>Bảo mật:</b> Chỉ lưu vector đặc trưng, không lưu ảnh gốc của bạn.
        </div>
        <button class="ns-face-btn-primary" id="ns-fe-start">Bắt đầu</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('open'));

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
  body.innerHTML = '<div class="ns-face-step active" id="fe-step"></div>';
  const step = document.getElementById('fe-step');
  _buildStage(step, 'fe');

  const ok = await nsFaceEnsureLoaded();
  if (!ok) { _setInstruction('fe', 'Lỗi tải máy quét'); return; }

  const video = document.getElementById('fe-video');
  try {
    _enrollStream = await _openCam(video);
    if (video.paused) _setInstruction('fe', 'Chạm vào vòng tròn để bật camera');
  } catch (e) {
    const isPerm = e && (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError' || /denied|permission/i.test(e.message || ''));
    if (isPerm) {
      _setInstruction('fe', 'Cần cấp quyền camera — vào Cài đặt cho phép rồi bấm "Thử lại"');
    } else {
      _setInstruction('fe', 'Không mở được camera — bấm "Thử lại"');
    }
    _addRetryBtn('fe', () => { _enrollAbort.aborted = true; setTimeout(() => nsFaceEnroll(), 100); });
    return;
  }

  const steps = [
    { goc: 'thang', label: 'Nhìn thẳng vào ống kính', delay: 300 },
    { goc: 'trai',  label: 'Quay nhẹ về vai TRÁI của bạn', delay: 1500 },
    { goc: 'phai',  label: 'Quay nhẹ về vai PHẢI của bạn', delay: 1500 }
  ];

  for (let i = 0; i < steps.length; i++) {
    const st = steps[i];
    if (_enrollAbort.aborted) return;

    _setInstruction('fe', st.label);
    _setSubstatus('fe', '', '');
    await new Promise(r => setTimeout(r, st.delay));

    const embedding = await _smoothScan(video, 'fe', _enrollAbort);
    if (!embedding || _enrollAbort.aborted) return;

    _setSubstatus('fe', 'Đang lưu...', 'ok');
    const saved = await _saveEnroll(st.goc, embedding);
    if (!saved) {
      _setSubstatus('fe', 'Lưu không thành công, đang thử lại...', 'err');
      await new Promise(r => setTimeout(r, 1500));
      i--; continue;
    }

    _setSubstatus('fe', '✓ Đã ghi nhận (' + (i+1) + '/3)', 'ok');
    await new Promise(r => setTimeout(r, 700));
  }

  if (_enrollStream) { _stopCam(_enrollStream); _enrollStream = null; }
  _showEnrollDone();
}

async function _saveEnroll(goc, embedding) {
  try {
    const { data, error } = await supa.rpc('fn_face_enroll', {
      p_ma_nv: SESSION.ma, p_embedding: embedding, p_goc: goc,
      p_chat_luong: 0.9, p_device: navigator.userAgent.substring(0, 100)
    });
    if (error) throw error;
    if (!data || !data.ok) {
      if (typeof showToast === 'function') showToast('Lỗi: ' + (data && data.message), 'err');
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
      <div class="ns-face-success-stage">
        <div class="ns-face-icon-big success">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h3>Đăng ký thành công</h3>
        <p>Khuôn mặt của bạn đã được lưu. Từ giờ bạn có thể chấm công bằng cách quét gương mặt.</p>
        <button class="ns-face-btn-primary" onclick="nsFaceCloseEnrollment()">Hoàn tất</button>
      </div>
    </div>
  `;
  const lbl = document.getElementById('menu-face-status');
  if (lbl) { lbl.textContent = '✓ Đã đăng ký'; lbl.style.color = '#0F6E56'; }
}

// ═════════════════════════════════════════════════════════════════════════
// FLOW 2: VERIFY (chấm công)
// ═════════════════════════════════════════════════════════════════════════
let _verifyAbort = { aborted: false };
let _verifyStream = null;
let _verifyCallback = { onSuccess: null, onFail: null };

async function nsFaceStartChamCong(onSuccess, onFail) {
  _verifyCallback = { onSuccess, onFail };

  let enrolled = false;
  try {
    const { data } = await supa.rpc('fn_face_enroll_status', { p_ma_nv: SESSION.ma });
    enrolled = data && data.completed;
  } catch (e) {}

  if (!enrolled) {
    if (window.confirm('Bạn chưa đăng ký khuôn mặt.\n\nĐăng ký ngay?\nHủy: chấm công bằng ảnh tay.')) {
      nsFaceOpenEnrollment();
    } else {
      if (onFail) onFail({ reason: 'no_enroll', fallback: true });
    }
    return;
  }

  _verifyAbort = { aborted: false };
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
    <div class="ns-face-body" id="ns-face-verify-modal-body">
      <div class="ns-face-step active" id="fv-step"></div>
    </div>
  `;
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('open'));

  const step = document.getElementById('fv-step');
  _buildStage(step, 'fv');
  _setInstruction('fv', 'Đặt khuôn mặt vào khung');

  const ok = await nsFaceEnsureLoaded();
  if (!ok) { _setSubstatus('fv', 'Lỗi tải máy quét', 'err'); return; }

  const video = document.getElementById('fv-video');
  try {
    _verifyStream = await _openCam(video);
    if (video.paused) _setInstruction('fv', 'Chạm vào vòng tròn để bật camera');
  } catch (e) {
    const isPerm = e && (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError' || /denied|permission/i.test(e.message || ''));
    if (isPerm) {
      _setInstruction('fv', 'Cần cấp quyền camera');
      _setSubstatus('fv', 'Vào Cài đặt cho phép camera, rồi bấm "Thử lại"', 'err');
    } else {
      _setInstruction('fv', 'Không mở được camera');
      _setSubstatus('fv', 'Bấm "Thử lại" hoặc chấm công bằng ảnh tay', 'err');
    }
    _addRetryBtn('fv', () => { _verifyAbort.aborted = true; setTimeout(() => nsFaceVerify(), 100); });
    _addFallbackBtn();
    return;
  }

  _runVerifyAttempt(video, 0);
}

async function _runVerifyAttempt(video, attempt) {
  if (_verifyAbort.aborted) return;
  if (attempt >= 3) {
    _setInstruction('fv', 'Đã thử 3 lần không thành công');
    _setSubstatus('fv', 'Bấm bên dưới để chấm công bằng ảnh tay', 'err');
    _addFallbackBtn();
    return;
  }

  _setInstruction('fv', attempt === 0 ? 'Đặt khuôn mặt vào khung' : 'Vui lòng thử lại');
  const embedding = await _smoothScan(video, 'fv', _verifyAbort);
  if (!embedding || _verifyAbort.aborted) return;

  _setSubstatus('fv', 'Đang xác thực...', 'ok');
  const result = await _submitVerify(embedding);

  if (result && result.passed) {
    const matchPct = result.match_pct !== undefined ? result.match_pct
                   : Math.round((1 - (result.distance || 0)) * 100);
    // [v13.14] Capture frame face thực TRƯỚC khi đóng modal — để lưu cùng ảnh xác minh
    const faceImageB64 = _captureFaceFrame(video);
    _showVerifySuccess(matchPct);
    _haptic([30, 50, 30, 50, 60]);
    const cb = _verifyCallback.onSuccess;
    setTimeout(() => {
      nsFaceCloseVerify();
      if (cb) cb({ match_pct: matchPct, distance: result.distance, faceImage: faceImageB64 });
    }, 1400);
  } else {
    const matchPct2 = result && result.match_pct !== undefined ? result.match_pct : '?';
    const needPct = result && result.threshold_pct ? result.threshold_pct : 70;
    _setInstruction('fv', 'Chưa đạt độ chính xác yêu cầu');
    _setSubstatus('fv', 'Tương đồng ' + matchPct2 + '% — cần tối thiểu ' + needPct + '%', 'err');
    _haptic([100, 50, 100]);
    await new Promise(r => setTimeout(r, 1500));
    _runVerifyAttempt(video, attempt + 1);
  }
}

function _showVerifySuccess(matchPct) {
  const body = document.getElementById('ns-face-verify-modal-body');
  if (!body) return;
  body.innerHTML = `
    <div class="ns-face-step active">
      <div class="ns-face-success-stage">
        <div class="ns-face-icon-big success">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h3>Xác thực thành công</h3>
        <p style="font-size:15px;margin-top:4px">Độ tương đồng <b style="color:#2BC084;font-size:18px">${matchPct}%</b></p>
        <p style="font-size:13px;color:rgba(255,255,255,0.6);margin-top:8px">Đang chuyển sang chấm công...</p>
      </div>
    </div>
  `;
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

// [v13.13] Nút "Thử lại" khi camera mở thất bại (không phải lỗi quyền)
function _addRetryBtn(prefix, onClick) {
  const modalId = prefix === 'fe' ? 'ns-face-modal-body' : 'ns-face-verify-modal-body';
  const body = document.getElementById(modalId);
  if (!body || body.querySelector('.ns-face-btn-retry')) return;
  const btn = document.createElement('button');
  btn.className = 'ns-face-btn-secondary ns-face-btn-retry';
  btn.textContent = '↻ Thử lại';
  btn.onclick = onClick;
  body.appendChild(btn);
}

function nsFaceCloseVerify() {
  _verifyAbort.aborted = true;
  if (_verifyStream) { _stopCam(_verifyStream); _verifyStream = null; }
  const m = document.getElementById('ns-face-verify-modal');
  if (m) { m.classList.remove('open'); setTimeout(() => m.remove(), 250); }
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
  const cfg = cfgRes.data || { enabled: false, threshold_pct: 70 };
  const thresholdPct = Math.round(cfg.threshold_pct || 70);
  const stats = statsRes.data || {};

  const modal = document.createElement('div');
  modal.id = 'ns-face-admin-modal';
  modal.className = 'ns-face-admin-modal';
  modal.innerHTML = `
    <div class="ns-fa-overlay" onclick="nsFaceCloseAdmin()"></div>
    <div class="ns-fa-sheet">
      <div class="ns-fa-handle"></div>
      <div class="ns-fa-header">
        <div class="ns-fa-title">Nhận diện khuôn mặt</div>
        <button class="ns-fa-close" onclick="nsFaceCloseAdmin()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="ns-fa-card ns-fa-toggle-card">
        <div class="ns-fa-toggle-info">
          <div class="ns-fa-toggle-label">Chấm công bằng khuôn mặt</div>
          <div class="ns-fa-toggle-sub">${cfg.enabled
            ? 'Đang hoạt động — nhân viên xác thực bằng quét gương mặt'
            : 'Đang tắt — nhân viên chấm công bằng ảnh chụp'}</div>
        </div>
        <button class="ns-fa-toggle ${cfg.enabled ? 'on' : ''}" onclick="nsFaceToggleChamcong(${!cfg.enabled})">
          <span class="ns-fa-toggle-dot"></span>
        </button>
      </div>

      <div class="ns-fa-card">
        <div class="ns-fa-section-label">Hoạt động 7 ngày qua</div>
        <div class="ns-fa-stats-grid">
          <div class="ns-fa-stat">
            <div class="ns-fa-stat-val">${stats.enrolled_nv || 0}<span class="ns-fa-stat-of">/${stats.total_nv || 0}</span></div>
            <div class="ns-fa-stat-lbl">Đã đăng ký</div>
            <div class="ns-fa-stat-pct">${stats.enroll_rate || 0}%</div>
          </div>
          <div class="ns-fa-stat">
            <div class="ns-fa-stat-val">${stats.total || 0}</div>
            <div class="ns-fa-stat-lbl">Lượt xác thực</div>
            <div class="ns-fa-stat-pct ${stats.pass_rate >= 80 ? 'good' : (stats.pass_rate >= 60 ? 'mid' : 'low')}">${stats.pass_rate || 0}% đạt</div>
          </div>
          <div class="ns-fa-stat">
            <div class="ns-fa-stat-val">${stats.avg_similarity ? Math.round(Number(stats.avg_similarity)) : '—'}<span class="ns-fa-stat-of">${stats.avg_similarity ? '%' : ''}</span></div>
            <div class="ns-fa-stat-lbl">Tương đồng TB</div>
          </div>
        </div>
      </div>

      <div class="ns-fa-card">
        <div class="ns-fa-section-label">Độ chính xác tối thiểu</div>
        <div class="ns-fa-threshold-display-row">
          <span class="ns-fa-threshold-big" id="ns-fa-threshold-display">${thresholdPct}</span>
          <span class="ns-fa-threshold-unit">%</span>
        </div>
        <div class="ns-fa-threshold-hint" id="ns-fa-threshold-hint">${_threshHint(thresholdPct)}</div>
        <input type="range" min="50" max="95" step="5" value="${thresholdPct}"
          id="ns-fa-threshold-slider" oninput="nsFaceThresholdPreview(this.value)" class="ns-fa-slider"/>
        <div class="ns-fa-slider-marks">
          <span>50% · Dễ</span>
          <span>70% · Khuyến nghị</span>
          <span>95% · Chặt</span>
        </div>
        <button class="ns-fa-btn-save" onclick="nsFaceSaveThreshold()">Lưu thay đổi</button>
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

function _threshHint(pct) {
  if (pct < 60) return 'Dễ vượt qua — phù hợp giai đoạn làm quen';
  if (pct < 70) return 'Cân bằng giữa tiện lợi và an toàn';
  if (pct < 80) return 'Khuyến nghị — an toàn cho vận hành';
  if (pct < 90) return 'Chặt — ánh sáng yếu có thể bị từ chối';
  return 'Rất chặt — chỉ điều kiện lý tưởng mới đạt';
}

function nsFaceThresholdPreview(val) {
  document.getElementById('ns-fa-threshold-display').textContent = val;
  document.getElementById('ns-fa-threshold-hint').textContent = _threshHint(parseInt(val, 10));
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
      lbl.textContent = newState ? 'BẬT' : 'TẮT';
      lbl.className = 'menu-badge-pill ' + (newState ? 'on' : 'off');
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
  const pct = parseInt(slider.value, 10);
  try {
    const { data, error } = await supa.rpc('fn_face_admin_set_threshold', {
      p_ma_admin: SESSION.ma, p_scope: 'global', p_threshold: pct, p_note: 'Admin tune'
    });
    if (error) throw error;
    if (!data || !data.ok) throw new Error(data && data.message);
    showToast('✓ Độ chính xác tối thiểu: ' + pct + '%', 'ok');
  } catch (err) {
    showToast('Lỗi: ' + err.message, 'err');
  }
}

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

// Globals
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
