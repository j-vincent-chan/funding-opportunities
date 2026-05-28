import Image from "next/image";
import Link from "next/link";

const ICON = {
  src: "/brand/prospera-app-icon.png",
  width: 180,
  height: 198,
} as const;

const WORDMARK = {
  src: "/brand/prospera-wordmark.png",
  width: 555,
  height: 115,
} as const;

type ProsperaLogoProps = {
  variant: "sidebar" | "sidebar-collapsed" | "login";
  href?: string;
  /** When false, renders a non-interactive block (e.g. login screen). */
  linked?: boolean;
  className?: string;
};

const TAGLINE = "Funding Opportunities";

// Teal → green gradient lifted from the brand lockup tagline.
const TAGLINE_GRADIENT =
  "bg-gradient-to-r from-[#0E6B78] via-[#22B8C5] to-[#6BBF6A] bg-clip-text text-transparent";

export function ProsperaLogo({
  variant,
  href = "/dashboard",
  linked = true,
  className = "",
}: ProsperaLogoProps) {
  const inner =
    variant === "sidebar-collapsed" ? (
      <Image
        src={ICON.src}
        alt="Prospera"
        width={ICON.width}
        height={ICON.height}
        className="mx-auto h-12 w-auto object-contain"
        priority
      />
    ) : variant === "login" ? (
      <div className="flex flex-col items-center gap-3 text-center">
        <Image
          src={ICON.src}
          alt=""
          width={ICON.width}
          height={ICON.height}
          className="h-28 w-auto object-contain"
          priority
          aria-hidden
        />
        <Image
          src={WORDMARK.src}
          alt="Prospera"
          width={WORDMARK.width}
          height={WORDMARK.height}
          className="h-12 w-auto object-contain"
          priority
        />
        <p className={`text-sm font-bold uppercase tracking-[0.04em] ${TAGLINE_GRADIENT}`}>
          {TAGLINE}
        </p>
        <p className="text-[0.7rem] leading-relaxed text-[var(--fo-ink-muted)]">
          Connected to OCR and ImmunoX at UCSF
        </p>
      </div>
    ) : (
      <div className="flex items-center gap-2.5">
        <Image
          src={ICON.src}
          alt=""
          width={ICON.width}
          height={ICON.height}
          className="h-10 w-auto shrink-0 object-contain"
          priority
          aria-hidden
        />
        <div className="min-w-0">
          <Image
            src={WORDMARK.src}
            alt="Prospera"
            width={WORDMARK.width}
            height={WORDMARK.height}
            className="h-5 w-auto object-contain"
            priority
          />
          <p className={`mt-1 whitespace-nowrap text-[0.7rem] font-bold uppercase tracking-[0.01em] ${TAGLINE_GRADIENT}`}>
            {TAGLINE}
          </p>
        </div>
      </div>
    );

  const padding =
    variant === "sidebar-collapsed" ? "p-1.5" : variant === "login" ? "px-5 py-6" : "px-1 py-1.5";

  const classes = `rounded-2xl ${padding} ${className}`.trim();

  if (!linked) {
    return <div className={classes}>{inner}</div>;
  }

  return (
    <Link
      href={href}
      title="Prospera — home"
      className={`block transition-opacity duration-200 hover:opacity-90 ${classes}`}
    >
      {inner}
    </Link>
  );
}
