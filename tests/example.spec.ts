import { test } from '@playwright/test';

const targetSites = [
  'ocs.usu.ac.id', 'kelas.usu.ac.id'
];

const wordlist = ['slot', 'gacor'];

test('Security Audit: Deep Search with Pagination', async ({ page, context }) => {
  test.setTimeout(600000); // Naikkan ke 10 menit karena proses lebih panjang

  for (const site of targetSites) {
    for (const word of wordlist) {
      console.log(`\n🔍 [FASE 1] Mencari di CSE: site:${site} "${word}"`);

      await page.goto('https://cse.google.com/cse?cx=e63b9c8eaa8d4418f');
      const searchBox = page.getByRole('textbox', { name: 'telusuri' });
      await searchBox.fill(`site:${site} "${word}"`);
      await searchBox.press('Enter');

      let allCollectedLinks: string[] = [];
      let pageNumber = 1;

      // --- LOGIKA PAGINATION DIMULAI ---
      while (true) {
        try {
          // Tunggu hasil muncul di halaman saat ini
          await page.waitForSelector('.gsc-result', { timeout: 7000 });

          // Scrap link yang ada di halaman saat ini
          const currentLinks = await page.$$eval('a.gs-title', (anchors, currentSite) => {
            return anchors
              .map(a => (a as HTMLAnchorElement).href)
              .filter(href => href && href.startsWith(`https://${currentSite}/`));
          }, site);

          allCollectedLinks.push(...currentLinks);
          console.log(`   📄 Halaman ${pageNumber}: Mendapatkan ${currentLinks.length} link.`);

          // Cek apakah ada tombol halaman berikutnya (misal: Halaman 2, 3, dst)
          const nextPageNumber = pageNumber + 1;
          const nextPageButton = page.locator('.gsc-cursor-page').filter({ hasText: nextPageNumber.toString() });

          if (await nextPageButton.isVisible()) {
            await nextPageButton.click();
            pageNumber++;
            // Beri jeda agar hasil halaman berikutnya termuat sempurna
            await page.waitForTimeout(2000); 
          } else {
            // Jika tidak ada tombol halaman berikutnya, hentikan loop pagination
            break;
          }
        } catch (e) {
          // Jika tidak ada hasil sama sekali sejak halaman pertama
          if (pageNumber === 1) console.log(`   ✅ Tidak ditemukan hasil untuk "${word}"`);
          break;
        }
      }

      // Hilangkan duplikat dari semua halaman yang dikumpulkan
      const uniqueLinks = [...new Set(allCollectedLinks)];

      // --- FASE VERIFIKASI DIMULAI ---
      if (uniqueLinks.length > 0) {
        console.log(`\n🚀 [FASE 2] Memulai verifikasi ${uniqueLinks.length} URL unik...`);

        for (const url of uniqueLinks) {
          const verifyPage = await context.newPage();
          try {
            console.log(`    ⏳ Mengecek: ${url}`);
            await verifyPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
            
            const htmlContent = await verifyPage.content();
            const foundInHtml = htmlContent.toLowerCase().includes(word.toLowerCase());
            const foundInUrl = verifyPage.url().toLowerCase().includes(word.toLowerCase());

            if (foundInHtml || foundInUrl) {
              console.log(`    🚨 POSITIF: Kata "${word}" ditemukan di: ${url}`);
            }
          } catch (err) {
            console.log(`    ⚠️ Gagal akses (Timeout/404): ${url}`);
          } finally {
            await verifyPage.close();
          }
        }
      }
      
      await page.waitForTimeout(2000);
    }
  }
});