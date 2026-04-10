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
- Looks like it was designed in Figma and hand-coded by a senior email developer`;

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

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 32000,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });

    // Extract text from response
    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text in Claude response");
    }

    // Parse JSON from response — handle potential markdown wrapping
    let jsonStr = textBlock.text.trim();
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
