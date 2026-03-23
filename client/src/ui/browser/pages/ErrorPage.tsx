import { THEME } from "../../theme";

interface ErrorPageProps {
  code: string;
  message: string;
}

const ERROR_TITLES: Record<string, string> = {
  not_found: "Page Not Found",
  unreachable: "Host Unreachable",
  no_ip: "No IP Configured",
};

export function ErrorPage({ code, message }: ErrorPageProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        padding: 40,
        fontFamily: THEME.fonts.body,
      }}
    >
      <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>!</div>
      <h2
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: THEME.colors.danger,
          marginBottom: 8,
          fontFamily: THEME.fonts.heading,
        }}
      >
        {ERROR_TITLES[code] || "Error"}
      </h2>
      <p style={{ fontSize: 11, color: THEME.colors.textMuted, textAlign: "center", maxWidth: 300 }}>
        {message}
      </p>
    </div>
  );
}
