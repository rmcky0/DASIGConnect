# DASIGConnect UI Skill — Agentic Design Consistency Prompt

> Paste this entire file at the start of any new conversation (or prepend it to any UI build request) to lock in the full DASIGConnect design system. The AI must follow every rule below before writing a single line of code.

---

## 1. What is DASIGConnect?

DASIGConnect is a **centralized social media content management and digital resource platform** built for the **DOST Acadême–Science and Innovation Group (DASIG)** — a consortium of Higher Education Institutions (HEIs) under DOST Region 7 in the Philippines. Member institutions include CIT-U, Silliman University, VSU, and other DASIG member schools.

**Core purpose:** Coordinate, validate, schedule, and publish event content (photos, videos, captions) to DASIG's official Facebook page across multiple independent contributing institutions.

**Three user roles:**
- **Contributor** — HEI staff/students who submit event content (photos, captions, media assets)
- **Validator** — Institution-level reviewers who approve or request revisions on submissions
- **Administrator** — DASIG central staff who oversee all institutions, manage users, and schedule Facebook publishing

**AI features:** Caption generation from uploaded images, content tagging suggestions, guardrail quality checks.

---

## 2. Design Identity

### 2.1 Conceptual Direction
> **"Institutional publishing studio"** — the intersection of Facebook's social familiarity, DOST's Philippine government/academic authority, and a modern editorial content tool. Professional and structured, but warm enough that non-technical content creators feel at home.

The product should feel like a **government-backed editorial platform**, not a startup SaaS tool. Every screen should communicate: *structured, trustworthy, and purpose-built for coordinated publishing.*

### 2.2 Theme Architecture
- **Auth pages / landing / login:** Dark theme — deep navy background, gold accents. Communicates authority and focus. This is the "front door" of an institution.
- **Dashboard / working pages:** Light theme — white surfaces, light gray canvas (`#F3F6FB`). Content-first, breathing, editorial. This is where work happens.
- **Modals / overlays:** Always dark-tinted overlay (`rgba(10,22,40,0.72)`) with white modal cards.

---

## 3. Color System

All pages must use these exact CSS variables. Never deviate.

```css
:root {
  /* === PRIMARY PALETTE === */
  --color-navy-deep:    #0A1628;   /* Dark auth backgrounds, header bars */
  --color-navy-mid:     #1A3A6B;   /* Sidebar, secondary surfaces */
  --color-blue-brand:   #2563EB;   /* Primary interactive: buttons, links, active states */
  --color-blue-fb:      #1877F2;   /* Facebook-flavored accent: publish actions, FB-linked elements */

  /* === SECONDARY PALETTE === */
  --color-gold:         #F59E0B;   /* DOST/publish energy: badges, highlights, CTAs on dark bg */
  --color-gold-light:   #FEF3C7;   /* Gold tint backgrounds */

  /* === SURFACE PALETTE === */
  --color-surface-0:    #FFFFFF;   /* Card surfaces */
  --color-surface-1:    #F3F6FB;   /* Page canvas / sidebar backgrounds */
  --color-surface-2:    #E8EDF5;   /* Input backgrounds, dividers */

  /* === TEXT === */
  --color-text-primary: #0A1628;   /* Body copy, labels */
  --color-text-secondary:#4B5563;  /* Subtext, metadata */
  --color-text-muted:   #9CA3AF;   /* Placeholders, disabled */
  --color-text-on-dark: #F0F4FF;   /* Text on navy backgrounds */

  /* === STATUS COLORS === */
  --color-success:      #10B981;
  --color-warning:      #F59E0B;
  --color-error:        #EF4444;
  --color-info:         #3B82F6;

  /* === BORDERS === */
  --color-border:       #D1D9EC;
  --color-border-focus: #2563EB;
}
```

---

## 4. Typography

**Always load both fonts from Google Fonts. Never substitute.**

```html
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,400&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
```

| Role | Font | Weight | Size Range |
|------|------|--------|-----------|
| Display / Page titles | **Fraunces** | 700 | 28–48px |
| Section headings | **Fraunces** | 600 | 20–28px |
| UI labels, nav, buttons | **Plus Jakarta Sans** | 600–700 | 12–16px |
| Body copy, descriptions | **Plus Jakarta Sans** | 400–500 | 14–16px |
| Metadata, timestamps, captions | **Plus Jakarta Sans** | 400 | 12–13px |
| Brand wordmark "DASIGConnect" | **Fraunces** italic 400 + **Plus Jakarta Sans** 700 combined | — | — |

```css
--font-display: 'Fraunces', Georgia, serif;
--font-body:    'Plus Jakarta Sans', system-ui, sans-serif;
```

---

## 5. Layout System

### 5.1 Auth Pages
```
Full viewport dark canvas (#0A1628)
  └── Centered card (max-width: 440px, white surface, border-radius: 20px)
        ├── Top: DASIGConnect logo + tagline
        ├── Middle: Form fields
        └── Bottom: Role indicator / institution selector
```
Background texture: subtle noise grain overlay at 4% opacity on the dark canvas.

### 5.2 Dashboard / App Pages (Light theme)
```
Full viewport
  ├── Top navbar (white, border-bottom, height: 64px)
  │     ├── Left: DASIGConnect logo
  │     ├── Center: Page title (Fraunces)
  │     └── Right: Institution badge + user avatar + notifications
  ├── Left sidebar (width: 240px, #F3F6FB bg, border-right)
  │     ├── Role label
  │     ├── Nav items (icon + label, active state: blue left-border + blue tint bg)
  │     └── Bottom: User card
  └── Main content area (padding: 32px, #F3F6FB)
        └── Page content
```

### 5.3 Complex Working Pages (e.g., Submission, Validation)
Three-column workspace:
```
[Left: Queue/List 280px] | [Center: Main form/detail] | [Right: Panels/Status 320px]
```

### 5.4 Spacing Scale
```css
--space-1: 4px;   --space-2: 8px;   --space-3: 12px;  --space-4: 16px;
--space-5: 20px;  --space-6: 24px;  --space-8: 32px;  --space-10: 40px;
--space-12: 48px; --space-16: 64px;
```

### 5.5 Border Radius
```css
--radius-sm: 6px;   /* inputs, chips */
--radius-md: 10px;  /* cards, panels */
--radius-lg: 16px;  /* modals, large cards */
--radius-xl: 20px;  /* auth card */
--radius-full: 9999px; /* pills, badges, avatars */
```

---

## 6. Component Patterns

### 6.1 Buttons
```css
/* Primary action */
.btn-primary {
  background: var(--color-blue-brand);
  color: white;
  font: 600 14px var(--font-body);
  padding: 10px 20px;
  border-radius: var(--radius-sm);
  border: none;
  cursor: pointer;
  transition: all 0.18s ease;
}
.btn-primary:hover { background: #1D4ED8; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(37,99,235,0.35); }

/* Facebook/Publish action */
.btn-publish {
  background: var(--color-blue-fb);
  /* same pattern */
}

/* Gold CTA (on dark backgrounds only) */
.btn-gold {
  background: var(--color-gold);
  color: var(--color-navy-deep);
  font-weight: 700;
}

/* Destructive */
.btn-danger { background: var(--color-error); color: white; }

/* Ghost */
.btn-ghost {
  background: transparent;
  border: 1.5px solid var(--color-border);
  color: var(--color-text-secondary);
}
```

### 6.2 Status Badges
Use pill shape (`border-radius: 9999px`), small (`padding: 3px 10px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em`).

| Status | Background | Text |
|--------|-----------|------|
| DRAFT | `#E8EDF5` | `#4B5563` |
| PENDING | `#FEF3C7` | `#92400E` |
| UNDER REVIEW | `#DBEAFE` | `#1E40AF` |
| APPROVED | `#D1FAE5` | `#065F46` |
| REJECTED | `#FEE2E2` | `#991B1B` |
| SCHEDULED | `#EDE9FE` | `#5B21B6` |
| PUBLISHED | `#1877F2` | `white` |

### 6.3 Cards
```css
.card {
  background: var(--color-surface-0);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-6);
  box-shadow: 0 1px 3px rgba(10,22,40,0.06);
}
```

### 6.4 Form Inputs
```css
.input {
  background: var(--color-surface-2);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 10px 14px;
  font: 400 14px var(--font-body);
  color: var(--color-text-primary);
  width: 100%;
  transition: border-color 0.15s ease;
}
.input:focus {
  outline: none;
  border-color: var(--color-border-focus);
  background: white;
  box-shadow: 0 0 0 3px rgba(37,99,235,0.12);
}
```

### 6.5 Navigation Item (Sidebar)
```css
.nav-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px;
  border-radius: var(--radius-sm);
  font: 500 14px var(--font-body);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}
.nav-item.active {
  background: #EBF2FF;
  color: var(--color-blue-brand);
  font-weight: 600;
  box-shadow: inset 3px 0 0 var(--color-blue-brand);
}
```

### 6.6 Guardrail / Status Check Items
Live quality check panels use icon + label + status indicator:
- ✅ Green (`#10B981`) — passed
- ⚠️ Amber (`#F59E0B`) — warning
- ❌ Red (`#EF4444`) — failed
- ○ Gray — not yet evaluated

### 6.7 Modals
```
Dark overlay (rgba(10,22,40,0.72)) + blur(4px)
White card, border-radius: 16px, max-width: 520px
Header: Fraunces 600 20px title + close button
Body: Plus Jakarta Sans 400 14px
Footer: right-aligned button row
```

---

## 7. Interaction & Animation Rules

- **Page load:** Staggered fade-in-up for main content blocks (`animation-delay: 0ms, 80ms, 160ms...`)
- **Hover on cards:** `translateY(-2px)` + shadow intensify, `transition: 0.2s ease`
- **Button press:** `scale(0.97)` on active
- **Status badge changes:** Cross-fade transition
- **Modals:** Fade in + scale from 0.95 to 1.0, `duration: 200ms`
- **Sidebar active:** Left border slides in, background tints
- **Deadline banners:** Pulse amber glow when approaching deadline (`@keyframes pulse-amber`)
- **Media carousel:** Smooth slide transition, `transition: transform 0.35s cubic-bezier(0.4,0,0.2,1)`
- **No gratuitous motion.** Animations serve clarity and feedback, not decoration.

---

## 8. Iconography

Use **Lucide Icons** (via CDN or React import). Stroke width: `1.5px`. Size: `16px` for inline/nav, `20px` for action icons, `24px` for empty states.

```html
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
```

Common icons by context:
- Submissions: `file-plus`, `upload`, `image`, `video`
- Validation: `check-circle`, `x-circle`, `clock`, `alert-triangle`
- Scheduling: `calendar`, `clock`, `send`
- Facebook: use an SVG `f` logo in `#1877F2`
- Institution: `building-2`
- User/role: `user`, `shield`, `users`

---

## 9. Institution & Role Data (Use These Exact Names)

**DASIG Member Institutions:**
- Cebu Institute of Technology – University (CIT-U)
- Silliman University
- Visayas State University (VSU)
- University of San Carlos (USC)
- *(+ other DOST Region 7 member HEIs)*

**User Roles:** Contributor · Validator · Administrator

**Platform name:** Always written as **DASIGConnect** (one word, camel case). Never "DASIG Connect" (with space) in UI headings.

**Tagline options (use contextually):**
- *"Coordinating DASIG's story, one post at a time."*
- *"The content hub for DASIG member institutions."*
- *"From campus to feed — structured, validated, published."*

---

## 10. Page-Specific Rules

### Auth / Login Page
- Dark canvas (`#0A1628`) with subtle grain texture
- Centered white card, `border-radius: 20px`, `padding: 48px`
- Logo top-center: Fraunces italic "DASIGConnect" in gold
- Subtitle: institution selector dropdown
- Role description shown contextually below form
- No header/sidebar — standalone page

### Contributor Dashboard / Submission Page
- Light theme, three-column layout
- Left: Submission queue (filterable, sortable)
- Center: SubmissionFormPage with MediaUploadZone (filmstrip previews)
- Right: GuardRailStatusPanel (live animated checks) + SlotPicker

### Validator Dashboard / Validation Page
- Light theme, master-detail split
- Left: ValidationQueuePage (filtered by institution, deadline-sorted)
- Right: SubmissionReviewPanel (MediaPreviewCarousel dominant top, RevisionHistoryBlock bottom)
- ValidationDeadlineBanner: sticky top, pulses amber when < 24h remain
- Action buttons (Approve / Request Revision / Reject): large, weighted, color-coded

### Admin Dashboard
- Light theme, full overview
- Aggregate stats across all institutions
- Scheduling calendar / timeline view
- User management table

---

## 11. Pre-Build Checklist (AI Must Verify Before Writing Code)

Before writing any HTML/CSS/JS for a DASIGConnect page, confirm:

- [ ] Which module and page is this? (e.g., UC-1.3 Submission, UC-2.1 Validation)
- [ ] Which user role does this page serve? (Contributor / Validator / Admin)
- [ ] Is this an auth page (dark) or a working page (light)?
- [ ] Are both Google Fonts loaded (Fraunces + Plus Jakarta Sans)?
- [ ] Are all CSS variables declared from Section 3?
- [ ] Does the layout follow the correct template from Section 5?
- [ ] Are status badges using the exact colors from Section 6.2?
- [ ] Are institution names from Section 9 used in sample data?
- [ ] Is animation scoped and purposeful (Section 7)?
- [ ] Does the design feel like a **government-backed institutional publishing studio**, not a generic SaaS dashboard?

---

## 12. Full HTML Boilerplate

Every DASIGConnect HTML file starts with this shell:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>[Page Name] — DASIGConnect</title>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,400&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --color-navy-deep: #0A1628;
      --color-navy-mid: #1A3A6B;
      --color-blue-brand: #2563EB;
      --color-blue-fb: #1877F2;
      --color-gold: #F59E0B;
      --color-gold-light: #FEF3C7;
      --color-surface-0: #FFFFFF;
      --color-surface-1: #F3F6FB;
      --color-surface-2: #E8EDF5;
      --color-text-primary: #0A1628;
      --color-text-secondary: #4B5563;
      --color-text-muted: #9CA3AF;
      --color-text-on-dark: #F0F4FF;
      --color-success: #10B981;
      --color-warning: #F59E0B;
      --color-error: #EF4444;
      --color-info: #3B82F6;
      --color-border: #D1D9EC;
      --color-border-focus: #2563EB;
      --font-display: 'Fraunces', Georgia, serif;
      --font-body: 'Plus Jakarta Sans', system-ui, sans-serif;
      --radius-sm: 6px; --radius-md: 10px; --radius-lg: 16px;
      --radius-xl: 20px; --radius-full: 9999px;
    }

    body {
      font-family: var(--font-body);
      color: var(--color-text-primary);
      background: var(--color-surface-1);
      min-height: 100vh;
    }

    /* === INSERT PAGE STYLES BELOW === */
  </style>
</head>
<body>

  <!-- === INSERT PAGE MARKUP BELOW === -->

  <script>
    lucide.createIcons();
    // === INSERT PAGE SCRIPTS BELOW ===
  </script>
</body>
</html>
```

---

*End of DASIGConnect UI Skill — v1.0*
*Authored from design decisions established across Modules 1 and 2 of the DASIGConnect UI build.*
