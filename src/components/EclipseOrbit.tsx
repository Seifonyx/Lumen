/** One restrained comet around the existing mark; all coordinates stay inside its current artwork. */
export default function EclipseOrbit({ x, y, radius }: { x: number; y: number; radius: number }) {
  return <g transform={`translate(${x} ${y}) scale(${radius / 20})`}>
    <g className="moon-orbit">
      <g fill="none" stroke="var(--signal, #c2ef3a)" strokeWidth=".8" strokeLinecap="round">
        <path d="M8.45 -18.13A20 20 0 0 1 20 0" opacity=".2" />
        <path d="M15.32 -12.86A20 20 0 0 1 20 0" opacity=".45" />
        <path d="M18.79 -6.84A20 20 0 0 1 20 0" opacity=".9" />
      </g>
      <circle className="orbit-head" cx="20" cy="0" r="1.15" fill="#f6ffc8" />
      <path className="orbit-flare" d="M20 -3.5Q20.4 -.4 23.5 0Q20.4 .4 20 3.5Q19.6 .4 16.5 0Q19.6 -.4 20 -3.5Z" fill="#fff" />
    </g>
  </g>;
}
