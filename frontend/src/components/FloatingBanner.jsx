export function FloatingBanner({ children }) {
  return (
    <div className="fixed left-1/2 top-4 z-40 w-[min(92vw,900px)] -translate-x-1/2 rounded-full border border-[#3162ac]/35 bg-white/90 px-4 py-3 text-center text-sm text-[#10346f] shadow-lg backdrop-blur-sm">
      {children}
    </div>
  );
}
