export function saleBadgeContents(value) {
  const points = Array.from({length: 30}, (_, i) => {
    const theta = -Math.PI / 2 + i * Math.PI / 15;
    const radius = i % 2 ? 41.6 : 49.7;
    return `${(50 + radius * Math.cos(theta)).toFixed(2)},${(50 + radius * Math.sin(theta)).toFixed(2)}`;
  });
  return `<polygon fill="#ee242d" points="${points.join(' ')}"/>
  <g font-family="Arial,Helvetica,sans-serif" font-weight="900" fill="white">
    <text x="37" y="50" text-anchor="middle" font-size="${value === 100 ? 27 : 35}">${value}</text>
    <text x="63" y="36" font-size="18">%</text><text x="62" y="49" font-size="12">OFF</text>
    <text x="50" y="65" font-size="11.6" text-anchor="middle">NEW RETAIL</text>
    <text x="50" y="78" font-size="11.6" text-anchor="middle">PRICE</text>
  </g>`;
}
