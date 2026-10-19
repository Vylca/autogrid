import '@fontsource-variable/atkinson-hyperlegible-next';
import './styles/print.css';

const MM = 96 / 25.4;
const MARGIN_MM = 10;
const CUT_MM = 9;

const SCISSORS =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.1 7.9L20 19M8.1 16.1L20 5"/></svg>';

function frame() {
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

function setPage(orientation) {
  let style = document.getElementById('page-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'page-style';
    document.head.appendChild(style);
  }
  style.textContent = `@page { size: A4 ${orientation === 'landscape' ? 'landscape' : 'portrait'}; margin: ${MARGIN_MM}mm; }`;
}

function makeBlock(html) {
  const el = document.createElement('div');
  el.className = 'block';
  el.innerHTML = html;
  return el;
}

function cutLine() {
  const el = document.createElement('div');
  el.className = 'cut';
  el.innerHTML = `<span>${SCISSORS}</span>`;
  return el;
}

async function layout(job) {
  const root = document.getElementById('root');
  root.innerHTML = '';
  setPage(job.orientation);
  document.body.classList.toggle('bw', !job.color);
  document.title = job.title || 'AutoGrid';

  const landscape = job.orientation === 'landscape';
  const pageW = ((landscape ? 297 : 210) - 2 * MARGIN_MM) * MM;
  // A small safety margin keeps rounding differences from spilling onto a new page.
  const pageH = ((landscape ? 210 : 297) - 2 * MARGIN_MM - 3) * MM;
  const cutH = CUT_MM * MM;

  const measure = document.createElement('div');
  measure.className = 'measure';
  measure.style.width = `${pageW}px`;
  root.appendChild(measure);

  await document.fonts.ready;

  let sources = job.blocks;
  const blocks = sources.map((html) => {
    const el = makeBlock(html);
    measure.appendChild(el);
    return el;
  });
  await frame();

  const heights = blocks.map((el) => {
    let h = el.getBoundingClientRect().height;
    if (h > pageH) {
      // Shrink a grid that is taller than a page so it still fits on one page.
      const z = Math.max(0.5, pageH / h);
      el.style.zoom = String(z);
      h = el.getBoundingClientRect().height;
    }
    return h;
  });

  let pages = [];
  if (job.layout === 'fill') {
    // Blank grid repeated as many times as it fits on one page.
    const h = heights[0];
    const count = Math.max(1, Math.floor((pageH + cutH) / (h + cutH)));
    const page = [];
    for (let i = 0; i < count; i++) {
      const el = i === 0 ? blocks[0] : blocks[0].cloneNode(true);
      page.push(el);
    }
    pages = [page];
  } else if (job.layout === 'packed') {
    let current = [];
    let used = 0;
    blocks.forEach((el, i) => {
      const need = heights[i] + (current.length ? cutH : 0);
      if (current.length && used + need > pageH) {
        pages.push(current);
        current = [];
        used = 0;
      }
      used += heights[i] + (current.length ? cutH : 0);
      current.push(el);
    });
    if (current.length) pages.push(current);
  } else {
    pages = blocks.map((el) => [el]);
  }

  measure.remove();
  for (const blocksOnPage of pages) {
    const page = document.createElement('div');
    page.className = 'sheet';
    page.style.width = `${pageW}px`;
    blocksOnPage.forEach((el, i) => {
      if (i > 0) page.appendChild(cutLine());
      page.appendChild(el);
    });
    root.appendChild(page);
  }
  await frame();
  return { pages: pages.length };
}

window.api.onPrintJob(async (job) => {
  let info;
  try {
    info = await layout(job);
  } catch (err) {
    info = { error: String(err) };
  }
  window.api.printReady(job.id, info);
});
