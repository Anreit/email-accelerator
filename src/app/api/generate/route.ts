import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export const maxDuration = 120; // Allow up to 2 min on Vercel

type BrandData = {
  url: string;
  name: string;
  logo: string | null;
  colors: string[];
  fonts: string[];
  products: Array<{ name: string; image: string | null; price: string | null }>;
  description: string;
  images: {
    banners?: string[];
    brandLogos?: string[];
    trustIcons?: string[];
    blogImages?: string[];
    lifestyleImages?: string[];
    productImages?: string[];
  } | string[];
};

export async function POST(request: Request) {
  try {
    const { brandData, emailCount, context, beforeImageContext, password } = (await request.json()) as {
      brandData: BrandData;
      emailCount: number;
      context: string;
      beforeImageContext?: string;
      password: string;
    };

    const correctPw = process.env.APP_PASSWORD || "scandiweb2026";
    if (password !== correctPw) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!brandData?.url) {
      return NextResponse.json(
        { error: "Brand data is required" },
        { status: 400 }
      );
    }

    const count = Math.min(Math.max(emailCount || 4, 1), 8);

    const systemPrompt = `You are a world-class email marketing developer. You build brand-faithful ecommerce emails as a system, not as isolated blocks of copy. Your emails look like they were designed in Figma and hand-coded by a senior developer.

## THINKING PROCESS (do this before writing ANY HTML):

### Step 1: Brand Audit
- What do they sell? Who buys it?
- What's their brand personality? (luxury, sporty, playful, clinical, editorial?)
- What typography should I use? (TWO font roles — see typography rules below)
- What's the right background tone? (warm beige for beauty, clean white for general, light gray for sports)
- What trust signals matter? (years, customers, shipping, guarantees, certifications)

### Step 2: Choose Layout Archetype
- **Hero-Led Conversion** — for welcome, promo, launch (one strong idea dominates)
- **Category Selector** — for welcome, discovery (multiple shopping paths)
- **Product Grid Driver** — for bestseller, newsletter (product-heavy)
- **Editorial** — for content, education (story-driven with imagery)

### Step 3: Map Assets to Sections
- Which scraped banner goes in the hero?
- Which images work as lifestyle breaks?
- Which trust icons from the site can I use?
- Which products have real prices and images?

## TYPOGRAPHY RULES (critical for brand feel):
- ALWAYS use TWO distinct font roles:
  - **Display font** for headlines: serif (Georgia) for beauty/luxury/lifestyle, bold sans-serif (Montserrat/Barlow) for sports/active/tech
  - **Body font** for copy: clean sans-serif (Arial/Helvetica) always
- Load the display font via Google Fonts <link> in <head>
- Beauty/luxury brands: use Georgia or similar serif, lighter font-weight (400), elegant spacing
- Sports/active brands: use Montserrat/Barlow, heavy font-weight (700-900), uppercase headlines
- General retail: use a clean sans-serif like Inter or the brand's own font

## BRAND-ADAPTIVE COLOR RULES:
- Detect the brand's warmth: warm brands (beauty, food) get warm background (#FDF6F4, #F9F7F5); cool brands (sports, tech) get neutral (#f2f2f2)
- Hero background: brand's PRIMARY accent color (not dark). For beauty brands, the hero can also be a full-width lifestyle image with text overlay
- Product sections: WHITE backgrounds, lots of padding
- Product cards: slightly tinted background (#f3f3f3 or warmer shade matching brand)
- Trust bar + footer: dark (#222 or #111)
- Overall feel: LIGHT and CLEAN — white dominant, brand accent for hero and CTAs

## TECHNICAL RULES:
- TABLE-BASED layout with role="presentation" cellpadding="0" cellspacing="0" border="0"
- ALL styles INLINE. Only <style> block is @media queries
- 640px max container width (use 600px for luxury/beauty brands)
- Buttons MUST use table-cell pattern: <table><tr><td style="background-color:X; border-radius:Ypx; padding:16px 32px;"><a style="color:#fff; text-decoration:none; font-weight:700; display:inline-block;">Text</a></td></tr></table>
- Spacers: <div style="height:20px; line-height:20px; font-size:20px;">&nbsp;</div>
- All images: display:block; width:Xpx; height:auto; border:0;
- Preheader: <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">text &zwnj; padding</div>
- Mobile @media (max-width: 640px): .container{width:100%!important} .stack{display:block!important;width:100%!important} .mobile-pad{padding-left:20px!important;padding-right:20px!important} .product-card{display:block!important;width:100%!important;padding-bottom:16px!important} .banner-img{width:100%!important;height:auto!important} .hero-headline{font-size:32px!important;line-height:36px!important} .button{display:block!important;width:100%!important;box-sizing:border-box!important}
- Hotlink ALL images from the client's CDN — NEVER use placeholder URLs or make up image URLs

## VISUAL DENSITY RULES:
- Minimum 3-4 real images per email (hero + supporting). Text-only sections are the exception
- Model/lifestyle photos OVER flat product shots — they drive higher engagement
- Full-width banner images between sections for visual breathing room (0 padding, edge to edge)
- Each product card: real image (140px), name, subtitle, price in accent color, "Shop Now →" link
- Product cards: tinted bg (#f3f3f3), border-radius:8px, generous padding
- Educational sections NEED visual aids — never a wall of text

## SECTION STRUCTURE (8-12 sections, this order):
1. Preheader (hidden, specific, not generic)
2. Logo header (centered, linked to homepage)
3. Hero (accent color bg OR full-width image, overline label, 40px headline, CTA + optional discount code box)
4. Full-width lifestyle banner (real image from site, edge to edge)
5. Product section headline (overline + headline + subtext)
6. Product grid (2-3 column cards with images, prices, CTAs)
7. Featured/discovery block (gray card with larger image + copy)
8. Second full-width banner or brand logos row
9. Trust bar (dark bg, 3-column stats in accent color)
10. Why us / USP section (3-column icons + copy, white bg)
11. Educational content or blog section (optional, with image)
12. Footer (dark bg, company info, unsubscribe, legal)

## QUALITY BENCHMARKS:
- Each email: 300-400+ lines of HTML, 15-30KB
- 8+ distinct visual sections with varied backgrounds
- Real product images with real prices
- Copy that sounds like the brand, not generic ecommerce
- Discount code in styled box (not just text)
- Trust stats that are specific and believable
- NO invented product names or prices — use what's scraped, or omit
- NO placeholder image URLs — use real CDN URLs from the scraped data only

## KEY HTML PATTERNS (use these exact code patterns):

### Discount code box (on colored hero bg):
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
<td style="background-color:#ffffff; border-radius:6px; padding:14px 32px; text-align:center;">
<div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#4D4D4D;">Your code</div>
<div style="font-size:22px; font-weight:700; color:BRAND_COLOR; letter-spacing:2px;">WELCOME20</div>
</td></tr></table>

### Product card (in 33.33% td):
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f3f3f3; border-radius:8px;">
<tr><td align="center" style="padding:20px 12px 12px;"><img src="REAL_CDN_URL" width="140" style="display:block; width:140px; height:auto; border:0;"></td></tr>
<tr><td style="padding:4px 16px 20px; text-align:center;">
<div style="font-size:14px; font-weight:700; color:#222;">Product Name</div>
<div style="font-size:12px; color:#4D4D4D;">Subtitle</div>
<div style="height:6px;">&nbsp;</div>
<div style="font-size:16px; font-weight:700; color:BRAND_COLOR;">$X.XX</div>
<div style="height:10px;">&nbsp;</div>
<a href="#" style="font-size:12px; font-weight:700; text-transform:uppercase; text-decoration:none; color:BRAND_COLOR;">Shop Now →</a>
</td></tr></table>

### Trust bar (dark bg, 3 stats):
<tr><td style="background-color:#222;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
<td class="stack" width="33.33%" style="padding:24px 16px; text-align:center; border-right:1px solid #333;">
<div style="font-size:20px; font-weight:700; color:BRAND_COLOR;">25+</div>
<div style="font-size:11px; color:#999; text-transform:uppercase;">Years in business</div>
</td><!-- repeat 2 more --></tr></table></td></tr>

### Full-width banner (0 padding):
<tr><td style="padding:0; line-height:0; font-size:0;">
<img src="REAL_BANNER_URL" width="640" class="banner-img" style="display:block; width:100%; height:auto; border:0;">
</td></tr>

### CTA button (table-cell pattern, Outlook-safe):
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
<td style="background-color:BRAND_COLOR; border-radius:4px; padding:16px 32px;">
<a href="URL" style="color:#ffffff; text-decoration:none; font-size:14px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; display:inline-block;">Button Text</a>
</td></tr></table>

## BRAND-SPECIFIC EXAMPLES (adapt structure to match brand category):

### Sports/Active brand (like Sportland):
- Font: Barlow/Montserrat 700-900, uppercase headlines
- Hero: split layout (image left, text right on dark bg) OR full-color bg with bold text
- Category grid (Women/Men/Kids lifestyle images)
- Activity grid (Training/Running/Tennis photos)
- Brand logos row (Nike, Adidas, etc.)
- Border-radius: 4-6px (sharp, athletic feel)

### Beauty/Luxury brand (like Macta Beauty, Specler):
- Font: Georgia/serif 400 for headlines, Arial for body
- Hero: soft accent color bg (#E8877C coral, #EAE2DC warm beige) OR full-width lifestyle image
- Body bg: warm (#FDF6F4) not cold gray
- Product cards: softer tint, larger border-radius (12-16px)
- Lifestyle/model photos preferred over flat product shots
- Border-radius: 10-16px (soft, premium feel)

### General Retail/E-commerce (like Northerner):
- Font: Montserrat/sans-serif 400-700
- Hero: brand primary color bg with discount code box
- Body bg: neutral #f3f3f3
- Product cards: #f3f3f3 bg, border-radius:8px
- Trust bar with specific stats
- Border-radius: 4-8px (clean, professional)

Your output MUST be 300-400+ lines of rich HTML with 8+ sections, real images from scraped data, and brand-appropriate typography and colors. Never generic.`;

    const userPrompt = `Generate ${count} production-ready HTML email templates for this company:

## Brand Data
- **Company:** ${brandData.name}
- **Website:** ${brandData.url}
- **Description:** ${brandData.description || "N/A"}
- **Logo URL:** ${brandData.logo || "No logo found"}
- **Brand colors:** ${brandData.colors.length > 0 ? brandData.colors.join(", ") : "Use professional defaults"}
- **Fonts:** ${brandData.fonts.length > 0 ? brandData.fonts.join(", ") : "Use Arial/Helvetica"}
- **Brand tone/category:** ${(brandData as Record<string, unknown>).brandTone || "general e-commerce"}
- **Product categories on site:** ${(brandData as Record<string, unknown>).categories ? ((brandData as Record<string, unknown>).categories as string[]).join(", ") : "Unknown"}
- **Pages scraped:** ${(brandData as Record<string, unknown>).pagesScraped ? JSON.stringify((brandData as Record<string, unknown>).pagesScraped) : "homepage only"}
- **Products found:**
${brandData.products.length > 0 ? brandData.products.map((p) => `  - ${p.name}${p.price ? ` (${p.price})` : ""}${p.image ? ` [img: ${p.image}]` : ""}${"url" in p && p.url ? ` [link: ${p.url}]` : ""}`).join("\n") : "  - No products scraped, generate appropriate content based on the brand"}
- **Banner images (use for full-width sections):** ${!Array.isArray(brandData.images) && brandData.images?.banners ? brandData.images.banners.join(", ") : "None found"}
- **Brand/category logos:** ${!Array.isArray(brandData.images) && brandData.images?.brandLogos ? brandData.images.brandLogos.join(", ") : "None found"}
- **Trust/about icons:** ${!Array.isArray(brandData.images) && brandData.images?.trustIcons ? brandData.images.trustIcons.join(", ") : "None found"}
- **Blog/lifestyle images:** ${!Array.isArray(brandData.images) && brandData.images?.blogImages ? brandData.images.blogImages.join(", ") : "None found"}
- **Other lifestyle images:** ${!Array.isArray(brandData.images) && brandData.images?.lifestyleImages ? brandData.images.lifestyleImages.join(", ") : "None found"}

${context ? `## Additional context from the user:\n${context}\n` : ""}
${beforeImageContext ? `## Before email reference:\n${beforeImageContext}\n` : ""}

## Output format
Return a JSON array with ${count} objects. Each object has:
- "type": email type name (e.g. "Welcome", "Cart Abandon", "Post-Purchase", "Win-Back", "Browse Abandon", "Newsletter", etc.)
- "subject": email subject line
- "html": complete HTML email template (single string, no line breaks in the JSON value)

Choose the ${count} most impactful email types for this type of business.

IMPORTANT: Return ONLY valid JSON — no markdown, no code fences, no explanation. Just the JSON array.`;

    // Use streaming to avoid timeout on long generations
    let fullText = "";
    const stream = await client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 32000,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        fullText += event.delta.text;
      }
    }

    if (!fullText.trim()) {
      throw new Error("No text in Claude response");
    }

    // Parse JSON from response — handle potential markdown wrapping
    let jsonStr = fullText.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
    }

    const emails = JSON.parse(jsonStr);

    return NextResponse.json({ emails });
  } catch (err: unknown) {
    console.error("Generation error:", err);
    const message =
      err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
