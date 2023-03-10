import { defineConfig } from "astro/config";
import compress from "astro-compress";
import tailwind from "@astrojs/tailwind";
import mdx from "@astrojs/mdx";
import image from "@astrojs/image";
import astroLayouts from "astro-layouts";
import codeTitle from "remark-code-title";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGfm from 'remark-gfm';

// https://astro.build/config
export default defineConfig({
  site: "https://Levyathanus.github.io",
  base: "/betsie",
  output: "static",
  build: {
    format: "file",
  },
  markdown: {
    shikiConfig: {
      theme: "slack-dark",
    },
    remarkPlugins: [
      [
        astroLayouts,
        {
          "pages/*.mdx": "@layouts/BlogLayout.astro",
        },
      ],
      codeTitle,
      remarkMath,
      remarkGfm,
    ],
    rehypePlugins: [
      [
        rehypeKatex, {
        macros: {
          '\\E': '\\mathbb{E}',
          '\\C': '\\mathbb{C}',
          '\\R': '\\mathbb{R}',
          '\\N': '\\mathbb{N}',
          '\\Q': '\\mathbb{Q}',
          '\\P': '\\mathbf{P}',
          '\\x': '\\mathbf{x}',
          '\\c': '\\mathbf{c}',
          '\\bigO': '\\mathcal{O}',
          '\\abs': '|#1|',
          '\\set': '\\{ #1 \\}',
          '\\indep': "{\\perp\\mkern-9.5mu\\perp}",
          '\\nindep': "{\\not\\!\\perp\\!\\!\\!\\perp}",
          "\\latex": "\\LaTeX",
          "\\katex": "\\KaTeX",
        },
      }],
    ],
  },
  integrations: [
    compress({
      css: true,
      html: true,
      js: true,
      img: true,
      svg: true,
      logger: 0,
    }),
    tailwind(),
    mdx({
      extendPlugins: "markdown",
    }),
    image({
      serviceEntryPoint: "@astrojs/image/sharp",
    }),
  ],
});
