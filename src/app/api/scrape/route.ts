import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export const maxDuration = 60;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function checkImageUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function resolveUrl(src: string, baseUrl: string): string {
  if (src.startsWith("http")) return src;
  if (src.startsWith("//")) return "https:" + src;
  try {
    return new URL(src, baseUrl).href;
  } catch {
    return src;
  }
}

export async function POST(request: Request) {
  try {
    const { url, password } = await request.json();

    const correctPw = process.env.APP_PASSWORD || "scandiweb2026";
    if (password !== correctPw) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    let targetUrl = url;
    if (!targetUrl.startsWith("http")) {
      targetUrl = "https://" + targetUrl;
    }

    const baseOrigin = new URL(targetUrl).origin;

    // ═══════════════════════════════════════════════
    // STEP 1: Fetch homepage and discover site structure
    // ═══════════════════════════════════════════════
    const homepageHtml = await fetchPage(targetUrl);
    if (!homepageHtml) {
      return NextResponse.json(
        { error: `Failed to fetch ${targetUrl}` },
        { status: 400 }
      );
    }

    const $ = cheerio.load(homepageHtml);

    // Collect ALL internal links from homepage (nav, footer, body)
    const internalLinks = new Set<string>();
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      const resolved = href.startsWith("/") ? baseOrigin + href : href;
      if (resolved.startsWith(baseOrigin) && !resolved.includes("#") && !resolved.includes("?")) {
        internalLinks.add(resolved.split("?")[0]);
      }
    });

    // ═══════════════════════════════════════════════
    // STEP 2: Discover and fetch key pages in parallel
    // ═══════════════════════════════════════════════
    const linksArray = Array.from(internalLinks);

    // Find about page
    const aboutUrl = linksArray.find((l) => {
      const path = l.replace(baseOrigin, "").toLowerCase();
      return path.includes("/about") || path.includes("/our-story") || path.includes("/story");
    });

    // Find collection/category pages (bestsellers, shop all, categories)
    const collectionUrls = linksArray.filter((l) => {
      const path = l.replace(baseOrigin, "").toLowerCase();
      return (
        path.includes("/bestseller") ||
        path.includes("/best-seller") ||
        path.includes("/collections") ||
        path.includes("/shop") ||
        path.includes("/products") ||
        path.includes("/catalog") ||
        path.includes("/category") ||
        path.includes("/all")
      );
    }).slice(0, 3);

    // Find blog page
    const blogUrl = linksArray.find((l) => {
      const path = l.replace(baseOrigin, "").toLowerCase();
      return path.includes("/blog") || path.includes("/journal") || path.includes("/magazine");
    });

    // Fetch all discovered pages in parallel
    const pagePromises: Promise<{ type: string; html: string | null }>[] = [];

    if (aboutUrl) pagePromises.push(fetchPage(aboutUrl).then((html) => ({ type: "about", html })));
    for (const cu of collectionUrls) {
      pagePromises.push(fetchPage(cu).then((html) => ({ type: "collection", html })));
    }
    if (blogUrl) pagePromises.push(fetchPage(blogUrl).then((html) => ({ type: "blog", html })));

    const fetchedPages = await Promise.all(pagePromises);

    const aboutHtml = fetchedPages.find((p) => p.type === "about")?.html || null;
    const collectionPages = fetchedPages.filter((p) => p.type === "collection" && p.html).map((p) => p.html!);
    const blogHtml = fetchedPages.find((p) => p.type === "blog")?.html || null;

    // ═══════════════════════════════════════════════
    // STEP 3: Extract brand identity
    // ═══════════════════════════════════════════════
    const name = extractCompanyName($, targetUrl);
    const logo = extractLogo($, targetUrl);
    const colors = extractColors($, homepageHtml);
    const fonts = extractFonts($, homepageHtml);
    const description = extractDescription($);

    // Detect brand tone from body background, overall color scheme
    const bodyBg = $("body").attr("style")?.match(/background[^;]*#([0-9a-fA-F]{6})/)?.[1];
    const brandTone = detectBrandTone(colors, bodyBg || null, description);

    // ═══════════════════════════════════════════════
    // STEP 4: Extract REAL products with prices from multiple pages
    // ═══════════════════════════════════════════════
    let products = extractProducts($, targetUrl);

    // Also try collection pages for more/better products
    for (const collHtml of collectionPages) {
      const $c = cheerio.load(collHtml);
      const collProducts = extractProducts($c, targetUrl);
      const existingNames = new Set(products.map((p) => p.name.toLowerCase()));
      for (const p of collProducts) {
        if (!existingNames.has(p.name.toLowerCase()) && p.price) {
          products.push(p);
          existingNames.add(p.name.toLowerCase());
        }
      }
    }

    // Prioritize products that have both image AND price
    products.sort((a, b) => {
      const aScore = (a.image ? 2 : 0) + (a.price ? 1 : 0);
      const bScore = (b.image ? 2 : 0) + (b.price ? 1 : 0);
      return bScore - aScore;
    });
    products = products.slice(0, 8);

    // ═══════════════════════════════════════════════
    // STEP 5: Deep image collection from ALL pages
    // ═══════════════════════════════════════════════
    const allImages: Record<string, string[]> = {
      banners: [],
      brandLogos: [],
      trustIcons: [],
      blogImages: [],
      lifestyleImages: [],
      productImages: [],
    };

    // Collect images from homepage
    collectImagesFromPage($, targetUrl, allImages);

    // Collect images from about page
    if (aboutHtml) {
      const $about = cheerio.load(aboutHtml);
      collectImagesFromPage($about, targetUrl, allImages);
    }

    // Collect images from blog page
    if (blogHtml) {
      const $blog = cheerio.load(blogHtml);
      $blog("img").each((_, el) => {
        const src = $blog(el).attr("src");
        if (!src) return;
        const resolved = resolveUrl(src, targetUrl);
        if (resolved.includes("blog") || resolved.includes("magefan") || resolved.includes("journal") || resolved.includes("article")) {
          if (!allImages.blogImages.includes(resolved)) allImages.blogImages.push(resolved);
        } else if (isLikelyLifestyleImage(resolved)) {
          if (!allImages.lifestyleImages.includes(resolved)) allImages.lifestyleImages.push(resolved);
        }
      });
    }

    // Verify top images actually load (parallel)
    const verifyPromises: Promise<{ url: string; ok: boolean; type: string }>[] = [];
    for (const banner of allImages.banners.slice(0, 5)) {
      verifyPromises.push(checkImageUrl(banner).then((ok) => ({ url: banner, ok, type: "banner" })));
    }
    for (const icon of allImages.trustIcons.slice(0, 5)) {
      verifyPromises.push(checkImageUrl(icon).then((ok) => ({ url: icon, ok, type: "trust" })));
    }
    for (const blog of allImages.blogImages.slice(0, 4)) {
      verifyPromises.push(checkImageUrl(blog).then((ok) => ({ url: blog, ok, type: "blog" })));
    }
    for (const lifestyle of allImages.lifestyleImages.slice(0, 4)) {
      verifyPromises.push(checkImageUrl(lifestyle).then((ok) => ({ url: lifestyle, ok, type: "lifestyle" })));
    }

    const verifyResults = await Promise.all(verifyPromises);
    const verified: Record<string, string[]> = { banners: [], trustIcons: [], blogImages: [], lifestyleImages: [] };
    for (const r of verifyResults) {
      if (r.ok) {
        if (r.type === "banner") verified.banners.push(r.url);
        else if (r.type === "trust") verified.trustIcons.push(r.url);
        else if (r.type === "blog") verified.blogImages.push(r.url);
        else if (r.type === "lifestyle") verified.lifestyleImages.push(r.url);
      }
    }

    // ═══════════════════════════════════════════════
    // STEP 6: Extract navigation categories
    // ═══════════════════════════════════════════════
    const categories = extractCategories($, baseOrigin);

    const brandData = {
      url: targetUrl,
      name,
      logo,
      colors,
      fonts,
      brandTone,
      categories,
      products,
      description,
      pagesScraped: {
        homepage: true,
        about: !!aboutHtml,
        collections: collectionPages.length,
        blog: !!blogHtml,
      },
      images: {
        banners: verified.banners,
        brandLogos: allImages.brandLogos.slice(0, 6),
        trustIcons: verified.trustIcons,
        blogImages: verified.blogImages,
        lifestyleImages: verified.lifestyleImages,
        productImages: allImages.productImages.slice(0, 8),
      },
    };

    return NextResponse.json(brandData);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Scraping failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── Image collection from a page ──
function collectImagesFromPage(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  allImages: Record<string, string[]>
) {
  $("img").each((_, el) => {
    const src = $(el).attr("src");
    if (!src) return;
    const resolved = resolveUrl(src, baseUrl);

    if (resolved.includes("loader") || resolved.includes("pixel") || resolved.includes("tracking") || resolved.includes("1x1") || resolved.includes("spacer")) return;

    if (isBannerImage(resolved)) {
      if (!allImages.banners.includes(resolved)) allImages.banners.push(resolved);
    } else if (isBrandLogo(resolved)) {
      if (!allImages.brandLogos.includes(resolved)) allImages.brandLogos.push(resolved);
    } else if (isTrustIcon(resolved)) {
      if (!allImages.trustIcons.includes(resolved)) allImages.trustIcons.push(resolved);
    } else if (resolved.includes("/blog/") || resolved.includes("magefan_blog") || resolved.includes("/journal/")) {
      if (!allImages.blogImages.includes(resolved)) allImages.blogImages.push(resolved);
    } else if (resolved.includes("/catalog/product/")) {
      if (!allImages.productImages.includes(resolved)) allImages.productImages.push(resolved);
    } else if (isLikelyLifestyleImage(resolved)) {
      if (!allImages.lifestyleImages.includes(resolved)) allImages.lifestyleImages.push(resolved);
    }
  });

  // Also check background images in style attributes
  $("[style]").each((_, el) => {
    const style = $(el).attr("style") || "";
    const bgMatch = style.match(/url\(['"]?([^'")\s]+)['"]?\)/);
    if (bgMatch) {
      const resolved = resolveUrl(bgMatch[1], baseUrl);
      if (isLikelyLifestyleImage(resolved) && !allImages.lifestyleImages.includes(resolved)) {
        allImages.lifestyleImages.push(resolved);
      }
    }
  });
}

function isBannerImage(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    (lower.includes("/wysiwyg/") || lower.includes("/banner")) &&
    (lower.includes("banner") || lower.includes("skinny") || lower.includes("hero") || lower.includes("steal") || lower.includes("playoff") || lower.includes("deal") || lower.includes("promo") || lower.includes("sale") || lower.includes("offer") || lower.includes("1520x") || lower.includes("1070x") || lower.includes("slider"))
  );
}

function isBrandLogo(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes("radiobutton") || lower.includes("brand-logo") || (lower.includes("/wysiwyg/") && lower.includes("brand"));
}

function isTrustIcon(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes("about-us") || lower.includes("about_us") || lower.includes("usp") ||
    lower.includes("trust") || lower.includes("competitive") || lower.includes("product_range") ||
    lower.includes("shopping_experience") || lower.includes("guarantee") || lower.includes("about-quote")
  );
}

function isLikelyLifestyleImage(url: string): boolean {
  const lower = url.toLowerCase();
  if (lower.includes("icon") || lower.includes("logo") || lower.includes("loader") || lower.includes(".svg") || lower.includes("pixel")) return false;
  return (
    (lower.includes("/wysiwyg/") || lower.includes("/media/")) &&
    (lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") || lower.endsWith(".webp")) &&
    !lower.includes("/catalog/product/")
  );
}

function detectBrandTone(colors: string[], bodyBg: string | null, description: string): string {
  const desc = description.toLowerCase();
  const allColors = [...colors, bodyBg ? `#${bodyBg}` : ""].filter(Boolean);

  // Check for warm tones (beauty, luxury)
  const hasWarmTones = allColors.some((c) => {
    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);
    return r > 180 && g < 160 && b < 160; // pinkish/coral/red warm
  });

  if (desc.includes("beauty") || desc.includes("skincare") || desc.includes("cosmetic") || desc.includes("makeup") || hasWarmTones) {
    return "beauty/luxury — use elegant serif headings (Georgia), warm palette, soft rounded corners, lifestyle-forward imagery";
  }
  if (desc.includes("fashion") || desc.includes("clothing") || desc.includes("apparel")) {
    return "fashion — use clean sans-serif, high-contrast, editorial style, large lifestyle photography";
  }
  if (desc.includes("food") || desc.includes("gourmet") || desc.includes("chocolate") || desc.includes("coffee")) {
    return "food/gourmet — use warm tones, rich photography, appetite-appeal copy, recipe/pairing suggestions";
  }
  if (desc.includes("tech") || desc.includes("electronics") || desc.includes("software")) {
    return "tech — use clean sans-serif, cool blue/gray palette, specs-focused product cards, minimal design";
  }
  if (desc.includes("sport") || desc.includes("fitness") || desc.includes("outdoor")) {
    return "sport/active — use bold sans-serif, high-energy colors, action photography, performance stats";
  }
  if (desc.includes("nicotine") || desc.includes("pouch") || desc.includes("tobacco") || desc.includes("vape")) {
    return "nicotine/tobacco — use bold sans-serif (Montserrat), earthy green/brown tones, include nicotine warning, bulk pricing focus";
  }
  return "general e-commerce — use clean professional sans-serif, brand accent color for hero, clean white product sections";
}

function extractCategories($: cheerio.CheerioAPI, baseOrigin: string): string[] {
  const categories: string[] = [];
  // Look in nav, header menus
  $("nav a, header a, .menu a, .nav a, [class*='menu'] a, [class*='nav'] a").each((_, el) => {
    const text = $(el).text().trim();
    const href = $(el).attr("href") || "";
    if (text && text.length > 2 && text.length < 40 && href.includes("/") && !href.includes("account") && !href.includes("cart") && !href.includes("login")) {
      if (!categories.includes(text)) categories.push(text);
    }
  });
  return categories.slice(0, 10);
}

function extractCompanyName($: cheerio.CheerioAPI, url: string): string {
  const ogSiteName = $('meta[property="og:site_name"]').attr("content");
  if (ogSiteName) return ogSiteName;
  const title = $("title").text().trim();
  if (title) return title.split(/[|–—-]/)[0].trim();
  try {
    const hostname = new URL(url).hostname.replace("www.", "");
    return hostname.split(".")[0].charAt(0).toUpperCase() + hostname.split(".")[0].slice(1);
  } catch {
    return "Company";
  }
}

function extractLogo($: cheerio.CheerioAPI, baseUrl: string): string | null {
  const selectors = [
    'img[class*="logo"]', 'img[id*="logo"]', 'img[alt*="logo"]',
    ".logo img", "#logo img", "header img:first-of-type",
    ".header img:first-of-type", 'a[class*="logo"] img',
  ];
  for (const sel of selectors) {
    const src = $(sel).first().attr("src");
    if (src) return resolveUrl(src, baseUrl);
  }
  const ogImage = $('meta[property="og:image"]').attr("content");
  if (ogImage) return resolveUrl(ogImage, baseUrl);
  return null;
}

function extractColors($: cheerio.CheerioAPI, html: string): string[] {
  const colors = new Set<string>();
  const themeColor = $('meta[name="theme-color"]').attr("content");
  if (themeColor) colors.add(themeColor);
  const hexMatches = html.match(/#[0-9a-fA-F]{6}/g) || [];
  const colorCounts: Record<string, number> = {};
  for (const hex of hexMatches) {
    const lower = hex.toLowerCase();
    if (["#000000", "#ffffff", "#333333", "#666666", "#999999", "#cccccc", "#f5f5f5", "#e5e5e5", "#f3f3f3", "#111111", "#222222", "#aaaaaa", "#eeeeee", "#dddddd", "#bbbbbb"].includes(lower)) continue;
    colorCounts[lower] = (colorCounts[lower] || 0) + 1;
  }
  const sorted = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([color]) => color);
  for (const c of sorted) colors.add(c);
  return Array.from(colors).slice(0, 8);
}

function extractFonts($: cheerio.CheerioAPI, html: string): string[] {
  const fonts = new Set<string>();
  $('link[href*="fonts.googleapis.com"]').each((_, el) => {
    const href = $(el).attr("href") || "";
    const familyMatch = href.match(/family=([^&:]+)/g);
    if (familyMatch) {
      for (const m of familyMatch) {
        const fontName = m.replace("family=", "").replace(/\+/g, " ").split(":")[0];
        fonts.add(fontName);
      }
    }
  });
  const fontFamilyMatches = html.match(/font-family:\s*['"]?([^'";,}]+)/gi) || [];
  for (const match of fontFamilyMatches) {
    const font = match.replace(/font-family:\s*/i, "").replace(/['"]/g, "").trim();
    if (font && !["arial", "helvetica", "sans-serif", "serif", "monospace", "inherit", "initial", "system-ui", "-apple-system"].includes(font.toLowerCase())) {
      fonts.add(font);
    }
  }
  return Array.from(fonts).slice(0, 4);
}

function extractProducts($: cheerio.CheerioAPI, baseUrl: string): Array<{ name: string; image: string | null; price: string | null; url: string | null }> {
  const products: Array<{ name: string; image: string | null; price: string | null; url: string | null }> = [];
  const selectors = [".product-card", ".product-item", '[class*="product"]', '[class*="ProductCard"]', ".grid-item", ".collection-product"];
  for (const sel of selectors) {
    $(sel).slice(0, 12).each((_, el) => {
      const rawName = $(el).find('[class*="title"], [class*="name"], h3, h4, h2').first().text().trim() || $(el).find("a").first().text().trim();
      const name = rawName.replace(/\s+/g, " ").trim();
      const image = $(el).find("img").first().attr("src");
      const priceText = $(el).find('[class*="price"]').first().text().trim() || null;
      const productLink = $(el).find("a").first().attr("href") || null;

      let cleanPrice = priceText;
      if (cleanPrice) {
        const priceMatch = cleanPrice.match(/[\$€£][\d,.]+/);
        cleanPrice = priceMatch ? priceMatch[0] : null;
      }

      if (name && name.length > 2 && name.length < 80) {
        products.push({
          name,
          image: image ? resolveUrl(image, baseUrl) : null,
          price: cleanPrice,
          url: productLink ? resolveUrl(productLink, baseUrl) : null,
        });
      }
    });
    if (products.length > 0) break;
  }
  return products.slice(0, 12);
}

function extractDescription($: cheerio.CheerioAPI): string {
  return $('meta[name="description"]').attr("content") || $('meta[property="og:description"]').attr("content") || "";
}
