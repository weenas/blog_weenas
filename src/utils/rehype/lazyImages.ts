type Node = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: Node[];
};

/**
 * Adds `loading="lazy"` and `decoding="async"` to images in post bodies so
 * off-screen images don't block the first paint. The first image is left
 * eager because it is often above the fold.
 */
export default function rehypeLazyImages() {
  return (tree: Node) => {
    let seenFirst = false;
    const visit = (node: Node) => {
      if (node.type === "element" && node.tagName === "img") {
        node.properties ??= {};
        node.properties.decoding ??= "async";
        if (seenFirst) node.properties.loading ??= "lazy";
        seenFirst = true;
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}
