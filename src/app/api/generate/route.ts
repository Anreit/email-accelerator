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
  images: string[];
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

    const systemPrompt = `You are a world-class email marketing developer at scandiweb, a top e-commerce agency. You generate production-ready HTML email templates that look like they were designed by a professional email designer and coded by a senior developer.

## Your process:
Before generating, THINK about the business:
1. What do they sell? Who buys it? What's their brand personality?
2. What email types would have the MOST impact for this specific business?
3. What products/categories should be featured? What's the likely bestseller?
4. What's a reasonable discount offer for a welcome email? (Usually 10-20%)
5. What trust signals matter for this brand? (Years in business, reviews, shipping, guarantees)

## Email type selection (choose the most impactful for THIS business):
- **Welcome** — personalized greeting, welcome offer, bestseller showcase, brand story, trust signals
- **Abandoned Cart** — product card with image/price, urgency, shipping progress bar, cross-sell, social proof
- **Browse Abandonment** — "still looking?" with viewed products, alternatives, trust signals
- **Post-Purchase** — brand storytelling, loyalty/rewards onboarding, cross-sell complementary products
- **Win-Back** — new products since last visit, personalized offer, last order reference
- **Replenishment** — timed reorder reminder for consumable products
- **VIP/Loyalty** — exclusive access, early drops, loyalty tier rewards
- **Newsletter** — curated content, new arrivals, editorial + product mix
- **Back-in-Stock** — waitlist notification with urgency
- **Cross-Sell** — complementary product suggestions based on purchase history

## Technical rules:
- TABLE-BASED layout (not divs) — email client compatibility is critical
- ALL styles INLINE — no external stylesheets. Only <style> block allowed is @media queries for mobile
- 640px max container width
- Mobile responsive @media queries in <style> tag:
  .container { width: 100% !important; }
  .stack { display: block !important; width: 100% !important; }
  .mobile-pad { padding-left: 20px !important; padding-right: 20px !important; }
  .banner-img { width: 100% !important; height: auto !important; }
  .product-card { display: block !important; width: 100% !important; padding-bottom: 16px !important; }
  .hero-headline { font-size: 32px !important; line-height: 36px !important; }
  .section-headline { font-size: 22px !important; line-height: 26px !important; }
  .button { display: block !important; width: 100% !important; box-sizing: border-box !important; }
  .brand-cell { display: inline-block !important; width: 48% !important; }
  .trust-icon { width: 60px !important; height: 60px !important; }
- Use client's brand fonts via Google Fonts <link> in <head> when possible, with Arial/Helvetica fallbacks
- Hotlink ALL images directly from the client's website — never use placeholder URLs
- Use &nbsp; spacer divs for vertical spacing: <div style="height:20px; line-height:20px; font-size:20px;">&nbsp;</div>
- CTA buttons MUST use the table-cell pattern: <table><tr><td style="background-color:X; border-radius:4px; padding:16px 32px;"><a href="..." style="color:#fff; text-decoration:none; font-weight:700; display:inline-block;">Text</a></td></tr></table>
- Verify all product image URLs from the scraped data are real CDN URLs (not relative paths)

## REQUIRED sections — EVERY email must have ALL of these (8-12 sections minimum):
1. **Preheader** — hidden preview text, specific and compelling (not generic)
2. **Logo header** — centered logo image from their site, linked to homepage
3. **Hero section** — brand primary color background, overline label (small, uppercase, tracked), large headline (40px), subtext, and primary CTA button OR discount code box
4. **Full-width lifestyle/banner image** — a REAL image from their website (product lifestyle shot, category banner, etc.)
5. **Product grid** — 2-3 column table with product cards: each card has light gray (#f3f3f3) background, rounded corners, product image (from their CDN), product name, price, and "Shop Now →" link in brand color
6. **Secondary content block** — could be: discovery/sampler product, featured category, or "Not sure? Try X" recommendation
7. **Full-width promotional banner** — another real image from the site between sections
8. **Trust bar** — dark background (#222), 3-column: stat numbers in brand accent color, gray uppercase labels below (e.g. "25+ Years", "1M+ Customers", "Free Shipping over $X")
9. **Why us / USP section** — 3-column with icons or images from the site, headline + description per column
10. **Educational content** (optional but recommended) — blog link, how-to guide, category education with image
11. **Footer** — dark background, company name, address, unsubscribe + privacy links, legal disclaimers

## Design quality checklist:
- Proper visual hierarchy: overline labels (11px, uppercase, letter-spacing:2px), large headlines, body text
- Brand primary color for hero backgrounds and CTA buttons
- Product cards: background #f3f3f3, border-radius:8px, product image centered, name bold, price in brand color, "Shop Now →" link
- Full-width banners between content sections for visual breathing room
- Discount code: white box on colored background, "Your code" label above, code in 22px bold brand color
- Trust bar: premium feel with dark bg, accent-colored stat numbers, muted gray labels
- Footer: company address, year, unsubscribe link, privacy policy
- Each email must be 300-400+ lines of HTML — rich, detailed, visually varied

## What makes a BAD email (AVOID THIS):
- Only 3-5 sections with generic filler text
- No product images or real product data
- Generic colored rectangles without real photography
- "Shop Now" buttons with no surrounding context
- Missing trust signals and brand personality
- Under 200 lines of HTML
- Using placeholder image URLs instead of real ones from the scraped data

## What makes a GREAT email (AIM FOR THIS):
- 8+ distinct visual sections with varied backgrounds (white, gray, dark, brand color)
- Real product images with real prices from the scraped data
- Full-width lifestyle/promotional banners from the client's site
- A styled discount code box (white on colored bg)
- Brand personality in every line of copy — not generic
- Trust bar with specific, believable stats
- Educational/content section that adds value
- Looks like it was designed in Figma and hand-coded by a senior email developer

## CRITICAL DESIGN RULES:
- Hero background should use the brand's PRIMARY accent color (not dark/black). White text on colored bg.
- Product sections: WHITE backgrounds, clean, airy, lots of padding
- Product cards on light gray (#f3f3f3) with rounded corners
- Only trust bar and footer should be dark (#222)
- Overall email must feel LIGHT and CLEAN — white dominant, brand accent for hero and CTAs

## GOLD STANDARD REFERENCE — Your output MUST match this quality. Replace Northerner content with the target brand, but keep these exact HTML patterns:

\`\`\`html
<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="x-ua-compatible" content="ie=edge"><meta name="x-apple-disable-message-reformatting">
  <title>Welcome to Northerner</title>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&display=swap" rel="stylesheet">
  <style>
    @media only screen and (max-width: 640px) {
      .container { width: 100% !important; } .stack { display: block !important; width: 100% !important; }
      .mobile-pad { padding-left: 20px !important; padding-right: 20px !important; }
      .hero-headline { font-size: 32px !important; line-height: 36px !important; }
      .button { display: block !important; width: 100% !important; box-sizing: border-box !important; }
      .product-card { display: block !important; width: 100% !important; padding-bottom: 16px !important; }
      .brand-table { width: 100% !important; }
      .brand-cell { display: inline-block !important; width: 48% !important; padding-bottom: 12px !important; }
      .banner-img { width: 100% !important; height: auto !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#f3f3f3;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0;">Your 20% welcome discount is inside.</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f3f3f3;">
  <tr><td align="center" style="padding:0;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" class="container" style="width:640px; max-width:640px; margin:0 auto; background-color:#ffffff;">
    <!-- LOGO: white bg, centered -->
    <tr><td align="center" style="padding:24px 32px 20px; background-color:#ffffff;">
      <img src="LOGO_URL" width="180" alt="Logo" style="display:block; width:180px; height:auto; margin:0 auto; border:0;">
    </td></tr>
    <!-- HERO: brand accent color bg, NOT dark -->
    <tr><td style="background-color:#4C935A;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
        <td class="mobile-pad" style="padding:40px 48px; text-align:center; color:#ffffff;">
          <div style="font-family:Montserrat,Arial,sans-serif; font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:2px; color:#BED9CA;">Welcome to the family</div>
          <div style="height:14px; line-height:14px; font-size:14px;">&nbsp;</div>
          <div class="hero-headline" style="font-family:Montserrat,Arial,sans-serif; font-size:40px; line-height:44px; font-weight:700; color:#ffffff;">Your first order?<br>20% off.</div>
          <div style="height:16px; line-height:16px; font-size:16px;">&nbsp;</div>
          <div style="font-family:Montserrat,Arial,sans-serif; font-size:15px; line-height:24px; color:#e8f5e9;">We've been helping people find their perfect pouch since 1998.</div>
          <div style="height:24px; line-height:24px; font-size:24px;">&nbsp;</div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
            <td style="background-color:#ffffff; border-radius:6px; padding:14px 32px; text-align:center;">
              <div style="font-family:Montserrat,Arial,sans-serif; font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#4D4D4D;">Your code</div>
              <div style="font-family:Montserrat,Arial,sans-serif; font-size:22px; font-weight:700; color:#4C935A; letter-spacing:2px;">WELCOME20</div>
            </td>
          </tr></table>
          <div style="height:24px; line-height:24px; font-size:24px;">&nbsp;</div>
          <a href="#" class="button" style="display:inline-block; background-color:#ffffff; color:#4C935A; text-decoration:none; font-family:Montserrat,Arial,sans-serif; font-size:14px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; padding:16px 32px; border-radius:4px;">Shop Bestsellers</a>
        </td>
      </tr></table>
    </td></tr>
    <!-- FULL-WIDTH BANNER: 0 padding, edge to edge -->
    <tr><td style="padding:0; line-height:0; font-size:0;">
      <img src="BANNER_IMG_URL" width="640" class="banner-img" style="display:block; width:100%; height:auto; border:0;">
    </td></tr>
    <!-- BRANDS ROW -->
    <tr><td class="mobile-pad" style="padding:32px 40px 8px; background-color:#ffffff; text-align:center;">
      <div style="font-family:Montserrat,Arial,sans-serif; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:2px; color:#4C935A;">Brands you'll love</div>
      <div style="height:20px;">&nbsp;</div>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="brand-table" style="max-width:480px; margin:0 auto;"><tr>
        <td class="brand-cell" width="25%" align="center" style="padding:8px;"><img src="BRAND_IMG" width="80" style="width:80px; height:auto; border:0;"></td>
        <!-- repeat for each brand -->
      </tr></table>
    </td></tr>
    <!-- PRODUCT HEADLINE -->
    <tr><td class="mobile-pad" style="padding:36px 40px 8px; background-color:#ffffff; text-align:center;">
      <div style="font-family:Montserrat,Arial,sans-serif; font-size:24px; font-weight:700; color:#222222;">Here's what most people start with.</div>
      <div style="font-family:Montserrat,Arial,sans-serif; font-size:14px; color:#4D4D4D;">Our all-time bestsellers — trusted by over a million customers.</div>
    </td></tr>
    <!-- PRODUCT CARDS: 3-column, gray card bg -->
    <tr><td class="mobile-pad" style="padding:20px 24px 10px; background-color:#ffffff;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
        <td class="product-card stack" valign="top" width="33.33%" style="padding:8px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f3f3f3; border-radius:8px;">
            <tr><td align="center" style="padding:20px 12px 12px;"><img src="PRODUCT_IMG" width="140" style="display:block; width:140px; height:auto; border:0;"></td></tr>
            <tr><td style="padding:4px 16px 20px; text-align:center;">
              <div style="font-family:Montserrat,Arial,sans-serif; font-size:14px; font-weight:700; color:#222;">Product Name</div>
              <div style="font-family:Montserrat,Arial,sans-serif; font-size:12px; color:#4D4D4D;">Subtitle · Bestseller</div>
              <div style="height:6px;">&nbsp;</div>
              <div style="font-family:Montserrat,Arial,sans-serif; font-size:16px; font-weight:700; color:#4C935A;">$X.XX</div>
              <div style="height:10px;">&nbsp;</div>
              <a href="#" style="font-family:Montserrat,Arial,sans-serif; font-size:12px; font-weight:700; text-transform:uppercase; text-decoration:none; color:#4C935A;">Shop Now →</a>
            </td></tr>
          </table>
        </td>
        <!-- repeat for 2 more products -->
      </tr></table>
    </td></tr>
    <!-- FEATURED PRODUCT: gray inner card -->
    <tr><td class="mobile-pad" style="padding:20px 32px 28px; background-color:#ffffff;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f3f3f3; border-radius:8px;">
        <tr><td align="center" style="padding:24px 24px 0;"><img src="FEATURED_IMG" width="240" style="width:240px; height:auto; border:0; border-radius:8px;"></td></tr>
        <tr><td style="padding:20px 28px 24px; text-align:center;">
          <div style="font-family:Montserrat,Arial,sans-serif; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:#4C935A;">Not sure where to start?</div>
          <div style="font-family:Montserrat,Arial,sans-serif; font-size:18px; font-weight:700; color:#222;">Try the Discovery Pack</div>
          <div style="font-family:Montserrat,Arial,sans-serif; font-size:13px; color:#4D4D4D;">10 flavors, one box. Find your go-to.</div>
        </td></tr>
      </table>
    </td></tr>
    <!-- TRUST BAR: dark bg, 3 stats in accent color -->
    <tr><td style="background-color:#222222;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
        <td class="stack" width="33.33%" style="padding:24px 16px; text-align:center; border-right:1px solid #333;">
          <div style="font-family:Montserrat,Arial,sans-serif; font-size:20px; font-weight:700; color:#4C935A;">25+</div>
          <div style="font-family:Montserrat,Arial,sans-serif; font-size:11px; color:#999; text-transform:uppercase;">Years in business</div>
        </td>
        <td class="stack" width="33.33%" style="padding:24px 16px; text-align:center; border-right:1px solid #333;">
          <div style="font-family:Montserrat,Arial,sans-serif; font-size:20px; font-weight:700; color:#4C935A;">1M+</div>
          <div style="font-family:Montserrat,Arial,sans-serif; font-size:11px; color:#999; text-transform:uppercase;">Customers served</div>
        </td>
        <td class="stack" width="33.33%" style="padding:24px 16px; text-align:center;">
          <div style="font-family:Montserrat,Arial,sans-serif; font-size:20px; font-weight:700; color:#4C935A;">Free</div>
          <div style="font-family:Montserrat,Arial,sans-serif; font-size:11px; color:#999; text-transform:uppercase;">Shipping over $40</div>
        </td>
      </tr></table>
    </td></tr>
    <!-- WHY US: white bg, 3 columns -->
    <tr><td class="mobile-pad" style="padding:32px 40px; background-color:#ffffff; text-align:center;">
      <div style="font-family:Montserrat,Arial,sans-serif; font-size:20px; font-weight:700; color:#222;">Why Northerner?</div>
      <div style="height:24px;">&nbsp;</div>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
        <td width="33%" align="center" valign="top" style="padding:12px 8px;">
          <img src="ICON_URL" width="70" height="70" style="display:block; width:70px; height:70px; border:0; margin:0 auto;">
          <div style="height:12px;">&nbsp;</div>
          <div style="font-family:Montserrat,Arial,sans-serif; font-size:13px; font-weight:700; color:#222;">Lowest Prices</div>
          <div style="font-family:Montserrat,Arial,sans-serif; font-size:12px; color:#4D4D4D;">Bulk discounts up to 40% off</div>
        </td>
        <!-- repeat for 2 more -->
      </tr></table>
    </td></tr>
    <!-- FOOTER -->
    <tr><td class="mobile-pad" style="padding:24px 40px 16px; background-color:#222; text-align:center;">
      <div style="font-family:Montserrat,Arial,sans-serif; font-size:10px; color:#666;">
        Address | <a href="#" style="color:#666; text-decoration:underline;">Unsubscribe</a> | <a href="#" style="color:#666;">Privacy</a>
      </div>
    </td></tr>
  </table>
  </td></tr></table>
</body>
</html>
\`\`\`

IMPORTANT: The HTML above is the GOLD STANDARD. Your output MUST match this level of quality, structure, and design. Replace all Northerner content with the target brand's content, but keep the same HTML patterns, section order, and visual approach. Adapt colors, fonts, products, and copy — but the structure stays.`;

    const userPrompt = `Generate ${count} production-ready HTML email templates for this company:

## Brand Data
- **Company:** ${brandData.name}
- **Website:** ${brandData.url}
- **Description:** ${brandData.description || "N/A"}
- **Logo URL:** ${brandData.logo || "No logo found"}
- **Brand colors:** ${brandData.colors.length > 0 ? brandData.colors.join(", ") : "Use professional defaults"}
- **Fonts:** ${brandData.fonts.length > 0 ? brandData.fonts.join(", ") : "Use Arial/Helvetica"}
- **Products found:**
${brandData.products.length > 0 ? brandData.products.map((p) => `  - ${p.name}${p.price ? ` (${p.price})` : ""}${p.image ? ` [img: ${p.image}]` : ""}`).join("\n") : "  - No products scraped, generate appropriate content based on the brand"}
- **Images found:** ${brandData.images.slice(0, 6).join(", ") || "None"}

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
