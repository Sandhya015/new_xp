# CSS & Styling in XpertIntern Frontend

Quick reference for how styling works in this project. Use this when continuing work tomorrow or for consistency across pages.

---

## Stack

- **Tailwind CSS v3** — utility-first; all component styles are `className` with Tailwind classes.
- **PostCSS** — `postcss.config.js` runs `tailwindcss` + `autoprefixer`.
- **Global CSS** — `src/index.css`: Tailwind layers + a few custom rules (e.g. marquee).

No separate CSS modules or Sass; everything goes through Tailwind + `index.css`.

---

## Color Palette (tailwind.config.js)

Use these tokens so the site stays on-brand.

| Token | Usage |
|-------|--------|
| **brand-navy** | `#1E3A5F` — headers, primary headings, dark sections |
| **brand-accent** | `#2563EB` — CTAs, buttons, links, active states |
| **brand-light-bg** | `#EFF6FF` — section backgrounds, card tints |
| **primary-*** | 50–950 — blue scale; e.g. `primary-600` for hover, `primary-200` for light accents |
| **slate-gray** | `#6B7280` — body text, subtitles, meta |
| **success-green** | `#16A34A` — success, checkmarks, positive |
| **warning-orange** | `#EA580C` — badges (e.g. “Most Popular”), warnings |
| **error-red** | `#DC2626` — errors, destructive |
| **violet-500** | `#7C3AED` — accent (e.g. internship icon) |
| **teal-600** | `#059669` — accent (e.g. training modes icon) |

**Examples in code:**

- Backgrounds: `bg-brand-navy`, `bg-brand-light-bg`, `bg-primary-950`
- Text: `text-brand-navy`, `text-slate-gray`, `text-white`
- Buttons: `bg-brand-accent`, `hover:bg-primary-600`
- Borders: `border-primary-200`, `border-white/10`

---

## Typography

- **Font:** Inter (loaded in `index.html`), applied via `font-sans` in Tailwind.
- **Base:** `body` in `index.css` has `font-sans text-gray-800 antialiased bg-white`.
- Headings: usually `text-3xl font-bold text-brand-navy`; section tags: `text-sm font-medium text-brand-navy`.

---

## Layout Patterns

- **Sections:** `py-16` or `py-20`, content in `mx-auto max-w-7xl px-4 sm:px-6 lg:px-8`.
- **Cards:** `rounded-xl border border-gray-200 bg-white p-6 shadow-sm`.
- **Pills/tags:** `rounded-full` or `rounded-lg` + `bg-brand-light-bg border border-primary-200 px-4 py-1.5 text-sm font-medium text-brand-navy`.
- **Buttons (primary):** `rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 transition`.
- **Buttons (outline):** `rounded-lg border-2 border-brand-accent bg-white ... text-brand-accent hover:bg-brand-light-bg`.

---

## Custom CSS (index.css)

- **Scroll:** `html { scroll-smooth }`.
- **Marquee:** `.animate-marquee` uses a keyframe that translates `-50%` for the “Top Universities” strip; `prefers-reduced-motion: reduce` turns the animation off.

Any new global style (e.g. another animation) should go in `index.css` and, if it’s a theme value, optionally be wired in `tailwind.config.js` (e.g. `animation`, `keyframes`).

---

## Responsive Design

The platform is responsive across **mobile, tablet, and desktop**. Breakpoints follow Tailwind defaults:

- **Default:** &lt; 640px (mobile)
- **sm:** ≥ 640px
- **md:** ≥ 768px (tablet)
- **lg:** ≥ 1024px (desktop)
- **xl:** ≥ 1280px

**Conventions:**

- **Containers:** Use `min-w-0` on flex/grid children and main content to prevent overflow on small screens.
- **Section padding:** `py-12 sm:py-16 lg:py-20` (tighter on mobile).
- **Headings:** `text-2xl sm:text-3xl` or `text-3xl sm:text-4xl` so they scale down on mobile.
- **Touch targets:** Buttons and nav links use `min-h-[44px]` on mobile for accessibility.
- **Inputs:** `text-base sm:text-sm` to avoid zoom on focus on iOS; `min-w-0` to avoid overflow.
- **Grids:** `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` (single column on mobile where appropriate).
- **Navbar:** Links hidden below `md`, hamburger menu with scrollable drawer; logo and CTA buttons remain visible.
- **Body:** `overflow-x: hidden` in `index.css`; root layout has `overflow-x-hidden` and `main` has `min-w-0`.
- **Images/media:** `max-width: 100%; height: auto` in base styles.

---

## Component-Level Conventions

- No inline `style` unless dynamic (e.g. calculated width); use Tailwind classes.
- Spacing: `gap-4`, `gap-6`, `space-y-2`, `mt-4`, etc.
- Responsive: `sm:`, `md:`, `lg:` prefixes (e.g. `md:grid-cols-3`, `lg:flex`).
- Transitions: `transition` and `hover:` / `focus:` where needed.
- Icons: Lucide React; size/color via `className` (e.g. `h-5 w-5 text-brand-accent`).

---

## File to Touch for Styling

- **Theme (colors, font):** `frontend/tailwind.config.js`
- **Global/base + custom animations:** `frontend/src/index.css`
- **Per-page/per-component:** Tailwind classes in the relevant `.tsx` files.

When you continue tomorrow, keep using these tokens and patterns so the look stays consistent with the current homepage and footer.
