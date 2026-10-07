import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { ThemeRegistry } from "@/theme/ThemeRegistry";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import { NotificationProvider } from "@/components/organisms/NotificationProvider";
import { ConfirmProvider } from "@/lib/useConfirm";
import { GlobalLoaderProvider } from "@/lib/useGlobalLoader";

const barlow = Barlow({
  variable: "--font-body",
  weight: ["400", "500", "600"],
  subsets: ["latin", "latin-ext"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-display",
  weight: ["500", "600"],
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Altamar Sea Food",
  description: "Compras, inventario por kilo, ventas y cobros de Altamar Sea Food",
};

const VALID_MODES = ["light", "dark"] as const;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const cookieStore = await cookies();
  const mode = cookieStore.get("mui-mode")?.value;

  const colorScheme = VALID_MODES.includes(mode as (typeof VALID_MODES)[number])
    ? mode
    : null;

  return (
    <html
      lang="es"
      className={`${barlow.variable} ${barlowCondensed.variable} h-full antialiased`}
      suppressHydrationWarning
      data-mui-color-scheme={colorScheme ?? undefined}
    >
      <body className="min-h-full flex flex-col">
        <InitColorSchemeScript defaultMode="system" />
        <ThemeRegistry>
          <NotificationProvider>
            <ConfirmProvider>
              <GlobalLoaderProvider>{children}</GlobalLoaderProvider>
            </ConfirmProvider>
          </NotificationProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}
