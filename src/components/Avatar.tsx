interface AvatarProps {
  image?: string | null;
  name?: string | null;
  size?: number;
  // Moldura equipada (imagem sobreposta à foto)
  frameUrl?: string | null;
}

export function Avatar({ image, name, size = 32, frameUrl }: AvatarProps) {
  const photoSize = frameUrl ? size * 0.96 : size;
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
          className="shrink-0 rounded-full object-cover"
          style={{ width: photoSize, height: photoSize, border: frameUrl ? undefined : "1px solid #3f3f46" }}
        />
      ) : (
        <span
          className="flex shrink-0 items-center justify-center rounded-full bg-amber-500/15 border border-amber-500/30 font-bold text-amber-400"
          style={{ width: photoSize, height: photoSize, fontSize: size * 0.42 }}
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
          style={{
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: size * 1.24,
            height: size * 1.24,
            // Preflight's max-width: 100% would shrink and offset the frame.
            maxWidth: "none",
            maxHeight: "none",
          }}
        />
      )}
    </span>
  );
}
