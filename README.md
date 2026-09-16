# Portfolio

Single-page design portfolio: hero, a GSAP/ScrollTrigger sticky pinned card stack for case studies, and a contact section.

## Structure

- `index.html` — page markup
- `css/style.css` — all styles
- `js/main.js` — ScrollTrigger pin/tilt animation for the card stack

## Develop

```bash
npm install
npm run dev
```

Opens a static server at http://localhost:3000.

## Notes

- Most `.cs-device` cards in the case-study stack are empty placeholders except the "Connect your lock" screen — fill these in with real case-study content/screenshots.
- The contact button points to `mailto:hello@example.com` — update to a real address.
