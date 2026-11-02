const fs = require('fs');

console.log('====================================================');
console.log(' AUDIT: RESTORED ORIGINAL FEATURES & REFINEMENTS');
console.log('====================================================\n');

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

// 1. Check vinyl.html
console.log('Checking vinyl.html:');
const vinyl = fs.readFileSync('vinyl.html', 'utf8');
assert('File size is original & full (>60KB)', vinyl.length > 60000);
assert('Fingerprint scanner with 1.5s hold exists', vinyl.includes('fingerprint-scan-btn') && vinyl.includes('startFingerprintHold'));
assert('Turntable tonearm & spinning disc exists', vinyl.includes('tonearm-assembly') && vinyl.includes('vinyl-disc'));
assert('3D Polaroid flip cards exist', vinyl.includes('flip-card-inner') && vinyl.includes('is-flipped'));
assert('Perforated receipt with zig-zag exists', vinyl.includes('receipt-body') && vinyl.includes('zig-top'));
assert('Wrapped story overlay exists', vinyl.includes('wrapped-overlay') && vinyl.includes('story-bar-0'));
assert('Yes proposal celebration modal exists', vinyl.includes('yes-modal') && vinyl.includes("Locked In Forever."));
assert('Mobile responsive 100dvh & safe area present', vinyl.includes('100dvh') && vinyl.includes('safe-area-inset-bottom'));
assert('Draft reminder bar with Gumroad link exists', vinyl.includes('studio-draft-bar') && vinyl.includes('threadsmith13.gumroad.com'));

// 2. Check cinema.html
console.log('\nChecking cinema.html:');
const cinema = fs.readFileSync('cinema.html', 'utf8');
assert('File size is original & full (>50KB)', cinema.length > 50000);
assert("Who's Watching Gateway with dual profiles exists", cinema.includes('profile-gateway') && cinema.includes("Who's Watching Tonight?"));
assert('Hero cinema player with subtitles & audio exists', cinema.includes('movie-subtitle') || cinema.includes('hero-video') || cinema.includes('hero-ambient'));
assert('Top 10 moments hollow number carousel exists', cinema.includes('rank-number') && cinema.includes('snap-x-mandatory'));
assert('Bandersnatch interactive story choices exist', cinema.includes('choice-timer-active') || cinema.includes('interactiveScenes'));
assert("Director's Vault with date voucher exists", cinema.includes('voucherTitle') || cinema.includes('tab-vault'));
assert('Mobile responsive 100dvh & safe area present', cinema.includes('100dvh') && cinema.includes('safe-area-inset-bottom'));
assert('Draft reminder bar with Gumroad link exists', cinema.includes('studio-draft-bar') && cinema.includes('threadsmith13.gumroad.com'));

// 3. Check camera.html
console.log('\nChecking camera.html:');
const camera = fs.readFileSync('camera.html', 'utf8');
assert('File size is original & full (>50KB)', camera.length > 50000);
assert('Upgraded Leica camera chassis & lens barrel exist', camera.includes('camera-chassis') && camera.includes('lens-barrel-frame'));
assert('Realistic knurled shutter button exists', camera.includes('shutter-bezel') && camera.includes('shutter-red-cap'));
assert('Viewfinder with optical OSD & framelines exists', camera.includes('viewfinder-img') && camera.includes('viewfinder-frame'));
assert('Polaroid developing emulsion with rub/tap exists', camera.includes('photo-emulsion-box') && camera.includes('developEmulsionStep'));
assert('Archival Open-When folded letters exist', camera.includes('tab-envelopes') && camera.includes('openEnvelopeModal'));
assert('Date Night Bucket list & Golden Voucher exist', camera.includes('tab-bucketlist') && camera.includes('guilloche-border'));
assert('Web Audio sound synthesizer exists', camera.includes('playMechanicalShutterSound') && camera.includes('playPaperRustleSound'));
assert('Mobile responsive 100dvh & safe area present', camera.includes('100dvh') && camera.includes('safe-area-inset-bottom'));
assert('Draft reminder bar with Gumroad link exists', camera.includes('studio-draft-bar') && camera.includes('threadsmith13.gumroad.com'));

console.log(`\n====================================================`);
console.log(`AUDIT RESULT: ${passed} / ${total} tests passed.`);
console.log(`====================================================\n`);

if (passed === total) process.exit(0);
else process.exit(1);
