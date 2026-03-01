const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  
  await page.goto('file:///Users/dk/Codes/train/dev/app.html');
  await page.waitForTimeout(3000); // map load
  
  // check for svg arrows
  const svgs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.amap-marker svg')).map(s => s.outerHTML);
  });
  console.log('AMAP SVG MARKERS found:', svgs.length);
  if (svgs.length > 0) {
      console.log('First SVG:', svgs[0]);
  } else {
      console.log('No SVG found inside .amap-marker');
      const allMarkers = await page.evaluate(() => document.querySelectorAll('.amap-marker').length);
      console.log('Total .amap-marker elements:', allMarkers);
      
      const amapHTML = await page.evaluate(() => document.querySelector('.amap-maps')?.innerHTML.substring(0, 500));
      console.log('AMAP Map HTML snippet:', amapHTML);
  }
  
  await browser.close();
})();
