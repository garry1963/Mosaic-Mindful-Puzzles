const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Go to app
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Create a 10MB dummy image file
  const largeBuffer = Buffer.alloc(10 * 1024 * 1024, 'a');
  fs.writeFileSync('test-image.jpg', largeBuffer);

  try {
    // 1. Enter Classic Gallery
    await page.click('h2:has-text("Classic Gallery")', { force: true });
    // 2. Wait for the Upload button and click it
    await page.waitForSelector('button:has-text("Upload")');
    await page.click('button:has-text("Upload")', { force: true });
  } catch (e) {
    console.log("Failed to click Upload Photo, printing HTML...");
    const html = await page.content();
    console.log(html);
    throw e;
  }
  
  // Wait for the modal and file input to be ready
  await page.waitForSelector('input[type="file"]');
  
  // Set the file input
  await page.setInputFiles('input[type="file"]', 'test-image.jpg');

  // Set category dropdown to "Classic Cars"
  await page.selectOption('select', 'Classic Cars');

  try {
    // Wait for the button to become enabled
    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent && b.textContent.includes('Add to Library'));
      return btn && !btn.disabled;
    }, { timeout: 5000 });
  } catch (e) {
    console.log("Button never enabled, HTML:");
    console.log(await page.content());
    throw e;
  }

  // Click actual upload button
  await page.click('button:has-text("Add to Library")');


  console.log("Waiting for error dialog...");
  // Wait to see if error appears
  try {
    await page.waitForSelector('text="Upload Failed"', { timeout: 3000 });
    const errObj = await page.locator('.bg-white.rounded-2xl').innerText();
    console.log("Found error dialog text:", errObj);
  } catch (e) {
    console.log("No error dialog found, upload succeeded?");
  }

  await browser.close();
})();
