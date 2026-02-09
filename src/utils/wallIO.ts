import type Konva from "konva";
import type { Settings, WallPoster } from "../App";

type WallData = {
  settings: Settings;
  posters: WallPoster[];
};

export type ParseWallError =
  | "empty"
  | "invalid-json"
  | "invalid-root"
  | "invalid-settings"
  | "invalid-posters";

type ParseWallResult = {
  data: WallData | null;
  error: ParseWallError | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isPositiveNumber = (value: unknown): value is number =>
  isNumber(value) && value > 0;

const isString = (value: unknown): value is string => typeof value === "string";

const isBoolean = (value: unknown): value is boolean =>
  typeof value === "boolean";

const isSettings = (value: unknown): value is Settings => {
  if (!isRecord(value)) return false;
  return (
    isPositiveNumber(value.wallWidth) &&
    isPositiveNumber(value.wallHeight) &&
    isString(value.background) &&
    isBoolean(value.showGrid) &&
    isPositiveNumber(value.gridStep) &&
    isString(value.gridColor)
  );
};

const isPoster = (value: unknown): value is WallPoster => {
  if (!isRecord(value)) return false;
  if (
    !isString(value.id) ||
    !isString(value.sizeId) ||
    !isNumber(value.x) ||
    !isNumber(value.y) ||
    !isPositiveNumber(value.width) ||
    !isPositiveNumber(value.height) ||
    !isString(value.label)
  ) {
    return false;
  }
  if ("imageSrc" in value && value.imageSrc !== undefined) {
    return isString(value.imageSrc);
  }
  return true;
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
};

export const downloadJsonFile = (data: WallData, filename: string) => {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  downloadBlob(blob, filename);
};

export const downloadDataUrl = (dataUrl: string, filename: string) => {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
};

export const exportStageAsPng = (stage: Konva.Stage, filename: string) => {
  const dataUrl = stage.toDataURL({ pixelRatio: 2 });
  downloadDataUrl(dataUrl, filename);
};

export const readFileAsText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });

export const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export const loadImageFromSrc = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new window.Image();
    image.src = src;
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image"));
  });

export const parseWallData = (jsonText: string): ParseWallResult => {
  const trimmed = jsonText.trim();
  if (!trimmed) {
    return { data: null, error: "empty" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { data: null, error: "invalid-json" };
  }

  if (!isRecord(parsed)) {
    return { data: null, error: "invalid-root" };
  }

  const { settings, posters } = parsed;
  if (!isSettings(settings)) {
    return { data: null, error: "invalid-settings" };
  }

  if (!Array.isArray(posters) || !posters.every(isPoster)) {
    return { data: null, error: "invalid-posters" };
  }

  return {
    data: { settings, posters },
    error: null,
  };
};

export const loadPosterImages = (
  posters: WallPoster[],
  onImageLoad: (id: string, image: HTMLImageElement) => void,
) => {
  posters.forEach((poster) => {
    if (!poster.imageSrc) return;
    loadImageFromSrc(poster.imageSrc)
      .then((image) => onImageLoad(poster.id, image))
      .catch(() => undefined);
  });
};
