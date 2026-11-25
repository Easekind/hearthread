import { t, applyLocale } from "./i18n";
import { createRoot } from "react-dom/client";
import App from "./App";
import { catalog, loadCatalog } from "./storage/catalog";
import "./ui/app.css";
const root = createRoot(document.getElementById("root")!);
// Apply committed preferences before React reads the new catalog snapshot.
catalog.subscribe(() => {
  const { locale } = catalog.get().prefs;
  if (document.documentElement.lang !== locale) applyLocale(locale);
});
async function start() {
  try {
    await loadCatalog();
    root.render(<App />);
  } catch (e) {
    root.render(
      <main className="reading-content" role="alert">
        <h1>{t("error.loadLibrary")}</h1>
        <p>{String(e)}</p>
        <button className="button" onClick={start}>
          {t("action.retry")}
        </button>
      </main>,
    );
  }
}
void start();
