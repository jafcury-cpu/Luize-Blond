import { describe, it, expect, vi } from "vitest";
import { dictionary, t } from "@/lib/i18n";

describe("dicionário central pt-BR", () => {
  it("retorna o texto correspondente para chaves existentes", () => {
    expect(t("brand.name")).toBe("Luize");
    expect(t("dashboard.eyebrow.briefing")).toBe("Briefing diário");
    expect(t("financeiro.eyebrow.cashPosition")).toBe("Posição de caixa");
    expect(t("common.singleUserMode")).toBe("Modo de usuário único");
  });

  it("retorna a própria chave quando ela não existe (fallback visível)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = t("chave.inexistente.qualquer" as never);
    expect(result).toBe("chave.inexistente.qualquer");
    warn.mockRestore();
  });

  it("não contém sobrenome ou cargo em nenhum valor do dicionário", () => {
    const forbidden = [/blond/i, /chief of staff/i];
    for (const [key, value] of Object.entries(dictionary)) {
      for (const re of forbidden) {
        expect(re.test(value), `chave "${key}" contém termo proibido: ${value}`).toBe(false);
      }
    }
  });

  it("todos os valores são strings não-vazias", () => {
    for (const [key, value] of Object.entries(dictionary)) {
      expect(typeof value, `chave "${key}" deve ser string`).toBe("string");
      expect(value.length, `chave "${key}" não pode ser vazia`).toBeGreaterThan(0);
    }
  });
});
