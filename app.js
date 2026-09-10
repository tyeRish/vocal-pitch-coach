// Vocal Pitch Coach - Main Application

const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Voice profiles
const voiceProfiles = {
  chester: {
    name: "Chester Bennington",
    description: "Dynamic range from deep lows to soaring highs. Perfect for emotional delivery.",
    lowestNote: { name: "E2", freq: 82.41 },
    highestNote: { name: "G4", freq: 392.00 },
    lowestHz: 82.41,
    highestHz: 392.00
  },
  freddie: {
    name: "Freddie Mercury",
    description: "Operatic range with powerful control. Perfect for theatrical performance.",
    lowestNote: { name: "F#2", freq: 92.50 },
    highestNote: { name: "A4", freq: 440.00 },
    lowestHz: 92.50,
    highestHz: 440.00
  }
};

// Training modes
const trainingModes = {
  sing: {
    name: "Singing",
    description: "Train your singing voice to match target notes with precision and control.",
    targetTolerance: 25, // cents
    volumeThreshold: 0.02
  },
  scream: {
    name: "Screaming",
    description: "Learn controlled vocal distortion and high-energy vocal production.",
    targetTolerance: 50, // More tolerance for screaming
    volumeThreshold: 0.1 // Higher volume required
  },
  mixed: {
    name: "Mixed Voice",
    description: "Blend chest and head voice for versatile vocal power and range extension.",
    targetTolerance: 35,
    volumeThreshold: 0.05
  }
};

let audioCtx;
let analyser;
let dataArray;
let isListening = false;
let currentMode = 'sing';
let currentTarget = null;

// Chart setup
let pitchChart;
let pitchHistory = [];
const maxHistoryPoints = 100;

// Statistics
let stats = {
  pitches: [],
  cents: [],
  startTime: null,
  onTargetCount: 0,
  totalSamples: 0,
  minPitch: Infinity,
  maxPitch: -Infinity
};

// Range detection
let rangeDetection = {
  isDetecting: false,
  lowestFreq: Infinity,
  highestFreq: -Infinity,
  startTime: null
};

const noteDisplay = document.getElementById('note-display');
const centsDisplay = document.getElementById('cents-display');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const detectRangeBtn = document.getElementById('detectRangeBtn');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');

// Initialize chart
function initChart() {
  const ctx = document.getElementById('pitchChart').getContext('2d');
  pitchChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Your Pitch',
          data: [],
          borderColor: '#00d4ff',
          backgroundColor: 'rgba(0, 212, 255, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 6
        },
        {
          label: 'Target Range',
          data: [],
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          borderDash: [5, 5]
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#a0aec0',
            font: { size: 12 },
            usePointStyle: true,
            padding: 20
          }
        },
        filler: {
          propagate: true
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          min: 50,
          max: 500,
          ticks: {
            color: '#a0aec0',
            callback: function(value) {
              return value + ' Hz';
            }
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.05)',
            drawBorder: false
          }
        },
        x: {
          ticks: {
            color: '#a0aec0'
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.05)',
            drawBorder: false
          }
        }
      }
    }
  });
}

// Mode selection
document.querySelectorAll('.mode-btn[data-mode]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn[data-mode]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMode = btn.dataset.mode;
    
    const modeDesc = document.getElementById('mode-description');
    modeDesc.textContent = trainingModes[currentMode].description;
  });
});

// Target voice selection
document.querySelectorAll('.mode-btn[data-target]').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.target;
    currentTarget = target;
    
    if (target === 'chester' || target === 'freddie') {
      const profile = voiceProfiles[target];
      updateTargetDisplay(profile.lowestHz, profile.highestHz, profile.name);
    }
  });
});

// Start/Stop listening
startBtn.addEventListener('click', startListening);
stopBtn.addEventListener('click', stopListening);
detectRangeBtn.addEventListener('click', startRangeDetection);

async function startListening() {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0.85;
    source.connect(analyser);
    dataArray = new Float32Array(analyser.fftSize);
    
    isListening = true;
    startBtn.style.display = 'none';
    stopBtn.style.display = 'flex';
    statusIndicator.classList.add('active');
    statusText.textContent = 'Listening...';
    
    stats.startTime = Date.now();
    stats.pitches = [];
    stats.cents = [];
    stats.onTargetCount = 0;
    stats.totalSamples = 0;
    
    updatePitch();
  } catch (err) {
    alert('Microphone access denied. Please allow microphone access to use this app.');
    console.error(err);
  }
}

function stopListening() {
  isListening = false;
  if (audioCtx) {
    audioCtx.close();
  }
  startBtn.style.display = 'flex';
  stopBtn.style.display = 'none';
  statusIndicator.classList.remove('active');
  statusText.textContent = 'Stopped';
}

async function startRangeDetection() {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0.85;
    source.connect(analyser);
    dataArray = new Float32Array(analyser.fftSize);
    
    rangeDetection.isDetecting = true;
    rangeDetection.lowestFreq = Infinity;
    rangeDetection.highestFreq = -Infinity;
    rangeDetection.startTime = Date.now();
    
    detectRangeBtn.textContent = '⏸️ Detecting Range... (30s)';
    detectRangeBtn.disabled = true;
    
    setTimeout(() => {
      finishRangeDetection();
    }, 30000);
    
    detectRange();
  } catch (err) {
    alert('Microphone access denied.');
    console.error(err);
  }
}

function detectRange() {
  if (!rangeDetection.isDetecting) return;
  
  analyser.getFloatTimeDomainData(dataArray);
  const frequency = autoCorrelate(dataArray, audioCtx.sampleRate);
  
  if (frequency > 0) {
    rangeDetection.lowestFreq = Math.min(rangeDetection.lowestFreq, frequency);
    rangeDetection.highestFreq = Math.max(rangeDetection.highestFreq, frequency);
  }
  
  requestAnimationFrame(detectRange);
}

function finishRangeDetection() {
  rangeDetection.isDetecting = false;
  
  if (audioCtx) {
    audioCtx.close();
  }
  
  detectRangeBtn.textContent = '🎯 Detect My Range';
  detectRangeBtn.disabled = false;
  
  if (rangeDetection.lowestFreq === Infinity || rangeDetection.highestFreq === -Infinity) {
    alert('Could not detect range. Please try again and make sure to sing your lowest and highest notes.');
    return;
  }
  
  const lowestNote = frequencyToNote(rangeDetection.lowestFreq);
  const highestNote = frequencyToNote(rangeDetection.highestFreq);
  const octaves = ((Math.log2(rangeDetection.highestFreq / rangeDetection.lowestFreq) * 12) / 12).toFixed(2);
  const voiceType = getVoiceType(rangeDetection.lowestFreq, rangeDetection.highestFreq);
  
  document.getElementById('lowestNote').textContent = lowestNote.name;
  document.getElementById('highestNote').textContent = highestNote.name;
  document.getElementById('rangeOctaves').textContent = octaves;
  document.getElementById('voiceType').textContent = voiceType;
  document.getElementById('range-section').classList.remove('hidden');
}

function getVoiceType(lowestFreq, highestFreq) {
  // Male ranges
  if (lowestFreq < 100 && highestFreq < 350) return 'Bass';
  if (lowestFreq < 110 && highestFreq < 400) return 'Baritone';
  if (lowestFreq > 100 && highestFreq > 300 && highestFreq < 500) return 'Tenor';
  
  // Female ranges
  if (highestFreq > 400 && highestFreq < 600) return 'Contralto';
  if (highestFreq > 500 && highestFreq < 700) return 'Mezzo-Soprano';
  if (highestFreq > 600) return 'Soprano';
  
  return 'Unknown';
}

function updatePitch() {
  if (!isListening) return;
  
  analyser.getFloatTimeDomainData(dataArray);
  const frequency = autoCorrelate(dataArray, audioCtx.sampleRate);
  const rms = getRMS(dataArray);
  
  if (frequency > 0 && rms > trainingModes[currentMode].volumeThreshold) {
    const noteInfo = frequencyToNote(frequency);
    const noteNum = 12 * (Math.log2(frequency / 440)) + 69;
    const cents = ((noteNum - Math.round(noteNum)) * 100).toFixed(1);
    
    noteDisplay.innerText = noteInfo.name;
    centsDisplay.innerText = `${cents > 0 ? '+' : ''}${cents} cents`;
    
    // Update position
    const pos = 50 + (parseFloat(cents) / 50);
    document.getElementById('bar').style.left = `${Math.max(5, Math.min(95, pos))}%`;
    
    // Update accuracy
    const accuracy = Math.max(0, 100 - Math.abs(cents));
    document.getElementById('accuracy').textContent = accuracy.toFixed(0) + '%';
    document.getElementById('frequency').textContent = frequency.toFixed(1) + ' Hz';
    document.getElementById('volume').textContent = (20 * Math.log10(rms)).toFixed(1) + ' dB';
    
    // Color coding
    if (Math.abs(cents) < trainingModes[currentMode].targetTolerance) {
      noteDisplay.className = 'in-key';
      stats.onTargetCount++;
    } else {
      noteDisplay.className = 'off-key';
    }
    
    stats.totalSamples++;
    stats.pitches.push(frequency);
    stats.cents.push(parseFloat(cents));
    stats.minPitch = Math.min(stats.minPitch, frequency);
    stats.maxPitch = Math.max(stats.maxPitch, frequency);
    
    // Calculate stability
    if (stats.pitches.length > 10) {
      const recentPitches = stats.pitches.slice(-10);
      const avg = recentPitches.reduce((a, b) => a + b) / recentPitches.length;
      const variance = recentPitches.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) / recentPitches.length;
      const stability = Math.max(0, 100 - Math.sqrt(variance));
      document.getElementById('stability').textContent = Math.min(100, stability).toFixed(0) + '%';
    }
    
    // Update chart
    updateChartData(frequency);
  } else {
    noteDisplay.innerText = '--';
    centsDisplay.innerText = '0 cents';
    document.getElementById('bar').style.left = '50%';
    noteDisplay.className = '';
  }
  
  requestAnimationFrame(updatePitch);
}

function updateChartData(frequency) {
  if (pitchHistory.length >= maxHistoryPoints) {
    pitchHistory.shift();
    pitchChart.data.labels.shift();
    pitchChart.data.datasets[0].data.shift();
  }
  
  pitchHistory.push(frequency);
  pitchChart.data.labels.push('');
  pitchChart.data.datasets[0].data.push(frequency);
  
  // Update target range line if available
  if (currentTarget) {
    const profile = voiceProfiles[currentTarget];
    const midpoint = (profile.lowestHz + profile.highestHz) / 2;
    pitchChart.data.datasets[1].data.push(midpoint);
  }
  
  pitchChart.update('none');
}

function updateTargetDisplay(lowestHz, highestHz, name) {
  document.getElementById('targetLow').textContent = frequencyToNote(lowestHz).name;
  document.getElementById('targetHigh').textContent = frequencyToNote(highestHz).name;
}

function autoCorrelate(buf, sampleRate) {
  let SIZE = buf.length;
  let rms = getRMS(buf);
  
  if (rms < 0.01) return -1;
  
  let r1 = 0, r2 = SIZE - 1, thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buf[i]) < thres) {
      r1 = i;
      break;
    }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buf[SIZE - i]) < thres) {
      r2 = SIZE - i;
      break;
    }
  }
  
  buf = buf.slice(r1, r2);
  SIZE = buf.length;
  
  let c = new Array(SIZE).fill(0);
  for (let i = 0; i < SIZE; i++) {
    for (let j = 0; j < SIZE - i; j++) {
      c[i] = c[i] + buf[j] * buf[j + i];
    }
  }
  
  let d = 0;
  while (d < SIZE - 1 && c[d] > c[d + 1]) d++;
  
  let maxval = -1, maxpos = -1;
  for (let i = d; i < SIZE; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }
  
  let T0 = maxpos;
  return sampleRate / T0;
}

function getRMS(buf) {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    sum += buf[i] * buf[i];
  }
  return Math.sqrt(sum / buf.length);
}

function frequencyToNote(frequency) {
  const A4 = 440;
  const C0 = A4 * Math.pow(2, -4.75);
  const h = 12 * Math.log2(frequency / C0);
  const octave = Math.floor(h / 12);
  const n = Math.round(h % 12);
  return {
    name: notes[n] + octave,
    frequency: frequency
  };
}

// Initialize
window.addEventListener('load', () => {
  initChart();
  updateTargetDisplay(82.41, 392, 'Chester Bennington');
  currentTarget = 'chester';
});