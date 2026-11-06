# Hartley & Vane — Barbers

SimpleSites portfolio project 1. A concept website for a fictional premium barbershop in the fictional town of Kingsmere.

## Files

```
projects/barber-studio/
├── index.html        Page markup (all sections)
├── css/styles.css    All styles, organised by section, design tokens at the top
├── js/main.js        All behaviour; shop data (hours, services, barbers) at the top
├── assets/favicon.svg
└── README.md
```

No build step, frameworks or dependencies. Photography loads from Unsplash; fonts (Bodoni Moda, Figtree) from Google Fonts.

## Editing content

- **Prices, services, durations:** edit the `SERVICES` list at the top of `js/main.js`. The services section and the booking form both read from it.
- **Opening hours:** edit `HOURS` in `js/main.js` (used for the live "Open now" line, today's highlight and booking slots) and the hours table and footer in `index.html`.
- **Colours and type:** edit the tokens in the `:root` block at the top of `css/styles.css`.

## Preview locally

Open the folder in a terminal and run a simple server, then visit http://localhost:8000:

```
cd projects/barber-studio
python -m http.server 8000
```

Or in VS Code/WebStorm, use Live Server or the built-in "Open in browser". Double-clicking `index.html` also works.

## What is real and what is a demonstration

Working: responsive layout, mobile menu, smooth scrolling with active-link highlighting, expandable service list with "Book this" pre-fill, barber pre-fill, gallery lightbox (click, arrow keys, swipe, Escape), live open/closed status in UK time, booking form with service/barber/date/time selection, Monday closures, past-time blocking, validation and a summary.

Demonstration only: the booking form sends nothing and books nothing; available/taken time slots are simulated; the business, people, address, phone number (Ofcom drama range), email (`.example` domain), reviews and social links are fictional.
