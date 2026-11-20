import { createRoot } from "react-dom/client";
import App from "./App";
import { loadCatalog } from "./storage/catalog";
import "./ui/app.css";
const root = createRoot(document.getElementById("root")!);
async function start() {
  try {
    await loadCatalog();
    root.render(<App />);
  } catch (e) {
    root.render(
      <main className="reading-content" role="alert">
        <h1>无法载入本地书库</h1>
        <p>{String(e)}</p>
        <button className="button" onClick={start}>
          重新读取
        </button>
      </main>,
    );
  }
}
void start();
