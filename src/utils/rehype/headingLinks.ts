import rehypeAutolinkHeadings from "rehype-autolink-headings";
import type { Options } from "rehype-autolink-headings";

/**
 * Appends a "#" permalink to h2–h6 at build time (previously added by a
 * client script). Must run after rehypeHeadingIds so headings have ids.
 */
export const headingLinks: [typeof rehypeAutolinkHeadings, Options] = [
  rehypeAutolinkHeadings,
  {
    behavior: "append",
    test: ["h2", "h3", "h4", "h5", "h6"],
    headingProperties: { className: ["group"] },
    properties: {
      className: [
        "heading-link",
        "ms-2",
        "no-underline",
        "opacity-75",
        "md:opacity-0",
        "md:group-hover:opacity-100",
        "md:focus:opacity-100",
      ],
    },
    content: {
      type: "element",
      tagName: "span",
      properties: { ariaHidden: "true" },
      children: [{ type: "text", value: "#" }],
    },
  },
];
