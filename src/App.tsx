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
// import "tweakpane/dist/tweakpane.css";
import { Pane } from "tweakpane";

type PosterSize = {
  id: string;
  label: string;
  width: number;
  height: number;
  color: string;
};

type WallPoster = {
  id: string;
  sizeId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  imageSrc?: string;
};

const DEFAULT_SIZES: PosterSize[] = [
  { id: "s1", label: "50x70", width: 500, height: 700, color: "#fef3c7" },
  {
    id: "s2",
    label: "A2 Landscape",
    width: 594,
    height: 420,
    color: "#dbeafe",
  },
  { id: "s3", label: "A3 Portrait", width: 297, height: 420, color: "#fce7f3" },
  {
    id: "s4",
    label: "A3 Landscape",
    width: 420,
    height: 297,
    color: "#e9d5ff",
  },
  {
    id: "s5",
    label: "Square Large",
    width: 500,
    height: 500,
    color: "#d1fae5",
  },
  {
    id: "s6",
    label: "Square Medium",
    width: 350,
    height: 350,
    color: "#fed7aa",
  },
];

type Settings = {
  wallWidth: number;
  wallHeight: number;
  background: string;
  showGrid: boolean;
  gridStep: number;
  gridColor: string;
};

const INITIAL_SETTINGS: Settings = {
  wallWidth: 1400,
  wallHeight: 800,
  background: "#f4f1ed",
  showGrid: true,
  gridStep: 20,
  gridColor: "#e7e1d9",
};

const snapToGrid = (value: number, gridStep: number): number => {
  return Math.round(value / gridStep) * gridStep;
};

export default function App() {
  const [settings, setSettings] = useState<Settings>(INITIAL_SETTINGS);
  const [posterSizes, setPosterSizes] = useState<PosterSize[]>(DEFAULT_SIZES);
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
  const paneContainerRef = useRef<HTMLDivElement | null>(null);
  const paneRef = useRef<Pane | null>(null);
  const paneParamsRef = useRef({
    wallWidth: INITIAL_SETTINGS.wallWidth,
    wallHeight: INITIAL_SETTINGS.wallHeight,
    showGrid: INITIAL_SETTINGS.showGrid,
    gridStep: INITIAL_SETTINGS.gridStep,
    background: INITIAL_SETTINGS.background,
    gridColor: INITIAL_SETTINGS.gridColor,
  });

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
    const container = paneContainerRef.current;
    if (!container) return;
    if (paneRef.current) return;

    const pane = new Pane({ container });
    paneRef.current = pane;

    pane.addBinding(paneParamsRef.current, "wallWidth", {
      step: 10,
      label: "Width (px)",
    });
    pane.addBinding(paneParamsRef.current, "wallHeight", {
      step: 10,
      label: "Height (px)",
    });
    pane.addBinding(paneParamsRef.current, "showGrid", {
      label: "Show Grid",
    });
    pane.addBinding(paneParamsRef.current, "gridStep", {
      min: 5,
      max: 100,
      step: 5,
      label: "Grid Size (px)",
    });
    pane.addBinding(paneParamsRef.current, "background", {
      label: "Background",
      view: "color",
    });
    pane.addBinding(paneParamsRef.current, "gridColor", {
      label: "Grid Color",
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
  }, []);

  useEffect(() => {
    paneParamsRef.current.wallWidth = settings.wallWidth;
    paneParamsRef.current.wallHeight = settings.wallHeight;
    paneParamsRef.current.showGrid = settings.showGrid;
    paneParamsRef.current.gridStep = settings.gridStep;
    paneParamsRef.current.background = settings.background;
    paneParamsRef.current.gridColor = settings.gridColor;
    if (paneRef.current) {
      paneRef.current.refresh();
    }
  }, [
    settings.wallWidth,
    settings.wallHeight,
    settings.showGrid,
    settings.gridStep,
    settings.background,
    settings.gridColor,
  ]);

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

    // Account for stage scale and position
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

  const handlePosterClick = (posterId: string) => {
    setSelectedId(posterId);
    fileInputRef.current?.click();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedId || !e.target.files?.[0]) return;

    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = () => {
      const imageSrc = String(reader.result);

      setWallPosters((prev) =>
        prev.map((poster) =>
          poster.id === selectedId ? { ...poster, imageSrc } : poster,
        ),
      );

      const img = new window.Image();
      img.src = imageSrc;
      img.onload = () => {
        setImageMap((prev) => ({ ...prev, [selectedId]: img }));
      };
    };

    reader.readAsDataURL(file);
    e.target.value = "";
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
    if (selectedId === posterId) setSelectedId(null);
  };

  const addCustomSize = () => {
    const newSize: PosterSize = {
      id: `custom-${Date.now()}`,
      label: `Custom ${posterSizes.length + 1}`,
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
    const data = {
      settings,
      posters: wallPosters,
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `poster-wall-${Date.now()}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (data.settings) setSettings(data.settings);
        if (data.posters) {
          setWallPosters(data.posters);
          // Load images
          data.posters.forEach((poster: WallPoster) => {
            if (poster.imageSrc) {
              const img = new window.Image();
              img.src = poster.imageSrc;
              img.onload = () => {
                setImageMap((prev) => ({ ...prev, [poster.id]: img }));
              };
            }
          });
        }
      } catch (err) {
        alert("Invalid JSON file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const exportPNG = () => {
    if (!stageRef.current) return;
    const dataUrl = stageRef.current.toDataURL({ pixelRatio: 2 });
    const link = document.createElement("a");
    link.download = `poster-wall-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  };

  const clearWall = () => {
    if (confirm("Clear all posters from the wall?")) {
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

  const handleStageMouseMove = () => {
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

  const drawGridLines = () => {
    if (!settings.showGrid) return [];
    const step = settings.gridStep;
    const lines: Array<{ points: number[] }> = [];
    for (let x = 0; x <= settings.wallWidth; x += step) {
      lines.push({
        points: [x, 0, x, settings.wallHeight],
      });
    }
    for (let y = 0; y <= settings.wallHeight; y += step) {
      lines.push({
        points: [0, y, settings.wallWidth, y],
      });
    }
    return lines;
  };

  const gridLines = drawGridLines();

  return (
    <div className="app">
      <main className="canvas-area">
        <div className="canvas-header">
          <h1>Poster Wall Designer</h1>
          <div className="canvas-stats">
            <span>{wallPosters.length} posters on wall</span>
            <span className="zoom-info">
              Zoom: {Math.round(stageScale * 100)}%
            </span>
          </div>
        </div>

        <div
          ref={canvasRef}
          className="canvas-shell"
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
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
            draggable={false}
            onWheel={handleStageWheel}
            onMouseDown={(e) => {
              handleStageMouseDown(e);
              const isBackground =
                e.target === e.target.getStage() ||
                e.target.name() === "wall-bg";
              if (isBackground && e.evt.button === 0) {
                setSelectedId(null);
              }
            }}
            onMouseUp={handleStageMouseUp}
            onMouseLeave={handleStageMouseUp}
            onMouseMove={handleStageMouseMove}
          >
            <Layer>
              <Rect
                x={0}
                y={0}
                width={settings.wallWidth}
                height={settings.wallHeight}
                fill={settings.background}
                stroke="#d9d2c9"
                strokeWidth={2}
                name="wall-bg"
              />
              {gridLines.map((line, index) => (
                <Line
                  key={index}
                  points={line.points}
                  stroke={settings.gridColor}
                  strokeWidth={1}
                  dash={[4, 4]}
                />
              ))}
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
                    onDragEnd={(e) => handlePosterDragEnd(poster.id, e)}
                    onClick={() => setSelectedId(poster.id)}
                    onDblClick={() => handlePosterClick(poster.id)}
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
                        text="Double-click to add image"
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

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          style={{ display: "none" }}
        />
      </main>

      <aside className="sidebar">
        <div className="controls-section">
          <h3>Wall Settings</h3>

          <div ref={paneContainerRef} className="tweakpane-shell" />
        </div>

        <div className="controls-section">
          <h3>Actions</h3>
          <button type="button" onClick={exportJSON} className="action-button">
            💾 Save as JSON
          </button>
          <label className="action-button file-upload-button">
            📂 Load JSON
            <input
              type="file"
              accept="application/json"
              onChange={importJSON}
              style={{ display: "none" }}
            />
          </label>
          <button type="button" onClick={exportPNG} className="action-button">
            📥 Export PNG
          </button>
          <button
            type="button"
            onClick={clearWall}
            className="action-button danger"
          >
            🗑️ Clear Wall
          </button>
        </div>

        <div className="controls-section posters-section">
          <div className="section-header">
            <h3>Poster Sizes ({posterSizes.length})</h3>
            <button
              type="button"
              onClick={addCustomSize}
              className="add-button"
            >
              + Add Size
            </button>
          </div>

          <div className="help-text">
            Drag sizes to the wall → (Scroll to zoom, drag background to pan)
          </div>

          <div className="poster-palette">
            {posterSizes.map((size) => (
              <div
                key={size.id}
                className="size-card"
                draggable
                onDragStart={(e) => handleSizeDragStart(e, size)}
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
                        updateSize(size.id, "width", Number(e.target.value))
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
                        updateSize(size.id, "height", Number(e.target.value))
                      }
                      onClick={(e) => e.stopPropagation()}
                    />
                  </label>
                  <button
                    type="button"
                    className="remove-button-small"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSize(size.id);
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {selectedId && (
          <div className="controls-section selected-section">
            <h3>Selected Poster</h3>
            <div className="selected-info">
              {wallPosters.find((p) => p.id === selectedId)?.label}
            </div>
            <button
              type="button"
              onClick={() => handlePosterClick(selectedId)}
              className="action-button"
            >
              🖼️ Change Image
            </button>
            <button
              type="button"
              onClick={() => removePoster(selectedId)}
              className="action-button danger"
            >
              🗑️ Remove from Wall
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
