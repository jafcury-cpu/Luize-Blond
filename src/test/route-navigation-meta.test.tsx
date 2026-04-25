import { describe, it, expect, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { act } from "react";
import { BRAND, SITE_DESCRIPTION, useDocumentTitle } from "@/hooks/use-document-title";

function ensureMeta(selector: string, attr: "name" | "property", key: string) {
  if (!document.querySelector(selector)) {
    const m = document.createElement("meta");
    m.setAttribute(attr, key);
    m.setAttribute("content", "");
    document.head.appendChild(m);
  }
}

beforeEach(() => {
  cleanup();
  document.head.innerHTML = "";
  ensureMeta('meta[name="description"]', "name", "description");
  ensureMeta('meta[property="og:title"]', "property", "og:title");
  ensureMeta('meta[property="og:description"]', "property", "og:description");
  ensureMeta('meta[name="twitter:title"]', "name", "twitter:title");
  ensureMeta('meta[name="twitter:description"]', "name", "twitter:description");
});

function PageMock({ title }: { title: string }) {
  useDocumentTitle(title);
  return <div>{title}</div>;
}

function App({ initialPath }: { initialPath: string }) {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/dashboard" element={<PageMock title="Dashboard" />} />
        <Route path="/chat" element={<PageMock title="Chat" />} />
        <Route path="/financeiro" element={<PageMock title="Financeiro" />} />
      </Routes>
    </MemoryRouter>
  );
}

function getMeta(selector: string) {
  return document.querySelector<HTMLMetaElement>(selector)?.getAttribute("content") ?? "";
}

function assertMetaForTitle(pageTitle: string) {
  const expected = `${pageTitle} · ${BRAND}`;
  expect(document.title).toBe(expected);
  expect(getMeta('meta[property="og:title"]')).toBe(expected);
  expect(getMeta('meta[name="twitter:title"]')).toBe(expected);
  expect(getMeta('meta[name="description"]')).toBe(SITE_DESCRIPTION);
  expect(getMeta('meta[property="og:description"]')).toBe(SITE_DESCRIPTION);
  expect(getMeta('meta[name="twitter:description"]')).toBe(SITE_DESCRIPTION);
}

describe("Navegação entre rotas — meta tags atualizam no browser", () => {
  it("atualiza title e meta tags ao navegar /dashboard → /chat → /financeiro", () => {
    const { rerender, unmount } = render(<App initialPath="/dashboard" />);
    assertMetaForTitle("Dashboard");

    // Simula navegação remontando o roteador no novo path
    unmount();
    rerender(<App initialPath="/chat" />);
    assertMetaForTitle("Chat");

    cleanup();
    render(<App initialPath="/financeiro" />);
    assertMetaForTitle("Financeiro");
  });

  it("ao retornar para /dashboard, restaura title e meta tags consistentes", () => {
    render(<App initialPath="/financeiro" />);
    assertMetaForTitle("Financeiro");

    cleanup();
    document.head.innerHTML = "";
    ensureMeta('meta[name="description"]', "name", "description");
    ensureMeta('meta[property="og:title"]', "property", "og:title");
    ensureMeta('meta[property="og:description"]', "property", "og:description");
    ensureMeta('meta[name="twitter:title"]', "name", "twitter:title");
    ensureMeta('meta[name="twitter:description"]', "name", "twitter:description");

    render(<App initialPath="/dashboard" />);
    assertMetaForTitle("Dashboard");
  });
});
