import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ActivitySquare,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Database,
  Globe,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Webhook,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { supabase } from "@/integrations/supabase/client";
import { getLocalRecentErrors } from "@/lib/error-telemetry";
import { getDebugEntries } from "@/lib/debug-mode";

type CheckState = "idle" | "running" | "ok" | "warn" | "fail";

type Check = {
  id: string;
  label: string;
  description: string;
  icon: typeof Globe;
  state: CheckState;
  detail?: string;
  durationMs?: number;
};

const SP_TZ = "America/Sao_Paulo";

const initialChecks: Check[] = [
  {
    id: "frontend",
    label: "Frontend",
    description: "App carregou, JS executando, sem crashes recentes",
    icon: Globe,
    state: "idle",
  },
  {
    id: "auth",
    label: "Supabase Auth",
    description: "Conexão com serviço de autenticação e sessão atual",
    icon: ShieldCheck,
    state: "idle",
  },
  {
    id: "db",
    label: "Banco de dados (RLS)",
    description: "SELECT autenticado em tabela protegida por RLS",
    icon: Database,
    state: "idle",
  },
  {
    id: "webhook",
    label: "Webhook n8n",
    description: "Endpoint configurado responde a uma requisição leve",
    icon: Webhook,
    state: "idle",
  },
];

function StateBadge({ state }: { state: CheckState }) {
  const map: Record<CheckState, { label: string; variant: "info" | "warning" | "destructive" | "success" | "secondary"; Icon: typeof CheckCircle2 }> = {
    idle: { label: "Aguardando", variant: "secondary", Icon: Clock },
    running: { label: "Verificando…", variant: "info", Icon: Loader2 },
    ok: { label: "OK", variant: "success", Icon: CheckCircle2 },
    warn: { label: "Atenção", variant: "warning", Icon: AlertTriangle },
    fail: { label: "Falhou", variant: "destructive", Icon: XCircle },
  };
  const { label, variant, Icon } = map[state];
  return (
    <Badge variant={variant} className="inline-flex items-center gap-1.5">
      <Icon className={`h-3.5 w-3.5 ${state === "running" ? "animate-spin" : ""}`} aria-hidden />
      {label}
    </Badge>
  );
}

const StatusPage = () => {
  useDocumentTitle("Status da Aplicação");
  const [checks, setChecks] = useState<Check[]>(initialChecks);
  const [running, setRunning] = useState(false);
  const [lastRunAt, setLastRunAt] = useState<string>("—");
  const [recentErrors, setRecentErrors] = useState<Array<Record<string, unknown>>>([]);
  const [debugEntries, setDebugEntries] = useState(() => getDebugEntries());

  const update = useCallback((id: string, patch: Partial<Check>) => {
    setChecks((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const runFrontend = useCallback(async () => {
    update("frontend", { state: "running" });
    const t0 = performance.now();
    try {
      const errors = getLocalRecentErrors();
      const recentCritical = errors.filter((e) => {
        const at = typeof e.created_at === "string" ? Date.parse(e.created_at) : 0;
        return Date.now() - at < 5 * 60 * 1000 && e.severity === "error";
      });
      const detail = recentCritical.length
        ? `${recentCritical.length} erro(s) crítico(s) nos últimos 5 min`
        : `Sem erros críticos recentes · ${errors.length} entradas no buffer`;
      update("frontend", {
        state: recentCritical.length > 0 ? "warn" : "ok",
        detail,
        durationMs: Math.round(performance.now() - t0),
      });
    } catch (err) {
      update("frontend", {
        state: "fail",
        detail: err instanceof Error ? err.message : String(err),
        durationMs: Math.round(performance.now() - t0),
      });
    }
  }, [update]);

  const runAuth = useCallback(async () => {
    update("auth", { state: "running" });
    const t0 = performance.now();
    try {
      const { data, error } = await supabase.auth.getSession();
      const dur = Math.round(performance.now() - t0);
      if (error) {
        update("auth", { state: "fail", detail: error.message, durationMs: dur });
        return false;
      }
      if (!data.session) {
        update("auth", {
          state: "warn",
          detail: "Sem sessão ativa — faça login para validar fluxos protegidos",
          durationMs: dur,
        });
        return false;
      }
      const expiresInSec = data.session.expires_at ? data.session.expires_at - Math.floor(Date.now() / 1000) : null;
      const detail = `Usuário ${data.session.user.email ?? data.session.user.id.slice(0, 8)} · expira em ${
        expiresInSec !== null ? `${Math.floor(expiresInSec / 60)}min` : "—"
      }`;
      update("auth", {
        state: expiresInSec !== null && expiresInSec < 300 ? "warn" : "ok",
        detail,
        durationMs: dur,
      });
      return true;
    } catch (err) {
      update("auth", {
        state: "fail",
        detail: err instanceof Error ? err.message : String(err),
        durationMs: Math.round(performance.now() - t0),
      });
      return false;
    }
  }, [update]);

  const runDb = useCallback(async (hasSession: boolean) => {
    update("db", { state: "running" });
    const t0 = performance.now();
    try {
      // Lightweight HEAD-style count query against an RLS-protected table
      const { error, count } = await supabase
        .from("settings")
        .select("id", { head: true, count: "exact" });
      const dur = Math.round(performance.now() - t0);
      if (error) {
        const isRls = /row-level security|violates row-level/i.test(error.message);
        update("db", {
          state: "fail",
          detail: `${isRls ? "[RLS] " : ""}${error.message} (code ${error.code ?? "?"})`,
          durationMs: dur,
        });
        return;
      }
      if (!hasSession) {
        update("db", {
          state: "warn",
          detail: "Consulta executou mas usuário não está autenticado — RLS retornou 0 linhas",
          durationMs: dur,
        });
        return;
      }
      update("db", {
        state: "ok",
        detail: `Consulta autenticada com sucesso · ${count ?? 0} linha(s) em settings`,
        durationMs: dur,
      });
    } catch (err) {
      update("db", {
        state: "fail",
        detail: err instanceof Error ? err.message : String(err),
        durationMs: Math.round(performance.now() - t0),
      });
    }
  }, [update]);

  const runWebhook = useCallback(async (hasSession: boolean) => {
    update("webhook", { state: "running" });
    const t0 = performance.now();
    try {
      if (!hasSession) {
        update("webhook", {
          state: "warn",
          detail: "Faça login para verificar o webhook configurado",
          durationMs: Math.round(performance.now() - t0),
        });
        return;
      }
      const { data, error } = await supabase
        .from("settings")
        .select("webhook_url")
        .maybeSingle();
      if (error) {
        update("webhook", {
          state: "fail",
          detail: `Não foi possível ler configurações: ${error.message}`,
          durationMs: Math.round(performance.now() - t0),
        });
        return;
      }
      const url = data?.webhook_url;
      if (!url) {
        update("webhook", {
          state: "warn",
          detail: "Nenhum webhook configurado em /configuracoes",
          durationMs: Math.round(performance.now() - t0),
        });
        return;
      }
      // Send a tiny ping; many n8n endpoints will respond OK or 404 — both indicate reachable.
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "healthcheck", at: new Date().toISOString() }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const dur = Math.round(performance.now() - t0);
        const reachable = res.status < 500;
        update("webhook", {
          state: res.ok ? "ok" : reachable ? "warn" : "fail",
          detail: `HTTP ${res.status} ${res.statusText} · ${url.replace(/^https?:\/\//, "").slice(0, 60)}`,
          durationMs: dur,
        });
      } catch (err) {
        clearTimeout(timeout);
        const aborted = err instanceof DOMException && err.name === "AbortError";
        update("webhook", {
          state: "fail",
          detail: aborted ? "Timeout (>8s) — endpoint não respondeu" : err instanceof Error ? err.message : String(err),
          durationMs: Math.round(performance.now() - t0),
        });
      }
    } catch (err) {
      update("webhook", {
        state: "fail",
        detail: err instanceof Error ? err.message : String(err),
        durationMs: Math.round(performance.now() - t0),
      });
    }
  }, [update]);

  const runAll = useCallback(async () => {
    setRunning(true);
    try {
      await runFrontend();
      const hasSession = await runAuth();
      await runDb(hasSession);
      await runWebhook(hasSession);
    } finally {
      setRunning(false);
      setLastRunAt(new Date().toLocaleString("pt-BR", { timeZone: SP_TZ }));
      setRecentErrors(getLocalRecentErrors().slice(0, 10));
      setDebugEntries(getDebugEntries().slice(0, 10));
    }
  }, [runAuth, runDb, runFrontend, runWebhook]);

  // Auto-run on mount
  useEffect(() => {
    void runAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(() => {
    const byState = checks.reduce<Record<CheckState, number>>(
      (acc, c) => ({ ...acc, [c.state]: (acc[c.state] ?? 0) + 1 }),
      { idle: 0, running: 0, ok: 0, warn: 0, fail: 0 },
    );
    if (byState.fail > 0) return { state: "fail" as CheckState, label: "Crítico" };
    if (byState.warn > 0) return { state: "warn" as CheckState, label: "Degradado" };
    if (byState.running > 0) return { state: "running" as CheckState, label: "Verificando" };
    if (byState.ok === checks.length) return { state: "ok" as CheckState, label: "Operacional" };
    return { state: "idle" as CheckState, label: "Aguardando" };
  }, [checks]);

  return (
    <div className="min-h-screen bg-background px-4 py-6 md:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <Link
              to="/dashboard"
              className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-panel text-foreground hover:bg-panel-elevated"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <p className="text-kicker">Diagnóstico</p>
              <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
                <ActivitySquare className="h-6 w-6 text-primary" /> Status da Aplicação
              </h1>
              <p className="text-sm text-muted-foreground">
                Última verificação: {lastRunAt} (São Paulo)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StateBadge state={summary.state} />
            <span className="text-sm font-medium text-foreground">{summary.label}</span>
            <Button onClick={runAll} disabled={running} size="sm">
              {running ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
              Re-executar
            </Button>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-2">
          {checks.map((c) => {
            const Icon = c.icon;
            return (
              <Card key={c.id} className="border-border bg-panel/50">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <Icon className="mt-0.5 h-5 w-5 text-foreground/70" />
                      <div>
                        <CardTitle className="text-base">{c.label}</CardTitle>
                        <CardDescription className="text-xs">{c.description}</CardDescription>
                      </div>
                    </div>
                    <StateBadge state={c.state} />
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground">
                    {c.detail ?? "Aguardando execução…"}
                  </p>
                  {typeof c.durationMs === "number" && (
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                      {c.durationMs} ms
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </section>

        <Card className="border-border bg-panel/50">
          <CardHeader>
            <CardTitle className="text-base">Erros recentes (sessão)</CardTitle>
            <CardDescription>Últimas 10 entradas do buffer local de telemetria</CardDescription>
          </CardHeader>
          <CardContent>
            {recentErrors.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum erro registrado.</p>
            ) : (
              <ul className="space-y-2">
                {recentErrors.map((e, i) => (
                  <li key={i} className="rounded-md border border-border/60 bg-background/40 p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-foreground">{String(e.source ?? "—")}</span>
                      <span className="text-muted-foreground">
                        {typeof e.created_at === "string"
                          ? new Date(e.created_at).toLocaleTimeString("pt-BR", { timeZone: SP_TZ })
                          : "—"}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-muted-foreground">{String(e.message ?? "")}</p>
                    {e.route ? <p className="text-[10px] text-muted-foreground/70">rota: {String(e.route)}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {debugEntries.length > 0 && (
          <Card className="border-border bg-panel/50">
            <CardHeader>
              <CardTitle className="text-base">Modo debug · últimas capturas</CardTitle>
              <CardDescription>Erros do Supabase, validação e RLS interceptados</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {debugEntries.map((d) => (
                  <li key={d.id} className="rounded-md border border-border/60 bg-background/40 p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-foreground">{d.source}</span>
                      <span className="text-muted-foreground">
                        {new Date(d.at).toLocaleTimeString("pt-BR", { timeZone: SP_TZ })}
                      </span>
                    </div>
                    <p className="mt-1 text-muted-foreground">{d.message}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card className="border-border bg-panel/50">
          <CardHeader>
            <CardTitle className="text-base">Diagnóstico do ambiente</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
              <div><dt className="text-muted-foreground">URL</dt><dd className="font-mono text-foreground">{window.location.href}</dd></div>
              <div><dt className="text-muted-foreground">Origin</dt><dd className="font-mono text-foreground">{window.location.origin}</dd></div>
              <div><dt className="text-muted-foreground">User-Agent</dt><dd className="truncate font-mono text-foreground">{navigator.userAgent}</dd></div>
              <div><dt className="text-muted-foreground">Online</dt><dd className="font-mono text-foreground">{navigator.onLine ? "sim" : "não"}</dd></div>
              <div><dt className="text-muted-foreground">Idioma</dt><dd className="font-mono text-foreground">{navigator.language}</dd></div>
              <div><dt className="text-muted-foreground">Tela</dt><dd className="font-mono text-foreground">{window.innerWidth}×{window.innerHeight}</dd></div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StatusPage;
