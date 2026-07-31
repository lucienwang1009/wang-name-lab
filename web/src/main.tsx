import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const root = document.getElementById("root");

if (!root) {
  throw new Error("找不到应用挂载节点");
}

createRoot(root).render(
  <StrictMode>
    <main>
      <h1>王姓女孩取名实验室</h1>
      <p>TypeScript 核心正在接入。</p>
    </main>
  </StrictMode>,
);

