export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        rx="6"
        stroke="#00D4FF"
        strokeWidth="1.5"
      />
      <path
        d="M9 22V10h5.2a3.4 3.4 0 0 1 0 6.8H9"
        stroke="#00D4FF"
        strokeWidth="2"
        strokeLinecap="square"
      />
      <path
        d="M14.2 16.8h1.6a3.4 3.4 0 0 1 0 5.2H9"
        stroke="#00D4FF"
        strokeWidth="2"
        strokeLinecap="square"
      />
      <circle cx="23" cy="12" r="1.6" fill="#76B900" />
      <circle cx="23" cy="17" r="1.6" fill="#FFB800" />
      <circle cx="23" cy="22" r="1.6" fill="#FF4444" />
    </svg>
  );
}

export function BrandLockup() {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark />
      <div className="leading-tight">
        <p className="text-[13px] font-bold tracking-tight text-fg">
          BEP <span className="text-cyan">AI Infrastructure</span> Tracker
        </p>
        <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-fg-muted">
          Compute · Power · Supply chain
        </p>
      </div>
    </div>
  );
}
