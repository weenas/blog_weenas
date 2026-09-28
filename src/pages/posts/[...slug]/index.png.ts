import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import satori from "satori";
import sharp from "sharp";
import { loadGoogleFont } from "@/utils/loadGoogleFont";
import { ogLogoDataUri } from "@/utils/ogLogo";
import { getPostSlug } from "@/utils/getPostPaths";
import { localizePostsForPaths } from "@/utils/postLocale";
import config from "@/config";

export async function getStaticPaths() {
  if (!config.features.dynamicOgImage) {
    return [];
  }

  // One image per post (translations share a URL); uses the default-locale version.
  const posts = await getCollection("posts").then(p =>
    localizePostsForPaths(p).filter(({ data }) => !data.ogImage)
  );

  return posts.map(post => ({
    params: { slug: getPostSlug(post.id, post.filePath) },
    props: post,
  }));
}

export const GET: APIRoute = async ({ props }) => {
  if (!config.features.dynamicOgImage) {
    return new Response(null, { status: 404, statusText: "Not found" });
  }

  // Every glyph drawn, including the transparent `"` spacer after "by".
  const ogText = `${props.data.title}by "${props.data.author}${config.site.title}`;

  const [regularData, boldData, cjkRegularData, cjkBoldData] =
    await Promise.all([
      // Satori needs ttf/otf, so fetch subsets instead of the site's woff2.
      loadGoogleFont("Google Sans Code", 400, ogText),
      loadGoogleFont("Google Sans Code", 700, ogText),
      loadGoogleFont("Noto Sans SC", 400, ogText),
      loadGoogleFont("Noto Sans SC", 700, ogText),
    ]);

  const svg = await satori(
    {
      type: "div",
      props: {
        style: {
          background: "#fefbfb",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        },
        children: [
          {
            type: "div",
            props: {
              style: {
                position: "absolute",
                top: "-1px",
                right: "-1px",
                border: "4px solid #000",
                background: "#ecebeb",
                opacity: "0.9",
                borderRadius: "4px",
                display: "flex",
                justifyContent: "center",
                margin: "2.5rem",
                width: "88%",
                height: "80%",
              },
            },
          },
          {
            type: "div",
            props: {
              style: {
                border: "4px solid #000",
                background: "#fefbfb",
                borderRadius: "4px",
                display: "flex",
                justifyContent: "center",
                margin: "2rem",
                width: "88%",
                height: "80%",
              },
              children: {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    margin: "20px",
                    width: "90%",
                    height: "90%",
                  },
                  children: [
                    {
                      type: "p",
                      props: {
                        style: {
                          fontSize: 72,
                          fontWeight: "bold",
                          maxHeight: "84%",
                          overflow: "hidden",
                        },
                        children: props.data.title,
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          justifyContent: "space-between",
                          width: "100%",
                          marginBottom: "8px",
                          fontSize: 28,
                        },
                        children: [
                          {
                            type: "span",
                            props: {
                              children: [
                                "by ",
                                {
                                  type: "span",
                                  props: {
                                    style: { color: "transparent" },
                                    children: '"',
                                  },
                                },
                                {
                                  type: "span",
                                  props: {
                                    style: {
                                      overflow: "hidden",
                                      fontWeight: "bold",
                                    },
                                    children: props.data.author,
                                  },
                                },
                              ],
                            },
                          },
                          {
                            type: "span",
                            props: {
                              style: {
                                display: "flex",
                                alignItems: "center",
                                overflow: "hidden",
                                fontWeight: "bold",
                              },
                              children: [
                                {
                                  type: "img",
                                  props: {
                                    src: ogLogoDataUri,
                                    width: 48,
                                    height: 40,
                                    style: { marginRight: 12 },
                                  },
                                },
                                config.site.title,
                              ],
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      embedFont: true,
      fonts: [
        {
          name: "Google Sans Code",
          data: regularData,
          weight: 400,
          style: "normal",
        },
        {
          name: "Google Sans Code",
          data: boldData,
          weight: 700,
          style: "normal",
        },
        {
          name: "Noto Sans SC",
          data: cjkRegularData,
          weight: 400,
          style: "normal",
        },
        {
          name: "Noto Sans SC",
          data: cjkBoldData,
          weight: 700,
          style: "normal",
        },
      ],
    }
  );

  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

  return new Response(new Uint8Array(pngBuffer), {
    headers: { "Content-Type": "image/png" },
  });
};
