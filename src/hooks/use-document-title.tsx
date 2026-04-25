import { useEffect } from "react";

export const BRAND = "Luize Blond";
export const SITE_DESCRIPTION =
  "ZARQA ٢٨ — Chief of Staff Digital. Painel executivo privado para coordenar agenda, finanças, saúde e documentos.";

function setMeta(selector: string, value: string) {
  const el = document.querySelector<HTMLMetaElement>(selector);
  if (el) el.setAttribute("content", value);
}

/**
 * Atualiza o document.title por rota e mantém uma descrição padrão única
 * em description, og:description e twitter:description para evitar divergências.
 * og:title e twitter:title acompanham o title da rota.
 */
export function useDocumentTitle(pageTitle?: string) {
  useEffect(() => {
    const previousTitle = document.title;
    const fullTitle = pageTitle ? `${pageTitle} · ${BRAND}` : BRAND;
    document.title = fullTitle;

    setMeta('meta[name="description"]', SITE_DESCRIPTION);
    setMeta('meta[property="og:title"]', fullTitle);
    setMeta('meta[property="og:description"]', SITE_DESCRIPTION);
    setMeta('meta[name="twitter:title"]', fullTitle);
    setMeta('meta[name="twitter:description"]', SITE_DESCRIPTION);

    return () => {
      document.title = previousTitle;
    };
  }, [pageTitle]);
}
