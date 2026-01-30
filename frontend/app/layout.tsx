import type { ReactNode } from "react";

export const metadata = {
  title: "OB Resident Scheduler",
  description: "OB anesthesia rotation scheduling app",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "Arial, sans-serif", margin: 0 }}>{children}</body>
    </html>
  );
}
