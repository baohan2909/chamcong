/* ════════════════════════════════════════════════════════════════════════════
 *  Nón Sơn — Face Recognition Module v12.0
 *
 *  Stack:
 *   - MediaPipe Face Landmarker (Google, WASM) — detect face + landmarks
 *   - face-api.js (TensorFlow.js) — extract 128-dim embedding
 *   - Liveness: detect blink qua landmark eye aspect ratio (EAR)
 *
 *  Models loaded from CDN (cached by SW):
 *   - face-api.js tiny_face_detector + face_landmark_68 + face_recognition
 *  ──────────────────────────────────────────────────────────────────────── */

const NS_FACE = {
  // CDN URLs (jsdelivr ổn định cho production)
  FACEAPI_SCRIPT: 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js',
  MODELS_URL: 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model/',
  // EAR threshold cho blink detection
  EAR_THRESHOLD: 0.21,
  BLINK_REQUIRED: 2,        // chớp mắt 2 lần để pass liveness
  // Embedding quality
  MIN_FACE_SIZE: 100,        // px, face nhỏ hơn → reject
  MAX_DETECTION_ATTEMPTS: 30 // ~3s ở 10fps
};

let _faceLoaded = false;
let _faceLoading = false;

// ─── Load face-api.js + models (lazy, 1 lần) ─────────────────────────────
async function nsFaceEnsureLoaded() {
  if (_faceLoaded) return true;
  if (_faceLoading) {
    // Wait for ongoing load
    while (_faceLoading) await new Promise(r => setTimeout(r, 100));
    return _faceLoaded;
  }
  _faceLoading = true;

  try {
    // 1. Load script if not present
    if (typeof faceapi === 'undefined') {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = NS_FACE.FACEAPI_SCRIPT;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    // 2. Load models
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(NS_FACE.MODELS_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(NS_FACE.MODELS_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(NS_FACE.MODELS_URL)
    ]);

    _faceLoaded = true;
    return true;
  } catch (e) {
    console.error('Face module load failed:', e);
    return false;
  } finally {
    _faceLoading = false;
  }
}

// ─── Open camera stream ──────────────────────────────────────────────────
async function nsFaceOpenCamera(videoEl) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: 'user',
      width: { ideal: 640 },
      height: { ideal: 480 }
    },
    audio: false
  });
  videoEl.srcObject = stream;
  await new Promise(r => videoEl.onloadedmetadata = r);
  await videoEl.play();
  return stream;
}

function nsFaceStopCamera(stream) {
  if (stream) stream.getTracks().forEach(t => t.stop());
}

// ─── Detect single face + landmarks + embedding ──────────────────────────
async function nsFaceDetect(videoEl) {
  if (!_faceLoaded) return null;
  const opts = new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.5
  });
  const result = await faceapi
    .detectSingleFace(videoEl, opts)
    .withFaceLandmarks()
    .withFaceDescriptor();
  if (!result) return null;

  // Check face size
  const box = result.detection.box;
  if (box.width < NS_FACE.MIN_FACE_SIZE) {
    return { tooSmall: true };
  }

  // Check multi-face (detect all + filter)
  const allFaces = await faceapi.detectAllFaces(videoEl, opts);
  if (allFaces.length > 1) {
    return { multiFace: true };
  }

  return {
    box: { x: box.x, y: box.y, width: box.width, height: box.height },
    landmarks: result.landmarks.positions,
    embedding: Array.from(result.descriptor),  // 128-dim Float32Array → Array
    score: result.detection.score
  };
}

// ─── Eye Aspect Ratio (EAR) cho blink detection ──────────────────────────
function _nsFaceEAR(eyePoints) {
  // eyePoints: 6 landmarks
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const v1 = dist(eyePoints[1], eyePoints[5]);
  const v2 = dist(eyePoints[2], eyePoints[4]);
  const h = dist(eyePoints[0], eyePoints[3]);
  return (v1 + v2) / (2 * h);
}

function nsFaceCheckBlink(landmarks) {
  if (!landmarks || landmarks.length < 68) return null;
  // face-api 68 landmarks: left eye 36-41, right eye 42-47
  const leftEye = landmarks.slice(36, 42);
  const rightEye = landmarks.slice(42, 48);
  const leftEAR = _nsFaceEAR(leftEye);
  const rightEAR = _nsFaceEAR(rightEye);
  return (leftEAR + rightEAR) / 2;
}

// ─── Average multiple embeddings (3 góc → 1 robust embedding) ────────────
function nsFaceAverageEmbedding(embeddings) {
  if (!embeddings || embeddings.length === 0) return null;
  const dim = embeddings[0].length;
  const avg = new Array(dim).fill(0);
  embeddings.forEach(emb => {
    for (let i = 0; i < dim; i++) avg[i] += emb[i];
  });
  for (let i = 0; i < dim; i++) avg[i] /= embeddings.length;
  // Normalize (L2)
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += avg[i] * avg[i];
  norm = Math.sqrt(norm);
  if (norm > 0) for (let i = 0; i < dim; i++) avg[i] /= norm;
  return avg;
}

// ═════════════════════════════════════════════════════════════════════════
// FLOW 1: ĐĂNG KÝ KHUÔN MẶT (NV mở từ Tài khoản)
// ═════════════════════════════════════════════════════════════════════════
async function nsFaceOpenEnrollment() {
  // Tạo modal full screen
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
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11h-6"/><path d="M19 8v6"/></svg>
        </div>
        <h3>Quét khuôn mặt để chấm công nhanh</h3>
        <p>Bạn sẽ chụp 3 góc: chính diện, hơi nghiêng trái, hơi nghiêng phải. Sau đó dùng để chấm công tự động.</p>
        <div class="ns-face-privacy">
          <b>Bảo mật:</b> Hệ thống chỉ lưu vector số đặc trưng khuôn mặt (KHÔNG lưu ảnh gốc). Bạn có thể xóa bất kỳ lúc nào.
        </div>
        <button class="ns-face-btn-primary" onclick="nsFaceEnrollNext('intro','capture')">Bắt đầu</button>
      </div>

      <div id="ns-face-step-capture" class="ns-face-step">
        <div class="ns-face-video-wrap">
          <video id="ns-face-video" autoplay muted playsinline></video>
          <div class="ns-face-frame" id="ns-face-frame"></div>
          <div class="ns-face-status" id="ns-face-status">Đặt mặt vào khung</div>
        </div>
        <div class="ns-face-progress">
          <div class="ns-face-dot ${''}" data-goc="thang">Thẳng</div>
          <div class="ns-face-dot" data-goc="trai">Trái</div>
          <div class="ns-face-dot" data-goc="phai">Phải</div>
        </div>
        <div class="ns-face-instruction" id="ns-face-instruction">Nhìn thẳng + chớp mắt 2 lần</div>
        <button class="ns-face-btn-primary" id="ns-face-capture-btn" onclick="nsFaceCaptureNow()" disabled>Đang nhận diện...</button>
      </div>

      <div id="ns-face-step-done" class="ns-face-step">
        <div class="ns-face-icon-big success">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h3>Đăng ký thành công</h3>
        <p>Từ giờ bạn có thể chấm công bằng cách quét khuôn mặt.</p>
        <button class="ns-face-btn-primary" onclick="nsFaceCloseEnrollment()">Hoàn tất</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('open'));
}

function nsFaceCloseEnrollment() {
  const modal = document.getElementById('ns-face-modal');
  if (!modal) return;
  // Cleanup stream
  const video = modal.querySelector('video');
  if (video && video.srcObject) {
    video.srcObject.getTracks().forEach(t => t.stop());
  }
  modal.classList.remove('open');
  setTimeout(() => modal.remove(), 250);
}

let _enrollState = null;

async function nsFaceEnrollNext(from, to) {
  if (from === 'intro' && to === 'capture') {
    document.getElementById('ns-face-step-intro').classList.remove('active');
    document.getElementById('ns-face-step-capture').classList.add('active');

    // Init state
    _enrollState = {
      step: 0,                              // 0=thẳng, 1=trái, 2=phải
      gocList: ['thang','trai','phai'],
      embeddings: [],
      stream: null,
      detecting: false,
      blinkCount: 0,
      lastEAR: 1.0
    };

    // Load face-api + open camera
    updateStatus('Đang tải nhận diện...');
    const ok = await nsFaceEnsureLoaded();
    if (!ok) {
      updateStatus('Lỗi tải module nhận diện. Vui lòng thử lại.');
      return;
    }

    const video = document.getElementById('ns-face-video');
    try {
      _enrollState.stream = await nsFaceOpenCamera(video);
    } catch (e) {
      updateStatus('Cần cấp quyền camera để tiếp tục.');
      return;
    }

    updateStatus('Đặt mặt vào khung + chớp mắt 2 lần');
    startDetectionLoop(video);
  }
}

function updateStatus(text) {
  const el = document.getElementById('ns-face-status');
  if (el) el.textContent = text;
}

function updateInstruction(text) {
  const el = document.getElementById('ns-face-instruction');
  if (el) el.textContent = text;
}

function updateDots() {
  if (!_enrollState) return;
  const dots = document.querySelectorAll('.ns-face-dot');
  dots.forEach((d, i) => {
    d.classList.remove('active', 'done');
    if (i < _enrollState.step) d.classList.add('done');
    else if (i === _enrollState.step) d.classList.add('active');
  });
}

async function startDetectionLoop(video) {
  updateDots();
  const gocName = ['Nhìn thẳng', 'Hơi nghiêng trái', 'Hơi nghiêng phải'];
  updateInstruction(gocName[_enrollState.step] + ' + chớp mắt 2 lần');

  const captureBtn = document.getElementById('ns-face-capture-btn');
  captureBtn.disabled = true;
  captureBtn.textContent = 'Đang nhận diện...';

  let lastEmbedding = null;

  while (_enrollState && _enrollState.step < 3) {
    if (!_enrollState.stream) break;
    const res = await nsFaceDetect(video);

    if (!res) {
      updateStatus('Không thấy mặt');
    } else if (res.tooSmall) {
      updateStatus('Đưa mặt gần hơn');
    } else if (res.multiFace) {
      updateStatus('Phát hiện nhiều người, chỉ cần 1');
    } else {
      // Detect blink
      const ear = nsFaceCheckBlink(res.landmarks);
      if (ear !== null) {
        // Detect transition: open → close → open
        if (_enrollState.lastEAR > NS_FACE.EAR_THRESHOLD && ear < NS_FACE.EAR_THRESHOLD) {
          // Eye just closed
        } else if (_enrollState.lastEAR < NS_FACE.EAR_THRESHOLD && ear > NS_FACE.EAR_THRESHOLD) {
          // Eye just opened → count blink
          _enrollState.blinkCount++;
          updateStatus('Đã chớp mắt: ' + _enrollState.blinkCount + '/' + NS_FACE.BLINK_REQUIRED);
        }
        _enrollState.lastEAR = ear;
      }

      if (_enrollState.blinkCount >= NS_FACE.BLINK_REQUIRED) {
        lastEmbedding = res.embedding;
        captureBtn.disabled = false;
        captureBtn.textContent = 'Lưu góc ' + gocName[_enrollState.step].toLowerCase();
        updateStatus('✓ Sẵn sàng chụp');
      } else {
        updateStatus('Chớp mắt: ' + _enrollState.blinkCount + '/' + NS_FACE.BLINK_REQUIRED);
        captureBtn.disabled = true;
      }
    }

    // Store latest detection for capture button
    _enrollState._latestEmbedding = lastEmbedding;
    await new Promise(r => setTimeout(r, 100));  // ~10 fps
  }
}

async function nsFaceCaptureNow() {
  if (!_enrollState || !_enrollState._latestEmbedding) return;
  const emb = _enrollState._latestEmbedding;
  const goc = _enrollState.gocList[_enrollState.step];

  // Submit to Supabase
  try {
    const { data, error } = await supa.rpc('fn_face_enroll', {
      p_ma_nv: SESSION.ma,
      p_embedding: emb,
      p_goc: goc,
      p_chat_luong: 0.85,
      p_device: navigator.userAgent.substring(0, 100)
    });
    if (error) throw error;
    if (!data || !data.ok) throw new Error(data && data.message || 'Lỗi');

    _enrollState.embeddings.push(emb);
    _enrollState.step++;
    _enrollState.blinkCount = 0;
    _enrollState._latestEmbedding = null;

    if (_enrollState.step >= 3) {
      // Done
      nsFaceStopCamera(_enrollState.stream);
      _enrollState.stream = null;
      document.getElementById('ns-face-step-capture').classList.remove('active');
      document.getElementById('ns-face-step-done').classList.add('active');
    }
  } catch (err) {
    updateStatus('Lỗi: ' + (err.message || 'network'));
  }
}

// ═════════════════════════════════════════════════════════════════════════
// FLOW 2: CHẤM CÔNG BẰNG FACE
// ═════════════════════════════════════════════════════════════════════════
async function nsFaceStartChamCong(onSuccess, onFail) {
  // Check NV đã đăng ký chưa
  try {
    const { data } = await supa.rpc('fn_face_enroll_status', { p_ma_nv: SESSION.ma });
    if (!data || !data.completed) {
      // Chưa đăng ký → mở enroll
      if (confirm('Bạn chưa đăng ký khuôn mặt. Đăng ký ngay?\n\n(Bạn vẫn có thể chấm công cách cũ nếu chọn Hủy)')) {
        nsFaceOpenEnrollment();
      } else {
        if (onFail) onFail({ reason: 'no_enroll', fallback: true });
      }
      return;
    }
  } catch (e) {
    if (onFail) onFail({ reason: 'check_error', fallback: true });
    return;
  }

  // Mở modal verify
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
      <div class="ns-face-title">Quét khuôn mặt</div>
    </div>
    <div class="ns-face-body">
      <div class="ns-face-step active">
        <div class="ns-face-video-wrap large">
          <video id="ns-face-verify-video" autoplay muted playsinline></video>
          <div class="ns-face-frame" id="ns-face-verify-frame"></div>
          <div class="ns-face-status" id="ns-face-verify-status">Đang tải...</div>
        </div>
        <div class="ns-face-instruction" id="ns-face-verify-instruction">Đặt mặt vào khung, chớp mắt 2 lần</div>
        <div class="ns-face-attempts" id="ns-face-verify-attempts"></div>
        <button class="ns-face-btn-secondary" onclick="nsFaceFallbackChamCong()" id="ns-face-fallback-btn" style="display:none">Chấm công bằng ảnh tay (cách cũ)</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('open'));

  // Save callbacks
  modal._onSuccess = onSuccess;
  modal._onFail = onFail;
  modal._attempts = 0;

  // Load + start
  const ok = await nsFaceEnsureLoaded();
  if (!ok) {
    document.getElementById('ns-face-verify-status').textContent = 'Lỗi tải module';
    return;
  }
  const video = document.getElementById('ns-face-verify-video');
  let stream;
  try {
    stream = await nsFaceOpenCamera(video);
  } catch (e) {
    document.getElementById('ns-face-verify-status').textContent = 'Cần cấp quyền camera';
    return;
  }
  modal._stream = stream;
  startVerifyLoop(video, modal);
}

async function startVerifyLoop(video, modal) {
  let blinkCount = 0;
  let lastEAR = 1.0;
  let verifying = false;

  while (modal.isConnected && !verifying) {
    if (!modal._stream) break;
    const res = await nsFaceDetect(video);
    if (!res) {
      setVerifyStatus('Không thấy mặt');
    } else if (res.tooSmall) {
      setVerifyStatus('Đưa mặt gần hơn');
    } else if (res.multiFace) {
      setVerifyStatus('Phát hiện nhiều người');
    } else {
      const ear = nsFaceCheckBlink(res.landmarks);
      if (ear !== null) {
        if (lastEAR < NS_FACE.EAR_THRESHOLD && ear > NS_FACE.EAR_THRESHOLD) {
          blinkCount++;
        }
        lastEAR = ear;
      }
      if (blinkCount >= NS_FACE.BLINK_REQUIRED) {
        verifying = true;
        setVerifyStatus('Đang xác minh...');
        // Submit
        await doVerify(res.embedding, modal);
        break;
      } else {
        setVerifyStatus('Chớp mắt: ' + blinkCount + '/' + NS_FACE.BLINK_REQUIRED);
      }
    }
    await new Promise(r => setTimeout(r, 100));
  }
}

function setVerifyStatus(txt) {
  const el = document.getElementById('ns-face-verify-status');
  if (el) el.textContent = txt;
}

async function doVerify(embedding, modal) {
  try {
    const { data, error } = await supa.rpc('fn_face_verify', {
      p_ma_nv: SESSION.ma,
      p_embedding: embedding,
      p_device: navigator.userAgent.substring(0, 100)
    });
    if (error) throw error;
    if (data && data.passed) {
      // ✓ PASS → cleanup + call onSuccess
      setVerifyStatus('✓ Xác minh thành công');
      nsFaceStopCamera(modal._stream);
      if (modal._onSuccess) modal._onSuccess({ similarity: data.similarity });
      setTimeout(() => nsFaceCloseVerify(), 800);
    } else {
      // FAIL
      modal._attempts = (modal._attempts || 0) + 1;
      const attemptsEl = document.getElementById('ns-face-verify-attempts');
      if (attemptsEl) attemptsEl.textContent = 'Thử lần ' + modal._attempts + '/3';
      setVerifyStatus('✗ Không khớp. Thử lại');

      if (modal._attempts >= 3) {
        // Hiện fallback button
        const fb = document.getElementById('ns-face-fallback-btn');
        if (fb) fb.style.display = '';
      } else {
        // Thử lại
        const video = document.getElementById('ns-face-verify-video');
        setTimeout(() => startVerifyLoop(video, modal), 1500);
      }
    }
  } catch (err) {
    setVerifyStatus('Lỗi: ' + (err.message || 'network'));
  }
}

function nsFaceCloseVerify() {
  const modal = document.getElementById('ns-face-verify-modal');
  if (!modal) return;
  if (modal._stream) modal._stream.getTracks().forEach(t => t.stop());
  modal.classList.remove('open');
  setTimeout(() => modal.remove(), 250);
}

function nsFaceFallbackChamCong() {
  const modal = document.getElementById('ns-face-verify-modal');
  if (!modal) return;
  if (modal._onFail) modal._onFail({ reason: 'low_sim', fallback: true });
  nsFaceCloseVerify();
}

// ─── Expose globals ────────────────────────────────────────────────────────
window.nsFaceOpenEnrollment = nsFaceOpenEnrollment;
window.nsFaceCloseEnrollment = nsFaceCloseEnrollment;
window.nsFaceEnrollNext = nsFaceEnrollNext;
window.nsFaceCaptureNow = nsFaceCaptureNow;
window.nsFaceStartChamCong = nsFaceStartChamCong;
window.nsFaceCloseVerify = nsFaceCloseVerify;
window.nsFaceFallbackChamCong = nsFaceFallbackChamCong;
