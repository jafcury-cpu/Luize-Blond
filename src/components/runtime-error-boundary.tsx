import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertOctagon, Copy, Home, LifeBuoy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { generateErrorId, logError } from "@/lib/error-telemetry";

const SUPPORT_HREF = "mailto:suporte@luize.app?subject=Falha%20no%20app%20Luize";
const LAST_ERROR_KEY = "luize:last-runtime-error";

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
  errorId: string | null;
  componentStack: string | null;
  copied: boolean;
};

function persistLastError(payload: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LAST_ERROR_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota */
  }
}

export class RuntimeErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorId: null, componentStack: null, copied: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const errorId = generateErrorId();
    const route = typeof window !== "undefined" ? window.location.pathname + window.location.search : "";

    const payload = {
      errorId,
      message: error.message,
      name: error.name,
      stack: error.stack,
      componentStack: info.componentStack,
      route,
      at: new Date().toISOString(),
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    };
    persistLastError(payload);

    void logError({
      message: `[runtime] ${errorId} · ${error.message}`,
      stack: error.stack ?? null,
      source: "react.boundary",
      severity: "error",
      requestId: errorId,
      context: { componentStack: info.componentStack ?? null, errorId },
    });

    this.setState({ errorId, componentStack: info.componentStack ?? null });
  }

  private handleReset = () => {
    this.setState({ error: null, errorId: null, componentStack: null, copied: false });
  };

  private handleHardReload = () => {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.clear();
      } catch {
        /* ignore */
      }
      window.location.reload();
    }
  };

  private handleGoHome = () => {
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  private handleCopy = async () => {
    const { error, errorId, componentStack } = this.state;
    if (!error) return;
    const text = JSON.stringify(
      {
        errorId,
        message: error.message,
        name: error.name,
        stack: error.stack,
        componentStack,
        route: typeof window !== "undefined" ? window.location.pathname + window.location.search : "",
        at: new Date().toISOString(),
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      },
      null,
      2,
    );
    try {
      await navigator.clipboard.writeText(text);
      this.setState({ copied: true });
      window.setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      /* ignore */
    }
  };

  render() {
    const { error, errorId, componentStack, copied } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-6">
        <Card className="w-full max-w-2xl border-destructive/40 bg-panel-elevated">
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-2 text-destructive">
              <AlertOctagon className="h-6 w-6" />
              <CardTitle className="text-2xl">O app encontrou um erro</CardTitle>
            </div>
            <CardDescription>
              A tela travou ao renderizar. Use o ID abaixo para reportar exatamente esta ocorrência.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-destructive">ID do erro</p>
              <p className="mt-1 break-all font-mono text-xl font-semibold text-foreground">
                {errorId ?? "—"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Anote ou copie este ID — ele identifica unicamente este crash nos logs.
              </p>
            </div>

            <Alert variant="destructive">
              <AlertTitle className="font-mono text-sm">{error.name}: {error.message}</AlertTitle>
              <AlertDescription className="space-y-2">
                <details>
                  <summary className="cursor-pointer text-xs opacity-80">Stack trace</summary>
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-background/60 p-2 text-[11px]">
                    {error.stack ?? "(sem stack)"}
                  </pre>
                </details>
                {componentStack && (
                  <details>
                    <summary className="cursor-pointer text-xs opacity-80">Component stack</summary>
                    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-background/60 p-2 text-[11px]">
                      {componentStack}
                    </pre>
                  </details>
                )}
              </AlertDescription>
            </Alert>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button onClick={this.handleReset} variant="hero" size="lg">
                <RefreshCw className="mr-2 h-4 w-4" /> Tentar renderizar de novo
              </Button>
              <Button onClick={this.handleHardReload} variant="outline" size="lg">
                Recarregar página
              </Button>
              <Button onClick={this.handleGoHome} variant="outline" size="lg">
                <Home className="mr-2 h-4 w-4" /> Ir para o início
              </Button>
              <Button onClick={this.handleCopy} variant="outline" size="lg">
                <Copy className="mr-2 h-4 w-4" /> {copied ? "Copiado!" : "Copiar relatório"}
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-1 text-xs">
              <a
                href={`${SUPPORT_HREF}&body=${encodeURIComponent(`ID do erro: ${errorId}\n\nO que eu estava fazendo:\n`)}`}
                className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                <LifeBuoy className="h-3.5 w-3.5" /> Reportar para o suporte
              </a>
              <span className="text-muted-foreground/50" aria-hidden>•</span>
              <a
                href="/status"
                className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Ver status do app
              </a>
              <span className="text-muted-foreground/50" aria-hidden>•</span>
              <a
                href="/erros"
                className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Ver telemetria
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}
