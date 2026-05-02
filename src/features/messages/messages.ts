import { VRMExpressionPresetName } from "@pixiv/three-vrm";
import { KoeiroParam } from "../constants/koeiroParam";
import { ALL_POSE_TAGS } from "../emoteController/poseController";

export type Message = {
  role: "assistant" | "system" | "user";
  content: string;
};

const talkStyles = ["talk", "happy", "sad", "angry", "fear", "surprised"] as const;
export type TalkStyle = (typeof talkStyles)[number];

export type Talk = {
  style: TalkStyle;
  speakerX: number;
  speakerY: number;
  message: string;
};

const emotions = ["neutral", "happy", "angry", "sad", "relaxed"] as const;
type EmotionType = (typeof emotions)[number] & VRMExpressionPresetName;

export type Screenplay = {
  expression: EmotionType;
  talk: Talk;
  /** Pose tag to trigger (e.g. "bow", "wave", "shy") — undefined if none */
  pose?: string;
};

export const splitSentence = (text: string): string[] => {
  const splitMessages = text.split(/(?<=[。．！？\n])/g);
  return splitMessages.filter((msg) => msg !== "");
};

export const textsToScreenplay = (
  texts: string[],
  koeiroParam: KoeiroParam
): Screenplay[] => {
  const screenplays: Screenplay[] = [];
  let prevExpression = "neutral";

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];

    // Extract ALL bracket tags from the text
    const allTags = [...text.matchAll(/\[([a-zA-Z_]*?)\]/g)].map((m) => m[1]);

    // Split emotion tags from pose tags
    const emotionTag = allTags.find((t) => emotions.includes(t as any));
    const poseTag = allTags.find((t) => ALL_POSE_TAGS.includes(t));

    // Remove all bracket tags from the spoken text
    const message = text.replace(/\[[a-zA-Z_]*?\]/g, "").trim();

    let expression = prevExpression;
    if (emotionTag && emotions.includes(emotionTag as any)) {
      expression = emotionTag;
      prevExpression = emotionTag;
    }

    screenplays.push({
      expression: expression as EmotionType,
      talk: {
        style: emotionToTalkStyle(expression as EmotionType),
        speakerX: koeiroParam.speakerX,
        speakerY: koeiroParam.speakerY,
        message: message,
      },
      pose: poseTag,
    });
  }
  return screenplays;
};

const emotionToTalkStyle = (emotion: EmotionType): TalkStyle => {
  switch (emotion) {
    case "angry":   return "angry";
    case "happy":   return "happy";
    case "sad":     return "sad";
    default:        return "talk";
  }
};
