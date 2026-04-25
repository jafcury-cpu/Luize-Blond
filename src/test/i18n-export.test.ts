import { describe, expect, it } from "vitest";
import { dictionary } from "@/lib/i18n";
import { buildI18nExport, validateEntries } from "@/lib/i18n-export";

describe("i18n-export", () => {
  it("dicionário não tem chaves ou valores vazios", () => {
    for (const [k, v] of Object.entries(dictionary)) {
      expect(k.length, `chave vazia: ${k}`).toBeGreaterThan(0);
      expect(typeof v).toBe("string");
      expect((v as string).length, `valor vazio em ${k}`).toBeGreaterThan(0);
    }
  });

  it("validateEntries aceita o dicionário completo", () => {
    const entries = Object.entries(dictionary) as [string, string][];
    expect(() => validateEntries(entries, { requireFull: true })).not.toThrow();
  });

  it("validateEntries rejeita valor vazio", () => {
    expect(() =>
      validateEntries([["brand.name", ""]], { requireFull: false }),
    ).toThrow(/Valor vazio/);
  });

  it("validateEntries rejeita chave duplicada", () => {
    expect(() =>
      validateEntries(
        [
          ["brand.name", "Luize"],
          ["brand.name", "Outro"],
        ],
        { requireFull: false },
      ),
    ).toThrow(/duplicada/);
  });

  it("validateEntries rejeita chave fora do dicionário", () => {
    expect(() =>
      validateEntries([["nao.existe", "x"]], { requireFull: false }),
    ).toThrow(/não pertence/);
  });

  it("validateEntries rejeita export completo incompleto", () => {
    const partial = (Object.entries(dictionary) as [string, string][]).slice(0, 3);
    expect(() => validateEntries(partial, { requireFull: true })).toThrow(
      /incompleto/,
    );
  });

  it("buildI18nExport(json) retorna todas as chaves", () => {
    const out = buildI18nExport("json");
    const parsed = JSON.parse(out.content) as Record<string, string>;
    expect(out.format).toBe("json");
    expect(out.totalKeys).toBe(Object.keys(dictionary).length);
    expect(Object.keys(parsed).sort()).toEqual(
      Object.keys(dictionary).sort(),
    );
    expect(out.mime).toBe("application/json");
    expect(out.filename).toMatch(/completo\.json$/);
  });

  it("buildI18nExport(csv) tem header + 1 linha por chave", () => {
    const out = buildI18nExport("csv");
    const lines = out.content.split("\n");
    expect(lines[0]).toBe("key,value");
    expect(lines.length).toBe(Object.keys(dictionary).length + 1);
    expect(out.mime).toBe("text/csv");
  });

  it("buildI18nExport(csv) escapa vírgulas, aspas e quebras de linha", () => {
    const tricky: [string, string][] = [
      ["brand.name", 'Luize, "a Luize"\nlinha'],
    ];
    // Apenas valida geração — não passa pelo validateEntries de chaves do dict
    // simulando manualmente:
    const out = buildI18nExport("csv", tricky as never);
    const second = out.content.split("\n").slice(1).join("\n");
    expect(second).toContain('"Luize, ""a Luize""');
  });

  it("export filtrado vazio é permitido (não exige completude)", () => {
    const out = buildI18nExport("json", []);
    expect(out.content).toBe("{}");
    expect(out.totalKeys).toBe(0);
  });
});
