/**
 * Polyfill innerText property for environments where it's missing.
 *
 * Some DOM implementations (like jsdom) only provide textContent. Many
 * libraries and components rely on innerText, so this adds a getter/setter
 * that proxies to textContent.
 *
 * @param win - The global window-like object to patch (e.g. JSDOM.window)
 */
export function polyfillInnerText(win: any) {
  const proto = win.HTMLElement && win.HTMLElement.prototype;
  if (!proto) return;
  if (!Object.getOwnPropertyDescriptor(proto, "innerText")) {
    Object.defineProperty(proto, "innerText", {
      get() {
        return this.textContent;
      },
      set(v: any) {
        this.textContent = v == null ? "" : String(v);
      },
      configurable: true,
      enumerable: true,
    });
  }
}
// shodown

/**
 * Minimal Shadow DOM polyfill for environments without native ShadowRoot.
 *
 * This provides a lightweight ShadowRoot constructor and an attachShadow
 * implementation that stores a simple shadow object on the host. It's not a
 * full Shadow DOM implementation, but it's sufficient for libraries that only
 * check for presence of `attachShadow` / `shadowRoot` and don't rely on
 * encapsulation details.
 *
 * @param win - The global window-like object to patch
 */
export function polyfillShadowDOM(win: any) {
  if (!win.ShadowRoot) {
    win.ShadowRoot = function () {} as any;
    win.ShadowRoot.prototype = Object.create(win.HTMLElement.prototype);
    win.HTMLElement.prototype.attachShadow = function (options: any) {
      const shadow = new win.ShadowRoot();
      shadow.mode = options?.mode || "open";
      shadow.host = this;
      this.shadowRoot = shadow;
      return shadow;
    };
  }
}

/**
 * Polyfill matchMedia to provide a minimal interface for CSS media queries.
 *
 * Many UI frameworks check window.matchMedia() to decide layout behavior.
 * This returns a stub object with the common methods so code expecting the
 * API won't throw.
 *
 * @param win - The global window-like object to patch
 */
export function polyfillMatchMedia(win: any) {
  if (!win.matchMedia) {
    win.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    });
  }
}

/**
 * Polyfill common Element/HTMLElement APIs: matches, closest, contains,
 * replaceWith, remove, etc.
 *
 * Provides implementations for APIs that modern browsers expose but are not
 * always present in lightweight DOM implementations. These helpers attempt to
 * mimic the native semantics closely enough for most libraries and tests.
 *
 * @param win - The global window-like object to patch
 */
export function polyfillElementAPIs(win: any) {
  if (!win.HTMLElement) {
    win.HTMLElement = win.Element;
  }

  if (!win.Element.prototype.matches) {
    win.Element.prototype.matches =
      win.Element.prototype.msMatchesSelector ||
      win.Element.prototype.webkitMatchesSelector;
  }

  if (!win.Element.prototype.closest) {
    win.Element.prototype.closest = function (s: string) {
      let el: any = this;
      if (!document.documentElement.contains(el)) return null;
      do {
        if (el.matches(s)) return el;
        el = el.parentElement || el.parentNode;
      } while (el !== null && el.nodeType === 1);
      return null;
    };
  }

  if (!win.HTMLElement.prototype.contains) {
    win.HTMLElement.prototype.contains = function (el: any) {
      let node = el;
      while (node != null) {
        if (node === this) return true;
        node = node.parentNode;
      }
      return false;
    };
  }

  if (!win.HTMLElement.prototype.remove) {
    win.HTMLElement.prototype.remove = function () {
      if (this.parentNode) {
        this.parentNode.removeChild(this);
      }
    };
  }

  if (!win.HTMLElement.prototype.replaceWith) {
    win.HTMLElement.prototype.replaceWith = function (...nodes: any[]) {
      const parent = this.parentNode;
      if (!parent) return;
      let i = nodes.length;
      const fragment = win.document.createDocumentFragment();
      while (i--) {
        let node = nodes[i];
        if (typeof node !== "object") {
          node = win.document.createTextNode(node);
        } else if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
        fragment.insertBefore(node, fragment.firstChild);
      }
      parent.replaceChild(fragment, this);
    };
  }
}

/**
 * Polyfill DOM utilities such as scrollTo, ResizeObserver and
 * IntersectionObserver with no-op or simplified implementations.
 *
 * These are minimal stubs that prevent runtime errors when libraries
 * reference these constructors or methods during SSR. They intentionally do
 * not implement full behavior - only enough for server-side rendering.
 *
 * @param win - The global window-like object to patch
 */
export function polyfillDOMUtils(win: any) {
  if (!win.HTMLElement.prototype.scrollTo) {
    win.HTMLElement.prototype.scrollTo = function () {};
  }
  if (!win.ResizeObserver) {
    win.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!win.IntersectionObserver) {
    win.IntersectionObserver = class {
      constructor() {}
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [] as any[];
      }
    };
  }
}

/**
 * Polyfill CustomEvent constructor for environments that lack it.
 *
 * Some libraries construct new CustomEvent(...) and expect DOM events to be
 * created this way. This function provides an implementation using the
 * legacy `document.createEvent('CustomEvent')` path so event creation works
 * in older DOMs.
 *
 * @param win - The global window-like object to patch
 */
export function polyfillCustomEvent(win: any) {
  if (!win.CustomEvent) {
    win.CustomEvent = function (event: string, params: any) {
      params = params || { bubbles: false, cancelable: false, detail: null };
      const evt = win.document.createEvent("CustomEvent");
      evt.initCustomEvent(
        event,
        params.bubbles,
        params.cancelable,
        params.detail
      );
      return evt;
    };
    win.CustomEvent.prototype = win.Event.prototype;
  }
}

/**
 * Apply the full set of polyfills to the provided window-like object.
 *
 * This is a convenience function that calls each individual polyfill. Use
 * this when you want a single call to make a JSDOM (or similar environment)
 * behave more like a browser for SSR or tests.
 *
 * @param win - The global window-like object to patch
 */
export function installPolyfills(win: any) {
  polyfillMatchMedia(win);
  polyfillInnerText(win);
  polyfillShadowDOM(win);
  polyfillElementAPIs(win);
  polyfillCustomEvent(win);
  polyfillDOMUtils(win);
}
