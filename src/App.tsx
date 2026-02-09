import { useEffect, useRef, useState } from "react";
import Konva from "konva";
import {
  Stage,
  Layer,
  Rect,
  Image as KonvaImage,
  Group,
  Text,
  Line,
} from "react-konva";
import "./App.css";
import { Pane } from "tweakpane";
import {
  downloadJsonFile,
  exportStageAsPng,
  loadImageFromSrc,
  loadPosterImages,
  parseWallData,
  readFileAsDataUrl,
  readFileAsText,
  type ParseWallError,
} from "./utils/wallIO";

export type PosterSize = {
  id: string;
  label: string;
  width: number;
  height: number;
  color: string;
};

export type WallPoster = {
  id: string;
  sizeId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  imageSrc?: string;
};

export type Settings = {
  wallWidth: number;
  wallHeight: number;
  background: string;
  showGrid: boolean;
  gridStep: number;
  gridColor: string;
};

const DEFAULT_SIZES: PosterSize[] = [
  {
    id: "s5",
    label: "Большой",
    width: 500,
    height: 700,
    color: "#d1fae5",
  },
];

const POSTER_SIZES_STORAGE_KEY = "poster-sizes";

const isValidPosterSize = (value: unknown): value is PosterSize => {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.label === "string" &&
    typeof record.color === "string" &&
    typeof record.width === "number" &&
    Number.isFinite(record.width) &&
    record.width > 0 &&
    typeof record.height === "number" &&
    Number.isFinite(record.height) &&
    record.height > 0
  );
};

const loadPosterSizesFromStorage = (): PosterSize[] => {
  try {
    const raw = localStorage.getItem(POSTER_SIZES_STORAGE_KEY);
    if (!raw) return DEFAULT_SIZES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_SIZES;
    const isValid = parsed.every(isValidPosterSize);
    return isValid ? (parsed as PosterSize[]) : DEFAULT_SIZES;
  } catch {
    return DEFAULT_SIZES;
  }
};

const INITIAL_SETTINGS: Settings = {
  wallWidth: 1400,
  wallHeight: 800,
  background: "#f4f1ed",
  showGrid: true,
  gridStep: 20,
  gridColor: "#e7e1d9",
};

const IMPORT_ERROR_MESSAGES: Record<ParseWallError, string> = {
  empty: "Файл пустой.",
  "invalid-json": "Файл не является валидным JSON.",
  "invalid-root": "Ожидается объект с полями settings и posters.",
  "invalid-settings": "Некорректные настройки стены.",
  "invalid-posters": "Некорректный список постеров.",
};

const snapToGrid = (value: number, gridStep: number): number => {
  return Math.round(value / gridStep) * gridStep;
};

const formatPosterCount = (count: number) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return `${count} постер на стене`;
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} постера на стене`;
  }
  return `${count} постеров на стене`;
};

const buildGridLines = (settings: Settings) => {
  if (!settings.showGrid) return [] as Array<{ points: number[] }>;
  const step = settings.gridStep;
  const lines: Array<{ points: number[] }> = [];
  for (let x = 0; x <= settings.wallWidth; x += step) {
    lines.push({ points: [x, 0, x, settings.wallHeight] });
  }
  for (let y = 0; y <= settings.wallHeight; y += step) {
    lines.push({ points: [0, y, settings.wallWidth, y] });
  }
  return lines;
};

const useWallSettingsPanel = (
  settings: Settings,
  setSettings: React.Dispatch<React.SetStateAction<Settings>>,
) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const paneRef = useRef<Pane | null>(null);
  const paneParamsRef = useRef({
    wallWidth: settings.wallWidth,
    wallHeight: settings.wallHeight,
    showGrid: settings.showGrid,
    gridStep: settings.gridStep,
    background: settings.background,
    gridColor: settings.gridColor,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container || paneRef.current) return;

    const pane = new Pane({ container });
    paneRef.current = pane;

    pane.addBinding(paneParamsRef.current, "wallWidth", {
      step: 10,
      label: "Ширина (px)",
    });
    pane.addBinding(paneParamsRef.current, "wallHeight", {
      step: 10,
      label: "Высота (px)",
    });
    pane.addBinding(paneParamsRef.current, "showGrid", {
      label: "Сетка",
    });
    pane.addBinding(paneParamsRef.current, "gridStep", {
      min: 5,
      max: 100,
      step: 5,
      label: "Шаг сетки (px)",
    });
    pane.addBinding(paneParamsRef.current, "background", {
      label: "Фон",
      view: "color",
    });
    pane.addBinding(paneParamsRef.current, "gridColor", {
      label: "Цвет сетки",
      view: "color",
    });

    pane.on("change", () => {
      setSettings((prev) => ({
        ...prev,
        wallWidth: paneParamsRef.current.wallWidth,
        wallHeight: paneParamsRef.current.wallHeight,
        showGrid: paneParamsRef.current.showGrid,
        gridStep: paneParamsRef.current.gridStep,
        background: paneParamsRef.current.background,
        gridColor: paneParamsRef.current.gridColor,
      }));
    });

    return () => {
      pane.dispose();
      paneRef.current = null;
    };
  }, [setSettings]);

  useEffect(() => {
    const params = paneParamsRef.current;
    params.wallWidth = settings.wallWidth;
    params.wallHeight = settings.wallHeight;
    params.showGrid = settings.showGrid;
    params.gridStep = settings.gridStep;
    params.background = settings.background;
    params.gridColor = settings.gridColor;
    paneRef.current?.refresh();
  }, [
    settings.wallWidth,
    settings.wallHeight,
    settings.showGrid,
    settings.gridStep,
    settings.background,
    settings.gridColor,
  ]);

  return { containerRef };
};

type CanvasAreaProps = {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  stageRef: React.RefObject<Konva.Stage | null>;
  stageSize: { width: number; height: number };
  stageScale: number;
  stagePosition: { x: number; y: number };
  isPanning: boolean;
  settings: Settings;
  wallPosters: WallPoster[];
  posterSizes: PosterSize[];
  imageMap: Record<string, HTMLImageElement>;
  selectedId: string | null;
  onCanvasDragOver: (e: React.DragEvent) => void;
  onCanvasDrop: (e: React.DragEvent) => void;
  onPosterSelect: (posterId: string) => void;
  onPosterRequestImage: (posterId: string) => void;
  onPosterDragEnd: (
    posterId: string,
    e: Konva.KonvaEventObject<DragEvent>,
  ) => void;
  onStageWheel: (e: Konva.KonvaEventObject<WheelEvent>) => void;
  onStageMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  onStageMouseMove: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  onStageMouseUp: () => void;
};

const CanvasArea = ({
  canvasRef,
  stageRef,
  stageSize,
  stageScale,
  stagePosition,
  isPanning,
  settings,
  wallPosters,
  posterSizes,
  imageMap,
  selectedId,
  onCanvasDragOver,
  onCanvasDrop,
  onPosterSelect,
  onPosterRequestImage,
  onPosterDragEnd,
  onStageWheel,
  onStageMouseDown,
  onStageMouseMove,
  onStageMouseUp,
}: CanvasAreaProps) => {
  const gridLines = buildGridLines(settings);
  const zoomLabel = `Масштаб: ${Math.round(stageScale * 100)}%`;

  return (
    <main className="canvas-area">
      <div className="canvas-header">
        <h1>Редактор стены постеров</h1>
        <div className="canvas-stats">
          <span>{formatPosterCount(wallPosters.length)}</span>
          <span className="zoom-info">{zoomLabel}</span>
        </div>
      </div>

      <div
        ref={canvasRef}
        className="canvas-shell"
        onDragOver={onCanvasDragOver}
        onDrop={onCanvasDrop}
      >
        <Stage
          width={stageSize.width}
          height={stageSize.height}
          ref={stageRef}
          className={`konva-stage${isPanning ? " is-panning" : ""}`}
          scaleX={stageScale}
          scaleY={stageScale}
          x={stagePosition.x}
          y={stagePosition.y}
          onWheel={onStageWheel}
          onMouseDown={onStageMouseDown}
          onMouseMove={onStageMouseMove}
          onMouseUp={onStageMouseUp}
          onMouseLeave={onStageMouseUp}
        >
          <Layer>
            <Rect
              width={settings.wallWidth}
              height={settings.wallHeight}
              fill={settings.background}
              name="wall-background"
            />
            <Group name="wall-grid">
              {gridLines.map((line, index) => (
                <Line
                  key={`grid-${index}`}
                  points={line.points}
                  stroke={settings.gridColor}
                  strokeWidth={1}
                  opacity={0.8}
                />
              ))}
            </Group>
          </Layer>
          <Layer>
            {wallPosters.map((poster) => {
              const image = imageMap[poster.id];
              const isSelected = selectedId === poster.id;
              const sizeConfig = posterSizes.find(
                (s) => s.id === poster.sizeId,
              );

              return (
                <Group
                  key={poster.id}
                  x={poster.x}
                  y={poster.y}
                  draggable
                  onDragEnd={(e) => onPosterDragEnd(poster.id, e)}
                  onClick={() => onPosterSelect(poster.id)}
                  onDblClick={() => onPosterRequestImage(poster.id)}
                >
                  {image ? (
                    <KonvaImage
                      image={image}
                      width={poster.width}
                      height={poster.height}
                    />
                  ) : (
                    <Rect
                      width={poster.width}
                      height={poster.height}
                      fill={sizeConfig?.color || "#fdfaf5"}
                    />
                  )}
                  <Rect
                    width={poster.width}
                    height={poster.height}
                    stroke={isSelected ? "#8a5a44" : "#b99b88"}
                    strokeWidth={isSelected ? 3 : 2}
                    fillEnabled={false}
                  />
                  {!image && (
                    <Text
                      text={poster.label}
                      fontSize={14}
                      fill="#5d4a3a"
                      x={10}
                      y={10}
                    />
                  )}
                  {!image && (
                    <Text
                      text="Двойной клик — добавить изображение"
                      fontSize={12}
                      fill="#78716c"
                      x={10}
                      y={poster.height - 25}
                    />
                  )}
                </Group>
              );
            })}
          </Layer>
        </Stage>
      </div>
    </main>
  );
};

type SidebarProps = {
  paneContainerRef: React.RefObject<HTMLDivElement | null>;
  onExportJson: () => void;
  onImportJson: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExportPng: () => void;
  onExportPngTransparent: () => void;
  onClearWall: () => void;
  posterSizes: PosterSize[];
  onAddCustomSize: () => void;
  onSizeDragStart: (e: React.DragEvent, size: PosterSize) => void;
  onUpdateSize: (id: string, field: keyof PosterSize, value: number) => void;
  onRemoveSize: (id: string) => void;
  hasSelection: boolean;
  selectedLabel: string | null;
  onChangeImage: () => void;
  onRemoveSelected: () => void;
};

const Sidebar = ({
  paneContainerRef,
  onExportJson,
  onImportJson,
  onExportPng,
  onExportPngTransparent,
  onClearWall,
  posterSizes,
  onAddCustomSize,
  onSizeDragStart,
  onUpdateSize,
  onRemoveSize,
  hasSelection,
  selectedLabel,
  onChangeImage,
  onRemoveSelected,
}: SidebarProps) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [isActionsOpen, setIsActionsOpen] = useState(true);

  return (
    <aside className="sidebar">
      <div className="controls-section">
        <div className="section-title">
          <h3>Настройки стены</h3>
          <button
            type="button"
            className="collapse-toggle"
            aria-expanded={isSettingsOpen}
            onClick={() => setIsSettingsOpen((prev) => !prev)}
          >
            {isSettingsOpen ? "Свернуть" : "Развернуть"}
          </button>
        </div>
        <div
          className={`collapsible-body${isSettingsOpen ? "" : " is-collapsed"}`}
        >
          <div ref={paneContainerRef} className="tweakpane-shell" />
        </div>
      </div>

      <div className="controls-section">
        <div className="section-title">
          <h3>Действия</h3>
          <button
            type="button"
            className="collapse-toggle"
            aria-expanded={isActionsOpen}
            onClick={() => setIsActionsOpen((prev) => !prev)}
          >
            {isActionsOpen ? "Свернуть" : "Развернуть"}
          </button>
        </div>
        <div
          className={`collapsible-body${isActionsOpen ? "" : " is-collapsed"}`}
        >
          <button
            type="button"
            onClick={onExportJson}
            className="action-button"
          >
            Сохранить JSON
          </button>
          <label className="action-button file-upload-button">
            Загрузить JSON
            <input
              type="file"
              accept="application/json"
              onChange={onImportJson}
              style={{ display: "none" }}
            />
          </label>
          <button type="button" onClick={onExportPng} className="action-button">
            Экспорт PNG
          </button>
          <button
            type="button"
            onClick={onExportPngTransparent}
            className="action-button"
          >
            Экспорт PNG без фона
          </button>
          <button
            type="button"
            onClick={onClearWall}
            className="action-button danger"
          >
            Очистить стену
          </button>
        </div>
      </div>

      <div className="controls-section posters-section">
        <div className="section-header">
          <h3>Размеры постеров ({posterSizes.length})</h3>
          <button
            type="button"
            onClick={onAddCustomSize}
            className="add-button"
          >
            + Добавить размер
          </button>
        </div>

        <div className="help-text">
          Перетащите размер на стену. Колесо — масштаб, зажмите среднюю кнопку
          для панорамы.
        </div>

        <div className="poster-palette">
          {posterSizes.map((size) => (
            <div
              key={size.id}
              className="size-card"
              draggable
              onDragStart={(e) => onSizeDragStart(e, size)}
              style={{ borderColor: size.color }}
            >
              <div className="size-card-header">
                <label>
                  Ширина
                  <input
                    type="number"
                    min={50}
                    value={size.width}
                    onChange={(e) =>
                      onUpdateSize(size.id, "width", Number(e.target.value))
                    }
                    onClick={(e) => e.stopPropagation()}
                  />
                </label>
                <label>
                  Высота
                  <input
                    type="number"
                    min={50}
                    value={size.height}
                    onChange={(e) =>
                      onUpdateSize(size.id, "height", Number(e.target.value))
                    }
                    onClick={(e) => e.stopPropagation()}
                  />
                </label>
                <button
                  type="button"
                  className="remove-button-small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveSize(size.id);
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {hasSelection && (
        <div className="controls-section selected-section">
          <h3>Выбранный постер</h3>
          <div className="selected-info">{selectedLabel ?? "—"}</div>
          <button
            type="button"
            onClick={onChangeImage}
            className="action-button"
          >
            Сменить изображение
          </button>
          <button
            type="button"
            onClick={onRemoveSelected}
            className="action-button danger"
          >
            Удалить со стены
          </button>
        </div>
      )}
    </aside>
  );
};

export default function App() {
  const [settings, setSettings] = useState<Settings>(INITIAL_SETTINGS);
  const [posterSizes, setPosterSizes] = useState<PosterSize[]>(
    loadPosterSizesFromStorage,
  );
  const [wallPosters, setWallPosters] = useState<WallPoster[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [imageMap, setImageMap] = useState<Record<string, HTMLImageElement>>(
    {},
  );
  const [draggedSize, setDraggedSize] = useState<PosterSize | null>(null);
  const [stageScale, setStageScale] = useState(1);
  const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });

  const stageRef = useRef<Konva.Stage | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);

  const { containerRef: paneContainerRef } = useWallSettingsPanel(
    settings,
    setSettings,
  );

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setStageSize({
        width: Math.max(1, Math.floor(rect.width)),
        height: Math.max(1, Math.floor(rect.height)),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        POSTER_SIZES_STORAGE_KEY,
        JSON.stringify(posterSizes),
      );
    } catch {
      // Ignore storage errors (private mode, quota, etc.)
    }
  }, [posterSizes]);

  const handleSizeDragStart = (e: React.DragEvent, size: PosterSize) => {
    setDraggedSize(size);
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedSize || !stageRef.current) return;

    const stage = stageRef.current;
    const containerRect = stage.container().getBoundingClientRect();

    const pointerX =
      (e.clientX - containerRect.left - stagePosition.x) / stageScale;
    const pointerY =
      (e.clientY - containerRect.top - stagePosition.y) / stageScale;

    const x = snapToGrid(
      Math.max(0, Math.min(pointerX, settings.wallWidth - draggedSize.width)),
      settings.showGrid ? settings.gridStep : 1,
    );
    const y = snapToGrid(
      Math.max(0, Math.min(pointerY, settings.wallHeight - draggedSize.height)),
      settings.showGrid ? settings.gridStep : 1,
    );

    const newPoster: WallPoster = {
      id: `poster-${Date.now()}-${Math.random()}`,
      sizeId: draggedSize.id,
      x,
      y,
      width: draggedSize.width,
      height: draggedSize.height,
      label: draggedSize.label,
    };

    setWallPosters((prev) => [...prev, newPoster]);
    setDraggedSize(null);
  };

  const handlePosterSelect = (posterId: string) => {
    setSelectedId(posterId);
  };

  const handlePosterRequestImage = (posterId: string) => {
    setSelectedId(posterId);
    fileInputRef.current?.click();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedId || !e.target.files?.[0]) return;

    const posterId = selectedId;
    const file = e.target.files[0];
    e.target.value = "";

    try {
      const imageSrc = await readFileAsDataUrl(file);

      setWallPosters((prev) =>
        prev.map((poster) =>
          poster.id === posterId ? { ...poster, imageSrc } : poster,
        ),
      );

      const image = await loadImageFromSrc(imageSrc);
      setImageMap((prev) => ({ ...prev, [posterId]: image }));
    } catch {
      alert("Не удалось загрузить изображение.");
    }
  };

  const handlePosterDragEnd = (
    posterId: string,
    e: Konva.KonvaEventObject<DragEvent>,
  ) => {
    const x = snapToGrid(
      Math.max(
        0,
        Math.min(e.target.x(), settings.wallWidth - e.target.width()),
      ),
      settings.showGrid ? settings.gridStep : 1,
    );
    const y = snapToGrid(
      Math.max(
        0,
        Math.min(e.target.y(), settings.wallHeight - e.target.height()),
      ),
      settings.showGrid ? settings.gridStep : 1,
    );

    setWallPosters((prev) =>
      prev.map((poster) =>
        poster.id === posterId ? { ...poster, x, y } : poster,
      ),
    );
  };

  const removePoster = (posterId: string) => {
    setWallPosters((prev) => prev.filter((p) => p.id !== posterId));
    setImageMap((prev) => {
      if (!(posterId in prev)) return prev;
      const next = { ...prev };
      delete next[posterId];
      return next;
    });
    if (selectedId === posterId) setSelectedId(null);
  };

  const addCustomSize = () => {
    const newSize: PosterSize = {
      id: `custom-${Date.now()}`,
      label: `Пользовательский ${posterSizes.length + 1}`,
      width: 400,
      height: 300,
      color: "#e0e7ff",
    };
    setPosterSizes((prev) => [...prev, newSize]);
  };

  const updateSize = (
    id: string,
    field: keyof PosterSize,
    value: string | number,
  ) => {
    setPosterSizes((prev) =>
      prev.map((size) => (size.id === id ? { ...size, [field]: value } : size)),
    );
  };

  const removeSize = (id: string) => {
    setPosterSizes((prev) => prev.filter((s) => s.id !== id));
  };

  const exportJSON = () => {
    downloadJsonFile(
      { settings, posters: wallPosters },
      `poster-wall-${Date.now()}.json`,
    );
  };

  const importJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    try {
      const text = await readFileAsText(file);
      const result = parseWallData(text);

      if (result.error || !result.data) {
        alert(IMPORT_ERROR_MESSAGES[result.error ?? "invalid-json"]);
        return;
      }

      setSettings(result.data.settings);
      setWallPosters(result.data.posters);
      setSelectedId(null);
      setImageMap({});
      loadPosterImages(result.data.posters, (id, image) => {
        setImageMap((prev) => ({ ...prev, [id]: image }));
      });
    } catch {
      alert("Не удалось прочитать файл.");
    }
  };

  const exportPNG = () => {
    if (!stageRef.current) return;
    exportStageAsPng(stageRef.current, `poster-wall-${Date.now()}.png`);
  };

  const exportPNGTransparent = () => {
    if (!stageRef.current) return;
    const stage = stageRef.current;
    const background = stage.findOne(".wall-background");
    const grid = stage.findOne(".wall-grid");
    const backgroundVisible = background?.visible() ?? true;
    const gridVisible = grid?.visible() ?? true;

    background?.visible(false);
    grid?.visible(false);
    stage.batchDraw();

    exportStageAsPng(stage, `poster-wall-${Date.now()}-transparent.png`);

    background?.visible(backgroundVisible);
    grid?.visible(gridVisible);
    stage.batchDraw();
  };

  const clearWall = () => {
    if (confirm("Очистить все постеры со стены?")) {
      setWallPosters([]);
      setImageMap({});
      setSelectedId(null);
    }
  };

  const handleStageWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    if (!stageRef.current) return;

    const stage = stageRef.current;
    const scaleBy = 1.05;
    const oldScale = stageScale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const nextScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const clampedScale = Math.max(0.4, Math.min(3, nextScale));

    const mousePointTo = {
      x: (pointer.x - stagePosition.x) / oldScale,
      y: (pointer.y - stagePosition.y) / oldScale,
    };

    const newPos = {
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    };

    setStageScale(clampedScale);
    setStagePosition(newPos);
  };

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!stageRef.current) return;
    if (e.evt.button !== 1) return;
    e.evt.preventDefault();
    const pointer = stageRef.current.getPointerPosition();
    if (!pointer) return;
    panStartRef.current = { x: pointer.x, y: pointer.y };
    setIsPanning(true);
  };

  const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    void e;
    if (!stageRef.current) return;
    if (!isPanning || !panStartRef.current) return;
    const pointer = stageRef.current.getPointerPosition();
    if (!pointer) return;
    const dx = pointer.x - panStartRef.current.x;
    const dy = pointer.y - panStartRef.current.y;
    setStagePosition((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    panStartRef.current = { x: pointer.x, y: pointer.y };
  };

  const handleStageMouseUp = () => {
    setIsPanning(false);
    panStartRef.current = null;
  };

  const selectedPoster = wallPosters.find((poster) => poster.id === selectedId);
  const handleChangeSelectedImage = () => {
    if (!selectedId) return;
    handlePosterRequestImage(selectedId);
  };
  const handleRemoveSelected = () => {
    if (!selectedId) return;
    removePoster(selectedId);
  };

  return (
    <div className="app">
      <CanvasArea
        canvasRef={canvasRef}
        stageRef={stageRef}
        stageSize={stageSize}
        stageScale={stageScale}
        stagePosition={stagePosition}
        isPanning={isPanning}
        settings={settings}
        wallPosters={wallPosters}
        posterSizes={posterSizes}
        imageMap={imageMap}
        selectedId={selectedId}
        onCanvasDragOver={handleCanvasDragOver}
        onCanvasDrop={handleCanvasDrop}
        onPosterSelect={handlePosterSelect}
        onPosterRequestImage={handlePosterRequestImage}
        onPosterDragEnd={handlePosterDragEnd}
        onStageWheel={handleStageWheel}
        onStageMouseDown={handleStageMouseDown}
        onStageMouseMove={handleStageMouseMove}
        onStageMouseUp={handleStageMouseUp}
      />

      <Sidebar
        paneContainerRef={paneContainerRef}
        onExportJson={exportJSON}
        onImportJson={importJSON}
        onExportPng={exportPNG}
        onExportPngTransparent={exportPNGTransparent}
        onClearWall={clearWall}
        posterSizes={posterSizes}
        onAddCustomSize={addCustomSize}
        onSizeDragStart={handleSizeDragStart}
        onUpdateSize={updateSize}
        onRemoveSize={removeSize}
        hasSelection={Boolean(selectedId)}
        selectedLabel={selectedPoster?.label ?? null}
        onChangeImage={handleChangeSelectedImage}
        onRemoveSelected={handleRemoveSelected}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        style={{ display: "none" }}
      />
    </div>
  );
}
