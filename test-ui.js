const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Go to app
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Create a dummy image file
  fs.writeFileSync('test-image.jpg', 'dummy image bytes');

  // Click "Upload Photo"
  await page.click('button:has-text("Upload Photo")');
  
  // Wait for the modal and file input to be ready
  await page.waitForSelector('input[type="file"]');
  
  // Set the file input
  await page.setInputFiles('input[type="file"]', 'test-image.jpg');

  // Set category dropdown to "Classic Cars"
  await page.selectOption('select', 'Classic Cars');

  // Click actual upload "Upload & Play" button
  await page.click('button:has-text("Upload & Play")');

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
