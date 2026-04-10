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

    const systemPrompt = `You are a world-class email marketing developer at a top e-commerce agency. You generate production-ready HTML email templates that look like they were designed by a professional email designer and coded by a senior developer.

## Technical rules:
- TABLE-BASED layout (not divs) — email client compatibility is critical
- ALL styles INLINE — no external stylesheets. Only <style> block allowed is @media queries
- 640px max container width
- Mobile responsive @media queries: .container { width: 100% !important; } .stack { display: block !important; width: 100% !important; } .mobile-pad { padding-left: 20px !important; padding-right: 20px !important; } .banner-img { width: 100% !important; height: auto !important; } .product-card { display: block !important; width: 100% !important; }
- Use client's brand colors, logo, fonts (with Arial/Helvetica fallbacks)
- Hotlink images directly from client's website
- Use &nbsp; spacer divs for vertical spacing (email-safe)
- CTA buttons MUST use the table-cell pattern (not just <a> tags)

## REQUIRED sections — EVERY email must have ALL of these (8-12 sections minimum):
1. **Preheader** — hidden preview text, specific and compelling
2. **Logo header** — centered logo from their site
3. **Hero section** — bold colored background, large headline, subtext, primary CTA button
4. **Full-width lifestyle/banner image** — use a real image from their site
5. **Product grid** — 2-3 column product cards with images, names, prices, individual "Shop Now" links
6. **Secondary content block** — discovery section, featured category, or educational content
7. **Trust bar** — dark background, 3-column stats (years in business, customers served, shipping)
8. **Social proof / Why us section** — 3-column with icons, trust signals, USPs
9. **Footer** — dark background, company info, unsubscribe link, legal text

## Design quality requirements:
- Use proper visual hierarchy: overline labels (small, uppercase, tracked), large headlines, body text
- Use the brand's primary color for hero backgrounds and CTA buttons
- Product cards should have background-color containers (light gray #f3f3f3), rounded corners, product image, name, price, and "Shop Now →" link
- Include full-width banner images between content sections for visual breaks
- Trust bar should feel premium: dark background (#222), green/accent stat numbers, gray labels
- Make the discount code stand out: white box on colored background, code in large bold text
- Footer should include: company name, address, unsubscribe link, privacy policy link
- Each email should be 300-400 lines of HTML — rich and detailed, not minimal

## What makes a BAD email (AVOID):
- Only 3-4 sections with generic text
- No product images or real product names
- Simple colored rectangles with text
- Generic CTAs like "Shop Now" with no context
- Missing trust signals, social proof, or brand personality
- Under 200 lines of HTML

## What makes a GREAT email (AIM FOR THIS):
- 8+ distinct visual sections
- Real product images with prices from the scraped data
- Full-width lifestyle banners breaking up content
- A visible discount code in a styled box
- Brand personality in the copy
- Trust bar with specific stats
- Educational/content section
- Looks like it was designed in Figma and hand-coded`;

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
