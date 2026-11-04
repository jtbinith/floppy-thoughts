// Our shrimp icon: a solid silhouette with long feelers looping back over the top,
// a banded curled body and a fan tail. Original artwork. Uses the current text colour,
// so it suits any button.
export function ShrimpIcon({ size = 22 }: { size?: number }) {
  return (
    <svg className="shrimp-icon" width={size} height={size} viewBox="12 12 46 50" aria-hidden="true">
      <g fill="currentColor" stroke="currentColor">
        {/* feelers */}
        <path d="M17 31 C9 29 9 16 20 16 H46" fill="none" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M19.5 32 C13 30 13.5 21 22 21 H49" fill="none" strokeWidth="2.4" strokeLinecap="round" />
        {/* head, with the eye cut out */}
        <path
          fillRule="evenodd"
          stroke="none"
          d="M16 31 C21 26 29 24.5 37.5 24.5 L38.5 36.5 C30 37.5 23 36 16 31 Z M24 29.6 a1.5 1.5 0 1 0 3 0 a1.5 1.5 0 1 0 -3 0 Z"
        />
        {/* banded body: the gaps in the stroke are the shell bands */}
        <path d="M40 30.5 C51 30 56 38 53.5 46 C51.5 51 46 53 40 53" fill="none" strokeWidth="11" pathLength="100" strokeDasharray="22 3.5" />
        {/* fan tail: two fins, joined at the base */}
        <path stroke="none" d="M45 50 C37 47 30 46.5 26 48.5 C28 51 30.5 53 33.5 54 L45 54 Z" />
        <path stroke="none" d="M45 52.5 L33.5 53.5 C30.5 55.3 28.5 57.3 27 59.5 C32 60.5 38 58.5 45 55.5 Z" />
      </g>
      {/* little legs tucked under the head */}
      <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M33.5 38.5 C30.5 39.5 29.5 41.5 30 43.5" />
        <path d="M37 40 C34 41.5 33.5 44 34.5 46" />
      </g>
    </svg>
  )
}
