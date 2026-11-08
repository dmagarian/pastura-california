// Set this to the inbox that should receive shoot requests.
const CONTACT_EMAIL = "";
const CONTACT_PHONE = "818-515-2962";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Viewfinder timecode, 24 fps */
(function timecode() {
  const el = document.getElementById("timecode");
  if (!el || reduceMotion) return;
  const start = performance.now();
  const pad = (n) => String(n).padStart(2, "0");
  function tick(now) {
    const frames = Math.floor(((now - start) / 1000) * 24);
    const f = frames % 24;
    const s = Math.floor(frames / 24) % 60;
    const m = Math.floor(frames / 1440) % 60;
    const h = Math.floor(frames / 86400);
    el.textContent = `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

/*
  Background music: a slow fingerpicked acoustic guitar loop, synthesized in the
  browser with the Karplus-Strong plucked-string method. No audio file, so no
  licensing. Off until the visitor turns it on.
  To use a licensed track instead, replace startMusic/stopMusic with an <audio> element.
*/
const Music = (() => {
  let ctx, master, analyser, timer, nextTime = 0, step = 0;
  const cache = new Map();

  // Open-position chords as string frequencies (low to high), G - Em - C - D
  const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
  const chords = [
    [43, 47, 50, 55, 59, 67],
    [40, 47, 52, 55, 59, 64],
    [48, 52, 55, 60, 64, 67],
    [50, 57, 62, 66, 69, 74],
  ].map((c) => c.map(hz));
  // Travis-style pattern: index into the chord per eighth note
  const pattern = [0, 4, 2, 5, 1, 4, 2, 5];
  const eighth = 60 / 76 / 2;

  function pluck(freq) {
    if (cache.has(freq)) return cache.get(freq);
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * 3.2);
    const buf = ctx.createBuffer(1, length, rate);
    const out = buf.getChannelData(0);
    const period = Math.round(rate / freq);
    const ring = new Float32Array(period);
    for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1;
    let idx = 0;
    for (let i = 0; i < length; i++) {
      const next = (idx + 1) % period;
      const v = 0.4985 * (ring[idx] + ring[next]);
      out[i] = ring[idx];
      ring[idx] = v;
      idx = next;
    }
    cache.set(freq, buf);
    return buf;
  }

  function reverb() {
    const rate = ctx.sampleRate;
    const len = rate * 2.4;
    const ir = ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    const conv = ctx.createConvolver();
    conv.buffer = ir;
    return conv;
  }

  function playNote(freq, time, gainValue) {
    const src = ctx.createBufferSource();
    src.buffer = pluck(freq);
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 2600;
    const g = ctx.createGain();
    g.gain.value = gainValue;
    src.connect(tone).connect(g).connect(master);
    src.start(time);
  }

  function schedule() {
    while (nextTime < ctx.currentTime + 0.2) {
      const bar = Math.floor(step / pattern.length) % chords.length;
      const chord = chords[bar];
      const beat = step % pattern.length;
      // Bass on the downbeats, a little humanized timing and velocity
      const jitter = (Math.random() - 0.5) * 0.012;
      if (beat === 0 || beat === 4) playNote(chord[beat === 0 ? 0 : 1], nextTime + jitter, 0.42);
      playNote(chord[pattern[beat]], nextTime + jitter + 0.004, 0.18 + Math.random() * 0.08);
      nextTime += eighth;
      step++;
    }
  }

  function start() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0;
      const wet = ctx.createGain();
      wet.gain.value = 0.28;
      const verb = reverb();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      master.connect(analyser).connect(ctx.destination);
      master.connect(verb).connect(wet).connect(analyser);
    }
    ctx.resume();
    nextTime = ctx.currentTime + 0.1;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0.55, ctx.currentTime, 0.6);
    timer = setInterval(schedule, 50);
  }

  function stop() {
    if (!ctx) return;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
    clearInterval(timer);
    setTimeout(() => ctx.state === "running" && master.gain.value < 0.01 && ctx.suspend(), 1500);
  }

  function levels(count) {
    if (!analyser) return new Array(count).fill(0);
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const size = Math.floor(data.length / 2 / count);
    return Array.from({ length: count }, (_, i) => {
      let sum = 0;
      for (let j = 0; j < size; j++) sum += data[i * size + j];
      return sum / size / 255;
    });
  }

  return { start, stop, levels };
})();

(function soundToggle() {
  const btn = document.getElementById("sound");
  if (!btn) return;
  const label = btn.querySelector(".sound__label");
  const bars = btn.querySelectorAll(".sound__meter i");
  let on = false, raf;

  function meter() {
    const lv = Music.levels(bars.length);
    bars.forEach((b, i) => (b.style.height = `${3 + Math.min(1, lv[i] * 2.2) * 13}px`));
    raf = requestAnimationFrame(meter);
  }

  btn.addEventListener("click", () => {
    on = !on;
    btn.setAttribute("aria-pressed", String(on));
    label.textContent = on ? "Sound on" : "Sound off";
    if (on) {
      Music.start();
      if (!reduceMotion) meter();
    } else {
      Music.stop();
      cancelAnimationFrame(raf);
      bars.forEach((b) => (b.style.height = "3px"));
    }
  });
})();

/* Contact form: opens the visitor's email app with the request filled in */
(function contactForm() {
  const form = document.getElementById("contact-form");
  const status = document.getElementById("form-status");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    status.classList.remove("is-error");
    const required = ["name", "email", "message"];
    let firstBad = null;
    required.forEach((n) => {
      const field = form.elements[n];
      const ok = field.value.trim() !== "" && field.checkValidity();
      field.setAttribute("aria-invalid", String(!ok));
      if (!ok && !firstBad) firstBad = field;
    });
    if (firstBad) {
      status.classList.add("is-error");
      status.textContent = "Add your name, a valid email, and what you want to film.";
      firstBad.focus();
      return;
    }
    if (!CONTACT_EMAIL) {
      status.classList.add("is-error");
      status.textContent = `Online requests aren't connected yet. Call ${CONTACT_PHONE} or message us on Instagram.`;
      return;
    }
    const d = Object.fromEntries(new FormData(form));
    const body = `Name: ${d.name}\nEmail: ${d.email}\nPhone: ${d.phone || "-"}\nTimeline: ${d.when}\n\n${d.message}`;
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Shoot request from " + d.name)}&body=${encodeURIComponent(body)}`;
    status.textContent = "Your email app should open with the request filled in. Send it from there.";
  });
})();
