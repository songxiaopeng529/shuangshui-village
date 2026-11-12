import './style.css';
import * as THREE from 'three';
import { createVillage } from './scene.js';
import { landmarks, tourStops, notes } from './data.js';

const $ = (selector) => document.querySelector(selector);
const icons = {
  overview: '<path d="m3 10 9-6 9 6-9 6-9-6Z"/><path d="m3 14 9 6 9-6M3 6l9 6 9-6"/>',
  sun: '<path d="M4 20v-9a8 8 0 0 1 16 0v9M8 20v-8a4 4 0 0 1 8 0v8M3 20h18"/>',
  tian: '<path d="M3 20v-8a5 5 0 0 1 10 0v8M11 20v-6a5 5 0 0 1 10 0v6M6 20v-6a2 2 0 0 1 4 0v6M15 20v-4a2 2 0 0 1 4 0v4"/>',
  tianfu: '<path d="M4 21V8h16v13M2 8h20M7 8V4h10v4M9 21v-7a3 3 0 0 1 6 0v7M3 21h18"/>',
  dongla: '<path d="M3 7c3-3 5 3 9 0s6 3 9 0M3 12c3-3 5 3 9 0s6 3 9 0M3 17c3-3 5 3 9 0s6 3 9 0"/>',
  miao: '<path d="M12 21V9M12 13 7 8M12 11l5-5"/><path d="M5 12C2 8 5 4 9 6c1-5 7-5 8 0 5-1 6 5 2 7-4 2-11 2-14-1Z"/>',
  kuyan: '<path d="M4 18h16M6 18v-4m12 4v-4M4 14c3-3 5 3 8 0s5 3 8 0M7 10l3-5m4 5 3-5"/>',
  jin: '<path d="M3 20v-7a5 5 0 0 1 10 0v7M11 20v-9a5 5 0 0 1 10 0v9M6 20v-5a2 2 0 0 1 4 0v5M15 20v-7a2 2 0 0 1 4 0v7"/>',
  school: '<path d="m3 9 9-5 9 5-9 5-9-5ZM6 11v6c4 3 8 3 12 0v-6M21 9v7"/>',
  shigejie: '<path d="M5 21 9 3m6 18 4-18M3 15h18M5 8h15"/>',
};
const svgIcon = (id) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[id] || icons.overview}</svg>`;

const dockIds = ['overview', 'sun', 'tian', 'tianfu', 'dongla', 'miao', 'kuyan', 'jin', 'school'];
const dock = $('#landmark-dock');
dock.innerHTML = dockIds.map((id) => {
  const item = landmarks.find((landmark) => landmark.id === id);
  return `<button class="landmark-tab ${id === 'overview' ? 'active' : ''}" data-place="${id}" aria-label="查看${item.name}">${svgIcon(id)}<span>${item.short}</span><i></i></button>`;
}).join('');

const labelLayer = $('#landmark-labels');
const labelItems = landmarks.filter((item) => !['overview', 'sun'].includes(item.id));
labelLayer.innerHTML = labelItems.map((item) => `<button class="map-label ${item.id === 'shigejie' ? 'distant-label' : ''}" data-label="${item.id}" aria-label="前往${item.name}"><i></i><span>${item.name}</span><small>${item.id === 'shigejie' ? '村外' : ''}</small></button>`).join('');

let selectedId = 'overview';
let sceneApi;
let tourActive = false;
let tourIndex = 0;
let tourTimer;
let soundActive = false;
let audioContext;
let audioGain;

function selectPlace(id, fromScene = false) {
  const item = landmarks.find((landmark) => landmark.id === id);
  if (!item) return;
  if (tourActive && !fromScene) stopTour();
  if (tourActive && fromScene === 'tour') {
    // Guided navigation owns the timer until it is stopped.
  } else if (tourActive && fromScene) {
    stopTour();
  }
  selectedId = id;
  sceneApi?.focus(item);
  $('#place-title').innerHTML = item.title;
  $('#place-kicker').textContent = item.kicker;
  $('#place-description').textContent = item.description;
  $('#place-detail').innerHTML = item.facts.map((fact, index) => `<span><i class="detail-icon ${['river-icon', 'cave-icon', 'field-icon'][index]}"></i>${fact}</span>`).join('');
  $('#intro-panel').classList.toggle('is-focused', id !== 'overview');
  document.querySelectorAll('[data-place]').forEach((button) => {
    const active = button.dataset.place === id || (id === 'shigejie' && button.dataset.place === 'overview');
    button.classList.toggle('active', active);
    button.setAttribute('aria-current', active ? 'location' : 'false');
  });
  document.querySelectorAll('[data-label]').forEach((button) => button.classList.toggle('selected', button.dataset.label === id));
  $('#dock-title').textContent = id === 'overview' ? '循着村落，慢慢走' : item.type;
  if (id !== 'overview') {
    $('#tour-button-text').textContent = '沿着少平的路走一遍';
  }
}

dock.addEventListener('click', (event) => {
  const button = event.target.closest('[data-place]');
  if (button) selectPlace(button.dataset.place);
});
labelLayer.addEventListener('click', (event) => {
  const button = event.target.closest('[data-label]');
  if (button) selectPlace(button.dataset.label);
});
$('#brand-home').addEventListener('click', (event) => { event.preventDefault(); stopTour(); selectPlace('overview'); });
$('#back-overview').addEventListener('click', () => { stopTour(); selectPlace('overview'); });
$('#reset-view').addEventListener('click', () => { stopTour(); selectPlace('overview'); });
$('#zoom-in').addEventListener('click', () => sceneApi?.zoom(0.8));
$('#zoom-out').addEventListener('click', () => sceneApi?.zoom(1.25));
$('#toggle-labels').addEventListener('click', () => {
  const hidden = labelLayer.classList.toggle('labels-hidden');
  $('#toggle-labels').classList.toggle('active', !hidden);
  $('#toggle-labels').setAttribute('aria-label', hidden ? '显示地标' : '隐藏地标');
  sceneApi?.setLabelsVisible(!hidden);
});
$('#fullscreen').addEventListener('click', async () => {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch {
    $('#fullscreen').title = '当前浏览器不支持全屏显示';
  }
});

document.addEventListener('fullscreenchange', () => {
  $('#fullscreen').classList.toggle('active', Boolean(document.fullscreenElement));
});

$('#time-slider').addEventListener('input', (event) => {
  const value = Number(event.target.value);
  sceneApi?.setTime(value);
  const totalMinutes = 6 * 60 + Math.round(value * 9);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  $('#time-value').textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  $('#time-name').textContent = hours < 10 ? '清晨' : hours < 14 ? '正午' : hours < 17 ? '午后' : '黄昏';
  document.documentElement.style.setProperty('--dusk', Math.max(0, (value - 65) / 35));
});

function startTour() {
  if (tourActive) { stopTour(); return; }
  tourActive = true;
  tourIndex = 0;
  $('#tour-progress').classList.add('visible');
  $('#tour-button').classList.add('touring');
  $('#tour-button-text').textContent = '结束这段村落漫游';
  goToTourStop();
}

function goToTourStop() {
  if (!tourActive) return;
  const id = tourStops[tourIndex];
  selectPlace(id, 'tour');
  $('#tour-step').textContent = `${tourIndex + 1} / ${tourStops.length}`;
  $('#tour-progress-fill').style.width = `${((tourIndex + 1) / tourStops.length) * 100}%`;
  clearTimeout(tourTimer);
  tourTimer = setTimeout(() => {
    tourIndex += 1;
    if (tourIndex >= tourStops.length) {
      stopTour();
      selectPlace('overview');
    } else goToTourStop();
  }, 6500);
}

function stopTour() {
  tourActive = false;
  clearTimeout(tourTimer);
  $('#tour-progress').classList.remove('visible');
  $('#tour-button').classList.remove('touring');
  $('#tour-button-text').textContent = '沿着少平的路走一遍';
}
$('#tour-button').addEventListener('click', startTour);
$('#stop-tour').addEventListener('click', stopTour);

function resetPagePosition() {
  document.documentElement.scrollLeft = 0;
  document.body.scrollLeft = 0;
}
function openNotes() {
  resetPagePosition();
  $('#notes-drawer').classList.add('open');
  $('#drawer-backdrop').classList.add('open');
  $('#notes-drawer').setAttribute('aria-hidden', 'false');
  $('#close-notes').focus({ preventScroll: true });
}
function closeNotes() {
  $('#notes-drawer').classList.remove('open');
  $('#drawer-backdrop').classList.remove('open');
  $('#notes-drawer').setAttribute('aria-hidden', 'true');
  $('#open-notes').focus({ preventScroll: true });
  resetPagePosition();
}
$('#open-notes').addEventListener('click', openNotes);
$('#close-notes').addEventListener('click', closeNotes);
$('#drawer-backdrop').addEventListener('click', closeNotes);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if ($('#notes-drawer').classList.contains('open')) closeNotes();
    else if (tourActive) stopTour();
  }
});

function renderNotes(tab) {
  const data = notes[tab];
  $('#notes-content').innerHTML = `<p class="notes-intro">${data.intro}</p>${data.sections.map((section, index) => `<section class="note-section"><span class="note-index">${String(index + 1).padStart(2, '0')}</span><div><h3>${section.title}</h3><p>${section.text}</p></div></section>`).join('')}`;
  document.querySelectorAll('[data-tab]').forEach((button) => {
    const active = button.dataset.tab === tab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', active);
  });
  $('#notes-content').scrollTop = 0;
}
document.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => renderNotes(button.dataset.tab)));
renderNotes('geography');

function createAmbientSound() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  audioGain = audioContext.createGain();
  audioGain.gain.value = 0;
  audioGain.connect(audioContext.destination);

  const bufferSize = audioContext.sampleRate * 4;
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  const wind = audioContext.createBufferSource();
  wind.buffer = buffer;
  wind.loop = true;
  const filter = audioContext.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 720;
  const windGain = audioContext.createGain();
  windGain.gain.value = 0.23;
  wind.connect(filter).connect(windGain).connect(audioGain);
  wind.start();

  const water = audioContext.createBufferSource();
  water.buffer = buffer;
  water.loop = true;
  water.playbackRate.value = 1.7;
  const waterFilter = audioContext.createBiquadFilter();
  waterFilter.type = 'bandpass';
  waterFilter.frequency.value = 1250;
  waterFilter.Q.value = 0.45;
  const waterGain = audioContext.createGain();
  waterGain.gain.value = 0.09;
  water.connect(waterFilter).connect(waterGain).connect(audioGain);
  water.start();

  const breeze = audioContext.createOscillator();
  breeze.frequency.value = 0.08;
  const breezeGain = audioContext.createGain();
  breezeGain.gain.value = 0.07;
  breeze.connect(breezeGain).connect(windGain.gain);
  breeze.start();
}

$('#ambient-button').addEventListener('click', async () => {
  if (!audioContext) createAmbientSound();
  await audioContext.resume();
  soundActive = !soundActive;
  audioGain.gain.cancelScheduledValues(audioContext.currentTime);
  audioGain.gain.linearRampToValueAtTime(soundActive ? 0.65 : 0, audioContext.currentTime + 0.8);
  $('#ambient-button').classList.toggle('active', soundActive);
  $('#ambient-button').setAttribute('aria-label', soundActive ? '关闭环境声' : '开启环境声');
  $('#ambient-text').textContent = soundActive ? '风声与流水声已开启' : '风过黄土塬，河水向东流';
});

function updateLabels(camera, renderer, currentId, visible) {
  if (!visible) return;
  const width = renderer.domElement.clientWidth;
  const height = renderer.domElement.clientHeight;
  const introRect = $('#intro-panel').getBoundingClientRect();
  labelItems.forEach((item) => {
    const element = document.querySelector(`[data-label="${item.id}"]`);
    if (!element) return;
    const vector = new THREE.Vector3(item.position[0], item.id === 'shigejie' ? 13 : 9, item.position[2]).project(camera);
    const x = (vector.x * 0.5 + 0.5) * width;
    const y = (-vector.y * 0.5 + 0.5) * height;
    element.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    const halfWidth = element.offsetWidth / 2;
    const overlapsIntro = x + halfWidth > introRect.left && x - halfWidth < introRect.right && y > introRect.top && y - element.offsetHeight < introRect.bottom;
    const inView = vector.z < 1 && x > 20 && x < width - 20 && y > 80 && y < height - 145 && !overlapsIntro;
    element.style.opacity = inView ? '1' : '0';
    element.style.pointerEvents = inView ? 'auto' : 'none';
    element.classList.toggle('is-current', currentId === item.id);
  });
}

sceneApi = createVillage($('#scene'), {
  landmarks,
  onSelect: (id) => selectPlace(id, true),
  onFrame: updateLabels,
  onReady: () => {
    $('#loading-screen').classList.add('loaded');
    document.body.classList.add('scene-ready');
    setTimeout(() => $('#loading-screen').remove(), 900);
  },
});
