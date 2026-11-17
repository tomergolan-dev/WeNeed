/** The app icon: three list rows, two of them checked. Same drawing as src/app/icon.svg. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden>
      <rect width="512" height="512" rx="130" fill="#16835f" />
      {[170, 256].map((y) => (
        <g key={y}>
          <circle cx="342" cy={y} r="36" fill="#fff" />
          <path
            d={`M325 ${y + 1} 337 ${y + 13} 359 ${y - 11}`}
            fill="none"
            stroke="#16835f"
            strokeWidth="11"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="140" y={y - 15} width="150" height="30" rx="15" fill="#fff" fillOpacity=".55" />
        </g>
      ))}
      <circle cx="342" cy="342" r="30" fill="none" stroke="#fff" strokeWidth="12" />
      <rect x="140" y="327" width="150" height="30" rx="15" fill="#fff" />
    </svg>
  );
}

/** The app logo: the icon and the name. */
export function Brand() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark className="size-10" />
      <span dir="ltr" className="text-[19px] font-extrabold tracking-tight">
        WeNeed
      </span>
    </span>
  );
}
