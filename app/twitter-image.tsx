// Twitter/X link card uses the same image as Open Graph.
// Re-export the opengraph-image module wholesale so the image only renders once
// in code but Next.js generates both /opengraph-image and /twitter-image routes.
export { alt, size, contentType, default } from "./opengraph-image";
