"use client";

import * as React from "react";
import DOMPurify from "dompurify";
import { Maximize2, Minimize2, Eye, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SandboxedEmailBodyProps {
  html: string;
  fallbackText?: string;
  className?: string;
}

export function SandboxedEmailBody({ html, fallbackText, className }: SandboxedEmailBodyProps) {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = React.useState<number>(300);
  const [colorMode, setColorMode] = React.useState<"auto" | "light" | "dark">("auto");
  const [viewRawText, setViewRawText] = React.useState<boolean>(false);

  // Sanitize HTML with DOMPurify
  const sanitizedHtml = React.useMemo(() => {
    if (!html) return "";
    return DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      ADD_TAGS: ["style", "link", "meta"],
      ADD_ATTR: ["target", "rel", "bgcolor", "align", "valign"],
    });
  }, [html]);

  // Construct complete isolated document with scoped styling & script-free sandbox
  const framedDoc = React.useMemo(() => {
    const isLightMode = colorMode === "light";
    const bgCol = isLightMode ? "#ffffff" : "#0d1321";
    const textCol = isLightMode ? "#0f172a" : "#e2e8f0";
    const linkCol = isLightMode ? "#4f46e5" : "#818cf8";
    const contrastOverride = isLightMode
      ? ""
      : `
        /* In dark mode, brighten near-black author-hardcoded text */
        [style*="color:#000"], [style*="color: #000"],
        [style*="color:#111"], [style*="color: #111"],
        [style*="color:#222"], [style*="color: #222"],
        [style*="color:#333"], [style*="color: #333"] {
          color: #cbd5e1 !important;
        }
      `;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base target="_blank">
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      padding: 0;
      height: auto !important;
      min-height: 0 !important;
      background-color: ${bgCol};
      color: ${textCol};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      word-break: break-word;
      overflow-wrap: break-word;
    }
    #mailr-content-wrapper {
      padding: 16px;
      overflow: hidden;
      height: auto;
      min-height: 0;
    }
    a {
      color: ${linkCol};
      text-decoration: underline;
    }
    img {
      max-width: 100% !important;
      height: auto !important;
    }
    table {
      max-width: 100% !important;
    }
    pre, code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 13px;
    }
    ${contrastOverride}
  </style>
</head>
<body>
  <div id="mailr-content-wrapper">
    ${sanitizedHtml}
  </div>
  <script>
    (function() {
      var wrapper = document.getElementById('mailr-content-wrapper');
      var lastSentHeight = 0;

      function reportHeight() {
        if (!wrapper) return;
        var h = Math.ceil(wrapper.getBoundingClientRect().height);
        if (h > 0 && Math.abs(h - lastSentHeight) > 3) {
          lastSentHeight = h;
          window.parent.postMessage({ type: 'MAILR_IFRAME_HEIGHT', height: h }, '*');
        }
      }

      if (window.ResizeObserver && wrapper) {
        var ro = new ResizeObserver(function() {
          reportHeight();
        });
        ro.observe(wrapper);
      }

      window.addEventListener('load', reportHeight);
      setTimeout(reportHeight, 50);
      setTimeout(reportHeight, 300);
      setTimeout(reportHeight, 1000);
    })();
  </script>
</body>
</html>`;
  }, [sanitizedHtml, colorMode]);

  // Handle height adjustment message from iframe
  React.useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === "MAILR_IFRAME_HEIGHT" && typeof e.data.height === "number") {
        if (e.source && iframeRef.current && e.source !== iframeRef.current.contentWindow) {
          return;
        }
        const targetHeight = Math.max(50, Math.min(Math.ceil(e.data.height), 12000));
        setIframeHeight((prev) => {
          if (Math.abs(prev - targetHeight) > 3) {
            return targetHeight;
          }
          return prev;
        });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Recalculate on load
  const handleIframeLoad = () => {
    try {
      if (iframeRef.current && iframeRef.current.contentDocument) {
        const doc = iframeRef.current.contentDocument;
        const wrapper = doc.getElementById("mailr-content-wrapper");
        const h = wrapper
          ? Math.ceil(wrapper.getBoundingClientRect().height)
          : Math.ceil(doc.body ? doc.body.scrollHeight : 0);
        if (h > 50) {
          setIframeHeight((prev) => (Math.abs(prev - h) > 3 ? h : prev));
        }
      }
    } catch {}
  };

  if (viewRawText || !html) {
    return (
      <div className={cn("space-y-3", className)}>
        {html && (
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setViewRawText(false)}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Switch to HTML View</span>
            </button>
          </div>
        )}
        <div className="whitespace-pre-wrap font-sans text-sm text-foreground/90 bg-card/20 p-5 rounded-2xl border border-border/30 leading-relaxed break-words">
          {fallbackText || "No text content available."}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative rounded-2xl border border-border/40 overflow-hidden bg-card/20", className)}>
      {/* Small top bar with rendering tools (Light/Dark contrast & Plaintext switch) */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-card/40 border-b border-border/30 text-xs text-muted-foreground">
        <span className="text-[11px] font-mono tracking-wider uppercase text-muted-foreground/80">
          Sandboxed Email View
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setColorMode(colorMode === "light" ? "dark" : "light")}
            title={colorMode === "light" ? "Switch to Dark contrast" : "Switch to Light contrast"}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
          >
            {colorMode === "light" ? <Moon className="w-3 h-3 text-indigo-400" /> : <Sun className="w-3 h-3 text-amber-400" />}
            <span>{colorMode === "light" ? "Dark Mode" : "Light Mode"}</span>
          </button>
          <span className="text-border/80">&bull;</span>
          <button
            type="button"
            onClick={() => setViewRawText(true)}
            title="View plain text version"
            className="text-[11px] hover:text-foreground transition-colors cursor-pointer"
          >
            Plain Text
          </button>
        </div>
      </div>

      {/* Sandboxed Iframe (CSS & Script Isolated from parent window) */}
      <iframe
        ref={iframeRef}
        srcDoc={framedDoc}
        title="Email Body Content"
        onLoad={handleIframeLoad}
        sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
        style={{
          width: "100%",
          height: `${iframeHeight}px`,
          border: "none",
          display: "block",
        }}
        className="w-full bg-transparent overflow-hidden"
      />
    </div>
  );
}
