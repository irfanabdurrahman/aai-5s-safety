"use client";

import { useRef, useState } from "react";
import { IconCamera, IconX } from "@/components/icons";

const MAX_DIM = 1600;
const QUALITY = 0.8;
const MAX_PHOTOS = 4;

/** Kompres foto di HP sebelum upload: resize max 1600px, JPEG 80%. */
async function compress(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, "image/jpeg", QUALITY),
  );
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", {
    type: "image/jpeg",
  });
}

export function PhotoCapture({
  name = "photos",
  label = "Foto kondisi",
  required = false,
}: {
  name?: string;
  label?: string;
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<{ file: File; url: string }[]>([]);
  const [busy, setBusy] = useState(false);

  // Sinkronkan state ke <input type=file> asli agar terkirim via FormData
  function syncInput(list: { file: File; url: string }[]) {
    if (!inputRef.current) return;
    const dt = new DataTransfer();
    list.forEach(({ file }) => dt.items.add(file));
    inputRef.current.files = dt.files;
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (!picked.length) return;
    setBusy(true);
    try {
      const compressed = await Promise.all(picked.map(compress));
      const next = [
        ...files,
        ...compressed.map((file) => ({ file, url: URL.createObjectURL(file) })),
      ].slice(0, MAX_PHOTOS);
      setFiles(next);
      syncInput(next);
    } finally {
      setBusy(false);
    }
  }

  function remove(idx: number) {
    const next = files.filter((_, i) => i !== idx);
    URL.revokeObjectURL(files[idx].url);
    setFiles(next);
    syncInput(next);
  }

  return (
    <div>
      <p className="mb-1.5 text-[13px] font-semibold">
        {label}
        {required && <span className="text-danger"> *</span>}
      </p>
      <div className="grid grid-cols-4 gap-2">
        {files.map((f, i) => (
          <div key={f.url} className="relative aspect-square">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={f.url}
              alt={`Foto ${i + 1}`}
              className="h-full w-full rounded-xl object-cover"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="Hapus foto"
              className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-danger text-white shadow"
            >
              <IconX size={13} />
            </button>
          </div>
        ))}
        {files.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line text-muted hover:border-brand hover:text-brand disabled:opacity-50"
          >
            <IconCamera size={24} />
            <span className="text-[10px] font-bold">
              {busy ? "Memproses…" : files.length ? "Tambah" : "Ambil Foto"}
            </span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept="image/*"
        capture="environment"
        multiple
        onChange={onPick}
        className="sr-only"
        tabIndex={-1}
      />
    </div>
  );
}
