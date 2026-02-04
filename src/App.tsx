import { useRef, useState } from "react";
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
  { id: "s1", label: "A2 Portrait", width: 420, height: 594, color: "#fef3c7" },
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
  padding: number;
  gap: number;
  background: string;
  showGrid: boolean;
  gridStep: number;
};

const INITIAL_SETTINGS: Settings = {
  wallWidth: 1400,
  wallHeight: 800,
  padding: 40,
  gap: 20,
  background: "#f4f1ed",
  showGrid: true,
  gridStep: 20,
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

  const stageRef = useRef<Konva.Stage | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

    // Calculate position relative to stage
    const x = snapToGrid(
      Math.max(
        settings.padding,
        Math.min(
          e.clientX - containerRect.left,
          settings.wallWidth - draggedSize.width - settings.padding,
        ),
      ),
      settings.showGrid ? settings.gridStep : 1,
    );
    const y = snapToGrid(
      Math.max(
        settings.padding,
        Math.min(
          e.clientY - containerRect.top,
          settings.wallHeight - draggedSize.height - settings.padding,
        ),
      ),
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
        settings.padding,
        Math.min(
          e.target.x(),
          settings.wallWidth - e.target.width() - settings.padding,
        ),
      ),
      settings.showGrid ? settings.gridStep : 1,
    );
    const y = snapToGrid(
      Math.max(
        settings.padding,
        Math.min(
          e.target.y(),
          settings.wallHeight - e.target.height() - settings.padding,
        ),
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

  const drawGridLines = () => {
    if (!settings.showGrid) return [];
    const step = settings.gridStep;
    const lines: Array<{ points: number[] }> = [];
    for (
      let x = settings.padding;
      x <= settings.wallWidth - settings.padding;
      x += step
    ) {
      lines.push({
        points: [
          x,
          settings.padding,
          x,
          settings.wallHeight - settings.padding,
        ],
      });
    }
    for (
      let y = settings.padding;
      y <= settings.wallHeight - settings.padding;
      y += step
    ) {
      lines.push({
        points: [settings.padding, y, settings.wallWidth - settings.padding, y],
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
          </div>
        </div>

        <div
          className="canvas-shell"
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
        >
          <Stage
            width={settings.wallWidth}
            height={settings.wallHeight}
            ref={stageRef}
            className="konva-stage"
            onMouseDown={(e) => {
              if (e.target === e.target.getStage()) {
                setSelectedId(null);
              }
            }}
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
              />
              {gridLines.map((line, index) => (
                <Line
                  key={index}
                  points={line.points}
                  stroke="#e7e1d9"
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

          <label className="input-label">
            Width: {settings.wallWidth}px
            <input
              type="range"
              min={600}
              max={3000}
              step={20}
              value={settings.wallWidth}
              onChange={(e) =>
                setSettings({ ...settings, wallWidth: Number(e.target.value) })
              }
            />
          </label>

          <label className="input-label">
            Height: {settings.wallHeight}px
            <input
              type="range"
              min={400}
              max={2000}
              step={20}
              value={settings.wallHeight}
              onChange={(e) =>
                setSettings({ ...settings, wallHeight: Number(e.target.value) })
              }
            />
          </label>

          <label className="input-label">
            Padding: {settings.padding}px
            <input
              type="range"
              min={0}
              max={120}
              step={5}
              value={settings.padding}
              onChange={(e) =>
                setSettings({ ...settings, padding: Number(e.target.value) })
              }
            />
          </label>

          <label className="input-label">
            Gap (for reference): {settings.gap}px
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={settings.gap}
              onChange={(e) =>
                setSettings({ ...settings, gap: Number(e.target.value) })
              }
            />
          </label>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.showGrid}
              onChange={(e) =>
                setSettings({ ...settings, showGrid: e.target.checked })
              }
            />
            Show Grid (snap: {settings.gridStep}px)
          </label>

          {settings.showGrid && (
            <label className="input-label">
              Grid Step: {settings.gridStep}px
              <input
                type="range"
                min={10}
                max={50}
                step={5}
                value={settings.gridStep}
                onChange={(e) =>
                  setSettings({ ...settings, gridStep: Number(e.target.value) })
                }
              />
            </label>
          )}

          <label className="input-label">
            Background
            <input
              type="color"
              value={settings.background}
              onChange={(e) =>
                setSettings({ ...settings, background: e.target.value })
              }
            />
          </label>
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

          <div className="help-text">Drag sizes to the wall →</div>

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
                  <input
                    className="size-label"
                    value={size.label}
                    onChange={(e) =>
                      updateSize(size.id, "label", e.target.value)
                    }
                    onClick={(e) => e.stopPropagation()}
                  />
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

                <div className="size-dimensions">
                  <label>
                    W
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
                    H
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
                  <label>
                    Color
                    <input
                      type="color"
                      value={size.color}
                      onChange={(e) =>
                        updateSize(size.id, "color", e.target.value)
                      }
                      onClick={(e) => e.stopPropagation()}
                    />
                  </label>
                </div>

                <div
                  className="size-preview"
                  style={{ backgroundColor: size.color }}
                >
                  {size.width} × {size.height}
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
