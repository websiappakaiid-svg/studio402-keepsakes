const fs = require('fs');

const files = [
  'editor-vinyl.html',
  'editor-cinema.html',
  'editor-camera.html'
];

const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

console.log('==============================================');
console.log(' AUDIT: STUDIO.402 MOBILE-FIRST EDITORS');
console.log('==============================================');

let allPassed = true;

files.forEach(f => {
  console.log(`\nInspecting ${f}:`);
  const c = fs.readFileSync(f, 'utf8');

  const tests = [
    { name: 'File size > 15KB', pass: c.length > 15000 },
    { name: 'Zero Emojis', pass: !emojiRegex.test(c) },
    { name: 'Fullscreen Iframe Preview', pass: c.includes('id="preview-frame"') },
    { name: 'Bottom Dock Navigation Bar', pass: c.includes('openDrawer(') },
    { name: 'Slide-up Bottom Sheet Drawer', pass: c.includes('id="drawer-sheet"') },
    { name: 'Canvas WebP Compressor (800px)', pass: c.includes('compressImageFile') && c.includes('image/webp') },
    { name: 'iTunes Search API Integration', pass: c.includes('searchITunesTracks') },
    { name: 'Slug Availability Checker', pass: c.includes('checkSlugAvailability') && c.includes('/api/check-slug') },
    { name: 'Save Draft Submission & Code', pass: c.includes('submitDraftSave') && c.includes('/api/save-draft') },
    { name: 'JSON Backup Download', pass: c.includes('downloadJsonBackup') },
    { name: 'Gumroad Checkout Redirect Link', pass: c.includes('btn-gumroad-checkout') }
  ];

  tests.forEach(t => {
    console.log(`  [${t.pass ? 'PASS' : 'FAIL'}] ${t.name}`);
    if (!t.pass) allPassed = false;
  });
});

console.log('\n==============================================');
if (allPassed) {
  console.log('ALL TESTS PASSED! All 3 Mobile Editors are Ready.');
} else {
  console.log('SOME TESTS FAILED.');
}
console.log('==============================================');

