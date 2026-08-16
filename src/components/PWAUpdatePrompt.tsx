import { useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { t } from "@/store/useI18nStore";

export default function PWAUpdatePrompt() {
  const [dismissed, setDismissed] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(url) {
      if (url) {
        console.log("SW registered:", url);
      }
    },
  });

  if (!needRefresh || dismissed) return null;

  const handleUpdate = () => {
    updateServiceWorker(true);
  };

  const handleDismiss = () => {
    setNeedRefresh(false);
    setDismissed(true);
  };

  return (
    <div className="fixed inset-x-0 bottom-20 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-amber/40 bg-ink-900/95 px-4 py-3 shadow-glow backdrop-blur-md animate-riseIn">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber/20 text-amber-glow">
        <RefreshCw size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-cream">{t('pwaUpdate.title')}</p>
        <p className="text-xs text-muted">{t('pwaUpdate.desc')}</p>
      </div>
      <button
        onClick={handleDismiss}
        className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-ink-800 hover:text-mist"
      >
        <X size={14} />
      </button>
      <button
        onClick={handleUpdate}
        className="rounded-full bg-amber px-4 py-1.5 text-xs font-medium text-ink-950 transition-colors hover:bg-amber-glow"
      >
        {t('pwaUpdate.update')}
      </button>
    </div>
  );
}
