import type { Metadata } from "next";
import { Fraunces, Instrument_Sans } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { ThemeRegistry } from "@/theme/ThemeRegistry";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import { NotificationProvider } from "@/components/organisms/NotificationProvider";
import { ConfirmProvider } from "@/lib/useConfirm";
import { GlobalLoaderProvider } from "@/lib/useGlobalLoader";

const instrumentSans = Instrument_Sans({
  variable: "--font-body",
  weight: ["400", "500", "600"],
  subsets: ["latin", "latin-ext"],
});

const fraunces = Fraunces({
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
      className={`${instrumentSans.variable} ${fraunces.variable} h-full antialiased`}
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
