import { useEffect } from "react";
import { BackgroundConfig } from "@/features/background/backgroundConfig";
import { buildUrl } from "@/utils/buildUrl";

type Props = {
  config: BackgroundConfig;
};

export const BackgroundRenderer = ({ config }: Props) => {
  // Apply body background based on config
  useEffect(() => {
    const body = document.body;

    if (config.type === "greenscreen") {
      body.style.backgroundImage = "none";
      body.style.backgroundColor = "#00b140";
      return;
    }

    if (config.type === "none") {
      body.style.backgroundImage = "none";
      body.style.backgroundColor = "transparent";
      return;
    }

    if (config.type === "color") {
      body.style.backgroundImage = "none";
      body.style.backgroundColor = config.color;
      return;
    }

    if (config.type === "image") {
      if (config.imageUrl) {
        body.style.backgroundImage = `url(${config.imageUrl})`;
        body.style.backgroundColor = "";
      } else {
        body.style.backgroundImage = `url(${buildUrl("/bg-c.png")})`;
        body.style.backgroundColor = "";
      }
      return;
    }
  }, [config]);

  return null;
};
