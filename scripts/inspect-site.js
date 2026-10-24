const { chromium } = require("C:/Users/Ömer faruk şener/.gemini/config/skills/playwright/node_modules/playwright");
const fs = require("fs");
const path = require("path");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();

  try {
    console.log("Navigating to https://gunubirlik.qrders.com.tr ...");
    await page.goto("https://gunubirlik.qrders.com.tr", { timeout: 35000, waitUntil: "networkidle" });
    const title = await page.title();
    console.log("PAGE TITLE:", title);

    const data = await page.evaluate(() => {
      const bodyStyle = window.getComputedStyle(document.body);
      const allElements = Array.from(document.querySelectorAll("*"));
      
      const bgColors = new Set();
      const textColors = new Set();
      const fonts = new Set();

      allElements.slice(0, 150).forEach(el => {
        const s = window.getComputedStyle(el);
        if (s.backgroundColor && s.backgroundColor !== "rgba(0, 0, 0, 0)") bgColors.add(s.backgroundColor);
        if (s.color) textColors.add(s.color);
        if (s.fontFamily) fonts.add(s.fontFamily.split(",")[0].trim().replace(/['"]/g, ""));
      });

      const navLinks = Array.from(document.querySelectorAll("nav a, header a, footer a"))
        .map(a => a.innerText.trim())
        .filter(Boolean);

      const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4"))
        .map(h => ({ tag: h.tagName, text: h.innerText.trim() }))
        .filter(h => h.text.length > 0);

      const buttons = Array.from(document.querySelectorAll("button, a.btn, .btn, input[type='button']"))
        .map(b => b.innerText.trim() || b.value)
        .filter(Boolean);

      const images = Array.from(document.querySelectorAll("img"))
        .map(img => ({ src: img.src, alt: img.alt, class: img.className }))
        .slice(0, 10);

      return {
        title: document.title,
        bodyBg: bodyStyle.backgroundColor,
        bodyColor: bodyStyle.color,
        bodyFont: bodyStyle.fontFamily,
        bgColors: Array.from(bgColors).slice(0, 12),
        textColors: Array.from(textColors).slice(0, 8),
        fonts: Array.from(fonts).slice(0, 6),
        navLinks: Array.from(new Set(navLinks)).slice(0, 15),
        headings: headings.slice(0, 12),
        buttons: Array.from(new Set(buttons)).slice(0, 10),
        images: images
      };
    });

    console.log("SITE DETAILS:\n", JSON.stringify(data, null, 2));

    const ssPathDesktop = path.join(process.cwd(), "public", "site_reference_desktop.png");
    await page.screenshot({ path: ssPathDesktop, fullPage: true });
    console.log("Desktop screenshot saved to:", ssPathDesktop);

    // Mobil görünüm
    await page.setViewportSize({ width: 390, height: 844 });
    const ssPathMobile = path.join(process.cwd(), "public", "site_reference_mobile.png");
    await page.screenshot({ path: ssPathMobile, fullPage: true });
    console.log("Mobile screenshot saved to:", ssPathMobile);

  } catch (err) {
    console.error("Error inspecting site:", err);
  } finally {
    await browser.close();
  }
})();
