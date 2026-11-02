const fs = require('fs');

console.log('==============================================');
console.log(' AUDIT: STUDIO.402 MOBILE KEEPSAKE TEMPLATES');
console.log('==============================================\n');

let passed = 0;
let total = 0;

function assert(desc, condition) {
  total++;
  if (condition) {
    console.log(`  [PASS] ${desc}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${desc}`);
  }
}

const templates = [
  {
    file: 'vinyl.html',
    name: 'The Vinyl Wrapped Edition (Spotilove)',
    checks: [
      { desc: 'File size > 15KB', fn: (c) => c.length > 15000 },
      { desc: 'Dynamic Viewport (100dvh) & Safe Area', fn: (c) => c.includes('100dvh') && c.includes('safe-area-inset-bottom') },
      { desc: 'Pivoting Tonearm & Grooves', fn: (c) => c.includes('tonearm-assembly') && c.includes('vinyl-grooves') },
      { desc: 'Web Audio Synthetic Vinyl Crackle', fn: (c) => c.includes('playVinylCrackle') },
      { desc: 'Relationship Wrapped Stats Carousel', fn: (c) => c.includes('Our Love Wrapped') && c.includes('snap-x') },
      { desc: 'Back Cover Liner Notes & Voucher', fn: (c) => c.includes('Liner Notes') && c.includes('RECEIPT #ST-402') },
      { desc: 'Draft Watermark Pill & Gumroad Link', fn: (c) => c.includes('studio-draft-pill') && c.includes('threadsmith13.gumroad.com') },
      { desc: 'Server Hydration & Message Listener', fn: (c) => c.includes('window.__SERVER_PROJECT__') && c.includes("addEventListener('message'") },
      { desc: 'Natural US Couple Demo Data', fn: (c) => c.includes('Alex & Maya') && c.includes('Until I Found You') }
    ]
  },
  {
    file: 'cinema.html',
    name: 'The Cinema Interactive Edition (Netlove)',
    checks: [
      { desc: 'File size > 15KB', fn: (c) => c.length > 15000 },
      { desc: 'Dynamic Viewport (100dvh) & Safe Area', fn: (c) => c.includes('100dvh') && c.includes('safe-area-inset-bottom') },
      { desc: 'Brand NETLOVE Present', fn: (c) => c.includes('NETLOVE') },
      { desc: "Who's Watching Gateway Screen", fn: (c) => c.includes('profile-gateway') && c.includes("Who's Watching Tonight?") },
      { desc: '16:9 Widescreen & Soft Movie Subtitle', fn: (c) => c.includes('aspect-video') && c.includes('movie-subtitle') },
      { desc: 'Journey Episode Guide', fn: (c) => c.includes('The Journey Chapters') && c.includes('Episode') },
      { desc: 'Interactive Memory Trivia Quiz', fn: (c) => c.includes('quiz-section') && c.includes('The Co-Star Memory Test') },
      { desc: "Director's Cut Vault & Date Voucher", fn: (c) => c.includes("Director's Cut Vault") && c.includes('VIP TICKET') },
      { desc: 'Draft Watermark Pill & Gumroad Link', fn: (c) => c.includes('studio-draft-pill') && c.includes('threadsmith13.gumroad.com') },
      { desc: 'Server Hydration & Message Listener', fn: (c) => c.includes('window.__SERVER_PROJECT__') && c.includes("addEventListener('message'") }
    ]
  },
  {
    file: 'camera.html',
    name: "The Vintage 35mm Camera Edition (Lovebox '98)",
    checks: [
      { desc: 'File size > 15KB', fn: (c) => c.length > 15000 },
      { desc: 'Dynamic Viewport (100dvh) & Safe Area', fn: (c) => c.includes('100dvh') && c.includes('safe-area-inset-bottom') },
      { desc: "Brand LOVEBOX '98 Present", fn: (c) => c.includes("LOVEBOX '98") },
      { desc: 'Analog Rangefinder Viewfinder & Shutter', fn: (c) => c.includes('viewfinder-img') && c.includes('shutter-trigger-btn') },
      { desc: 'Mechanical Shutter Sound (Web Audio)', fn: (c) => c.includes('playCameraShutterSound') },
      { desc: 'Polaroid Ejection & Developing Effect', fn: (c) => c.includes('developing-photo') && c.includes('eject-animation') },
      { desc: '3D Tap-to-Flip Polaroid Card', fn: (c) => c.includes('perspective-container') && c.includes('flip-card-inner') },
      { desc: '35mm Film Strip & Open-When Envelopes', fn: (c) => c.includes('film-sprockets') && c.includes('envelope-btn') },
      { desc: 'Draft Watermark Pill & Gumroad Link', fn: (c) => c.includes('studio-draft-pill') && c.includes('threadsmith13.gumroad.com') },
      { desc: 'Server Hydration & Message Listener', fn: (c) => c.includes('window.__SERVER_PROJECT__') && c.includes("addEventListener('message'") }
    ]
  }
];

for (const t of templates) {
  console.log(`Inspecting ${t.file} (${t.name}):`);
  if (!fs.existsSync(t.file)) {
    console.error(`  [FAIL] File ${t.file} does not exist!`);
    total += t.checks.length;
    continue;
  }
  const content = fs.readFileSync(t.file, 'utf8');
  for (const c of t.checks) {
    assert(c.desc, c.fn(content));
  }
  console.log('');
}

console.log('==============================================');
console.log(`AUDIT RESULT: ${passed} / ${total} tests passed.`);
console.log('==============================================\n');

if (passed === total) {
  process.exit(0);
} else {
  process.exit(1);
}
