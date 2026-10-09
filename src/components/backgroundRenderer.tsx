import { useEffect } from "react";
import { BackgroundConfig } from "@/features/background/backgroundConfig";
import { buildUrl } from "@/utils/buildUrl";
import { STAGE_ELEMENT_ID } from "@/features/stage/stageConfig";

type Props = {
  config: BackgroundConfig;
  /** When the stage is a fixed size, the background paints the stage (not the whole window). */
  stageFixed?: boolean;
};

export const BackgroundRenderer = ({ config, stageFixed = false }: Props) => {
  useEffect(() => {
    const body = document.body;
    const stage = document.getElementById(STAGE_ELEMENT_ID);
    const target: HTMLElement = stageFixed && stage ? stage : body;

    // The other surface gets neutral styling.
    const other: HTMLElement | null = target === body ? stage : body;
    if (other) {
      other.style.backgroundImage = "none";
      other.style.backgroundColor = other === body ? "#0b0b0f" : "transparent";
    }
    if (target === stage) {
      target.style.backgroundSize = "cover";
      target.style.backgroundPosition = "top center";
      target.style.backgroundRepeat = "no-repeat";
    }

    if (config.type === "greenscreen") {
      target.style.backgroundImage = "none";
      target.style.backgroundColor = "#00b140";
    } else if (config.type === "none") {
      target.style.backgroundImage = "none";
      target.style.backgroundColor = "transparent";
    } else if (config.type === "color") {
      target.style.backgroundImage = "none";
      target.style.backgroundColor = config.color;
    } else if (config.type === "image") {
      target.style.backgroundImage = `url(${config.imageUrl || buildUrl("/bg-c.png")})`;
      target.style.backgroundColor = "";
    }
  }, [config, stageFixed]);

  return null;
};
