import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

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

    // Normalize URL
    let targetUrl = url;
    if (!targetUrl.startsWith("http")) {
      targetUrl = "https://" + targetUrl;
    }

    // Fetch the page
    const res = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch ${targetUrl}: ${res.status}` },
        { status: 400 }
      );
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Extract brand data
    const brandData = {
      url: targetUrl,
      name: extractCompanyName($, targetUrl),
      logo: extractLogo($, targetUrl),
      colors: extractColors($, html),
      fonts: extractFonts($, html),
      products: extractProducts($, targetUrl),
      description: extractDescription($),
      images: extractImages($, targetUrl),
    };

    return NextResponse.json(brandData);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Scraping failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function extractCompanyName(
  $: cheerio.CheerioAPI,
  url: string
): string {
  // Try meta tags first
  const ogSiteName = $('meta[property="og:site_name"]').attr("content");
  if (ogSiteName) return ogSiteName;

  // Try title tag
  const title = $("title").text().trim();
  if (title) {
    // Remove common suffixes
    return title.split(/[|–—-]/)[0].trim();
  }

  // Fall back to domain
  try {
    const hostname = new URL(url).hostname.replace("www.", "");
    return hostname.split(".")[0].charAt(0).toUpperCase() + hostname.split(".")[0].slice(1);
  } catch {
    return "Company";
  }
}

function extractLogo(
  $: cheerio.CheerioAPI,
  baseUrl: string
): string | null {
  // Common logo selectors
  const selectors = [
    'img[class*="logo"]',
    'img[id*="logo"]',
    'img[alt*="logo"]',
    ".logo img",
    "#logo img",
    'header img:first-of-type',
    ".header img:first-of-type",
    'a[class*="logo"] img',
  ];

  for (const sel of selectors) {
    const src = $(sel).first().attr("src");
    if (src) return resolveUrl(src, baseUrl);
  }

  // Try og:image as fallback
  const ogImage = $('meta[property="og:image"]').attr("content");
  if (ogImage) return resolveUrl(ogImage, baseUrl);

  return null;
}

function extractColors(
  $: cheerio.CheerioAPI,
  html: string
): string[] {
  const colors = new Set<string>();

  // From meta theme-color
  const themeColor = $('meta[name="theme-color"]').attr("content");
  if (themeColor) colors.add(themeColor);

  // From inline styles and CSS — extract hex colors
  const hexMatches = html.match(/#[0-9a-fA-F]{6}/g) || [];
  const colorCounts: Record<string, number> = {};
  for (const hex of hexMatches) {
    const lower = hex.toLowerCase();
    // Skip very common non-brand colors
    if (
      ["#000000", "#ffffff", "#333333", "#666666", "#999999", "#cccccc", "#f5f5f5", "#e5e5e5"].includes(lower)
    )
      continue;
    colorCounts[lower] = (colorCounts[lower] || 0) + 1;
  }

  // Sort by frequency and take top 5
  const sorted = Object.entries(colorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([color]) => color);

  for (const c of sorted) colors.add(c);

  return Array.from(colors).slice(0, 6);
}

function extractFonts(
  $: cheerio.CheerioAPI,
  html: string
): string[] {
  const fonts = new Set<string>();

  // From Google Fonts links
  $('link[href*="fonts.googleapis.com"]').each((_, el) => {
    const href = $(el).attr("href") || "";
    const familyMatch = href.match(/family=([^&:]+)/g);
    if (familyMatch) {
      for (const m of familyMatch) {
        const name = m
          .replace("family=", "")
          .replace(/\+/g, " ")
          .split(":")[0];
        fonts.add(name);
      }
    }
  });

  // From CSS font-family declarations
  const fontFamilyMatches =
    html.match(/font-family:\s*['"]?([^'";,}]+)/gi) || [];
  for (const match of fontFamilyMatches) {
    const font = match
      .replace(/font-family:\s*/i, "")
      .replace(/['"]/g, "")
      .trim();
    if (
      font &&
      !["arial", "helvetica", "sans-serif", "serif", "monospace", "inherit", "initial"].includes(
        font.toLowerCase()
      )
    ) {
      fonts.add(font);
    }
  }

  return Array.from(fonts).slice(0, 4);
}

function extractProducts(
  $: cheerio.CheerioAPI,
  baseUrl: string
): Array<{ name: string; image: string | null; price: string | null }> {
  const products: Array<{
    name: string;
    image: string | null;
    price: string | null;
  }> = [];

  // Common product card selectors
  const selectors = [
    ".product-card",
    ".product-item",
    '[class*="product"]',
    '[class*="ProductCard"]',
    ".grid-item",
    ".collection-product",
  ];

  for (const sel of selectors) {
    $(sel)
      .slice(0, 8)
      .each((_, el) => {
        const rawName =
          $(el).find('[class*="title"], [class*="name"], h3, h4').first().text().trim() ||
          $(el).find("a").first().text().trim();
        const name = rawName.replace(/\s+/g, " ").trim();
        const image = $(el).find("img").first().attr("src");
        const priceText =
          $(el).find('[class*="price"]').first().text().trim() || null;

        if (name && name.length > 2 && name.length < 100) {
          // Clean up price — extract just the dollar amount
          let cleanPrice = priceText;
          if (cleanPrice) {
            const priceMatch = cleanPrice.match(/\$[\d,.]+/);
            cleanPrice = priceMatch ? priceMatch[0] : null;
          }
          products.push({
            name: name.replace(/\s+/g, " ").trim(),
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
  return (
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    ""
  );
}

function extractImages(
  $: cheerio.CheerioAPI,
  baseUrl: string
): string[] {
  const images: string[] = [];

  // Hero/banner images
  $("img").each((_, el) => {
    const src = $(el).attr("src");
    if (!src) return;
    const resolved = resolveUrl(src, baseUrl);
    // Skip tiny images, icons, tracking pixels
    const width = parseInt($(el).attr("width") || "0");
    if (width > 0 && width < 100) return;
    if (
      src.includes("icon") ||
      src.includes("pixel") ||
      src.includes("tracking") ||
      src.includes("1x1")
    )
      return;
    if (resolved && !images.includes(resolved)) {
      images.push(resolved);
    }
  });

  return images.slice(0, 12);
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
