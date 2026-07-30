import "./globals.css";

export const metadata = {
  title: "Visitor Check-in",
  description: "Visitor management for reception",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
