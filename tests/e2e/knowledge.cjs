const {openSettings,replyAction,openSettingsSection,closeSettings}=require('./helpers/ui.cjs');
const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  AxeBuilder = require("@axe-core/playwright").default;
const { profile } = require("./helpers/preview-profile.cjs");
const { scan } = require("./helpers/fitscan.cjs");
function pdfFixture() {
  const strings = [
    "Protocol overview. General procedures and reporting guidance for the hospital quality team.",
    "ICU ventilation protocol. The ventilation threshold is 42 units. Patient Ahmed Mahmoud, phone 01012345678. Verify the ICU ventilation threshold.",
  ];
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
  ];
  for (let i = 0; i < 2; i++) {
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 7 0 R >> >> /Contents ${4 + i * 2} 0 R >>`,
    );
    const stream = `BT /F1 12 Tf 25 700 Td (${strings[i]}) Tj ET`;
    objects.push(
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    );
  }
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  let out = "%PDF-1.4\n",
    offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const start = Buffer.byteLength(out);
  out +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map((o) => String(o).padStart(10, "0") + " 00000 n \n")
      .join("") +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return Buffer.from(out);
}
const open = async (page) => {
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("mr:library", { detail: "knowledge" }),
    ),
  );
  // Searchable files live in Collection, under the "Searchable" filter.
  await page.locator(".hub-page .files-uploads .knowledge-library").waitFor();
  if(await page.getByRole('tab',{name:'Searchable',exact:true}).isVisible()) { assert.equal(await page.getByRole('tab',{name:'Searchable',exact:true}).getAttribute('aria-selected'),'true'); } else if (await page.locator('.filter-trigger').count()) {
    assert.match(await page.locator('.filter-trigger').getAttribute('aria-label'), /Content type: Searchable/);
  } else {
    assert.equal(await page.getByRole('radio', { name: 'Searchable', exact: true }).getAttribute('aria-checked'), 'true');
  }
};
const close = async (page) =>
  page.locator('.hub-page [aria-label="Close"], .hub-page .phone-navigation [aria-label="Back"]').click();
// The cited source opens in its own window.
const closeSource = async (page) =>
  page
    .locator(".modal")
    .first()
    .getByRole("button", { name: "Close", exact: true })
    .click();
const upload = async (page, file) => {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await (await chooser).setFiles(file);
  try {
    await page.getByText("0 of 2 passages indexed", { exact: true }).waitFor();
  } catch (error) {
    console.error("IMPORT DIAGNOSTICS", JSON.stringify({
      errors: await page.locator(".knowledge-error").allTextContents(),
      documents: await page.locator(".knowledge-document").allTextContents(),
      progress: await page.locator(".knowledge-import-progress").allTextContents(),
    }));
    await page.screenshot({
      path: `tests/e2e/out/knowledge-import-error-${Date.now()}.png`,
    });
    throw error;
  }
};
const settings = async (page) => {
  await openSettings(page,'Privacy & data');
  const dialog=page.getByRole('dialog',{name:'Settings',exact:true});
  await dialog.getByRole('checkbox',{name:/^Privacy shield/}).check();
  await dialog.getByRole('radio',{name:'Ask me',exact:true}).click();
  assert.equal(await dialog.getByRole('radio',{name:'Ask me',exact:true}).getAttribute('aria-checked'),'true');
  await closeSettings(page);
};
(async () => {
  const browser = await chromium.launch();
  try {
    for (const [width, theme] of [
      [1280, "light"],
      [390, "light"],
      [320, "light"],
      [1280, "dark"],
      [390, "dark"],
      [1280, "black"],
      [390, "black"],
    ].filter(([width, theme]) =>
      (!process.env.MR_KNOWLEDGE_WIDTH || Number(process.env.MR_KNOWLEDGE_WIDTH) === width) &&
      (!process.env.MR_KNOWLEDGE_THEME || process.env.MR_KNOWLEDGE_THEME === theme)
    )) {
      const account = `preview-knowledge-${width}-${theme}`,
        ctx = await browser.newContext({
          viewport: { width, height: 844 },
          isMobile: width < 900,
          hasTouch: width < 900,
          reducedMotion: "reduce",
        });
      await profile(ctx, account, theme);
      const embeddingBodies = [],
        chatBodies = [];
      let quota = true;
      let hold = false,
        releaseHeld,
        heldReady;
      const heldRequest = new Promise((resolve) => (heldReady = resolve));
      await ctx.route("**/generativelanguage.googleapis.com/**", async (r) => {
        const url = r.request().url();
        if (url.includes("/models?"))
          return r.fulfill({
            json: {
              models: [
                {
                  name: "models/gemini-flash-latest",
                  supportedGenerationMethods: ["generateContent"],
                },
              ],
            },
          });
        if (/\/gemini-embedding-2$/.test(url))
          return r.fulfill({
            json: {
              name: "models/gemini-embedding-2",
              supportedGenerationMethods: ["embedContent"],
            },
          });
        if (url.includes(":embedContent")) {
          const body = r.request().postDataJSON();
          embeddingBodies.push(body);
          if (hold) {
            heldReady();
            await new Promise((resolve) => (releaseHeld = resolve));
            hold = false;
            try {
              return await r.fulfill({
                json: {
                  embedding: {
                    values: Array.from({ length: 768 }, (_, i) =>
                      i === 0 ? 1 : 0,
                    ),
                  },
                },
              });
            } catch {
              return;
            }
          }
          if (embeddingBodies.length === 2 && quota)
            return r.fulfill({
              status: 429,
              json: { error: { message: "Embedding free tier quota reached" } },
            });
          return r.fulfill({
            json: {
              embedding: {
                values: Array.from({ length: 768 }, (_, i) =>
                  i === 0 ? 1 : 0,
                ),
              },
            },
          });
        }
        chatBodies.push(r.request().postDataJSON());
        return r.fulfill({
          contentType: "text/event-stream",
          body:
            "data: " +
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: "The ventilation threshold is 42 units [D1].\n\n`[D1]` stays code. [D99] is not a valid source.",
                      },
                    ],
                  },
                  finishReason: "STOP",
                },
              ],
            }) +
            "\n\n",
        });
      });
      const page = await ctx.newPage(),
        errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(
        process.env.MR_TEST_URL || "http://localhost:5190/?emulator",
        { waitUntil: "domcontentloaded" },
      );
      await page.locator(".composer textarea").waitFor();
      await settings(page);
      await page.locator(".composer textarea").waitFor();
      await open(page);
      const phoneTabs=page.getByRole('tablist',{name:'Library content types'});
      const filter = await phoneTabs.isVisible() ? phoneTabs.getByRole('tab',{name:'Searchable',exact:true}) : await page.locator('.filter-trigger').count() ? page.locator('.filter-trigger') : page.getByRole('radio', { name: 'Searchable', exact: true });
      const tab = await filter.boundingBox();
      const strip = await (await phoneTabs.isVisible() ? phoneTabs : await page.locator('.filter-menu').count() ? page.locator('.filter-menu') : page.locator('.coll-filters')).boundingBox();
      assert.ok(
        tab.x >= strip.x - 1 && tab.x + tab.width <= strip.x + strip.width + 1,
        "active filter fully visible",
      );
      await upload(page, {
        name: "Hospital protocol.pdf",
        mimeType: "application/pdf",
        buffer: pdfFixture(),
      });
      assert.equal(
        embeddingBodies.length,
        0,
        "import is local, no embedding requests",
      );
      await page
        .getByRole("searchbox", { name: "Search knowledge", exact: true })
        .fill("ICU ventilation threshold");
      await page
        .locator(".knowledge-search")
        .getByRole("button", { name: "Search", exact: true })
        .click();
      await page.locator(".knowledge-results").waitFor();
      assert.match(
        await page.locator(".knowledge-result").first().textContent(),
        /PDF page 2/,
      );
      assert.equal(embeddingBodies.length, 0);
      assert.deepEqual(await scan(page), []);
      await page.locator(".knowledge-source-link").first().click();
      await page.locator(".knowledge-page").waitFor();
      assert.match(
        await page.locator(".knowledge-page").textContent(),
        /42 units/,
      );
      assert.ok(
        await page
          .getByRole("link", { name: "Open original PDF", exact: true })
          .isVisible(),
      );
      await page.screenshot({
        path: `tests/e2e/out/knowledge-source-${width}-${theme}.png`,
      });
      await page
        .locator(".modal")
        .last()
        .getByRole("button", { name: "Close", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Index meaning", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Index masked text", exact: true })
        .waitFor();
      assert.equal(embeddingBodies.length, 0);
      await page
        .getByRole("button", { name: "Index masked text", exact: true })
        .click();
      await page
        .getByText(/Google embedding quota reached/)
        .waitFor({ timeout: 45000 });
      assert.match(
        await page.locator(".knowledge-document").textContent(),
        /1 of 2 passages/,
      );
      quota = false;
      await page.getByRole("button", { name: "Resume", exact: true }).click();
      await page
        .getByRole("button", { name: "Index masked text", exact: true })
        .click();
      await page
        .getByText("Semantic search ready", { exact: true })
        .waitFor({ timeout: 45000 });
      assert.equal(embeddingBodies.length, 3);
      assert.ok(
        embeddingBodies.every(
          (body) =>
            body.embedContentConfig.outputDimensionality === 768 &&
            !JSON.stringify(body).includes("01012345678") &&
            !JSON.stringify(body).includes("Ahmed Mahmoud"),
        ),
      );
      assert.ok(
        embeddingBodies.some((body) =>
          JSON.stringify(body).includes("[PHONE_1]"),
        ),
      );
      await page
        .locator(".knowledge-search")
        .getByRole("button", { name: "Search", exact: true })
        .click();
      await page
        .getByText("Semantic + keyword search", { exact: true })
        .waitFor();
      const calls = embeddingBodies.length;
      await page
        .getByRole("searchbox", { name: "Search knowledge" })
        .fill("phone 01012345678");
      await page
        .locator(".knowledge-search")
        .getByRole("button", { name: "Search", exact: true })
        .click();
      await page.getByText("Keyword search", { exact: true }).waitFor();
      assert.equal(
        embeddingBodies.length,
        calls,
        "Ask-me private queries stay local",
      );
      await ctx.setOffline(true);
      await page
        .getByRole("searchbox", { name: "Search knowledge" })
        .fill("ICU ventilation threshold");
      await page
        .locator(".knowledge-search")
        .getByRole("button", { name: "Search", exact: true })
        .click();
      await page.locator(".knowledge-result").first().waitFor();
      assert.match(
        await page.locator(".knowledge-search-mode").textContent(),
        /Keyword search/,
      );
      await ctx.setOffline(false);
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      assert.deepEqual(
        axe.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
        [],
      );
      await page.screenshot({
        path: `tests/e2e/out/knowledge-${width}${theme === "light" ? "" : `-${theme}`}.png`,
      });
      await page
        .getByRole("button", { name: "Ask with these sources", exact: true })
        .click();
      await page.locator(".attachment").waitFor();
      assert.equal(chatBodies.length, 0, "prepare does not send");
      assert.equal(
        await page.locator(".composer textarea").inputValue(),
        "ICU ventilation threshold",
      );
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await page
        .getByRole("button", { name: "Mask and send", exact: true })
        .click();
      await page.locator(".knowledge-citations").waitFor();
      await page.locator(".send-btn.stop").waitFor({ state: "hidden" });
      assert.ok(
        chatBodies.every(
          (body) =>
            !JSON.stringify(body).includes("01012345678") &&
            !JSON.stringify(body).includes("Ahmed Mahmoud"),
        ),
      );
      assert.equal(
        await page.locator('a[data-knowledge-citation="1"]').count(),
        1,
        "valid inline citation only; code stays code",
      );
      assert.equal(
        await page.locator('a[data-knowledge-citation="99"]').count(),
        0,
      );
      await page.locator('a[data-knowledge-citation="1"]').click();
      await page.locator(".knowledge-page").waitFor();
      assert.match(
        await page.locator(".knowledge-source-view").textContent(),
        /PDF page 2/,
      );
      await closeSource(page);
      await page.reload();
      await page.locator(".composer textarea").waitFor();
      if (width < 900) await page.click(".menu-btn");
      await page
        .locator(".chat-row")
        .filter({ hasText: "ICU ventilation threshold" })
        .locator(".chat-open")
        .click();
      await page.locator(".knowledge-citations").waitFor();
      assert.match(
        await page.locator(".knowledge-citations").textContent(),
        /PDF page 2/,
      );
      await open(page);
      await page.getByText("Semantic search ready", { exact: true }).waitFor();
      if (width === 1280 && theme === "light") {
        await upload(page, {
          name: "Cancellation guard.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("General reference information. ".repeat(200)),
        });
        hold = true;
        const row = page
          .locator(".knowledge-document")
          .filter({ hasText: "Cancellation guard.txt" });
        await row
          .getByRole("button", { name: "Index meaning", exact: true })
          .click();
        await Promise.race([
          heldRequest,
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Held embedding did not start")),
              30000,
            ),
          ),
        ]);
        await close(page);
        await openSettings(page, 'API keys');
        const firstKey = page.locator(".key-provider-card").first();
        if (!(await firstKey.getAttribute("open"))) await firstKey.locator("summary").click();
        await firstKey.locator("input").fill("fixture-new-key");
        await page
          .getByRole("button", { name: "Save keys", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Save keys", exact: true })
          .waitFor({ state: "visible" });
        await closeSettings(page);
        releaseHeld();
        await open(page);
        await row
          .getByText("0 of 2 passages indexed", { exact: true })
          .waitFor();
        await row
          .getByText("Indexing paused. Your progress is saved.", {
            exact: true,
          })
          .waitFor();
        await page.waitForTimeout(300);
        assert.match(
          await row.textContent(),
          /0 of 2 passages indexed/,
          "late embedding after key change cannot checkpoint",
        );
        await page
          .getByRole("button", {
            name: "Delete Cancellation guard.txt",
            exact: true,
          })
          .click();
        await page
          .getByRole("button", { name: "Delete document", exact: true })
          .click();
        await row.waitFor({ state: "hidden" });
        console.log(
          "PASS background indexing survives closing Collection; key changes cancel requests and refuse late checkpoints",
        );
      }
      await close(page);
      await page.evaluate(() => {
        const uid = "preview-knowledge-other",
          settings = {
            autoIntroduced: true,
            autoTitle: false,
            privacyShield: false,
            enabledModels: ["gemini:gemini-flash-latest"],
            defaultModel: "gemini:gemini-flash-latest",
          };
        localStorage.setItem(
          "mr.account." + uid,
          JSON.stringify({ geminiKey: "fixture", settings }),
        );
        localStorage.setItem(
          "mr.preview_user",
          JSON.stringify({
            uid,
            email: "other@local.invalid",
            displayName: "Other",
          }),
        );
      });
      await page.reload();
      await page.locator(".composer textarea").waitFor();
      await open(page);
      // The library loads asynchronously: wait for the empty state rather than counting too early.
      await page.locator(".knowledge-empty").waitFor();
      assert.equal(
        await page.locator(".knowledge-document").count(),
        0,
        "other account cannot read original account library",
      );
      await page.evaluate(
        (account) =>
          localStorage.setItem(
            "mr.preview_user",
            JSON.stringify({
              uid: account,
              email: "fixture@local.invalid",
              displayName: "Fixture",
            }),
          ),
        account,
      );
      await page.reload();
      await page.locator(".composer textarea").waitFor();
      if (width < 900) await page.click(".menu-btn");
      await page
        .locator(".chat-row")
        .filter({ hasText: "ICU ventilation threshold" })
        .locator(".chat-open")
        .click();
      await page.locator(".knowledge-citations").waitFor();
      await open(page);
      await page.locator(".knowledge-document").first().waitFor();
      assert.equal(
        await page.locator(".knowledge-document").count(),
        1,
        "original account restores library",
      );
      await page
        .getByRole("button", {
          name: "Delete Hospital protocol.pdf",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "Delete document", exact: true })
        .click();
      await page
        .getByText("Your references, in one place", { exact: true })
        .waitFor();
      await close(page);
      await page.locator(".knowledge-citations button").first().click();
      await page.getByText(/original is not in this device library/).waitFor();
      assert.match(
        await page.locator(".knowledge-page").textContent(),
        /42 units/,
      );
      await closeSource(page);
      await page.evaluate(() =>
        localStorage.setItem(
          "mr.preview_user",
          JSON.stringify({
            uid: "preview-knowledge-other",
            email: "other@local.invalid",
            displayName: "Other",
          }),
        ),
      );
      await page.reload();
      await page.locator(".composer textarea").waitFor();
      await open(page);
      assert.equal(await page.locator(".knowledge-document").count(), 0);
      assert.equal(await page.locator(".knowledge-citations").count(), 0);
      assert.deepEqual(errors, []);
      console.log(
        `PASS knowledge ${width}px ${theme}: real PDF pages, local import, keyword/semantic/offline search, masking and Ask-me, quota checkpoint/resume, citations, reload, deletion fallback and account isolation`,
      );
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
