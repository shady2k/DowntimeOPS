import { useState, useEffect } from "react";
import { rpcClient } from "../rpc/client";
import { useGameStore } from "../store/gameStore";
import { THEME, inputStyle } from "./theme";
import type { SaveInfo } from "@downtime-ops/shared";

type MenuView = "main" | "load" | "save";

export function MainMenu() {
  const state = useGameStore((s) => s.state);
  const togglePauseMenu = useGameStore((s) => s.togglePauseMenu);
  const hasActiveGame = state !== null;

  const [view, setView] = useState<MenuView>("main");
  const [saves, setSaves] = useState<SaveInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const fetchSaves = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await rpcClient.call("listSaves");
      setSaves(result.saves);
    } catch {
      setError("Failed to load saves");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSaves();
  }, []);

  useEffect(() => {
    if (view === "load") fetchSaves();
  }, [view]);

  // Reset view when menu opens
  useEffect(() => {
    setView("main");
    setSaveStatus(null);
    setError(null);
  }, [hasActiveGame]);

  const handleResume = () => togglePauseMenu();

  const handleSave = async () => {
    const name = saveName.trim();
    if (!name) return;
    setSaveStatus("Saving...");
    try {
      await rpcClient.call("saveGame", { name });
      setSaveStatus("Saved!");
      fetchSaves();
      setTimeout(() => {
        setSaveStatus(null);
        setView("main");
      }, 1000);
    } catch {
      setSaveStatus("Save failed");
      setTimeout(() => setSaveStatus(null), 2000);
    }
  };

  const handleNewGame = async () => {
    try {
      await rpcClient.call("newGame");
    } catch {
      setError("Failed to start new game");
    }
  };

  const handleLoad = async (saveId: string) => {
    try {
      await rpcClient.call("loadGame", { saveId });
    } catch {
      setError(`Failed to load save "${saveId}"`);
    }
  };

  const handleDelete = async (saveId: string) => {
    try {
      await rpcClient.call("deleteSave", { saveId });
      setSaves((prev) => prev.filter((s) => s.id !== saveId));
    } catch {
      setError(`Failed to delete save "${saveId}"`);
    }
  };

  const handleSaveAndQuit = async () => {
    try {
      await rpcClient.call("exitToMenu");
    } catch {
      // handled by reconciler
    }
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const formatMoney = (amount: number) => `$${amount.toLocaleString()}`;
  const hasSaves = saves.length > 0;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: hasActiveGame ? "100%" : "100vh",
        background: `url("assets/ui/menu-bg.png") center/cover no-repeat`,
        fontFamily: THEME.fonts.heading,
        position: hasActiveGame ? "absolute" : "relative",
        inset: hasActiveGame ? 0 : undefined,
        zIndex: hasActiveGame ? 100 : undefined,
      }}
    >
      {/* Dark overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: "radial-gradient(ellipse at center, rgba(30,24,20,0.6) 0%, rgba(30,24,20,0.85) 70%, rgba(30,24,20,0.95) 100%)",
        }}
      />

      <div
        style={{
          width: 460,
          padding: 40,
          textAlign: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Title */}
        <h1
          style={{
            color: THEME.colors.accent,
            fontWeight: 800,
            fontSize: 36,
            margin: "0 0 8px",
            letterSpacing: 1,
          }}
        >
          DowntimeOPS
        </h1>
        {!hasActiveGame && (
          <p
            style={{
              color: THEME.colors.textDim,
              fontSize: 12,
              marginBottom: 40,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            Datacenter Tycoon
          </p>
        )}
        {hasActiveGame && <div style={{ marginBottom: 28 }} />}

        {/* Error */}
        {error && (
          <div
            style={{
              padding: "8px 12px",
              background: THEME.colors.dangerBg,
              border: `1px solid ${THEME.colors.dangerBorder}`,
              borderRadius: THEME.radius.md,
              color: THEME.colors.danger,
              fontSize: 12,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {/* === MAIN VIEW === */}
        {view === "main" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {hasActiveGame && (
              <MenuButton onClick={handleResume} variant="primary">Resume</MenuButton>
            )}
            {!hasActiveGame && hasSaves && (
              <MenuButton onClick={() => handleLoad(saves[0].id)} variant="primary">
                Continue
              </MenuButton>
            )}
            {hasActiveGame && (
              <MenuButton onClick={() => { setSaveName(""); setView("save"); }} variant="ghost">
                Save Game
              </MenuButton>
            )}
            <MenuButton onClick={() => setView("load")} variant="ghost">
              Load Game
            </MenuButton>
            <MenuButton onClick={handleNewGame} variant="ghost">
              New Game
            </MenuButton>
            {hasActiveGame && (
              <MenuButton onClick={handleSaveAndQuit} variant="danger">
                Save & Quit
              </MenuButton>
            )}
          </div>
        )}

        {/* === SAVE VIEW === */}
        {view === "save" && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <MenuButton onClick={() => setView("main")} variant="ghost">
                Back
              </MenuButton>
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
                placeholder="Enter save name..."
                autoFocus
                style={{
                  ...inputStyle(),
                  flex: 1,
                  padding: "10px 14px",
                  fontSize: 14,
                }}
              />
              <button
                onClick={handleSave}
                disabled={!saveName.trim()}
                style={{
                  padding: "10px 20px",
                  border: "none",
                  borderRadius: THEME.radius.md,
                  background: saveName.trim() ? THEME.colors.accent : THEME.colors.bgCard,
                  color: saveName.trim() ? THEME.colors.textInverse : THEME.colors.textDim,
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: THEME.fonts.heading,
                  cursor: saveName.trim() ? "pointer" : "default",
                }}
              >
                {saveStatus || "Save"}
              </button>
            </div>

            {/* Existing saves for quick overwrite */}
            {hasSaves && (
              <>
                <p style={{ color: THEME.colors.textDim, fontSize: 11, margin: "16px 0 8px", textTransform: "uppercase", letterSpacing: 1 }}>
                  Or overwrite
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {saves.map((save) => (
                    <SaveEntry
                      key={save.id}
                      save={save}
                      formatDate={formatDate}
                      formatMoney={formatMoney}
                      onClick={() => {
                        setSaveName(save.name);
                        handleSaveAs(save.name);
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* === LOAD VIEW === */}
        {view === "load" && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <MenuButton onClick={() => setView("main")} variant="ghost">
                Back
              </MenuButton>
            </div>

            {loading && (
              <p style={{ color: THEME.colors.textMuted, fontSize: 13 }}>
                Loading saves...
              </p>
            )}

            {!loading && saves.length === 0 && (
              <p style={{ color: THEME.colors.textDim, fontSize: 13 }}>
                No saves found
              </p>
            )}

            {!loading && saves.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {saves.map((save) => (
                  <SaveEntry
                    key={save.id}
                    save={save}
                    formatDate={formatDate}
                    formatMoney={formatMoney}
                    onClick={() => handleLoad(save.id)}
                    onDelete={() => handleDelete(save.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ESC hint */}
        {hasActiveGame && view === "main" && (
          <p style={{ color: THEME.colors.textDim, fontSize: 10, marginTop: 20, marginBottom: 0 }}>
            Press ESC to resume
          </p>
        )}
      </div>
    </div>
  );

  function handleSaveAs(name: string) {
    setSaveStatus("Saving...");
    rpcClient.call("saveGame", { name }).then(
      () => {
        setSaveStatus("Saved!");
        fetchSaves();
        setTimeout(() => {
          setSaveStatus(null);
          setView("main");
        }, 1000);
      },
      () => {
        setSaveStatus("Save failed");
        setTimeout(() => setSaveStatus(null), 2000);
      },
    );
  }
}

function SaveEntry({
  save,
  formatDate,
  formatMoney,
  onClick,
  onDelete,
}: {
  save: SaveInfo;
  formatDate: (iso: string) => string;
  formatMoney: (n: number) => string;
  onClick: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 14px",
        background: THEME.colors.bgCard,
        borderRadius: THEME.radius.md,
        boxShadow: THEME.shadows.card,
        cursor: "pointer",
        transition: "background 0.15s",
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = THEME.colors.bgCardHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = THEME.colors.bgCard;
      }}
    >
      <div style={{ flex: 1, textAlign: "left" }}>
        <div
          style={{
            color: THEME.colors.text,
            fontSize: 13,
            fontWeight: 600,
            fontFamily: THEME.fonts.mono,
          }}
        >
          {save.name}
        </div>
        <div
          style={{
            color: THEME.colors.textDim,
            fontSize: 10,
            marginTop: 2,
            display: "flex",
            gap: 12,
          }}
        >
          <span>{formatDate(save.updatedAt)}</span>
          <span style={{ color: THEME.colors.accent }}>
            {formatMoney(save.money)}
          </span>
        </div>
      </div>
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          style={{
            padding: "4px 10px",
            border: `1px solid ${THEME.colors.dangerBorder}`,
            borderRadius: THEME.radius.sm,
            background: THEME.colors.dangerBg,
            color: THEME.colors.danger,
            fontSize: 10,
            fontWeight: 600,
            fontFamily: THEME.fonts.body,
            cursor: "pointer",
          }}
        >
          Delete
        </button>
      )}
    </div>
  );
}

function MenuButton({
  children,
  onClick,
  variant = "primary",
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "primary" | "ghost" | "danger";
}) {
  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";
  return (
    <button
      onClick={onClick}
      style={{
        padding: "14px 24px",
        border: `1px solid ${
          isPrimary ? THEME.colors.accentDim
            : isDanger ? THEME.colors.dangerBorder
              : THEME.colors.border
        }`,
        borderRadius: THEME.radius.md,
        background: isPrimary
          ? THEME.colors.accentBg
          : isDanger
            ? THEME.colors.dangerBg
            : "transparent",
        color: isPrimary
          ? THEME.colors.accent
          : isDanger
            ? THEME.colors.danger
            : THEME.colors.textMuted,
        fontSize: 16,
        fontWeight: 700,
        fontFamily: THEME.fonts.heading,
        cursor: "pointer",
        transition: "background 0.15s, color 0.15s",
        letterSpacing: 0.5,
      }}
      onMouseEnter={(e) => {
        if (isPrimary) {
          e.currentTarget.style.background = THEME.colors.accent;
          e.currentTarget.style.color = THEME.colors.textInverse;
        } else if (isDanger) {
          e.currentTarget.style.background = THEME.colors.danger;
          e.currentTarget.style.color = "#fff";
        } else {
          e.currentTarget.style.background = THEME.colors.bgCard;
        }
      }}
      onMouseLeave={(e) => {
        if (isPrimary) {
          e.currentTarget.style.background = THEME.colors.accentBg;
          e.currentTarget.style.color = THEME.colors.accent;
        } else if (isDanger) {
          e.currentTarget.style.background = THEME.colors.dangerBg;
          e.currentTarget.style.color = THEME.colors.danger;
        } else {
          e.currentTarget.style.background = "transparent";
        }
      }}
    >
      {children}
    </button>
  );
}
