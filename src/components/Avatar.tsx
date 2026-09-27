interface AvatarProps {
  image?: string | null;
  name?: string | null;
  size?: number;
  // Moldura equipada (imagem sobreposta à foto)
  frameUrl?: string | null;
}

export function Avatar({ image, name, size = 32, frameUrl }: AvatarProps) {
  const initial = (name?.trim()[0] ?? "?").toUpperCase();

  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      {image ? (
        <img
          src={image}
          alt={name ?? "Foto de perfil"}
          className="h-full w-full rounded-full object-cover border border-zinc-700"
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center rounded-full bg-amber-500/15 border border-amber-500/30 font-bold text-amber-400"
          style={{ fontSize: size * 0.42 }}
        >
          {initial}
        </span>
      )}
      {frameUrl && (
        <img
          src={frameUrl}
          alt=""
          aria-hidden
          className="pointer-events-none absolute object-contain"
          style={{ inset: -size * 0.12, width: size * 1.24, height: size * 1.24 }}
        />
      )}
    </span>
  );
}
