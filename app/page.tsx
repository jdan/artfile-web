"use client";

import { useEffect, useRef, useState } from "react";
import { Resource, decode } from "./decoder";

export default function Home() {
  const [resources, setResources] = useState<Resource[]>([]);

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();

    // get the data from the first file
    const file = e.dataTransfer.files[0];
    const data = await file.arrayBuffer();
    const resources = decode(data);

    setResources(resources);
  };

  return (
    <main
      className="flex min-h-screen flex-col p-24"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {resources.length === 0 ? (
        <div>Drag me an ArtFile.bin</div>
      ) : (
        <div className="flex flex-col justify-center">
          {resources.map((resource, idx) => (
            <ResourceDetails
              // Unsure if unique enough
              key={resource.descriptor.dataOffset}
              index={idx}
              resource={resource}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function ResourceDetails(props: { index: number; resource: Resource }) {
  const { resource } = props;

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const width = resource.header.columnWidths.reduce((a, b) => a + b, 0);
    const height = resource.header.rowHeights.reduce((a, b) => a + b, 0);
    const data = resource.data;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const img = new ImageData(width, height);

    // convert BGRA to RGBA
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      rgba[i] = data[i + 2];
      rgba[i + 1] = data[i + 1];
      rgba[i + 2] = data[i];
      rgba[i + 3] = data[i + 3];
    }

    img.data.set(rgba);
    ctx.putImageData(img, 0, 0);
  }, [resource.data, resource.header.columnWidths, resource.header.rowHeights]);

  return (
    <div className="p-4 flex flex-col gap-2">
      <div className="text-xl">#{props.index}</div>

      <div className="flex flex-row gap-4">
        <canvas
          className="border-2 border-black"
          ref={canvasRef}
          width={40}
          height={40}
          style={{
            width: 120,
            height: 120,
          }}
        />

        <div className="text-sm">
          <div>Offset: {resource.descriptor.dataOffset}</div>
          <div>Rows: {resource.header.numRows}</div>
          <div>Columns: {resource.header.numColumns}</div>
          <div>
            Width: {resource.header.columnWidths.reduce((a, b) => a + b, 0)}
          </div>
          <div>
            Height: {resource.header.rowHeights.reduce((a, b) => a + b, 0)}
          </div>
          <div>Tags: {resource.descriptor.tags.join(", ")}</div>
        </div>
      </div>
    </div>
  );
}
