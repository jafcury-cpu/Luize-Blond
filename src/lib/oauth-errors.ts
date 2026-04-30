// Maps OAuth / Supabase auth errors to clear, actionable Portuguese messages.

export type OAuthErrorInfo = {
  title: string;
  description: string;
  guidance?: string;
  code: string;
  raw?: string;
};

const ORIGIN = typeof window !== "undefined" ? window.location.origin : "";

function redirectGuidance() {
  return `Verifique se o domínio "${ORIGIN}" está na lista de URLs de redirecionamento autorizadas em Lovable Cloud → Authentication → URL Configuration (e no Google Cloud Console → OAuth Client → Authorized redirect URIs, caso esteja usando credenciais próprias).`;
}

export function mapOAuthError(input: unknown): OAuthErrorInfo {
  const raw =
    input instanceof Error
      ? input.message
      : typeof input === "string"
        ? input
        : input && typeof input === "object" && "message" in input
          ? String((input as { message: unknown }).message)
          : "Erro desconhecido";

  const code =
    input && typeof input === "object" && "code" in input
      ? String((input as { code: unknown }).code)
      : raw.toLowerCase().replace(/\s+/g, "_").slice(0, 60);

  const lower = raw.toLowerCase();

  // Redirect URI / domain not allowed
  if (
    lower.includes("redirect_uri") ||
    lower.includes("redirect uri") ||
    lower.includes("redirect_uri_mismatch") ||
    lower.includes("invalid redirect") ||
    lower.includes("not allowed by the configuration") ||
    lower.includes("url not allowed")
  ) {
    return {
      code: "redirect_uri_mismatch",
      title: "Domínio não autorizado",
      description: `O endereço atual (${ORIGIN}) não está na lista de redirecionamentos permitidos.`,
      guidance: redirectGuidance(),
      raw,
    };
  }

  // Provider disabled
  if (lower.includes("provider is not enabled") || lower.includes("provider disabled")) {
    return {
      code: "provider_disabled",
      title: "Login com Google desativado",
      description: "O provedor Google está desativado nas configurações de autenticação.",
      guidance: "Ative o provedor Google em Lovable Cloud → Authentication → Providers → Google.",
      raw,
    };
  }

  // Access denied (user canceled or hd restriction)
  if (lower.includes("access_denied") || lower.includes("access denied")) {
    return {
      code: "access_denied",
      title: "Acesso negado",
      description: "A autorização foi cancelada ou sua conta não atende às restrições configuradas.",
      guidance: "Tente novamente e selecione uma conta autorizada. Se houver restrição de domínio (hd), use uma conta corporativa permitida.",
      raw,
    };
  }

  // Server / OAuth provider error
  if (lower.includes("server_error") || lower.includes("oauth")) {
    return {
      code: "oauth_server_error",
      title: "Falha no provedor",
      description: "O Google retornou um erro temporário durante a autenticação.",
      guidance: "Aguarde alguns segundos e tente novamente. Se persistir, limpe os cookies e refaça o login.",
      raw,
    };
  }

  // Network / popup blocked
  if (lower.includes("network") || lower.includes("failed to fetch") || lower.includes("load failed")) {
    return {
      code: "network_error",
      title: "Falha de rede",
      description: "Não foi possível contatar o serviço de autenticação.",
      guidance: "Verifique sua conexão de internet e desative bloqueadores de pop-up/anúncios para este domínio.",
      raw,
    };
  }

  if (lower.includes("popup") || lower.includes("pop-up")) {
    return {
      code: "popup_blocked",
      title: "Pop-up bloqueado",
      description: "O navegador bloqueou a janela de login do Google.",
      guidance: "Permita pop-ups para este site nas configurações do navegador e tente de novo.",
      raw,
    };
  }

  // Session/token issues
  if (lower.includes("invalid_grant") || lower.includes("token") || lower.includes("session")) {
    return {
      code: "invalid_grant",
      title: "Sessão inválida",
      description: "O token de autorização expirou ou já foi usado.",
      guidance: "Clique em \"Continuar com Google\" novamente para iniciar uma nova sessão.",
      raw,
    };
  }

  // Email/Domain not allowed (workspace policy)
  if (lower.includes("not allowed") || lower.includes("unauthorized") || lower.includes("forbidden")) {
    return {
      code: "user_not_allowed",
      title: "Usuário não autorizado",
      description: "Esta conta Google não tem permissão para acessar o app.",
      guidance: "Use uma conta autorizada pelo administrador. Esta é uma instância pessoal com acesso restrito.",
      raw,
    };
  }

  return {
    code: code || "unknown_oauth_error",
    title: "Não foi possível entrar",
    description: raw,
    guidance: "Tente novamente. Se o problema persistir, copie a mensagem técnica abaixo e use \"Reportar problema\".",
    raw,
  };
}

/**
 * Reads OAuth callback errors from URL search params and hash fragment
 * (Supabase / OAuth providers may put errors in either location).
 */
export function readOAuthCallbackError(): OAuthErrorInfo | null {
  if (typeof window === "undefined") return null;

  const search = new URLSearchParams(window.location.search);
  const hash = window.location.hash.startsWith("#")
    ? new URLSearchParams(window.location.hash.slice(1))
    : new URLSearchParams();

  const error = search.get("error") || hash.get("error");
  if (!error) return null;

  const description =
    search.get("error_description") ||
    hash.get("error_description") ||
    search.get("error_message") ||
    hash.get("error_message") ||
    error;

  return mapOAuthError({ message: description, code: error });
}

export function clearOAuthCallbackParams() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  ["error", "error_description", "error_code", "error_message"].forEach((p) => url.searchParams.delete(p));
  if (url.hash.includes("error")) url.hash = "";
  window.history.replaceState({}, "", url.pathname + url.search + url.hash);
}
