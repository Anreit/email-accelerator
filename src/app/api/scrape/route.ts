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

    // ── Deep scrape: fetch homepage + discover additional pages ──
    const homepageHtml = await fetchPage(targetUrl);
    if (!homepageHtml) {
      return NextResponse.json(
        { error: `Failed to fetch ${targetUrl}` },
        { status: 400 }
      );
    }

    const $ = cheerio.load(homepageHtml);

    // Find about page and bestsellers/collections page links
    const aboutPaths = ["/about", "/about-us", "/pages/about", "/pages/about-us"];
    const bestsellerPaths = ["/bestsellers", "/collections/bestsellers", "/collections/all", "/nicotine-pouches/bestsellers"];

    // Try to find internal links that match common patterns
    const internalLinks = new Set<string>();
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      if (href.startsWith("/") && !href.startsWith("//")) {
        internalLinks.add(href.split("?")[0].split("#")[0]);
      }
    });

    // Find about page
    let aboutHtml: string | null = null;
    for (const path of aboutPaths) {
      const match = Array.from(internalLinks).find(
        (l) => l.toLowerCase().includes("about")
      );
      const tryPath = match || path;
      aboutHtml = await fetchPage(baseOrigin + tryPath);
      if (aboutHtml) break;
    }

    // Find bestsellers/collection page
    let bestsellersHtml: string | null = null;
    for (const path of bestsellerPaths) {
      const match = Array.from(internalLinks).find(
        (l) => l.toLowerCase().includes("bestseller") || l.toLowerCase().includes("best-seller")
      );
      const tryPath = match || path;
      bestsellersHtml = await fetchPage(baseOrigin + tryPath);
      if (bestsellersHtml) break;
    }

    // ── Extract brand data from all pages ──

    // Company name
    const name = extractCompanyName($, targetUrl);

    // Logo
    const logo = extractLogo($, targetUrl);

    // Colors from homepage
    const colors = extractColors($, homepageHtml);

    // Fonts
    const fonts = extractFonts($, homepageHtml);

    // Products from homepage first, then try bestsellers page
    let products = extractProducts($, targetUrl);
    if (bestsellersHtml && products.length < 6) {
      const $bs = cheerio.load(bestsellersHtml);
      const bsProducts = extractProducts($bs, targetUrl);
      // Merge, dedup by name
      const existingNames = new Set(products.map((p) => p.name));
      for (const p of bsProducts) {
        if (!existingNames.has(p.name)) {
          products.push(p);
          existingNames.add(p.name);
        }
      }
    }
    products = products.slice(0, 8);

    // Description
    const description = extractDescription($);

    // ── Deep image collection ──
    const allImages: Record<string, string[]> = {
      banners: [],
      brandLogos: [],
      trustIcons: [],
      blogImages: [],
      lifestyleImages: [],
      productImages: [],
    };

    // Collect ALL image URLs from homepage
    const allSrcs = new Set<string>();
    $("img").each((_, el) => {
      const src = $(el).attr("src");
      if (src) allSrcs.add(resolveUrl(src, targetUrl));
    });
    // Also check CSS backgrounds and srcset
    $("[style]").each((_, el) => {
      const style = $(el).attr("style") || "";
      const bgMatch = style.match(/url\(['"]?([^'")\s]+)['"]?\)/);
      if (bgMatch) allSrcs.add(resolveUrl(bgMatch[1], targetUrl));
    });

    // Categorize images by path patterns
    for (const imgUrl of allSrcs) {
      if (imgUrl.includes("loader") || imgUrl.includes("pixel") || imgUrl.includes("tracking") || imgUrl.includes("1x1")) continue;

      if (imgUrl.includes("/media/wysiwyg/") && (imgUrl.includes("Skinny") || imgUrl.includes("Banner") || imgUrl.includes("banner") || imgUrl.includes("hero") || imgUrl.includes("Hero") || imgUrl.includes("Steal") || imgUrl.includes("PlayOff") || imgUrl.includes("Deal"))) {
        allImages.banners.push(imgUrl);
      } else if (imgUrl.includes("/media/wysiwyg/") && (imgUrl.includes("Radiobutton") || imgUrl.includes("radiobutton") || imgUrl.includes("brand"))) {
        allImages.brandLogos.push(imgUrl);
      } else if (imgUrl.includes("/media/wysiwyg/") && (imgUrl.includes("About") || imgUrl.includes("about") || imgUrl.includes("usp") || imgUrl.includes("trust"))) {
        allImages.trustIcons.push(imgUrl);
      } else if (imgUrl.includes("/media/magefan_blog/") || imgUrl.includes("/blog/")) {
        allImages.blogImages.push(imgUrl);
      } else if (imgUrl.includes("/media/wysiwyg/") && (imgUrl.includes(".jpg") || imgUrl.includes(".jpeg") || imgUrl.includes(".png")) && !imgUrl.includes("icon") && !imgUrl.includes("Icon")) {
        allImages.lifestyleImages.push(imgUrl);
      } else if (imgUrl.includes("/media/catalog/product/")) {
        allImages.productImages.push(imgUrl);
      }
    }

    // Also scrape about page for trust icons
    if (aboutHtml) {
      const $about = cheerio.load(aboutHtml);
      $about("img").each((_, el) => {
        const src = $about(el).attr("src");
        if (!src) return;
        const resolved = resolveUrl(src, targetUrl);
        if (resolved.includes("About") || resolved.includes("about") || resolved.includes("usp") || resolved.includes("competitive") || resolved.includes("product_range") || resolved.includes("shopping_experience")) {
          if (!allImages.trustIcons.includes(resolved)) {
            allImages.trustIcons.push(resolved);
          }
        }
        if (resolved.includes("about-page") || resolved.includes("hero")) {
          if (!allImages.lifestyleImages.includes(resolved)) {
            allImages.lifestyleImages.push(resolved);
          }
        }
      });
    }

    // Collect blog images from homepage blog section
    $("a[href*='blog'] img, [class*='blog'] img").each((_, el) => {
      const src = $(el).attr("src");
      if (src) {
        const resolved = resolveUrl(src, targetUrl);
        if (!allImages.blogImages.includes(resolved)) {
          allImages.blogImages.push(resolved);
        }
      }
    });

    // Verify top banner images actually load
    const verifiedBanners: string[] = [];
    for (const banner of allImages.banners.slice(0, 4)) {
      const ok = await checkImageUrl(banner);
      if (ok) verifiedBanners.push(banner);
    }

    const verifiedTrustIcons: string[] = [];
    for (const icon of allImages.trustIcons.slice(0, 4)) {
      const ok = await checkImageUrl(icon);
      if (ok) verifiedTrustIcons.push(icon);
    }

    const brandData = {
      url: targetUrl,
      name,
      logo,
      colors,
      fonts,
      products,
      description,
      images: {
        banners: verifiedBanners,
        brandLogos: allImages.brandLogos.slice(0, 6),
        trustIcons: verifiedTrustIcons,
        blogImages: allImages.blogImages.slice(0, 4),
        lifestyleImages: allImages.lifestyleImages.slice(0, 4),
        productImages: allImages.productImages.slice(0, 8),
      },
    };

    return NextResponse.json(brandData);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Scraping failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
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
    if (["#000000", "#ffffff", "#333333", "#666666", "#999999", "#cccccc", "#f5f5f5", "#e5e5e5", "#f3f3f3", "#111111"].includes(lower)) continue;
    colorCounts[lower] = (colorCounts[lower] || 0) + 1;
  }
  const sorted = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([color]) => color);
  for (const c of sorted) colors.add(c);
  return Array.from(colors).slice(0, 6);
}

function extractFonts($: cheerio.CheerioAPI, html: string): string[] {
  const fonts = new Set<string>();
  $('link[href*="fonts.googleapis.com"]').each((_, el) => {
    const href = $(el).attr("href") || "";
    const familyMatch = href.match(/family=([^&:]+)/g);
    if (familyMatch) {
      for (const m of familyMatch) {
        const name = m.replace("family=", "").replace(/\+/g, " ").split(":")[0];
        fonts.add(name);
      }
    }
  });
  const fontFamilyMatches = html.match(/font-family:\s*['"]?([^'";,}]+)/gi) || [];
  for (const match of fontFamilyMatches) {
    const font = match.replace(/font-family:\s*/i, "").replace(/['"]/g, "").trim();
    if (font && !["arial", "helvetica", "sans-serif", "serif", "monospace", "inherit", "initial"].includes(font.toLowerCase())) {
      fonts.add(font);
    }
  }
  return Array.from(fonts).slice(0, 4);
}

function extractProducts($: cheerio.CheerioAPI, baseUrl: string): Array<{ name: string; image: string | null; price: string | null }> {
  const products: Array<{ name: string; image: string | null; price: string | null }> = [];
  const selectors = [".product-card", ".product-item", '[class*="product"]', '[class*="ProductCard"]', ".grid-item", ".collection-product"];
  for (const sel of selectors) {
    $(sel).slice(0, 8).each((_, el) => {
      const rawName = $(el).find('[class*="title"], [class*="name"], h3, h4').first().text().trim() || $(el).find("a").first().text().trim();
      const name = rawName.replace(/\s+/g, " ").trim();
      const image = $(el).find("img").first().attr("src");
      const priceText = $(el).find('[class*="price"]').first().text().trim() || null;
      let cleanPrice = priceText;
      if (cleanPrice) {
        const priceMatch = cleanPrice.match(/\$[\d,.]+/);
        cleanPrice = priceMatch ? priceMatch[0] : null;
      }
      if (name && name.length > 2 && name.length < 80) {
        products.push({
          name,
          image: image ? resolveUrl(image, baseUrl) : null,
          price: cleanPrice,
        });
      }
    });
    if (products.length > 0) break;
  }
  return products.slice(0, 8);
}

function extractDescription($: cheerio.CheerioAPI): string {
  return $('meta[name="description"]').attr("content") || $('meta[property="og:description"]').attr("content") || "";
}
