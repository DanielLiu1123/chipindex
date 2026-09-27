# ChipIndex UI visual system

This pass updates visual styling only. Existing product copy, controls, order, navigation, data calculations, and submission behavior remain unchanged.

![ChipIndex login preview](images/brand-login.png)

## Palette

The brand uses graphite black (`#242424`), warm off-white (`#f6f5f2`), and white surfaces. Dark mode uses charcoal (`#141414`), raised surfaces (`#1d1d1d`), and warm near-white text (`#efeee9`). Fine neutral borders separate surfaces without large shadows or saturated accents.

The original chip silhouette remains, recolored in graphite and porcelain. Profit, loss, live status, destructive actions, and chart series retain their original semantic colors: black is the brand color, while data colors continue to communicate meaning.

## Typography and components

Keep Geist and tabular numerals. Use medium-weight headings, precise spacing, 12px surface corners, and fine borders. Default buttons, inputs, selects, and toggles share a 40px height; the login controls use 48px. Retain existing compact variants for dense interfaces.

The shared shell uses a 1024px maximum width with 16px mobile and 32px desktop gutters. Tables scroll within their bordered surface. Forms retain their original maximum widths and field order. Existing links, labels, placeholders, button copy, loading text, and empty/error messages are preserved.

Use semantic tokens from `app/globals.css` and `.surface` for panels. Do not introduce promotional copy, new summary sections, icon-only replacements, or reordered controls as part of a styling change.
