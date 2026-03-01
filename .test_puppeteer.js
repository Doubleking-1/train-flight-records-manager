const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  
  await page.goto('file:///Users/dk/Codes/train/dev/app.html', { waitUntil: 'networkidle0' });
  
  console.log('Page loaded, evaluating button click...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent === '全不选');
    if(btns.length > 0) {
      btns[0].click();
    } else {
      console.log('Button not found');
    }
  });
  
  await new Promise(r => setTimeout(r, 1000));
  
  const checkedCount = await page.evaluate(() => {
    return document.querySelectorAll('.legend-checkbox:checked').length;
  });
  console.log('Checked checkboxes after click:', checkedCount);
  
  await browser.close();
})();
