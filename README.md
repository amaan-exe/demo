# Biriyani Station — Next.js Migration

This workspace contains a pragmatic Next.js migration of the original static site.

Quick steps to run locally:

1. Move the image files into a `public/` folder at the project root. Example:

```bash
mkdir public
mv photo-*.avif public/
```

2. Install and run:

```bash
npm install
npm run dev
```

Notes:
- The original `styles.css` was copied into `styles/globals.css` and is imported in `pages/_app.js`.
- Interactive behavior from `script.js` was ported into `pages/index.js` inside a `useEffect` to keep the UI identical.
- If images are not moved to `public/`, update the `<img src="/...">` paths accordingly.

Next steps you might want me to do:
- Move the image files into `public/` for you (requires copying binary files).
- Replace `dangerouslySetInnerHTML` uses with fully-typed React components for accessibility and better SEO.
- Add `next/image` optimization for images.
