import Link from "next/link";

export default function NotFound() {
  return (
    <main className="kiosk-shell">
      <div className="card" style={{ textAlign: "center" }}>
        <h2>Page not found</h2>
        <p className="helper-text" style={{ marginBottom: 20 }}>
          That page doesn't exist, or the link may be out of date.
        </p>
        <Link href="/">
          <button className="btn btn-primary" style={{ marginTop: 0 }}>
            Go to homepage
          </button>
        </Link>
      </div>
    </main>
  );
}
