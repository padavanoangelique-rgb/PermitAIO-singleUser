import type { Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#156cdd",
};

export default function MeasureLayout({ children }: { children: React.ReactNode }) {
  return children;
}
