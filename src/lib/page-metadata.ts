import type { Metadata } from "next";

/** Complete nested fields: Next replaces, rather than deep-merges, these. */
export function publicPageMetadata(
  path: string,
  title: string,
  description: string,
): Metadata {
  const socialTitle = `${title} · BEP AI Infrastructure Tracker`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: socialTitle,
      description,
      url: path,
      siteName: "BEP AI Infrastructure Tracker",
      type: "website",
      images: [{ url: "/og.png", width: 1200, height: 630, alt: socialTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: ["/og.png"],
    },
  };
}
