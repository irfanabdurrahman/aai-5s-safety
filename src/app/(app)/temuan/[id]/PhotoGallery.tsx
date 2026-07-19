"use client";

import { useState } from "react";
import { IconX } from "@/components/icons";

type Photo = { id: string; filePath: string };

function Grid({
  photos,
  label,
  tone,
  onOpen,
}: {
  photos: Photo[];
  label: string;
  tone: "danger" | "ok";
  onOpen: (url: string) => void;
}) {
  if (!photos.length) return null;
  return (
    <div className="flex-1">
      <p
        className={`mb-1.5 text-[11px] font-bold uppercase tracking-wide ${
          tone === "danger" ? "text-danger" : "text-ok"
        }`}
      >
        {label}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {photos.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onOpen(`/api/files/${p.filePath}`)}
            className="aspect-[4/3] overflow-hidden rounded-xl"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/files/${p.filePath}`}
              alt={label}
              className="h-full w-full object-cover transition-transform hover:scale-105"
              loading="lazy"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export function PhotoGallery({
  before,
  after,
}: {
  before: Photo[];
  after: Photo[];
}) {
  const [open, setOpen] = useState<string | null>(null);

  if (!before.length && !after.length) {
    return <p className="text-sm text-muted">Belum ada foto.</p>;
  }

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row">
        <Grid photos={before} label="Sebelum" tone="danger" onOpen={setOpen} />
        <Grid photos={after} label="Sesudah" tone="ok" onOpen={setOpen} />
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setOpen(null)}
        >
          <button
            type="button"
            aria-label="Tutup"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white"
          >
            <IconX size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={open}
            alt="Foto temuan"
            className="max-h-full max-w-full rounded-xl object-contain"
          />
        </div>
      )}
    </>
  );
}
