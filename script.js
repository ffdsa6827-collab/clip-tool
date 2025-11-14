const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({ log: true });

const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const playerWrap = document.getElementById('playerWrap');
const video = document.getElementById('video');
const startInput = document.getElementById('start');
const endInput = document.getElementById('end');
const trimBtn = document.getElementById('trimBtn');
const progressEl = document.getElementById('progress');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const output = document.getElementById('output');
const downloadLink = document.getElementById('downloadLink');
const resultVideo = document.getElementById('resultVideo');

let currentFile = null;

fileInput.addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  currentFile = f;
  fileInfo.classList.remove('hidden');
  fileInfo.textContent = `الملف: ${f.name} — الحجم: ${(f.size/1024/1024).toFixed(2)} MB`;
  const url = URL.createObjectURL(f);
  video.src = url;
  playerWrap.classList.remove('hidden');

  // Attempt to set default end duration from video metadata after load
  video.addEventListener('loadedmetadata', () => {
    endInput.value = Math.min(video.duration.toFixed(2), 10);
  }, { once: true });
});

trimBtn.addEventListener('click', async () => {
  if (!currentFile) return alert('اختر ملف فيديو أولاً');
  const start = parseFloat(startInput.value) || 0;
  const end = parseFloat(endInput.value) || Math.min(start + 5, video.duration || start + 5);
  if (end <= start) return alert('حد النهاية يجب أن يكون أكبر من البداية');

  trimBtn.disabled = true;
  progressEl.classList.remove('hidden');
  progressBar.style.width = '0%';
  progressText.textContent = 'تحميل مكتبة ffmpeg...';

  if (!ffmpeg.isLoaded()) {
    await ffmpeg.load();
  }

  progressText.textContent = 'تحضير الملفات...';

  // write the file to FFmpeg FS
  ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(currentFile));

  progressText.textContent = 'تشغيل ffmpeg لقص المقطع...';

  // Use copy codec when possible for speed; if it fails, ffmpeg will error.
  const ss = formatTime(start);
  const to = formatTime(end);
  try {
    await ffmpeg.run('-i', 'input.mp4', '-ss', ss, '-to', to, '-c', 'copy', 'output.mp4');
  } catch (err) {
    // fallback to re-encode if copy fails
    console.warn('copy failed, retrying with re-encode', err);
    await ffmpeg.run('-i', 'input.mp4', '-ss', ss, '-to', to, '-c:v', 'libx264', '-c:a', 'aac', 'output.mp4');
  }

  progressText.textContent = 'استخراج الملف...';
  const data = ffmpeg.FS('readFile', 'output.mp4');
  const blob = new Blob([data.buffer], { type: 'video/mp4' });
  const url = URL.createObjectURL(blob);

  downloadLink.href = url;
  downloadLink.download = `clip_${Date.now()}.mp4`;
  resultVideo.src = url;

  output.classList.remove('hidden');
  progressText.textContent = 'تم الإنتهاء';
  progressBar.style.width = '100%';
  trimBtn.disabled = false;
});

// helper: convert seconds to hh:mm:ss.xxx
function formatTime(seconds) {
  const s = Number(seconds);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = (s % 60).toFixed(3);
  return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(6,'0')}`;
}