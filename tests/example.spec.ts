import { test } from '@playwright/test';

const targetSites = [
  'talenta.usu.ac.id',
];

const wordlist = ['slot gacor'];

test('Security Audit: Deep Search & Content Verification', async ({ page, context }) => {
  test.setTimeout(300000);
  for (const site of targetSites) {
    for (const word of wordlist) {
      console.log(`\nMencari di CSE: site:${site} "${word}"`);

      // Navigasi ke CSE
      await page.goto('https://cse.google.com/cse?cx=e63b9c8eaa8d4418f');
      const searchBox = page.getByRole('textbox', { name: 'telusuri' });
      await searchBox.fill(`site:${site} "${word}"`);
      await searchBox.press('Enter');

      let linksToVisit: string[] = [];

      try {
        // Tunggu hingga hasil muncul
        await page.waitForSelector('.gsc-result', { timeout: 5000 });

        // Simpan semua URL ke dalam memory (Array)
        linksToVisit = await page.$$eval('a.gs-title', (anchors, currentSite) => {
          return anchors
            .map(a => (a as HTMLAnchorElement).href)
            .filter(href => href && href.startsWith(`https://${currentSite}/`));
        }, site);

        // Hilangkan duplikat
        linksToVisit = [...new Set(linksToVisit)];

      } catch (e) {
        console.log(`Tidak ditemukan hasil di Google untuk "${word}" di ${site}`);
        continue; // Lanjut ke kata kunci berikutnya jika Google tidak menemukan apa-apa
      }

      if (linksToVisit.length > 0) {
        console.log(`Ditemukan ${linksToVisit.length} URL. Memulai verifikasi konten...`);

        // Kunjungi link satu per satu dari memory
        for (const url of linksToVisit) {
          const verifyPage = await context.newPage(); // Gunakan tab baru agar sesi CSE tidak hilang
          
          try {
            console.log(`    Mengecek: ${url}`);
            await verifyPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
            
            // 1. Ambil seluruh HTML source
            const htmlContent = await verifyPage.content();
            
            // 2. Cek apakah kata kunci ada di kode sumber
            const foundInHtml = htmlContent.toLowerCase().includes(word.toLowerCase());
            
            // 3. Cek juga apakah kata kunci ada di URL-nya (kadang redirect ke domain aneh)
            const foundInUrl = verifyPage.url().toLowerCase().includes(word.toLowerCase());

            // Scrap kata kunci di dalam halaman
            // const bodyText = await verifyPage.innerText('body');
            // const isFound = bodyText.toLowerCase().includes(word.toLowerCase());

            if (foundInHtml || foundInUrl) {
              // Kalau ada, tampilkan di terminal
              console.log(`    POSITIF: Kata "${word}" ditemukan di: ${url}`);
            }
          } catch (err) {
            console.log(`    Gagal akses (Mungkin 404/Timeout): ${url}`);
          } finally {
            await verifyPage.close(); // Tutup tab verifikasi
          }
        }
      }
      
      // Jeda agar tidak terkena rate limit Google
      await page.waitForTimeout(2000);
    }
  }
});