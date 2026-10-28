'use strict';
const $ = (selector, root = document) => root.querySelector(selector);
const state = {samples: [], mode: 'ours', category: 'All styles', query: '', visible: 10, featured: 0};
let featureController;
const pairControllers = new Set();
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const clock = value => { const seconds = Math.max(0, Math.floor(value || 0)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; };

class SyncedPair {
  constructor(root, button, progress, clockEl) {
    this.root = root; this.videos = [...root.querySelectorAll('video')]; this.button = button; this.progress = progress; this.clockEl = clockEl; this.frame = 0; this.playing = false; this.loading = false; this.originalText = button.textContent;
    if (this.videos.length !== 2) throw new Error('A comparison needs two videos');
    button.addEventListener('click', () => this.playing ? this.pause() : this.play());
    this.videos[0].addEventListener('ended', () => {this.pause(); this.seek(0);});
    this.videos[0].addEventListener('loadedmetadata', () => this.display());
    this.videos.forEach(video => {
      video.addEventListener('error', () => {this.pause(); button.textContent = 'Open the video below'; button.disabled = true;});
      video.addEventListener('play', () => {if (!this.playing && !this.loading) this.play();});
      video.addEventListener('pause', () => {if (this.playing) this.pause();});
    });
    if (progress) progress.addEventListener('input', () => this.seek(Number(progress.value) / 1000));
    pairControllers.add(this);
  }
  async play() {
    if (this.loading) return;
    this.loading = true;
    for (const pair of pairControllers) if (pair !== this) pair.pause();
    this.button.textContent = 'Loading…';
    for (const video of this.videos) { if (!video.src) {video.src = video.dataset.src; video.load();} }
    try {
      await Promise.all(this.videos.map(video => video.play()));
      this.playing = true; this.button.textContent = 'Pause comparison'; this.tick();
    } catch (error) {this.pause(); this.button.textContent = 'Play comparison';}
    finally {this.loading = false;}
  }
  pause() { this.playing = false; this.videos.forEach(video => video.pause()); cancelAnimationFrame(this.frame); if (!this.button.disabled) this.button.textContent = this.originalText; }
  seek(fraction) { this.videos.forEach(video => {if (Number.isFinite(video.duration)) video.currentTime = Math.min(fraction * video.duration, Math.max(0, video.duration - 0.02));}); this.display(); }
  display() {const first = this.videos[0]; if (this.progress && first.duration) this.progress.value = Math.round(first.currentTime / first.duration * 1000); if (this.clockEl) this.clockEl.textContent = `${clock(first.currentTime)} / ${clock(first.duration || this.root.dataset.duration)}`;}
  tick() {if (!this.playing) return; const [a,b] = this.videos; const fraction = a.duration ? a.currentTime / a.duration : 0; if (b.duration && Math.abs(b.currentTime - fraction * b.duration) > .14) b.currentTime = fraction * b.duration; this.display(); this.frame = requestAnimationFrame(() => this.tick());}
  destroy() {this.pause(); pairControllers.delete(this);}
}

function videoPanel(sample, kind, featured = false) {
  const label = kind === 'low' ? 'Low-cost input' : kind === 'ours' ? 'FilmTogether output' : 'High-cost target';
  const caption = kind === 'low' ? 'Source' : kind === 'ours' ? 'Model result' : 'Dataset reference';
  return `<div class="video-panel"><div class="panel-label"><strong>${label}</strong>${featured ? `<span>${caption}</span>` : ''}</div><video muted playsinline controls preload="${featured ? 'metadata' : 'none'}" src="${sample[kind]}" poster="${sample[kind+'Poster']}" aria-label="${label}, ${escapeHTML(sample.id)}"></video></div>`;
}

function renderFeatured() {
  if (featureController) featureController.destroy();
  const sample = state.samples[state.featured];
  $('#featured-pair').innerHTML = videoPanel(sample, 'low', true) + videoPanel(sample, state.mode, true);
  $('#featured-pair').dataset.duration = sample.duration;
  $('#feature-category').textContent = sample.title || sample.category;
  $('#case-position').textContent = `${state.featured + 1} / ${state.samples.length}`;
  $('#feature-instruction').textContent = sample.instruction;
  $('#feature-time').value = 0; $('#feature-play').textContent = 'Play comparison'; $('#feature-play').disabled = false;
  $('#feature-clock').textContent = `0:00 / ${clock(sample.duration)}`;
  // Clone controls so each featured case has exactly one active event listener.
  const oldButton = $('#feature-play'), button = oldButton.cloneNode(true); oldButton.replaceWith(button);
  const oldProgress = $('#feature-time'), progress = oldProgress.cloneNode(true); oldProgress.replaceWith(progress);
  featureController = new SyncedPair($('#featured-pair'), button, progress, $('#feature-clock'));
}

function matchingSamples() {const query = state.query.toLowerCase(); return state.samples.filter(sample => (state.category === 'All styles' || sample.category === state.category) && (!query || `${sample.instruction} ${sample.id} ${sample.category}`.toLowerCase().includes(query)));}

function renderGallery() {
  for (const controller of [...pairControllers]) if (controller.root.closest('#gallery')) controller.destroy();
  const matches = matchingSamples();
  const displayed = matches.slice(0, state.visible);
  $('#gallery').innerHTML = displayed.map(sample => `<article class="example" data-sample="${sample.id}"><div class="card-topline"><span>${escapeHTML(sample.title || sample.category)}</span><span>${sample.duration.toFixed(1)}s</span></div><div class="card-pair">${videoPanel(sample,'low')}${videoPanel(sample,state.mode)}</div><div class="card-actions"><button class="card-play" aria-label="Play comparison for ${sample.id}">Play comparison</button><a href="${sample[state.mode]}" target="_blank" rel="noopener">Open ${state.mode === 'ours' ? 'output' : 'target'} video</a></div><details><summary>Editing prompt</summary><p>${escapeHTML(sample.instruction)}</p></details></article>`).join('');
  document.querySelectorAll('.example').forEach(card => new SyncedPair($('.card-pair',card),$('.card-play',card)));
  $('#empty-state').hidden = matches.length > 0;
  $('#result-count').textContent = `${displayed.length} of ${matches.length} examples`;
  $('#load-more').hidden = displayed.length >= matches.length;
}

function renderFilters() {
  const categories = ['All styles', ...new Set(state.samples.map(sample => sample.category))];
  $('#category-filters').innerHTML = categories.map(category => `<button aria-pressed="${state.category === category}" data-category="${escapeHTML(category)}">${escapeHTML(category)}</button>`).join('');
  $('#category-filters').querySelectorAll('button').forEach(button => button.addEventListener('click', () => {state.category = button.dataset.category; state.visible = 10; renderFilters(); renderGallery();}));
}

async function initialize() {
  try {
    const showcase = window.FILMTOGETHER_SHOWCASE;
    if (!showcase || !Array.isArray(showcase.samples) || !showcase.samples.length) throw Error('Showcase catalog unavailable');
    state.samples = showcase.samples; renderFeatured(); renderFilters(); renderGallery();
    $('#real-gallery').innerHTML = showcase.realWorld.map(sample => `<article class="real-example"><div class="real-topline"><h3>${escapeHTML(sample.title)}</h3><span>Real-world demo · ${sample.duration.toFixed(1)}s</span></div><div class="real-pair">${videoPanel(sample,'low',true)}${videoPanel(sample,'ours',true)}</div><div class="card-actions"><button class="card-play" aria-label="Play ${sample.id}">Play comparison</button><a href="${sample.ours}" target="_blank" rel="noopener">Open output video</a></div><details><summary>Editing prompt</summary><p>${escapeHTML(sample.instruction)}</p></details></article>`).join('');
    document.querySelectorAll('.real-example').forEach(card => new SyncedPair($('.real-pair',card),$('.card-play',card)));
  }
  catch (error) {console.error('Showcase initialization failed:', error); $('#feature-category').textContent = 'Preview controls unavailable — the videos below can still be played directly.'; $('#load-more').hidden = true; return;}
  $('#previous-case').addEventListener('click', () => {state.featured = (state.featured - 1 + state.samples.length) % state.samples.length; renderFeatured();});
  $('#next-case').addEventListener('click', () => {state.featured = (state.featured + 1) % state.samples.length; renderFeatured();});
  $('#feature-reset').addEventListener('click', () => {featureController.pause(); featureController.seek(0);});
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
    state.mode = button.dataset.mode;
    document.querySelectorAll('[data-mode]').forEach(tab => tab.setAttribute('aria-selected',String(tab === button)));
    $('#comparison-content').setAttribute('aria-labelledby',button.id);
    $('#mode-description').textContent = state.mode === 'ours' ? 'Full-duration model outputs · exp5 step 6000 · 20 denoising steps' : 'Paired high-cost dataset references · not model predictions';
    renderFeatured(); renderGallery();
  }));
  $('#prompt-search').addEventListener('input', event => {state.query = event.target.value; state.visible = 10; renderGallery();});
  $('#load-more').addEventListener('click', () => {state.visible += 6; renderGallery();});
  const observer = new IntersectionObserver(entries => {entries.forEach(entry => {if (!entry.isIntersecting) for (const pair of pairControllers) if (pair.root === entry.target) pair.pause();});},{threshold:.05});
  observer.observe($('#featured-pair'));
  document.addEventListener('visibilitychange', () => {if (document.hidden) pairControllers.forEach(pair => pair.pause());});
}

$('#copy-citation').addEventListener('click', async event => {try {await navigator.clipboard.writeText($('#citation').textContent); event.target.textContent = 'Copied'; setTimeout(() => {event.target.textContent = 'Copy BibTeX';},1800);} catch {event.target.textContent = 'Select and copy below';}});
initialize();
