import { existsSync, readdirSync, readFileSync } from "fs";
import { JSDOM } from "jsdom";
import path, { join } from "path";
import { installPolyfills } from "./polyfill";
import  * as express from "express"

export class Engine {

  readonly distPath: string;
  readonly port: number;

  constructor(distPath: string, port: number) {
    this.distPath = distPath;
    this.port = port;
  }

  async controller(req: express.Request, res: express.Response) {
    try {
      console.log("Requisição para:", req.url);
      if (req.url != '/' && existsSync(join(this.distPath, req.url)))
        return res.sendFile(join(this.distPath, req.url));
      const html = await this.renderHtml();
      res.status(200).set("Content-Type", "text/html; charset=utf-8").send(html);
    } catch (err) {
      // console.error("Erro ao renderizar página:", err);
      res.status(500).set("Content-Type", "text/plain; charset=utf-8").send("Erro interno ao renderizar a página");
    }
  }

  public async  renderHtml(url?: string) {
    const html = readFileSync(path.join(this.distPath , "index.html"), "utf8");

    const assetsDir = path.join(this.distPath , "assets");
    const jsFile = readdirSync(assetsDir).find(f => f.match(/^index-.*\.js$/));
    console.log("Arquivo JS encontrado:", jsFile);
    // const cssFile = readdirSync(assetsDir).find(f => f.match(/^index-.*\.css$/));

    const jsCode = jsFile ? readFileSync(path.join(assetsDir, jsFile), "utf8") : "";
    // const cssCode = cssFile ? readFileSync(path.join(assetsDir, cssFile), "utf8") : "";

    const dom = new JSDOM(html, {
      url: `http://localhost:${this.port}/`,
      runScripts: "dangerously",
      resources: "usable",
      pretendToBeVisual: true,
    });

    const doc = dom.window.document;
    const script = doc.createElement("script");

    installPolyfills(dom.window as any);

    if (jsCode) {
      script.type = "module";
      script.textContent = jsCode;
      doc.body.appendChild(script);
    }

    await new Promise<void>((resolve) => {
      dom.window.addEventListener("DOMContentLoaded", () => resolve(), { once: true });
    });

    // pegar os script
    const appScript = Array.from(doc.querySelectorAll<HTMLScriptElement>("script"))[0];//.find(s => s.src.endsWith(jsFile!));
    //.find(s => s.src === jsFile);
    console.log("🛑 App script encontrado:", appScript);

    // await new Promise((resolve) => setTimeout(resolve, 200));
    let content =  dom.serialize().replace(script.outerHTML, "");

    if (appScript) {
         const loadedScript = `
      <script  >
        window.addEventListener('DOMContentLoaded', (event) => {
          console.log('DOM fully loaded and parsed');
          const appScript = document.createElement('script');
          appScript.type = 'module';
          appScript.src = '${appScript.src}';
          document.body.innerHTML = '';
          document.head.appendChild(appScript);
        });
      </script>
      `
      content = content.replace(appScript.outerHTML, loadedScript);
    }
    // console.log("content:", content);
    return content;
  }

}