import React from "react";
import { Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LessonAudioControl({ enabled, playing, disabled, onClick }: {
  enabled: boolean;
  playing: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  if (!enabled) return null;
  return (
    <div className="mt-3 flex justify-center">
      <Button variant={playing ? "destructive" : "default"} size="lg"
        onClick={onClick} disabled={disabled} className="px-6 py-3 text-lg font-semibold">
        {playing ? <Square className="h-5 w-5 mr-2" /> : <Play className="h-5 w-5 mr-2" />}
        {playing ? "Stop Audio" : "Play Native Audio"}
      </Button>
    </div>
  );
}
