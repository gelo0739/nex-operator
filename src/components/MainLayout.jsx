/**
 * Page wrapper used by every operator page: renders the page title, subtitle
 * and optional header action, followed by the page body. The sidebar and top
 * header live in <AppShell> (a layout route that stays mounted between pages),
 * so they — and the notification bell's listener — aren't re-created on every
 * navigation. Children are laid out by the shell's `flex flex-col gap-6` canvas.
 */
export default function MainLayout({ children, pageTitle, pageSubtitle, headerAction }) {
  return (
    <>
      {pageTitle && (
        <div className="mb-2 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-950 tracking-tight">{pageTitle}</h2>
            {pageSubtitle && <p className="text-sm text-slate-600 mt-1">{pageSubtitle}</p>}
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}
      {children}
    </>
  );
}
