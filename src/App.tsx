import { useEffect } from "react";
import { Arena } from "@/components/game/Arena";
import { BuyScreen } from "@/components/game/BuyScreen";
import { ModeScreen, ResultScreen, RulesScreen, TitleScreen, WagerScreen } from "@/components/game/screens";
import { useAtmos } from "@/lib/atmos/store";
import { setMuted, unlockAudio } from "@/lib/game/audio";
import { useGunk } from "@/lib/game/store";

export function App() {
  const screen = useGunk((s) => s.screen);
  const muted = useGunk((s) => s.muted);
  const hydrate = useGunk((s) => s.hydrate);
  const boot = useAtmos((s) => s.boot);

  useEffect(() => {
    hydrate();
    boot();
  }, [hydrate, boot]);

  useEffect(() => {
    setMuted(muted);
  }, [muted]);

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    const onVis = () => {
      if (document.visibilityState === "visible") unlockAudio();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div className="flex h-dvh w-full justify-center overflow-hidden bg-bg text-fg">
      {screen === "title" && <TitleScreen />}
      {screen === "mode" && <ModeScreen />}
      {screen === "wager" && <WagerScreen />}
      {screen === "play" && <Arena />}
      {screen === "result" && <ResultScreen />}
      {screen === "rules" && <RulesScreen />}
      {screen === "buy" && <BuyScreen />}
    </div>
  );
}
