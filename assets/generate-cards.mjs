// Regenerates assets/stats.svg and assets/languages.svg from the GitHub API.
import { mkdirSync, writeFileSync } from 'node:fs';

const USER = process.env.GH_USER || 'Srccodeusr';
// Most of your repos are forks, so they are counted by default. Set INCLUDE_FORKS to "false" in the workflow to skip them.
const INCLUDE_FORKS = process.env.INCLUDE_FORKS !== 'false';
const headers = {
  'User-Agent': 'profile-cards',
  Accept: 'application/vnd.github+json',
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
};

async function api(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${path}`);
  return res;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const num = (n) => n.toLocaleString('en-US');

const COLORS = {
  TypeScript: '#4a8fdc', PHP: '#7a86b8', JavaScript: '#f1e05a', HTML: '#e34c26', CSS: '#7e5bb5',
  Python: '#4b8bbe', Shell: '#89e051', Blade: '#f7523f', Vue: '#41b883', SCSS: '#c6538c',
  Dockerfile: '#384d54', Go: '#00add8', Java: '#b07219', 'C++': '#f34b7d', C: '#9a9a9a',
};
const FALLBACK = ['#4a90e2', '#23a55a', '#b56ee0', '#e8a33d', '#d9634f'];
const FONT = "text{font-family:'Segoe UI','SF Pro Text',-apple-system,'Helvetica Neue',Arial,sans-serif}";

function statsCard(items, date) {
  const cols = items.map(([value, label], i) => {
    const cx = 107 + i * 215;
    return `<text x="${cx}" y="110" font-size="38" font-weight="700" fill="#f2f3f5" text-anchor="middle">${esc(value)}</text>
<rect class="bar" x="${cx - 12}" y="120" width="24" height="3" rx="1.5" fill="#e8a33d" style="animation-delay:${(0.2 + i * 0.2).toFixed(1)}s"/>
<text x="${cx}" y="142" font-size="13" fill="#949ba4" text-anchor="middle">${esc(label)}</text>`;
  }).join('\n');
  const label = items.map(([v, l]) => `${v} ${l}`).join(', ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 860 170" width="860" height="170" role="img" aria-label="GitHub stats: ${esc(label)}">
<style>
${FONT}
.bar{transform-box:fill-box;transform-origin:center;transform:scaleX(0);animation:draw .7s ease-out forwards}
@keyframes draw{to{transform:scaleX(1)}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}.bar{transform:none}}
</style>
<rect width="860" height="170" rx="14" fill="#2b2d31"/>
<text x="28" y="38" font-size="18" font-weight="700" fill="#f2f3f5">GitHub</text>
<text x="832" y="37" font-size="13" fill="#949ba4" text-anchor="end">Updated ${esc(date)}</text>
<path d="M0 56.5h860" stroke="#1e1f22"/>
<path d="M215.5 76v70M430.5 76v70M645.5 76v70" stroke="#1e1f22"/>
${cols}
</svg>
`;
}

function languagesCard(top, date) {
  const W = 804;
  let x = 28;
  const segs = top.map((l) => {
    const w = (W * l.pct) / 100;
    const seg = `<rect x="${x.toFixed(1)}" y="76" width="${w.toFixed(1)}" height="10" fill="${l.color}"/>`;
    x += w;
    return seg;
  }).join('');
  const rest = 28 + W - x > 0.5
    ? `<rect x="${x.toFixed(1)}" y="76" width="${(28 + W - x).toFixed(1)}" height="10" fill="#4e5058"/>`
    : '';
  const chips = top.map((l, i) => {
    const cx = 28 + i * 163;
    const name = l.name.length > 13 ? `${l.name.slice(0, 12)}…` : l.name;
    const pct = l.pct >= 10 ? Math.round(l.pct) : l.pct.toFixed(1);
    return `<g class="c" style="animation-delay:${(0.9 + i * 0.12).toFixed(2)}s"><rect x="${cx}" y="104" width="151" height="52" rx="8" fill="#1e1f22"/><circle cx="${cx + 20}" cy="121" r="6" fill="${l.color}"/><text x="${cx + 34}" y="126" font-size="14" font-weight="600" fill="#f2f3f5">${esc(name)}</text><text x="${cx + 34}" y="146" font-size="12" fill="#949ba4">${pct}%</text></g>`;
  }).join('\n');
  const label = top.map((l) => `${l.name} ${Math.round(l.pct)}%`).join(', ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 860 176" width="860" height="176" role="img" aria-label="Top languages: ${esc(label)}">
<style>
${FONT}
.c{opacity:0;animation:in .5s ease-out forwards}
@keyframes in{to{opacity:1}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}.c{opacity:1}}
</style>
<defs><clipPath id="reveal"><rect x="28" y="76" width="0" height="10" rx="5"><animate attributeName="width" from="0" to="${W}" dur="1s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".2 .7 .2 1"/></rect></clipPath></defs>
<rect width="860" height="176" rx="14" fill="#2b2d31"/>
<text x="28" y="38" font-size="18" font-weight="700" fill="#f2f3f5">Top languages</text>
<text x="832" y="37" font-size="13" fill="#949ba4" text-anchor="end">Updated ${esc(date)}</text>
<path d="M0 56.5h860" stroke="#1e1f22"/>
<g clip-path="url(#reveal)"><rect x="28" y="76" width="${W}" height="10" fill="#4e5058"/>${segs}${rest}</g>
${chips}
</svg>
`;
}

async function main() {
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

  const user = await (await api(`/users/${USER}`)).json();
  const starRes = await api(`/users/${USER}/starred?per_page=1`);
  const lastPage = /[?&]page=(\d+)>; rel="last"/.exec(starRes.headers.get('link') || '');
  const stars = lastPage ? Number(lastPage[1]) : (await starRes.json()).length;

  let repos = [];
  for (let page = 1; ; page++) {
    const batch = await (await api(`/users/${USER}/repos?per_page=100&type=owner&page=${page}`)).json();
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  if (!INCLUDE_FORKS) repos = repos.filter((r) => !r.fork);

  const totals = {};
  await Promise.all(repos.map(async (r) => {
    const langs = await (await api(`/repos/${USER}/${r.name}/languages`)).json();
    for (const [name, bytes] of Object.entries(langs)) totals[name] = (totals[name] || 0) + bytes;
  }));

  mkdirSync('assets', { recursive: true });
  writeFileSync('assets/stats.svg', statsCard([
    [num(user.public_repos), 'Repositories'],
    [num(user.followers), 'Followers'],
    [num(user.following), 'Following'],
    [num(stars), 'Stars given'],
  ], date));

  const total = Object.values(totals).reduce((a, b) => a + b, 0);
  if (total > 0) {
    const top = Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, bytes], i) => ({ name, pct: (bytes / total) * 100, color: COLORS[name] || FALLBACK[i % FALLBACK.length] }));
    writeFileSync('assets/languages.svg', languagesCard(top, date));
  } else {
    console.log('No language data found, keeping the existing languages card.');
  }
  console.log(`Updated cards for ${USER}: ${repos.length} repos scanned.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
