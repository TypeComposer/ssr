import { JSDOM } from "jsdom";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import esbuild from "esbuild";
import { installPolyfills } from "./polyfill";
import { IncomingMessage, Server, ServerOptions, ServerResponse } from "http";
import { createServer as createServerHTTP } from "http";

export namespace Engine {
  const assets = new Map<string, Buffer>();

  export interface IRenderResult {
    statusCode: number;
    headers: Record<string, string>;
    body: string | Buffer;
  }

  function mimeByExt(pathname: string): string {
    const ext = extname(pathname).toLowerCase();
    switch (ext) {
      case ".js":
      case ".mjs":
        return "text/javascript; charset=utf-8";
      case ".css":
        return "text/css; charset=utf-8";
      case ".svg":
        return "image/svg+xml";
      case ".json":
        return "application/json; charset=utf-8";
      case ".wasm":
        return "application/wasm";
      case ".map":
        return "application/json; charset=utf-8";
      case ".png":
        return "image/png";
      case ".jpg":
      case ".jpeg":
        return "image/jpeg";
      case ".gif":
        return "image/gif";
      case ".html":
        return "text/html; charset=utf-8";
      default:
        return "application/octet-stream";
    }
  }

  async function bundleToIIFE(entry: string): Promise<string> {
    const result = await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      format: "iife",
      platform: "browser",
      write: false,
      sourcemap: false,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (result as any).outputFiles[0].text as string;
  }

  async function renderHtml(fileJSPath: string): Promise<string> {
    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>TypeComposer</title>
    <link rel="stylesheet" href="./assets/index-glFbR1ha.css">
  </head>
  <body>
  </body>
</html>`;

    const dom = new JSDOM(html, {
      url: "http://localhost/",
      runScripts: "dangerously",
      resources: "usable",
      pretendToBeVisual: true,
    });

    installPolyfills(dom.window as any);

    await new Promise<void>((resolve) => {
      const d = dom.window.document;
      if (d.readyState === "interactive" || d.readyState === "complete")
        resolve();
      else
        d.addEventListener("DOMContentLoaded", resolve as any, { once: true });
    });

    const code = await bundleToIIFE(fileJSPath);
    const scriptEl = dom.window.document.createElement("script");
    scriptEl.type = "text/javascript";
    // @ts-ignore set script content
    scriptEl.text = code;
    dom.window.document.body.appendChild(scriptEl);

    await new Promise((r) => setTimeout(r, 0));

    return "<!doctype html>\n" + dom.serialize();
  }

  export const controller = async (
    req: IncomingMessage,
    res: ServerResponse
  ) => {
    try {
      const result = await Engine.render(req.url || "/");
      res.writeHead(result.statusCode, result.headers);
      if (typeof result.body === "string") {
        res.end(result.body, "utf-8");
      } else {
        res.end(result.body);
      }
    } catch (e) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Internal Server Error");
      console.error("Error during request:", e);
    }
  };

  export async function render(urlPath: string): Promise<IRenderResult> {
    const url = decodeURIComponent(
      new URL(urlPath || "/", "http://localhost").pathname
    );
    console.log("Requisição:", url);

    if (assets.has(url)) {
      const body = assets.get(url) as Buffer;
      return {
        statusCode: 200,
        headers: {
          "Content-Type": mimeByExt(url),
        },
        body,
      };
    }

    if (url === "/" || url.endsWith(".html")) {
      const html = await renderHtml("src/template/assets/index-e5GZiL-9.js");
      console.log("Página enviada:", url);
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
        body: html,
      };
    }

    return {
      statusCode: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
      body: "Not Found",
    };
  }

  function loadAssets(path = "src/template", folderName: string | null = null) {
    const folder = join(process.cwd(), path);
    if (!existsSync(folder)) return;

    for (const file of readdirSync(folder)) {
      const fullPath = join(folder, file);
      const stat = statSync(fullPath);
      if (stat.isFile()) {
        const urlPath = `${folderName ? `/${folderName}` : ""}/${file}`;
        const content = readFileSync(fullPath);
        assets.set(urlPath, content);
      } else if (stat.isDirectory()) {
        loadAssets(
          join(path, file),
          folderName ? `${folderName}/${file}` : file
        );
      }
    }
  }

  /**
   * Create and return an HTTP server that serves the rendered application.
   *
   * This function loads static assets from the specified folder and sets up
   * an HTTP server that uses the Engine's request handler to serve HTML and
   * assets. The server can be started by calling `listen` on the returned
   * object.
   *
   * @param folder - The folder path where static assets are located (default: "src/template")
   * @returns An instance of an HTTP server
   */
  export function createServer<
    Request extends typeof IncomingMessage = typeof IncomingMessage,
    Response extends typeof ServerResponse<
      InstanceType<Request>
    > = typeof ServerResponse
  >(folder: string): Server<Request, Response>;
  export function createServer<
    Request extends typeof IncomingMessage = typeof IncomingMessage,
    Response extends typeof ServerResponse<
      InstanceType<Request>
    > = typeof ServerResponse
  >(
    folder: string,
    options: ServerOptions<Request, Response>
  ): Server<Request, Response>;
  export function createServer(
    folder: string = "src/template",
    options?: any
  ): any {
    loadAssets(folder);
    console.log("Loaded assets:", [...assets.keys()]);
    if (options) return createServerHTTP(options, controller);
    return createServerHTTP(controller);
  }
}
