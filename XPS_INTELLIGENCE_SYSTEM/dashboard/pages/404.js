// dashboard/pages/404.js
// Custom 404 page for GitHub Pages / static export

import React from "react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div style={styles.page}>
      <div style={styles.box}>
        <div style={styles.code}>404</div>
        <h1 style={styles.title}>Page Not Found</h1>
        <p style={styles.desc}>The page you requested could not be found.</p>
        <Link href="/" style={styles.btn}>
          ⚡ Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

const styles = {
  page: {
    background: "#000",
    minHeight: "100vh",
    color: "#fff",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  box: {
    textAlign: "center",
    padding: "3rem",
  },
  code: {
    fontSize: "6rem",
    fontWeight: 900,
    color: "#FFD700",
    lineHeight: 1,
    marginBottom: "1rem",
  },
  title: {
    fontSize: "1.75rem",
    fontWeight: 700,
    marginBottom: "0.75rem",
  },
  desc: {
    color: "#666",
    fontSize: "1rem",
    marginBottom: "2rem",
  },
  btn: {
    display: "inline-block",
    background: "transparent",
    border: "1px solid #FFD700",
    borderRadius: "8px",
    color: "#FFD700",
    padding: "0.75rem 1.5rem",
    textDecoration: "none",
    fontSize: "1rem",
    fontWeight: 600,
  },
};
