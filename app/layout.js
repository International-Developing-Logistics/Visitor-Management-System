import "./globals.css";

const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME || "Reception";

export const metadata = {
  title: `${COMPANY_NAME} — Visitor Check-in`,
  description: "Visitor management for reception",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}