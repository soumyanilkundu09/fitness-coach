interface NavbarProps {
  showNewChat: boolean;
  disabled: boolean;
  onNewChat: () => void;
}

/** One hairline, one wordmark, one piece of furniture. Nothing else lives here. */
export function Navbar({ showNewChat, disabled, onNewChat }: NavbarProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-ground/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-4 px-5 py-4 lg:px-8">
        <span className="text-[17px] font-light tracking-[-0.03em] text-ink">
          Fitness<span className="text-indigo">Coach</span>
        </span>

        {showNewChat && (
          <button
            type="button"
            onClick={onNewChat}
            disabled={disabled}
            className="mono-label text-muted transition-colors hover:text-ink disabled:opacity-40"
          >
            New chat
          </button>
        )}
      </div>
    </header>
  );
}
